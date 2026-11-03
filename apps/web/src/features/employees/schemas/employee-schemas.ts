import { z } from 'zod';
import { COLOMBIA_DANE_DEPARTMENT_CODES } from '@saas/types';

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
    registrarAfiliacionPilaInicial: z.boolean().optional(),
    afiliacionPilaInicial: z
      .object({
        epsCodigo: z.string().optional(),
        epsNombre: z.string().optional(),
        fondoPensionCodigo: z.string().optional(),
        fondoPensionNombre: z.string().optional(),
        estadoAfiliacionPensional: z.string().optional(),
        arlCodigo: z.string().optional(),
        arlNombre: z.string().optional(),
        arlClaseRiesgo: z.string().optional(),
        cajaCompensacionCodigo: z.string().optional(),
        cajaCompensacionNombre: z.string().optional(),
        cajaCompensacionDepartamentoCodigo: z.string().optional(),
        extranjeroNoObligadoPension: z.string().optional(),
        colombianoEnElExterior: z.string().optional(),
        vigenteDesde: z.string().optional(),
        vigenteHasta: z.string().optional(),
      })
      .optional(),
  })
  .superRefine(
    (
      {
        tipoDocumento,
        cedula,
        tipoContrato,
        registrarAfiliacionPilaInicial,
        afiliacionPilaInicial,
      },
      context,
    ) => {
      if (tipoDocumento === 'PC' && !/^\d{7,8}$/.test(cedula)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['cedula'],
          message: 'El número PEP-TUTOR debe contener 7 u 8 dígitos.',
        });
      }

      if (!registrarAfiliacionPilaInicial) return;

      const affiliation = afiliacionPilaInicial;
      if (!affiliation) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['afiliacionPilaInicial'],
          message: 'Completa los datos de afiliación PILA inicial.',
        });
        return;
      }

      if (!['TERMINO_FIJO', 'TERMINO_INDEFINIDO', 'OBRA_LABOR'].includes(tipoContrato)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['tipoContrato'],
          message:
            'La afiliación PILA 01/00 solo aplica a empleados con contrato laboral estándar.',
        });
      }

      const requiredText = (field: keyof typeof affiliation, label: string, maxLength: number) => {
        const value = affiliation[field]?.trim() ?? '';
        if (!value) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['afiliacionPilaInicial', field],
            message: `${label} es requerido.`,
          });
        } else if (value.length > maxLength) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['afiliacionPilaInicial', field],
            message: `${label} no puede superar ${maxLength} caracteres.`,
          });
        }
      };

      requiredText('epsCodigo', 'El código EPS', 6);
      requiredText('epsNombre', 'El nombre EPS', 120);
      requiredText('fondoPensionCodigo', 'El código de pensión', 6);
      requiredText('fondoPensionNombre', 'El nombre del fondo de pensión', 120);
      if (
        affiliation.estadoAfiliacionPensional &&
        !['S', 'N'].includes(affiliation.estadoAfiliacionPensional)
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['afiliacionPilaInicial', 'estadoAfiliacionPensional'],
          message: 'Usa S o N según el soporte de afiliación a pensiones.',
        });
      }
      requiredText('arlCodigo', 'El código ARL', 6);
      requiredText('arlNombre', 'El nombre ARL', 120);
      requiredText('cajaCompensacionCodigo', 'El código CCF', 6);
      requiredText('cajaCompensacionNombre', 'El nombre CCF', 120);

      if (!['1', '2', '3', '4', '5'].includes(affiliation.arlClaseRiesgo ?? '')) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['afiliacionPilaInicial', 'arlClaseRiesgo'],
          message: 'La clase de riesgo debe ser 1, 2, 3, 4 o 5.',
        });
      }
      if (
        !COLOMBIA_DANE_DEPARTMENT_CODES.includes(
          affiliation.cajaCompensacionDepartamentoCodigo as (typeof COLOMBIA_DANE_DEPARTMENT_CODES)[number],
        )
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['afiliacionPilaInicial', 'cajaCompensacionDepartamentoCodigo'],
          message: 'Selecciona un departamento válido según DIVIPOLA.',
        });
      }

      const validDate = (value: string | undefined) => {
        if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
        const parsed = new Date(`${value}T00:00:00.000Z`);
        return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
      };
      if (!validDate(affiliation.vigenteDesde)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['afiliacionPilaInicial', 'vigenteDesde'],
          message: 'La vigencia inicial es requerida y debe ser una fecha válida.',
        });
      }
      if (affiliation.vigenteHasta && !validDate(affiliation.vigenteHasta)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['afiliacionPilaInicial', 'vigenteHasta'],
          message: 'La fecha final de vigencia no es válida.',
        });
      } else if (
        validDate(affiliation.vigenteDesde) &&
        validDate(affiliation.vigenteHasta) &&
        affiliation.vigenteHasta! < affiliation.vigenteDesde!
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['afiliacionPilaInicial', 'vigenteHasta'],
          message: 'La fecha final no puede ser anterior a la inicial.',
        });
      }

      const declarationFields = [
        affiliation.extranjeroNoObligadoPension,
        affiliation.colombianoEnElExterior,
      ];
      if (declarationFields.some((value) => value && !['SI', 'NO'].includes(value))) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['afiliacionPilaInicial'],
          message: 'Usa Sí o No para las declaraciones PILA aplicables.',
        });
      }
      if (tipoDocumento === 'CC' || tipoDocumento === 'TI') {
        if (!affiliation.colombianoEnElExterior) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['afiliacionPilaInicial', 'colombianoEnElExterior'],
            message: 'Confirma si el cotizante colombiano reside en el exterior.',
          });
        }
        if (affiliation.extranjeroNoObligadoPension) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['afiliacionPilaInicial', 'extranjeroNoObligadoPension'],
            message: 'Esta declaración solo aplica a documentos CE o PA.',
          });
        }
      } else if (tipoDocumento === 'CE' || tipoDocumento === 'PA') {
        if (!affiliation.extranjeroNoObligadoPension) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['afiliacionPilaInicial', 'extranjeroNoObligadoPension'],
            message: 'Confirma la exención pensional del cotizante extranjero.',
          });
        }
        if (affiliation.colombianoEnElExterior) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['afiliacionPilaInicial', 'colombianoEnElExterior'],
            message: 'Esta declaración solo aplica a documentos CC o TI.',
          });
        }
      } else if (declarationFields.some(Boolean)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['afiliacionPilaInicial'],
          message: 'Las declaraciones PILA solo aplican a CC, TI, CE o PA.',
        });
      }
    },
  );

export type EmployeeFormData = z.infer<typeof employeeSchema>;
