import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';

export const PAYROLL_CORRECTION_INTENT_VERSION = 1;
export const PAYROLL_CORRECTION_MATERIALIZATION_VERSION = 1;

/** Intenciones permitidas para una corrección post-aprobación. */
export enum PayrollCorrectionIntentKind {
  SET_CALCULATION_INPUT = 'SET_CALCULATION_INPUT',
  MOVE_COST_CENTER = 'MOVE_COST_CENTER',
}

/** Entradas directas del calculator que una corrección puede cambiar. */
export enum PayrollCorrectionCalculationInput {
  SALARIO_BASE = 'SALARIO_BASE',
  BONUS = 'BONUS',
  OVERTIME = 'OVERTIME',
}

export type SetCalculationInputIntent = {
  id: string;
  kind: PayrollCorrectionIntentKind.SET_CALCULATION_INPUT;
  snapshotId: string;
  input: PayrollCorrectionCalculationInput;
  targetAmount: number;
};

export type MoveCostCenterIntent = {
  id: string;
  kind: PayrollCorrectionIntentKind.MOVE_COST_CENTER;
  snapshotId: string;
  targetCostCenterId: string;
};

export type PayrollCorrectionIntent =
  | SetCalculationInputIntent
  | MoveCostCenterIntent;

export type PayrollCorrectionIntentPayload = {
  version: typeof PAYROLL_CORRECTION_INTENT_VERSION;
  intents: PayrollCorrectionIntent[];
};

export type PayrollCorrectionDeltaEntry = {
  snapshotId: string;
  employeeId: string;
  centroCostoId: string | null;
  concept: {
    codigo: string;
    tipo: string;
  };
  delta: number;
};

export type PayrollCorrectionMaterialization = {
  version: typeof PAYROLL_CORRECTION_MATERIALIZATION_VERSION;
  generatedAt: string;
  snapshotIds: string[];
  approvedCorrectionIds: string[];
  entries: PayrollCorrectionDeltaEntry[];
};

type RawIntent = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function assertUniqueIntents(intents: PayrollCorrectionIntent[]) {
  const keys = new Set<string>();
  for (const intent of intents) {
    const key =
      intent.kind === PayrollCorrectionIntentKind.SET_CALCULATION_INPUT
        ? `${intent.snapshotId}:${intent.kind}:${intent.input}`
        : `${intent.snapshotId}:${intent.kind}`;
    if (keys.has(key)) {
      throw new BadRequestException(
        'Existen intenciones duplicadas incompatibles para el mismo snapshot.',
      );
    }
    keys.add(key);
  }
}

function toIntent(
  raw: RawIntent,
  preserveId: boolean,
): PayrollCorrectionIntent {
  const id = preserveId ? raw.id : randomUUID();
  if (!isNonEmptyString(id) || !isNonEmptyString(raw.snapshotId)) {
    throw new BadRequestException(
      'La intención debe referenciar un snapshot válido.',
    );
  }

  if (raw.kind === PayrollCorrectionIntentKind.SET_CALCULATION_INPUT) {
    if (
      raw.input !== PayrollCorrectionCalculationInput.SALARIO_BASE &&
      raw.input !== PayrollCorrectionCalculationInput.BONUS &&
      raw.input !== PayrollCorrectionCalculationInput.OVERTIME
    ) {
      throw new BadRequestException(
        'La entrada de cálculo de la intención no es válida.',
      );
    }
    if (
      typeof raw.targetAmount !== 'number' ||
      !Number.isSafeInteger(raw.targetAmount) ||
      raw.targetAmount < 0 ||
      (raw.input === PayrollCorrectionCalculationInput.SALARIO_BASE &&
        raw.targetAmount === 0)
    ) {
      throw new BadRequestException(
        'El valor objetivo de la intención debe ser un monto entero no negativo.',
      );
    }
    return {
      id,
      kind: PayrollCorrectionIntentKind.SET_CALCULATION_INPUT,
      snapshotId: raw.snapshotId,
      input: raw.input,
      targetAmount: raw.targetAmount,
    };
  }

  if (raw.kind === PayrollCorrectionIntentKind.MOVE_COST_CENTER) {
    if (!isNonEmptyString(raw.targetCostCenterId)) {
      throw new BadRequestException(
        'La intención debe indicar un centro de costo destino.',
      );
    }
    return {
      id,
      kind: PayrollCorrectionIntentKind.MOVE_COST_CENTER,
      snapshotId: raw.snapshotId,
      targetCostCenterId: raw.targetCostCenterId,
    };
  }

  throw new BadRequestException(
    'El tipo de intención de corrección no es válido.',
  );
}

