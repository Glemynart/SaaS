export const ElectronicInvoiceStatus = {
  DRAFT: 'BORRADOR',
  READY_TO_ISSUE: 'LISTA_PARA_EMITIR',
  QUEUED: 'EN_COLA',
  TRANSMITTING: 'EN_TRANSMISION',
  PENDING_RECONCILIATION: 'PENDIENTE_CONCILIACION',
  ACCEPTED: 'ACEPTADA',
  REJECTED: 'RECHAZADA',
  TECHNICAL_ERROR: 'ERROR_TECNICO',
} as const;

export type ElectronicInvoiceStatus =
  (typeof ElectronicInvoiceStatus)[keyof typeof ElectronicInvoiceStatus];

export interface ElectronicInvoicePartySnapshot {
  readonly legalName: string;
  readonly documentType: string;
  readonly documentNumber: string;
  readonly verificationDigit?: string;
  readonly address?: string;
  readonly municipalityCode?: string;
  readonly email?: string;
  readonly phone?: string;
  readonly taxResponsibilities?: readonly string[];
}

export interface ElectronicInvoiceLineSnapshot {
  readonly description: string;
  readonly unit: string;
  readonly quantity: string;
  readonly unitPrice: string;
  readonly discount: string;
  readonly taxRate?: string;
  readonly subtotal: string;
  readonly taxes: string;
  readonly total: string;
}

/**
 * Canonical v1 snapshot owned by the application domain. Provider DTOs and
 * regulatory interpretation do not belong in this shape.
 */
export interface ElectronicInvoiceSnapshotV1 {
  readonly version: 1;
  readonly currency: 'COP';
  readonly issueDate: string;
  readonly issuer: ElectronicInvoicePartySnapshot;
  readonly buyer: ElectronicInvoicePartySnapshot;
  readonly lines: readonly ElectronicInvoiceLineSnapshot[];
  readonly subtotal: string;
  readonly taxes: string;
  readonly total: string;
}

export interface SnapshotValidationIssue {
  readonly path: string;
  readonly code:
    | 'REQUIRED'
    | 'INVALID_FORMAT'
    | 'OUT_OF_RANGE'
    | 'INCONSISTENT_TOTAL';
}

const MONEY_PATTERN = /^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/;
const QUANTITY_PATTERN = /^(?:0|[1-9]\d{0,8})(?:\.\d{1,3})?$/;
const RATE_PATTERN = /^(?:0|[1-9]\d{0,2})(?:\.\d{1,2})?$/;

