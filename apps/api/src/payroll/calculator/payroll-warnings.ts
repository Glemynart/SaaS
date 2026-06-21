/**
 * Advertencias tipadas del PayrollCalculator.
 *
 * No usamos string[]: cada advertencia tiene un `code` estable (para que el
 * servicio/UI pueda reaccionar programáticamente) y un `message` legible.
 *
 * El calculator puro solo emite advertencias que descubre por construcción
 * (topes de IBC). Las advertencias de resolución de datos (clase ARL por
 * defecto, contrato faltante, divergencia de salario) las emite el SERVICIO
 * en la frontera, no el calculator.
 */

export interface PayrollWarning {
  code: string;
  message: string;
}

export const WarningCode = {
  IBC_FLOORED: 'IBC_FLOORED',
  IBC_CAPPED: 'IBC_CAPPED',
} as const;

export type WarningCode = (typeof WarningCode)[keyof typeof WarningCode];

/** El IBC calculado quedó por debajo del piso legal (1 SMMLV) y se ajustó. */
export function ibcFloored(ibcRaw: number, piso: number): PayrollWarning {
  return {
    code: WarningCode.IBC_FLOORED,
    message: `IBC calculado (${ibcRaw}) inferior al piso legal; ajustado a ${piso} (1 SMMLV).`,
  };
}

/** El IBC calculado superó el techo legal (25 SMMLV) y se ajustó. */
export function ibcCapped(ibcRaw: number, techo: number): PayrollWarning {
  return {
    code: WarningCode.IBC_CAPPED,
    message: `IBC calculado (${ibcRaw}) superior al techo legal; ajustado a ${techo} (25 SMMLV).`,
  };
}
