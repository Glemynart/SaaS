import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import {
  SaldosFilters,
  SaldoCuenta,
  BalancePruebaItem,
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
      where: where as Prisma.MovimientoContableWhereInput,
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
}
