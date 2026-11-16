import { Prisma } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { AuditService } from '../audit/audit.service';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';

describe('AlertsService tenant-scoped persistence', () => {
  const tenantId = 'tenant-1';
  const alertId = 'alert-1';
  const userId = 'user-1';

  let findFirst: jest.Mock;
  let findMany: jest.Mock;
  let count: jest.Mock;
  let updateMany: jest.Mock;
  let execute: jest.Mock;
  let auditLog: jest.Mock;
  let service: AlertsService;
  let tx: Prisma.TransactionClient;

  beforeEach(() => {
    findFirst = jest.fn();
    findMany = jest.fn();
    count = jest.fn();
    updateMany = jest.fn();
    auditLog = jest.fn().mockResolvedValue(undefined);
    tx = {
      alert: { findFirst, findMany, count, updateMany },
    } as unknown as Prisma.TransactionClient;
    execute = jest.fn((work: (client: Prisma.TransactionClient) => unknown) =>
      work(tx),
    );

    service = new AlertsService(
      { execute } as unknown as TenantPrismaService,
      { log: auditLog } as unknown as AuditService,
    );
  });

  it('reads alert rows, document links, and stats through one tenant transaction', async () => {
    const alert = { id: alertId, tenantId, expedienteDoc: { id: 'doc-1' } };
    findMany.mockResolvedValue([alert]);
    count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1);

    await expect(service.findAll(tenantId, {})).resolves.toEqual({
      data: [alert],
      stats: { open: 1, resolved: 0, critical: 1 },
      meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
    });

    expect(execute).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId },
      }),
    );
  });

  it('reads a single alert and its document link through tenant context', async () => {
    const alert = { id: alertId, tenantId, expedienteDoc: { id: 'doc-1' } };
    findFirst.mockResolvedValue(alert);

    await expect(service.findOne(tenantId, alertId)).resolves.toBe(alert);

    expect(execute).toHaveBeenCalledTimes(1);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: alertId, tenantId },
      }),
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
