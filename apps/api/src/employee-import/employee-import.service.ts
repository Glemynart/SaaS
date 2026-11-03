import {
  Injectable,
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import { AuditService } from '../audit/audit.service';
import { isValidPepTutorDocumentNumber } from '../common/validators/pep-tutor-document-number';
import { isColombiaDaneDepartmentCode } from '@saas/types';
import {
  SOCIAL_SECURITY_AFFILIATION_CAPTURE_VERSION,
  validatePilaAffiliationDeclarations,
} from '../employees/social-security-affiliation.policy';
import * as XLSX from 'xlsx';

const MAX_ROWS = 500;

const VALID_TIPO_DOCUMENTO = [
  'CC',
  'CE',
  'TI',
  'PA',
  'NIT',
  'PEP',
  'PPT',
  'PC',
] as const;
type TipoDocIdentidad = (typeof VALID_TIPO_DOCUMENTO)[number];

const VALID_TIPO_CONTRATO = [
  'TERMINO_FIJO',
  'TERMINO_INDEFINIDO',
  'OBRA_LABOR',
  'APRENDIZAJE',
  'PRESTACION_SERVICIOS',
] as const;
type ContratoTipo = (typeof VALID_TIPO_CONTRATO)[number];

const VALID_ESTADO = ['ACTIVO', 'INACTIVO', 'SUSPENDIDO', 'RETIRADO'] as const;
const VALID_JORNADA = ['COMPLETA', 'MEDIA', 'POR_HORAS'] as const;
const VALID_TIPO_SALARIO_PILA = ['X', 'F', 'V'] as const;
const VALID_MOTIVO_RETIRO = [
  'RENUNCIA',
  'TERMINACION_CONTRATO',
  'MUTUO_ACUERDO',
  'JUSTA_CAUSA',
  'FALLECIMIENTO',
  'OTRO',
] as const;

type ValidEstado = (typeof VALID_ESTADO)[number];
type ValidJornada = (typeof VALID_JORNADA)[number];
type ValidMotivoRetiro = (typeof VALID_MOTIVO_RETIRO)[number];
type ValidTipoSalarioPila = (typeof VALID_TIPO_SALARIO_PILA)[number];

export interface ImportError {
  fila: number;
  campo: string;
  mensaje: string;
}

interface RawRow {
  cedula?: unknown;
  tipoDocumento?: unknown;
  primerNombre?: unknown;
  segundoNombre?: unknown;
  primerApellido?: unknown;
  segundoApellido?: unknown;
  email?: unknown;
  telefono?: unknown;
  cargo?: unknown;
  salario?: unknown;
  tipoContrato?: unknown;
  fechaIngreso?: unknown;
  estado?: unknown;
  sede?: unknown;
  dependencia?: unknown;
  tipoSalarioPila?: unknown;
  // Backward compatibility with previously downloaded templates.
  salarioIntegral?: unknown;
  jornadaLaboral?: unknown;
  fechaRetiro?: unknown;
  motivoRetiro?: unknown;
  tipoCotizanteCodigo?: unknown;
  subtipoCotizanteCodigo?: unknown;
  epsCodigo?: unknown;
  epsNombre?: unknown;
  fondoPensionCodigo?: unknown;
  fondoPensionNombre?: unknown;
  arlCodigo?: unknown;
  arlNombre?: unknown;
  arlClaseRiesgo?: unknown;
  cajaCompensacionCodigo?: unknown;
  cajaCompensacionNombre?: unknown;
  cajaCompensacionDepartamentoCodigo?: unknown;
  extranjeroNoObligadoPension?: unknown;
  colombianoEnElExterior?: unknown;
  afiliacionVigenteDesde?: unknown;
  afiliacionVigenteHasta?: unknown;
}

interface InitialPilaAffiliationData {
  tipoCotizanteCodigo: string;
  subtipoCotizanteCodigo: string;
  epsCodigo: string;
  epsNombre: string;
  fondoPensionCodigo: string;
  fondoPensionNombre: string;
  arlCodigo: string;
  arlNombre: string;
  arlClaseRiesgo: string;
  cajaCompensacionCodigo: string;
  cajaCompensacionNombre: string;
  cajaCompensacionDepartamentoCodigo: string;
  extranjeroNoObligadoPension: boolean | null;
  colombianoEnElExterior: boolean | null;
  vigenteDesde: Date;
  vigenteHasta: Date | null;
}

function str(val: unknown): string | undefined {
  if (val === undefined || val === null || val === '') return undefined;
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'number' || typeof val === 'boolean') {
    return val.toString().trim();
  }
  return undefined;
}

