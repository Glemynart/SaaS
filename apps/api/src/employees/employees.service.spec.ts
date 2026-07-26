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
      service.update(TENANT_B_EMPLOYEE, { primerNombre: 'Ataque' }),
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

    await expect(service.remove(TENANT_B_EMPLOYEE)).rejects.toBeInstanceOf(
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
    expect(mockEmpleadoUpdate).not.toHaveBeenCalled();
  });
});
