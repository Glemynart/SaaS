import { ElectronicInvoiceIdempotencyConflictError } from './electronic-invoice-provider.port';
import type {
  ElectronicInvoiceProviderOutcome,
  ElectronicInvoiceProviderPort,
  ElectronicInvoiceReconciliation,
  ElectronicInvoiceSubmission,
} from './electronic-invoice-provider.port';

type SubmissionRecord = {
  invoiceId: string;
  eventId: string;
  payloadVersion: string;
  payloadHash: string;
  outcome: ElectronicInvoiceProviderOutcome;
};

/** Test-only provider. It intentionally stores only identity, digest, and a
 * normalized result; it never records canonical payloads or credentials. */
class FakeElectronicInvoiceProvider implements ElectronicInvoiceProviderPort {
  readonly providerId = 'fake';
  readonly contractVersion = '1';
  private readonly records = new Map<string, SubmissionRecord>();
  private externalSubmissions = 0;

  get submissionCount() {
    return this.externalSubmissions;
  }

  setOutcome(
    tenantId: string,
    idempotencyKey: string,
    outcome: ElectronicInvoiceProviderOutcome,
  ) {
    const record = this.records.get(recordKey(tenantId, idempotencyKey));
    if (!record) throw new Error('No existe un envío falso para actualizar.');
    record.outcome = outcome;
  }

  submit(
    submission: ElectronicInvoiceSubmission,
  ): Promise<ElectronicInvoiceProviderOutcome> {
    const key = recordKey(submission.tenantId, submission.idempotencyKey);
    const existing = this.records.get(key);
    if (existing) {
      if (
        existing.invoiceId !== submission.invoiceId ||
        existing.eventId !== submission.eventId ||
        existing.payloadVersion !== submission.payloadVersion ||
        existing.payloadHash !== submission.payloadHash
      ) {
        return Promise.reject(new ElectronicInvoiceIdempotencyConflictError());
      }
      return Promise.resolve(copyOutcome(existing.outcome));
    }

    const outcome: ElectronicInvoiceProviderOutcome = {
      status: 'UNKNOWN',
      providerReference: `fake-${submission.eventId}`,
    };
    this.externalSubmissions += 1;
    this.records.set(key, {
      invoiceId: submission.invoiceId,
      eventId: submission.eventId,
      payloadVersion: submission.payloadVersion,
      payloadHash: submission.payloadHash,
      outcome,
    });
    return Promise.resolve(copyOutcome(outcome));
  }

  reconcile(
    request: ElectronicInvoiceReconciliation,
  ): Promise<ElectronicInvoiceProviderOutcome> {
    const record = this.records.get(
      recordKey(request.tenantId, request.idempotencyKey),
    );
    if (
      !record ||
      record.invoiceId !== request.invoiceId ||
      record.eventId !== request.eventId ||
      (request.providerReference &&
        request.providerReference !==
          ('providerReference' in record.outcome
            ? record.outcome.providerReference
            : undefined))
    ) {
      return Promise.resolve({ status: 'UNKNOWN' });
    }
    return Promise.resolve(copyOutcome(record.outcome));
  }
}

