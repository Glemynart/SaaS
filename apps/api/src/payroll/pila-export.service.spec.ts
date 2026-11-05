import { createHash } from 'node:crypto';
import { ConflictException } from '@nestjs/common';
import { PilaExportStatus, PayrollPeriodStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { StorageService } from '../storage/storage.service';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import type { TenantPrismaClient } from '../tenant-prisma/tenant-prisma.service';
import * as snapshotExport from './pila-at2-v30-snapshot-export';
import {
  PILA_AT2_V30_LOCAL_FILE_FORMAT_VERSION,
  type PilaAt2V30LocalFiles,
} from './pila-at2-v30-file-export';
import * as preparation from './pila-preparation';
import { PilaExportService } from './pila-export.service';

describe('PilaExportService', () => {
  const now = new Date('2026-11-05T12:00:00.000Z');
  const period = {
    id: 'period-1',
    status: PayrollPeriodStatus.APROBADA,
    fechaInicio: new Date('2026-10-01T00:00:00.000Z'),
    fechaFin: new Date('2026-10-31T00:00:00.000Z'),
  };
  const snapshots = [
    {
      id: 'snapshot-1',
      employeeId: 'employee-1',
      pilaPayloadVersion: 9,
      pilaPayload: { schemaVersion: 9 },
    },
  ];
  const employeeIds = ['employee-1'];
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

  let tx: {
    payrollPeriod: { findFirst: jest.Mock };
    payrollCorrection: { findFirst: jest.Mock };
    payrollRun: { findMany: jest.Mock };
    payrollSnapshot: { findMany: jest.Mock };
    pilaExport: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
    };
  };
  let execute: jest.MockedFunction<TenantPrismaService['execute']>;
  let storage: {
    putObject: jest.Mock;
    getObject: jest.Mock;
    deleteObject: jest.Mock;
  };
  let audit: { log: jest.Mock };
  let service: PilaExportService;
  let stored: Map<string, Buffer>;
  let createdData: Record<string, unknown> | undefined;

  beforeEach(() => {
    jest.restoreAllMocks();
    stored = new Map();
    createdData = undefined;
    tx = {
      payrollPeriod: { findFirst: jest.fn().mockResolvedValue(period) },
      payrollCorrection: { findFirst: jest.fn().mockResolvedValue(null) },
      payrollRun: {
        findMany: jest
          .fn()
          .mockResolvedValue(employeeIds.map((employeeId) => ({ employeeId }))),
      },
      payrollSnapshot: { findMany: jest.fn().mockResolvedValue(snapshots) },
      pilaExport: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn(),
        create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
          createdData = data;
          return Promise.resolve({
            ...data,
            createdAt: now,
            status: PilaExportStatus.LOCAL_VALIDATED,
            normativeRuleVersions: data.normativeRuleVersions,
            sourceSnapshotIds: data.sourceSnapshotIds,
            type1Sha256: data.type1Sha256,
            type1SizeBytes: data.type1SizeBytes,
            type1RecordCount: data.type1RecordCount,
            type2Sha256: data.type2Sha256,
            type2SizeBytes: data.type2SizeBytes,
            type2RecordCount: data.type2RecordCount,
            detailRecordCount: data.detailRecordCount,
          });
        }),
      },
    };
    execute = jest.fn(async (work) =>
      work(
        tx as unknown as TenantPrismaClient,
        { tenantId: 'tenant-1' } as never,
      ),
    ) as jest.MockedFunction<TenantPrismaService['execute']>;
    storage = {
      putObject: jest.fn(({ key, body }: { key: string; body: Buffer }) => {
        stored.set(key, body);
        return Promise.resolve({ key, size: body.length });
      }),
      getObject: jest.fn((key: string) => {
        const body = stored.get(key);
        if (!body) return Promise.reject(new Error('missing object'));
        return Promise.resolve(body);
      }),
      deleteObject: jest.fn((key: string) => {
        stored.delete(key);
        return Promise.resolve();
      }),
    };
    audit = { log: jest.fn().mockResolvedValue({ id: 'audit-1' }) };
    service = new PilaExportService(
      { execute } as unknown as TenantPrismaService,
      storage as unknown as StorageService,
      audit as unknown as AuditService,
    );
    jest.spyOn(preparation, 'buildPilaPreparationReport').mockReturnValue({
      archivoGenerable: true,
      issues: [],
      period: {
        fechaInicio: '2026-10-01',
        fechaFin: '2026-10-31',
        fechaPrevistaPagoPila: '2026-11-06',
      },
      detailRecordSequence: {
        status: 'CANDIDATE',
        candidateRecords: 1,
        ruleVersion: 'AT2_V30_DETAIL_RECORD_SEQUENCE_BY_EMPLOYEE_ID_V1',
        pendingReason: null,
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

  it('persists one immutable export, hashes both files, and audits generation', async () => {
    const result = await service.create('tenant-1', 'user-1', 'period-1');

    expect(result).toMatchObject({
      status: PilaExportStatus.LOCAL_VALIDATED,
      normativeVersion: 'AT2_V30',
      fileFormatVersion: PILA_AT2_V30_LOCAL_FILE_FORMAT_VERSION,
      sourceSnapshotCount: 1,
      type1: {
        sha256: createHash('sha256').update(files.type1File).digest('hex'),
        sizeBytes: files.type1File.length,
      },
      type2: {
        sha256: createHash('sha256').update(files.type2File).digest('hex'),
        sizeBytes: files.type2File.length,
      },
      operatorCompatibilityStatus: 'NOT_VERIFIED',
    });
    expect(tx.pilaExport.create).toHaveBeenCalledTimes(1);
    expect(createdData).toMatchObject({
      tenantId: 'tenant-1',
      payrollPeriodId: 'period-1',
      createdByUserId: 'user-1',
      sourceSnapshotIds: ['snapshot-1'],
    });
    expect(stored.size).toBe(2);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'pila.export.generated',
        entityType: 'PilaExport',
      }),
      tx,
    );
  });

  it('returns the existing export on a retry without writing duplicate objects', async () => {
    tx.pilaExport.findUnique.mockResolvedValueOnce({
      id: 'existing-export',
      createdAt: now,
      status: PilaExportStatus.LOCAL_VALIDATED,
      fechaInicioPeriodo: period.fechaInicio,
      fechaFinPeriodo: period.fechaFin,
      fechaPrevistaPagoPila: new Date('2026-11-06T00:00:00.000Z'),
      normativeVersion: 'AT2_V30',
      fileFormatVersion: PILA_AT2_V30_LOCAL_FILE_FORMAT_VERSION,
      normativeRuleVersions: ['PILA_AT2_V30_MVP_RULESET_V1'],
      sourceSnapshotIds: ['snapshot-1'],
      type1Sha256: 'a'.repeat(64),
      type1SizeBytes: 6,
      type1RecordCount: 1,
      type2Sha256: 'b'.repeat(64),
      type2SizeBytes: 6,
      type2RecordCount: 2,
      detailRecordCount: 1,
    });

    const result = await service.create('tenant-1', 'user-1', 'period-1');

    expect(result.id).toBe('existing-export');
    expect(storage.putObject).not.toHaveBeenCalled();
    expect(tx.pilaExport.create).not.toHaveBeenCalled();
  });

  it('does not generate when an approved correction is outside the export scope', async () => {
    tx.payrollCorrection.findFirst.mockResolvedValue({ id: 'correction-1' });

    await expect(
      service.create('tenant-1', 'user-1', 'period-1'),
    ).rejects.toThrow(ConflictException);
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it('rechecks approved corrections before persistence and removes staged files', async () => {
    tx.payrollCorrection.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'correction-raced' });

    await expect(
      service.create('tenant-1', 'user-1', 'period-1'),
    ).rejects.toThrow(ConflictException);

    expect(tx.pilaExport.create).not.toHaveBeenCalled();
    expect(stored.size).toBe(0);
    expect(storage.deleteObject).toHaveBeenCalledTimes(2);
  });

  it('rejects period changes detected before persistence and removes staged files', async () => {
    tx.payrollPeriod.findFirst
      .mockResolvedValueOnce(period)
      .mockResolvedValueOnce({
        ...period,
        fechaFin: new Date('2026-11-01T00:00:00.000Z'),
      });

    await expect(
      service.create('tenant-1', 'user-1', 'period-1'),
    ).rejects.toThrow(ConflictException);

    expect(tx.pilaExport.create).not.toHaveBeenCalled();
    expect(stored.size).toBe(0);
    expect(storage.deleteObject).toHaveBeenCalledTimes(2);
  });

  it('downloads only the requested tenant export after verifying its hash and audits it', async () => {
    const type1Key = 'tenants/tenant-1/pila-exports/export-1/type-1.txt';
    stored.set(type1Key, files.type1File);
    tx.pilaExport.findFirst.mockResolvedValue({
      id: 'export-1',
      status: PilaExportStatus.LOCAL_VALIDATED,
      fechaInicioPeriodo: period.fechaInicio,
      fechaFinPeriodo: period.fechaFin,
      type1StorageKey: type1Key,
      type1Sha256: createHash('sha256').update(files.type1File).digest('hex'),
      type2StorageKey: 'unused-type-2-key',
      type2Sha256: 'b'.repeat(64),
    });

    const result = await service.download(
      'tenant-1',
      'user-1',
      'period-1',
      'export-1',
      'type-1',
    );

    expect(result.filename).toBe('pila-2026-10-01-2026-10-31-type-1.txt');
    expect(result.body).toEqual(files.type1File);
    expect(tx.pilaExport.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'export-1',
          tenantId: 'tenant-1',
          payrollPeriodId: 'period-1',
        },
      }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'pila.export.downloaded' }),
      tx,
    );
  });
});
