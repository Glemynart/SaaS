import { Prisma } from '@prisma/client';

export interface SaldosFilters {
  fechaInicio?: Date;
  fechaFin?: Date;
  cuentaDesde?: string;
  cuentaHasta?: string;
  nivel?: number;
}

export interface SaldoCuenta {
  cuentaId: string;
  totalDebito: Prisma.Decimal;
  totalCredito: Prisma.Decimal;
  saldo: Prisma.Decimal;
}

export interface BalancePruebaItem {
  cuentaId: string;
  codigo: string;
  nombre: string;
  totalDebito: Prisma.Decimal;
  totalCredito: Prisma.Decimal;
  saldo: Prisma.Decimal;
}
