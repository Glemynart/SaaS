import {
  BadRequestException,
  HttpException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PilaWorkLocationsService } from '../employees/pila-work-locations.service';
import type { CreatePilaWorkLocationDto } from '../employees/dto/create-pila-work-location.dto';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import * as XLSX from 'xlsx';

const MAX_ROWS = 500;
const HEADERS = [
  'cedula',
  'tipoDocumento',
  'municipioCodigo',
  'vigenteDesde',
  'vigenteHasta',
] as const;
const HINTS = [
  'Requerido. Número exacto del documento de un empleado existente.',
  'Requerido. Debe coincidir con el tipo de documento registrado.',
  'Requerido. Código DANE de 5 dígitos. Si Excel lo guarda como número, se recuperan ceros iniciales.',
  'Requerido. Fecha YYYY-MM-DD o DD/MM/YYYY.',
  'Opcional. Fecha YYYY-MM-DD o DD/MM/YYYY.',
] as const;
const DOCUMENT_TYPES = [
  'CC',
  'CE',
  'TI',
  'PA',
  'NIT',
  'PEP',
  'PPT',
  'PC',
] as const;
type DocumentType = (typeof DOCUMENT_TYPES)[number];

export interface PilaWorkLocationImportError {
  fila: number;
  campo: string;
  mensaje: string;
}

class ImportRowValidationError extends Error {
  constructor(
    readonly campo: string,
    message: string,
  ) {
    super(message);
  }
}

interface InputRow {
  cedula?: unknown;
  tipoDocumento?: unknown;
  municipioCodigo?: unknown;
  vigenteDesde?: unknown;
  vigenteHasta?: unknown;
}

interface ValidatedRow {
  fila: number;
  employeeId: string;
  cedula: string;
  tipoDocumento: DocumentType;
  municipioCodigo: string;
  municipioId: string;
  vigenteDesde: Date;
  vigenteHasta: Date | null;
}

