import {
  Injectable,
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
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
  salarioIntegral?: unknown;
  jornadaLaboral?: unknown;
  fechaRetiro?: unknown;
  motivoRetiro?: unknown;
}

function str(val: unknown): string | undefined {
  if (val === undefined || val === null || val === '') return undefined;
  return String(val).trim();
}

function parseDate(val: unknown): string | undefined {
  if (val === undefined || val === null || val === '') return undefined;
  // SheetJS with cellDates:true returns JS Date
  if (val instanceof Date) {
    return val.toISOString().split('T')[0];
  }
  const s = String(val).trim();
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
  'salarioIntegral',
  'jornadaLaboral',
  'fechaRetiro',
  'motivoRetiro',
];

const TEMPLATE_HINTS = [
  'Requerido. Número de documento.',
  'Requerido. CC | CE | TI | PA | NIT | PEP | PPT',
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
  'Opcional. Nombre exacto de la sede (ej: Sede Principal).',
  'Opcional. Área o departamento.',
  'Opcional. TRUE o FALSE. Por defecto: FALSE',
  'Opcional. COMPLETA | MEDIA | POR_HORAS',
  'Opcional. Formato YYYY-MM-DD.',
  'Opcional. RENUNCIA | TERMINACION_CONTRATO | MUTUO_ACUERDO | JUSTA_CAUSA | FALLECIMIENTO | OTRO',
];

@Injectable()
export class EmployeeImportService {
  constructor(
    private prisma: PrismaService,
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
        'Primaria',
        'FALSE',
        'COMPLETA',
        '',
        '',
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
    const rows = XLSX.utils.sheet_to_json<RawRow>(ws, {
      header: TEMPLATE_HEADERS,
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
      const sedes = await this.prisma.sede.findMany({
        where: {
          tenantId,
          activo: true,
          nombre: { in: Array.from(sedeNamesInFile), mode: 'insensitive' },
        },
        select: { id: true, nombre: true },
      });
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
      sedeId?: string;
      dependencia?: string;
      salarioIntegral?: boolean;
      jornadaLaboral?: ValidJornada;
      fechaRetiro?: Date;
      motivoRetiro?: ValidMotivoRetiro;
      tenantId: string;
    };

    const validatedRows: EmployeeCreateData[] = [];

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
      }

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

      // sede (optional, resolve by name)
      const sedeName = str(row.sede);
      let resolvedSedeId: string | undefined;
      if (sedeName) {
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
        !errors.find((e) => e.fila === fila)
      ) {
        validatedRows.push({
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
          salarioIntegral: parseBool(row.salarioIntegral),
          jornadaLaboral: (jornadaRaw || undefined) as ValidJornada | undefined,
          fechaRetiro: fechaRetiroParsed,
          motivoRetiro: (motivoRaw || undefined) as
            | ValidMotivoRetiro
            | undefined,
          tenantId,
        });
      }
    }

    // Check cedulas against DB (batch, only if no earlier errors to avoid noise)
    if (errors.length === 0 && cedulasToCheck.length > 0) {
      const existing = await this.prisma.empleado.findMany({
        where: {
          tenantId,
          cedula: { in: cedulasToCheck },
          deletedAt: null,
        },
        select: { cedula: true },
      });

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
    await this.prisma.$transaction(
      validatedRows.map((data) => this.prisma.empleado.create({ data })),
    );

    this.auditService
      .log({
        tenantId,
        userId,
        action: 'EMPLOYEE_BULK_IMPORT',
        entityType: 'Empleado',
        metadata: {
          importados: validatedRows.length,
          cedulas: validatedRows.map((r) => r.cedula),
        },
      })
      .catch(() => {});

    return {
      imported: validatedRows.length,
      message: `${validatedRows.length} empleado${validatedRows.length !== 1 ? 's' : ''} importado${validatedRows.length !== 1 ? 's' : ''} correctamente.`,
    };
  }
}
