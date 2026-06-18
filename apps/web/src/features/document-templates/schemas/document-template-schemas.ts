import { z } from 'zod';

export const documentTemplateTypeSchema = z.enum(['CONTRACT', 'CERTIFICATION', 'LETTER', 'MEMO']);

export const documentTemplateSchema = z.object({
  nombre: z.string().min(1, 'El nombre es obligatorio').max(200),
  descripcion: z.string().max(500).optional().or(z.literal('')),
  tipo: documentTemplateTypeSchema,
  contenido: z.string().min(1, 'El contenido es obligatorio'),
});

export type DocumentTemplateFormValues = z.infer<typeof documentTemplateSchema>;

export const DOCUMENT_TEMPLATE_TYPE_LABELS: Record<string, string> = {
  CONTRACT: 'Contrato',
  CERTIFICATION: 'Certificación',
  LETTER: 'Carta',
  MEMO: 'Memorando',
};

export const AVAILABLE_VARIABLES = [
  { key: 'NOMBRE_COMPLETO', label: 'Nombre completo', example: 'Juan Pérez García' },
  { key: 'DOCUMENTO', label: 'Documento', example: 'CC 1234567890' },
  { key: 'CARGO', label: 'Cargo', example: 'Docente de Planta' },
  { key: 'SALARIO', label: 'Salario', example: '$ 3.500.000' },
  { key: 'TIPO_CONTRATO', label: 'Tipo de contrato', example: 'Término Fijo' },
  { key: 'FECHA_INGRESO', label: 'Fecha de ingreso', example: '15 de enero de 2026' },
  { key: 'SEDE', label: 'Sede', example: 'Sede Norte' },
  { key: 'EMPRESA', label: 'Empresa', example: 'Operador Educativo S.A.S.' },
  { key: 'NIT', label: 'NIT', example: '900.123.456-7' },
  { key: 'REPRESENTANTE_LEGAL', label: 'Representante legal', example: 'María Gómez Rodríguez' },
  { key: 'LOGO_EMPRESA', label: 'Logo empresa', example: '[Logo corporativo]' },
  { key: 'FIRMA_REPRESENTANTE', label: 'Firma representante', example: '[Firma digitalizada]' },
] as const;
