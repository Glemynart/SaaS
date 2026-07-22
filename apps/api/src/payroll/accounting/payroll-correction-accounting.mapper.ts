import { BadRequestException } from '@nestjs/common';
import { LineaComprobanteInput } from '../../accounting/ledger/ledger.types';
import { PAYROLL_ACCOUNTING_REQUIRED_ROLES } from '../accounting-preflight/payroll-accounting-preflight.service';
import { PayrollCorrectionMaterialization } from '../corrections/payroll-correction.types';

type PayrollAccountRole = (typeof PAYROLL_ACCOUNTING_REQUIRED_ROLES)[number];

export type PayrollCorrectionSystemAccounts = Record<
  PayrollAccountRole,
  string
>;

type AccumulatedLine = {
  cuentaId: string;
  centroCostoId?: string;
  debito: number;
  credito: number;
  descripcion: string;
};

type CorrectionTotals = {
  devengos: number;
  deducciones: number;
  aportesPatronales: number;
  provisiones: number;
  salud: number;
};

function emptyTotals(): CorrectionTotals {
  return {
    devengos: 0,
    deducciones: 0,
    aportesPatronales: 0,
    provisiones: 0,
    salud: 0,
  };
}

/**
 * Traduce exclusivamente deltas materializados a líneas del Ledger. No lee ni
 * recalcula Payroll: el signo del delta determina si se registra la línea
 * normal o su contrapartida.
 */
export function buildPayrollCorrectionAdjustmentLines(
  materialization: PayrollCorrectionMaterialization,
  accounts: PayrollCorrectionSystemAccounts,
): LineaComprobanteInput[] {
  const totalsByCostCenter = new Map<string, CorrectionTotals>();
  const costCenterByKey = new Map<string, string | null>();

  for (const entry of materialization.entries) {
    const key = entry.centroCostoId ?? '__WITHOUT_COST_CENTER__';
    const totals = totalsByCostCenter.get(key) ?? emptyTotals();
    costCenterByKey.set(key, entry.centroCostoId);

    switch (entry.concept.tipo) {
      case 'EARNING':
        totals.devengos += entry.delta;
        break;
      case 'DEDUCTION':
        totals.deducciones += entry.delta;
        break;
      case 'EMPLOYER_CONTRIBUTION':
        totals.aportesPatronales += entry.delta;
        break;
      case 'PROVISION':
        totals.provisiones += entry.delta;
        break;
      default:
        throw new BadRequestException(
          `El tipo de concepto materializado no es contabilizable: ${entry.concept.tipo}.`,
        );
    }

    if (
      entry.concept.codigo === 'SALUD_EMP' ||
      entry.concept.codigo === 'SALUD_PAT'
    ) {
      totals.salud += entry.delta;
    }
    totalsByCostCenter.set(key, totals);
  }

  const lines = new Map<string, AccumulatedLine>();
  const add = (
    role: PayrollAccountRole,
    debito: number,
    credito: number,
    centroCostoId: string | null,
    descripcion: string,
  ) => {
    if (debito === 0 && credito === 0) return;
    const cuentaId = accounts[role];
    const key = `${cuentaId}:${centroCostoId ?? ''}:${descripcion}`;
    const current = lines.get(key) ?? {
      cuentaId,
      centroCostoId: centroCostoId ?? undefined,
      debito: 0,
      credito: 0,
      descripcion,
    };
    current.debito += debito;
    current.credito += credito;
    lines.set(key, current);
  };
  const addSignedDebit = (
    role: PayrollAccountRole,
    amount: number,
    centroCostoId: string | null,
    descripcion: string,
  ) =>
    add(
      role,
      Math.max(amount, 0),
      Math.max(-amount, 0),
      centroCostoId,
      descripcion,
    );
  const addSignedCredit = (
    role: PayrollAccountRole,
    amount: number,
    centroCostoId: string | null,
    descripcion: string,
  ) =>
    add(
      role,
      Math.max(-amount, 0),
      Math.max(amount, 0),
      centroCostoId,
      descripcion,
    );

  for (const [key, totals] of totalsByCostCenter) {
    const centroCostoId = costCenterByKey.get(key) ?? null;
    const neto = totals.devengos - totals.deducciones;
    const otrosAportes =
      totals.deducciones + totals.aportesPatronales - totals.salud;

    addSignedDebit(
      'GASTO_SUELDOS',
      totals.devengos + totals.provisiones,
      centroCostoId,
      'Ajuste de salarios y provisiones',
    );
    addSignedDebit(
      'GASTO_APORTES_SOCIALES',
      totals.aportesPatronales,
      centroCostoId,
      'Ajuste de aportes patronales',
    );
    addSignedCredit(
      'SALARIOS_POR_PAGAR',
      neto,
      centroCostoId,
      'Ajuste de salarios netos por pagar',
    );
    addSignedCredit(
      'APORTES_SALUD_POR_PAGAR',
      totals.salud,
      centroCostoId,
      'Ajuste de aportes de salud por pagar',
    );
    addSignedCredit(
      'APORTES_PENSION_POR_PAGAR',
      otrosAportes,
      centroCostoId,
      'Ajuste de aportes de nómina por pagar',
    );
    addSignedCredit(
      'PROVISION_PRESTACIONES',
      totals.provisiones,
      centroCostoId,
      'Ajuste de provisiones laborales',
    );
  }

  const result = [...lines.values()].filter(
    (line) => line.debito !== 0 || line.credito !== 0,
  );
  if (result.length < 2) {
    throw new BadRequestException(
      'La materialización no produce un ajuste contable válido.',
    );
  }

  return result;
}
