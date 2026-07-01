import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import {
  LineaComprobanteInput,
  RegistrarComprobanteInput,
} from './ledger.types';

// =============================================================================
// LÍMITE POR COMPROBANTE — previene picos accidentales de memoria/red.
// =============================================================================
const MAX_LINEAS = 200;

// =============================================================================
// LedgerService · ADR-001 §6 — Puerto único de entrada al libro mayor.
// =============================================================================
// Responsable de validar invariantes (I1–I8), asignar consecutivo (I7) y
// persistir comprobante + movimientos en una sola transacción.
// No conoce nómina ni facturación: recibe inputs genéricos.
// =============================================================================

@Injectable()
export class LedgerService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  // ============================================================================
  // registrarComprobante
  // ============================================================================

  async registrarComprobante(input: RegistrarComprobanteInput) {
    this.validarLineas(input.lineas);
    this.validarClaveOrigen(input);

    return this.prisma.$transaction(
      async (tx) => {
        const periodo = await this.resolvePeriodoAbierto(
          tx,
          input.tenantId,
          input.periodoId,
        );

        await this.validarCuentas(tx, input.tenantId, input.lineas);
        await this.validarIdempotencia(tx, input);

        const totalDebito = this.sumar(input.lineas, 'debito');
        const totalCredito = this.sumar(input.lineas, 'credito');
        this.validarPartidaDoble(totalDebito, totalCredito);

        const numero = await this.asignarConsecutivo(
          tx,
          input.tenantId,
          input.tipoComprobanteId,
        );

        const comprobante = await tx.comprobanteContable.create({
          data: {
            tenantId: input.tenantId,
            tipoComprobanteId: input.tipoComprobanteId,
            periodoId: periodo.id,
            numero,
            fecha: input.fecha,
            concepto: input.concepto,
            estado: 'CONTABILIZADO',
            totalDebito,
            totalCredito,
            origenTipo: input.origenTipo ?? null,
            origenId: input.origenId ?? null,
            origenEvento: input.origenEvento ?? null,
            usuarioId: input.userId,
            contabilizadoAt: new Date(),
            movimientos: {
              create: input.lineas.map((l, i) => ({
                tenantId: input.tenantId,
                linea: i + 1,
                cuentaId: l.cuentaId,
                terceroId: l.terceroId ?? null,
                centroCostoId: l.centroCostoId ?? null,
                debito: l.debito,
                credito: l.credito,
                baseGravable: l.baseGravable ?? null,
                descripcion: l.descripcion ?? null,
              })),
            },
          },
          include: { movimientos: { orderBy: { linea: 'asc' } } },
        });

        this.audit
          .log({
            tenantId: input.tenantId,
            userId: input.userId,
            action: 'COMPROBANTE_CONTABILIZADO',
            entityType: 'ComprobanteContable',
            entityId: comprobante.id,
            metadata: { numero, tipo: input.tipoComprobanteId },
          })
          .catch(() => {});

        return comprobante;
      },
      { timeout: 15000 },
    );
  }

  // ============================================================================
  // anular
  // ============================================================================

  async anular(
    tenantId: string,
    userId: string,
    comprobanteId: string,
    motivo: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const comprobante = await this.findComprobante(
        tx,
        tenantId,
        comprobanteId,
      );

      if (comprobante.estado === 'ANULADO') {
        return comprobante; // idempotente
      }

      if (comprobante.estado === 'BORRADOR') {
        throw new BadRequestException(
          'Un comprobante en borrador no puede anularse. Descártelo directamente.',
        );
      }

      const periodo = await tx.periodoContable.findUniqueOrThrow({
        where: { id: comprobante.periodoId },
      });

      if (periodo.estado === 'ABIERTO') {
        const anulado = await tx.comprobanteContable.update({
          where: { id: comprobante.id },
          data: { estado: 'ANULADO' },
          include: { movimientos: { orderBy: { linea: 'asc' } } },
        });

        this.audit
          .log({
            tenantId,
            userId,
            action: 'COMPROBANTE_ANULADO',
            entityType: 'ComprobanteContable',
            entityId: anulado.id,
            metadata: { motivo, numero: anulado.numero },
          })
          .catch(() => {});

        return anulado;
      }

      // Período CERRADO → comprobante de reverso en período ABIERTO actual
      const periodoAbierto = await this.resolvePeriodoAbiertoActual(
        tx,
        tenantId,
      );
      return this.crearReverso(
        tx,
        tenantId,
        userId,
        comprobante,
        motivo,
        periodoAbierto.id,
      );
    });
  }

  // ============================================================================
  // Reverso (append-only)
  // ============================================================================

  private async crearReverso(
    tx: Prisma.TransactionClient,
    tenantId: string,
    userId: string,
    original: {
      id: string;
      numero: number | null;
      tipoComprobanteId: string;
      concepto: string;
    },
    motivo: string,
    periodoAbiertoId: string,
  ) {
    const lineas = await tx.movimientoContable.findMany({
      where: { comprobanteId: original.id },
      orderBy: { linea: 'asc' },
    });

    const totalDebito = this.sumar(lineas, 'credito');
    const totalCredito = this.sumar(lineas, 'debito');

    const numero = await this.asignarConsecutivo(
      tx,
      tenantId,
      original.tipoComprobanteId,
    );

    const reverso = await tx.comprobanteContable.create({
      data: {
        tenantId,
        tipoComprobanteId: original.tipoComprobanteId,
        periodoId: periodoAbiertoId,
        numero,
        fecha: new Date(),
        concepto: `Reverso: ${original.concepto}. Motivo: ${motivo}`,
        estado: 'CONTABILIZADO',
        totalDebito,
        totalCredito,
        reversaAId: original.id,
        origenTipo: 'REVERSO',
        origenId: original.id,
        origenEvento: `REVERSO_${original.numero ?? 'SN'}`,
        usuarioId: userId,
        contabilizadoAt: new Date(),
        movimientos: {
          create: lineas.map((l, i) => ({
            tenantId,
            linea: i + 1,
            cuentaId: l.cuentaId,
            terceroId: l.terceroId,
            centroCostoId: l.centroCostoId,
            debito: l.credito,
            credito: l.debito,
            baseGravable: l.baseGravable,
            descripcion: l.descripcion
              ? `[REVERSO] ${l.descripcion}`
              : `Reverso línea ${l.linea} del comprobante ${original.numero}`,
          })),
        },
      },
      include: { movimientos: { orderBy: { linea: 'asc' } } },
    });

    this.audit
      .log({
        tenantId,
        userId,
        action: 'COMPROBANTE_REVERSO',
        entityType: 'ComprobanteContable',
        entityId: reverso.id,
        metadata: {
          motivo,
          originalId: original.id,
          numero: reverso.numero,
        },
      })
      .catch(() => {});

    return reverso;
  }

  // ============================================================================
  // Validaciones
  // ============================================================================

  private validarLineas(lineas: LineaComprobanteInput[]) {
    if (!lineas || lineas.length < 2) {
      throw new BadRequestException(
        'Un comprobante requiere al menos 2 líneas (partida doble).',
      );
    }

    if (lineas.length > MAX_LINEAS) {
      throw new BadRequestException(
        `Máximo ${MAX_LINEAS} líneas por comprobante.`,
      );
    }

    for (const [i, l] of lineas.entries()) {
      const d = new Prisma.Decimal(l.debito);
      const c = new Prisma.Decimal(l.credito);

      if (d.lt(0) || c.lt(0)) {
        throw new BadRequestException(
          `Línea ${i + 1}: débito y crédito no pueden ser negativos.`,
        );
      }

      if (d.eq(0) && c.eq(0)) {
        throw new BadRequestException(
          `Línea ${i + 1}: debe tener débito o crédito mayor que cero.`,
        );
      }

      if (d.gt(0) && c.gt(0)) {
        throw new BadRequestException(
          `Línea ${i + 1}: no puede tener débito y crédito simultáneamente.`,
        );
      }
    }
  }

  private validarClaveOrigen(input: RegistrarComprobanteInput) {
    const campos = [input.origenTipo, input.origenId, input.origenEvento];
    const definidos = campos.filter((c) => c !== undefined && c !== null);
    if (definidos.length > 0 && definidos.length !== 3) {
      throw new BadRequestException(
        'origenTipo, origenId y origenEvento deben ser todos definidos o todos indefinidos.',
      );
    }
  }

  private validarPartidaDoble(
    totalDebito: Prisma.Decimal,
    totalCredito: Prisma.Decimal,
  ) {
    if (!totalDebito.eq(totalCredito)) {
      throw new BadRequestException(
        `Partida no balanceada: débitos ${totalDebito} ≠ créditos ${totalCredito}.`,
      );
    }
  }

  private async validarCuentas(
    tx: Prisma.TransactionClient,
    tenantId: string,
    lineas: LineaComprobanteInput[],
  ) {
    const cuentaIds = [...new Set(lineas.map((l) => l.cuentaId))];
    const cuentas = await tx.cuentaContable.findMany({
      where: { id: { in: cuentaIds }, tenantId },
      select: {
        id: true,
        codigo: true,
        imputable: true,
        activa: true,
        deletedAt: true,
        requiereTercero: true,
        requiereCentroCosto: true,
        requiereBase: true,
      },
    });

    const mapa = new Map(cuentas.map((c) => [c.id, c]));

    for (const cid of cuentaIds) {
      const cuenta = mapa.get(cid);
      if (!cuenta) {
        throw new NotFoundException(
          `La cuenta con id ${cid} no existe en este tenant.`,
        );
      }
      if (cuenta.deletedAt) {
        throw new BadRequestException(
          `La cuenta ${cuenta.codigo} está eliminada y no recibe movimientos.`,
        );
      }
      if (!cuenta.activa) {
        throw new BadRequestException(
          `La cuenta ${cuenta.codigo} está inactiva y no recibe movimientos.`,
        );
      }
      if (!cuenta.imputable) {
        throw new BadRequestException(
          `La cuenta ${cuenta.codigo} no es imputable (es agrupadora).`,
        );
      }
    }

    // Validación por línea: tercero, centro de costo, base gravable
    for (const [i, l] of lineas.entries()) {
      const cuenta = mapa.get(l.cuentaId)!;

      if (cuenta.requiereTercero && !l.terceroId) {
        throw new BadRequestException(
          `Línea ${i + 1}: la cuenta ${cuenta.codigo} requiere tercero.`,
        );
      }

      if (cuenta.requiereCentroCosto && !l.centroCostoId) {
        throw new BadRequestException(
          `Línea ${i + 1}: la cuenta ${cuenta.codigo} requiere centro de costo.`,
        );
      }

      if (
        cuenta.requiereBase &&
        (l.baseGravable === undefined || l.baseGravable === null)
      ) {
        throw new BadRequestException(
          `Línea ${i + 1}: la cuenta ${cuenta.codigo} requiere base gravable.`,
        );
      }
    }

    // Validar que tercero y centroCosto existen (si fueron provistos)
    await this.validarTerceros(tx, tenantId, lineas);
    await this.validarCentrosCosto(tx, tenantId, lineas);
  }

  private async validarTerceros(
    tx: Prisma.TransactionClient,
    tenantId: string,
    lineas: LineaComprobanteInput[],
  ) {
    const terceroIds = [
      ...new Set(lineas.map((l) => l.terceroId).filter(Boolean) as string[]),
    ];
    if (terceroIds.length === 0) return;

    const terceros = await tx.tercero.findMany({
      where: { id: { in: terceroIds }, tenantId },
      select: { id: true },
    });

    if (terceros.length !== terceroIds.length) {
      const existentes = new Set(terceros.map((t) => t.id));
      const faltante = terceroIds.find((id) => !existentes.has(id));
      throw new NotFoundException(`Tercero no encontrado: ${faltante}`);
    }
  }

  private async validarCentrosCosto(
    tx: Prisma.TransactionClient,
    tenantId: string,
    lineas: LineaComprobanteInput[],
  ) {
    const centroIds = [
      ...new Set(
        lineas.map((l) => l.centroCostoId).filter(Boolean) as string[],
      ),
    ];
    if (centroIds.length === 0) return;

    const centros = await tx.centroCosto.findMany({
      where: { id: { in: centroIds }, tenantId },
      select: { id: true },
    });

    if (centros.length !== centroIds.length) {
      const existentes = new Set(centros.map((c) => c.id));
      const faltante = centroIds.find((id) => !existentes.has(id));
      throw new NotFoundException(`Centro de costo no encontrado: ${faltante}`);
    }
  }

  private async validarIdempotencia(
    tx: Prisma.TransactionClient,
    input: RegistrarComprobanteInput,
  ) {
    if (!input.origenTipo) return;

    const existente = await tx.comprobanteContable.findFirst({
      where: {
        tenantId: input.tenantId,
        origenTipo: input.origenTipo,
        origenId: input.origenId,
        origenEvento: input.origenEvento,
        estado: { not: 'ANULADO' },
      },
      select: { id: true, numero: true },
    });

    if (existente) {
      throw new ConflictException(
        `Este documento ya fue contabilizado (comprobante ${existente.numero}). ` +
          'Use un evento diferente o anule el comprobante existente antes de reprocesar.',
      );
    }
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private async resolvePeriodoAbierto(
    tx: Prisma.TransactionClient,
    tenantId: string,
    periodoId: string,
  ) {
    const periodo = await tx.periodoContable.findFirst({
      where: { id: periodoId, tenantId },
    });

    if (!periodo) {
      throw new NotFoundException('Período contable no encontrado.');
    }

    if (periodo.estado !== 'ABIERTO') {
      throw new BadRequestException(
        `El período está ${periodo.estado}. Solo se contabiliza en períodos ABIERTO.`,
      );
    }

    return periodo;
  }

  private async asignarConsecutivo(
    tx: Prisma.TransactionClient,
    tenantId: string,
    tipoComprobanteId: string,
  ): Promise<number> {
    const secuencia = await tx.secuenciaComprobante.upsert({
      where: {
        tenantId_tipoComprobanteId: { tenantId, tipoComprobanteId },
      },
      create: { tenantId, tipoComprobanteId, ultimoNumero: 1 },
      update: { ultimoNumero: { increment: 1 } },
    });

    return secuencia.ultimoNumero;
  }

  private async resolvePeriodoAbiertoActual(
    tx: Prisma.TransactionClient,
    tenantId: string,
  ) {
    const periodo = await tx.periodoContable.findFirst({
      where: { tenantId, estado: 'ABIERTO' },
      orderBy: [{ anio: 'desc' }, { mes: 'desc' }],
    });

    if (!periodo) {
      throw new BadRequestException(
        'No existe un período contable ABIERTO en este tenant. ' +
          'Abra un período antes de revertir comprobantes de períodos cerrados.',
      );
    }

    return periodo;
  }

  private async findComprobante(
    tx: Prisma.TransactionClient,
    tenantId: string,
    comprobanteId: string,
  ) {
    const comprobante = await tx.comprobanteContable.findFirst({
      where: { id: comprobanteId, tenantId },
      include: { movimientos: { orderBy: { linea: 'asc' } } },
    });

    if (!comprobante) {
      throw new NotFoundException('Comprobante no encontrado.');
    }

    return comprobante;
  }

  private sumar(
    lineas: Array<{
      debito: Prisma.Decimal | number;
      credito: Prisma.Decimal | number;
    }>,
    campo: 'debito' | 'credito',
  ): Prisma.Decimal {
    return lineas.reduce((acc, l) => acc.plus(l[campo]), new Prisma.Decimal(0));
  }
}