function describeFakeElectronicInvoiceProviderContract(
  createProvider: () => FakeElectronicInvoiceProvider,
) {
  describe('fake electronic invoice provider contract', () => {
    let provider: FakeElectronicInvoiceProvider;

    beforeEach(() => {
      provider = createProvider();
    });

    it('replays one event idempotently without creating another submission', async () => {
      const request = submission();
      const first = await provider.submit(request);
      const replay = await provider.submit({ ...request });

      expect(replay).toEqual(first);
      expect(provider.submissionCount).toBe(1);
    });

    it('rejects reuse of an idempotency key for different content or event', async () => {
      const request = submission();
      await provider.submit(request);

      await expect(
        provider.submit({ ...request, payloadHash: 'different-hash' }),
      ).rejects.toBeInstanceOf(ElectronicInvoiceIdempotencyConflictError);
      await expect(
        provider.submit({ ...request, eventId: 'correction-event-2' }),
      ).rejects.toBeInstanceOf(ElectronicInvoiceIdempotencyConflictError);
      await expect(
        provider.submit({ ...request, invoiceId: 'invoice-b' }),
      ).rejects.toBeInstanceOf(ElectronicInvoiceIdempotencyConflictError);
      await expect(
        provider.submit({ ...request, payloadVersion: '2' }),
      ).rejects.toBeInstanceOf(ElectronicInvoiceIdempotencyConflictError);
    });

    it('scopes identical idempotency keys to their tenant', async () => {
      const first = submission({ tenantId: 'tenant-a' });
      const second = submission({ tenantId: 'tenant-b' });
      await provider.submit(first);
      await provider.submit(second);
      provider.setOutcome('tenant-a', first.idempotencyKey, {
        status: 'ACCEPTED',
        providerReference: 'provider-ref-a',
        acceptedAt: '2026-11-05T00:00:00.000Z',
      });

      expect(
        await provider.reconcile({
          tenantId: 'tenant-a',
          invoiceId: first.invoiceId,
          eventId: first.eventId,
          idempotencyKey: first.idempotencyKey,
        }),
      ).toMatchObject({ status: 'ACCEPTED' });
      expect(
        await provider.reconcile({
          tenantId: 'tenant-b',
          invoiceId: second.invoiceId,
          eventId: second.eventId,
          idempotencyKey: second.idempotencyKey,
        }),
      ).toMatchObject({ status: 'UNKNOWN' });
      expect(provider.submissionCount).toBe(2);
    });

    it('gives a correction its own event and idempotency identity', async () => {
      const original = await provider.submit(submission());
      const correction = await provider.submit(
        submission({
          eventId: 'correction-event-2',
          idempotencyKey: 'tenant-a:invoice-a:correction-2:hash-2',
          payloadHash: 'hash-2',
        }),
      );

      expect(original).not.toEqual(correction);
      expect(provider.submissionCount).toBe(2);
    });

    it('reconciles an ambiguous result before another submission attempt', async () => {
      const request = submission();
      expect((await provider.submit(request)).status).toBe('UNKNOWN');
      provider.setOutcome('tenant-a', request.idempotencyKey, {
        status: 'ACCEPTED',
        providerReference: 'provider-ref-1',
        acceptedAt: '2026-11-05T00:00:00.000Z',
      });

      const reconciled = await provider.reconcile({
        tenantId: request.tenantId,
        invoiceId: request.invoiceId,
        eventId: request.eventId,
        idempotencyKey: request.idempotencyKey,
        providerReference: 'provider-ref-1',
      });

      expect(reconciled.status).toBe('ACCEPTED');
      expect(provider.submissionCount).toBe(1);
    });

    it('keeps provider rejection details in the normalized contract', async () => {
      const request = submission();
      await provider.submit(request);
      const rejected: ElectronicInvoiceProviderOutcome = {
        status: 'REJECTED',
        providerReference: 'provider-ref-2',
        issues: [{ code: 'INVALID_BUYER_DOCUMENT', field: 'buyer.document' }],
      };
      provider.setOutcome('tenant-a', request.idempotencyKey, rejected);

      await expect(
        provider.reconcile({
          tenantId: request.tenantId,
          invoiceId: request.invoiceId,
          eventId: request.eventId,
          idempotencyKey: request.idempotencyKey,
          providerReference: 'provider-ref-2',
        }),
      ).resolves.toEqual(rejected);
    });

    it('fails closed when reconciliation cannot match the tenant and event', async () => {
      const request = submission();
      await provider.submit(request);

      const tenantMismatch = await provider.reconcile({
        tenantId: 'tenant-b',
        invoiceId: request.invoiceId,
        eventId: request.eventId,
        idempotencyKey: request.idempotencyKey,
      });
      const invoiceMismatch = await provider.reconcile({
        tenantId: request.tenantId,
        invoiceId: 'invoice-b',
        eventId: request.eventId,
        idempotencyKey: request.idempotencyKey,
      });

      expect(tenantMismatch).toEqual({ status: 'UNKNOWN' });
      expect(invoiceMismatch).toEqual({ status: 'UNKNOWN' });
    });
  });
}

function submission(
  overrides: Partial<ElectronicInvoiceSubmission> = {},
): ElectronicInvoiceSubmission {
  return {
    tenantId: 'tenant-a',
    invoiceId: 'invoice-a',
    eventId: 'issuance-event-1',
    idempotencyKey: 'tenant-a:invoice-a:issuance-event-1:hash-1',
    payloadVersion: '1',
    payloadHash: 'hash-1',
    canonicalPayload: '{"schemaVersion":1,"total":120000}',
    ...overrides,
  };
}

function recordKey(tenantId: string, idempotencyKey: string) {
  return `${tenantId}\u0000${idempotencyKey}`;
}

function copyOutcome(
  outcome: ElectronicInvoiceProviderOutcome,
): ElectronicInvoiceProviderOutcome {
  return structuredClone(outcome);
}

describeFakeElectronicInvoiceProviderContract(
  () => new FakeElectronicInvoiceProvider(),
);

it('exposes non-secret provider and mapping versions for attempt history', () => {
  const provider = new FakeElectronicInvoiceProvider();

  expect(provider.providerId).toBe('fake');
  expect(provider.contractVersion).toBe('1');
});
