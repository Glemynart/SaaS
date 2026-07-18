import { z } from 'zod';
import type { ClaseContable, NaturalezaContable } from '../services/accounting-api';

const clasesContables = [
  'ACTIVO',
  'PASIVO',
  'PATRIMONIO',
  'INGRESOS',
  'GASTOS',
  'COSTOS_VENTAS',
  'COSTOS_PRODUCCION',
  'CUENTAS_ORDEN_DEUDORAS',
  'CUENTAS_ORDEN_ACREEDORAS',
] as const satisfies readonly ClaseContable[];

const naturalezas = ['DEBITO', 'CREDITO'] as const satisfies readonly NaturalezaContable[];

export const cuentaContableSchema = z.object({
  codigo: z.string().trim().min(1, 'El código es requerido'),
  nombre: z.string().trim().min(1, 'El nombre es requerido'),
  claseContable: z.enum(clasesContables, { message: 'Selecciona una clase contable' }),
  naturaleza: z.enum(naturalezas, { message: 'Selecciona una naturaleza' }),
  nivel: z.coerce.number().int().min(1, 'El nivel mínimo es 1').max(5, 'El nivel máximo es 5'),
  cuentaPadreId: z.string().optional(),
  imputable: z.boolean().optional(),
  requiereTercero: z.boolean().optional(),
  requiereCentroCosto: z.boolean().optional(),
  requiereBase: z.boolean().optional(),
  activa: z.boolean().optional(),
});

export type CuentaContableFormData = z.infer<typeof cuentaContableSchema>;

export const cuentaSistemaMapSchema = z.object({
  rol: z.string().trim().min(1, 'El evento del sistema es requerido'),
  cuentaId: z.string().min(1, 'Selecciona una cuenta asociada'),
  descripcion: z.string().trim().optional(),
  activo: z.boolean().optional(),
});

export type CuentaSistemaMapFormData = z.infer<typeof cuentaSistemaMapSchema>;
