import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { EmployeeDisbursementStatus } from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import { StorageObjectNotFoundError } from '../../storage/storage.types';
import { StorageService } from '../../storage/storage.service';
import { TenantPrismaService } from '../../tenant-prisma/tenant-prisma.service';

export type EmployeeDisbursementReconciliationFindingCode =
  | 'SUPPORT_METADATA_MISSING'
  | 'SUPPORT_STATUS_MISMATCH'
  | 'SUPPORT_STORAGE_KEY_INVALID'
  | 'CROSS_TENANT_STORAGE_REFERENCE'
  | 'SUPPORT_OBJECT_MISSING'
  | 'SUPPORT_SIZE_MISMATCH'
  | 'SUPPORT_HASH_MISMATCH'
  | 'ORPHAN_STORAGE_OBJECT'
  | 'LISTED_OBJECT_MISSING'
  | 'DUPLICATE_SUPPORT_REFERENCE'
  | 'POSSIBLE_DUPLICATE_OBJECT_CONTENT'
  | 'STORAGE_LIST_SCOPE_VIOLATION';

export interface EmployeeDisbursementReconciliationFinding {
  code: EmployeeDisbursementReconciliationFindingCode;
  disbursementId?: string;
  disbursementIds?: string[];
  storageKey?: string;
  storageKeys?: string[];
  expectedBytes?: number;
  observedBytes?: number;
}

export interface EmployeeDisbursementReconciliationReport {
  tenantId: string;
  checkedAt: string;
  scannedDisbursements: number;
  scannedObjects: number;
  findings: EmployeeDisbursementReconciliationFinding[];
  fingerprint: string;
  auditRecorded: boolean;
}

const DISBURSEMENT_SELECT = {
  id: true,
  status: true,
  supportStorageKey: true,
  supportMimeType: true,
  supportSizeBytes: true,
  supportSha256: true,
  supportedAt: true,
} as const;

type ReconciledObject = {
  key: string;
  size: number;
  sha256: string;
};

