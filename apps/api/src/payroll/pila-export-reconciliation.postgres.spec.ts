import { createHash, randomUUID } from 'node:crypto';
import { PayrollPeriodStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageObjectNotFoundError } from '../storage/storage.types';
import { StorageService } from '../storage/storage.service';
import { TenantContextBoundary } from '../tenant-context/tenant-context.boundary';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import { PilaExportReconciliationService } from './pila-export-reconciliation.service';

jest.setTimeout(30_000);

describe('PilaExportReconciliationService PostgreSQL', () => {
  const tenantId = randomUUID();
  const otherTenantId = randomUUID();
  const userId = randomUUID();
  const validId = randomUUID();
  const missingId = randomUUID();
  const corruptId = randomUUID();
  const crossTenantId = randomUUID();
  const suffix = randomUUID().replaceAll('-', '');
  const context = {
    tenantId,
    userId,
    rol: 'ADMIN',
    email: `pila-reconciliation-${suffix}@example.test`,
  } as const;
  const contextService = new TenantContextService();
  const prisma = new PrismaService();
  const tenantPrisma = new TenantPrismaService(
    prisma,
    new TenantContextBoundary(contextService),
  );
  const audit = new AuditService(prisma, tenantPrisma, contextService);
  const objects = new Map<string, Buffer>();
  const storage = {
    listObjects: jest.fn((prefix: string) =>
      Promise.resolve(
        [...objects.entries()]
          .filter(([key]) => key.startsWith(prefix))
          .map(([key, body]) => ({ key, size: body.length }))
          .sort((left, right) => left.key.localeCompare(right.key)),
      ),
    ),
    getObject: jest.fn((key: string) => {
      const body = objects.get(key);
      if (!body) return Promise.reject(new StorageObjectNotFoundError(key));
      return Promise.resolve(body);
    }),
    deleteObject: jest.fn((key: string) => {
      objects.delete(key);
      return Promise.resolve();
    }),
  };
  const service = new PilaExportReconciliationService(
    tenantPrisma,
    storage as unknown as StorageService,
    audit,
  );
  let connected = false;

  beforeAll(async () => {
    assertDisposableDatabase();
    await prisma.$connect();
    connected = true;
    await createTenant(tenantId, userId, context.email, suffix);
    await createTenant(
      otherTenantId,
      randomUUID(),
      `other-${suffix}@example.test`,
      `other${suffix}`,
    );

    const valid1 = Buffer.from('valid-type-1');
    const valid2 = Buffer.from('valid-type-2');
    const corrupt1 = Buffer.from('bad-type-1!');
    const foreignKey = `tenants/${otherTenantId}/pila-exports/${crossTenantId}/type-1.txt`;

    objects.set(keyFor(validId, 'type-1'), valid1);
    objects.set(keyFor(validId, 'type-2'), valid2);
    objects.set(keyFor(missingId, 'type-1'), Buffer.from('missing-pair'));
    objects.set(keyFor(corruptId, 'type-1'), corrupt1);
    objects.set(keyFor(corruptId, 'type-2'), valid2);
    objects.set(keyFor(crossTenantId, 'type-2'), valid2);
    objects.set(foreignKey, Buffer.from('must-never-be-read'));
    objects.set(
      `tenants/${tenantId}/pila-exports/unregistered/type-1.txt`,
      Buffer.from('orphan'),
    );

    await createExport(validId, {
      type1Key: keyFor(validId, 'type-1'),
      type1Body: valid1,
      type2Key: keyFor(validId, 'type-2'),
      type2Body: valid2,
    });
    await createExport(missingId, {
      type1Key: keyFor(missingId, 'type-1'),
      type1Body: Buffer.from('missing-pair'),
      type2Key: keyFor(missingId, 'type-2'),
      type2Body: Buffer.from('absent'),
    });
    await createExport(corruptId, {
      type1Key: keyFor(corruptId, 'type-1'),
      type1Body: Buffer.from('expected-1'),
      type2Key: keyFor(corruptId, 'type-2'),
      type2Body: valid2,
    });
    await createExport(crossTenantId, {
      type1Key: foreignKey,
      type1Body: Buffer.from('other-tenant'),
      type2Key: keyFor(crossTenantId, 'type-2'),
      type2Body: valid2,
    });
  });

  afterAll(async () => {
    if (!connected) return;
    // Export history is append-only. This suite uses a disposable database
    // container, so records are intentionally left intact until that container
    // is discarded after the whole validation run.
    await prisma.$disconnect();
  });

  it('detecta ausencias, corrupción, referencias cruzadas y huérfanos sin reparar ni borrar', async () => {
    const keysBefore = [...objects.entries()].map(([key, body]) => [
      key,
      Buffer.from(body),
    ]);
    const report = await contextService.run(context, () =>
      service.reconcile(tenantId, userId),
    );

    expect(report.scannedExports).toBe(4);
    expect(report.scannedObjects).toBe(7);
    expect(report.findings).toEqual(
      expect.arrayContaining([
        {
          code: 'EXPORT_FILE_MISSING',
          exportId: missingId,
          fileType: 'type-2',
        },
        {
          code: 'EXPORT_FILE_HASH_MISMATCH',
          exportId: corruptId,
          fileType: 'type-1',
        },
        {
          code: 'CROSS_TENANT_STORAGE_REFERENCE',
          exportId: crossTenantId,
          fileType: 'type-1',
        },
        {
          code: 'ORPHAN_STORAGE_OBJECT',
          storageKey: `tenants/${tenantId}/pila-exports/unregistered/type-1.txt`,
        },
      ]),
    );
    expect(
      report.findings.filter(({ code }) => code === 'EXPORT_INCOMPLETE'),
    ).toHaveLength(3);
    expect(
      report.findings.some(({ code }) => code === 'EXPORT_STORAGE_KEY_INVALID'),
    ).toBe(false);
    expect(storage.listObjects).toHaveBeenCalledWith(
      `tenants/${tenantId}/pila-exports/`,
    );
    expect(
      storage.getObject.mock.calls.some(([key]) =>
        key.startsWith(`tenants/${otherTenantId}/`),
      ),
    ).toBe(false);
    expect(storage.deleteObject).not.toHaveBeenCalled();
    expect([...objects.entries()].map(([key, body]) => [key, body])).toEqual(
      keysBefore,
    );
    const second = await contextService.run(context, () =>
      service.reconcile(tenantId, userId),
    );

    expect(report.auditRecorded).toBe(true);
    expect(report.fingerprint).toBe(second.fingerprint);
    expect(second.auditRecorded).toBe(false);
    await expect(
      prisma.auditLog.count({
        where: {
          tenantId,
          action: 'pila.export.reconciled',
          entityId: report.fingerprint,
        },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.auditLog.count({
        where: { tenantId: otherTenantId, action: 'pila.export.reconciled' },
      }),
    ).resolves.toBe(0);
    await expect(
      prisma.pilaExport.count({ where: { tenantId } }),
    ).resolves.toBe(4);

    // A different corrupt payload with the same key and byte count is a new
    // observed state and must receive a distinct, auditable fingerprint.
    objects.set(keyFor(corruptId, 'type-1'), Buffer.from('bad-type-2!'));
    const changedCorruption = await contextService.run(context, () =>
      service.reconcile(tenantId, userId),
    );
    expect(changedCorruption.fingerprint).not.toBe(second.fingerprint);
    expect(changedCorruption.auditRecorded).toBe(true);
    await expect(
      prisma.auditLog.count({
        where: {
          tenantId,
          action: 'pila.export.reconciled',
          entityId: changedCorruption.fingerprint,
        },
      }),
    ).resolves.toBe(1);
  });

  async function createTenant(
    id: string,
    actorId: string,
    email: string,
    tenantSuffix: string,
  ) {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${id}, true)`;
      await tx.tenant.create({
        data: {
          id,
          nombre: `PILA reconciliation ${tenantSuffix.slice(0, 8)}`,
          nit: `9${tenantSuffix.slice(0, 9)}`,
          digitoVerif: '1',
          razonSocial: `PILA reconciliation ${tenantSuffix.slice(0, 8)}`,
        },
      });
      await tx.user.create({
        data: {
          id: actorId,
          tenantId: id,
          email,
          passwordHash: 'test-only-not-a-password',
          nombre: 'Usuario',
          apellido: 'Prueba',
          rol: 'ADMIN',
        },
      });
      await tx.payrollPeriod.create({
        data: {
          id: `period-${id}`,
          tenantId: id,
          nombre: 'Período de reconciliación',
          fechaInicio: new Date('2026-10-01T00:00:00.000Z'),
          fechaFin: new Date('2026-10-31T00:00:00.000Z'),
          status: PayrollPeriodStatus.APROBADA,
        },
      });
    });
  }

  async function createExport(
    id: string,
    input: {
      type1Key: string;
      type1Body: Buffer;
      type2Key: string;
      type2Body: Buffer;
    },
  ) {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
      await tx.pilaExport.create({
        data: {
          id,
          tenantId,
          payrollPeriodId: `period-${tenantId}`,
          createdByUserId: userId,
          fechaInicioPeriodo: new Date('2026-10-01T00:00:00.000Z'),
          fechaFinPeriodo: new Date('2026-10-31T00:00:00.000Z'),
          fechaPrevistaPagoPila: new Date('2026-11-05T00:00:00.000Z'),
          normativeVersion: 'test-v1',
          fileFormatVersion: 'test-format-v1',
          normativeRuleVersions: ['test-v1'],
          sourceSnapshotIds: [`snapshot-${id}`],
          sourceFingerprint: digest(`source-${id}`),
          type1StorageKey: input.type1Key,
          type1Sha256: digest(input.type1Body),
          type1SizeBytes: input.type1Body.length,
          type1RecordCount: 1,
          type2StorageKey: input.type2Key,
          type2Sha256: digest(input.type2Body),
          type2SizeBytes: input.type2Body.length,
          type2RecordCount: 2,
          detailRecordCount: 1,
        },
      });
    });
  }

  function keyFor(id: string, type: 'type-1' | 'type-2') {
    return `tenants/${tenantId}/pila-exports/${id}/${type}.txt`;
  }

  function digest(body: Buffer | string) {
    return createHash('sha256').update(body).digest('hex');
  }

  function assertDisposableDatabase() {
    const value = process.env.DATABASE_URL;
    if (!value) throw new Error('DATABASE_URL is required for this test.');
    const database = new URL(value);
    const databaseName = decodeURIComponent(database.pathname.slice(1));
    if (
      !['127.0.0.1', 'localhost'].includes(database.hostname) ||
      !/(test|ci)/i.test(databaseName)
    ) {
      throw new Error(
        'This PostgreSQL test requires a loopback test database.',
      );
    }
  }
});
