import { createHash } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { StorageService } from '../storage/storage.service';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import { PilaExportReconciliationService } from './pila-export-reconciliation.service';

describe('PilaExportReconciliationService', () => {
  const tenantId = '11111111-2222-4333-8444-555555555555';
  const exportId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
  const type1 = Buffer.from('pila type 1');
  const type2 = Buffer.from('pila type 2');
  const prefix = `tenants/${tenantId}/pila-exports/`;
  const type1Key = `${prefix}${exportId}/type-1.txt`;
  const type2Key = `${prefix}${exportId}/type-2.txt`;
  const objects = new Map<string, Buffer>();
  const records: Record<string, unknown>[] = [];
  const tx = {
    $executeRaw: jest.fn().mockResolvedValue(0),
    auditLog: { findFirst: jest.fn() },
    pilaExport: {
      findMany: jest.fn().mockImplementation(() => Promise.resolve(records)),
    },
  };
  const tenantPrisma = {
    execute: jest.fn((work: (client: typeof tx) => unknown) => work(tx)),
  };
  const storage = {
    listObjects: jest.fn((requestedPrefix: string) =>
      Promise.resolve(
        [...objects.entries()]
          .filter(([key]) => key.startsWith(requestedPrefix))
          .map(([key, body]) => ({ key, size: body.length }))
          .sort((left, right) => left.key.localeCompare(right.key)),
      ),
    ),
    getObject: jest.fn(),
    getObjectWithinPrefix: jest.fn((key: string, requestedPrefix: string) => {
      if (!key.startsWith(requestedPrefix)) {
        return Promise.reject(new Error('outside scoped prefix'));
      }
      const body = objects.get(key);
      if (!body) return Promise.reject(new Error(`missing object: ${key}`));
      return Promise.resolve(body);
    }),
    deleteObject: jest.fn(),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const service = new PilaExportReconciliationService(
    tenantPrisma as unknown as TenantPrismaService,
    storage as unknown as StorageService,
    audit as unknown as AuditService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    objects.clear();
    records.splice(0, records.length);
    tx.auditLog.findFirst.mockResolvedValue(null);
    tx.pilaExport.findMany.mockImplementation(() => Promise.resolve(records));
    tenantPrisma.execute.mockImplementation(
      (work: (client: typeof tx) => unknown) => work(tx),
    );
  });

  it('lee los archivos únicamente con la capacidad de prefijo del tenant', async () => {
    objects.set(type1Key, type1);
    objects.set(type2Key, type2);
    records.push({
      id: exportId,
      status: 'CONFIRMED',
      type1StorageKey: type1Key,
      type1Sha256: sha256(type1),
      type1SizeBytes: type1.length,
      type2StorageKey: type2Key,
      type2Sha256: sha256(type2),
      type2SizeBytes: type2.length,
    });

    const report = await service.reconcile(tenantId, 'admin-id');

    expect(report.findings).toEqual([]);
    expect(storage.listObjects).toHaveBeenCalledWith(prefix);
    expect(storage.getObjectWithinPrefix).toHaveBeenNthCalledWith(
      1,
      type1Key,
      prefix,
    );
    expect(storage.getObjectWithinPrefix).toHaveBeenNthCalledWith(
      2,
      type2Key,
      prefix,
    );
    expect(storage.getObject).not.toHaveBeenCalled();
  });

  it('never reads a key referenced from another tenant', async () => {
    const foreignKey = `tenants/99999999-8888-4777-8666-555555555555/pila-exports/${exportId}/type-1.txt`;
    objects.set(type2Key, type2);
    records.push({
      id: exportId,
      status: 'CONFIRMED',
      type1StorageKey: foreignKey,
      type1Sha256: sha256(Buffer.from('foreign')),
      type1SizeBytes: Buffer.from('foreign').length,
      type2StorageKey: type2Key,
      type2Sha256: sha256(type2),
      type2SizeBytes: type2.length,
    });

    const report = await service.reconcile(tenantId, 'admin-id');

    expect(report.findings).toContainEqual({
      code: 'CROSS_TENANT_STORAGE_REFERENCE',
      exportId,
      fileType: 'type-1',
    });
    expect(storage.getObjectWithinPrefix).toHaveBeenCalledTimes(1);
    expect(storage.getObjectWithinPrefix).toHaveBeenCalledWith(
      type2Key,
      prefix,
    );
    expect(storage.getObjectWithinPrefix).not.toHaveBeenCalledWith(
      foreignKey,
      expect.anything(),
    );
    expect(storage.getObject).not.toHaveBeenCalled();
    expect(JSON.stringify(report)).not.toContain(foreignKey);
  });
});

function sha256(value: Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}
