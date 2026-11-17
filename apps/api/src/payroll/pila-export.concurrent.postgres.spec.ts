import { createHash, randomUUID } from 'node:crypto';
import { PilaExportStatus, PayrollPeriodStatus, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextBoundary } from '../tenant-context/tenant-context.boundary';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import { StorageService } from '../storage/storage.service';
import * as snapshotExport from './pila-at2-v30-snapshot-export';
import {
  PILA_AT2_V30_LOCAL_FILE_FORMAT_VERSION,
  type PilaAt2V30LocalFiles,
} from './pila-at2-v30-file-export';
import * as preparation from './pila-preparation';
import { PilaExportService } from './pila-export.service';

jest.setTimeout(30_000);

describe('PilaExportService PostgreSQL concurrency', () => {
  const suffix = randomUUID().replaceAll('-', '');
  const tenantId = randomUUID();
  const userId = randomUUID();
  const employeeId = randomUUID();
  const periodId = randomUUID();
  const runId = randomUUID();
  const snapshotId = randomUUID();
  const contextService = new TenantContextService();
  const prisma = new PrismaService();
  const tenantPrisma = new TenantPrismaService(
    prisma,
    new TenantContextBoundary(contextService),
  );
  const audit = new AuditService(prisma, tenantPrisma, contextService);
  const context = {
    tenantId,
    userId,
    rol: 'ADMIN',
    email: `pila-export-${suffix}@example.test`,
  } as const;
  const files: PilaAt2V30LocalFiles = {
    formatVersion: PILA_AT2_V30_LOCAL_FILE_FORMAT_VERSION,
    normativeFormat: 'AT2_V30',
    encoding: 'windows-1252',
    recordSeparator: '\r\n',
    finalRecordSeparator: false,
    operatorCompatibilityStatus: 'NOT_VERIFIED',
    type1File: Buffer.from('type-1', 'ascii'),
    type2File: Buffer.from('type-2', 'ascii'),
    recordCounts: { type1: 1, type2: 2, details: 1 },
  };
  const stored = new Map<string, Buffer>();
  let releaseFirstPuts!: () => void;
  let firstPutCount = 0;
  let connected = false;
  const firstTwoPuts = new Promise<void>((resolve) => {
    releaseFirstPuts = resolve;
  });
  const storage = {
    putObject: jest.fn(async ({ key, body }: { key: string; body: Buffer }) => {
      stored.set(key, body);
      if (firstPutCount < 2) {
        firstPutCount += 1;
        if (firstPutCount === 2) releaseFirstPuts();
        await firstTwoPuts;
      }
      return { key, size: body.length };
    }),
    getObject: jest.fn((key: string) => {
      const body = stored.get(key);
      return body
        ? Promise.resolve(body)
        : Promise.reject(new Error('Object not found'));
    }),
    deleteObject: jest.fn((key: string) => Promise.resolve(stored.delete(key))),
  };
  const service = new PilaExportService(
    tenantPrisma,
    storage as unknown as StorageService,
    audit,
  );

  beforeAll(async () => {
    assertDisposableDatabase();
    await prisma.$connect();
    connected = true;
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
      await tx.tenant.create({
        data: {
          id: tenantId,
          nombre: `PILA export concurrency ${suffix.slice(0, 8)}`,
          nit: `7${suffix.slice(0, 9)}`,
          digitoVerif: '1',
          razonSocial: `PILA export concurrency ${suffix.slice(0, 8)}`,
        },
      });
      await tx.user.create({
        data: {
          id: userId,
          tenantId,
          email: context.email,
          passwordHash: 'test-only-not-a-password',
          nombre: 'Usuario',
          apellido: 'Prueba',
          rol: 'ADMIN',
        },
      });
      await tx.empleado.create({
        data: {
          id: employeeId,
          tenantId,
          cedula: `pila-export-${suffix}`,
          primerNombre: 'Empleado',
          primerApellido: 'Prueba',
          cargo: 'Prueba',
          salario: 1_000_000,
          fechaIngreso: new Date('2025-01-01T00:00:00.000Z'),
        },
      });
      await tx.payrollPeriod.create({
        data: {
          id: periodId,
          tenantId,
          nombre: 'Período PILA de prueba',
          fechaInicio: new Date('2026-10-01T00:00:00.000Z'),
          fechaFin: new Date('2026-10-31T00:00:00.000Z'),
          status: PayrollPeriodStatus.APROBADA,
        },
      });
      await tx.payrollRun.create({
        data: {
          id: runId,
          tenantId,
          payrollPeriodId: periodId,
          employeeId,
          totalDevengos: new Prisma.Decimal(1_000_000),
          totalDeducciones: new Prisma.Decimal(80_000),
          netoPagar: new Prisma.Decimal(920_000),
        },
      });
      await tx.payrollSnapshot.create({
        data: {
          id: snapshotId,
          tenantId,
          payrollRunId: runId,
          payrollPeriodId: periodId,
          employeeId,
          estadoPeriodo: PayrollPeriodStatus.APROBADA,
          origen: 'PILA_EXPORT_CONCURRENCY_TEST',
          payload: {},
          pilaPayloadVersion: 1,
          pilaPayload: {},
        },
      });
    });

    jest.spyOn(preparation, 'buildPilaPreparationReport').mockReturnValue({
      archivoGenerable: true,
      issues: [],
      exportReadiness: { blockers: [] },
      period: {
        fechaInicio: '2026-10-01',
        fechaFin: '2026-10-31',
        fechaPrevistaPagoPila: '2026-11-06',
      },
    } as unknown as ReturnType<typeof preparation.buildPilaPreparationReport>);
    jest
      .spyOn(snapshotExport, 'buildPilaAt2V30FileCandidates')
      .mockReturnValue({
        details: [{ normativeRuleVersions: { testRule: 'PILA_TEST_RULE_V1' } }],
      } as unknown as ReturnType<
        typeof snapshotExport.buildPilaAt2V30FileCandidates
      >);
    jest
      .spyOn(snapshotExport, 'composePilaAt2V30FilesFromApprovedSnapshots')
      .mockReturnValue(files);
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    // The export table is append-only by database trigger, so this integration
    // fixture intentionally lives only in the guarded disposable test database.
    if (connected) await prisma.$disconnect();
  });

  it('converges concurrent retries to one export, two verified files, and one audit event', async () => {
    const results = await Promise.all([
      contextService.run(context, () =>
        service.create(tenantId, userId, periodId),
      ),
      contextService.run(context, () =>
        service.create(tenantId, userId, periodId),
      ),
    ]);

    expect(results[0].id).toBe(results[1].id);
    expect(results[0].status).toBe(PilaExportStatus.LOCAL_VALIDATED);
    const [exports, auditCount] = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
      return Promise.all([
        tx.pilaExport.findMany({
          where: { tenantId, payrollPeriodId: periodId },
        }),
        tx.auditLog.count({
          where: { tenantId, action: 'pila.export.generated' },
        }),
      ]);
    });
    expect(exports).toHaveLength(1);
    expect(auditCount).toBe(1);
    expect(stored.size).toBe(2);
    expect(storage.deleteObject).toHaveBeenCalledTimes(2);
    for (const exportRecord of exports) {
      expect(stored.get(exportRecord.type1StorageKey)).toEqual(files.type1File);
      expect(stored.get(exportRecord.type2StorageKey)).toEqual(files.type2File);
      expect(exportRecord.type1Sha256.trim()).toBe(
        createHash('sha256').update(files.type1File).digest('hex'),
      );
      expect(exportRecord.type2Sha256.trim()).toBe(
        createHash('sha256').update(files.type2File).digest('hex'),
      );
    }
  });

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
