import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ReportingService } from '../reporting/reporting.service';
import { AuditService } from '../../audit/audit.service';

// Contrato único de códigos de bloqueo de C3 (U1–U4). Toda validación de
// cierre/reapertura referencia estas constantes — nunca literales sueltos —
// para que U2, U3 y futuras fases (U4) comparen contra el mismo identificador.
export const ClosureBloqueo = {
  PERIODO_NO_ENCONTRADO: 'PERIODO_NO_ENCONTRADO',
  PERIODO_YA_CERRADO: 'PERIODO_YA_CERRADO',
  PERIODO_YA_ABIERTO: 'PERIODO_YA_ABIERTO', // reservado (ver §10.2 del diseño)
  BORRADORES_PENDIENTES: 'BORRADORES_PENDIENTES',
  CIERRE_CRONOLOGICO: 'CIERRE_CRONOLOGICO',
  DESCUADRE: 'DESCUADRE',
  MOTIVO_REQUERIDO: 'MOTIVO_REQUERIDO',
  NO_ES_ULTIMO_PERIODO_CERRADO: 'NO_ES_ULTIMO_PERIODO_CERRADO',
  CIERRE_ANUAL_POSTEADO: 'CIERRE_ANUAL_POSTEADO',
} as const;

export type ClosureBloqueoCodigo =
  (typeof ClosureBloqueo)[keyof typeof ClosureBloqueo];

// Clave de origen del comprobante de cierre anual (C3-I8, U4). Se fija aquí
// porque U3 ya necesita detectarlo (C3-I12) antes de que U4 exista.
export const ORIGEN_CIERRE_ANUAL = 'CIERRE_ANUAL';

export interface ValidacionCierreResult {
  procede: boolean;
  bloqueos: string[];
}

export interface CerrarPeriodoResult {
  cerrado: boolean;
  yaEstabaCerrado: boolean;
  bloqueos?: string[];
}

export interface ReabrirPeriodoResult {
  reabierto: boolean;
  yaEstabaAbierto: boolean;
  bloqueos?: string[];
}

