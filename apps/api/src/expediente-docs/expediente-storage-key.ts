import { getCanonicalGeneratedDocumentStorageKey } from '../generated-documents/generated-document-storage-key';

export interface ExpedienteStorageKeyIdentity {
  tenantId: string;
  employeeId: string;
  generatedDocumentId: string | null;
  servicePremiumLineId: string | null;
  storageKey: string;
}

export function isServicePremiumStorageKeyOwnedByLine(
  tenantId: string,
  lineId: string,
  storageKey: string,
): boolean {
  if (!tenantId || !lineId || !storageKey || storageKey.includes('\\')) {
    return false;
  }

  const segments = storageKey.split('/');
  return (
    !storageKey.startsWith('/') &&
    !segments.some(
      (segment) => !segment || segment === '.' || segment === '..',
    ) &&
    segments.length === 7 &&
    segments[0] === tenantId &&
    segments[1] === 'nomina' &&
    segments[2] === 'prima' &&
    /^\d{4}$/.test(segments[3]) &&
    /^S[12]$/.test(segments[4]) &&
    /^v[1-9]\d*$/.test(segments[5]) &&
    segments[6] === `${lineId}.pdf`
  );
}

/**
 * Confirms that an expediente object's key belongs to the row's tenant and
 * source. This is a defense against inconsistent persisted metadata; callers
 * must still perform tenant-scoped database queries.
 */
export function isExpedienteStorageKeyOwnedByIdentity(
  identity: ExpedienteStorageKeyIdentity,
): boolean {
  const {
    tenantId,
    employeeId,
    generatedDocumentId,
    servicePremiumLineId,
    storageKey,
  } = identity;

  if (
    !tenantId ||
    !employeeId ||
    !storageKey ||
    storageKey.startsWith('/') ||
    storageKey.includes('\\')
  ) {
    return false;
  }

  const segments = storageKey.split('/');
  if (
    segments.some((segment) => !segment || segment === '.' || segment === '..')
  ) {
    return false;
  }

  if (generatedDocumentId && servicePremiumLineId) return false;

  if (generatedDocumentId) {
    return (
      storageKey ===
      getCanonicalGeneratedDocumentStorageKey(tenantId, generatedDocumentId)
    );
  }

  if (servicePremiumLineId) {
    return isServicePremiumStorageKeyOwnedByLine(
      tenantId,
      servicePremiumLineId,
      storageKey,
    );
  }

  return (
    segments.length >= 5 &&
    segments[0] === tenantId &&
    segments[1] === 'expediente' &&
    segments[2] === employeeId
  );
}
