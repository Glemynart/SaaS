import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import {
  SaldosFilters,
  SaldoCuenta,
  SaldosDimensionadosFilters,
  SaldoDimensionadoItem,
  BalancePruebaItem,
  BalanceGeneralFilters,
  BalanceGeneralReport,
  EstadoFinancieroGrupo,
  EstadoFinancieroLinea,
  EstadoFinancieroSeccion,
  EstadoResultadosFilters,
  EstadoResultadosReport,
  LibroDiarioFilters,
  LibroDiarioItem,
  LibroDiarioMovimiento,
  LibroMayorFilters,
  LibroMayorMovimiento,
  AuxiliarTerceroFilters,
  AuxiliarTerceroMovimiento,
  AuxiliarCentroCostoFilters,
  AuxiliarCentroCostoMovimiento,
  MovimientoEnMayor,
} from './reporting.types';

// Orden total con nulos al final: dos no-nulos comparan lexicográficamente;
// un nulo va después de cualquier no-nulo; dos nulos son iguales. Da un
// desempate determinista a la lectura dimensionada (C3 §8.2).
function compararNuloAlFinal(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a.localeCompare(b);
}

type NaturalezaSaldo = 'DEBITO' | 'CREDITO';

interface SeccionMeta {
  codigo: string;
  claseContable: string;
  nombre: string;
  naturaleza: NaturalezaSaldo;
}

const CERO = new Prisma.Decimal(0);

const BALANCE_GENERAL_SECCIONES: Record<string, SeccionMeta> = {
  '1': {
    codigo: '1',
    claseContable: 'ACTIVO',
    nombre: 'Activo',
    naturaleza: 'DEBITO',
  },
  '2': {
    codigo: '2',
    claseContable: 'PASIVO',
    nombre: 'Pasivo',
    naturaleza: 'CREDITO',
  },
  '3': {
    codigo: '3',
    claseContable: 'PATRIMONIO',
    nombre: 'Patrimonio',
    naturaleza: 'CREDITO',
  },
};

const ESTADO_RESULTADOS_SECCIONES: Record<string, SeccionMeta> = {
  '4': {
    codigo: '4',
    claseContable: 'INGRESOS',
    nombre: 'Ingresos',
    naturaleza: 'CREDITO',
  },
  '5': {
    codigo: '5',
    claseContable: 'GASTOS',
    nombre: 'Gastos',
    naturaleza: 'DEBITO',
  },
  '6': {
    codigo: '6',
    claseContable: 'COSTOS_VENTAS',
    nombre: 'Costos de ventas',
    naturaleza: 'DEBITO',
  },
  '7': {
    codigo: '7',
    claseContable: 'COSTOS_PRODUCCION',
    nombre: 'Costos de produccion',
    naturaleza: 'DEBITO',
  },
};

@Injectable()
export class ReportingService {
  constructor(private readonly prisma: PrismaService) {}

  private async saldos(
    tenantId: string,
    filters: SaldosFilters,
  ): Promise<SaldoCuenta[]> {
    const comprobanteFilter: Record<string, unknown> = {
      estado: 'CONTABILIZADO',
    };

    if (filters.fechaInicio || filters.fechaFin) {
      const fechaFilter: Record<string, Date> = {};
      if (filters.fechaInicio) fechaFilter.gte = filters.fechaInicio;
      if (filters.fechaFin) fechaFilter.lte = filters.fechaFin;
      comprobanteFilter.fecha = fechaFilter;
    }

    const where: Record<string, unknown> = {
      tenantId,
      comprobante: comprobanteFilter,
    };

    if (
      filters.cuentaDesde ||
      filters.cuentaHasta ||
      filters.nivel !== undefined
    ) {
      const cuentaFilter: Record<string, unknown> = {};

      if (filters.cuentaDesde || filters.cuentaHasta) {
        const codigoFilter: Record<string, string> = {};
        if (filters.cuentaDesde) codigoFilter.gte = filters.cuentaDesde;
        if (filters.cuentaHasta) codigoFilter.lte = filters.cuentaHasta;
        cuentaFilter.codigo = codigoFilter;
      }

      if (filters.nivel !== undefined) {
        cuentaFilter.nivel = filters.nivel;
      }

      where.cuenta = cuentaFilter;
    }

    const rows = await this.prisma.movimientoContable.groupBy({
      by: ['cuentaId'],
      where: where,
      _sum: {
        debito: true,
        credito: true,
      },
    });

    const CERO = new Prisma.Decimal(0);

    return rows.map((row) => {
      const totalDebito = row._sum.debito ?? CERO;
      const totalCredito = row._sum.credito ?? CERO;
      return {
        cuentaId: row.cuentaId,
        totalDebito,
        totalCredito,
        saldo: totalDebito.minus(totalCredito),
      };
    });
  }

