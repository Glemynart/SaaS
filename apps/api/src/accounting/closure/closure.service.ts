import { Injectable, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ReportingService } from '../reporting/reporting.service';
import { AuditService } from '../../audit/audit.service';
import { lockAccountingPeriod } from '../accounting-period-lock';
import {
  TenantPrismaClient,
  TenantPrismaService,
} from '../../tenant-prisma/tenant-prisma.service';
import { LedgerService, MAX_LINEAS } from '../ledger/ledger.service';
import { LineaComprobanteInput } from '../ledger/ledger.types';
import { SaldoDimensionadoItem } from '../reporting/reporting.types';

// Capacidad de líneas de RESULTADO por lote de cierre: se reserva 1 línea de
// las MAX_LINEAS del puerto (C1) para la pata de patrimonio del lote. La
// partición (C3 §8.2) garantiza que cada comprobante entra dentro del límite.
const MAX_LINEAS_RESULTADO = MAX_LINEAS - 1;

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
  // --- U4 CerrarAnioFiscal ---
  PERIODO_DICIEMBRE_NO_ENCONTRADO: 'PERIODO_DICIEMBRE_NO_ENCONTRADO',
  DICIEMBRE_YA_CERRADO: 'DICIEMBRE_YA_CERRADO',
  MESES_ANTERIORES_ABIERTOS: 'MESES_ANTERIORES_ABIERTOS',
  TIPO_CC_NO_ENCONTRADO: 'TIPO_CC_NO_ENCONTRADO',
  RESULTADO_EJERCICIO_NO_MAPEADO: 'RESULTADO_EJERCICIO_NO_MAPEADO',
  // Guardián fail-secure del contrato de idempotencia (C3 §8.3): existe en el
  // libro un comprobante de cierre del año que NO pertenece al plan vigente
  // (posted ⊄ expected) — determinismo violado u origen ajeno. No se postea ni
  // se cierra diciembre.
  CIERRE_ANUAL_INCONSISTENTE: 'CIERRE_ANUAL_INCONSISTENTE',
} as const;

export type ClosureBloqueoCodigo =
  (typeof ClosureBloqueo)[keyof typeof ClosureBloqueo];

// Clave de origen del comprobante de cierre anual (C3-I8, U4). Se fija aquí
// porque U3 ya necesita detectarlo (C3-I12) antes de que U4 exista.
export const ORIGEN_CIERRE_ANUAL = 'CIERRE_ANUAL';

// origenEvento del comprobante de cierre anual (C3-I8). Junto con
// ORIGEN_CIERRE_ANUAL (origenTipo) y el año (origenId), completa la clave de
// idempotencia que el puerto de C1 hace cumplir vía UNIQUE parcial.
export const EVENTO_CIERRE_ANUAL = 'CIERRE';

// Rango lexicográfico de código PUC que cubre exactamente las clases de
// resultado 4 (ingresos), 5 (gastos), 6 (costos de ventas) y 7 (costos de
// producción) — nunca 1/2/3 (balance) ni 8/9 (cuentas de orden). Comparación
// de string vía obtenerSaldosDimensionados (C2); C3 no reimplementa el filtro.
const CUENTA_DESDE_RESULTADO = '4';
const CUENTA_HASTA_RESULTADO = '7999999999';

// `origenEvento` determinista del lote `indice` (1-based) de un cierre de
// `total` lotes: 'CIERRE' cuando hay uno solo (compatible con el caso común y
// con EVENTO_CIERRE_ANUAL); 'CIERRE#NN' cuando hay varios (C3 §8.2/§8.3). El
// padStart(2,'0') mantiene el formato 'NN' sin capar: índices ≥ 100 conservan
// sus dígitos naturales y siguen siendo únicos.
function origenEventoLote(indice: number, total: number): string {
  return total <= 1
    ? EVENTO_CIERRE_ANUAL
    : `${EVENTO_CIERRE_ANUAL}#${String(indice).padStart(2, '0')}`;
}

// Corte contiguo en lotes de a lo sumo `tam` elementos, preservando el orden
// (que C2 ya entrega total y determinista). Base de la partición del cierre.
function particionar<T>(items: T[], tam: number): T[][] {
  const lotes: T[][] = [];
  for (let i = 0; i < items.length; i += tam) {
    lotes.push(items.slice(i, i + tam));
  }
  return lotes;
}

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

