import {
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import * as XLSX from 'xlsx';
import { AuditService } from '../audit/audit.service';
import { PilaWorkLocationsService } from '../employees/pila-work-locations.service';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import { PilaWorkLocationImportService } from './pila-work-location-import.service';

const TENANT_ID = 'tenant-a';
const USER_ID = 'user-a';
const HEADERS = [
  'cedula',
  'tipoDocumento',
  'municipioCodigo',
  'vigenteDesde',
  'vigenteHasta',
];

function workbookBuffer(rows: unknown[][], headers = HEADERS) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([headers, ...rows]),
    'Ubicaciones',
  );
  return Buffer.from(
    XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as ArrayBuffer,
  );
}

function inputRow(overrides: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = {
    cedula: '1001',
    tipoDocumento: 'CC',
    municipioCodigo: '08001',
    vigenteDesde: '2026-01-01',
    vigenteHasta: '',
    ...overrides,
  };
  return HEADERS.map((header) => values[header] ?? '');
}

describe('PilaWorkLocationImportService', () => {
  const employeeFindMany = jest.fn();
  const municipalityFindMany = jest.fn();
  const locationFindFirst = jest.fn();
  const employeeLock = jest.fn();
  const createInTransaction = jest.fn();
  const auditLog = jest.fn();
  const execute = jest.fn();
  const prisma = {
    empleado: { findMany: employeeFindMany },
    municipioDane: { findMany: municipalityFindMany },
    pilaUbicacionLaboral: { findFirst: locationFindFirst },
    $queryRaw: employeeLock,
  };
  let service: PilaWorkLocationImportService;

  beforeEach(() => {
    jest.clearAllMocks();
    employeeFindMany.mockResolvedValue([
      { id: 'employee-a', cedula: '1001', tipoDocumento: 'CC' },
    ]);
    municipalityFindMany.mockResolvedValue([
      { id: 'municipality-a', codigo: '08001' },
    ]);
    locationFindFirst.mockResolvedValue(null);
    employeeLock.mockResolvedValue([
      { id: 'employee-a', cedula: '1001', tipoDocumento: 'CC' },
    ]);
    createInTransaction.mockResolvedValue({ id: 'location-a' });
    auditLog.mockResolvedValue(undefined);
    execute.mockImplementation(
      (
        work: (client: typeof prisma, context: { tenantId: string }) => unknown,
      ) => work(prisma, { tenantId: TENANT_ID }),
    );
    service = new PilaWorkLocationImportService(
      { execute } as unknown as TenantPrismaService,
      { log: auditLog } as unknown as AuditService,
      { createInTransaction } as unknown as PilaWorkLocationsService,
    );
  });

  it('creates a separate template with exact DANE municipality and historical dates', () => {
    const workbook = XLSX.read(service.generateTemplate(), { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      defval: '',
    });

    expect(rows[0]).toEqual(HEADERS);
    expect(rows[1]).toHaveLength(HEADERS.length);
    expect(rows).toHaveLength(2);
    expect(rows[1]?.[2]).toContain('5 dígitos');
  });

  it('requires explicit employer confirmation before reading or writing the file', async () => {
    await expect(
      service.importFromBuffer(
        TENANT_ID,
        USER_ID,
        workbookBuffer([inputRow()]),
        undefined,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(execute).not.toHaveBeenCalled();
    expect(createInTransaction).not.toHaveBeenCalled();
  });

  it('imports one tenant-scoped location with confirmation and audit in one bounded transaction', async () => {
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
        '1 ubicación laboral PILA nueva registrada; 0 filas sin cambios.',
    });
    expect(employeeFindMany).toHaveBeenCalledWith({
      where: { tenantId: TENANT_ID, deletedAt: null, cedula: { in: ['1001'] } },
      select: { id: true, cedula: true, tipoDocumento: true },
    });
    expect(municipalityFindMany).toHaveBeenCalledWith({
      where: { codigo: { in: ['08001'] } },
      select: { id: true, codigo: true },
    });
    expect(createInTransaction).toHaveBeenCalledWith(
      prisma,
      TENANT_ID,
      USER_ID,
      'employee-a',
      {
        municipioId: 'municipality-a',
        vigenteDesde: '2026-01-01',
        vigenteHasta: null,
        confirmacionAportante: true,
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
        action: 'EMPLOYEE_PILA_WORK_LOCATION_BULK_IMPORT',
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

  it('treats an identical retry as unchanged', async () => {
    locationFindFirst.mockResolvedValue({ municipioId: 'municipality-a' });

    await expect(
      service.importFromBuffer(
        TENANT_ID,
        USER_ID,
        workbookBuffer([inputRow()]),
        'true',
      ),
    ).resolves.toMatchObject({ created: 0, unchanged: 1 });
    expect(createInTransaction).not.toHaveBeenCalled();
  });

  it('restores leading zeroes when Excel stores a DANE code as a number', async () => {
    await service.importFromBuffer(
      TENANT_ID,
      USER_ID,
      workbookBuffer([inputRow({ municipioCodigo: 8001 })]),
      'true',
    );

    expect(municipalityFindMany).toHaveBeenCalledWith({
      where: { codigo: { in: ['08001'] } },
      select: { id: true, codigo: true },
    });
    expect(createInTransaction).toHaveBeenCalledWith(
      prisma,
      TENANT_ID,
      USER_ID,
      'employee-a',
      expect.objectContaining({ municipioId: 'municipality-a' }),
    );
  });

  it('rejects invalid and duplicate rows before any write', async () => {
    employeeFindMany.mockResolvedValue([
      { id: 'employee-a', cedula: '1001', tipoDocumento: 'CC' },
    ]);
    municipalityFindMany.mockResolvedValue([]);

    await expect(
      service.importFromBuffer(
        TENANT_ID,
        USER_ID,
        workbookBuffer([
          inputRow({ municipioCodigo: '99999', vigenteDesde: '2026-02-30' }),
          inputRow(),
        ]),
        'true',
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(createInTransaction).not.toHaveBeenCalled();
  });

  it('does not resolve an employee outside the active tenant', async () => {
    employeeFindMany.mockResolvedValue([]);

    await expect(
      service.importFromBuffer(
        TENANT_ID,
        USER_ID,
        workbookBuffer([inputRow()]),
        'true',
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(createInTransaction).not.toHaveBeenCalled();
  });
});
