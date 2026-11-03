import {
  BadRequestException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import * as XLSX from 'xlsx';
import { AuditService } from '../audit/audit.service';
import { PilaWorkCentersService } from '../employees/pila-work-centers.service';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import { PilaWorkAssignmentImportService } from './pila-work-assignment-import.service';

const TENANT_ID = 'tenant-a';
const USER_ID = 'user-a';
const HEADERS = [
  'cedula',
  'tipoDocumento',
  'arlCodigo',
  'codigoCentro',
  'codigoActividadEconomica',
  'vigenteDesde',
  'vigenteHasta',
];

function workbookBuffer(rows: unknown[][], headers = HEADERS) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([headers, ...rows]),
    'Asignaciones',
  );
  return Buffer.from(
    XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as ArrayBuffer,
  );
}

function inputRow(overrides: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = {
    cedula: '1001',
    tipoDocumento: 'CC',
    arlCodigo: 'ARL001',
    codigoCentro: 'CENTRO-01',
    codigoActividadEconomica: '1131202',
    vigenteDesde: '2026-01-01',
    vigenteHasta: '',
    ...overrides,
  };
  return HEADERS.map((header) => values[header] ?? '');
}

describe('PilaWorkAssignmentImportService', () => {
  const employeeFindMany = jest.fn();
  const centerFindMany = jest.fn();
  const assignmentFindFirst = jest.fn();
  const employeeLock = jest.fn();
  const validateAssignmentInTransaction = jest.fn();
  const createAssignmentInTransaction = jest.fn();
  const auditLog = jest.fn();
  const execute = jest.fn();
  const prisma = {
    empleado: { findMany: employeeFindMany },
    pilaCentroTrabajo: { findMany: centerFindMany },
    pilaAsignacionCentroTrabajo: { findFirst: assignmentFindFirst },
    $queryRaw: employeeLock,
  };
  let service: PilaWorkAssignmentImportService;

  beforeEach(() => {
    jest.clearAllMocks();
    employeeFindMany.mockResolvedValue([
      { id: 'employee-a', cedula: '1001', tipoDocumento: 'CC' },
    ]);
    centerFindMany.mockResolvedValue([
      { id: 'center-a', arlCodigo: 'ARL001', codigoCentro: 'CENTRO-01' },
    ]);
    assignmentFindFirst.mockResolvedValue(null);
    employeeLock.mockResolvedValue([
      { id: 'employee-a', cedula: '1001', tipoDocumento: 'CC' },
    ]);
    validateAssignmentInTransaction.mockResolvedValue(undefined);
    createAssignmentInTransaction.mockResolvedValue({ id: 'assignment-a' });
    auditLog.mockResolvedValue(undefined);
    execute.mockImplementation(
      (
        work: (client: typeof prisma, context: { tenantId: string }) => unknown,
      ) => work(prisma, { tenantId: TENANT_ID }),
    );
    service = new PilaWorkAssignmentImportService(
      { execute } as unknown as TenantPrismaService,
      { log: auditLog } as unknown as AuditService,
      {
        validateAssignmentInTransaction,
        createAssignmentInTransaction,
      } as unknown as PilaWorkCentersService,
    );
  });

  it('creates a separate template with the fields needed to identify a registered center', () => {
    const workbook = XLSX.read(service.generateTemplate(), { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      defval: '',
    });

    expect(rows[0]).toEqual(HEADERS);
    expect(rows[1]).toHaveLength(HEADERS.length);
    expect(rows[1]?.[3]).toContain('ya registrado');
  });

  it('requires confirmation before reading or writing the file', async () => {
    await expect(
      service.importFromBuffer(
        TENANT_ID,
        USER_ID,
        workbookBuffer([inputRow()]),
        undefined,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(execute).not.toHaveBeenCalled();
    expect(createAssignmentInTransaction).not.toHaveBeenCalled();
  });

  it('imports a tenant-scoped assignment with confirmation and audit in one bounded transaction', async () => {
    await expect(
      service.importFromBuffer(
        TENANT_ID,
        USER_ID,
        workbookBuffer([inputRow()]),
        'true',
      ),
    ).resolves.toEqual({
      created: 1,
      unchanged: 0,
      message:
        '1 asignación de centro y actividad PILA nueva registrada; 0 filas sin cambios.',
    });
    expect(centerFindMany).toHaveBeenCalledWith({
      where: {
        tenantId: TENANT_ID,
        activo: true,
        OR: [{ arlCodigo: 'ARL001', codigoCentro: 'CENTRO-01' }],
      },
      select: { id: true, arlCodigo: true, codigoCentro: true },
    });
    expect(createAssignmentInTransaction).toHaveBeenCalledWith(
      prisma,
      TENANT_ID,
      USER_ID,
      'employee-a',
      {
        centroTrabajoId: 'center-a',
        codigoActividadEconomica: '1131202',
        vigenteDesde: '2026-01-01',
        vigenteHasta: null,
      },
    );
    expect(validateAssignmentInTransaction).toHaveBeenCalledWith(
      prisma,
      TENANT_ID,
      'employee-a',
      {
        centroTrabajoId: 'center-a',
        codigoActividadEconomica: '1131202',
        vigenteDesde: '2026-01-01',
        vigenteHasta: null,
      },
    );
    expect(execute).toHaveBeenNthCalledWith(2, expect.any(Function), {
      maxWait: 10_000,
      timeout: 30_000,
    });
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT_ID,
        userId: USER_ID,
        action: 'EMPLOYEE_PILA_WORK_ASSIGNMENT_BULK_IMPORT',
        metadata: {
          filas: 1,
          creadas: 1,
          sinCambios: 0,
          confirmacionAportante: true,
        },
      }),
      prisma,
    );
  });

  it('treats an exact retry as unchanged and does not create or audit a row', async () => {
    assignmentFindFirst.mockResolvedValue({ id: 'assignment-a' });

    await expect(
      service.importFromBuffer(
        TENANT_ID,
        USER_ID,
        workbookBuffer([inputRow()]),
        'true',
      ),
    ).resolves.toMatchObject({ created: 0, unchanged: 1 });
    expect(createAssignmentInTransaction).not.toHaveBeenCalled();
    expect(validateAssignmentInTransaction).not.toHaveBeenCalled();
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'EMPLOYEE_PILA_WORK_ASSIGNMENT_BULK_IMPORT',
        metadata: {
          filas: 1,
          creadas: 0,
          sinCambios: 1,
          confirmacionAportante: true,
        },
      }),
      prisma,
    );
  });

  it('rejects invalid catalog codes and duplicate employees before any write', async () => {
    await expect(
      service.importFromBuffer(
        TENANT_ID,
        USER_ID,
        workbookBuffer([
          inputRow({ codigoActividadEconomica: '9999999' }),
          inputRow(),
        ]),
        'true',
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(createAssignmentInTransaction).not.toHaveBeenCalled();
  });

  it('reports the physical Excel row when blank rows are present', async () => {
    const invalidRow = inputRow({ tipoDocumento: 'INVALID' });

    await expect(
      service.importFromBuffer(
        TENANT_ID,
        USER_ID,
        workbookBuffer([inputRow(), [], invalidRow]),
        'true',
      ),
    ).rejects.toMatchObject({
      response: {
        errors: [expect.objectContaining({ fila: 4, campo: 'tipoDocumento' })],
      },
    });
    expect(createAssignmentInTransaction).not.toHaveBeenCalled();
  });

  it('does not resolve an employee outside the active tenant or create an unregistered center', async () => {
    employeeFindMany.mockResolvedValue([]);
    centerFindMany.mockResolvedValue([]);

    await expect(
      service.importFromBuffer(
        TENANT_ID,
        USER_ID,
        workbookBuffer([inputRow()]),
        'true',
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(createAssignmentInTransaction).not.toHaveBeenCalled();
  });

  it('rejects a business conflict from the assignment service and does not write aggregate audit', async () => {
    validateAssignmentInTransaction.mockRejectedValue(
      new ConflictException(
        'La vigencia se cruza con otra asignación de centro/actividad del empleado.',
      ),
    );

    await expect(
      service.importFromBuffer(
        TENANT_ID,
        USER_ID,
        workbookBuffer([inputRow()]),
        'true',
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(createAssignmentInTransaction).not.toHaveBeenCalled();
    expect(auditLog).not.toHaveBeenCalled();
  });
});
