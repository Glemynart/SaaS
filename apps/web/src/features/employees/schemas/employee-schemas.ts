import { z } from 'zod';

export const employeeSchema = z.object({
  tipoDocumento: z.string().min(1, 'El tipo de documento es requerido'),
  cedula: z.string().min(1, 'El número de documento es requerido'),
  nombre: z.string().min(1, 'Los nombres son requeridos'),
  apellido: z.string().min(1, 'Los apellidos son requeridos'),
  email: z.string().email('Correo electrónico no válido').optional().or(z.literal('')),
  telefono: z.string().optional().or(z.literal('')),
  cargo: z.string().min(1, 'El cargo es requerido'),
  salario: z.coerce.number().min(0, 'El salario no puede ser negativo'),
  tipoContrato: z.enum(
    [
      'TERMINO_FIJO',
      'TERMINO_INDEFINIDO',
      'OBRA_LABOR',
      'APRENDIZAJE',
      'PRESTACION_SERVICIOS',
    ] as const,
    {
      message: 'Tipo de contrato inválido',
    },
  ),
  fechaIngreso: z.string().min(1, 'La fecha de ingreso es requerida'),
  estado: z.enum(['ACTIVO', 'INACTIVO', 'SUSPENDIDO', 'RETIRADO'] as const).optional(),
  municipioExpedicionDocId: z.string().optional(),
  salarioIntegral: z.boolean().optional().default(false),
  jornadaLaboral: z.enum(['COMPLETA', 'MEDIA', 'POR_HORAS'] as const).optional(),
  fechaRetiro: z.string().optional(),
  motivoRetiro: z
    .enum([
      'RENUNCIA',
      'TERMINACION_CONTRATO',
      'MUTUO_ACUERDO',
      'JUSTA_CAUSA',
      'FALLECIMIENTO',
      'OTRO',
    ] as const)
    .optional(),
});

export type EmployeeFormData = z.infer<typeof employeeSchema>;
