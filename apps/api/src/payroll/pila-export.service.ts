import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { PilaExportStatus, PayrollPeriodStatus, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { StorageService } from '../storage/storage.service';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import type { TenantPrismaClient } from '../tenant-prisma/tenant-prisma.service';
import {
  buildPilaAt2V30FileCandidates,
  composePilaAt2V30FilesFromApprovedSnapshots,
} from './pila-at2-v30-snapshot-export';
import {
  PilaAt2V30FileExportBlockedError,
  PILA_AT2_V30_LOCAL_FILE_FORMAT_VERSION,
  type PilaAt2V30LocalFiles,
} from './pila-at2-v30-file-export';
import { buildPilaPreparationReport } from './pila-preparation';

const NORMATIVE_VERSION = 'AT2_V30';
const RULESET_VERSION = 'PILA_AT2_V30_MVP_RULESET_V1';

const exportSummarySelect = {
  id: true,
  createdAt: true,
  status: true,
  fechaInicioPeriodo: true,
  fechaFinPeriodo: true,
  fechaPrevistaPagoPila: true,
  normativeVersion: true,
  fileFormatVersion: true,
  normativeRuleVersions: true,
  sourceSnapshotIds: true,
  type1Sha256: true,
  type1SizeBytes: true,
  type1RecordCount: true,
  type2Sha256: true,
  type2SizeBytes: true,
  type2RecordCount: true,
  detailRecordCount: true,
} satisfies Prisma.PilaExportSelect;

type ExportSummaryRecord = Prisma.PilaExportGetPayload<{
  select: typeof exportSummarySelect;
}>;

export interface PilaExportSummary {
  id: string;
  createdAt: string;
  status: PilaExportStatus;
  period: {
    fechaInicio: string;
    fechaFin: string;
    fechaPrevistaPagoPila: string | null;
  };
  normativeVersion: string;
  fileFormatVersion: string;
  normativeRuleVersions: string[];
  sourceSnapshotCount: number;
  type1: { sha256: string; sizeBytes: number; recordCount: number };
  type2: {
    sha256: string;
    sizeBytes: number;
    recordCount: number;
    detailRecordCount: number;
  };
  operatorCompatibilityStatus: 'NOT_VERIFIED';
}

interface ApprovedSource {
  period: {
    id: string;
    status: PayrollPeriodStatus;
    fechaInicio: Date;
    fechaFin: Date;
  };
  employeeIds: string[];
  snapshots: Array<{
    id: string;
    employeeId: string;
    pilaPayloadVersion: number | null;
    pilaPayload: Prisma.JsonValue | null;
  }>;
}

function isApprovedStatus(status: PayrollPeriodStatus): boolean {
  return (
    status === PayrollPeriodStatus.APROBADA ||
    status === PayrollPeriodStatus.CAUSADA
  );
}

async function readApprovedSource(
  tx: TenantPrismaClient,
  tenantId: string,
  periodId: string,
): Promise<ApprovedSource> {
  const period = await tx.payrollPeriod.findFirst({
    where: { id: periodId, tenantId },
    select: { id: true, status: true, fechaInicio: true, fechaFin: true },
  });
  if (!period) throw new NotFoundException('Período no encontrado.');
  if (!isApprovedStatus(period.status)) {
    throw new ConflictException(
      'La exportación PILA requiere una nómina aprobada o causada.',
    );
  }

  const approvedCorrection = await tx.payrollCorrection.findFirst({
    where: {
      tenantId,
      payrollPeriodId: periodId,
      status: 'APROBADA',
    },
    select: { id: true },
  });
  if (approvedCorrection) {
    throw new ConflictException(
      'El período tiene una corrección aprobada que esta versión del exportador no incorpora. Revise la corrección antes de generar PILA.',
    );
  }

  const [runs, snapshots] = await Promise.all([
    tx.payrollRun.findMany({
      where: { tenantId, payrollPeriodId: periodId },
      select: { employeeId: true },
      orderBy: { employeeId: 'asc' },
    }),
    tx.payrollSnapshot.findMany({
      where: { tenantId, payrollPeriodId: periodId },
      select: {
        id: true,
        employeeId: true,
        pilaPayloadVersion: true,
        pilaPayload: true,
      },
      orderBy: [{ employeeId: 'asc' }, { createdAt: 'asc' }],
    }),
  ]);

  return {
    period,
    employeeIds: runs.map(({ employeeId }) => employeeId),
    snapshots,
  };
}

function summarize(record: ExportSummaryRecord): PilaExportSummary {
  return {
    id: record.id,
    createdAt: record.createdAt.toISOString(),
    status: record.status,
    period: {
      fechaInicio: record.fechaInicioPeriodo.toISOString().slice(0, 10),
      fechaFin: record.fechaFinPeriodo.toISOString().slice(0, 10),
      fechaPrevistaPagoPila:
        record.fechaPrevistaPagoPila?.toISOString().slice(0, 10) ?? null,
    },
    normativeVersion: record.normativeVersion,
    fileFormatVersion: record.fileFormatVersion,
    normativeRuleVersions: record.normativeRuleVersions,
    sourceSnapshotCount: record.sourceSnapshotIds.length,
    type1: {
      sha256: record.type1Sha256.trim(),
      sizeBytes: record.type1SizeBytes,
      recordCount: record.type1RecordCount,
    },
    type2: {
      sha256: record.type2Sha256.trim(),
      sizeBytes: record.type2SizeBytes,
      recordCount: record.type2RecordCount,
      detailRecordCount: record.detailRecordCount,
    },
    operatorCompatibilityStatus: 'NOT_VERIFIED',
  };
}

function sourceFingerprint(
  snapshotIds: string[],
  ruleVersions: string[],
  period: {
    fechaInicio: string;
    fechaFin: string;
    fechaPrevistaPagoPila: string;
  },
) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        snapshotIds: [...snapshotIds].sort(),
        normativeVersion: NORMATIVE_VERSION,
        fileFormatVersion: PILA_AT2_V30_LOCAL_FILE_FORMAT_VERSION,
        ruleVersions: [...ruleVersions].sort(),
        period,
      }),
    )
    .digest('hex');
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

