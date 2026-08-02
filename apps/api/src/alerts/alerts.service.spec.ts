import { Prisma } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';

describe('AlertsService.resolve', () => {
  const tenantId = 'tenant-1';
  const alertId = 'alert-1';
  const userId = 'user-1';

  let findFirst: jest.Mock;
  let updateMany: jest.Mock;
  let transaction: jest.Mock;
  let auditLog: jest.Mock;
  let service: AlertsService;
  let tx: Prisma.TransactionClient;

  beforeEach(() => {
    findFirst = jest.fn();
    updateMany = jest.fn();
    auditLog = jest.fn().mockResolvedValue(undefined);
    tx = {
      alert: { findFirst, updateMany },
    } as unknown as Prisma.TransactionClient;
    transaction = jest.fn(
      (work: (client: Prisma.TransactionClient) => unknown) => work(tx),
    );

    service = new AlertsService(
      { $transaction: transaction } as unknown as PrismaService,
      {} as TenantPrismaService,
      { log: auditLog } as unknown as AuditService,
    );
  });

  it('resolves the alert and records the actor in the same transaction', async () => {
    const alert = { id: alertId, tenantId, status: 'OPEN' };
    const resolved = {
      ...alert,
      status: 'RESOLVED',
      resolvedAt: new Date('2026-08-02T12:00:00.000Z'),
      resolvedById: userId,
    };
    findFirst.mockResolvedValue(alert);
    findFirst.mockResolvedValueOnce(alert).mockResolvedValueOnce(resolved);
    updateMany.mockResolvedValue({ count: 1 });

    await service.resolve(tenantId, alertId, userId);

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: alertId, tenantId },
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: alertId, tenantId, status: 'OPEN' },
      data: {
        status: 'RESOLVED',
        resolvedAt: expect.any(Date) as Date,
        resolvedById: userId,
      },
    });
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        userId,
        action: 'ALERT_RESOLVED',
        entityType: 'Alert',
        entityId: alertId,
      }),
      tx,
    );
  });

  it('is idempotent when the alert was already resolved', async () => {
    const alert = {
      id: alertId,
      tenantId,
      status: 'RESOLVED',
      resolvedById: 'previous-user',
    };
    findFirst.mockResolvedValue(alert);

    await expect(service.resolve(tenantId, alertId, userId)).resolves.toBe(
      alert,
    );

    expect(updateMany).not.toHaveBeenCalled();
    expect(auditLog).not.toHaveBeenCalled();
  });

  it('does not resolve an alert from another tenant', async () => {
    findFirst.mockResolvedValue(null);

    await expect(
      service.resolve(tenantId, alertId, userId),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(updateMany).not.toHaveBeenCalled();
    expect(auditLog).not.toHaveBeenCalled();
  });

  it('rolls back the resolution when audit persistence fails', async () => {
    findFirst.mockResolvedValue({ id: alertId, tenantId, status: 'OPEN' });
    updateMany.mockResolvedValue({ count: 1 });
    auditLog.mockRejectedValue(new Error('audit unavailable'));

    await expect(service.resolve(tenantId, alertId, userId)).rejects.toThrow(
      'audit unavailable',
    );
    expect(updateMany).toHaveBeenCalled();
  });

  it('does not audit a concurrent resolution that already won the update', async () => {
    const resolved = {
      id: alertId,
      tenantId,
      status: 'RESOLVED',
      resolvedById: 'other-user',
    };
    findFirst.mockResolvedValueOnce({ id: alertId, tenantId, status: 'OPEN' });
    findFirst.mockResolvedValueOnce(resolved);
    updateMany.mockResolvedValue({ count: 0 });

    await expect(service.resolve(tenantId, alertId, userId)).resolves.toBe(
      resolved,
    );

    expect(auditLog).not.toHaveBeenCalled();
  });
});
