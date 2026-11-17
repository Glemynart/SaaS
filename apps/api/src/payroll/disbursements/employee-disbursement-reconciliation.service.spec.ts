import { createHash } from 'node:crypto';
import { EmployeeDisbursementStatus } from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import { StorageService } from '../../storage/storage.service';
import { TenantPrismaService } from '../../tenant-prisma/tenant-prisma.service';
import { EmployeeDisbursementReconciliationService } from './employee-disbursement-reconciliation.service';

const TENANT_ID = 'tenant-a';
const PAYMENT_ID = 'payment-a';
const UUID = '00000000-0000-4000-8000-000000000001';
const KEY = `tenants/${TENANT_ID}/employee-disbursements/${PAYMENT_ID}/${UUID}.pdf`;
const BODY = Buffer.from('private receipt');
const HASH = createHash('sha256').update(BODY).digest('hex');

describe('EmployeeDisbursementReconciliationService', () => {
  const records: Record<string, unknown>[] = [];
  const objects = new Map<string, Buffer>();
  const tx = {
    $executeRaw: jest.fn().mockResolvedValue(0),
    auditLog: { findFirst: jest.fn() },
    employeeDisbursement: {
      findMany: jest.fn().mockImplementation(() => Promise.resolve(records)),
    },
  };
  const tenantPrisma = {
    execute: jest.fn((work: (client: typeof tx) => unknown) => work(tx)),
  };
  const storage = {
    listObjects: jest.fn((prefix: string) =>
      Promise.resolve(
        [...objects.entries()]
          .filter(([key]) => key.startsWith(prefix))
          .map(([key, body]) => ({ key, size: body.length }))
          .sort((left, right) => left.key.localeCompare(right.key)),
      ),
    ),
    getObjectWithinPrefix: jest.fn((key: string, prefix: string) => {
      if (!key.startsWith(prefix))
        return Promise.reject(new Error('outside scoped prefix'));
      const body = objects.get(key);
      if (!body)
        return Promise.reject(new Error(`missing test object: ${key}`));
      return Promise.resolve(body);
    }),
    deleteObject: jest.fn(),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const service = new EmployeeDisbursementReconciliationService(
    tenantPrisma as unknown as TenantPrismaService,
    storage as unknown as StorageService,
    audit as unknown as AuditService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    records.splice(0, records.length);
    objects.clear();
    tx.auditLog.findFirst.mockResolvedValue(null);
    tx.employeeDisbursement.findMany.mockImplementation(() =>
      Promise.resolve(records),
    );
    tenantPrisma.execute.mockImplementation(
      (work: (client: typeof tx) => unknown) => work(tx),
    );
    storage.listObjects.mockImplementation((prefix: string) =>
      Promise.resolve(
        [...objects.entries()]
          .filter(([key]) => key.startsWith(prefix))
          .map(([key, body]) => ({ key, size: body.length }))
          .sort((left, right) => left.key.localeCompare(right.key)),
      ),
    );
    storage.getObjectWithinPrefix.mockImplementation(
      (key: string, prefix: string) => {
        if (!key.startsWith(prefix))
          return Promise.reject(new Error('outside scoped prefix'));
        const body = objects.get(key);
        if (!body)
          return Promise.reject(new Error(`missing test object: ${key}`));
        return Promise.resolve(body);
      },
    );
  });

  it('detects a missing object, size and hash mismatch, and possible duplicate content without modifying storage', async () => {
    const wrongExpectedHash = '0'.repeat(64);
    records.push({
      id: PAYMENT_ID,
      status: EmployeeDisbursementStatus.VERIFIED,
      supportStorageKey: KEY,
      supportMimeType: 'application/pdf',
      supportSizeBytes: BODY.length + 1,
      supportSha256: wrongExpectedHash,
      supportedAt: new Date('2026-11-16T00:00:00.000Z'),
    });
    objects.set(KEY, BODY);
    const orphanKey = `tenants/${TENANT_ID}/employee-disbursements/unregistered/${UUID}.pdf`;
    objects.set(orphanKey, BODY);

    const before = [...objects.entries()].map(([key, value]) => [
      key,
      Buffer.from(value),
    ]);
    const report = await service.reconcile(TENANT_ID, 'admin-a');

    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'SUPPORT_SIZE_MISMATCH',
          disbursementId: PAYMENT_ID,
        }),
        expect.objectContaining({
          code: 'SUPPORT_HASH_MISMATCH',
          disbursementId: PAYMENT_ID,
        }),
        expect.objectContaining({
          code: 'ORPHAN_STORAGE_OBJECT',
          storageKey: orphanKey,
        }),
      ]),
    );
    const duplicateContentFinding = report.findings.find(
      (finding) => finding.code === 'POSSIBLE_DUPLICATE_OBJECT_CONTENT',
    );
    expect(duplicateContentFinding?.storageKeys).toEqual(
      expect.arrayContaining([KEY, orphanKey]),
    );
    expect(storage.listObjects).toHaveBeenCalledWith(
      `tenants/${TENANT_ID}/employee-disbursements/`,
    );
    expect(storage.getObjectWithinPrefix).toHaveBeenCalledWith(
      KEY,
      `tenants/${TENANT_ID}/employee-disbursements/`,
    );
    expect(storage.deleteObject).not.toHaveBeenCalled();
    expect([...objects.entries()]).toEqual(before);
    expect(report.auditRecorded).toBe(true);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT_ID,
        userId: 'admin-a',
        action: 'employee.disbursement.support.reconciled',
      }),
      expect.anything(),
    );
  });

  it('detects cross-tenant references but never lists or reads another tenant prefix', async () => {
    const foreignKey = `tenants/tenant-b/employee-disbursements/${PAYMENT_ID}/${UUID}.pdf`;
    records.push({
      id: PAYMENT_ID,
      status: EmployeeDisbursementStatus.SUPPORTED,
      supportStorageKey: foreignKey,
      supportMimeType: 'application/pdf',
      supportSizeBytes: BODY.length,
      supportSha256: HASH,
      supportedAt: new Date('2026-11-16T00:00:00.000Z'),
    });

    const report = await service.reconcile(TENANT_ID, 'admin-a');

    expect(report.findings).toContainEqual({
      code: 'CROSS_TENANT_STORAGE_REFERENCE',
      disbursementId: PAYMENT_ID,
    });
    expect(storage.listObjects).toHaveBeenCalledTimes(1);
    expect(storage.listObjects).toHaveBeenCalledWith(
      `tenants/${TENANT_ID}/employee-disbursements/`,
    );
    expect(storage.getObjectWithinPrefix).not.toHaveBeenCalled();
    expect(JSON.stringify(report)).not.toContain('tenant-b');
  });

  it('deduplicates audit events for the same observed state', async () => {
    records.push({
      id: PAYMENT_ID,
      status: EmployeeDisbursementStatus.SUPPORTED,
      supportStorageKey: KEY,
      supportMimeType: 'application/pdf',
      supportSizeBytes: BODY.length,
      supportSha256: HASH,
      supportedAt: new Date('2026-11-16T00:00:00.000Z'),
    });
    objects.set(KEY, BODY);
    tx.auditLog.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'audit-existing' });

    const first = await service.reconcile(TENANT_ID, 'admin-a');
    const second = await service.reconcile(TENANT_ID, 'admin-a');

    expect(first.fingerprint).toBe(second.fingerprint);
    expect(first.auditRecorded).toBe(true);
    expect(second.auditRecorded).toBe(false);
    expect(audit.log).toHaveBeenCalledTimes(1);
  });
});
