import { z } from 'zod';

export const contractSchema = z.object({
  employeeId: z.string().min(1, 'Seleccioná un empleado'),
  tipo: z.enum([
    'TERMINO_FIJO',
    'TERMINO_INDEFINIDO',
    'OBRA_LABOR',
    'APRENDIZAJE',
    'PRESTACION_SERVICIOS',
  ]),
  cargo: z.string().min(1, 'El cargo es obligatorio'),
  salario: z.coerce.number().min(0, 'El salario no puede ser negativo'),
  fechaInicio: z.string().min(1, 'La fecha de inicio es obligatoria'),
  fechaFin: z.string().optional().or(z.literal('')),
  sedeId: z.string().optional().or(z.literal('')),
});

export type ContractFormData = z.infer<typeof contractSchema>;
