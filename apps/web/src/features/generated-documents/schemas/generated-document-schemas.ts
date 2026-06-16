import { z } from 'zod';

export const generateDocumentSchema = z.object({
  employeeId: z.string().min(1),
  templateId: z.string().min(1, 'Seleccioná una plantilla'),
  nombre: z.string().min(1, 'El nombre del documento es obligatorio').max(200),
});

export type GenerateDocumentFormValues = z.infer<typeof generateDocumentSchema>;
