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

export const terceroSchema = z
  .object({
    tipoDocumento: z.enum(['CC', 'CE', 'TI', 'PA', 'NIT', 'PEP', 'PPT']),
    numeroDocumento: z.string().trim().min(1, 'El número de documento es requerido'),
    digitoVerificacion: z.string().trim().optional(),
    tipoPersona: z.enum(['NATURAL', 'JURIDICA']),
    razonSocial: z.string().trim().optional(),
    primerNombre: z.string().trim().optional(),
    segundoNombre: z.string().trim().optional(),
    primerApellido: z.string().trim().optional(),
    segundoApellido: z.string().trim().optional(),
    nombreComercial: z.string().trim().optional(),
    esCliente: z.boolean().optional(),
    esProveedor: z.boolean().optional(),
    esEmpleado: z.boolean().optional(),
    esEntidadGubernamental: z.boolean().optional(),
    esBanco: z.boolean().optional(),
    responsabilidadesFiscales: z.string().optional(),
    regimenSimple: z.boolean().optional(),
    granContribuyente: z.boolean().optional(),
    email: z.string().email('Correo electrónico no válido').optional().or(z.literal('')),
    telefono: z.string().trim().optional(),
    direccion: z.string().trim().optional(),
    municipioId: z.string().optional(),
    activo: z.boolean().optional(),
  })
  .superRefine((data, context) => {
    if (data.tipoPersona === 'JURIDICA' && !data.razonSocial) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['razonSocial'],
        message: 'La razón social es requerida',
      });
    }
    if (data.tipoPersona === 'NATURAL' && !data.primerNombre) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['primerNombre'],
        message: 'El primer nombre es requerido',
      });
    }
    if (data.tipoPersona === 'NATURAL' && !data.primerApellido) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['primerApellido'],
        message: 'El primer apellido es requerido',
      });
    }
  });

export type TerceroFormData = z.infer<typeof terceroSchema>;

export const centroCostoSchema = z.object({
  codigo: z.string().trim().min(1, 'El código es requerido'),
  nombre: z.string().trim().min(1, 'El nombre es requerido'),
  sedeId: z.string().optional(),
  activo: z.boolean().optional(),
});

export type CentroCostoFormData = z.infer<typeof centroCostoSchema>;
