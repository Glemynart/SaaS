import { z } from 'zod';

export const sedeSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  municipioId: z.string().min(1, 'El municipio es requerido'),
  direccion: z.string().optional().or(z.literal('')),
  activo: z.boolean().optional().default(true),
});

export type SedeFormData = z.infer<typeof sedeSchema>;
