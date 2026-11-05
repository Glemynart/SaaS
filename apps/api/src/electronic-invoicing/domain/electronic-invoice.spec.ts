import {
  ElectronicInvoiceStatus as Status,
  ElectronicInvoiceTransitionError,
  ElectronicInvoiceSnapshotV1,
  transitionElectronicInvoice,
  validateElectronicInvoiceSnapshot,
} from './electronic-invoice';

describe('electronic invoice domain', () => {
  describe('validateElectronicInvoiceSnapshot', () => {
    it('accepts a balanced COP snapshot with exact quantity and line arithmetic', () => {
      expect(validateElectronicInvoiceSnapshot(validSnapshot())).toEqual([]);
    });

    it('rejects invalid parties, date, currency, and empty lines', () => {
      const snapshot = {
        ...validSnapshot(),
        currency: 'USD',
        issueDate: '2026-02-30',
        issuer: { ...validSnapshot().issuer, legalName: ' ' },
        buyer: { ...validSnapshot().buyer, documentNumber: '' },
        lines: [],
      } as unknown as ElectronicInvoiceSnapshotV1;

      expect(validateElectronicInvoiceSnapshot(snapshot)).toEqual(
        expect.arrayContaining([
          { path: 'currency', code: 'INVALID_FORMAT' },
          { path: 'issueDate', code: 'INVALID_FORMAT' },
          { path: 'issuer.legalName', code: 'REQUIRED' },
          { path: 'buyer.documentNumber', code: 'REQUIRED' },
          { path: 'lines', code: 'REQUIRED' },
        ]),
      );
    });

    it('rejects fractional quantities whose rounded subtotal is inconsistent', () => {
      const snapshot = validSnapshot({
        lines: [
          {
            ...validSnapshot().lines[0],
            quantity: '1.005',
            subtotal: '10.06',
            total: '11.96',
          },
        ],
        subtotal: '10.06',
        total: '11.96',
      });

      expect(validateElectronicInvoiceSnapshot(snapshot)).toContainEqual({
        path: 'lines.0.subtotal',
        code: 'INCONSISTENT_TOTAL',
      });
    });

    it('rejects line and document totals that do not reconcile', () => {
      const snapshot = validSnapshot({
        lines: [
          {
            ...validSnapshot().lines[0],
            total: '11.91',
          },
        ],
      });

      expect(validateElectronicInvoiceSnapshot(snapshot)).toContainEqual({
        path: 'total',
        code: 'INCONSISTENT_TOTAL',
      });
    });

    it('rejects decimal overflow and out-of-range tax rates', () => {
      const snapshot = validSnapshot({
        lines: [
          {
            ...validSnapshot().lines[0],
            quantity: '1000000000',
            taxRate: '100.01',
          },
        ],
      });

      expect(validateElectronicInvoiceSnapshot(snapshot)).toEqual(
        expect.arrayContaining([
          { path: 'lines.0.quantity', code: 'INVALID_FORMAT' },
          { path: 'lines.0.taxRate', code: 'OUT_OF_RANGE' },
        ]),
      );
    });
  });

  describe('transitionElectronicInvoice', () => {
    it('requires validation before a document can be queued and numbered', () => {
      expect(() =>
        transitionElectronicInvoice(Status.DRAFT, {
          type: 'VALIDATE',
          snapshot: {
            ...validSnapshot(),
            currency: 'USD',
          } as unknown as ElectronicInvoiceSnapshotV1,
        }),
      ).toThrow(ElectronicInvoiceTransitionError);
      expect(
        transitionElectronicInvoice(Status.DRAFT, {
          type: 'VALIDATE',
          snapshot: validSnapshot(),
        }),
      ).toBe(Status.READY_TO_ISSUE);
      expect(() =>
        transitionElectronicInvoice(Status.READY_TO_ISSUE, {
          type: 'QUEUE',
          prefix: 'DEMO',
          number: 0,
        }),
      ).toThrow(ElectronicInvoiceTransitionError);
      expect(
        transitionElectronicInvoice(Status.READY_TO_ISSUE, {
          type: 'QUEUE',
          prefix: 'DEMO',
          number: 1,
        }),
      ).toBe(Status.QUEUED);
    });

    it('allows only recorded evidence to finalize an acceptance or rejection', () => {
      expect(() =>
        transitionElectronicInvoice(Status.TRANSMITTING, {
          type: 'ACCEPT',
          evidencePersisted: false,
        }),
      ).toThrow(ElectronicInvoiceTransitionError);
      expect(
        transitionElectronicInvoice(Status.TRANSMITTING, {
          type: 'ACCEPT',
          evidencePersisted: true,
        }),
      ).toBe(Status.ACCEPTED);
      expect(
        transitionElectronicInvoice(Status.TRANSMITTING, {
          type: 'REJECT',
          evidencePersisted: true,
        }),
      ).toBe(Status.REJECTED);
    });

    it('routes uncertain delivery to reconciliation instead of blind retry', () => {
      expect(
        transitionElectronicInvoice(Status.TRANSMITTING, {
          type: 'TECHNICAL_FAILURE',
          receiptConfirmedAbsent: false,
        }),
      ).toBe(Status.PENDING_RECONCILIATION);
      expect(
        transitionElectronicInvoice(Status.PENDING_RECONCILIATION, {
          type: 'RECONCILE',
          outcome: 'UNKNOWN',
        }),
      ).toBe(Status.PENDING_RECONCILIATION);
      expect(
        transitionElectronicInvoice(Status.PENDING_RECONCILIATION, {
          type: 'RECONCILE',
          outcome: 'ACCEPTED',
          evidencePersisted: false,
        }),
      ).toBe(Status.PENDING_RECONCILIATION);
      expect(
        transitionElectronicInvoice(Status.PENDING_RECONCILIATION, {
          type: 'RECONCILE',
          outcome: 'NOT_RECEIVED',
          retryAllowed: false,
        }),
      ).toBe(Status.PENDING_RECONCILIATION);
      expect(
        transitionElectronicInvoice(Status.PENDING_RECONCILIATION, {
          type: 'RECONCILE',
          outcome: 'NOT_RECEIVED',
          retryAllowed: true,
        }),
      ).toBe(Status.QUEUED);
    });

    it('retries a technical error only after confirmed non-receipt', () => {
      expect(
        transitionElectronicInvoice(Status.TRANSMITTING, {
          type: 'TECHNICAL_FAILURE',
          receiptConfirmedAbsent: true,
        }),
      ).toBe(Status.TECHNICAL_ERROR);
      expect(() =>
        transitionElectronicInvoice(Status.TECHNICAL_ERROR, {
          type: 'RETRY_TECHNICAL',
          receiptConfirmedAbsent: false,
        }),
      ).toThrow(ElectronicInvoiceTransitionError);
      expect(
        transitionElectronicInvoice(Status.TECHNICAL_ERROR, {
          type: 'RETRY_TECHNICAL',
          receiptConfirmedAbsent: true,
        }),
      ).toBe(Status.QUEUED);
    });

    it('keeps accepted and rejected documents terminal', () => {
      expect(() =>
        transitionElectronicInvoice(Status.ACCEPTED, {
          type: 'START_TRANSMISSION',
        }),
      ).toThrow(ElectronicInvoiceTransitionError);
      expect(() =>
        transitionElectronicInvoice(Status.REJECTED, {
          type: 'QUEUE',
          prefix: 'DEMO',
          number: 1,
        }),
      ).toThrow(ElectronicInvoiceTransitionError);
    });
  });
});

function validSnapshot(
  overrides: Partial<ElectronicInvoiceSnapshotV1> = {},
): ElectronicInvoiceSnapshotV1 {
  return {
    version: 1,
    currency: 'COP',
    issueDate: '2026-02-28',
    issuer: {
      legalName: 'Emisor de prueba SAS',
      documentType: 'NIT',
      documentNumber: '900123456',
      verificationDigit: '7',
    },
    buyer: {
      legalName: 'Comprador de prueba SAS',
      documentType: 'NIT',
      documentNumber: '800123456',
      verificationDigit: '5',
    },
    lines: [
      {
        description: 'Servicio mensual',
        unit: 'NIU',
        quantity: '1.000',
        unitPrice: '10.00',
        discount: '0.00',
        taxRate: '19.00',
        subtotal: '10.00',
        taxes: '1.90',
        total: '11.90',
      },
    ],
    subtotal: '10.00',
    taxes: '1.90',
    total: '11.90',
    ...overrides,
  };
}