  async obtenerBalancePrueba(
    tenantId: string,
    filters: SaldosFilters,
  ): Promise<BalancePruebaItem[]> {
    const saldosResult = await this.saldos(tenantId, filters);

    if (saldosResult.length === 0) {
      return [];
    }

    const cuentaIds = saldosResult.map((s) => s.cuentaId);

    const cuentas = await this.prisma.cuentaContable.findMany({
      where: { id: { in: cuentaIds } },
      select: { id: true, codigo: true, nombre: true },
    });

    const cuentaMap = new Map(cuentas.map((c) => [c.id, c]));

    return saldosResult
      .map((s) => {
        const cuenta = cuentaMap.get(s.cuentaId);
        return {
          cuentaId: s.cuentaId,
          codigo: cuenta?.codigo ?? 'N/A',
          nombre: cuenta?.nombre ?? 'Cuenta no encontrada',
          totalDebito: s.totalDebito,
          totalCredito: s.totalCredito,
          saldo: s.saldo,
        };
      })
      .sort((a, b) => a.codigo.localeCompare(b.codigo));
  }

  async obtenerBalanceGeneral(
    tenantId: string,
    filters: BalanceGeneralFilters,
  ): Promise<BalanceGeneralReport> {
    const cuentas = await this.obtenerBalancePrueba(tenantId, {
      fechaFin: filters.fechaCorte,
      cuentaDesde: '1',
      cuentaHasta: '3999999999',
    });
    const nombresPorCodigo = await this.obtenerNombresPorCodigo(
      tenantId,
      cuentas,
    );

    const activo = this.construirSeccionEstadoFinanciero(
      BALANCE_GENERAL_SECCIONES['1'],
      cuentas,
      nombresPorCodigo,
    );
    const pasivo = this.construirSeccionEstadoFinanciero(
      BALANCE_GENERAL_SECCIONES['2'],
      cuentas,
      nombresPorCodigo,
    );
    const patrimonio = this.construirSeccionEstadoFinanciero(
      BALANCE_GENERAL_SECCIONES['3'],
      cuentas,
      nombresPorCodigo,
    );
    const totalPasivoPatrimonio = pasivo.valor.add(patrimonio.valor);

    return {
      fechaCorte: filters.fechaCorte,
      activo,
      pasivo,
      patrimonio,
      totalActivo: activo.valor,
      totalPasivo: pasivo.valor,
      totalPatrimonio: patrimonio.valor,
      totalPasivoPatrimonio,
      diferencia: activo.valor.minus(totalPasivoPatrimonio),
    };
  }