export interface CerrarAnioFiscalResult {
  // true únicamente cuando ESTA invocación posteó ≥ 1 lote del cierre (estados
  // NONE o PARTIAL del contrato de idempotencia, C3 §8.3).
  posteado: boolean;
  // true ⟺ al entrar el conjunto completo de lotes ya estaba presente
  // (posted = expected). Nunca en PARTIAL. Idempotencia por conjunto.
  yaEstabaPosteado: boolean;
  // true cuando no había saldos de resultado que cancelar (B1): no se
  // postea asiento, pero esta misma invocación sí cierra diciembre.
  sinResultados?: boolean;
  // true únicamente si ESTA invocación cerró diciembre.
  diciembreCerrado: boolean;
  // El CONJUNTO de comprobantes de cierre del año (uno o varios lotes), no un
  // id único. Presente en los desenlaces con cierre posteado o ya existente.
  comprobanteIds?: string[];
  bloqueos?: string[];
}

@Injectable()
export class ClosureService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly reporting: ReportingService,
    private readonly audit: AuditService,
    private readonly ledger: LedgerService,
  ) {}

  async validarCierrePeriodo(
    tenantId: string,
    periodoId: string,
  ): Promise<ValidacionCierreResult> {
    const bloqueos: string[] = [];

    // --- 1. El período existe y está ABIERTO ---
    const periodo = await this.tenantPrisma.execute((client) =>
      client.periodoContable.findFirst({
        where: { id: periodoId, tenantId },
        select: {
          id: true,
          estado: true,
          anio: true,
          mes: true,
          fechaInicio: true,
          fechaFin: true,
        },
      }),
    );

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
    const borradoresCount = await this.tenantPrisma.execute((client) =>
      client.comprobanteContable.count({
        where: {
          tenantId,
          periodoId,
          estado: 'BORRADOR',
        },
      }),
    );

    if (borradoresCount > 0) {
      bloqueos.push(ClosureBloqueo.BORRADORES_PENDIENTES);
    }

    // --- 3. Cierre cronológico ---
    const { anio, mes } = periodo;
    const mesAnterior = mes === 1 ? 12 : mes - 1;
    const anioAnterior = mes === 1 ? anio - 1 : anio;

    const anteriorAbierto = await this.tenantPrisma.execute((client) =>
      client.periodoContable.findFirst({
        where: {
          tenantId,
          anio: anioAnterior,
          mes: mesAnterior,
          estado: 'ABIERTO',
        },
        select: { id: true },
      }),
    );

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

    const updated = await this.tenantPrisma.execute(async (tx) => {
      await lockAccountingPeriod(tx, tenantId, periodoId);
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
    return this.tenantPrisma.execute(async (tx) => {
      const bloqueos: string[] = [];

      if (!motivo || motivo.trim().length === 0) {
        bloqueos.push(ClosureBloqueo.MOTIVO_REQUERIDO);
      }

      // --- El período existe ---
      const periodo = await tx.periodoContable.findFirst({
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
      const posteriorCerrado = await tx.periodoContable.findFirst({
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
      const cierreAnual = await tx.comprobanteContable.findFirst({
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

      const updated = await tx.periodoContable.updateMany({
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

      if (updated.count === 0) {
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
    });
  }

  // ============================================================================
  // cerrarAnioFiscal (U4) — C3-I6, I7, I8, I9, I10, I11, I12
  // ============================================================================
  // Orquesta el cierre anual: lee de C2 el resultado del ejercicio DESGLOSADO
  // por dimensión (nunca calcula saldos, C3-I10), construye uno o varios
  // borradores balanceados y los entrega al puerto único de C1. C3 no inserta
  // comprobantes directamente (C3-I6). No hay asiento de apertura (C3-I9).
  //
  // Contrato de idempotencia y reanudación (C3 §8.3). El posteo del conjunto de
  // lotes NO es atómico; U4 es idempotente y reanudable comparando dos
  // conjuntos de `origenEvento`:
  //   expected = plan de lotes (función pura de la lectura dimensionada, que
  //              EXCLUYE los propios comprobantes de cierre del año → estable).
  //   posted   = lotes de cierre efectivos del año en el libro (estado≠ANULADO).
  // Estados: NONE (posted=∅) · PARTIAL (∅⊊posted⊊expected) · COMPLETE
  // (posted=expected) · ANOMALÍA (posted⊄expected → fail-secure).
  // ============================================================================

  async cerrarAnioFiscal(
    tenantId: string,
    anio: number,
    userId: string,
  ): Promise<CerrarAnioFiscalResult> {
    return this.tenantPrisma.execute(async (tx) => {
      // --- 1. Resolver diciembre (necesario para el rango de lectura y el plan) ---
      const diciembre = await tx.periodoContable.findFirst({
        where: { tenantId, anio, mes: 12 },
        select: { id: true, estado: true, fechaFin: true },
      });

      if (!diciembre) {
        return {
          posteado: false,
          yaEstabaPosteado: false,
          diciembreCerrado: false,
          bloqueos: [ClosureBloqueo.PERIODO_DICIEMBRE_NO_ENCONTRADO],
        };
      }

      // --- 2. `posted`: lotes de cierre efectivos del año (findMany, no First) ---
      const posted = await this.listarCierreAnualVigente(tx, tenantId, anio);
      const postedMap = new Map(posted.map((p) => [p.origenEvento, p.id]));

      // --- 3. Plan: lectura dimensionada de C2 EXCLUYENDO el propio cierre del
      //        año (estabilidad del plan, C3 §8.3). No requiere patrimonio aún. ---
      const balance = await this.reporting.obtenerSaldosDimensionados(
        tenantId,
        {
          fechaInicio: new Date(Date.UTC(anio, 0, 1)),
          fechaFin: diciembre.fechaFin,
          cuentaDesde: CUENTA_DESDE_RESULTADO,
          cuentaHasta: CUENTA_HASTA_RESULTADO,
          excluirOrigenTipo: ORIGEN_CIERRE_ANUAL,
          excluirOrigenId: String(anio),
        },
      );

      const tuplas = balance.filter((item) => !item.saldo.eq(0));
      const lotesTuplas = particionar(tuplas, MAX_LINEAS_RESULTADO);
      const total = lotesTuplas.length;
      const expected = lotesTuplas.map((_, i) =>
        origenEventoLote(i + 1, total),
      );
      const expectedSet = new Set(expected);

      // --- 4. Guardián ANOMALÍA (posted ⊄ expected): fail-secure (C3 §8.3).
      //        Un origenEvento nulo nunca pertenece al plan → también es anómalo. ---
      const hayLoteAjeno = posted.some(
        (p) => p.origenEvento === null || !expectedSet.has(p.origenEvento),
      );
      if (hayLoteAjeno) {
        return {
          posteado: false,
          yaEstabaPosteado: false,
          diciembreCerrado: false,
          bloqueos: [ClosureBloqueo.CIERRE_ANUAL_INCONSISTENTE],
        };
      }

      // --- 5a. Sin resultados (expected = ∅) → B1: no hay asiento, se cierra
      //         diciembre en esta invocación si sigue ABIERTO. ---
      if (expected.length === 0) {
        const diciembreCerrado = await this.cerrarDiciembreSiAbierto(
          tenantId,
          diciembre.id,
          diciembre.estado,
          userId,
        );
        return {
          posteado: false,
          yaEstabaPosteado: false,
          sinResultados: true,
          diciembreCerrado,
        };
      }

      // --- 5b. COMPLETE (posted = expected) → idempotencia por conjunto. Nunca
      //         re-postea; solo cierra el "rabo" de diciembre si quedó abierto. ---
      const faltantes = expected.filter((ev) => !postedMap.has(ev));
      if (faltantes.length === 0) {
        const comprobanteIds = expected.map((ev) => postedMap.get(ev)!);
        const diciembreCerrado = await this.cerrarDiciembreSiAbierto(
          tenantId,
          diciembre.id,
          diciembre.estado,
          userId,
        );
        return {
          posteado: false,
          yaEstabaPosteado: true,
          diciembreCerrado,
          comprobanteIds,
        };
      }

      // --- 6. NONE o PARTIAL: vamos a postear. Precondiciones de posteo. ---
      const bloqueos: string[] = [];

      if (diciembre.estado === 'CERRADO') {
        bloqueos.push(ClosureBloqueo.DICIEMBRE_YA_CERRADO);
      }

      const mesAnteriorAbierto = await tx.periodoContable.findFirst({
        where: { tenantId, anio, mes: { gte: 1, lte: 11 }, estado: 'ABIERTO' },
        select: { id: true },
      });
      if (mesAnteriorAbierto) {
        bloqueos.push(ClosureBloqueo.MESES_ANTERIORES_ABIERTOS);
      }

      const tipoCC = await tx.tipoComprobante.findFirst({
        where: { codigo: 'CC', activo: true },
        select: { id: true },
      });
      if (!tipoCC) {
        bloqueos.push(ClosureBloqueo.TIPO_CC_NO_ENCONTRADO);
      }

      const mapaResultado = await tx.cuentaSistemaMap.findFirst({
        where: { tenantId, rol: 'RESULTADO_EJERCICIO', activo: true },
        select: { cuentaId: true },
      });
      if (!mapaResultado) {
        bloqueos.push(ClosureBloqueo.RESULTADO_EJERCICIO_NO_MAPEADO);
      }

      if (bloqueos.length > 0) {
        return {
          posteado: false,
          yaEstabaPosteado: false,
          diciembreCerrado: false,
          bloqueos,
        };
      }

      // --- 7. Postear ÚNICAMENTE los lotes faltantes por el puerto (C3-I6) ---
      const comprobanteIds: string[] = [];
      for (let i = 0; i < total; i++) {
        const origenEvento = expected[i];

        const existenteId = postedMap.get(origenEvento);
        if (existenteId) {
          // Ya presente (PARTIAL): jamás se re-postea.
          comprobanteIds.push(existenteId);
          continue;
        }

        const lineas = this.construirLineasLote(
          lotesTuplas[i],
          mapaResultado!.cuentaId,
        );

        try {
          const comprobante = await this.ledger.registrarComprobante(
            {
              tenantId,
              userId,
              tipoComprobanteId: tipoCC!.id,
              periodoId: diciembre.id,
              fecha: diciembre.fechaFin,
              concepto: `Cierre anual ejercicio ${anio}`,
              lineas,
              origenTipo: ORIGEN_CIERRE_ANUAL,
              origenId: String(anio),
              origenEvento,
            },
            tx,
          );
          comprobanteIds.push(comprobante.id);
        } catch (err) {
          if (!(err instanceof ConflictException)) {
            throw err;
          }

          // Carrera: otro actor pudo postear ESTE lote (∈ expected). Confirmar su
          // presencia; si no aparece, el conflicto es de un origen ajeno →
          // anomalía real que se propaga (fail-secure, C3 §8.3 capa de puerto).
          const confirmado = await this.buscarLoteCierre(
            tx,
            tenantId,
            anio,
            origenEvento,
          );
          if (!confirmado) {
            throw err;
          }
          comprobanteIds.push(confirmado.id);
        }
      }

      // --- 8. Cerrar diciembre — porque ESTA invocación completó el posteo ---
      const cierre = await this.cerrarPeriodo(tenantId, diciembre.id, userId);
      const diciembreCerrado = cierre.cerrado && !cierre.yaEstabaCerrado;

      // --- 9. Auditoría funcional única del cierre anual (C3-I5), con el
      //        CONJUNTO de comprobantes ---
      this.audit
        .log({
          tenantId,
          userId,
          action: 'CIERRE_ANUAL_EJECUTADO',
          entityType: 'PeriodoContable',
          entityId: diciembre.id,
          metadata: { anio, comprobanteIds },
        })
        .catch(() => {});

      return {
        posteado: true,
        yaEstabaPosteado: false,
        diciembreCerrado,
        comprobanteIds,
      };
    });
  }

  // Cierra diciembre solo si sigue ABIERTO; devuelve true únicamente si ESTA
  // invocación efectuó la transición. Reutilizado por las ramas B1 y COMPLETE.
  private async cerrarDiciembreSiAbierto(
    tenantId: string,
    diciembreId: string,
    estado: string,
    userId: string,
  ): Promise<boolean> {
    if (estado !== 'ABIERTO') return false;
    const cierre = await this.cerrarPeriodo(tenantId, diciembreId, userId);
    return cierre.cerrado && !cierre.yaEstabaCerrado;
  }

  // `posted`: TODOS los comprobantes de cierre efectivos (estado ≠ ANULADO) del
  // año. findMany (no findFirst): un cierre anual puede ser un CONJUNTO de lotes
  // (C3 §8.3). El filtro estado≠ANULADO es correcto por diseño (I8/C3-I12), pero
  // hoy NINGÚN flujo deja un comprobante de cierre en ANULADO: `anular()` no
  // tiene llamador en producción, y aun invocado, sobre período CERRADO emite
  // un REVERSO nuevo sin tocar el original (nunca lo pone en ANULADO). Es
  // deuda técnica documentada de U3/C1, no una ruta activa hoy — ver auditoría
  // C3-U4 (hallazgo M-1).
  private async listarCierreAnualVigente(
    tx: TenantPrismaClient,
    tenantId: string,
    anio: number,
  ): Promise<{ id: string; origenEvento: string | null }[]> {
    return tx.comprobanteContable.findMany({
      where: {
        tenantId,
        origenTipo: ORIGEN_CIERRE_ANUAL,
        origenId: String(anio),
        estado: { not: 'ANULADO' },
      },
      select: { id: true, origenEvento: true },
    });
  }

  // Confirma la presencia de UN lote concreto tras un ConflictException del
  // puerto (carrera). Clave completa incluyendo origenEvento del lote.
  private async buscarLoteCierre(
    tx: TenantPrismaClient,
    tenantId: string,
    anio: number,
    origenEvento: string,
  ): Promise<{ id: string } | null> {
    return tx.comprobanteContable.findFirst({
      where: {
        tenantId,
        origenTipo: ORIGEN_CIERRE_ANUAL,
        origenId: String(anio),
        origenEvento,
        estado: { not: 'ANULADO' },
      },
      select: { id: true },
    });
  }

  // Construcción saldo-dirigida de UN lote (no por naturaleza): cada tupla de
  // resultado con saldo ≠ 0 se cancela por su saldo neto, arrastrando su
  // tercero/centro de costo (I6) — sin asumir el lado esperado, manejando
  // cuentas contra-naturales sin casos especiales. El neto del lote (Σdébitos −
  // Σcréditos de sus líneas de resultado) se traslada a patrimonio; la suma de
  // los netos de todos los lotes es el resultado del ejercicio de C2 (C3-I11).
  private construirLineasLote(
    tuplas: SaldoDimensionadoItem[],
    cuentaResultadoId: string,
  ): LineaComprobanteInput[] {
    const CERO = new Prisma.Decimal(0);
    const lineas: LineaComprobanteInput[] = [];
    let totalDebito = CERO;
    let totalCredito = CERO;

    for (const item of tuplas) {
      // item.saldo ≠ 0 garantizado por el filtro previo del plan.
      const linea: LineaComprobanteInput = {
        cuentaId: item.cuentaId,
        terceroId: item.terceroId ?? undefined,
        centroCostoId: item.centroCostoId ?? undefined,
        debito: CERO,
        credito: CERO,
      };

      if (item.saldo.lt(0)) {
        // Saldo neto crédito (típico: ingresos, clase 4) → se cancela debitando.
        const monto = item.saldo.abs();
        linea.debito = monto;
        totalDebito = totalDebito.add(monto);
      } else {
        // Saldo neto débito (típico: gastos/costos, clases 5/6/7) → acreditando.
        linea.credito = item.saldo;
        totalCredito = totalCredito.add(item.saldo);
      }

      lineas.push(linea);
    }

    const neto = totalDebito.minus(totalCredito);

    if (neto.gt(0)) {
      // El lote quedó con exceso de débito → patrimonio al crédito por el neto.
      lineas.push({ cuentaId: cuentaResultadoId, debito: CERO, credito: neto });
    } else if (neto.lt(0)) {
      // Exceso de crédito → patrimonio al débito por el neto.
      lineas.push({
        cuentaId: cuentaResultadoId,
        debito: neto.abs(),
        credito: CERO,
      });
    }
    // neto === 0: el lote ya cuadra entre sus tuplas; sin pata de patrimonio.

    return lineas;
  }
}