/** Validates arithmetic and shape without making tax-law determinations. */
export function validateElectronicInvoiceSnapshot(
  snapshot: ElectronicInvoiceSnapshotV1,
): SnapshotValidationIssue[] {
  const issues: SnapshotValidationIssue[] = [];
  if (snapshot.version !== 1) {
    issues.push({ path: 'version', code: 'INVALID_FORMAT' });
  }
  if (snapshot.currency !== 'COP') {
    issues.push({ path: 'currency', code: 'INVALID_FORMAT' });
  }
  if (!isIsoDate(snapshot.issueDate)) {
    issues.push({ path: 'issueDate', code: 'INVALID_FORMAT' });
  }

  validateParty(snapshot.issuer, 'issuer', issues);
  validateParty(snapshot.buyer, 'buyer', issues);

  if (!snapshot.lines.length) {
    issues.push({ path: 'lines', code: 'REQUIRED' });
  }

  let lineSubtotal = 0n;
  let lineTaxes = 0n;
  let lineTotal = 0n;

  snapshot.lines.forEach((line, index) => {
    const path = `lines.${index}`;
    if (!line.description.trim()) {
      issues.push({ path: `${path}.description`, code: 'REQUIRED' });
    }
    if (!line.unit.trim()) {
      issues.push({ path: `${path}.unit`, code: 'REQUIRED' });
    }

    const quantity = parseQuantity(line.quantity);
    const unitPrice = parseMoney(line.unitPrice);
    const discount = parseMoney(line.discount);
    const subtotal = parseMoney(line.subtotal);
    const taxes = parseMoney(line.taxes);
    const total = parseMoney(line.total);

    validateParsed(quantity, `${path}.quantity`, 'OUT_OF_RANGE', issues);
    if (quantity === 0n) {
      issues.push({ path: `${path}.quantity`, code: 'OUT_OF_RANGE' });
    }
    validateParsed(unitPrice, `${path}.unitPrice`, 'OUT_OF_RANGE', issues);
    validateParsed(discount, `${path}.discount`, 'OUT_OF_RANGE', issues);
    validateParsed(subtotal, `${path}.subtotal`, 'OUT_OF_RANGE', issues);
    validateParsed(taxes, `${path}.taxes`, 'OUT_OF_RANGE', issues);
    validateParsed(total, `${path}.total`, 'OUT_OF_RANGE', issues);

    if (line.taxRate !== undefined) {
      const rate = parseRate(line.taxRate);
      validateParsed(rate, `${path}.taxRate`, 'OUT_OF_RANGE', issues);
      if (rate !== null && rate > 10_000n) {
        issues.push({ path: `${path}.taxRate`, code: 'OUT_OF_RANGE' });
      }
    }

    if (
      quantity !== null &&
      unitPrice !== null &&
      discount !== null &&
      subtotal !== null
    ) {
      const gross = (quantity * unitPrice + 500n) / 1_000n;
      if (discount > gross || gross - discount !== subtotal) {
        issues.push({ path: `${path}.subtotal`, code: 'INCONSISTENT_TOTAL' });
      }
    }

    if (subtotal !== null && taxes !== null && total !== null) {
      if (subtotal + taxes !== total) {
        issues.push({ path: `${path}.total`, code: 'INCONSISTENT_TOTAL' });
      }
      lineSubtotal += subtotal;
      lineTaxes += taxes;
      lineTotal += total;
    }
  });

  const subtotal = parseMoney(snapshot.subtotal);
  const taxes = parseMoney(snapshot.taxes);
  const total = parseMoney(snapshot.total);
  validateParsed(subtotal, 'subtotal', 'OUT_OF_RANGE', issues);
  validateParsed(taxes, 'taxes', 'OUT_OF_RANGE', issues);
  validateParsed(total, 'total', 'OUT_OF_RANGE', issues);

  if (subtotal !== null && taxes !== null && total !== null) {
    if (
      subtotal !== lineSubtotal ||
      taxes !== lineTaxes ||
      total !== lineTotal ||
      subtotal + taxes !== total
    ) {
      issues.push({ path: 'total', code: 'INCONSISTENT_TOTAL' });
    }
  }

  return issues;
}

function validateParty(
  party: ElectronicInvoicePartySnapshot,
  path: string,
  issues: SnapshotValidationIssue[],
): void {
  if (!party.legalName.trim()) {
    issues.push({ path: `${path}.legalName`, code: 'REQUIRED' });
  }
  if (!party.documentType.trim()) {
    issues.push({ path: `${path}.documentType`, code: 'REQUIRED' });
  }
  if (!party.documentNumber.trim()) {
    issues.push({ path: `${path}.documentNumber`, code: 'REQUIRED' });
  }
}

