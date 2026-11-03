import { UnprocessableEntityException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { AuditService } from '../audit/audit.service';
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
  const mockAuditLog = jest.fn();
  const mockTenantPrismaExecute = jest.fn();
  const mockPrismaClient = {
    sede: { findMany: mockSedeFindMany },
    empleado: {
      findMany: mockEmpleadoFindMany,
      create: mockEmpleadoCreate,
    },
    afiliacionSeguridadSocial: { create: mockAffiliationCreate },
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
    mockAuditLog.mockResolvedValue(undefined);
    mockTenantPrismaExecute.mockImplementation(
      (work: (client: unknown, context: { tenantId: string }) => unknown) =>
        work(mockPrismaClient, { tenantId: TENANT_ID }),
    );

    service = new EmployeeImportService(
      { execute: mockTenantPrismaExecute } as unknown as TenantPrismaService,
      { log: mockAuditLog } as unknown as AuditService,
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
      versionCaptura: 'PILA_AFFILIATION_CAPTURE_V3',
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
