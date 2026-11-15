import { isExpedienteStorageKeyOwnedByIdentity } from './expediente-storage-key';

describe('isExpedienteStorageKeyOwnedByIdentity', () => {
  const base = {
    tenantId: 'tenant-001',
    employeeId: 'employee-001',
    generatedDocumentId: null,
    servicePremiumLineId: null,
  };

  it('accepts current manual-upload keys for the row tenant and employee', () => {
    expect(
      isExpedienteStorageKeyOwnedByIdentity({
        ...base,
        storageKey:
          'tenant-001/expediente/employee-001/OTRO/family_v1_document.pdf',
      }),
    ).toBe(true);
  });

  it('accepts the canonical generated-document key for its source row', () => {
    expect(
      isExpedienteStorageKeyOwnedByIdentity({
        ...base,
        generatedDocumentId: 'generated-001',
        storageKey: 'pdfs/tenant-001-generated-001.pdf',
      }),
    ).toBe(true);
  });

  it('accepts the current service-premium key for its line', () => {
    expect(
      isExpedienteStorageKeyOwnedByIdentity({
        ...base,
        servicePremiumLineId: 'line-001',
        storageKey: 'tenant-001/nomina/prima/2026/S1/v2/line-001.pdf',
      }),
    ).toBe(true);
  });

  it.each([
    'tenant-002/expediente/employee-002/OTRO/document.pdf',
    'tenant-001/expediente/employee-002/OTRO/document.pdf',
    'tenant-001/expediente/employee-001/../tenant-002/document.pdf',
    '/tenant-001/expediente/employee-001/OTRO/document.pdf',
    'tenant-001\\expediente\\employee-001\\OTRO\\document.pdf',
  ])('rejects mismatched or unsafe manual key %s', (storageKey) => {
    expect(isExpedienteStorageKeyOwnedByIdentity({ ...base, storageKey })).toBe(
      false,
    );
  });

  it('rejects a generated-document key belonging to a different tenant', () => {
    expect(
      isExpedienteStorageKeyOwnedByIdentity({
        ...base,
        generatedDocumentId: 'generated-001',
        storageKey: 'pdfs/tenant-002-generated-001.pdf',
      }),
    ).toBe(false);
  });

  it('rejects a service-premium key belonging to a different line or tenant', () => {
    expect(
      isExpedienteStorageKeyOwnedByIdentity({
        ...base,
        servicePremiumLineId: 'line-001',
        storageKey: 'tenant-002/nomina/prima/2026/S1/v2/line-001.pdf',
      }),
    ).toBe(false);
    expect(
      isExpedienteStorageKeyOwnedByIdentity({
        ...base,
        servicePremiumLineId: 'line-001',
        storageKey: 'tenant-001/nomina/prima/2026/S1/v2/line-002.pdf',
      }),
    ).toBe(false);
  });

  it('rejects ambiguous rows with multiple document sources', () => {
    expect(
      isExpedienteStorageKeyOwnedByIdentity({
        ...base,
        generatedDocumentId: 'generated-001',
        servicePremiumLineId: 'line-001',
        storageKey: 'pdfs/tenant-001-generated-001.pdf',
      }),
    ).toBe(false);
  });
});
