import {
  BadRequestException,
  HttpException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PilaWorkCentersService } from '../employees/pila-work-centers.service';
import type { CreatePilaWorkAssignmentDto } from '../employees/dto/create-pila-work-assignment.dto';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import { PILA_RISK_ACTIVITY_CODES } from '../payroll/pila-risk-activity-catalog';
import * as XLSX from 'xlsx';

const MAX_ROWS = 500;
const HEADERS = [
  'cedula',
  'tipoDocumento',
  'arlCodigo',
  'codigoCentro',
  'codigoActividadEconomica',
  'vigenteDesde',
  'vigenteHasta',
] as const;
const HINTS = [
  'Requerido. Número exacto del documento; conserva el formato texto.',
  'Requerido. Debe coincidir con el tipo registrado. CC, CE, TI, PA, NIT, PEP, PPT o PC.',
  'Requerido. Código de ARL del centro ya registrado en esta empresa.',
  'Requerido. Código del centro exactamente como está ya registrado para esa ARL.',
  'Requerido. Código de 7 dígitos del catálogo versionado del Decreto 768 de 2022.',
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

export interface PilaWorkAssignmentImportError {
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
  arlCodigo?: unknown;
  codigoCentro?: unknown;
  codigoActividadEconomica?: unknown;
  vigenteDesde?: unknown;
  vigenteHasta?: unknown;
}

interface ValidatedRow {
  fila: number;
  employeeId: string;
  cedula: string;
  tipoDocumento: DocumentType;
  arlCodigo: string;
  codigoCentro: string;
  centroTrabajoId: string;
  codigoActividadEconomica: string;
  vigenteDesde: Date;
  vigenteHasta: Date | null;
}

@Injectable()
export class PilaWorkAssignmentImportService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly auditService: AuditService,
    private readonly workCenters: PilaWorkCentersService,
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
      { wch: 16 },
      { wch: 22 },
      { wch: 28 },
      { wch: 20 },
      { wch: 20 },
    ];
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Asignaciones ARL PILA');
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
        'Confirma que cada centro y actividad fueron verificados con la ARL para el empleado y la vigencia indicada.',
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
      blankrows: true,
    });
    const rows = rawRows
      .map((row, index) => ({ row, fila: index + 2 }))
      .filter(({ row }) => {
        const hasInput = HEADERS.some((header) => hasValue(row[header]));
        const document = toStringValue(row.cedula);
        return hasInput && !document?.startsWith('Requerido');
      });
    if (rows.length === 0) {
      throw new BadRequestException(
        'El archivo no contiene filas de asignaciones de centro y actividad PILA.',
      );
    }
    if (rows.length > MAX_ROWS) {
      throw new BadRequestException(
        `El archivo contiene ${rows.length} filas. El máximo permitido es ${MAX_ROWS}.`,
      );
    }

    const errors: PilaWorkAssignmentImportError[] = [];
    const identityRows: Array<{
      fila: number;
      cedula: string;
      tipoDocumento: DocumentType;
      row: InputRow;
    }> = [];
    const firstRowByDocument = new Map<string, number>();
    for (const { row, fila } of rows) {
      const cedula = toStringValue(row.cedula);
      const tipoDocumento = toStringValue(row.tipoDocumento)?.toUpperCase();
      if (!cedula) {
        errors.push({
          fila,
          campo: 'cedula',
          mensaje: 'El documento es requerido.',
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

    const identities = identityRows.map(({ row }) => ({
      arlCodigo: normalizeCode(row.arlCodigo),
      codigoCentro: normalizeCode(row.codigoCentro),
    }));
    const [employees, centers] = await this.tenantPrisma.execute((prisma) =>
      Promise.all([
        identityRows.length === 0
          ? []
          : prisma.empleado.findMany({
              where: {
                tenantId,
                deletedAt: null,
                cedula: { in: identityRows.map(({ cedula }) => cedula) },
              },
              select: { id: true, cedula: true, tipoDocumento: true },
            }),
        prisma.pilaCentroTrabajo.findMany({
          where: {
            tenantId,
            activo: true,
            OR: identities
              .filter(
                ({ arlCodigo, codigoCentro }) => arlCodigo && codigoCentro,
              )
              .map(({ arlCodigo, codigoCentro }) => ({
                arlCodigo,
                codigoCentro,
              })),
          },
          select: { id: true, arlCodigo: true, codigoCentro: true },
        }),
      ]),
    );
    const employeeByDocument = new Map(
      employees.map((employee) => [employee.cedula, employee]),
    );
    const centerByCode = new Map(
      centers.map((center) => [
        centerKey(center.arlCodigo, center.codigoCentro),
        center,
      ]),
    );

    const validatedRows: ValidatedRow[] = [];
    for (const identity of identityRows) {
      const employee = employeeByDocument.get(identity.cedula);
      if (!employee) {
        errors.push({
          fila: identity.fila,
          campo: 'cedula',
          mensaje:
            'No existe un empleado activo con este documento en la empresa actual.',
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

      const arlCodigo = normalizeCode(identity.row.arlCodigo);
      const codigoCentro = normalizeCode(identity.row.codigoCentro);
      const center =
        arlCodigo && codigoCentro
          ? centerByCode.get(centerKey(arlCodigo, codigoCentro))
          : undefined;
      if (!arlCodigo) {
        errors.push({
          fila: identity.fila,
          campo: 'arlCodigo',
          mensaje: 'El código ARL es requerido.',
        });
      }
      if (!codigoCentro) {
        errors.push({
          fila: identity.fila,
          campo: 'codigoCentro',
          mensaje: 'El código del centro es requerido.',
        });
      } else if (arlCodigo && !center) {
        errors.push({
          fila: identity.fila,
          campo: 'codigoCentro',
          mensaje:
            'El centro activo no existe para esa ARL en la empresa actual.',
        });
      }

      const codigoActividadEconomica = toStringValue(
        identity.row.codigoActividadEconomica,
      );
      if (!codigoActividadEconomica) {
        errors.push({
          fila: identity.fila,
          campo: 'codigoActividadEconomica',
          mensaje: 'El código de actividad económica es requerido.',
        });
      } else if (!PILA_RISK_ACTIVITY_CODES.has(codigoActividadEconomica)) {
        errors.push({
          fila: identity.fila,
          campo: 'codigoActividadEconomica',
          mensaje:
            'El código no pertenece al catálogo versionado del Decreto 768 de 2022.',
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
        center &&
        codigoActividadEconomica &&
        PILA_RISK_ACTIVITY_CODES.has(codigoActividadEconomica) &&
        start &&
        (!hasValue(identity.row.vigenteHasta) || end) &&
        (!end || end >= start)
      ) {
        validatedRows.push({
          fila: identity.fila,
          employeeId: employee.id,
          cedula: identity.cedula,
          tipoDocumento: identity.tipoDocumento,
          arlCodigo: center.arlCodigo,
          codigoCentro: center.codigoCentro,
          centroTrabajoId: center.id,
          codigoActividadEconomica,
          vigenteDesde: toUtcDate(start),
          vigenteHasta: end ? toUtcDate(end) : null,
        });
      }
    }
    if (errors.length > 0) {
      throw new UnprocessableEntityException({ errors });
    }

    const orderedRows = [...validatedRows].sort((left, right) =>
      left.employeeId.localeCompare(right.employeeId),
    );
    const result = await this.tenantPrisma.execute(
      async (prisma, { tenantId: activeTenantId }) => {
        let created = 0;
        let unchanged = 0;
        const rowsToCreate: ValidatedRow[] = [];
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
            if (
              locked[0].cedula !== row.cedula ||
              locked[0].tipoDocumento !== row.tipoDocumento
            ) {
              throw new ImportRowValidationError(
                'cedula',
                'La identidad del empleado cambió durante la importación.',
              );
            }
            const existing = await prisma.pilaAsignacionCentroTrabajo.findFirst(
              {
                where: {
                  tenantId: activeTenantId,
                  empleadoId: row.employeeId,
                  centroTrabajoId: row.centroTrabajoId,
                  codigoActividadEconomica: row.codigoActividadEconomica,
                  vigenteDesde: row.vigenteDesde,
                  vigenteHasta: row.vigenteHasta,
                },
                select: { id: true },
              },
            );
            if (existing) {
              unchanged += 1;
              continue;
            }
            const assignmentDto = {
              centroTrabajoId: row.centroTrabajoId,
              codigoActividadEconomica: row.codigoActividadEconomica,
              vigenteDesde: formatDate(row.vigenteDesde),
              vigenteHasta: row.vigenteHasta
                ? formatDate(row.vigenteHasta)
                : null,
            } satisfies CreatePilaWorkAssignmentDto;
            await this.workCenters.validateAssignmentInTransaction(
              prisma,
              activeTenantId,
              row.employeeId,
              assignmentDto,
            );
            rowsToCreate.push(row);
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
            const message = getHttpExceptionMessage(error);
            const campo = message.toLowerCase().includes('arl')
              ? 'arlCodigo/codigoActividadEconomica'
              : message.toLowerCase().includes('centro')
                ? 'codigoCentro'
                : 'vigencia';
            throw new UnprocessableEntityException({
              errors: [{ fila: row.fila, campo, mensaje: message }],
            });
          }
        }

        for (const row of rowsToCreate) {
          try {
            await this.workCenters.createAssignmentInTransaction(
              prisma,
              activeTenantId,
              userId,
              row.employeeId,
              {
                centroTrabajoId: row.centroTrabajoId,
                codigoActividadEconomica: row.codigoActividadEconomica,
                vigenteDesde: formatDate(row.vigenteDesde),
                vigenteHasta: row.vigenteHasta
                  ? formatDate(row.vigenteHasta)
                  : null,
              } satisfies CreatePilaWorkAssignmentDto,
            );
            created += 1;
          } catch (error) {
            if (!(error instanceof HttpException)) throw error;
            const message = getHttpExceptionMessage(error);
            const campo = message.toLowerCase().includes('arl')
              ? 'arlCodigo/codigoActividadEconomica'
              : message.toLowerCase().includes('centro')
                ? 'codigoCentro'
                : 'vigencia';
            throw new UnprocessableEntityException({
              errors: [{ fila: row.fila, campo, mensaje: message }],
            });
          }
        }

        await this.auditService.log(
          {
            tenantId: activeTenantId,
            userId,
            action: 'EMPLOYEE_PILA_WORK_ASSIGNMENT_BULK_IMPORT',
            entityType: 'PilaAsignacionCentroTrabajo',
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
      message: `${result.created} ${result.created === 1 ? 'asignación de centro y actividad PILA nueva registrada' : 'asignaciones de centro y actividad PILA nuevas registradas'}; ${result.unchanged} fila${result.unchanged === 1 ? '' : 's'} sin cambios.`,
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

function normalizeCode(value: unknown): string | undefined {
  return toStringValue(value)?.toUpperCase();
}

function centerKey(arlCodigo: string, codigoCentro: string) {
  return `${arlCodigo}\u0000${codigoCentro}`;
}

function hasValue(value: unknown) {
  return value !== undefined && value !== null && value !== '';
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
