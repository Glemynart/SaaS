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

function workbookBuffer(rows: unknown[][], headers = HEADERS) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Empleados');
  return Buffer.from(
    XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as ArrayBuffer,
  );
}

describe('EmployeeImportService', () => {
  const mockSedeFindMany = jest.fn();
  const mockEmpleadoFindMany = jest.fn();
  const mockEmpleadoCreate = jest.fn();
  const mockAuditLog = jest.fn();
  const mockTenantPrismaExecute = jest.fn();
  let service: EmployeeImportService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSedeFindMany.mockResolvedValue([
      { id: 'sede-a', nombre: 'Sede Principal' },
    ]);
    mockEmpleadoFindMany.mockResolvedValue([]);
    mockEmpleadoCreate.mockResolvedValue({ id: 'employee-a' });
    mockAuditLog.mockResolvedValue(undefined);
    mockTenantPrismaExecute.mockImplementation(
      (work: (client: unknown, context: { tenantId: string }) => unknown) =>
        work(
          {
            sede: { findMany: mockSedeFindMany },
            empleado: {
              findMany: mockEmpleadoFindMany,
              create: mockEmpleadoCreate,
            },
          },
          { tenantId: TENANT_ID },
        ),
    );

    service = new EmployeeImportService(
      { execute: mockTenantPrismaExecute } as unknown as TenantPrismaService,
      { log: mockAuditLog } as unknown as AuditService,
    );
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

    await expect(
      service.importFromBuffer(TENANT_ID, USER_ID, missingSite),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        errors: expect.arrayContaining([
          expect.objectContaining({ campo: 'sede', fila: 2 }),
        ]),
      }),
    });

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
