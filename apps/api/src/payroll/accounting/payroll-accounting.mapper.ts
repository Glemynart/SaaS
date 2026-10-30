import { BadRequestException } from '@nestjs/common';
import { LineaComprobanteInput } from '../../accounting/ledger/ledger.types';
import { ConceptCodigo } from '../calculator/payroll-types';
import type { PayrollConceptType } from '../calculator/payroll-types';
import { PAYROLL_ACCOUNTING_REQUIRED_ROLES } from '../accounting-preflight/payroll-accounting-preflight.service';

type PayrollAccountRole = (typeof PAYROLL_ACCOUNTING_REQUIRED_ROLES)[number];

export interface PayrollRunForAccounting {
  centroCostoId: string | null;
  totalDevengos: number;
  totalDeducciones: number;
  netoPagar: number;
  totalAportesPatronales: number | null;
  totalProvisiones: number | null;
  concepts: Array<{
    codigo: string | null;
    tipo: PayrollConceptType;
    valor: number;
  }>;
}

export type PayrollSystemAccounts = Record<PayrollAccountRole, string>;

type AccumulatedLine = {
  cuentaId: string;
  centroCostoId?: string;
  debito: number;
  credito: number;
  descripcion: string;
};

type ClassifiedPayrollAmounts = {
  devengos: number;
  deducciones: number;
  aportesPatronales: number;
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

function emptyAmounts(): ClassifiedPayrollAmounts {
  return {
    devengos: 0,
    deducciones: 0,
    aportesPatronales: 0,
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

function assertMatchesTotal(
  label: string,
  actual: number,
  expected: number,
): void {
  if (!Number.isFinite(actual) || Math.abs(actual - expected) > 0.01) {
    throw new BadRequestException(
      `Los conceptos de nómina no coinciden con el total de ${label}; no se contabilizó la causación.`,
    );
  }
}

function classifyRun(run: PayrollRunForAccounting): ClassifiedPayrollAmounts {
  const amounts = emptyAmounts();
  for (const concept of run.concepts) {
    if (!Number.isFinite(concept.valor) || concept.valor < 0) {
      throw new BadRequestException(
        'La nómina contiene un concepto con un valor no contabilizable.',
      );
    }

    switch (concept.tipo) {
      case 'EARNING':
        amounts.devengos += concept.valor;
        break;
      case 'PROVISION':
        amounts.provisiones += concept.valor;
        if (concept.codigo === ConceptCodigo.PROV_CESANTIAS) {
          amounts.provisionCesantias += concept.valor;
        } else if (concept.codigo === ConceptCodigo.PROV_INT_CESANTIAS) {
          amounts.provisionInteresesCesantias += concept.valor;
        } else if (concept.codigo === ConceptCodigo.PROV_PRIMA) {
          amounts.provisionPrima += concept.valor;
        } else if (concept.codigo === ConceptCodigo.PROV_VACACIONES) {
          amounts.provisionVacaciones += concept.valor;
        } else {
          throw new BadRequestException(
            `La provisión ${concept.codigo ?? 'sin código'} no tiene clasificación contable de nómina.`,
          );
        }
        break;
      case 'DEDUCTION':
        amounts.deducciones += concept.valor;
        if (concept.codigo === ConceptCodigo.SALUD_EMP) {
          amounts.saludEmpleado += concept.valor;
        } else if (
          concept.codigo === ConceptCodigo.PENSION_EMP ||
          concept.codigo === ConceptCodigo.FSP
        ) {
          amounts.pensionEmpleado += concept.valor;
        } else {
          throw new BadRequestException(
            `La deducción ${concept.codigo ?? 'sin código'} no tiene clasificación contable de nómina.`,
          );
        }
        break;
      case 'EMPLOYER_CONTRIBUTION':
        amounts.aportesPatronales += concept.valor;
        if (concept.codigo === ConceptCodigo.SALUD_PAT) {
          amounts.saludEmpleador += concept.valor;
        } else if (concept.codigo === ConceptCodigo.PENSION_PAT) {
          amounts.pensionEmpleador += concept.valor;
        } else if (concept.codigo === ConceptCodigo.ARL) {
          amounts.riesgosLaborales += concept.valor;
        } else if (concept.codigo === ConceptCodigo.CAJA) {
          amounts.aporteCaja += concept.valor;
        } else if (concept.codigo === ConceptCodigo.ICBF) {
          amounts.aporteIcbf += concept.valor;
        } else if (concept.codigo === ConceptCodigo.SENA) {
          amounts.aporteSena += concept.valor;
        } else {
          throw new BadRequestException(
            `El aporte patronal ${concept.codigo ?? 'sin código'} no tiene clasificación contable de nómina.`,
          );
        }
        break;
      default:
        throw new BadRequestException(
          'La nómina contiene un tipo de concepto no contabilizable.',
        );
    }
  }

  const deducciones = Number(run.totalDeducciones);
  const devengos = Number(run.totalDevengos);
  const aportesPatronales = Number(run.totalAportesPatronales ?? 0);
  const provisiones = Number(run.totalProvisiones ?? 0);
  const netoPagar = Number(run.netoPagar);

  assertMatchesTotal('devengos', amounts.devengos, devengos);
  assertMatchesTotal('deducciones', amounts.deducciones, deducciones);
  assertMatchesTotal(
    'aportes patronales',
    amounts.aportesPatronales,
    aportesPatronales,
  );
  assertMatchesTotal('provisiones', amounts.provisiones, provisiones);
  assertMatchesTotal('neto por pagar', devengos - deducciones, netoPagar);

  return amounts;
}

/**
 * Traducción pura del resultado de Payroll a líneas genéricas del Ledger.
 * Separa EPS, pensiones, ARL y parafiscales para no mezclar obligaciones de
 * naturaleza distinta en un mismo pasivo. Las cuentas se reciben por rol.
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
    const amounts = classifyRun(run);
    const salud = amounts.saludEmpleado + amounts.saludEmpleador;
    const pension = amounts.pensionEmpleado + amounts.pensionEmpleador;

    add(
      'GASTO_SUELDOS',
      amounts.devengos,
      0,
      run.centroCostoId,
      'Causación de salarios y demás devengos',
    );
    add(
      'GASTO_APORTES_SALUD',
      amounts.saludEmpleador,
      0,
      run.centroCostoId,
      'Aportes patronales a EPS',
    );
    add(
      'GASTO_APORTES_PENSION',
      amounts.pensionEmpleador,
      0,
      run.centroCostoId,
      'Aportes patronales a pensiones',
    );
    add(
      'GASTO_APORTES_RIESGOS_LABORALES',
      amounts.riesgosLaborales,
      0,
      run.centroCostoId,
      'Aportes patronales a ARL',
    );
    add(
      'GASTO_APORTES_CAJA',
      amounts.aporteCaja,
      0,
      run.centroCostoId,
      'Aportes a cajas de compensación',
    );
    add(
      'GASTO_APORTES_ICBF',
      amounts.aporteIcbf,
      0,
      run.centroCostoId,
      'Aportes al ICBF',
    );
    add(
      'GASTO_APORTES_SENA',
      amounts.aporteSena,
      0,
      run.centroCostoId,
      'Aportes al SENA',
    );
    add(
      'GASTO_PROVISION_CESANTIAS',
      amounts.provisionCesantias,
      0,
      run.centroCostoId,
      'Provisión de cesantías',
    );
    add(
      'GASTO_PROVISION_INTERESES_CESANTIAS',
      amounts.provisionInteresesCesantias,
      0,
      run.centroCostoId,
      'Provisión de intereses sobre cesantías',
    );
    add(
      'GASTO_PROVISION_PRIMA',
      amounts.provisionPrima,
      0,
      run.centroCostoId,
      'Provisión de prima de servicios',
    );
    add(
      'GASTO_PROVISION_VACACIONES',
      amounts.provisionVacaciones,
      0,
      run.centroCostoId,
      'Provisión de vacaciones',
    );
    add(
      'SALARIOS_POR_PAGAR',
      0,
      Number(run.netoPagar),
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
      pension,
      run.centroCostoId,
      'Aportes de pensión por pagar',
    );
    add(
      'APORTES_RIESGOS_LABORALES_POR_PAGAR',
      0,
      amounts.riesgosLaborales,
      run.centroCostoId,
      'Aportes de riesgos laborales por pagar',
    );
    add(
      'APORTES_PARAFISCALES_POR_PAGAR',
      0,
      amounts.aporteCaja + amounts.aporteIcbf + amounts.aporteSena,
      run.centroCostoId,
      'Aportes parafiscales por pagar',
    );
    add(
      'PROVISION_CESANTIAS_POR_PAGAR',
      0,
      amounts.provisionCesantias,
      run.centroCostoId,
      'Cesantías por pagar',
    );
    add(
      'PROVISION_INTERESES_CESANTIAS_POR_PAGAR',
      0,
      amounts.provisionInteresesCesantias,
      run.centroCostoId,
      'Intereses sobre cesantías por pagar',
    );
    add(
      'PROVISION_VACACIONES_POR_PAGAR',
      0,
      amounts.provisionVacaciones,
      run.centroCostoId,
      'Vacaciones por pagar',
    );
    add(
      'PROVISION_PRIMA_POR_PAGAR',
      0,
      amounts.provisionPrima,
      run.centroCostoId,
      'Prima de servicios por pagar',
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
