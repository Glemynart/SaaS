import { UnprocessableEntityException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { AuditService } from '../audit/audit.service';
import { SocialSecurityAffiliationsService } from '../employees/social-security-affiliations.service';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import { EmployeeImportService } from './employee-import.service';

const TENANT_ID = 'tenant-a';
const USER_ID = 'user-a';
const HEADERS = [
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
];
const PILA_HEADERS = [
  'tipoCotizanteCodigo',
  'subtipoCotizanteCodigo',
  'epsCodigo',
  'epsNombre',
  'fondoPensionCodigo',
  'fondoPensionNombre',
  'estadoAfiliacionPensional',
  'indicadorTarifaEspecialPensiones',
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
const PILA_BULK_HEADERS = ['cedula', 'tipoDocumento', ...PILA_HEADERS];

function workbookBuffer(rows: unknown[][], headers = HEADERS) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Empleados');
  return Buffer.from(
    XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as ArrayBuffer,
  );
}

function pilaImportRow(overrides: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = {
    cedula: '1005',
    tipoDocumento: 'CC',
    primerNombre: 'Ana',
    segundoNombre: '',
    primerApellido: 'Gómez',
    segundoApellido: '',
    email: 'ana@example.test',
    telefono: '',
    cargo: 'Docente',
    salario: 2500000,
    tipoContrato: 'TERMINO_FIJO',
    fechaIngreso: '2026-01-01',
    estado: 'ACTIVO',
    sede: 'Sede Principal',
    dependencia: '',
    tipoSalarioPila: 'F',
    jornadaLaboral: 'COMPLETA',
    fechaRetiro: '',
    motivoRetiro: '',
    tipoCotizanteCodigo: '01',
    subtipoCotizanteCodigo: '00',
    epsCodigo: 'EPS001',
    epsNombre: 'EPS de prueba',
    fondoPensionCodigo: 'AFP001',
    fondoPensionNombre: 'Fondo de prueba',
    indicadorTarifaEspecialPensiones: 'NORMAL',
    arlCodigo: 'ARL001',
    arlNombre: 'ARL de prueba',
    arlClaseRiesgo: '1',
    cajaCompensacionCodigo: 'CCF001',
    cajaCompensacionNombre: 'Caja de prueba',
    cajaCompensacionDepartamentoCodigo: '08',
    extranjeroNoObligadoPension: '',
    colombianoEnElExterior: 'NO',
    afiliacionVigenteDesde: '2026-01-01',
    afiliacionVigenteHasta: '',
    ...overrides,
  };
  return [...HEADERS, ...PILA_HEADERS].map((header) => values[header] ?? '');
}

function pilaBulkAffiliationRow(
  overrides: Record<string, unknown> = {},
  headers = PILA_BULK_HEADERS,
) {
  const values: Record<string, unknown> = {
    cedula: '1001',
    tipoDocumento: 'CC',
    tipoCotizanteCodigo: '01',
    subtipoCotizanteCodigo: '00',
    epsCodigo: 'EPS001',
    epsNombre: 'EPS de prueba',
    fondoPensionCodigo: 'AFP001',
    fondoPensionNombre: 'Fondo de prueba',
    estadoAfiliacionPensional: '',
    indicadorTarifaEspecialPensiones: 'NORMAL',
    arlCodigo: 'ARL001',
    arlNombre: 'ARL de prueba',
    arlClaseRiesgo: '1',
    cajaCompensacionCodigo: 'CCF001',
    cajaCompensacionNombre: 'Caja de prueba',
    cajaCompensacionDepartamentoCodigo: '08',
    extranjeroNoObligadoPension: '',
    colombianoEnElExterior: 'NO',
    afiliacionVigenteDesde: '2026-01-01',
    afiliacionVigenteHasta: '',
    ...overrides,
  };
  return headers.map((header) => values[header] ?? '');
}

function importErrors(error: unknown): Array<{ campo: string; fila: number }> {
  if (!(error instanceof UnprocessableEntityException)) return [];

  const response = error.getResponse();
  if (
    typeof response !== 'object' ||
    response === null ||
    !('errors' in response) ||
    !Array.isArray(response.errors)
  ) {
    return [];
  }

  return response.errors as Array<{ campo: string; fila: number }>;
}

describe('EmployeeImportService', () => {
  const mockSedeFindMany = jest.fn();
  const mockEmpleadoFindMany = jest.fn();
  const mockEmpleadoCreate = jest.fn();
  const mockAffiliationCreate = jest.fn();
  const mockAffiliationFindFirst = jest.fn();
  const mockEmployeeLock = jest.fn();
  const mockCreateAffiliationInTransaction = jest.fn();
  const mockAuditLog = jest.fn();
  const mockTenantPrismaExecute = jest.fn();
  const mockPrismaClient = {
    sede: { findMany: mockSedeFindMany },
    empleado: {
      findMany: mockEmpleadoFindMany,
      create: mockEmpleadoCreate,
    },
    afiliacionSeguridadSocial: {
      create: mockAffiliationCreate,
      findFirst: mockAffiliationFindFirst,
    },
    $queryRaw: mockEmployeeLock,
  };
  let service: EmployeeImportService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSedeFindMany.mockResolvedValue([
      { id: 'sede-a', nombre: 'Sede Principal' },
    ]);
    mockEmpleadoFindMany.mockResolvedValue([]);
    mockEmpleadoCreate.mockResolvedValue({ id: 'employee-a' });
    mockAffiliationCreate.mockResolvedValue({ id: 'affiliation-a' });
    mockAffiliationFindFirst.mockResolvedValue(null);
    mockEmployeeLock.mockResolvedValue([
      {
        id: 'employee-a',
        cedula: '1001',
        tipoDocumento: 'CC',
        tipoContrato: 'TERMINO_FIJO',
      },
    ]);
    mockCreateAffiliationInTransaction.mockResolvedValue({
      id: 'affiliation-a',
    });
    mockAuditLog.mockResolvedValue(undefined);
    mockTenantPrismaExecute.mockImplementation(
      (work: (client: unknown, context: { tenantId: string }) => unknown) =>
        work(mockPrismaClient, { tenantId: TENANT_ID }),
    );

    service = new EmployeeImportService(
      { execute: mockTenantPrismaExecute } as unknown as TenantPrismaService,
      { log: mockAuditLog } as unknown as AuditService,
      {
        createInTransaction: mockCreateAffiliationInTransaction,
      } as unknown as SocialSecurityAffiliationsService,
    );
  });

  it('includes optional PILA affiliation columns in the employee template', () => {
    const workbook = XLSX.read(service.generateTemplate(), { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      defval: '',
    });

    expect(rows[0]).toEqual([...HEADERS, ...PILA_HEADERS]);
    expect(rows[1]).toHaveLength(HEADERS.length + PILA_HEADERS.length);
    expect(rows[2]).toHaveLength(HEADERS.length + PILA_HEADERS.length);
    expect(rows[2]?.slice(HEADERS.length)).toEqual(PILA_HEADERS.map(() => ''));
  });

  it('creates a separate XLSX template for existing employees', () => {
    const workbook = XLSX.read(service.generatePilaAffiliationsTemplate(), {
      type: 'buffer',
    });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      defval: '',
    });

    expect(rows[0]).toEqual(PILA_BULK_HEADERS);
    expect(rows[1]).toHaveLength(PILA_BULK_HEADERS.length);
    expect(rows).toHaveLength(2);
  });

  it('imports a complete affiliation for an existing employee in the tenant transaction', async () => {
    mockEmpleadoFindMany.mockResolvedValue([
      {
        id: 'employee-a',
        cedula: '1001',
        tipoDocumento: 'CC',
        tipoContrato: 'TERMINO_FIJO',
      },
    ]);

    await expect(
      service.importPilaAffiliationsFromBuffer(
        TENANT_ID,
        USER_ID,
        workbookBuffer([pilaBulkAffiliationRow()], PILA_BULK_HEADERS),
      ),
    ).resolves.toEqual({
      created: 1,
      unchanged: 0,
      message: '1 afiliación nueva registrada; 0 filas sin cambios.',
    });
    expect(mockTenantPrismaExecute).toHaveBeenNthCalledWith(
      2,
      expect.any(Function),
      { maxWait: 10_000, timeout: 30_000 },
    );

    expect(mockEmpleadoFindMany).toHaveBeenCalledWith({
      where: {
        tenantId: TENANT_ID,
        deletedAt: null,
        cedula: { in: ['1001'] },
      },
      select: {
        id: true,
        cedula: true,
        tipoDocumento: true,
        tipoContrato: true,
      },
    });
    expect(mockCreateAffiliationInTransaction).toHaveBeenCalledWith(
      mockPrismaClient,
      TENANT_ID,
      USER_ID,
      'employee-a',
      expect.objectContaining({
        epsCodigo: 'EPS001',
        estadoAfiliacionPensional: null,
        indicadorTarifaEspecialPensiones: '',
        vigenteDesde: '2026-01-01',
        vigenteHasta: null,
      }),
    );
    const [auditEvent, auditTransaction] = mockAuditLog.mock
      .calls[0] as unknown as [
      {
        tenantId: string;
        action: string;
        metadata: { creadas: number; sinCambios: number };
      },
      unknown,
    ];
    expect(auditEvent).toMatchObject({
      tenantId: TENANT_ID,
      action: 'EMPLOYEE_PILA_AFFILIATION_BULK_IMPORT',
      metadata: { creadas: 1, sinCambios: 0 },
    });
    expect(auditTransaction).toBe(mockPrismaClient);
  });

  it('imports an explicit special pension tariff without converting its code', async () => {
    mockEmpleadoFindMany.mockResolvedValue([
      {
        id: 'employee-a',
        cedula: '1001',
        tipoDocumento: 'CC',
        tipoContrato: 'TERMINO_FIJO',
      },
    ]);

    await service.importPilaAffiliationsFromBuffer(
      TENANT_ID,
      USER_ID,
      workbookBuffer(
        [pilaBulkAffiliationRow({ indicadorTarifaEspecialPensiones: '3' })],
        PILA_BULK_HEADERS,
      ),
    );

    expect(mockCreateAffiliationInTransaction).toHaveBeenCalledWith(
      mockPrismaClient,
      TENANT_ID,
      USER_ID,
      'employee-a',
      expect.objectContaining({ indicadorTarifaEspecialPensiones: '3' }),
    );
  });

  it('rejects unknown pension tariff codes before writing affiliations', async () => {
    mockEmpleadoFindMany.mockResolvedValue([
      {
        id: 'employee-a',
        cedula: '1001',
        tipoDocumento: 'CC',
        tipoContrato: 'TERMINO_FIJO',
      },
    ]);

    let thrown: unknown;
    try {
      await service.importPilaAffiliationsFromBuffer(
        TENANT_ID,
        USER_ID,
        workbookBuffer(
          [pilaBulkAffiliationRow({ indicadorTarifaEspecialPensiones: '5' })],
          PILA_BULK_HEADERS,
        ),
      );
    } catch (error) {
      thrown = error;
    }

    expect(importErrors(thrown)).toContainEqual(
      expect.objectContaining({
        campo: 'indicadorTarifaEspecialPensiones',
        fila: 2,
      }),
    );
    expect(mockCreateAffiliationInTransaction).not.toHaveBeenCalled();
  });

  it('accepts older affiliation templates without the new pension evidence columns', async () => {
    mockEmpleadoFindMany.mockResolvedValue([
      {
        id: 'employee-a',
        cedula: '1001',
        tipoDocumento: 'CC',
        tipoContrato: 'TERMINO_FIJO',
      },
    ]);
    const previousHeaders = PILA_BULK_HEADERS.filter(
      (header) =>
        header !== 'estadoAfiliacionPensional' &&
        header !== 'indicadorTarifaEspecialPensiones',
    );

    await service.importPilaAffiliationsFromBuffer(
      TENANT_ID,
      USER_ID,
      workbookBuffer(
        [pilaBulkAffiliationRow({}, previousHeaders)],
        previousHeaders,
      ),
    );

    expect(mockCreateAffiliationInTransaction).toHaveBeenCalledWith(
      mockPrismaClient,
      TENANT_ID,
      USER_ID,
      'employee-a',
      expect.objectContaining({
        estadoAfiliacionPensional: null,
        indicadorTarifaEspecialPensiones: undefined,
      }),
    );
  });

  it('preserves an existing pension state when an older template is re-imported', async () => {
    mockEmpleadoFindMany.mockResolvedValue([
      {
        id: 'employee-a',
        cedula: '1001',
        tipoDocumento: 'CC',
        tipoContrato: 'TERMINO_FIJO',
      },
    ]);
    mockAffiliationFindFirst.mockResolvedValue({
      tipoCotizanteCodigo: '01',
      subtipoCotizanteCodigo: '00',
      epsCodigo: 'EPS001',
      epsNombre: 'EPS de prueba',
      fondoPensionCodigo: 'AFP001',
      fondoPensionNombre: 'Fondo de prueba',
      estadoAfiliacionPensional: 'S',
      indicadorTarifaEspecialPensiones: '2',
      arlCodigo: 'ARL001',
      arlNombre: 'ARL de prueba',
      arlClaseRiesgo: '1',
      cajaCompensacionCodigo: 'CCF001',
      cajaCompensacionNombre: 'Caja de prueba',
      cajaCompensacionDepartamentoCodigo: '08',
      extranjeroNoObligadoPension: null,
      colombianoEnElExterior: false,
      vigenteDesde: new Date('2026-01-01T00:00:00.000Z'),
      vigenteHasta: null,
    });
    const previousHeaders = PILA_BULK_HEADERS.filter(
      (header) =>
        header !== 'estadoAfiliacionPensional' &&
        header !== 'indicadorTarifaEspecialPensiones',
    );

    await expect(
      service.importPilaAffiliationsFromBuffer(
        TENANT_ID,
        USER_ID,
        workbookBuffer(
          [pilaBulkAffiliationRow({}, previousHeaders)],
          previousHeaders,
        ),
      ),
    ).resolves.toMatchObject({ created: 0, unchanged: 1 });
    expect(mockCreateAffiliationInTransaction).not.toHaveBeenCalled();
  });

  it('treats an identical retry as unchanged and does not duplicate affiliation history', async () => {
    mockEmpleadoFindMany.mockResolvedValue([
      {
        id: 'employee-a',
        cedula: '1001',
        tipoDocumento: 'CC',
        tipoContrato: 'TERMINO_FIJO',
      },
    ]);
    mockAffiliationFindFirst.mockResolvedValue({
      tipoCotizanteCodigo: '01',
      subtipoCotizanteCodigo: '00',
      epsCodigo: 'EPS001',
      epsNombre: 'EPS de prueba',
      fondoPensionCodigo: 'AFP001',
      fondoPensionNombre: 'Fondo de prueba',
      indicadorTarifaEspecialPensiones: '',
      arlCodigo: 'ARL001',
      arlNombre: 'ARL de prueba',
      arlClaseRiesgo: '1',
      cajaCompensacionCodigo: 'CCF001',
      cajaCompensacionNombre: 'Caja de prueba',
      cajaCompensacionDepartamentoCodigo: '08',
      extranjeroNoObligadoPension: null,
      colombianoEnElExterior: false,
      vigenteDesde: new Date('2026-01-01T00:00:00.000Z'),
      vigenteHasta: null,
    });

    await expect(
      service.importPilaAffiliationsFromBuffer(
        TENANT_ID,
        USER_ID,
        workbookBuffer([pilaBulkAffiliationRow()], PILA_BULK_HEADERS),
      ),
    ).resolves.toMatchObject({
      created: 0,
      unchanged: 1,
      message: '0 afiliaciones nuevas registradas; 1 fila sin cambios.',
    });
    expect(mockCreateAffiliationInTransaction).not.toHaveBeenCalled();
  });

  it('validates every row before writing any affiliation', async () => {
    mockEmpleadoFindMany.mockResolvedValue([
      {
        id: 'employee-a',
        cedula: '1001',
        tipoDocumento: 'CC',
        tipoContrato: 'TERMINO_FIJO',
      },
      {
        id: 'employee-b',
        cedula: '1002',
        tipoDocumento: 'CC',
        tipoContrato: 'TERMINO_FIJO',
      },
    ]);

    let thrown: unknown;
    try {
      await service.importPilaAffiliationsFromBuffer(
        TENANT_ID,
        USER_ID,
        workbookBuffer(
          [
            pilaBulkAffiliationRow(),
            pilaBulkAffiliationRow({ cedula: '1002', arlClaseRiesgo: '6' }),
          ],
          PILA_BULK_HEADERS,
        ),
      );
    } catch (error) {
      thrown = error;
    }

    expect(importErrors(thrown)).toContainEqual({
      campo: 'arlClaseRiesgo',
      fila: 3,
      mensaje: 'La clase de riesgo debe ser 1, 2, 3, 4 o 5.',
    });
    expect(mockCreateAffiliationInTransaction).not.toHaveBeenCalled();
  });

  it('rejects duplicate employees in one file before starting the write transaction', async () => {
    mockEmpleadoFindMany.mockResolvedValue([
      {
        id: 'employee-a',
        cedula: '1001',
        tipoDocumento: 'CC',
        tipoContrato: 'TERMINO_FIJO',
      },
    ]);

    let thrown: unknown;
    try {
      await service.importPilaAffiliationsFromBuffer(
        TENANT_ID,
        USER_ID,
        workbookBuffer(
          [pilaBulkAffiliationRow(), pilaBulkAffiliationRow()],
          PILA_BULK_HEADERS,
        ),
      );
    } catch (error) {
      thrown = error;
    }

    expect(importErrors(thrown)).toContainEqual(
      expect.objectContaining({ campo: 'cedula', fila: 3 }),
    );
    expect(mockCreateAffiliationInTransaction).not.toHaveBeenCalled();
    expect(mockEmployeeLock).not.toHaveBeenCalled();
  });

  it('rejects a document type that does not match the tenant employee record', async () => {
    mockEmpleadoFindMany.mockResolvedValue([
      {
        id: 'employee-a',
        cedula: '1001',
        tipoDocumento: 'CE',
        tipoContrato: 'TERMINO_FIJO',
      },
    ]);

    let thrown: unknown;
    try {
      await service.importPilaAffiliationsFromBuffer(
        TENANT_ID,
        USER_ID,
        workbookBuffer([pilaBulkAffiliationRow()], PILA_BULK_HEADERS),
      );
    } catch (error) {
      thrown = error;
    }

    expect(importErrors(thrown)).toContainEqual(
      expect.objectContaining({ campo: 'tipoDocumento', fila: 2 }),
    );
    expect(mockCreateAffiliationInTransaction).not.toHaveBeenCalled();
  });

  it('rejects a document number changed after preflight while acquiring the employee lock', async () => {
    mockEmpleadoFindMany.mockResolvedValue([
      {
        id: 'employee-a',
        cedula: '1001',
        tipoDocumento: 'CC',
        tipoContrato: 'TERMINO_FIJO',
      },
    ]);
    mockEmployeeLock.mockResolvedValueOnce([
      {
        id: 'employee-a',
        cedula: '1009',
        tipoDocumento: 'CC',
        tipoContrato: 'TERMINO_FIJO',
      },
    ]);

    let thrown: unknown;
    try {
      await service.importPilaAffiliationsFromBuffer(
        TENANT_ID,
        USER_ID,
        workbookBuffer([pilaBulkAffiliationRow()], PILA_BULK_HEADERS),
      );
    } catch (error) {
      thrown = error;
    }

    expect(importErrors(thrown)).toContainEqual(
      expect.objectContaining({
        campo: 'cedula',
        mensaje:
          'El número de documento del empleado cambió durante la importación.',
      }),
    );
    expect(mockCreateAffiliationInTransaction).not.toHaveBeenCalled();
  });

  it('imports valid rows through the tenant-aware transaction boundary', async () => {
    await expect(
      service.importFromBuffer(
        TENANT_ID,
        USER_ID,
        workbookBuffer([
          [
            '1001',
            'CC',
            'Ana',
            '',
            'Gómez',
            '',
            'ana@example.com',
            '',
            'Docente',
            2500000,
            'TERMINO_FIJO',
            '2025-01-15',
            'ACTIVO',
            'Sede Principal',
            '',
            'F',
            'COMPLETA',
            '',
            '',
          ],
        ]),
      ),
    ).resolves.toEqual({
      imported: 1,
      message: '1 empleado importado correctamente.',
    });

    const [sedeQuery] = mockSedeFindMany.mock.calls as [
      [{ where: { tenantId: string } }],
    ];
    expect(sedeQuery?.[0].where.tenantId).toBe(TENANT_ID);

    const [createQuery] = mockEmpleadoCreate.mock.calls as [
      [{ data: { tenantId: string; cedula: string; sedeId: string } }],
    ];
    expect(createQuery?.[0].data).toEqual(
      expect.objectContaining({
        tenantId: TENANT_ID,
        cedula: '1001',
        sedeId: 'sede-a',
        tipoSalarioPila: 'F',
        salarioIntegral: false,
      }),
    );
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT_ID,
        userId: USER_ID,
        action: 'EMPLOYEE_BULK_IMPORT',
      }),
    );
  });

  it('imports a PEP-TUTOR employee with its official PC document code', async () => {
    await expect(
      service.importFromBuffer(
        TENANT_ID,
        USER_ID,
        workbookBuffer([
          [
            '12345678',
            'PC',
            'Ana',
            '',
            'Gómez',
            '',
            'ana@example.test',
            '',
            'Docente',
            2500000,
            'TERMINO_FIJO',
            '2025-01-15',
            'ACTIVO',
            'Sede Principal',
            '',
            'F',
            'COMPLETA',
            '',
            '',
          ],
        ]),
      ),
    ).resolves.toMatchObject({ imported: 1 });

    const [createQuery] = mockEmpleadoCreate.mock.calls as [
      [{ data: { cedula: string; tipoDocumento: string } }],
    ];
    expect(createQuery?.[0].data.cedula).toBe('12345678');
    expect(createQuery?.[0].data.tipoDocumento).toBe('PC');
  });

  it('imports an explicit initial affiliation with the new employee in one transaction', async () => {
    await expect(
      service.importFromBuffer(
        TENANT_ID,
        USER_ID,
        workbookBuffer([pilaImportRow()], [...HEADERS, ...PILA_HEADERS]),
      ),
    ).resolves.toEqual({
      imported: 1,
      message:
        '1 empleado importado correctamente. 1 afiliación PILA inicial capturada.',
    });

    expect(mockEmpleadoCreate).toHaveBeenCalledTimes(1);
    const affiliationCalls = mockAffiliationCreate.mock
      .calls as unknown as Array<[{ data: Record<string, unknown> }]>;
    expect(affiliationCalls[0]?.[0].data).toMatchObject({
      tenantId: TENANT_ID,
      empleadoId: 'employee-a',
      registradoPorId: USER_ID,
      versionCaptura: 'PILA_AFFILIATION_CAPTURE_V5',
      indicadorTarifaEspecialPensiones: '',
      tipoCotizanteCodigo: '01',
      subtipoCotizanteCodigo: '00',
      epsCodigo: 'EPS001',
      fondoPensionCodigo: 'AFP001',
      arlCodigo: 'ARL001',
      cajaCompensacionCodigo: 'CCF001',
      cajaCompensacionDepartamentoCodigo: '08',
      extranjeroNoObligadoPension: null,
      colombianoEnElExterior: false,
      vigenteDesde: new Date('2026-01-01T00:00:00.000Z'),
      vigenteHasta: null,
    });

    const auditCalls = mockAuditLog.mock.calls as unknown as Array<
      [
        {
          action: string;
          tenantId: string;
          userId: string;
          entityId?: string;
          metadata?: { source?: string };
        },
        unknown?,
      ]
    >;
    const affiliationAudit = auditCalls.find(
      ([event]) =>
        event.action === 'EMPLOYEE_SOCIAL_SECURITY_AFFILIATION_RECORDED',
    );
    expect(affiliationAudit?.[0]).toMatchObject({
      tenantId: TENANT_ID,
      userId: USER_ID,
      entityId: 'affiliation-a',
      metadata: { source: 'EMPLOYEE_XLSX_IMPORT' },
    });
    expect(affiliationAudit?.[1]).toBe(mockPrismaClient);
  });

  it('keeps PILA affiliation optional when every new template field is blank', async () => {
    const emptyPilaFields = Object.fromEntries(
      PILA_HEADERS.map((field) => [field, '']),
    );

    await expect(
      service.importFromBuffer(
        TENANT_ID,
        USER_ID,
        workbookBuffer(
          [pilaImportRow(emptyPilaFields)],
          [...HEADERS, ...PILA_HEADERS],
        ),
      ),
    ).resolves.toEqual({
      imported: 1,
      message: '1 empleado importado correctamente.',
    });
    expect(mockEmpleadoCreate).toHaveBeenCalledTimes(1);
    expect(mockAffiliationCreate).not.toHaveBeenCalled();
  });

  it('rejects incomplete or invalid PILA data before writing any employee', async () => {
    const incomplete = pilaImportRow({ subtipoCotizanteCodigo: '' });
    const invalidDepartment = pilaImportRow({
      cedula: '1006',
      cajaCompensacionDepartamentoCodigo: '00',
      subtipoCotizanteCodigo: '01',
      epsCodigo: 123,
    });
    const error = await service
      .importFromBuffer(
        TENANT_ID,
        USER_ID,
        workbookBuffer(
          [incomplete, invalidDepartment],
          [...HEADERS, ...PILA_HEADERS],
        ),
      )
      .then(
        () => undefined,
        (reason: unknown) => reason,
      );

    expect(
      importErrors(error).some(
        ({ campo, fila }) => campo === 'subtipoCotizanteCodigo' && fila === 2,
      ),
    ).toBe(true);
    expect(
      importErrors(error).some(
        ({ campo, fila }) =>
          campo === 'cajaCompensacionDepartamentoCodigo' && fila === 3,
      ),
    ).toBe(true);
    expect(
      importErrors(error).some(
        ({ campo, fila }) => campo === 'subtipoCotizanteCodigo' && fila === 3,
      ),
    ).toBe(true);
    expect(
      importErrors(error).some(
        ({ campo, fila }) => campo === 'epsCodigo' && fila === 3,
      ),
    ).toBe(true);
    expect(mockEmpleadoCreate).not.toHaveBeenCalled();
    expect(mockAffiliationCreate).not.toHaveBeenCalled();
  });

  it('requires the AT2 declaration that applies to each document type', async () => {
    const colombianMissingDeclaration = pilaImportRow({
      colombianoEnElExterior: '',
    });
    const foreignEmployee = pilaImportRow({
      cedula: '1007',
      tipoDocumento: 'CE',
      extranjeroNoObligadoPension: 'SI',
      colombianoEnElExterior: '',
    });

    await expect(
      service.importFromBuffer(
        TENANT_ID,
        USER_ID,
        workbookBuffer([foreignEmployee], [...HEADERS, ...PILA_HEADERS]),
      ),
    ).resolves.toMatchObject({ imported: 1 });
    const affiliationCalls = mockAffiliationCreate.mock
      .calls as unknown as Array<[{ data: Record<string, unknown> }]>;
    expect(affiliationCalls[0]?.[0].data).toMatchObject({
      extranjeroNoObligadoPension: true,
      colombianoEnElExterior: null,
    });

    mockEmpleadoCreate.mockClear();
    mockAffiliationCreate.mockClear();
    const error = await service
      .importFromBuffer(
        TENANT_ID,
        USER_ID,
        workbookBuffer(
          [colombianMissingDeclaration],
          [...HEADERS, ...PILA_HEADERS],
        ),
      )
      .then(
        () => undefined,
        (reason: unknown) => reason,
      );

    expect(
      importErrors(error).some(
        ({ campo }) => campo === 'colombianoEnElExterior',
      ),
    ).toBe(true);
    expect(mockEmpleadoCreate).not.toHaveBeenCalled();
    expect(mockAffiliationCreate).not.toHaveBeenCalled();
  });

  it('rejects a malformed or inverted affiliation validity interval', async () => {
    const malformedDate = pilaImportRow({
      afiliacionVigenteDesde: '2026-02-30',
      afiliacionVigenteHasta: '2026-01-31',
    });
    const invertedInterval = pilaImportRow({
      cedula: '1008',
      afiliacionVigenteDesde: '2026-01-01',
      afiliacionVigenteHasta: '2025-12-31',
    });
    const error = await service
      .importFromBuffer(
        TENANT_ID,
        USER_ID,
        workbookBuffer(
          [malformedDate, invertedInterval],
          [...HEADERS, ...PILA_HEADERS],
        ),
      )
      .then(
        () => undefined,
        (reason: unknown) => reason,
      );

    expect(
      importErrors(error).some(
        ({ campo }) => campo === 'afiliacionVigenteDesde',
      ),
    ).toBe(true);
    expect(
      importErrors(error).some(
        ({ campo, fila }) => campo === 'afiliacionVigenteHasta' && fila === 3,
      ),
    ).toBe(true);
    expect(mockEmpleadoCreate).not.toHaveBeenCalled();
  });

  it('rejects a standard PILA affiliation for a non-standard employment contract', async () => {
    const unsupportedContract = pilaImportRow({
      tipoContrato: 'PRESTACION_SERVICIOS',
    });
    const error = await service
      .importFromBuffer(
        TENANT_ID,
        USER_ID,
        workbookBuffer([unsupportedContract], [...HEADERS, ...PILA_HEADERS]),
      )
      .then(
        () => undefined,
        (reason: unknown) => reason,
      );

    expect(
      importErrors(error).some(({ campo }) => campo === 'tipoContrato'),
    ).toBe(true);
    expect(mockEmpleadoCreate).not.toHaveBeenCalled();
    expect(mockAffiliationCreate).not.toHaveBeenCalled();
  });

  it('rejects a PEP-TUTOR employee with a malformed document number', async () => {
    const invalidNumber = workbookBuffer([
      [
        '123456',
        'PC',
        'Ana',
        '',
        'Gómez',
        '',
        'ana@example.test',
        '',
        'Docente',
        2500000,
        'TERMINO_FIJO',
        '2025-01-15',
        'ACTIVO',
        'Sede Principal',
        '',
        'F',
        'COMPLETA',
        '',
        '',
      ],
    ]);

    const error = await service
      .importFromBuffer(TENANT_ID, USER_ID, invalidNumber)
      .then(
        () => undefined,
        (reason: unknown) => reason,
      );

    expect(
      importErrors(error).some(
        ({ campo, fila }) => campo === 'cedula' && fila === 2,
      ),
    ).toBe(true);
    expect(mockEmpleadoCreate).not.toHaveBeenCalled();
  });

  it('rejects a row without an assigned site before issuing any employee write', async () => {
    const missingSite = workbookBuffer([
      [
        '1002',
        'CC',
        'Ana',
        '',
        'Gómez',
        '',
        '',
        '',
        'Docente',
        2500000,
        'TERMINO_FIJO',
        '2025-01-15',
        'ACTIVO',
        '',
        '',
        'F',
        '',
        '',
        '',
      ],
    ]);

    const error = await service
      .importFromBuffer(TENANT_ID, USER_ID, missingSite)
      .then(
        () => undefined,
        (reason: unknown) => reason,
      );

    expect(
      importErrors(error).some(
        ({ campo, fila }) => campo === 'sede' && fila === 2,
      ),
    ).toBe(true);
    expect(mockEmpleadoCreate).not.toHaveBeenCalled();
    expect(mockAuditLog).not.toHaveBeenCalled();
  });

  it('reads old templates and maps only an explicit integral flag to X', async () => {
    const legacyHeaders = [...HEADERS];
    legacyHeaders[15] = 'salarioIntegral';

    await service.importFromBuffer(
      TENANT_ID,
      USER_ID,
      workbookBuffer(
        [
          [
            '1003',
            'CC',
            'Luis',
            '',
            'Pérez',
            '',
            '',
            '',
            'Docente',
            2500000,
            'TERMINO_FIJO',
            '2025-01-15',
            'ACTIVO',
            'Sede Principal',
            '',
            'TRUE',
            '',
            '',
            '',
          ],
        ],
        legacyHeaders,
      ),
    );

    const [createQuery] = mockEmpleadoCreate.mock.calls as [
      [{ data: { tipoSalarioPila: string; salarioIntegral: boolean } }],
    ];
    expect(createQuery?.[0].data).toEqual(
      expect.objectContaining({ tipoSalarioPila: 'X', salarioIntegral: true }),
    );
  });

  it('does not infer fixed salary from FALSE in an old template', async () => {
    const legacyHeaders = [...HEADERS];
    legacyHeaders[15] = 'salarioIntegral';

    await service.importFromBuffer(
      TENANT_ID,
      USER_ID,
      workbookBuffer(
        [
          [
            '1004',
            'CC',
            'Sara',
            '',
            'Rojas',
            '',
            '',
            '',
            'Docente',
            2500000,
            'TERMINO_FIJO',
            '2025-01-15',
            'ACTIVO',
            'Sede Principal',
            '',
            'FALSE',
            '',
            '',
            '',
          ],
        ],
        legacyHeaders,
      ),
    );

    const calls = mockEmpleadoCreate.mock.calls as unknown as Array<
      [{ data: { tipoSalarioPila?: string; salarioIntegral: boolean } }]
    >;
    expect(calls[0]?.[0].data).toEqual(
      expect.objectContaining({
        tipoSalarioPila: undefined,
        salarioIntegral: false,
      }),
    );
  });
});
