import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import { TipoDocIdentidad } from './dto/create-employee.dto';
import { SocialSecurityAffiliationsService } from './social-security-affiliations.service';
import { EmployeesService } from './employees.service';

const mockEmpleadoFindUnique = jest.fn();
const mockEmpleadoFindFirst = jest.fn();
const mockEmpleadoFindMany = jest.fn();
const mockEmpleadoCount = jest.fn();
const mockEmpleadoCreate = jest.fn();
const mockEmpleadoUpdate = jest.fn();
const mockSedeFindFirst = jest.fn();
const mockAuditLog = jest.fn();
const mockCreateAffiliationInTransaction = jest.fn();
const mockTenantPrismaExecute = jest.fn();

const TENANT_A = 'tenant-a';
const USER_A = 'user-a';
const TENANT_B_EMPLOYEE = 'employee-from-tenant-b';
const mockTransactionClient = {
  empleado: {
    findUnique: mockEmpleadoFindUnique,
    findFirst: mockEmpleadoFindFirst,
    findMany: mockEmpleadoFindMany,
    count: mockEmpleadoCount,
    create: mockEmpleadoCreate,
    update: mockEmpleadoUpdate,
  },
  sede: { findFirst: mockSedeFindFirst },
};

const expectedSearchConditions = (terms: string[]) =>
  terms.map((term) => ({
    OR: [
      { primerNombre: { contains: term, mode: 'insensitive' } },
      { segundoNombre: { contains: term, mode: 'insensitive' } },
      { primerApellido: { contains: term, mode: 'insensitive' } },
      { segundoApellido: { contains: term, mode: 'insensitive' } },
      { cedula: { contains: term, mode: 'insensitive' } },
      { email: { contains: term, mode: 'insensitive' } },
    ],
  }));

type EmployeeFindManyWhere = {
  tenantId?: string;
  deletedAt?: null;
  AND?: ReturnType<typeof expectedSearchConditions>;
};

const lastEmployeeFindManyWhere = (): EmployeeFindManyWhere | undefined => {
  const [args] = mockEmpleadoFindMany.mock.calls as unknown as [
    [{ where: EmployeeFindManyWhere }],
  ];
  return args?.[0]?.where;
};