function parseMoney(value: string): bigint | null {
  if (!MONEY_PATTERN.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}

function parseQuantity(value: string): bigint | null {
  if (!QUANTITY_PATTERN.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 1_000n + BigInt(fraction.padEnd(3, '0'));
}

function parseRate(value: string): bigint | null {
  if (!RATE_PATTERN.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}

function validateParsed(
  value: bigint | null,
  path: string,
  invalidCode: 'OUT_OF_RANGE',
  issues: SnapshotValidationIssue[],
): void {
  if (value === null) {
    issues.push({ path, code: 'INVALID_FORMAT' });
  } else if (value < 0n) {
    issues.push({ path, code: invalidCode });
  }
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

export type ElectronicInvoiceEvent =
  | {
      readonly type: 'VALIDATE';
      readonly snapshot: ElectronicInvoiceSnapshotV1;
    }
  | { readonly type: 'RETURN_TO_DRAFT' }
  | {
      readonly type: 'QUEUE';
      readonly prefix: string;
      readonly number: number;
    }
  | { readonly type: 'START_TRANSMISSION' }
  | { readonly type: 'ACCEPT'; readonly evidencePersisted: boolean }
  | { readonly type: 'REJECT'; readonly evidencePersisted: boolean }
  | {
      readonly type: 'TECHNICAL_FAILURE';
      readonly receiptConfirmedAbsent: boolean;
    }
  | { readonly type: 'AMBIGUOUS_OUTCOME' }
  | {
      readonly type: 'RETRY_TECHNICAL';
      readonly receiptConfirmedAbsent: boolean;
    }
  | {
      readonly type: 'RECONCILE';
      readonly outcome: 'ACCEPTED' | 'REJECTED' | 'NOT_RECEIVED' | 'UNKNOWN';
      readonly evidencePersisted?: boolean;
      readonly retryAllowed?: boolean;
    };

export class ElectronicInvoiceTransitionError extends Error {
  constructor(
    readonly from: ElectronicInvoiceStatus,
    readonly event: ElectronicInvoiceEvent['type'],
  ) {
    super(`Evento ${event} no permitido desde ${from}.`);
    this.name = 'ElectronicInvoiceTransitionError';
  }
}

/** Pure transition guard; provider calls, persistence and retry scheduling stay outside. */
export function transitionElectronicInvoice(
  status: ElectronicInvoiceStatus,
  event: ElectronicInvoiceEvent,
): ElectronicInvoiceStatus {
  switch (event.type) {
    case 'VALIDATE':
      if (
        status === ElectronicInvoiceStatus.DRAFT &&
        validateElectronicInvoiceSnapshot(event.snapshot).length === 0
      ) {
        return ElectronicInvoiceStatus.READY_TO_ISSUE;
      }
      break;
    case 'RETURN_TO_DRAFT':
      if (status === ElectronicInvoiceStatus.READY_TO_ISSUE) {
        return ElectronicInvoiceStatus.DRAFT;
      }
      break;
    case 'QUEUE':
      if (
        status === ElectronicInvoiceStatus.READY_TO_ISSUE &&
        event.prefix.trim().length > 0 &&
        Number.isSafeInteger(event.number) &&
        event.number > 0
      ) {
        return ElectronicInvoiceStatus.QUEUED;
      }
      break;
    case 'START_TRANSMISSION':
      if (status === ElectronicInvoiceStatus.QUEUED) {
        return ElectronicInvoiceStatus.TRANSMITTING;
      }
      break;
    case 'ACCEPT':
      if (
        status === ElectronicInvoiceStatus.TRANSMITTING &&
        event.evidencePersisted
      ) {
        return ElectronicInvoiceStatus.ACCEPTED;
      }
      break;
    case 'REJECT':
      if (
        status === ElectronicInvoiceStatus.TRANSMITTING &&
        event.evidencePersisted
      ) {
        return ElectronicInvoiceStatus.REJECTED;
      }
      break;
    case 'TECHNICAL_FAILURE':
      if (status === ElectronicInvoiceStatus.TRANSMITTING) {
        return event.receiptConfirmedAbsent
          ? ElectronicInvoiceStatus.TECHNICAL_ERROR
          : ElectronicInvoiceStatus.PENDING_RECONCILIATION;
      }
      break;
    case 'AMBIGUOUS_OUTCOME':
      if (
        status === ElectronicInvoiceStatus.TRANSMITTING ||
        status === ElectronicInvoiceStatus.TECHNICAL_ERROR
      ) {
        return ElectronicInvoiceStatus.PENDING_RECONCILIATION;
      }
      break;
    case 'RETRY_TECHNICAL':
      if (
        status === ElectronicInvoiceStatus.TECHNICAL_ERROR &&
        event.receiptConfirmedAbsent
      ) {
        return ElectronicInvoiceStatus.QUEUED;
      }
      break;
    case 'RECONCILE':
      if (status === ElectronicInvoiceStatus.PENDING_RECONCILIATION) {
        if (event.outcome === 'ACCEPTED' && event.evidencePersisted) {
          return ElectronicInvoiceStatus.ACCEPTED;
        }
        if (event.outcome === 'REJECTED' && event.evidencePersisted) {
          return ElectronicInvoiceStatus.REJECTED;
        }
        if (event.outcome === 'NOT_RECEIVED' && event.retryAllowed) {
          return ElectronicInvoiceStatus.QUEUED;
        }
        if (
          event.outcome === 'UNKNOWN' ||
          event.outcome === 'NOT_RECEIVED' ||
          (event.outcome === 'ACCEPTED' && !event.evidencePersisted) ||
          (event.outcome === 'REJECTED' && !event.evidencePersisted)
        ) {
          return ElectronicInvoiceStatus.PENDING_RECONCILIATION;
        }
      }
      break;
  }

  throw new ElectronicInvoiceTransitionError(status, event.type);
}