@Injectable()
export class PilaExportService {
  private readonly logger = new Logger(PilaExportService.name);

  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  async list(tenantId: string, periodId: string): Promise<PilaExportSummary[]> {
    return this.tenantPrisma.execute(async (tx) => {
      const period = await tx.payrollPeriod.findFirst({
        where: { id: periodId, tenantId },
        select: { id: true },
      });
      if (!period) throw new NotFoundException('Período no encontrado.');
      const records = await tx.pilaExport.findMany({
        where: { tenantId, payrollPeriodId: periodId },
        select: exportSummarySelect,
        orderBy: { createdAt: 'desc' },
      });
      return records.map(summarize);
    });
  }

  async create(
    tenantId: string,
    userId: string,
    periodId: string,
  ): Promise<PilaExportSummary> {
    const source = await this.tenantPrisma.execute((tx) =>
      readApprovedSource(tx, tenantId, periodId),
    );
    const snapshotIds = source.snapshots.map(({ id }) => id).sort();
    const report = buildPilaPreparationReport({
      tenantId,
      expectedEmployeeIds: source.employeeIds,
      period: source.period,
      snapshots: source.snapshots.map((snapshot) => ({
        employeeId: snapshot.employeeId,
        payloadVersion: snapshot.pilaPayloadVersion,
        payload: snapshot.pilaPayload,
      })),
    });
    if (!report.archivoGenerable) {
      throw new ConflictException({
        message:
          'No se generó el archivo: el preflight encontró datos o reglas pendientes.',
        issues: report.issues,
        blockers: report.exportReadiness.blockers.filter(
          ({ scope }) => scope === 'FILE_GENERATION',
        ),
      });
    }
    if (!report.period.fechaPrevistaPagoPila) {
      throw new ConflictException(
        'La exportación requiere una fecha prevista de pago PILA congelada en todos los snapshots.',
      );
    }

    const snapshotScope = {
      expectedTenantId: tenantId,
      expectedEmployeeIds: source.employeeIds,
      period: source.period,
      snapshots: source.snapshots.map((snapshot) => ({
        employeeId: snapshot.employeeId,
        payloadVersion: snapshot.pilaPayloadVersion,
        payload: snapshot.pilaPayload,
      })),
    };
    const candidates = buildPilaAt2V30FileCandidates(snapshotScope);
    const ruleVersions = [
      RULESET_VERSION,
      ...new Set(
        candidates.details.flatMap((detail) =>
          Object.values(detail.normativeRuleVersions ?? {}).flatMap(
            (version) => (version == null ? [] : [version]),
          ),
        ),
      ),
    ]
      .map((version) => String(version))
      .sort();
    const fingerprint = sourceFingerprint(snapshotIds, ruleVersions, {
      fechaInicio: report.period.fechaInicio,
      fechaFin: report.period.fechaFin,
      fechaPrevistaPagoPila: report.period.fechaPrevistaPagoPila,
    });
    const prior = await this.tenantPrisma.execute((tx) =>
      tx.pilaExport.findUnique({
        where: {
          tenantId_payrollPeriodId_sourceFingerprint: {
            tenantId,
            payrollPeriodId: periodId,
            sourceFingerprint: fingerprint,
          },
        },
        select: exportSummarySelect,
      }),
    );
    if (prior) return summarize(prior);

    let files: PilaAt2V30LocalFiles;
    try {
      files = composePilaAt2V30FilesFromApprovedSnapshots(snapshotScope);
    } catch (error) {
      if (error instanceof PilaAt2V30FileExportBlockedError) {
        throw new UnprocessableEntityException({
          message: error.message,
          issues: error.issues,
        });
      }
      throw error;
    }

    const exportId = randomUUID();
    const keyPrefix = `tenants/${tenantId}/pila-exports/${exportId}`;
    const type1StorageKey = `${keyPrefix}/type-1.txt`;
    const type2StorageKey = `${keyPrefix}/type-2.txt`;
    const type1Sha256 = sha256(files.type1File);
    const type2Sha256 = sha256(files.type2File);

    try {
      const type1Metadata = await this.storage.putObject({
        key: type1StorageKey,
        body: files.type1File,
        contentType: 'text/plain; charset=windows-1252',
      });
      if (type1Metadata.size !== files.type1File.length) {
        throw new Error(
          'El almacenamiento no confirmó el tamaño del archivo tipo 1.',
        );
      }
      const type2Metadata = await this.storage.putObject({
        key: type2StorageKey,
        body: files.type2File,
        contentType: 'text/plain; charset=windows-1252',
      });
      if (type2Metadata.size !== files.type2File.length) {
        throw new Error(
          'El almacenamiento no confirmó el tamaño del archivo tipo 2.',
        );
      }

      const persisted = await this.tenantPrisma.execute(async (tx) => {
        const existing = await tx.pilaExport.findUnique({
          where: {
            tenantId_payrollPeriodId_sourceFingerprint: {
              tenantId,
              payrollPeriodId: periodId,
              sourceFingerprint: fingerprint,
            },
          },
          select: exportSummarySelect,
        });
        if (existing) return { record: existing, created: false };

        const latestSource = await readApprovedSource(tx, tenantId, periodId);
        const latestSnapshotIds = latestSource.snapshots
          .map(({ id }) => id)
          .sort();
        if (
          JSON.stringify(latestSnapshotIds) !== JSON.stringify(snapshotIds) ||
          JSON.stringify([...latestSource.employeeIds].sort()) !==
            JSON.stringify([...source.employeeIds].sort()) ||
          latestSource.period.fechaInicio.toISOString().slice(0, 10) !==
            report.period.fechaInicio ||
          latestSource.period.fechaFin.toISOString().slice(0, 10) !==
            report.period.fechaFin
        ) {
          throw new ConflictException(
            'Las fuentes aprobadas cambiaron durante la generación. Revise de nuevo antes de exportar.',
          );
        }

        const record = await tx.pilaExport.create({
          data: {
            id: exportId,
            tenantId,
            payrollPeriodId: periodId,
            createdByUserId: userId,
            status: PilaExportStatus.LOCAL_VALIDATED,
            fechaInicioPeriodo: new Date(
              `${report.period.fechaInicio}T00:00:00.000Z`,
            ),
            fechaFinPeriodo: new Date(
              `${report.period.fechaFin}T00:00:00.000Z`,
            ),
            fechaPrevistaPagoPila: new Date(
              `${report.period.fechaPrevistaPagoPila}T00:00:00.000Z`,
            ),
            normativeVersion: NORMATIVE_VERSION,
            fileFormatVersion: files.formatVersion,
            normativeRuleVersions: ruleVersions,
            sourceSnapshotIds: snapshotIds,
            sourceFingerprint: fingerprint,
            type1StorageKey,
            type1Sha256,
            type1SizeBytes: files.type1File.length,
            type1RecordCount: files.recordCounts.type1,
            type2StorageKey,
            type2Sha256,
            type2SizeBytes: files.type2File.length,
            type2RecordCount: files.recordCounts.type2,
            detailRecordCount: files.recordCounts.details,
          },
          select: exportSummarySelect,
        });
        await this.audit.log(
          {
            tenantId,
            userId,
            action: 'pila.export.generated',
            entityType: 'PilaExport',
            entityId: exportId,
            metadata: {
              payrollPeriodId: periodId,
              sourceSnapshotCount: snapshotIds.length,
              normativeVersion: NORMATIVE_VERSION,
              fileFormatVersion: files.formatVersion,
              status: PilaExportStatus.LOCAL_VALIDATED,
              type1Sha256,
              type2Sha256,
              operatorCompatibilityStatus: 'NOT_VERIFIED',
            },
          },
          tx,
        );
        return { record, created: true };
      });

      if (!persisted.created) {
        await this.cleanupObjects(type1StorageKey, type2StorageKey);
      }
      return summarize(persisted.record);
    } catch (error) {
      await this.cleanupObjects(type1StorageKey, type2StorageKey);
      if (isUniqueViolation(error)) {
        const concurrent = await this.tenantPrisma.execute((tx) =>
          tx.pilaExport.findUnique({
            where: {
              tenantId_payrollPeriodId_sourceFingerprint: {
                tenantId,
                payrollPeriodId: periodId,
                sourceFingerprint: fingerprint,
              },
            },
            select: exportSummarySelect,
          }),
        );
        if (concurrent) return summarize(concurrent);
      }
      throw error;
    }
  }