/** Normaliza la entrada pública y asigna IDs estables del lado del servidor. */
export function createCorrectionIntentPayload(
  rawIntents: unknown,
): PayrollCorrectionIntentPayload {
  if (!Array.isArray(rawIntents) || rawIntents.length === 0) {
    throw new BadRequestException(
      'La corrección debe incluir al menos una intención.',
    );
  }
  const intents = rawIntents.map((intent) => {
    if (!isRecord(intent)) {
      throw new BadRequestException(
        'La intención de corrección no tiene una estructura válida.',
      );
    }
    return toIntent(intent, false);
  });
  assertUniqueIntents(intents);
  return { version: PAYROLL_CORRECTION_INTENT_VERSION, intents };
}

/** Valida y reconstruye el valor tipado persistido en JSON. */
export function parseCorrectionIntentPayload(
  value: unknown,
): PayrollCorrectionIntentPayload {
  if (!isRecord(value) || value.version !== PAYROLL_CORRECTION_INTENT_VERSION) {
    throw new BadRequestException(
      'La intención persistida de la corrección no es válida.',
    );
  }
  if (!Array.isArray(value.intents) || value.intents.length === 0) {
    throw new BadRequestException(
      'La corrección aprobada no tiene intenciones válidas.',
    );
  }
  const intents = value.intents.map((intent) => {
    if (!isRecord(intent)) {
      throw new BadRequestException(
        'La intención persistida no tiene una estructura válida.',
      );
    }
    return toIntent(intent, true);
  });
  assertUniqueIntents(intents);
  return { version: PAYROLL_CORRECTION_INTENT_VERSION, intents };
}

export function parseCorrectionMaterialization(
  value: unknown,
): PayrollCorrectionMaterialization {
  if (
    !isRecord(value) ||
    value.version !== PAYROLL_CORRECTION_MATERIALIZATION_VERSION
  ) {
    throw new BadRequestException(
      'La materialización persistida no es válida.',
    );
  }
  if (
    !Array.isArray(value.snapshotIds) ||
    !value.snapshotIds.every(isNonEmptyString) ||
    !Array.isArray(value.approvedCorrectionIds) ||
    !value.approvedCorrectionIds.every(isNonEmptyString) ||
    !Array.isArray(value.entries) ||
    !isNonEmptyString(value.generatedAt)
  ) {
    throw new BadRequestException(
      'La estructura de materialización no es válida.',
    );
  }

  const entries = value.entries.map((entry) => {
    if (!isRecord(entry) || !isRecord(entry.concept)) {
      throw new BadRequestException(
        'Una entrada de materialización no es válida.',
      );
    }
    if (
      !isNonEmptyString(entry.snapshotId) ||
      !isNonEmptyString(entry.employeeId) ||
      (entry.centroCostoId !== null &&
        !isNonEmptyString(entry.centroCostoId)) ||
      !isNonEmptyString(entry.concept.codigo) ||
      !isNonEmptyString(entry.concept.tipo) ||
      typeof entry.delta !== 'number' ||
      !Number.isSafeInteger(entry.delta) ||
      entry.delta === 0
    ) {
      throw new BadRequestException(
        'Una entrada de materialización no es válida.',
      );
    }
    return {
      snapshotId: entry.snapshotId,
      employeeId: entry.employeeId,
      centroCostoId: entry.centroCostoId,
      concept: { codigo: entry.concept.codigo, tipo: entry.concept.tipo },
      delta: entry.delta,
    };
  });

  return {
    version: PAYROLL_CORRECTION_MATERIALIZATION_VERSION,
    generatedAt: value.generatedAt,
    snapshotIds: value.snapshotIds,
    approvedCorrectionIds: value.approvedCorrectionIds,
    entries,
  };
}