describe('EmployeesService tenant isolation contracts', () => {
  let service: EmployeesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockEmpleadoFindMany.mockResolvedValue([]);
    mockEmpleadoCount.mockResolvedValue(0);
    mockAuditLog.mockResolvedValue(undefined);
    mockCreateAffiliationInTransaction.mockResolvedValue({
      id: 'affiliation-a',
    });
    mockTenantPrismaExecute.mockImplementation(
      (work: (client: unknown, context: { tenantId: string }) => unknown) =>
        work(mockTransactionClient, { tenantId: TENANT_A }),
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        EmployeesService,
        {
          provide: TenantPrismaService,
          useValue: {
            execute: mockTenantPrismaExecute,
          },
        },
        { provide: AuditService, useValue: { log: mockAuditLog } },
        {
          provide: SocialSecurityAffiliationsService,
          useValue: { createInTransaction: mockCreateAffiliationInTransaction },
        },
      ],
    }).compile();

    service = moduleRef.get(EmployeesService);
  });

  it('uses TenantContext as the only tenant source when listing employees', async () => {
    await service.findAll({ page: 1, limit: 10 });

    const expectedWhere = { tenantId: TENANT_A, deletedAt: null };
    expect(mockEmpleadoFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expectedWhere }),
    );
    expect(mockEmpleadoCount).toHaveBeenCalledWith({ where: expectedWhere });
    expect(mockTenantPrismaExecute).toHaveBeenCalledTimes(1);
  });

  it('requires a site when registering an employee', async () => {
    await expect(
      service.create(USER_A, { sedeId: '' } as never),
    ).rejects.toThrow(BadRequestException);

    expect(mockTenantPrismaExecute).not.toHaveBeenCalled();
  });

  it('keeps the explicitly declared PILA salary mode consistent with payroll', async () => {
    mockEmpleadoFindUnique.mockResolvedValue(null);
    mockSedeFindFirst.mockResolvedValue({ id: 'sede-a' });
    mockEmpleadoCreate.mockImplementation(
      (args: { data: Record<string, unknown> }) => ({
        id: 'employee-a',
        ...args.data,
      }),
    );

    await service.create(USER_A, {
      cedula: '1001',
      tipoDocumento: 'CC',
      primerNombre: 'Ana',
      primerApellido: 'Gómez',
      cargo: 'Docente',
      salario: 2_000_000,
      tipoContrato: 'TERMINO_FIJO',
      fechaIngreso: '2026-01-01',
      sedeId: 'sede-a',
      tipoSalarioPila: 'V',
    } as never);

    const [createQuery] = mockEmpleadoCreate.mock.calls as [
      [{ data: { tipoSalarioPila: string; salarioIntegral: boolean } }],
    ];
    expect(createQuery?.[0].data).toEqual(
      expect.objectContaining({ tipoSalarioPila: 'V', salarioIntegral: false }),
    );
  });

  it('creates an initial PILA affiliation with the employee in the same tenant transaction', async () => {
    mockEmpleadoFindUnique.mockResolvedValue(null);
    mockSedeFindFirst.mockResolvedValue({ id: 'sede-a' });
    mockEmpleadoCreate.mockImplementation(
      (args: { data: Record<string, unknown> }) => ({
        id: 'employee-a',
        ...args.data,
      }),
    );
    const affiliation = {
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
      extranjeroNoObligadoPension: null,
      colombianoEnElExterior: false,
      vigenteDesde: '2026-01-01',
      vigenteHasta: null,
    };

    await service.create(USER_A, {
      cedula: '1002',
      tipoDocumento: 'CC',
      primerNombre: 'Ana',
      primerApellido: 'Gómez',
      cargo: 'Docente',
      salario: 2_000_000,
      tipoContrato: 'TERMINO_FIJO',
      fechaIngreso: '2026-01-01',
      sedeId: 'sede-a',
      afiliacionPilaInicial: affiliation,
    } as never);

    const [employeeCreate] = mockEmpleadoCreate.mock.calls as [
      [{ data: Record<string, unknown> }],
    ];
    expect(employeeCreate?.[0].data).not.toHaveProperty(
      'afiliacionPilaInicial',
    );
    expect(mockCreateAffiliationInTransaction).toHaveBeenCalledWith(
      mockTransactionClient,
      TENANT_A,
      USER_A,
      'employee-a',
      affiliation,
    );
  });

  it('rejects standard PILA affiliation for contractors before writing an employee', async () => {
    await expect(
      service.create(USER_A, {
        sedeId: 'sede-a',
        tipoContrato: 'PRESTACION_SERVICIOS',
        afiliacionPilaInicial: { tipoCotizanteCodigo: '01' },
      } as never),
    ).rejects.toThrow(BadRequestException);

    expect(mockTenantPrismaExecute).not.toHaveBeenCalled();
    expect(mockEmpleadoCreate).not.toHaveBeenCalled();
  });

  it('rejects a contradictory PILA type and integral-salary flag', async () => {
    await expect(
      service.create(USER_A, {
        sedeId: 'sede-a',
        tipoSalarioPila: 'F',
        salarioIntegral: true,
      } as never),
    ).rejects.toThrow(BadRequestException);

    expect(mockTenantPrismaExecute).not.toHaveBeenCalled();
  });

  it('searches an individual term across employee fields', async () => {
    await service.findAll({ page: 1, limit: 10, search: 'Empleado' });

    const where = lastEmployeeFindManyWhere();
    expect(where).toMatchObject({ tenantId: TENANT_A, deletedAt: null });
    expect(where?.AND).toEqual(expectedSearchConditions(['Empleado']));
  });

  it('matches every term in a compound employee search across the fields', async () => {
    await service.findAll({
      page: 1,
      limit: 10,
      search: 'Empleado Prueba',
    });

    expect(lastEmployeeFindManyWhere()?.AND).toEqual(
      expectedSearchConditions(['Empleado', 'Prueba']),
    );
  });

  it('returns an empty result when an employee search has no matches', async () => {
    mockEmpleadoFindMany.mockResolvedValue([]);
    mockEmpleadoCount.mockResolvedValue(0);

    const result = await service.findAll({
      page: 1,
      limit: 10,
      search: 'No existe',
    });

    expect(lastEmployeeFindManyWhere()?.AND).toEqual(
      expectedSearchConditions(['No', 'existe']),
    );
    expect(result).toEqual({
      data: [],
      meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
    });
  });

  it('does not read an employee belonging to another tenant', async () => {
    mockEmpleadoFindFirst.mockResolvedValue(null);

    await expect(service.findOne(TENANT_B_EMPLOYEE)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(mockEmpleadoFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: TENANT_B_EMPLOYEE,
          tenantId: TENANT_A,
          deletedAt: null,
        },
      }),
    );
  });

  it('rejects a cross-tenant update before issuing a write', async () => {
    mockEmpleadoFindFirst.mockResolvedValue(null);

    await expect(
      service.update(USER_A, TENANT_B_EMPLOYEE, { primerNombre: 'Ataque' }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(mockEmpleadoFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: TENANT_B_EMPLOYEE,
          tenantId: TENANT_A,
          deletedAt: null,
        },
      }),
    );
    expect(mockEmpleadoUpdate).not.toHaveBeenCalled();
  });

  it('rejects a cross-tenant deletion before issuing a write', async () => {
    mockEmpleadoFindFirst.mockResolvedValue(null);

    await expect(
      service.remove(USER_A, TENANT_B_EMPLOYEE),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(mockEmpleadoFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: TENANT_B_EMPLOYEE,
          tenantId: TENANT_A,
          deletedAt: null,
        },
      }),
    );
    expect(mockEmpleadoUpdate).not.toHaveBeenCalled();
  });

  it('audits an update after the tenant-scoped write succeeds', async () => {
    mockEmpleadoFindFirst.mockResolvedValue({ id: 'employee-a' });
    mockEmpleadoUpdate.mockResolvedValue({ id: 'employee-a' });

    await service.update(USER_A, 'employee-a', { cargo: 'Coordinador' });

    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT_A,
        userId: USER_A,
        action: 'EMPLOYEE_UPDATE',
        entityType: 'Employee',
        entityId: 'employee-a',
        metadata: { fields: ['cargo'] },
      }),
    );
  });

  it.each([
    {
      description: 'changing another document type to PC',
      currentEmployee: {
        id: 'employee-a',
        tipoDocumento: TipoDocIdentidad.CC,
        cedula: '1234567890',
      },
      update: { tipoDocumento: TipoDocIdentidad.PC },
    },
    {
      description: 'changing a PC number without resending its type',
      currentEmployee: {
        id: 'employee-a',
        tipoDocumento: TipoDocIdentidad.PC,
        cedula: '12345678',
      },
      update: { cedula: '123456' },
    },
  ])(
    'rejects an invalid PEP-TUTOR identity when $description',
    async ({ currentEmployee, update }) => {
      mockEmpleadoFindFirst.mockResolvedValue(currentEmployee);

      await expect(
        service.update(USER_A, 'employee-a', update),
      ).rejects.toThrow(
        'El número PEP-TUTOR (PC) debe contener 7 u 8 dígitos.',
      );

      expect(mockEmpleadoUpdate).not.toHaveBeenCalled();
    },
  );

  it('allows changing a PEP-TUTOR number while preserving the current PC type', async () => {
    mockEmpleadoFindFirst.mockResolvedValue({
      id: 'employee-a',
      tipoDocumento: TipoDocIdentidad.PC,
      cedula: '12345678',
    });
    mockEmpleadoFindUnique.mockResolvedValue(null);
    mockEmpleadoUpdate.mockResolvedValue({ id: 'employee-a' });

    await service.update(USER_A, 'employee-a', { cedula: '7654321' });

    expect(mockEmpleadoUpdate).toHaveBeenCalledTimes(1);
  });

  it('updates the PILA salary type and legacy integral flag together', async () => {
    mockEmpleadoFindFirst.mockResolvedValue({
      id: 'employee-a',
      tipoSalarioPila: 'F',
      salarioIntegral: false,
    });
    mockEmpleadoUpdate.mockResolvedValue({ id: 'employee-a' });

    await service.update(USER_A, 'employee-a', { tipoSalarioPila: 'X' });

    const [updateQuery] = mockEmpleadoUpdate.mock.calls as [
      [{ data: { tipoSalarioPila: string; salarioIntegral: boolean } }],
    ];
    expect(updateQuery?.[0].data).toMatchObject({
      tipoSalarioPila: 'X',
      salarioIntegral: true,
    });
  });

  it('clears an optional retirement date when the edit form sends an empty value', async () => {
    mockEmpleadoFindFirst.mockResolvedValue({ id: 'employee-a' });
    mockEmpleadoUpdate.mockResolvedValue({ id: 'employee-a' });

    await service.update(USER_A, 'employee-a', { fechaRetiro: '' });

    const [updateQuery] = mockEmpleadoUpdate.mock.calls as [
      [{ data: { fechaRetiro: Date | null } }],
    ];
    expect(updateQuery?.[0].data.fechaRetiro).toBeNull();
  });

  it('clears an optional municipality when the edit form sends an empty value', async () => {
    mockEmpleadoFindFirst.mockResolvedValue({ id: 'employee-a' });
    mockEmpleadoUpdate.mockResolvedValue({ id: 'employee-a' });

    await service.update(USER_A, 'employee-a', {
      municipioExpedicionDocId: '',
    });

    const [updateQuery] = mockEmpleadoUpdate.mock.calls as [
      [{ data: { municipioExpedicionDocId: string | null } }],
    ];
    expect(updateQuery?.[0].data.municipioExpedicionDocId).toBeNull();
  });

  it('audits a soft delete after the tenant-scoped write succeeds', async () => {
    mockEmpleadoFindFirst.mockResolvedValue({ id: 'employee-a' });
    mockEmpleadoUpdate.mockResolvedValue({ id: 'employee-a' });

    await service.remove(USER_A, 'employee-a');

    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT_A,
        userId: USER_A,
        action: 'EMPLOYEE_DELETE',
        entityType: 'Employee',
        entityId: 'employee-a',
      }),
    );
  });
});