function parseDate(val: unknown): string | undefined {
  if (val === undefined || val === null || val === '') return undefined;
  // SheetJS with cellDates:true returns JS Date
  if (val instanceof Date) {
    return val.toISOString().split('T')[0];
  }
  if (typeof val !== 'string' && typeof val !== 'number') return undefined;
  const s = val.toString().trim();
  // Accept YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // Accept DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split('/');
    return `${y}-${m}-${d}`;
  }
  return s;
}

function parseSalario(val: unknown): number | undefined {
  if (val === undefined || val === null || val === '') return undefined;
  const n = Number(val);
  return isNaN(n) ? undefined : n;
}

function parseBool(val: unknown): boolean {
  if (val === true || val === 'TRUE' || val === 'true' || val === 1)
    return true;
  return false;
}

// Template column headers in order
const TEMPLATE_HEADERS = [
  'cedula',
  'tipoDocumento',
  'primerNombre',
  'segundoNombre',
  'primerApellido',
  'segundoApellido',
  'email',
  'telefono',
  'cargo',
  'salario',
  'tipoContrato',
  'fechaIngreso',
  'estado',
  'sede',
  'dependencia',
  'tipoSalarioPila',
  'jornadaLaboral',
  'fechaRetiro',
  'motivoRetiro',
  'tipoCotizanteCodigo',
  'subtipoCotizanteCodigo',
  'epsCodigo',
  'epsNombre',
  'fondoPensionCodigo',
  'fondoPensionNombre',
  'arlCodigo',
  'arlNombre',
  'arlClaseRiesgo',
  'cajaCompensacionCodigo',
  'cajaCompensacionNombre',
  'cajaCompensacionDepartamentoCodigo',
  'extranjeroNoObligadoPension',
  'colombianoEnElExterior',
  'afiliacionVigenteDesde',
  'afiliacionVigenteHasta',
];

const TEMPLATE_HINTS = [
  'Requerido. Número de documento.',
  'Requerido. CC | CE | TI | PA | NIT | PEP | PPT | PC (PEP-TUTOR: 7-8 dígitos)',
  'Requerido.',
  'Opcional.',
  'Requerido.',
  'Opcional.',
  'Opcional.',
  'Opcional.',
  'Requerido. Ej: Docente',
  'Requerido. Número sin puntos. Ej: 1200000',
  'Requerido. TERMINO_FIJO | TERMINO_INDEFINIDO | OBRA_LABOR | APRENDIZAJE | PRESTACION_SERVICIOS',
  'Requerido. Formato YYYY-MM-DD. Ej: 2025-01-15',
  'Opcional. ACTIVO | INACTIVO | SUSPENDIDO | RETIRADO. Por defecto: ACTIVO',
  'Requerido. Nombre exacto de una sede activa (ej: Sede Principal).',
  'Opcional. Área o departamento.',
  'Opcional. X (integral) | F (fijo) | V (variable), según declaración de la empresa.',
  'Opcional. COMPLETA | MEDIA | POR_HORAS',
  'Opcional. Formato YYYY-MM-DD.',
  'Opcional. RENUNCIA | TERMINACION_CONTRATO | MUTUO_ACUERDO | JUSTA_CAUSA | FALLECIMIENTO | OTRO',
  'Opcional por empleado. Si completas cualquier dato PILA, completa el bloque. Usa 01 (trabajador dependiente estándar).',
  'Opcional por empleado. El MVP admite el subtipo estándar 00; casos especiales quedan fuera.',
  'Código EPS (texto, 1–6 caracteres); no se valida contra catálogo.',
  'Nombre EPS (1–120 caracteres).',
  'Código de fondo de pensión (texto, 1–6 caracteres); no se valida contra catálogo.',
  'Nombre de fondo de pensión (1–120 caracteres).',
  'Código ARL (texto, 1–6 caracteres); no se valida contra catálogo.',
  'Nombre ARL (1–120 caracteres).',
  'Clase de riesgo: 1 | 2 | 3 | 4 | 5.',
  'Código de caja de compensación (texto, 1–6 caracteres); no se valida contra catálogo.',
  'Nombre de caja de compensación (1–120 caracteres).',
  'Código DIVIPOLA del departamento de la CCF (dos dígitos, ej. 08).',
  'Para CE/PA: SI o NO. Para otros documentos, dejar vacío.',
  'Para CC/TI: SI o NO. Para otros documentos, dejar vacío.',
  'Vigente desde. Formato YYYY-MM-DD.',
  'Vigente hasta. Opcional; formato YYYY-MM-DD.',
];

