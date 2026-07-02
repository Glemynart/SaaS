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

export interface LibroDiarioFilters {
  fechaInicio?: Date;
  fechaFin?: Date;
  tipoComprobanteId?: string;
  incluirBorradores?: boolean;
  page?: number;
  limit?: number;
}

export interface LibroDiarioMovimiento {
  linea: number;
  cuentaId: string;
  cuentaCodigo: string;
  cuentaNombre: string;
  debito: Prisma.Decimal;
  credito: Prisma.Decimal;
  terceroId: string | null;
  centroCostoId: string | null;
  descripcion: string | null;
}

export interface LibroDiarioItem {
  comprobanteId: string;
  numero: number | null;
  fecha: Date;
  concepto: string;
  estado: string;
  tipoComprobanteId: string;
  totalDebito: Prisma.Decimal;
  totalCredito: Prisma.Decimal;
  movimientos: LibroDiarioMovimiento[];
}

export interface LibroMayorFilters {
  cuentaId: string;
  fechaInicio?: Date;
  fechaFin?: Date;
  page?: number;
  limit?: number;
}

export interface LibroMayorMovimiento {
  fecha: Date;
  comprobanteId: string;
  comprobanteNumero: number | null;
  concepto: string;
  linea: number;
  debito: Prisma.Decimal;
  credito: Prisma.Decimal;
  saldoCorriente: Prisma.Decimal;
  terceroId: string | null;
  centroCostoId: string | null;
  descripcion: string | null;
}

export interface AuxiliarTerceroFilters {
  cuentaId: string;
  terceroId: string;
  fechaInicio?: Date;
  fechaFin?: Date;
  page?: number;
  limit?: number;
}

export interface AuxiliarTerceroMovimiento {
  fecha: Date;
  comprobanteId: string;
  comprobanteNumero: number | null;
  concepto: string;
  linea: number;
  debito: Prisma.Decimal;
  credito: Prisma.Decimal;
  saldoCorriente: Prisma.Decimal;
  terceroNombre: string;
  centroCostoId: string | null;
  descripcion: string | null;
}

export interface AuxiliarCentroCostoFilters {
  cuentaId: string;
  centroCostoId: string;
  fechaInicio?: Date;
  fechaFin?: Date;
  page?: number;
  limit?: number;
}

export interface AuxiliarCentroCostoMovimiento {
  fecha: Date;
  comprobanteId: string;
  comprobanteNumero: number | null;
  concepto: string;
  linea: number;
  debito: Prisma.Decimal;
  credito: Prisma.Decimal;
  saldoCorriente: Prisma.Decimal;
  terceroId: string | null;
  centroCostoCodigo: string;
  centroCostoNombre: string;
  descripcion: string | null;
}

export interface MovimientoEnMayor {
  comprobante: {
    id: string;
    numero: number | null;
    concepto: string;
    fecha: Date;
  };
  linea: number;
  debito: Prisma.Decimal;
  credito: Prisma.Decimal;
  saldoCorriente: Prisma.Decimal;
  terceroId: string | null;
  centroCostoId: string | null;
  descripcion: string | null;
  tercero?: { razonSocial: string } | null;
  centroCosto?: { codigo: string; nombre: string } | null;
}
