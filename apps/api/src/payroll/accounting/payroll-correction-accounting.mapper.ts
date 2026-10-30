import { BadRequestException } from '@nestjs/common';
import { LineaComprobanteInput } from '../../accounting/ledger/ledger.types';
import { PAYROLL_ACCOUNTING_REQUIRED_ROLES } from '../accounting-preflight/payroll-accounting-preflight.service';
import { ConceptCodigo } from '../calculator/payroll-types';
import type { PayrollConceptType } from '../calculator/payroll-types';
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
  provisiones: number;
  saludEmpleado: number;
  saludEmpleador: number;
  pensionEmpleado: number;
  pensionEmpleador: number;
  riesgosLaborales: number;
  aporteCaja: number;
  aporteIcbf: number;
  aporteSena: number;
  provisionCesantias: number;
  provisionInteresesCesantias: number;
  provisionPrima: number;
  provisionVacaciones: number;
};

function emptyTotals(): CorrectionTotals {
  return {
    devengos: 0,
    deducciones: 0,
    provisiones: 0,
    saludEmpleado: 0,
    saludEmpleador: 0,
    pensionEmpleado: 0,
    pensionEmpleador: 0,
    riesgosLaborales: 0,
    aporteCaja: 0,
    aporteIcbf: 0,
    aporteSena: 0,
    provisionCesantias: 0,
    provisionInteresesCesantias: 0,
    provisionPrima: 0,
    provisionVacaciones: 0,
  };
}

function classifyEntry(
  totals: CorrectionTotals,
  concept: { codigo: string; tipo: string },
  delta: number,
): void {
  switch (concept.tipo as PayrollConceptType) {
    case 'EARNING':
      totals.devengos += delta;
      return;
    case 'PROVISION':
      totals.provisiones += delta;
      if (concept.codigo === ConceptCodigo.PROV_CESANTIAS) {
        totals.provisionCesantias += delta;
      } else if (concept.codigo === ConceptCodigo.PROV_INT_CESANTIAS) {
        totals.provisionInteresesCesantias += delta;
      } else if (concept.codigo === ConceptCodigo.PROV_PRIMA) {
        totals.provisionPrima += delta;
      } else if (concept.codigo === ConceptCodigo.PROV_VACACIONES) {
        totals.provisionVacaciones += delta;
      } else {
        throw new BadRequestException(
          `La provisión ${concept.codigo} no tiene clasificación contable de nómina.`,
        );
      }
      return;
    case 'DEDUCTION':
      totals.deducciones += delta;
      if (concept.codigo === ConceptCodigo.SALUD_EMP) {
        totals.saludEmpleado += delta;
      } else if (
        concept.codigo === ConceptCodigo.PENSION_EMP ||
        concept.codigo === ConceptCodigo.FSP
      ) {
        totals.pensionEmpleado += delta;
      } else {
        throw new BadRequestException(
          `La deducción ${concept.codigo} no tiene clasificación contable de nómina.`,
        );
      }
      return;
    case 'EMPLOYER_CONTRIBUTION':
      if (concept.codigo === ConceptCodigo.SALUD_PAT) {
        totals.saludEmpleador += delta;
      } else if (concept.codigo === ConceptCodigo.PENSION_PAT) {
        totals.pensionEmpleador += delta;
      } else if (concept.codigo === ConceptCodigo.ARL) {
        totals.riesgosLaborales += delta;
      } else if (concept.codigo === ConceptCodigo.CAJA) {
        totals.aporteCaja += delta;
      } else if (concept.codigo === ConceptCodigo.ICBF) {
        totals.aporteIcbf += delta;
      } else if (concept.codigo === ConceptCodigo.SENA) {
        totals.aporteSena += delta;
      } else {
        throw new BadRequestException(
          `El aporte patronal ${concept.codigo} no tiene clasificación contable de nómina.`,
        );
      }
      return;
    default:
      throw new BadRequestException(
        `El tipo de concepto materializado no es contabilizable: ${concept.tipo}.`,
      );
  }
}