@Injectable()
export class ClosureService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reporting: ReportingService,
    private readonly audit: AuditService,
  ) {}

  async validarCierrePeriodo(
    tenantId: string,
    periodoId: string,
  ): Promise<ValidacionCierreResult> {
    const bloqueos: string[] = [];

    // --- 1. El período existe y está ABIERTO ---
    const periodo = await this.prisma.periodoContable.findFirst({
      where: { id: periodoId, tenantId },
      select: {
        id: true,
        estado: true,
        anio: true,
        mes: true,
        fechaInicio: true,
        fechaFin: true,
      },
    });

    if (!periodo) {
      bloqueos.push(ClosureBloqueo.PERIODO_NO_ENCONTRADO);
      return { procede: false, bloqueos };
    }

    if (periodo.estado === 'CERRADO') {
      bloqueos.push(ClosureBloqueo.PERIODO_YA_CERRADO);
    }

    if (bloqueos.length > 0) {
      return { procede: false, bloqueos };
    }

    // --- 2. Sin comprobantes en BORRADOR ---
    const borradoresCount = await this.prisma.comprobanteContable.count({
      where: {
        tenantId,
        periodoId,
        estado: 'BORRADOR',
      },
    });

    if (borradoresCount > 0) {
      bloqueos.push(ClosureBloqueo.BORRADORES_PENDIENTES);
    }

    // --- 3. Cierre cronológico ---
    const { anio, mes } = periodo;
    const mesAnterior = mes === 1 ? 12 : mes - 1;
    const anioAnterior = mes === 1 ? anio - 1 : anio;

    const anteriorAbierto = await this.prisma.periodoContable.findFirst({
      where: {
        tenantId,
        anio: anioAnterior,
        mes: mesAnterior,
        estado: 'ABIERTO',
      },
      select: { id: true },
    });

    if (anteriorAbierto) {
      bloqueos.push(ClosureBloqueo.CIERRE_CRONOLOGICO);
    }

    // --- 4. Cuadre del período — consume C2, no calcula saldos (C3-I10) ---
    const balance = await this.reporting.obtenerBalancePrueba(tenantId, {
      fechaInicio: periodo.fechaInicio,
      fechaFin: periodo.fechaFin,
    });

    const totalDebito = balance.reduce(
      (acc, item) => acc.add(item.totalDebito),
      new Prisma.Decimal(0),
    );
    const totalCredito = balance.reduce(
      (acc, item) => acc.add(item.totalCredito),
      new Prisma.Decimal(0),
    );

    if (!totalDebito.equals(totalCredito)) {
      bloqueos.push(ClosureBloqueo.DESCUADRE);
    }

    return {
      procede: bloqueos.length === 0,
      bloqueos,
    };
  }

  async cerrarPeriodo(
    tenantId: string,
    periodoId: string,
    userId: string,
  ): Promise<CerrarPeriodoResult> {
    const validacion = await this.validarCierrePeriodo(tenantId, periodoId);

    if (validacion.bloqueos.includes(ClosureBloqueo.PERIODO_YA_CERRADO)) {
      return { cerrado: true, yaEstabaCerrado: true };
    }

    if (!validacion.procede) {
      return {
        cerrado: false,
        yaEstabaCerrado: false,
        bloqueos: validacion.bloqueos,
      };
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.periodoContable.updateMany({
        where: {
          id: periodoId,
          tenantId,
          estado: 'ABIERTO',
        },
        data: {
          estado: 'CERRADO',
          cerradoAt: new Date(),
          cerradoPorId: userId,
        },
      });

      return result.count;
    });

    if (updated === 0) {
      return { cerrado: true, yaEstabaCerrado: true };
    }

    this.audit
      .log({
        tenantId,
        userId,
        action: 'PERIODO_CONTABLE_CERRADO',
        entityType: 'PeriodoContable',
        entityId: periodoId,
      })
      .catch(() => {});

    return { cerrado: true, yaEstabaCerrado: false };
  }

  async reabrirPeriodo(
    tenantId: string,
    periodoId: string,
    userId: string,
    motivo: string,
  ): Promise<ReabrirPeriodoResult> {
    const bloqueos: string[] = [];

    if (!motivo || motivo.trim().length === 0) {
      bloqueos.push(ClosureBloqueo.MOTIVO_REQUERIDO);
    }

    // --- El período existe ---
    const periodo = await this.prisma.periodoContable.findFirst({
      where: { id: periodoId, tenantId },
      select: { id: true, estado: true, anio: true, mes: true },
    });

    if (!periodo) {
      bloqueos.push(ClosureBloqueo.PERIODO_NO_ENCONTRADO);
      return { reabierto: false, yaEstabaAbierto: false, bloqueos };
    }

    if (bloqueos.length > 0) {
      return { reabierto: false, yaEstabaAbierto: false, bloqueos };
    }

    if (periodo.estado === 'ABIERTO') {
      return { reabierto: true, yaEstabaAbierto: true };
    }

    // --- LIFO (C3-I4): no debe existir un período CERRADO posterior ---
    const { anio, mes } = periodo;
    const posteriorCerrado = await this.prisma.periodoContable.findFirst({
      where: {
        tenantId,
        estado: 'CERRADO',
        OR: [{ anio: { gt: anio } }, { anio, mes: { gt: mes } }],
      },
      select: { id: true },
    });

    if (posteriorCerrado) {
      bloqueos.push(ClosureBloqueo.NO_ES_ULTIMO_PERIODO_CERRADO);
    }

    // --- Cierre anual posteado (C3-I12): exige reverso previo por el puerto ---
    const cierreAnual = await this.prisma.comprobanteContable.findFirst({
      where: {
        tenantId,
        periodoId,
        origenTipo: ORIGEN_CIERRE_ANUAL,
        estado: { not: 'ANULADO' },
      },
      select: { id: true },
    });

    if (cierreAnual) {
      bloqueos.push(ClosureBloqueo.CIERRE_ANUAL_POSTEADO);
    }

    if (bloqueos.length > 0) {
      return { reabierto: false, yaEstabaAbierto: false, bloqueos };
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.periodoContable.updateMany({
        where: {
          id: periodoId,
          tenantId,
          estado: 'CERRADO',
        },
        data: {
          estado: 'ABIERTO',
          cerradoAt: null,
          cerradoPorId: null,
        },
      });

      return result.count;
    });

    if (updated === 0) {
      return { reabierto: true, yaEstabaAbierto: true };
    }

    this.audit
      .log({
        tenantId,
        userId,
        action: 'PERIODO_CONTABLE_REABIERTO',
        entityType: 'PeriodoContable',
        entityId: periodoId,
        metadata: { motivo },
      })
      .catch(() => {});

    return { reabierto: true, yaEstabaAbierto: false };
  }
}
