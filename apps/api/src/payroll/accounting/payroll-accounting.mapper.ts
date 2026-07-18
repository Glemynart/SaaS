import { BadRequestException } from '@nestjs/common';
import { LineaComprobanteInput } from '../../accounting/ledger/ledger.types';
import { ConceptCodigo } from '../calculator/payroll-types';
import { PAYROLL_ACCOUNTING_REQUIRED_ROLES } from '../accounting-preflight/payroll-accounting-preflight.service';

type PayrollAccountRole = (typeof PAYROLL_ACCOUNTING_REQUIRED_ROLES)[number];

export interface PayrollRunForAccounting {
  centroCostoId: string | null;
  totalDevengos: number;
  totalDeducciones: number;
  netoPagar: number;
  totalAportesPatronales: number | null;
  totalProvisiones: number | null;
  concepts: Array<{ codigo: string | null; valor: number }>;
}

export type PayrollSystemAccounts = Record<PayrollAccountRole, string>;

type AccumulatedLine = {
  cuentaId: string;
  centroCostoId?: string;
  debito: number;
  credito: number;
  descripcion: string;
};

function asNumber(value: number | { toString(): string } | null): number {
  return value === null ? 0 : Number(value);
}

function healthContributions(run: PayrollRunForAccounting): number {
  return run.concepts
    .filter(
      (concept) =>
        concept.codigo === ConceptCodigo.SALUD_EMP ||
        concept.codigo === ConceptCodigo.SALUD_PAT,
    )
    .reduce((total, concept) => total + asNumber(concept.valor), 0);
}

/**
 * Traducción pura del resultado de Payroll a líneas genéricas del Ledger.
 * Las cuentas se reciben por rol desde CuentaSistemaMap; no hay PUC embebido.
 */
export function buildPayrollAccrualLines(
  runs: PayrollRunForAccounting[],
  accounts: PayrollSystemAccounts,
): LineaComprobanteInput[] {
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

  for (const run of runs) {
    const devengos = asNumber(run.totalDevengos);
    const deducciones = asNumber(run.totalDeducciones);
    const neto = asNumber(run.netoPagar);
    const aportesPatronales = asNumber(run.totalAportesPatronales);
    const provisiones = asNumber(run.totalProvisiones);
    const salud = healthContributions(run);
    const otrosAportes = deducciones + aportesPatronales - salud;

    if (otrosAportes < 0) {
      throw new BadRequestException(
        'Los aportes de nómina no pueden ser negativos al causar la nómina.',
      );
    }

    add(
      'GASTO_SUELDOS',
      devengos + provisiones,
      0,
      run.centroCostoId,
      'Causación de salarios y provisiones',
    );
    add(
      'GASTO_APORTES_SOCIALES',
      aportesPatronales,
      0,
      run.centroCostoId,
      'Causación de aportes patronales',
    );
    add(
      'SALARIOS_POR_PAGAR',
      0,
      neto,
      run.centroCostoId,
      'Salarios netos por pagar',
    );
    add(
      'APORTES_SALUD_POR_PAGAR',
      0,
      salud,
      run.centroCostoId,
      'Aportes de salud por pagar',
    );
    add(
      'APORTES_PENSION_POR_PAGAR',
      0,
      otrosAportes,
      run.centroCostoId,
      'Aportes de nómina por pagar',
    );
    add(
      'PROVISION_PRESTACIONES',
      0,
      provisiones,
      run.centroCostoId,
      'Provisiones laborales',
    );
  }

  return [...lines.values()].map((line) => ({
    cuentaId: line.cuentaId,
    centroCostoId: line.centroCostoId,
    debito: line.debito,
    credito: line.credito,
    descripcion: line.descripcion,
  }));
}
