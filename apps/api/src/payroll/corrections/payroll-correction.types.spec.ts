import { BadRequestException } from '@nestjs/common';
import {
  createCorrectionIntentPayload,
  parseCorrectionMaterialization,
  PayrollCorrectionCalculationInput,
  PayrollCorrectionIntentKind,
} from './payroll-correction.types';

describe('PayrollCorrection typed payloads', () => {
  it('normalizes supported intents and assigns stable identifiers server-side', () => {
    const payload = createCorrectionIntentPayload([
      {
        kind: PayrollCorrectionIntentKind.SET_CALCULATION_INPUT,
        snapshotId: 'snapshot-1',
        input: PayrollCorrectionCalculationInput.BONUS,
        targetAmount: 25_000,
      },
      {
        kind: PayrollCorrectionIntentKind.MOVE_COST_CENTER,
        snapshotId: 'snapshot-2',
        targetCostCenterId: 'cc-2',
      },
    ]);

    expect(payload).toMatchObject({ version: 1 });
    expect(payload.intents.map((intent) => intent.snapshotId)).toEqual([
      'snapshot-1',
      'snapshot-2',
    ]);
    expect(payload.intents.every((intent) => intent.id.length > 0)).toBe(true);
  });

  it('rejects duplicate incompatible intents', () => {
    expect(() =>
      createCorrectionIntentPayload([
        {
          kind: PayrollCorrectionIntentKind.SET_CALCULATION_INPUT,
          snapshotId: 'snapshot-1',
          input: PayrollCorrectionCalculationInput.BONUS,
          targetAmount: 25_000,
        },
        {
          kind: PayrollCorrectionIntentKind.SET_CALCULATION_INPUT,
          snapshotId: 'snapshot-1',
          input: PayrollCorrectionCalculationInput.BONUS,
          targetAmount: 30_000,
        },
      ]),
    ).toThrow(BadRequestException);
  });

  it('rejects a materialization with a zero or malformed delta', () => {
    expect(() =>
      parseCorrectionMaterialization({
        version: 1,
        generatedAt: '2026-02-01T10:00:00.000Z',
        snapshotIds: ['snapshot-1'],
        approvedCorrectionIds: [],
        entries: [
          {
            snapshotId: 'snapshot-1',
            employeeId: 'employee-1',
            centroCostoId: 'cc-1',
            concept: { codigo: 'BONUS', tipo: 'EARNING' },
            delta: 0,
          },
        ],
      }),
    ).toThrow(BadRequestException);
  });
});
