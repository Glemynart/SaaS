import {
  functionalBlock,
  informativeWarning,
  isFunctionalBlock,
  isInformativeWarning,
  PayrollBlockCode,
  PayrollEvaluationKind,
  validEvaluation,
} from './payroll-evaluation';

describe('PayrollEvaluation (U4)', () => {
  it('representa un resultado valido', () => {
    expect(validEvaluation()).toEqual({ kind: PayrollEvaluationKind.VALID });
  });

  it('representa un warning informativo', () => {
    const warning = informativeWarning('IBC_CAPPED', 'IBC topado');

    expect(warning).toEqual({
      kind: PayrollEvaluationKind.WARNING,
      code: 'IBC_CAPPED',
      message: 'IBC topado',
    });
    expect(isInformativeWarning(warning)).toBe(true);
    expect(isFunctionalBlock(warning)).toBe(false);
  });

  it('representa un bloqueo funcional', () => {
    const block = functionalBlock(
      PayrollBlockCode.MISSING_ACTIVE_CONTRACT,
      'Sin contrato vigente',
    );

    expect(block).toEqual({
      kind: PayrollEvaluationKind.BLOCK,
      code: PayrollBlockCode.MISSING_ACTIVE_CONTRACT,
      message: 'Sin contrato vigente',
    });
    expect(isFunctionalBlock(block)).toBe(true);
    expect(isInformativeWarning(block)).toBe(false);
  });
});