/**
 * Traduce exclusivamente deltas materializados a líneas del Ledger. No lee ni
 * recalcula Payroll: el signo del delta determina la dirección del asiento.
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
    classifyEntry(totals, entry.concept, entry.delta);
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
    const salud = totals.saludEmpleado + totals.saludEmpleador;
    const pension = totals.pensionEmpleado + totals.pensionEmpleador;
    const neto = totals.devengos - totals.deducciones;

    addSignedDebit(
      'GASTO_SUELDOS',
      totals.devengos,
      centroCostoId,
      'Ajuste de salarios y demás devengos',
    );
    addSignedDebit(
      'GASTO_APORTES_SALUD',
      totals.saludEmpleador,
      centroCostoId,
      'Ajuste de aportes patronales a EPS',
    );
    addSignedDebit(
      'GASTO_APORTES_PENSION',
      totals.pensionEmpleador,
      centroCostoId,
      'Ajuste de aportes patronales a pensiones',
    );
    addSignedDebit(
      'GASTO_APORTES_RIESGOS_LABORALES',
      totals.riesgosLaborales,
      centroCostoId,
      'Ajuste de aportes patronales a ARL',
    );
    addSignedDebit(
      'GASTO_APORTES_CAJA',
      totals.aporteCaja,
      centroCostoId,
      'Ajuste de aportes a cajas de compensación',
    );
    addSignedDebit(
      'GASTO_APORTES_ICBF',
      totals.aporteIcbf,
      centroCostoId,
      'Ajuste de aportes al ICBF',
    );
    addSignedDebit(
      'GASTO_APORTES_SENA',
      totals.aporteSena,
      centroCostoId,
      'Ajuste de aportes al SENA',
    );
    addSignedDebit(
      'GASTO_PROVISION_CESANTIAS',
      totals.provisionCesantias,
      centroCostoId,
      'Ajuste de provisión de cesantías',
    );
    addSignedDebit(
      'GASTO_PROVISION_INTERESES_CESANTIAS',
      totals.provisionInteresesCesantias,
      centroCostoId,
      'Ajuste de provisión de intereses sobre cesantías',
    );
    addSignedDebit(
      'GASTO_PROVISION_PRIMA',
      totals.provisionPrima,
      centroCostoId,
      'Ajuste de provisión de prima de servicios',
    );
    addSignedDebit(
      'GASTO_PROVISION_VACACIONES',
      totals.provisionVacaciones,
      centroCostoId,
      'Ajuste de provisión de vacaciones',
    );
    addSignedCredit(
      'SALARIOS_POR_PAGAR',
      neto,
      centroCostoId,
      'Ajuste de salarios netos por pagar',
    );
    addSignedCredit(
      'APORTES_SALUD_POR_PAGAR',
      salud,
      centroCostoId,
      'Ajuste de aportes de salud por pagar',
    );
    addSignedCredit(
      'APORTES_PENSION_POR_PAGAR',
      pension,
      centroCostoId,
      'Ajuste de aportes de pensión por pagar',
    );
    addSignedCredit(
      'APORTES_RIESGOS_LABORALES_POR_PAGAR',
      totals.riesgosLaborales,
      centroCostoId,
      'Ajuste de aportes de riesgos laborales por pagar',
    );
    addSignedCredit(
      'APORTES_PARAFISCALES_POR_PAGAR',
      totals.aporteCaja + totals.aporteIcbf + totals.aporteSena,
      centroCostoId,
      'Ajuste de aportes parafiscales por pagar',
    );
    addSignedCredit(
      'PROVISION_CESANTIAS_POR_PAGAR',
      totals.provisionCesantias,
      centroCostoId,
      'Ajuste de cesantías por pagar',
    );
    addSignedCredit(
      'PROVISION_INTERESES_CESANTIAS_POR_PAGAR',
      totals.provisionInteresesCesantias,
      centroCostoId,
      'Ajuste de intereses sobre cesantías por pagar',
    );
    addSignedCredit(
      'PROVISION_VACACIONES_POR_PAGAR',
      totals.provisionVacaciones,
      centroCostoId,
      'Ajuste de vacaciones por pagar',
    );
    addSignedCredit(
      'PROVISION_PRIMA_POR_PAGAR',
      totals.provisionPrima,
      centroCostoId,
      'Ajuste de prima de servicios por pagar',
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

  const totalDebito = result.reduce((total, line) => total + line.debito, 0);
  const totalCredito = result.reduce((total, line) => total + line.credito, 0);
  if (Math.abs(totalDebito - totalCredito) > 0.01) {
    throw new BadRequestException(
      'La materialización no produce un ajuste contable balanceado.',
    );
  }

  return result.map((line) => ({
    cuentaId: line.cuentaId,
    centroCostoId: line.centroCostoId,
    debito: line.debito,
    credito: line.credito,
    descripcion: line.descripcion,
  }));
}