@Injectable()
export class EmployeeDisbursementReconciliationService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Diagnostic-only scan. It reads one tenant's object prefix and its RLS-
   * scoped records; it never changes or deletes either side.
   */
  async reconcile(
    tenantId: string,
    userId: string,
  ): Promise<EmployeeDisbursementReconciliationReport> {
    const prefix = `tenants/${tenantId}/employee-disbursements/`;
    const [disbursements, listedObjects] = await Promise.all([
      this.tenantPrisma.execute((tx) =>
        tx.employeeDisbursement.findMany({
          where: { tenantId },
          select: DISBURSEMENT_SELECT,
          orderBy: { id: 'asc' },
        }),
      ),
      this.storage.listObjects(prefix),
    ]);

    const findings: EmployeeDisbursementReconciliationFinding[] = [];
    const referencedKeys = new Set<string>();
    const recordsByKey = new Map<string, string[]>();
    const listedByKey = new Map<string, { key: string; size: number }>();
    const observedByKey = new Map<string, ReconciledObject>();

    for (const object of listedObjects) {
      if (!object.key.startsWith(prefix)) {
        findings.push({ code: 'STORAGE_LIST_SCOPE_VIOLATION' });
        continue;
      }
      if (listedByKey.has(object.key)) {
        findings.push({
          code: 'STORAGE_LIST_SCOPE_VIOLATION',
          storageKey: object.key,
        });
        continue;
      }
      listedByKey.set(object.key, object);
    }

    for (const payment of disbursements) {
      const hasSupportMetadata = Boolean(
        payment.supportMimeType &&
        ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(
          payment.supportMimeType,
        ) &&
        payment.supportSizeBytes !== null &&
        payment.supportSha256 &&
        /^[a-f0-9]{64}$/i.test(payment.supportSha256) &&
        payment.supportedAt,
      );
      const supportExpected =
        payment.status === EmployeeDisbursementStatus.SUPPORTED ||
        payment.status === EmployeeDisbursementStatus.VERIFIED;

      if (!payment.supportStorageKey) {
        if (supportExpected || hasSupportMetadata) {
          findings.push({
            code: 'SUPPORT_METADATA_MISSING',
            disbursementId: payment.id,
          });
        }
        continue;
      }

      if (payment.status === EmployeeDisbursementStatus.DECLARED) {
        findings.push({
          code: 'SUPPORT_STATUS_MISMATCH',
          disbursementId: payment.id,
        });
      }

      if (!hasSupportMetadata) {
        findings.push({
          code: 'SUPPORT_METADATA_MISSING',
          disbursementId: payment.id,
        });
      }

      if (
        !isCanonicalTenantSupportKey(
          payment.supportStorageKey,
          tenantId,
          payment.id,
        )
      ) {
        findings.push({
          code: isReferenceToAnotherTenant(payment.supportStorageKey, tenantId)
            ? 'CROSS_TENANT_STORAGE_REFERENCE'
            : 'SUPPORT_STORAGE_KEY_INVALID',
          disbursementId: payment.id,
        });
        continue;
      }

      const key = payment.supportStorageKey;
      referencedKeys.add(key);
      const referencedIds = recordsByKey.get(key) ?? [];
      referencedIds.push(payment.id);
      recordsByKey.set(key, referencedIds);

      const metadata = listedByKey.get(key);
      if (!metadata) {
        findings.push({
          code: 'SUPPORT_OBJECT_MISSING',
          disbursementId: payment.id,
        });
        continue;
      }

      const observed = await this.readObservedObject(key, prefix);
      if (!observed) {
        findings.push({
          code: 'SUPPORT_OBJECT_MISSING',
          disbursementId: payment.id,
        });
        continue;
      }
      observedByKey.set(key, observed);
      if (
        metadata.size !== payment.supportSizeBytes ||
        observed.size !== payment.supportSizeBytes
      ) {
        findings.push({
          code: 'SUPPORT_SIZE_MISMATCH',
          disbursementId: payment.id,
          expectedBytes: payment.supportSizeBytes ?? undefined,
          observedBytes: observed.size,
        });
      }
      if (
        !payment.supportSha256 ||
        observed.sha256 !== payment.supportSha256.toLowerCase()
      ) {
        findings.push({
          code: 'SUPPORT_HASH_MISMATCH',
          disbursementId: payment.id,
        });
      }
    }

    for (const [key, disbursementIds] of recordsByKey) {
      if (disbursementIds.length > 1) {
        findings.push({
          code: 'DUPLICATE_SUPPORT_REFERENCE',
          disbursementIds: disbursementIds.sort(),
          storageKey: key,
        });
      }
    }

    for (const object of listedByKey.values()) {
      if (referencedKeys.has(object.key)) continue;
      findings.push({
        code: 'ORPHAN_STORAGE_OBJECT',
        storageKey: object.key,
      });
      const observed = await this.readObservedObject(object.key, prefix);
      if (!observed) {
        findings.push({
          code: 'LISTED_OBJECT_MISSING',
          storageKey: object.key,
        });
        continue;
      }
      observedByKey.set(object.key, observed);
      if (object.size !== observed.size) {
        findings.push({
          code: 'SUPPORT_SIZE_MISMATCH',
          storageKey: object.key,
          expectedBytes: object.size,
          observedBytes: observed.size,
        });
      }
    }

    const observedGroups = new Map<string, string[]>();
    for (const observed of observedByKey.values()) {
      const identity = `${observed.size}:${observed.sha256}`;
      const keys = observedGroups.get(identity) ?? [];
      keys.push(observed.key);
      observedGroups.set(identity, keys);
    }
    for (const keys of observedGroups.values()) {
      if (keys.length > 1) {
        findings.push({
          code: 'POSSIBLE_DUPLICATE_OBJECT_CONTENT',
          storageKeys: keys.sort(),
        });
      }
    }

    findings.sort((left, right) =>
      JSON.stringify(left).localeCompare(JSON.stringify(right)),
    );
    const observedFiles = [...observedByKey.values()].sort((left, right) =>
      left.key.localeCompare(right.key),
    );
    const fingerprint = sha256(
      JSON.stringify({
        tenantId,
        disbursements,
        objects: [...listedByKey.values()].sort((left, right) =>
          left.key.localeCompare(right.key),
        ),
        observedFiles,
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
          action: 'employee.disbursement.support.reconciled',
          entityType: 'EmployeeDisbursementSupportReconciliation',
          entityId: fingerprint,
        },
        select: { id: true },
      });
      if (existing) return false;

      await this.audit.log(
        {
          tenantId,
          userId,
          action: 'employee.disbursement.support.reconciled',
          entityType: 'EmployeeDisbursementSupportReconciliation',
          entityId: fingerprint,
          metadata: {
            fingerprint,
            scannedDisbursements: disbursements.length,
            scannedObjects: listedByKey.size,
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
      scannedDisbursements: disbursements.length,
      scannedObjects: listedByKey.size,
      findings,
      fingerprint,
      auditRecorded,
    };
  }

  private async readObservedObject(
    key: string,
    prefix: string,
  ): Promise<ReconciledObject | null> {
    try {
      const body = await this.storage.getObjectWithinPrefix(key, prefix);
      return { key, size: body.length, sha256: sha256(body) };
    } catch (error) {
      if (error instanceof StorageObjectNotFoundError) return null;
      throw error;
    }
  }
}

function isCanonicalTenantSupportKey(
  key: string,
  tenantId: string,
  disbursementId: string,
): boolean {
  const prefix = `tenants/${tenantId}/employee-disbursements/${disbursementId}/`;
  return (
    key.startsWith(prefix) &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.(pdf|jpg|png|webp)$/i.test(
      key.slice(prefix.length),
    )
  );
}

function isReferenceToAnotherTenant(key: string, tenantId: string): boolean {
  const match = /^tenants\/([^/]+)\/employee-disbursements\//.exec(key);
  return Boolean(match && match[1] !== tenantId);
}

function summarizeFindingCodes(
  findings: EmployeeDisbursementReconciliationFinding[],
): Record<string, number> {
  return findings.reduce<Record<string, number>>((counts, finding) => {
    counts[finding.code] = (counts[finding.code] ?? 0) + 1;
    return counts;
  }, {});
}

function sha256(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex');
}
