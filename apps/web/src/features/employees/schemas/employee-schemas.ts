import { z } from 'zod';

export const employeeSchema = z
  .object({
    tipoDocumento: z.enum(['CC', 'CE', 'TI', 'PA', 'NIT', 'PEP', 'PPT', 'PC'] as const, {
      message: 'Tipo de documento inválido',
    }),
    cedula: z.string().min(1, 'El número de documento es requerido'),
    primerNombre: z.string().min(1, 'El primer nombre es requerido'),
    segundoNombre: z.string().optional(),
    primerApellido: z.string().min(1, 'El primer apellido es requerido'),
    segundoApellido: z.string().optional(),
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
    sedeId: z.string().min(1, 'La sede del empleado es requerida'),
    tipoSalarioPila: z.preprocess(
      (value) => (value === '' ? null : value),
      z.enum(['X', 'F', 'V'] as const).nullable(),
    ),
    jornadaLaboral: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.enum(['COMPLETA', 'MEDIA', 'POR_HORAS'] as const).optional(),
    ),
    fechaRetiro: z.string().optional(),
    motivoRetiro: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z
        .enum([
          'RENUNCIA',
          'TERMINACION_CONTRATO',
          'MUTUO_ACUERDO',
          'JUSTA_CAUSA',
          'FALLECIMIENTO',
          'OTRO',
        ] as const)
        .optional(),
    ),
  })
  .superRefine(({ tipoDocumento, cedula }, context) => {
    if (tipoDocumento === 'PC' && !/^\d{7,8}$/.test(cedula)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['cedula'],
        message: 'El número PEP-TUTOR debe contener 7 u 8 dígitos.',
      });
    }
  });

export type EmployeeFormData = z.infer<typeof employeeSchema>;
