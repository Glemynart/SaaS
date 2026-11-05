/**
 * Provider boundary for the first regulatory integration case: electronic
 * sales invoices. Provider credentials and provider-specific DTOs must stay in
 * infrastructure adapters; neither is part of this port's input or output.
 */
export type ElectronicInvoiceProviderIssue = Readonly<{
  /** Stable platform code. Provider-specific error codes are mapped by adapter. */
  code: string;
  /** Optional canonical field path; must not contain raw provider response text. */
  field?: string;
}>;

/** Provider response file to retain as private, checksummed evidence. */
export type ElectronicInvoiceProviderEvidence = Readonly<{
  contentType: string;
  bytes: Buffer;
}>;

export type ElectronicInvoiceProviderOutcome =
  | Readonly<{
      status: 'ACCEPTED';
      providerReference: string;
      acceptedAt: string;
      evidence?: ElectronicInvoiceProviderEvidence;
    }>
  | Readonly<{
      status: 'REJECTED';
      providerReference?: string;
      issues: readonly ElectronicInvoiceProviderIssue[];
      evidence?: ElectronicInvoiceProviderEvidence;
    }>
  | Readonly<{
      status: 'PENDING';
      providerReference?: string;
      evidence?: ElectronicInvoiceProviderEvidence;
    }>
  | Readonly<{
      /** The provider may have received the request; reconcile before retrying. */
      status: 'UNKNOWN';
      providerReference?: string;
      evidence?: ElectronicInvoiceProviderEvidence;
    }>;

export type ElectronicInvoiceSubmission = Readonly<{
  tenantId: string;
  invoiceId: string;
  /** Stable identity of this issuance/correction event, not of an attempt. */
  eventId: string;
  /** Derived once from tenant, invoice event, and canonical payload hash. */
  idempotencyKey: string;
  payloadVersion: string;
  payloadHash: string;
  /** Canonical, versioned payload; never a provider DTO. */
  canonicalPayload: string;
}>;

export type ElectronicInvoiceReconciliation = Readonly<{
  tenantId: string;
  invoiceId: string;
  eventId: string;
  idempotencyKey: string;
  providerReference?: string;
}>;

/**
 * A provider adapter translates this stable contract to and from its own API.
 * The application persists attempts and evidence around these calls; adapters
 * do not own invoice state or accounting effects.
 */
export interface ElectronicInvoiceProviderPort {
  /** Non-secret identity stored with each attempt. */
  readonly providerId: string;
  /** Version of this adapter's provider mapping/contract, not of the payload. */
  readonly contractVersion: string;

  submit(
    submission: ElectronicInvoiceSubmission,
  ): Promise<ElectronicInvoiceProviderOutcome>;

  reconcile(
    request: ElectronicInvoiceReconciliation,
  ): Promise<ElectronicInvoiceProviderOutcome>;
}

export class ElectronicInvoiceIdempotencyConflictError extends Error {
  constructor() {
    super('La clave de idempotencia ya se usó con otro evento o contenido.');
    this.name = 'ElectronicInvoiceIdempotencyConflictError';
  }
}