  async download(
    tenantId: string,
    userId: string,
    periodId: string,
    exportId: string,
    fileType: string,
  ): Promise<{ filename: string; body: Buffer }> {
    if (fileType !== 'type-1' && fileType !== 'type-2') {
      throw new BadRequestException('Tipo de archivo PILA no válido.');
    }
    const record = await this.tenantPrisma.execute((tx) =>
      tx.pilaExport.findFirst({
        where: { id: exportId, tenantId, payrollPeriodId: periodId },
        select: {
          id: true,
          status: true,
          fechaInicioPeriodo: true,
          fechaFinPeriodo: true,
          type1StorageKey: true,
          type1Sha256: true,
          type2StorageKey: true,
          type2Sha256: true,
        },
      }),
    );
    if (!record) throw new NotFoundException('Exportación PILA no encontrada.');

    const storageKey =
      fileType === 'type-1' ? record.type1StorageKey : record.type2StorageKey;
    const expectedSha256 =
      fileType === 'type-1' ? record.type1Sha256 : record.type2Sha256;
    const body = await this.storage.getObject(storageKey);
    if (sha256(body) !== expectedSha256.trim()) {
      throw new ConflictException(
        'El archivo almacenado no coincide con la huella de la exportación. No se entregó el archivo.',
      );
    }
    await this.tenantPrisma.execute((tx) =>
      this.audit.log(
        {
          tenantId,
          userId,
          action: 'pila.export.downloaded',
          entityType: 'PilaExport',
          entityId: exportId,
          metadata: { fileType, sha256: expectedSha256.trim() },
        },
        tx,
      ),
    );

    const start = record.fechaInicioPeriodo.toISOString().slice(0, 10);
    const end = record.fechaFinPeriodo.toISOString().slice(0, 10);
    return {
      filename: `pila-${start}-${end}-${fileType}.txt`,
      body,
    };
  }

  private async cleanupObjects(...keys: string[]) {
    await Promise.all(
      keys.map(async (key) => {
        try {
          await this.storage.deleteObject(key);
        } catch (error) {
          this.logger.warn(
            `No se pudo limpiar el artefacto PILA ${key}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }),
    );
  }
}
