import { ConflictException } from '@nestjs/common';
import { PayrollPeriodStatus, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { LedgerService } from '../accounting/ledger/ledger.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import { PayrollAccountingPreflightService } from './accounting-preflight/payroll-accounting-preflight.service';
import { PayrollService } from './payroll.service';

function makeHarness(
  status: PayrollPeriodStatus,
  updateCount = 1,
  fechaNueva: Date | null = new Date('2026-11-05T00:00:00.000Z'),
  fechaAnterior: Date | null = null,
) {
  const fechaPrevistaPagoPila = new Date('2026-11-05T00:00:00.000Z');
  const period = {
    id: 'period-1',
    tenantId: 'tenant-1',
    status,
    fechaPrevistaPagoPila: fechaAnterior,
  };
  const updatedPeriod = { ...period, fechaPrevistaPagoPila: fechaNueva };
  const findFirst = jest.fn().mockResolvedValue(period);
  const updateMany = jest.fn().mockResolvedValue({ count: updateCount });
  const findFirstOrThrow = jest.fn().mockResolvedValue(updatedPeriod);
  const transactionClient = {
    payrollPeriod: {
      findFirst,
      updateMany,
      findFirstOrThrow,
    },
  } as unknown as Prisma.TransactionClient;
  const transaction = jest.fn(
    async (callback: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
      callback(transactionClient),
  );
  const prisma = { $transaction: transaction } as unknown as PrismaService;
  const auditLog = jest.fn().mockResolvedValue(undefined);
  const audit = { log: auditLog };
  const service = new PayrollService(
    prisma,
    {} as TenantPrismaService,
    audit as unknown as AuditService,
    {} as LedgerService,
    {} as PayrollAccountingPreflightService,
  );

  return {
    service,
    transactionClient,
    updateMany,
    findFirstOrThrow,
    auditLog,
    fechaPrevistaPagoPila,
    updatedPeriod,
  };
}

describe('PayrollService.updatePilaPaymentDate', () => {
  it('actualiza y audita la fecha antes de aprobar el período', async () => {
    const {
      service,
      transactionClient,
      updateMany,
      auditLog,
      fechaPrevistaPagoPila,
      updatedPeriod,
    } = makeHarness(PayrollPeriodStatus.CALCULADA);

    const result = await service.updatePilaPaymentDate(
      'tenant-1',
      'user-1',
      'period-1',
      {
        fechaPrevistaPagoPila: '2026-11-05',
      },
    );

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: 'period-1',
        tenantId: 'tenant-1',
        status: {
          in: [
            PayrollPeriodStatus.BORRADOR,
            PayrollPeriodStatus.CALCULADA,
            PayrollPeriodStatus.EN_REVISION,
          ],
        },
      },
      data: { fechaPrevistaPagoPila },
    });
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PAYROLL_PILA_PAYMENT_DATE_UPDATED',
        tenantId: 'tenant-1',
        userId: 'user-1',
        entityType: 'PayrollPeriod',
        entityId: 'period-1',
        metadata: { fechaAnterior: null, fechaNueva: '2026-11-05' },
      }),
      transactionClient,
    );
    expect(result).toEqual(updatedPeriod);
  });

  it('permite quitar y audita la fecha prevista antes de aprobar', async () => {
    const previousDate = new Date('2026-11-05T00:00:00.000Z');
    const { service, updateMany, auditLog, updatedPeriod } = makeHarness(
      PayrollPeriodStatus.CALCULADA,
      1,
      null,
      previousDate,
    );

    const result = await service.updatePilaPaymentDate(
      'tenant-1',
      'user-1',
      'period-1',
      { fechaPrevistaPagoPila: null },
    );

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { fechaPrevistaPagoPila: null } }),
    );
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { fechaAnterior: '2026-11-05', fechaNueva: null },
      }),
      expect.any(Object),
    );
    expect(result).toEqual(updatedPeriod);
  });

  it('rechaza la omisión del campo para distinguirla de quitar la fecha', async () => {
    const { service } = makeHarness(PayrollPeriodStatus.CALCULADA);

    await expect(
      service.updatePilaPaymentDate('tenant-1', 'user-1', 'period-1', {
        fechaPrevistaPagoPila: undefined as unknown as null,
      }),
    ).rejects.toThrow('Debe indicar una fecha prevista o null para quitarla');
  });

  it('bloquea la edición después de aprobar la nómina', async () => {
    const { service, updateMany, auditLog } = makeHarness(
      PayrollPeriodStatus.APROBADA,
    );

    await expect(
      service.updatePilaPaymentDate('tenant-1', 'user-1', 'period-1', {
        fechaPrevistaPagoPila: '2026-11-05',
      }),
    ).rejects.toThrow(ConflictException);
    expect(updateMany).not.toHaveBeenCalled();
    expect(auditLog).not.toHaveBeenCalled();
  });

  it('rechaza una actualización concurrente sin registrar auditoría', async () => {
    const { service, updateMany, findFirstOrThrow, auditLog } = makeHarness(
      PayrollPeriodStatus.CALCULADA,
      0,
    );

    await expect(
      service.updatePilaPaymentDate('tenant-1', 'user-1', 'period-1', {
        fechaPrevistaPagoPila: '2026-11-05',
      }),
    ).rejects.toThrow(ConflictException);
    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(auditLog).not.toHaveBeenCalled();
    expect(findFirstOrThrow).not.toHaveBeenCalled();
  });
});