const PILA_AFFILIATION_FIELDS = [
  'tipoCotizanteCodigo',
  'subtipoCotizanteCodigo',
  'epsCodigo',
  'epsNombre',
  'fondoPensionCodigo',
  'fondoPensionNombre',
  'arlCodigo',
  'arlNombre',
  'arlClaseRiesgo',
  'cajaCompensacionCodigo',
  'cajaCompensacionNombre',
  'cajaCompensacionDepartamentoCodigo',
  'extranjeroNoObligadoPension',
  'colombianoEnElExterior',
  'afiliacionVigenteDesde',
  'afiliacionVigenteHasta',
] as const;

function hasImportValue(value: unknown): boolean {
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  const normalized = str(value);
  return normalized !== undefined && normalized.length > 0;
}

function normalizeTwoDigitCode(value: unknown): string | undefined {
  const normalized = str(value);
  if (!normalized || !/^\d{1,2}$/.test(normalized)) return normalized;
  return normalized.padStart(2, '0');
}

function parsePilaDate(value: unknown): { date?: Date; invalid: boolean } {
  if (value === undefined || value === null || value === '') {
    return { invalid: false };
  }

  const dateText =
    value instanceof Date && !Number.isNaN(value.getTime())
      ? value.toISOString().slice(0, 10)
      : str(value);
  if (!dateText || !/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
    return { invalid: true };
  }

  const date = new Date(`${dateText}T00:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== dateText
  ) {
    return { invalid: true };
  }

  return { date, invalid: false };
}

function parsePilaDeclaration(value: unknown): {
  value?: boolean;
  invalid: boolean;
} {
  if (!hasImportValue(value)) return { invalid: false };
  if (typeof value === 'boolean') return { value, invalid: false };
  if (typeof value === 'number' && (value === 1 || value === 0)) {
    return { value: value === 1, invalid: false };
  }

  const normalized = str(value)
    ?.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
  if (
    normalized === 'SI' ||
    normalized === 'S' ||
    normalized === 'TRUE' ||
    normalized === '1'
  ) {
    return { value: true, invalid: false };
  }
  if (
    normalized === 'NO' ||
    normalized === 'N' ||
    normalized === 'FALSE' ||
    normalized === '0'
  ) {
    return { value: false, invalid: false };
  }
  return { invalid: true };
}

function parseInitialPilaAffiliation(
  row: RawRow,
  fila: number,
  tipoDocumento: string | undefined,
  errors: ImportError[],
): InitialPilaAffiliationData | undefined {
  if (!PILA_AFFILIATION_FIELDS.some((field) => hasImportValue(row[field]))) {
    return undefined;
  }

  const requiredText = (field: string, label: string, maxLength: number) => {
    const rawValue = row[field as keyof RawRow];
    if (typeof rawValue !== 'string') {
      errors.push({
        fila,
        campo: field,
        mensaje:
          rawValue === undefined || rawValue === null || rawValue === ''
            ? `${label} es requerido.`
            : `${label} debe estar como texto en Excel.`,
      });
      return undefined;
    }
    const value = rawValue.trim();
    if (!value) {
      errors.push({ fila, campo: field, mensaje: `${label} es requerido.` });
      return undefined;
    }
    if (value.length > maxLength) {
      errors.push({
        fila,
        campo: field,
        mensaje: `${label} no puede superar ${maxLength} caracteres.`,
      });
      return undefined;
    }
    return value;
  };

  const tipoCotizanteCodigo = normalizeTwoDigitCode(row.tipoCotizanteCodigo);
  if (tipoCotizanteCodigo !== '01') {
    errors.push({
      fila,
      campo: 'tipoCotizanteCodigo',
      mensaje: 'El MVP PILA solo admite el cotizante dependiente estándar 01.',
    });
  }

  const subtipoCotizanteCodigo = normalizeTwoDigitCode(
    row.subtipoCotizanteCodigo,
  );
  if (subtipoCotizanteCodigo !== '00') {
    errors.push({
      fila,
      campo: 'subtipoCotizanteCodigo',
      mensaje: 'El MVP PILA solo admite el subtipo estándar 00.',
    });
  }

  const epsCodigo = requiredText(
    'epsCodigo',
    'El código EPS',
    6,
  )?.toUpperCase();
  const epsNombre = requiredText('epsNombre', 'El nombre EPS', 120);
  const fondoPensionCodigo = requiredText(
    'fondoPensionCodigo',
    'El código de fondo de pensión',
    6,
  )?.toUpperCase();
  const fondoPensionNombre = requiredText(
    'fondoPensionNombre',
    'El nombre de fondo de pensión',
    120,
  );
  const arlCodigo = requiredText(
    'arlCodigo',
    'El código ARL',
    6,
  )?.toUpperCase();
  const arlNombre = requiredText('arlNombre', 'El nombre ARL', 120);
  const arlClaseRiesgo = str(row.arlClaseRiesgo);
  if (!arlClaseRiesgo || !['1', '2', '3', '4', '5'].includes(arlClaseRiesgo)) {
    errors.push({
      fila,
      campo: 'arlClaseRiesgo',
      mensaje: 'La clase de riesgo debe ser 1, 2, 3, 4 o 5.',
    });
  }
  const cajaCompensacionCodigo = requiredText(
    'cajaCompensacionCodigo',
    'El código de caja de compensación',
    6,
  )?.toUpperCase();
  const cajaCompensacionNombre = requiredText(
    'cajaCompensacionNombre',
    'El nombre de caja de compensación',
    120,
  );

  const cajaCompensacionDepartamentoCodigo = normalizeTwoDigitCode(
    row.cajaCompensacionDepartamentoCodigo,
  );
  if (
    !cajaCompensacionDepartamentoCodigo ||
    !isColombiaDaneDepartmentCode(cajaCompensacionDepartamentoCodigo)
  ) {
    errors.push({
      fila,
      campo: 'cajaCompensacionDepartamentoCodigo',
      mensaje: 'Usa un código de departamento válido según DIVIPOLA.',
    });
  }

  const foreignDeclaration = parsePilaDeclaration(
    row.extranjeroNoObligadoPension,
  );
  const colombianAbroadDeclaration = parsePilaDeclaration(
    row.colombianoEnElExterior,
  );
  if (foreignDeclaration.invalid) {
    errors.push({
      fila,
      campo: 'extranjeroNoObligadoPension',
      mensaje: 'Usa SI o NO para la declaración de cotizante extranjero.',
    });
  }
  if (colombianAbroadDeclaration.invalid) {
    errors.push({
      fila,
      campo: 'colombianoEnElExterior',
      mensaje: 'Usa SI o NO para la declaración de colombiano en el exterior.',
    });
  }

  const extranjeroNoObligadoPension = foreignDeclaration.value ?? null;
  const colombianoEnElExterior = colombianAbroadDeclaration.value ?? null;
  for (const declarationError of validatePilaAffiliationDeclarations(
    tipoDocumento ?? '',
    { extranjeroNoObligadoPension, colombianoEnElExterior },
  )) {
    errors.push({
      fila,
      campo: declarationError.field,
      mensaje: declarationError.message,
    });
  }

  const startDate = parsePilaDate(row.afiliacionVigenteDesde);
  if (!startDate.date) {
    errors.push({
      fila,
      campo: 'afiliacionVigenteDesde',
      mensaje: startDate.invalid
        ? 'Fecha inválida; usa el formato YYYY-MM-DD.'
        : 'La fecha inicial de afiliación es requerida.',
    });
  }
  const endDate = parsePilaDate(row.afiliacionVigenteHasta);
  if (endDate.invalid) {
    errors.push({
      fila,
      campo: 'afiliacionVigenteHasta',
      mensaje: 'Fecha inválida; usa el formato YYYY-MM-DD.',
    });
  }
  if (startDate.date && endDate.date && endDate.date < startDate.date) {
    errors.push({
      fila,
      campo: 'afiliacionVigenteHasta',
      mensaje: 'La fecha final no puede ser anterior a la fecha inicial.',
    });
  }

  if (
    tipoCotizanteCodigo !== '01' ||
    subtipoCotizanteCodigo !== '00' ||
    !epsCodigo ||
    !epsNombre ||
    !fondoPensionCodigo ||
    !fondoPensionNombre ||
    !arlCodigo ||
    !arlNombre ||
    !arlClaseRiesgo ||
    !['1', '2', '3', '4', '5'].includes(arlClaseRiesgo) ||
    !cajaCompensacionCodigo ||
    !cajaCompensacionNombre ||
    !cajaCompensacionDepartamentoCodigo ||
    !isColombiaDaneDepartmentCode(cajaCompensacionDepartamentoCodigo) ||
    !startDate.date ||
    endDate.invalid ||
    (endDate.date !== undefined && endDate.date < startDate.date)
  ) {
    return undefined;
  }

  return {
    tipoCotizanteCodigo,
    subtipoCotizanteCodigo,
    epsCodigo,
    epsNombre,
    fondoPensionCodigo,
    fondoPensionNombre,
    arlCodigo,
    arlNombre,
    arlClaseRiesgo,
    cajaCompensacionCodigo,
    cajaCompensacionNombre,
    cajaCompensacionDepartamentoCodigo,
    extranjeroNoObligadoPension,
    colombianoEnElExterior,
    vigenteDesde: startDate.date,
    vigenteHasta: endDate.date ?? null,
  };
}

@Injectable()
export class EmployeeImportService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private auditService: AuditService,
  ) {}

  generateTemplate(): Buffer {
    const wb = XLSX.utils.book_new();

    const ws = XLSX.utils.aoa_to_sheet([
      TEMPLATE_HEADERS,
      TEMPLATE_HINTS,
      // Example row
      [
        '12345678',
        'CC',
        'María',
        'Isabel',
        'García',
        'López',
        'mgarcia@colegio.edu.co',
        '3001234567',
        'Docente',
        '1200000',
        'TERMINO_FIJO',
        '2025-01-15',
        'ACTIVO',
        'Sede Principal',
        '',
        'F',
        'COMPLETA',
        '',
        '',
        ...PILA_AFFILIATION_FIELDS.map(() => ''),
      ],
    ]);

    // Freeze first row (header)
    ws['!freeze'] = {
      xSplit: 0,
      ySplit: 1,
      topLeftCell: 'A2',
      activePane: 'bottomLeft',
      state: 'frozen',
    };

    // Column widths
    ws['!cols'] = TEMPLATE_HEADERS.map(() => ({ wch: 22 }));

    XLSX.utils.book_append_sheet(wb, ws, 'Empleados');

    return Buffer.from(
      XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as ArrayBuffer,
    );
  }

  async importFromBuffer(
    tenantId: string,
    userId: string,
    buffer: Buffer,
  ): Promise<{ imported: number; message: string }> {
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) {
      throw new BadRequestException('El archivo Excel no contiene hojas.');
    }

    const ws = wb.Sheets[sheetName];
    const [headerRow] = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      range: 0,
      defval: undefined,
      blankrows: false,
    });
    const headers = headerRow?.map((cell) => str(cell) ?? '') ?? [];
    if (!headers.includes('cedula')) {
      throw new BadRequestException(
        'La plantilla debe incluir la columna cedula en la primera fila.',
      );
    }

    const rows = XLSX.utils.sheet_to_json<RawRow>(ws, {
      header: headers,
      range: 1, // skip header row
      defval: undefined,
      blankrows: false,
    });

    // Filter out the hints row if present (row 2 in the template has hint text)
    const dataRows = rows.filter((row) => {
      const cedula = str(row.cedula);
      // skip rows that look like hint rows (contain 'Requerido' or 'Opcional')
      return !(
        cedula?.startsWith('Requerido') || cedula?.startsWith('Opcional')
      );
    });

    if (dataRows.length === 0) {
      throw new BadRequestException(
        'El archivo no contiene datos de empleados.',
      );
    }
    if (dataRows.length > MAX_ROWS) {
      throw new BadRequestException(
        `El archivo contiene ${dataRows.length} filas. El máximo permitido es ${MAX_ROWS}.`,
      );
    }

    const errors: ImportError[] = [];

    // Collect all sede names to resolve in batch
    const sedeNamesInFile = new Set<string>();
    for (const row of dataRows) {
      const sedeName = str(row.sede);
      if (sedeName) sedeNamesInFile.add(sedeName.toLowerCase());
    }

    // Batch-resolve sedes by name (case-insensitive via lowercase map)
    const sedeMap = new Map<string, string>(); // lowercase name → sedeId
    if (sedeNamesInFile.size > 0) {
      const sedes = await this.tenantPrisma.execute((prisma) =>
        prisma.sede.findMany({
          where: {
            tenantId,
            activo: true,
            nombre: { in: Array.from(sedeNamesInFile), mode: 'insensitive' },
          },
          select: { id: true, nombre: true },
        }),
      );
      for (const s of sedes) {
        sedeMap.set(s.nombre.toLowerCase(), s.id);
      }
    }

    // Collect all cedulas in file to detect inter-row duplicates
    const cedulasInFile = new Map<string, number>(); // cedula → first fila
    const cedulasToCheck: string[] = [];

    // Validate all rows
    type EmployeeCreateData = {
      cedula: string;
      tipoDocumento: TipoDocIdentidad;
      primerNombre: string;
      segundoNombre?: string;
      primerApellido: string;
      segundoApellido?: string;
      email?: string;
      telefono?: string;
      cargo: string;
      salario: number;
      tipoContrato: ContratoTipo;
      fechaIngreso: Date;
      estado?: ValidEstado;
      sedeId: string;
      dependencia?: string;
      salarioIntegral?: boolean;
      tipoSalarioPila?: ValidTipoSalarioPila;
      jornadaLaboral?: ValidJornada;
      fechaRetiro?: Date;
      motivoRetiro?: ValidMotivoRetiro;
      tenantId: string;
    };

    const validatedRows: Array<{
      employee: EmployeeCreateData;
      initialPilaAffiliation?: InitialPilaAffiliationData;
    }> = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const fila = i + 2; // 1-indexed, accounting for header row

      // cedula
      const cedula = str(row.cedula);
      if (!cedula) {
        errors.push({
          fila,
          campo: 'cedula',
          mensaje: 'La cédula es requerida.',
        });
      } else {
        if (cedulasInFile.has(cedula)) {
          errors.push({
            fila,
            campo: 'cedula',
            mensaje: `Cédula duplicada en el archivo (primera aparición en fila ${cedulasInFile.get(cedula)}).`,
          });
        } else {
          cedulasInFile.set(cedula, fila);
          cedulasToCheck.push(cedula);
        }
      }

      // tipoDocumento
      const tipoDocumento = str(row.tipoDocumento)?.toUpperCase() as
        | TipoDocIdentidad
        | undefined;
      if (!tipoDocumento) {
        errors.push({
          fila,
          campo: 'tipoDocumento',
          mensaje: 'El tipo de documento es requerido.',
        });
      } else if (!VALID_TIPO_DOCUMENTO.includes(tipoDocumento)) {
        errors.push({
          fila,
          campo: 'tipoDocumento',
          mensaje: `Tipo de documento inválido: "${tipoDocumento}". Valores válidos: ${VALID_TIPO_DOCUMENTO.join(', ')}.`,
        });
      } else if (
        tipoDocumento === 'PC' &&
        !isValidPepTutorDocumentNumber(cedula)
      ) {
        errors.push({
          fila,
          campo: 'cedula',
          mensaje: 'El número PEP-TUTOR (PC) debe contener 7 u 8 dígitos.',
        });
      }

      const initialPilaAffiliation = parseInitialPilaAffiliation(
        row,
        fila,
        tipoDocumento,
        errors,
      );

      // primerNombre
      const primerNombre = str(row.primerNombre);
      if (!primerNombre) {
        errors.push({
          fila,
          campo: 'primerNombre',
          mensaje: 'El primer nombre es requerido.',
        });
      }

      // primerApellido
      const primerApellido = str(row.primerApellido);
      if (!primerApellido) {
        errors.push({
          fila,
          campo: 'primerApellido',
          mensaje: 'El primer apellido es requerido.',
        });
      }

      // cargo
      const cargo = str(row.cargo);
      if (!cargo) {
        errors.push({
          fila,
          campo: 'cargo',
          mensaje: 'El cargo es requerido.',
        });
      }

      // salario
      const salario = parseSalario(row.salario);
      if (salario === undefined) {
        errors.push({
          fila,
          campo: 'salario',
          mensaje: 'El salario es requerido y debe ser un número.',
        });
      } else if (salario < 0) {
        errors.push({
          fila,
          campo: 'salario',
          mensaje: 'El salario no puede ser negativo.',
        });
      }

      // tipoContrato
      const tipoContrato = str(row.tipoContrato)?.toUpperCase() as
        | ContratoTipo
        | undefined;
      if (!tipoContrato) {
        errors.push({
          fila,
          campo: 'tipoContrato',
          mensaje: 'El tipo de contrato es requerido.',
        });
      } else if (!VALID_TIPO_CONTRATO.includes(tipoContrato)) {
        errors.push({
          fila,
          campo: 'tipoContrato',
          mensaje: `Tipo de contrato inválido: "${tipoContrato}". Valores válidos: ${VALID_TIPO_CONTRATO.join(', ')}.`,
        });
      }

      const tipoSalarioRaw = str(row.tipoSalarioPila)?.toUpperCase();
      let tipoSalarioPila: ValidTipoSalarioPila | undefined;
      if (
        tipoSalarioRaw &&
        !VALID_TIPO_SALARIO_PILA.includes(
          tipoSalarioRaw as ValidTipoSalarioPila,
        )
      ) {
        errors.push({
          fila,
          campo: 'tipoSalarioPila',
          mensaje: `Tipo de salario PILA inválido: "${tipoSalarioRaw}". Valores válidos: ${VALID_TIPO_SALARIO_PILA.join(', ')}.`,
        });
      } else if (tipoSalarioRaw) {
        tipoSalarioPila = tipoSalarioRaw as ValidTipoSalarioPila;
      } else if (parseBool(row.salarioIntegral)) {
        // Legacy spreadsheets can identify integral pay, but FALSE does not
        // prove that a worker has fixed rather than variable pay.
        tipoSalarioPila = 'X';
      }

      const legacyIntegralRaw = str(row.salarioIntegral)?.toUpperCase();
      if (
        tipoSalarioPila &&
        legacyIntegralRaw &&
        (tipoSalarioPila === 'X') !== parseBool(legacyIntegralRaw)
      ) {
        errors.push({
          fila,
          campo: 'tipoSalarioPila',
          mensaje:
            'El tipo de salario PILA no coincide con la columna salarioIntegral de la plantilla anterior.',
        });
      }

      // fechaIngreso
      const fechaIngresoStr = parseDate(row.fechaIngreso);
      let fechaIngresoParsed: Date | undefined;
      if (!fechaIngresoStr) {
        errors.push({
          fila,
          campo: 'fechaIngreso',
          mensaje: 'La fecha de ingreso es requerida.',
        });
      } else {
        fechaIngresoParsed = new Date(fechaIngresoStr);
        if (isNaN(fechaIngresoParsed.getTime())) {
          errors.push({
            fila,
            campo: 'fechaIngreso',
            mensaje: `Fecha de ingreso inválida: "${fechaIngresoStr}". Use formato YYYY-MM-DD.`,
          });
          fechaIngresoParsed = undefined;
        }
      }

      // estado (optional)
      const estadoRaw = str(row.estado)?.toUpperCase();
      if (
        estadoRaw &&
        !VALID_ESTADO.includes(estadoRaw as (typeof VALID_ESTADO)[number])
      ) {
        errors.push({
          fila,
          campo: 'estado',
          mensaje: `Estado inválido: "${estadoRaw}". Valores válidos: ${VALID_ESTADO.join(', ')}.`,
        });
      }

      // Every imported employee needs an active site belonging to the tenant.
      const sedeName = str(row.sede);
      let resolvedSedeId: string | undefined;
      if (!sedeName) {
        errors.push({
          fila,
          campo: 'sede',
          mensaje: 'La sede del empleado es requerida.',
        });
      } else {
        resolvedSedeId = sedeMap.get(sedeName.toLowerCase());
        if (!resolvedSedeId) {
          errors.push({
            fila,
            campo: 'sede',
            mensaje: `Sede "${sedeName}" no encontrada o no está activa en esta empresa.`,
          });
        }
      }

      // jornadaLaboral (optional)
      const jornadaRaw = str(row.jornadaLaboral)?.toUpperCase();
      if (
        jornadaRaw &&
        !VALID_JORNADA.includes(jornadaRaw as (typeof VALID_JORNADA)[number])
      ) {
        errors.push({
          fila,
          campo: 'jornadaLaboral',
          mensaje: `Jornada laboral inválida: "${jornadaRaw}". Valores válidos: ${VALID_JORNADA.join(', ')}.`,
        });
      }

      // motivoRetiro (optional)
      const motivoRaw = str(row.motivoRetiro)?.toUpperCase();
      if (
        motivoRaw &&
        !VALID_MOTIVO_RETIRO.includes(
          motivoRaw as (typeof VALID_MOTIVO_RETIRO)[number],
        )
      ) {
        errors.push({
          fila,
          campo: 'motivoRetiro',
          mensaje: `Motivo de retiro inválido: "${motivoRaw}". Valores válidos: ${VALID_MOTIVO_RETIRO.join(', ')}.`,
        });
      }

      // fechaRetiro (optional)
      const fechaRetiroStr = parseDate(row.fechaRetiro);
      let fechaRetiroParsed: Date | undefined;
      if (fechaRetiroStr) {
        fechaRetiroParsed = new Date(fechaRetiroStr);
        if (isNaN(fechaRetiroParsed.getTime())) {
          errors.push({
            fila,
            campo: 'fechaRetiro',
            mensaje: `Fecha de retiro inválida: "${fechaRetiroStr}". Use formato YYYY-MM-DD.`,
          });
          fechaRetiroParsed = undefined;
        }
      }

      // Only add to validatedRows if no errors so far for this row
      if (
        cedula &&
        tipoDocumento &&
        VALID_TIPO_DOCUMENTO.includes(tipoDocumento) &&
        primerNombre &&
        primerApellido &&
        cargo &&
        salario !== undefined &&
        salario >= 0 &&
        tipoContrato &&
        VALID_TIPO_CONTRATO.includes(tipoContrato) &&
        fechaIngresoParsed &&
        resolvedSedeId &&
        !errors.find((e) => e.fila === fila)
      ) {
        validatedRows.push({
          employee: {
            cedula,
            tipoDocumento,
            primerNombre,
            segundoNombre: str(row.segundoNombre),
            primerApellido,
            segundoApellido: str(row.segundoApellido),
            email: str(row.email) || undefined,
            telefono: str(row.telefono),
            cargo,
            salario,
            tipoContrato,
            fechaIngreso: fechaIngresoParsed,
            estado: (estadoRaw || undefined) as ValidEstado | undefined,
            sedeId: resolvedSedeId,
            dependencia: str(row.dependencia),
            salarioIntegral: tipoSalarioPila === 'X',
            tipoSalarioPila,
            jornadaLaboral: (jornadaRaw || undefined) as
              | ValidJornada
              | undefined,
            fechaRetiro: fechaRetiroParsed,
            motivoRetiro: (motivoRaw || undefined) as
              | ValidMotivoRetiro
              | undefined,
            tenantId,
          },
          initialPilaAffiliation,
        });
      }
    }

    // Check cedulas against DB (batch, only if no earlier errors to avoid noise)
    if (errors.length === 0 && cedulasToCheck.length > 0) {
      const existing = await this.tenantPrisma.execute((prisma) =>
        prisma.empleado.findMany({
          where: {
            tenantId,
            cedula: { in: cedulasToCheck },
            deletedAt: null,
          },
          select: { cedula: true },
        }),
      );

      for (const emp of existing) {
        const fila = cedulasInFile.get(emp.cedula);
        errors.push({
          fila: fila ?? 0,
          campo: 'cedula',
          mensaje: `Ya existe un empleado activo con cédula "${emp.cedula}".`,
        });
      }
    }

    if (errors.length > 0) {
      throw new UnprocessableEntityException({ errors });
    }

    // Atomic import
    await this.tenantPrisma.execute(async (prisma) => {
      for (const row of validatedRows) {
        const employee = await prisma.empleado.create({ data: row.employee });
        if (row.initialPilaAffiliation) {
          const affiliation = await prisma.afiliacionSeguridadSocial.create({
            data: {
              ...row.initialPilaAffiliation,
              versionCaptura: SOCIAL_SECURITY_AFFILIATION_CAPTURE_VERSION,
              registradoPorId: userId,
              tenantId,
              empleadoId: employee.id,
            },
          });
          await this.auditService.log(
            {
              tenantId,
              userId,
              action: 'EMPLOYEE_SOCIAL_SECURITY_AFFILIATION_RECORDED',
              entityType: 'AfiliacionSeguridadSocial',
              entityId: affiliation.id,
              metadata: {
                empleadoId: employee.id,
                source: 'EMPLOYEE_XLSX_IMPORT',
                vigenteDesde: row.initialPilaAffiliation.vigenteDesde
                  .toISOString()
                  .slice(0, 10),
                vigenteHasta:
                  row.initialPilaAffiliation.vigenteHasta
                    ?.toISOString()
                    .slice(0, 10) ?? null,
                versionCaptura: SOCIAL_SECURITY_AFFILIATION_CAPTURE_VERSION,
                campos: Object.keys(row.initialPilaAffiliation),
              },
            },
            prisma,
          );
        }
      }
    });

    const affiliationsCreated = validatedRows.filter(
      (row) => row.initialPilaAffiliation,
    ).length;

    this.auditService
      .log({
        tenantId,
        userId,
        action: 'EMPLOYEE_BULK_IMPORT',
        entityType: 'Empleado',
        metadata: {
          importados: validatedRows.length,
          cedulas: validatedRows.map((r) => r.employee.cedula),
          afiliacionesPilaIniciales: affiliationsCreated,
        },
      })
      .catch(() => {});

    return {
      imported: validatedRows.length,
      message: `${validatedRows.length} empleado${validatedRows.length !== 1 ? 's' : ''} importado${validatedRows.length !== 1 ? 's' : ''} correctamente.${affiliationsCreated > 0 ? ` ${affiliationsCreated} afiliación${affiliationsCreated !== 1 ? 'es' : ''} PILA inicial${affiliationsCreated !== 1 ? 'es' : ''} capturada${affiliationsCreated !== 1 ? 's' : ''}.` : ''}`,
    };
  }
}
