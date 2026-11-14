import { PayrollNoveltyType } from './dto/create-payroll.dto';
import { PayrollService } from './payroll.service';
import { PayrollAccountingPreflightService } from './accounting-preflight/payroll-accounting-preflight.service';
import { AuditService } from '../audit/audit.service';
import { LedgerService } from '../accounting/ledger/ledger.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  TenantPrismaClient,
  TenantPrismaService,
} from '../tenant-prisma/tenant-prisma.service';

describe('PayrollService payroll novelty tenant scoping', () => {
  const tenantId = 'tenant-1';
  const employeeId = 'employee-1';
  const payrollPeriodId = 'period-1';
  const employeeFindFirst = jest.fn();
  const payrollPeriodFindFirst = jest.fn();
  const payrollNoveltyCreate = jest.fn();
  const payrollNoveltyFindMany = jest.fn();
  const auditLog = jest.fn();

  const transaction = {
    empleado: { findFirst: employeeFindFirst },
    payrollPeriod: { findFirst: payrollPeriodFindFirst },
    payrollNovelty: {
      create: payrollNoveltyCreate,
      findMany: payrollNoveltyFindMany,
    },
  } as unknown as TenantPrismaClient;

  const execute = jest.fn(
    <T>(work: (client: TenantPrismaClient) => Promise<T>) => work(transaction),
  );
  const tenantPrisma = { execute } as unknown as TenantPrismaService;
  const service = new PayrollService(
    {} as PrismaService,
    tenantPrisma,
    { log: auditLog } as unknown as AuditService,
    {} as LedgerService,
    {} as PayrollAccountingPreflightService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    employeeFindFirst.mockResolvedValue({ id: employeeId });
    payrollPeriodFindFirst.mockResolvedValue({ id: payrollPeriodId });
    payrollNoveltyCreate.mockResolvedValue({ id: 'novelty-1' });
    payrollNoveltyFindMany.mockResolvedValue([]);
    auditLog.mockResolvedValue(undefined);
  });

  it('validates employee and period and creates the novelty inside TenantPrisma', async () => {
    const result = await service.createNovelty(tenantId, 'user-1', {
      employeeId,
      payrollPeriodId,
      tipo: PayrollNoveltyType.BONUS,
      fecha: '2026-01-15',
      valor: 75_000,
    });

    expect(execute).toHaveBeenCalledTimes(1);
    expect(employeeFindFirst).toHaveBeenCalledWith({
      where: { id: employeeId, tenantId, deletedAt: null },
    });
    expect(payrollPeriodFindFirst).toHaveBeenCalledWith({
      where: { id: payrollPeriodId, tenantId },
    });
    expect(payrollNoveltyCreate).toHaveBeenCalledWith({
      data: {
        employeeId,
        payrollPeriodId,
        tipo: PayrollNoveltyType.BONUS,
        fecha: new Date('2026-01-15'),
        valor: 75_000,
        tenantId,
      },
    });
    expect(result).toEqual({ id: 'novelty-1' });
  });

  it('reads novelties inside TenantPrisma with an explicit tenant filter', async () => {
    await service.findNovelties(tenantId, employeeId);

    expect(execute).toHaveBeenCalledTimes(1);
    expect(payrollNoveltyFindMany).toHaveBeenCalledWith({
      where: { tenantId, employeeId },
      include: {
        employee: {
          select: {
            id: true,
            primerNombre: true,
            segundoNombre: true,
            primerApellido: true,
            segundoApellido: true,
          },
        },
      },
      orderBy: { fecha: 'desc' },
    });
  });
});