@Injectable()
export class PilaWorkLocationImportService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly auditService: AuditService,
    private readonly workLocations: PilaWorkLocationsService,
  ) {}

  generateTemplate(): Buffer {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([[...HEADERS], [...HINTS]]);
    worksheet['!freeze'] = {
      xSplit: 0,
      ySplit: 1,
      topLeftCell: 'A2',
      activePane: 'bottomLeft',
      state: 'frozen',
    };
    worksheet['!cols'] = [
      { wch: 20 },
      { wch: 18 },
      { wch: 22 },
      { wch: 20 },
      { wch: 20 },
    ];
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Ubicaciones PILA');
    return Buffer.from(
      XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as ArrayBuffer,
    );
  }

  async importFromBuffer(
    tenantId: string,
    userId: string,
    buffer: Buffer,
    confirmacionAportante: string | undefined,
  ): Promise<{ created: number; unchanged: number; message: string }> {
    if (confirmacionAportante !== 'true') {
      throw new BadRequestException(
        'Confirma que cada municipio corresponde al lugar donde el empleado ejecuta su actividad laboral para PILA.',
      );
    }

    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    } catch {
      throw new BadRequestException('No se pudo leer el archivo XLSX.');
    }
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new BadRequestException('El archivo Excel no contiene hojas.');
    }
    const worksheet = workbook.Sheets[sheetName];
    const [headerRow] = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      range: 0,
      defval: undefined,
      blankrows: false,
    });
    const headers = headerRow?.map((value) => toStringValue(value) ?? '') ?? [];
    const duplicateHeaders = headers.filter(
      (header, index) => header.length > 0 && headers.indexOf(header) !== index,
    );
    if (duplicateHeaders.length > 0) {
      throw new BadRequestException(
        `La plantilla contiene columnas repetidas: ${[...new Set(duplicateHeaders)].join(', ')}.`,
      );
    }
    const missingHeaders = HEADERS.filter(
      (header) => !headers.includes(header),
    );
    if (missingHeaders.length > 0) {
      throw new BadRequestException(
        `Faltan columnas obligatorias: ${missingHeaders.join(', ')}. Descarga la plantilla vigente.`,
      );
    }

    const rawRows = XLSX.utils.sheet_to_json<InputRow>(worksheet, {
      header: headers,
      range: 1,
      defval: undefined,
      blankrows: false,
    });
    const rows = rawRows.filter((row) => {
      const document = toStringValue(row.cedula);
      return !document?.startsWith('Requerido');
    });
    if (rows.length === 0) {
      throw new BadRequestException(
        'El archivo no contiene filas de ubicaciones laborales PILA.',
      );
    }
    if (rows.length > MAX_ROWS) {
      throw new BadRequestException(
        `El archivo contiene ${rows.length} filas. El máximo permitido es ${MAX_ROWS}.`,
      );
    }

    const errors: PilaWorkLocationImportError[] = [];
    const identityRows: Array<{
      fila: number;
      cedula: string;
      tipoDocumento: DocumentType;
      row: InputRow;
    }> = [];
    const firstRowByDocument = new Map<string, number>();
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const fila = index + 2;
      const cedula = toStringValue(row.cedula);
      const tipoDocumento = toStringValue(row.tipoDocumento)?.toUpperCase();
      if (!cedula) {
        errors.push({
          fila,
          campo: 'cedula',
          mensaje: 'El número de documento es requerido.',
        });
      }
      if (
        !tipoDocumento ||
        !DOCUMENT_TYPES.includes(tipoDocumento as DocumentType)
      ) {
        errors.push({
          fila,
          campo: 'tipoDocumento',
          mensaje: `Tipo de documento inválido. Valores admitidos: ${DOCUMENT_TYPES.join(', ')}.`,
        });
      }
      if (
        !cedula ||
        !tipoDocumento ||
        !DOCUMENT_TYPES.includes(tipoDocumento as DocumentType)
      ) {
        continue;
      }
      const firstRow = firstRowByDocument.get(cedula);
      if (firstRow !== undefined) {
        errors.push({
          fila,
          campo: 'cedula',
          mensaje: `El empleado está repetido en el archivo (primera aparición en fila ${firstRow}).`,
        });
        continue;
      }
      firstRowByDocument.set(cedula, fila);
      identityRows.push({
        fila,
        cedula,
        tipoDocumento: tipoDocumento as DocumentType,
        row,
      });
    }

    const [employees, municipalities] = await this.tenantPrisma.execute(
      async (prisma) => {
        const documents = identityRows.map(({ cedula }) => cedula);
        const codes = identityRows
          .map(({ row }) => parseMunicipalityCode(row.municipioCodigo))
          .filter((code): code is string => Boolean(code));
        return Promise.all([
          documents.length === 0
            ? []
            : prisma.empleado.findMany({
                where: {
                  tenantId,
                  deletedAt: null,
                  cedula: { in: documents },
                },
                select: { id: true, cedula: true, tipoDocumento: true },
              }),
          codes.length === 0
            ? []
            : prisma.municipioDane.findMany({
                where: { codigo: { in: codes } },
                select: { id: true, codigo: true },
              }),
        ]);
      },
    );
    const employeeByDocument = new Map(
      employees.map((employee) => [employee.cedula, employee]),
    );
    const municipalityByCode = new Map(
      municipalities.map((municipality) => [municipality.codigo, municipality]),
    );

    const validatedRows: ValidatedRow[] = [];
    for (const identity of identityRows) {
      const employee = employeeByDocument.get(identity.cedula);
      if (!employee) {
        errors.push({
          fila: identity.fila,
          campo: 'cedula',
          mensaje:
            'No existe un empleado activo con este número de documento en la empresa actual.',
        });
        continue;
      }
      if (employee.tipoDocumento !== identity.tipoDocumento) {
        errors.push({
          fila: identity.fila,
          campo: 'tipoDocumento',
          mensaje:
            'El tipo de documento no coincide con el empleado registrado.',
        });
        continue;
      }

      const municipioCodigo = parseMunicipalityCode(
        identity.row.municipioCodigo,
      );
      const municipality = municipioCodigo
        ? municipalityByCode.get(municipioCodigo)
        : undefined;
      if (!municipioCodigo || !/^\d{5}$/.test(municipioCodigo)) {
        errors.push({
          fila: identity.fila,
          campo: 'municipioCodigo',
          mensaje: 'Ingresa un código DANE de 5 dígitos.',
        });
      } else if (!municipality) {
        errors.push({
          fila: identity.fila,
          campo: 'municipioCodigo',
          mensaje: 'El código DANE no existe en el catálogo de municipios.',
        });
      }

      const start = parseDate(identity.row.vigenteDesde);
      const end = parseDate(identity.row.vigenteHasta);
      if (!start) {
        errors.push({
          fila: identity.fila,
          campo: 'vigenteDesde',
          mensaje:
            'Ingresa una fecha inicial válida (YYYY-MM-DD o DD/MM/YYYY).',
        });
      }
      if (hasValue(identity.row.vigenteHasta) && !end) {
        errors.push({
          fila: identity.fila,
          campo: 'vigenteHasta',
          mensaje: 'Ingresa una fecha final válida (YYYY-MM-DD o DD/MM/YYYY).',
        });
      }
      if (start && end && end < start) {
        errors.push({
          fila: identity.fila,
          campo: 'vigenteHasta',
          mensaje: 'La fecha final no puede ser anterior a la fecha inicial.',
        });
      }
      if (
        start &&
        municipality &&
        municipioCodigo &&
        (!hasValue(identity.row.vigenteHasta) || end) &&
        (!end || end >= start)
      ) {
        validatedRows.push({
          fila: identity.fila,
          employeeId: employee.id,
          cedula: identity.cedula,
          tipoDocumento: identity.tipoDocumento,
          municipioCodigo,
          municipioId: municipality.id,
          vigenteDesde: toUtcDate(start),
          vigenteHasta: end ? toUtcDate(end) : null,
        });
      }
    }
    if (errors.length > 0) {
      throw new UnprocessableEntityException({ errors });
    }

    const orderedRows = [...validatedRows].sort((a, b) =>
      a.employeeId.localeCompare(b.employeeId),
    );
    const result = await this.tenantPrisma.execute(
      async (prisma, { tenantId: activeTenantId }) => {
        let created = 0;
        let unchanged = 0;
        for (const row of orderedRows) {
          try {
            const locked = await prisma.$queryRaw<
              Array<{ id: string; cedula: string; tipoDocumento: string }>
            >`
              SELECT "id", "cedula", "tipoDocumento" FROM "empleados"
              WHERE "id" = ${row.employeeId}
                AND "tenantId" = ${activeTenantId}
                AND "deletedAt" IS NULL
              FOR UPDATE
            `;
            if (locked.length === 0) {
              throw new ImportRowValidationError(
                'cedula',
                'El empleado dejó de estar disponible durante la importación.',
              );
            }
            if (locked[0].cedula !== row.cedula) {
              throw new ImportRowValidationError(
                'cedula',
                'El número de documento cambió durante la importación.',
              );
            }
            if (locked[0].tipoDocumento !== row.tipoDocumento) {
              throw new ImportRowValidationError(
                'tipoDocumento',
                'El tipo de documento cambió durante la importación.',
              );
            }
            const existing = await prisma.pilaUbicacionLaboral.findFirst({
              where: {
                tenantId: activeTenantId,
                empleadoId: row.employeeId,
                vigenteDesde: row.vigenteDesde,
                vigenteHasta: row.vigenteHasta,
              },
              select: { municipioId: true },
            });
            if (existing?.municipioId === row.municipioId) {
              unchanged += 1;
              continue;
            }

            await this.workLocations.createInTransaction(
              prisma,
              activeTenantId,
              userId,
              row.employeeId,
              {
                municipioId: row.municipioId,
                vigenteDesde: formatDate(row.vigenteDesde),
                vigenteHasta: row.vigenteHasta
                  ? formatDate(row.vigenteHasta)
                  : null,
                confirmacionAportante: true,
              } satisfies CreatePilaWorkLocationDto,
            );
            created += 1;
          } catch (error) {
            if (error instanceof ImportRowValidationError) {
              throw new UnprocessableEntityException({
                errors: [
                  {
                    fila: row.fila,
                    campo: error.campo,
                    mensaje: error.message,
                  },
                ],
              });
            }
            if (!(error instanceof HttpException)) throw error;
            throw new UnprocessableEntityException({
              errors: [
                {
                  fila: row.fila,
                  campo: 'vigencia',
                  mensaje: getHttpExceptionMessage(error),
                },
              ],
            });
          }
        }

        await this.auditService.log(
          {
            tenantId: activeTenantId,
            userId,
            action: 'EMPLOYEE_PILA_WORK_LOCATION_BULK_IMPORT',
            entityType: 'PilaUbicacionLaboral',
            metadata: {
              filas: validatedRows.length,
              creadas: created,
              sinCambios: unchanged,
              confirmacionAportante: true,
            },
          },
          prisma,
        );
        return { created, unchanged };
      },
      { maxWait: 10_000, timeout: 30_000 },
    );

    return {
      ...result,
      message: `${result.created} ${result.created === 1 ? 'ubicación laboral PILA nueva registrada' : 'ubicaciones laborales PILA nuevas registradas'}; ${result.unchanged} fila${result.unchanged === 1 ? '' : 's'} sin cambios.`,
    };
  }
}

function toStringValue(value: unknown): string | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value.toString().trim();
  }
  return undefined;
}

function hasValue(value: unknown) {
  return value !== undefined && value !== null && value !== '';
}

function parseMunicipalityCode(value: unknown): string | undefined {
  if (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 99_999
  ) {
    return value.toString().padStart(5, '0');
  }
  return toStringValue(value);
}

function parseDate(value: unknown): string | undefined {
  if (!hasValue(value)) return undefined;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? undefined
      : value.toISOString().slice(0, 10);
  }
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const raw = value.toString().trim();
  let normalized = raw;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [day, month, year] = raw.split('/');
    normalized = `${year}-${month}-${day}`;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return undefined;
  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== normalized
    ? undefined
    : normalized;
}

function toUtcDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function getHttpExceptionMessage(error: HttpException): string {
  const response = error.getResponse();
  if (typeof response === 'string') return response;
  if (
    typeof response === 'object' &&
    response !== null &&
    'message' in response
  ) {
    const message = response.message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) return message.join('; ');
  }
  return error.message;
}
