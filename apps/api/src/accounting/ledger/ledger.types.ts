import { Prisma } from '@prisma/client';

export interface LineaComprobanteInput {
  cuentaId: string;
  terceroId?: string;
  centroCostoId?: string;
  debito: Prisma.Decimal | number;
  credito: Prisma.Decimal | number;
  baseGravable?: Prisma.Decimal | number;
  descripcion?: string;
}

export interface RegistrarComprobanteInput {
  tenantId: string;
  userId: string;
  tipoComprobanteId: string;
  periodoId: string;
  fecha: Date;
  concepto: string;
  lineas: LineaComprobanteInput[];
  origenTipo?: string;
  origenId?: string;
  origenEvento?: string;
}
