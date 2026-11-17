import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import { StorageObjectNotFoundError } from '../storage/storage.types';
import { StorageService } from '../storage/storage.service';

export type PilaReconciliationFindingCode =
  | 'EXPORT_INCOMPLETE'
  | 'EXPORT_FILE_MISSING'
  | 'EXPORT_FILE_SIZE_MISMATCH'
  | 'EXPORT_FILE_HASH_MISMATCH'
  | 'EXPORT_STORAGE_KEY_INVALID'
  | 'CROSS_TENANT_STORAGE_REFERENCE'
  | 'ORPHAN_STORAGE_OBJECT';

export interface PilaReconciliationFinding {
  code: PilaReconciliationFindingCode;
  exportId?: string;
  fileType?: 'type-1' | 'type-2';
  storageKey?: string;
}

export interface PilaReconciliationReport {
  tenantId: string;
  checkedAt: string;
  scannedExports: number;
  scannedObjects: number;
  findings: PilaReconciliationFinding[];
  fingerprint: string;
  auditRecorded: boolean;
}

const EXPORT_SELECT = {
  id: true,
  status: true,
  type1StorageKey: true,
  type1Sha256: true,
  type1SizeBytes: true,
  type2StorageKey: true,
  type2Sha256: true,
  type2SizeBytes: true,
} as const;

@Injectable()
export class PilaExportReconciliationService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Escanea un único namespace tenant-scoped y registra un evento idempotente.
   * La operación nunca repara ni elimina archivos o exportaciones.
   */
  async reconcile(
    tenantId: string,
    userId: string,
  ): Promise<PilaReconciliationReport> {
    const prefix = `tenants/${tenantId}/pila-exports/`;
    const [exports, objects] = await Promise.all([
      this.tenantPrisma.execute((tx) =>
        tx.pilaExport.findMany({
          where: { tenantId },
          select: EXPORT_SELECT,
          orderBy: { id: 'asc' },
        }),
      ),
      this.storage.listObjects(prefix),
    ]);

    const byKey = new Map(objects.map((object) => [object.key, object]));
    const referencedCanonicalKeys = new Set<string>();
    const findings: PilaReconciliationFinding[] = [];
    const observedFiles: Array<{ key: string; size: number; sha256: string }> =
      [];

    for (const item of exports) {
      const findingCountBeforeExport = findings.length;
      for (const file of [
        {
          type: 'type-1' as const,
          key: item.type1StorageKey,
          sha256: item.type1Sha256,
          size: item.type1SizeBytes,
        },
        {
          type: 'type-2' as const,
          key: item.type2StorageKey,
          sha256: item.type2Sha256,
          size: item.type2SizeBytes,
        },
      ]) {
        const expectedKey = `${prefix}${item.id}/${file.type}.txt`;
        if (file.key !== expectedKey) {
          const otherTenantReference = isReferenceToAnotherTenant(
            file.key,
            tenantId,
          );
          findings.push({
            code: otherTenantReference
              ? 'CROSS_TENANT_STORAGE_REFERENCE'
              : 'EXPORT_STORAGE_KEY_INVALID',
            exportId: item.id,
            fileType: file.type,
          });
          continue;
        }

        referencedCanonicalKeys.add(expectedKey);
        const metadata = byKey.get(expectedKey);
        if (!metadata) {
          findings.push({
            code: 'EXPORT_FILE_MISSING',
            exportId: item.id,
            fileType: file.type,
          });
          continue;
        }

        let body: Buffer;
        try {
          body = await this.storage.getObjectWithinPrefix(expectedKey, prefix);
        } catch (error) {
          if (error instanceof StorageObjectNotFoundError) {
            findings.push({
              code: 'EXPORT_FILE_MISSING',
              exportId: item.id,
              fileType: file.type,
            });
            continue;
          }
          throw error;
        }

        const observedSha256 = sha256(body);
        observedFiles.push({
          key: expectedKey,
          size: body.length,
          sha256: observedSha256,
        });
        if (
          body.length !== file.size ||
          metadata.size !== file.size ||
          body.length !== metadata.size
        ) {
          findings.push({
            code: 'EXPORT_FILE_SIZE_MISMATCH',
            exportId: item.id,
            fileType: file.type,
          });
        }
        if (observedSha256 !== file.sha256.trim()) {
          findings.push({
            code: 'EXPORT_FILE_HASH_MISMATCH',
            exportId: item.id,
            fileType: file.type,
          });
        }
      }
      if (findings.length > findingCountBeforeExport) {
        findings.push({ code: 'EXPORT_INCOMPLETE', exportId: item.id });
      }
    }

    for (const object of objects) {
      if (
        object.key.startsWith(prefix) &&
        !referencedCanonicalKeys.has(object.key)
      ) {
        findings.push({
          code: 'ORPHAN_STORAGE_OBJECT',
          storageKey: object.key,
        });
      }
    }

    findings.sort((left, right) =>
      JSON.stringify(left).localeCompare(JSON.stringify(right)),
    );
    const fingerprint = sha256(
      JSON.stringify({
        tenantId,
        exports: exports.map((item) => ({
          id: item.id,
          status: item.status,
          type1StorageKey: item.type1StorageKey,
          type1Sha256: item.type1Sha256,
          type1SizeBytes: item.type1SizeBytes,
          type2StorageKey: item.type2StorageKey,
          type2Sha256: item.type2Sha256,
          type2SizeBytes: item.type2SizeBytes,
        })),
        objects: objects.map(({ key, size }) => ({ key, size })),
        observedFiles: observedFiles.sort((left, right) =>
          left.key.localeCompare(right.key),
        ),
        findings,
      }),
    );

    const auditRecorded = await this.tenantPrisma.execute(async (tx) => {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${tenantId}), hashtext(${fingerprint}))
      `;
      const existing = await tx.auditLog.findFirst({
        where: {
          tenantId,
          action: 'pila.export.reconciled',
          entityType: 'PilaExportReconciliation',
          entityId: fingerprint,
        },
        select: { id: true },
      });
      if (existing) return false;

      await this.audit.log(
        {
          tenantId,
          userId,
          action: 'pila.export.reconciled',
          entityType: 'PilaExportReconciliation',
          entityId: fingerprint,
          metadata: {
            fingerprint,
            scannedExports: exports.length,
            scannedObjects: objects.length,
            findingsByCode: summarizeFindingCodes(findings),
          },
        },
        tx,
      );
      return true;
    });

    return {
      tenantId,
      checkedAt: new Date().toISOString(),
      scannedExports: exports.length,
      scannedObjects: objects.length,
      findings,
      fingerprint,
      auditRecorded,
    };
  }
}

function isReferenceToAnotherTenant(key: string, tenantId: string): boolean {
  const match = /^tenants\/([^/]+)\/pila-exports\//.exec(key);
  return Boolean(match && match[1] !== tenantId);
}

function summarizeFindingCodes(findings: PilaReconciliationFinding[]) {
  return findings.reduce<Record<string, number>>((counts, finding) => {
    counts[finding.code] = (counts[finding.code] ?? 0) + 1;
    return counts;
  }, {});
}

function sha256(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex');
}
