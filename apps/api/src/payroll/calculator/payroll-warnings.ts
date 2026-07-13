import {
  informativeWarning,
  PayrollInformativeWarning,
} from '../payroll-evaluation';

/**
 * Advertencias tipadas del PayrollCalculator.
 *
 * No usamos string[]: cada advertencia tiene un `code` estable (para que el
 * servicio/UI pueda reaccionar programaticamente) y un `message` legible.
 *
 * El calculator puro solo emite advertencias informativas que descubre por
 * construccion (topes de IBC). Las condiciones que impiden liquidar con
 * correccion garantizada se clasifican como bloqueos funcionales en la
 * frontera de Payroll, no dentro del calculator.
 */

export type PayrollWarning = PayrollInformativeWarning;

export const WarningCode = {
  IBC_FLOORED: 'IBC_FLOORED',
  IBC_CAPPED: 'IBC_CAPPED',
} as const;

export type WarningCode = (typeof WarningCode)[keyof typeof WarningCode];

/** El IBC calculado quedo por debajo del piso legal (1 SMMLV) y se ajusto. */
export function ibcFloored(ibcRaw: number, piso: number): PayrollWarning {
  return informativeWarning(
    WarningCode.IBC_FLOORED,
    `IBC calculado (${ibcRaw}) inferior al piso legal; ajustado a ${piso} (1 SMMLV).`,
  );
}

/** El IBC calculado supero el techo legal (25 SMMLV) y se ajusto. */
export function ibcCapped(ibcRaw: number, techo: number): PayrollWarning {
  return informativeWarning(
    WarningCode.IBC_CAPPED,
    `IBC calculado (${ibcRaw}) superior al techo legal; ajustado a ${techo} (25 SMMLV).`,
  );
}
