import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import { EmployeesService } from './employees.service';

const mockEmpleadoFindUnique = jest.fn();
const mockEmpleadoFindFirst = jest.fn();
const mockEmpleadoFindMany = jest.fn();
const mockEmpleadoCount = jest.fn();
const mockEmpleadoUpdate = jest.fn();
const mockSedeFindFirst = jest.fn();
const mockAuditLog = jest.fn();
const mockTenantPrismaExecute = jest.fn();

const TENANT_A = 'tenant-a';
const USER_A = 'user-a';
const TENANT_B_EMPLOYEE = 'employee-from-tenant-b';

describe('EmployeesService tenant isolation contracts', () => {
  let service: EmployeesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockEmpleadoFindMany.mockResolvedValue([]);
    mockEmpleadoCount.mockResolvedValue(0);
    mockAuditLog.mockResolvedValue(undefined);
    mockTenantPrismaExecute.mockImplementation(
      (work: (client: unknown, context: { tenantId: string }) => unknown) =>
        work(
          {
            empleado: {
              findUnique: mockEmpleadoFindUnique,
              findFirst: mockEmpleadoFindFirst,
              findMany: mockEmpleadoFindMany,
              count: mockEmpleadoCount,
              update: mockEmpleadoUpdate,
            },
            sede: { findFirst: mockSedeFindFirst },
          },
          { tenantId: TENANT_A },
        ),
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