  async obtenerEstadoResultados(
    tenantId: string,
    filters: EstadoResultadosFilters,
  ): Promise<EstadoResultadosReport> {
    const cuentas = await this.obtenerBalancePrueba(tenantId, {
      fechaInicio: filters.fechaInicio,
      fechaFin: filters.fechaFin,
      cuentaDesde: '4',
      cuentaHasta: '7999999999',
    });
    const nombresPorCodigo = await this.obtenerNombresPorCodigo(
      tenantId,
      cuentas,
    );

    const ingresos = this.construirSeccionEstadoFinanciero(
      ESTADO_RESULTADOS_SECCIONES['4'],
      cuentas,
      nombresPorCodigo,
    );
    const gastos = this.construirSeccionEstadoFinanciero(
      ESTADO_RESULTADOS_SECCIONES['5'],
      cuentas,
      nombresPorCodigo,
    );
    const costosVentas = this.construirSeccionEstadoFinanciero(
      ESTADO_RESULTADOS_SECCIONES['6'],
      cuentas,
      nombresPorCodigo,
    );
    const costosProduccion = this.construirSeccionEstadoFinanciero(
      ESTADO_RESULTADOS_SECCIONES['7'],
      cuentas,
      nombresPorCodigo,
    );
    const totalCostos = costosVentas.valor.add(costosProduccion.valor);

    return {
      fechaInicio: filters.fechaInicio,
      fechaFin: filters.fechaFin,
      ingresos,
      gastos,
      costosVentas,
      costosProduccion,
      totalIngresos: ingresos.valor,
      totalGastos: gastos.valor,
      totalCostos,
      resultadoNeto: ingresos.valor.minus(gastos.valor).minus(totalCostos),
    };
  }

  private async obtenerNombresPorCodigo(
    tenantId: string,
    cuentas: BalancePruebaItem[],
  ): Promise<Map<string, string>> {
    const codigos = new Set<string>();
    for (const cuenta of cuentas) {
      const clase = cuenta.codigo.slice(0, 1);
      if (clase) codigos.add(clase);
      const grupo =
        cuenta.codigo.length >= 2 ? cuenta.codigo.slice(0, 2) : clase;
      if (grupo) codigos.add(grupo);
    }

    if (codigos.size === 0) {
      return new Map();
    }

    const rows = await this.prisma.cuentaContable.findMany({
      where: { tenantId, codigo: { in: [...codigos] } },
      select: { codigo: true, nombre: true },
    });

    return new Map(rows.map((row) => [row.codigo, row.nombre]));
  }

  private construirSeccionEstadoFinanciero(
    meta: SeccionMeta,
    cuentas: BalancePruebaItem[],
    nombresPorCodigo: Map<string, string>,
  ): EstadoFinancieroSeccion {
    const cuentasDeSeccion = cuentas.filter((cuenta) =>
      cuenta.codigo.startsWith(meta.codigo),
    );
    const grupos = new Map<string, EstadoFinancieroGrupo>();

    for (const cuenta of cuentasDeSeccion) {
      const grupoCodigo =
        cuenta.codigo.length >= 2 ? cuenta.codigo.slice(0, 2) : meta.codigo;
      const linea: EstadoFinancieroLinea = {
        cuentaId: cuenta.cuentaId,
        codigo: cuenta.codigo,
        nombre: cuenta.nombre,
        totalDebito: cuenta.totalDebito,
        totalCredito: cuenta.totalCredito,
        saldo: cuenta.saldo,
        valor: this.valorNatural(cuenta.saldo, meta.naturaleza),
      };
      const grupo = grupos.get(grupoCodigo) ?? {
        codigo: grupoCodigo,
        nombre: nombresPorCodigo.get(grupoCodigo) ?? grupoCodigo,
        totalDebito: CERO,
        totalCredito: CERO,
        saldo: CERO,
        valor: CERO,
        cuentas: [],
      };

      grupo.totalDebito = grupo.totalDebito.add(linea.totalDebito);
      grupo.totalCredito = grupo.totalCredito.add(linea.totalCredito);
      grupo.saldo = grupo.saldo.add(linea.saldo);
      grupo.valor = grupo.valor.add(linea.valor);
      grupo.cuentas.push(linea);
      grupos.set(grupoCodigo, grupo);
    }

    const gruposOrdenados = [...grupos.values()].sort((a, b) =>
      a.codigo.localeCompare(b.codigo),
    );
    const totalDebito = gruposOrdenados.reduce(
      (total, grupo) => total.add(grupo.totalDebito),
      CERO,
    );
    const totalCredito = gruposOrdenados.reduce(
      (total, grupo) => total.add(grupo.totalCredito),
      CERO,
    );
    const saldo = gruposOrdenados.reduce(
      (total, grupo) => total.add(grupo.saldo),
      CERO,
    );

    return {
      codigo: meta.codigo,
      claseContable: meta.claseContable,
      nombre: nombresPorCodigo.get(meta.codigo) ?? meta.nombre,
      totalDebito,
      totalCredito,
      saldo,
      valor: this.valorNatural(saldo, meta.naturaleza),
      grupos: gruposOrdenados,
    };
  }

