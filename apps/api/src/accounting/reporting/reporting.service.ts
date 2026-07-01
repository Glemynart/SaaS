import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import {
  SaldosFilters,
  SaldoCuenta,
  BalancePruebaItem,
  LibroDiarioFilters,
  LibroDiarioItem,
  LibroDiarioMovimiento,
  LibroMayorFilters,
  LibroMayorMovimiento,
  AuxiliarTerceroFilters,
  AuxiliarTerceroMovimiento,
  AuxiliarCentroCostoFilters,
  AuxiliarCentroCostoMovimiento,
} from './reporting.types';

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
  }

  private async saldoCuenta(
    tenantId: string,
    cuentaId: string,
    options?: {
      fechaDesde?: Date;
      hasta?: { fecha: Date; numero: number; linea: number };
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
      const { fecha, numero, linea } = options.hasta;
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
          },
          linea: { lt: linea },
        },
      ];
    }

    const rows = await this.prisma.movimientoContable.groupBy({
      by: ['cuentaId'],
      where: where,
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
    mapFn: (movimiento: any) => T,
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
      { linea: 'asc' },
    ];

    const include: Record<string, unknown> = {
      comprobante: {
        select: { id: true, numero: true, concepto: true, fecha: true },
      },
      ...extraInclude,
    };

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

    const hasta: { fecha: Date; numero: number; linea: number } | undefined =
      primeroNumero !== null
        ? {
            fecha: primero.comprobante.fecha,
            numero: primeroNumero,
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
      return mapFn({ ...m, saldoCorriente });
    });

    return { items, total };
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