  private valorNatural(
    saldo: Prisma.Decimal,
    naturaleza: NaturalezaSaldo,
  ): Prisma.Decimal {
    return naturaleza === 'DEBITO' ? saldo : saldo.negated();
  }

  // ==========================================================================
  // obtenerSaldosDimensionados — saldo por (cuenta, tercero, centro de costo).
  // ==========================================================================
  // Misma naturaleza de solo-lectura que obtenerBalancePrueba, pero SIN colapsar
  // las dimensiones: agrupa por la tupla completa. Es la superficie que el
  // cierre anual (C3-U4) consume para construir un asiento que cancele las
  // cuentas de resultado respetando requiereTercero/requiereCentroCosto (I6) y
  // dejando los auxiliares por dimensión en cero.
  //
  // El orden de salida es TOTAL y determinista — (codigo, terceroId,
  // centroCostoId) con nulos al final — impuesto explícitamente en memoria; no
  // se depende del orden arbitrario del groupBy. Ese determinismo es requisito
  // del particionado por lotes del cierre (C3 §8.2/§8.3).
  async obtenerSaldosDimensionados(
    tenantId: string,
    filters: SaldosDimensionadosFilters,
  ): Promise<SaldoDimensionadoItem[]> {
    const comprobanteFilter: Record<string, unknown> = {
      estado: 'CONTABILIZADO',
    };

    if (filters.fechaInicio || filters.fechaFin) {
      const fechaFilter: Record<string, Date> = {};
      if (filters.fechaInicio) fechaFilter.gte = filters.fechaInicio;
      if (filters.fechaFin) fechaFilter.lte = filters.fechaFin;
      comprobanteFilter.fecha = fechaFilter;
    }

    // Exclusión de origen (p. ej. los propios comprobantes de cierre del año):
    // deja fuera los movimientos cuyo comprobante tiene EXACTAMENTE ese
    // (origenTipo, origenId). Los comprobantes manuales tienen ambos campos en
    // NULL: se incluyen explícitamente porque NOT (a = x AND b = y) evalúa
    // NULL en PostgreSQL y los descartaría. Estabiliza el plan de lotes del
    // cierre (C3 §8.3) sin ocultar movimientos manuales.
    if (filters.excluirOrigenTipo && filters.excluirOrigenId) {
      comprobanteFilter.OR = [
        { origenTipo: null },
        { origenId: null },
        {
          NOT: {
            origenTipo: filters.excluirOrigenTipo,
            origenId: filters.excluirOrigenId,
          },
        },
      ];
    }

    const where: Record<string, unknown> = {
      tenantId,
      comprobante: comprobanteFilter,
    };

    if (
      filters.cuentaDesde ||
      filters.cuentaHasta ||
      filters.nivel !== undefined
    ) {
      const cuentaFilter: Record<string, unknown> = {};

      if (filters.cuentaDesde || filters.cuentaHasta) {
        const codigoFilter: Record<string, string> = {};
        if (filters.cuentaDesde) codigoFilter.gte = filters.cuentaDesde;
        if (filters.cuentaHasta) codigoFilter.lte = filters.cuentaHasta;
        cuentaFilter.codigo = codigoFilter;
      }

      if (filters.nivel !== undefined) {
        cuentaFilter.nivel = filters.nivel;
      }

      where.cuenta = cuentaFilter;
    }

    const rows = await this.prisma.movimientoContable.groupBy({
      by: ['cuentaId', 'terceroId', 'centroCostoId'],
      where: where,
      _sum: {
        debito: true,
        credito: true,
      },
    });

    if (rows.length === 0) {
      return [];
    }

    const cuentaIds = [...new Set(rows.map((r) => r.cuentaId))];
    const cuentas = await this.prisma.cuentaContable.findMany({
      where: { id: { in: cuentaIds } },
      select: { id: true, codigo: true, nombre: true },
    });
    const cuentaMap = new Map(cuentas.map((c) => [c.id, c]));

    const CERO = new Prisma.Decimal(0);

    return rows
      .map((row): SaldoDimensionadoItem => {
        const totalDebito = row._sum.debito ?? CERO;
        const totalCredito = row._sum.credito ?? CERO;
        const cuenta = cuentaMap.get(row.cuentaId);
        return {
          cuentaId: row.cuentaId,
          codigo: cuenta?.codigo ?? 'N/A',
          nombre: cuenta?.nombre ?? 'Cuenta no encontrada',
          terceroId: row.terceroId,
          centroCostoId: row.centroCostoId,
          totalDebito,
          totalCredito,
          saldo: totalDebito.minus(totalCredito),
        };
      })
      .sort(
        (a, b) =>
          a.codigo.localeCompare(b.codigo) ||
          compararNuloAlFinal(a.terceroId, b.terceroId) ||
          compararNuloAlFinal(a.centroCostoId, b.centroCostoId),
      );
  }

  async obtenerLibroDiario(
    tenantId: string,
    filters: LibroDiarioFilters,
  ): Promise<{ items: LibroDiarioItem[]; total: number }> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 50;
    const incluirBorradores = filters.incluirBorradores ?? false;

    const where: Record<string, unknown> = { tenantId };

    if (filters.fechaInicio || filters.fechaFin) {
      const fechaFilter: Record<string, Date> = {};
      if (filters.fechaInicio) fechaFilter.gte = filters.fechaInicio;
      if (filters.fechaFin) fechaFilter.lte = filters.fechaFin;
      where.fecha = fechaFilter;
    }

    if (filters.tipoComprobanteId) {
      where.tipoComprobanteId = filters.tipoComprobanteId;
    }

    if (incluirBorradores) {
      where.estado = { in: ['CONTABILIZADO', 'BORRADOR'] };
    } else {
      where.estado = 'CONTABILIZADO';
    }

    const orderBy: Record<string, string>[] = incluirBorradores
      ? [{ fecha: 'desc' }, { createdAt: 'desc' }]
      : [{ fecha: 'desc' }, { numero: 'desc' }];

    /* eslint-disable @typescript-eslint/no-unsafe-assignment */
    const [comprobantes, total] = await Promise.all([
      this.prisma.comprobanteContable.findMany({
        where: where as any,
        orderBy: orderBy as any,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          movimientos: {
            orderBy: { linea: 'asc' },
            include: {
              cuenta: { select: { codigo: true, nombre: true } },
            },
          },
        },
      }),
      this.prisma.comprobanteContable.count({
        where: where as any,
      }),
    ]);

    const items: LibroDiarioItem[] = comprobantes.map((c) => ({
      comprobanteId: c.id,
      numero: c.numero,
      fecha: c.fecha,
      concepto: c.concepto,
      estado: c.estado,
      tipoComprobanteId: c.tipoComprobanteId,
      totalDebito: c.totalDebito,
      totalCredito: c.totalCredito,
      movimientos: c.movimientos.map(
        (m): LibroDiarioMovimiento => ({
          linea: m.linea,
          cuentaId: m.cuentaId,
          cuentaCodigo: m.cuenta.codigo,
          cuentaNombre: m.cuenta.nombre,
          debito: m.debito,
          credito: m.credito,
          terceroId: m.terceroId,
          centroCostoId: m.centroCostoId,
          descripcion: m.descripcion,
        }),
      ),
    }));

    return { items, total };
    /* eslint-enable @typescript-eslint/no-unsafe-assignment */
  }

  private async saldoCuenta(
    tenantId: string,
    cuentaId: string,
    options?: {
      fechaDesde?: Date;
      hasta?: {
        fecha: Date;
        numero: number;
        comprobanteId: string;
        linea: number;
      };
      terceroId?: string;
      centroCostoId?: string;
    },
  ): Promise<Prisma.Decimal> {
    const comprobanteFilter: Record<string, unknown> = {
      estado: 'CONTABILIZADO',
    };

    if (options?.fechaDesde) {
      comprobanteFilter.fecha = { gte: options.fechaDesde };
    }

    const where: Record<string, unknown> = {
      tenantId,
      cuentaId,
      comprobante: comprobanteFilter,
    };

    if (options?.terceroId) {
      where.terceroId = options.terceroId;
    }

    if (options?.centroCostoId) {
      where.centroCostoId = options.centroCostoId;
    }

    if (options?.hasta) {
      const { fecha, numero, comprobanteId, linea } = options.hasta;
      where.OR = [
        { comprobante: { fecha: { lt: fecha } } },
        {
          comprobante: {
            fecha,
            numero: { lt: numero },
          },
        },
        {
          comprobante: {
            fecha,
            numero,
            id: { lt: comprobanteId },
          },
        },
        {
          comprobante: {
            fecha,
            numero,
            id: comprobanteId,
          },
          linea: { lt: linea },
        },
      ];
    }

    const rows = await this.prisma.movimientoContable.groupBy({
      by: ['cuentaId'],
      where,
      _sum: { debito: true, credito: true },
    });

    if (rows.length === 0) {
      return new Prisma.Decimal(0);
    }

    const debito = rows[0]._sum.debito ?? new Prisma.Decimal(0);
    const credito = rows[0]._sum.credito ?? new Prisma.Decimal(0);
    return debito.minus(credito);
  }

  private async mayorBase<T>(
    tenantId: string,
    cuentaId: string,
    filters: {
      page: number;
      limit: number;
      fechaInicio?: Date;
      fechaFin?: Date;
    },
    extraWhere: Record<string, unknown>,
    extraInclude: Record<string, unknown>,
    extraSaldoCuenta: Record<string, unknown>,
    mapFn: (movimiento: MovimientoEnMayor) => T,
  ): Promise<{ items: T[]; total: number }> {
    const { page, limit } = filters;

    const comprobanteFilter: Record<string, unknown> = {
      estado: 'CONTABILIZADO',
    };

    if (filters.fechaInicio || filters.fechaFin) {
      const fechaFilter: Record<string, Date> = {};
      if (filters.fechaInicio) fechaFilter.gte = filters.fechaInicio;
      if (filters.fechaFin) fechaFilter.lte = filters.fechaFin;
      comprobanteFilter.fecha = fechaFilter;
    }

    const where: Record<string, unknown> = {
      tenantId,
      cuentaId,
      ...extraWhere,
      comprobante: comprobanteFilter,
    };

    const orderBy: any[] = [
      { comprobante: { fecha: 'asc' } },
      { comprobante: { numero: 'asc' } },
      { comprobante: { id: 'asc' } },
      { linea: 'asc' },
    ];

    const include: Record<string, unknown> = {
      comprobante: {
        select: { id: true, numero: true, concepto: true, fecha: true },
      },
      ...extraInclude,
    };

    /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
    const [movimientos, total] = await Promise.all([
      this.prisma.movimientoContable.findMany({
        where: where as any,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: include as any,
      }),
      this.prisma.movimientoContable.count({
        where: where as any,
      }),
    ]);

    if (movimientos.length === 0) {
      return { items: [], total };
    }

    const primero: any = movimientos[0];
    const primeroNumero = primero.comprobante.numero;

    const hasta:
      | { fecha: Date; numero: number; comprobanteId: string; linea: number }
      | undefined =
      primeroNumero !== null
        ? {
            fecha: primero.comprobante.fecha,
            numero: primeroNumero,
            comprobanteId: primero.comprobante.id,
            linea: primero.linea,
          }
        : undefined;

    const saldoInicial = await this.saldoCuenta(tenantId, cuentaId, {
      fechaDesde: filters.fechaInicio,
      hasta,
      ...extraSaldoCuenta,
    });

    let saldoCorriente = saldoInicial;

    const items: T[] = movimientos.map((m) => {
      saldoCorriente = saldoCorriente.add(m.debito).minus(m.credito);
      return mapFn({
        ...(m as unknown as MovimientoEnMayor),
        saldoCorriente,
      });
    });

    return { items, total };
    /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
  }

  async obtenerLibroMayor(
    tenantId: string,
    filters: LibroMayorFilters,
  ): Promise<{ items: LibroMayorMovimiento[]; total: number }> {
    return this.mayorBase<LibroMayorMovimiento>(
      tenantId,
      filters.cuentaId,
      {
        page: filters.page ?? 1,
        limit: filters.limit ?? 50,
        fechaInicio: filters.fechaInicio,
        fechaFin: filters.fechaFin,
      },
      {},
      {},
      {},
      (m): LibroMayorMovimiento => ({
        fecha: m.comprobante.fecha,
        comprobanteId: m.comprobante.id,
        comprobanteNumero: m.comprobante.numero,
        concepto: m.comprobante.concepto,
        linea: m.linea,
        debito: m.debito,
        credito: m.credito,
        saldoCorriente: m.saldoCorriente,
        terceroId: m.terceroId,
        centroCostoId: m.centroCostoId,
        descripcion: m.descripcion,
      }),
    );
  }

  async obtenerAuxiliarTercero(
    tenantId: string,
    filters: AuxiliarTerceroFilters,
  ): Promise<{ items: AuxiliarTerceroMovimiento[]; total: number }> {
    return this.mayorBase<AuxiliarTerceroMovimiento>(
      tenantId,
      filters.cuentaId,
      {
        page: filters.page ?? 1,
        limit: filters.limit ?? 50,
        fechaInicio: filters.fechaInicio,
        fechaFin: filters.fechaFin,
      },
      { terceroId: filters.terceroId },
      { tercero: { select: { razonSocial: true } } },
      { terceroId: filters.terceroId },
      (m): AuxiliarTerceroMovimiento => ({
        fecha: m.comprobante.fecha,
        comprobanteId: m.comprobante.id,
        comprobanteNumero: m.comprobante.numero,
        concepto: m.comprobante.concepto,
        linea: m.linea,
        debito: m.debito,
        credito: m.credito,
        saldoCorriente: m.saldoCorriente,
        terceroNombre: m.tercero?.razonSocial ?? 'N/A',
        centroCostoId: m.centroCostoId,
        descripcion: m.descripcion,
      }),
    );
  }

  async obtenerAuxiliarCentroCosto(
    tenantId: string,
    filters: AuxiliarCentroCostoFilters,
  ): Promise<{ items: AuxiliarCentroCostoMovimiento[]; total: number }> {
    return this.mayorBase<AuxiliarCentroCostoMovimiento>(
      tenantId,
      filters.cuentaId,
      {
        page: filters.page ?? 1,
        limit: filters.limit ?? 50,
        fechaInicio: filters.fechaInicio,
        fechaFin: filters.fechaFin,
      },
      { centroCostoId: filters.centroCostoId },
      { centroCosto: { select: { codigo: true, nombre: true } } },
      { centroCostoId: filters.centroCostoId },
      (m): AuxiliarCentroCostoMovimiento => ({
        fecha: m.comprobante.fecha,
        comprobanteId: m.comprobante.id,
        comprobanteNumero: m.comprobante.numero,
        concepto: m.comprobante.concepto,
        linea: m.linea,
        debito: m.debito,
        credito: m.credito,
        saldoCorriente: m.saldoCorriente,
        terceroId: m.terceroId,
        centroCostoCodigo: m.centroCosto?.codigo ?? 'N/A',
        centroCostoNombre: m.centroCosto?.nombre ?? 'N/A',
        descripcion: m.descripcion,
      }),
    );
  }
}
