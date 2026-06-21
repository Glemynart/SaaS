/**
 * PayrollCalculator (N2A) — función pura, determinística, sin I/O.
 *
 *   Input DTO → calculate() → Output DTO
 *
 * No accede a Prisma, NestJS, base de datos ni servicios. Toda la resolución
 * de nulabilidad, selección de contrato y persistencia ocurre en el servicio.
 *
 * Decisiones de cálculo (cerradas):
 *  - Salario oficial: input.salarioBase (Empleado.salario).
 *  - Redondeo: peso entero, half-up. El IBC se redondea ANTES de cotizar.
 *    Cada concepto se redondea individualmente. Los totales se obtienen
 *    sumando conceptos ya redondeados (las líneas siempre cuadran con el total).
 */

import {
  ArlClase,
  ConceptCodigo,
  ConceptResult,
  FspTramo,
  LegalParamsSnapshot,
  PayrollCalculationInput,
  PayrollCalculationResult,
  PayrollConceptType,
} from './payroll-types';
import { ibcCapped, ibcFloored, PayrollWarning } from './payroll-warnings';

/** Factor de IBC para salario integral (CST Art. 132): cotiza sobre el 70%. */
const SALARIO_INTEGRAL_IBC_FACTOR = 0.7;

// Factores de provisión mensual (N2B). Aproximaciones legales colombianas:
//  - Prima de servicios (CST Art. 306): 30/360 ≈ 8.33% mensual.
//  - Cesantías (CST Art. 249): 30/360 ≈ 8.33% mensual.
//  - Intereses sobre cesantías (Ley 52/1975): 12% anual ≈ 1% mensual de la base.
//  - Vacaciones (CST Art. 186): 15/360 ≈ 4.17% mensual.
// NOTA (riesgo de versionado): hoy son constantes; idealmente vivirían en
// ParametroLegalNomina por vigencia (no se toca schema en N2B.2).
const FACTOR_PROV_PRIMA = 0.0833;
const FACTOR_PROV_CESANTIAS = 0.0833;
const FACTOR_PROV_INT_CESANTIAS = 0.01;
const FACTOR_PROV_VACACIONES = 0.0417;

/**
 * Redondeo half-up a peso entero. Limpia ruido de punto flotante a 6 decimales
 * antes de redondear, para que un valor legítimamente .5 no caiga a .4999998.
 */
export function roundPeso(value: number): number {
  const cleaned = Math.round(value * 1e6) / 1e6;
  return Math.floor(cleaned + 0.5);
}

export function calculate(
  input: PayrollCalculationInput,
): PayrollCalculationResult {
  const p = input.legalParams;
  const warnings: PayrollWarning[] = [];
  const concepts: ConceptResult[] = [];

  // ── 0. Proporcionalidad por días causados (N2C) ─────────────────────────────
  // diasCausados ∈ [0..30]; default 30 (mes completo). proporcion = días/30.
  // Con 30 días → proporcion = 1.0 exacto → toda multiplicación es no-op y la
  // salida es bit-idéntica a N2A/N2B. La elegibilidad de auxilio y exoneración
  // usa el salario MENSUAL completo; solo los montos se prorratean.
  const diasCausados = Math.min(Math.max(input.diasCausados ?? 30, 0), 30);
  const proporcion = diasCausados / 30;

  // ── 1. Devengos constitutivos (entran a IBC) ────────────────────────────────
  const salarioBase = input.salarioBase; // mensual completo (para elegibilidad)
  const salarioBaseProrr = salarioBase * proporcion; // prorrateado (devengo/bases)
  // Novedades (BONUS/OVERTIME) son montos reales del período: NO se prorratean.
  const bonificaciones = sumNovelties(input, 'BONUS');
  const horasExtra = sumNovelties(input, 'OVERTIME');

  concepts.push(
    earning(ConceptCodigo.SALARIO_BASE, 'Salario base', salarioBaseProrr),
  );
  if (bonificaciones > 0) {
    concepts.push(
      earning(ConceptCodigo.BONUS, 'Bonificaciones', bonificaciones),
    );
  }
  if (horasExtra > 0) {
    concepts.push(earning(ConceptCodigo.OVERTIME, 'Horas extra', horasExtra));
  }

  // ── 2. IBC (constitutivos; sin auxilio; integral al 70%; topado y redondeado)─
  // Base prorrateada; piso y techo también se prorratean (un mes parcial cotiza
  // sobre topes parciales). Con proporcion = 1 → idéntico a N2A.
  let ibcRaw = salarioBaseProrr + bonificaciones + horasExtra;
  if (input.salarioIntegral) ibcRaw *= SALARIO_INTEGRAL_IBC_FACTOR;

  const ibcMin = p.smmlv * p.topeIbcMinSmmlv * proporcion;
  const ibcMax = p.smmlv * p.topeIbcMaxSmmlv * proporcion;
  let ibc = ibcRaw;
  if (ibc < ibcMin) {
    warnings.push(ibcFloored(roundPeso(ibcRaw), roundPeso(ibcMin)));
    ibc = ibcMin;
  } else if (ibc > ibcMax) {
    warnings.push(ibcCapped(roundPeso(ibcRaw), roundPeso(ibcMax)));
    ibc = ibcMax;
  }
  ibc = roundPeso(ibc); // IBC redondeado ANTES de cotizar

  // ── 3. Auxilio de transporte (devengo, NO entra a IBC) ──────────────────────
  // Elegibilidad por salario mensual completo; monto prorrateado por días.
  const aplicaAuxilio = salarioBase <= p.smmlv * p.umbralAuxilioSmmlv;
  const auxilioTransporte = aplicaAuxilio
    ? roundPeso(p.auxilioTransporte * proporcion)
    : 0;
  if (auxilioTransporte > 0) {
    concepts.push(
      earning(
        ConceptCodigo.AUX_TRANSP,
        'Auxilio de transporte',
        auxilioTransporte,
      ),
    );
  }

  // ── 4. Deducciones empleado (sobre IBC) ─────────────────────────────────────
  concepts.push(
    deduction(
      ConceptCodigo.SALUD_EMP,
      'Salud empleado',
      ibc,
      p.pctSaludEmpleado,
    ),
  );
  concepts.push(
    deduction(
      ConceptCodigo.PENSION_EMP,
      'Pensión empleado',
      ibc,
      p.pctPensionEmpleado,
    ),
  );
  const fspPct = resolveFspPct(ibc / p.smmlv, p.fspTramos);
  if (fspPct > 0) {
    concepts.push(
      deduction(
        ConceptCodigo.FSP,
        'Fondo de Solidaridad Pensional',
        ibc,
        fspPct,
      ),
    );
  }

  // ── 5. Aportes patronales (sobre IBC) ───────────────────────────────────────
  // Exoneración Art. 114-1: tenant habilitado Y salario < 10 SMMLV.
  const exonera =
    input.aportesExonerados && salarioBase < p.smmlv * p.umbralExoneracionSmmlv;

  if (!exonera) {
    concepts.push(
      contribution(
        ConceptCodigo.SALUD_PAT,
        'Salud empleador',
        ibc,
        p.pctSaludEmpleador,
      ),
    );
  }
  concepts.push(
    contribution(
      ConceptCodigo.PENSION_PAT,
      'Pensión empleador',
      ibc,
      p.pctPensionEmpleador,
    ),
  );
  concepts.push(
    contribution(
      ConceptCodigo.ARL,
      'ARL',
      ibc,
      arlFactor(input.claseRiesgoArl, p),
    ),
  );
  concepts.push(
    contribution(ConceptCodigo.CAJA, 'Caja de compensación', ibc, p.pctCaja),
  );
  if (!exonera) {
    concepts.push(contribution(ConceptCodigo.ICBF, 'ICBF', ibc, p.pctIcbf));
    concepts.push(contribution(ConceptCodigo.SENA, 'SENA', ibc, p.pctSena));
  }

  // ── 6. Provisiones prestacionales (costo empleador; NO se pagan al empleado) ─
  // Base prestacional ≠ IBC: incluye auxilio (prima/cesantías/intereses), NO se
  // topa a 25 SMMLV y para integral NO aplica el factor 70%.
  // Salario integral (CST Art. 132): el factor prestacional ya remunera prima,
  // cesantías e intereses → solo se provisiona VACACIONES (es descanso, no
  // prestación social). Vacaciones se causa sobre el salario completo, sin auxilio.
  // Bases prorrateadas por días causados (auxilioTransporte ya viene prorrateado).
  const baseConAuxilio = salarioBaseProrr + auxilioTransporte;

  if (!input.salarioIntegral) {
    concepts.push(
      provision(
        ConceptCodigo.PROV_PRIMA,
        'Provisión prima de servicios',
        baseConAuxilio,
        FACTOR_PROV_PRIMA,
      ),
    );
    concepts.push(
      provision(
        ConceptCodigo.PROV_CESANTIAS,
        'Provisión cesantías',
        baseConAuxilio,
        FACTOR_PROV_CESANTIAS,
      ),
    );
    concepts.push(
      provision(
        ConceptCodigo.PROV_INT_CESANTIAS,
        'Provisión intereses sobre cesantías',
        baseConAuxilio,
        FACTOR_PROV_INT_CESANTIAS,
      ),
    );
  }
  concepts.push(
    provision(
      ConceptCodigo.PROV_VACACIONES,
      'Provisión vacaciones',
      salarioBaseProrr,
      FACTOR_PROV_VACACIONES,
    ),
  );

  // ── 7. Totales (suma de conceptos YA redondeados) ───────────────────────────
  const totalDevengos = sumByType(concepts, 'EARNING');
  const totalDeducciones = sumByType(concepts, 'DEDUCTION');
  const totalAportesPatronales = sumByType(concepts, 'EMPLOYER_CONTRIBUTION');
  const totalProvisiones = sumByType(concepts, 'PROVISION');
  const netoPagar = totalDevengos - totalDeducciones;
  const costoTotalEmpleador =
    totalDevengos + totalAportesPatronales + totalProvisiones;

  return {
    concepts,
    ibc,
    auxilioTransporte,
    totalDevengos,
    totalDeducciones,
    totalAportesPatronales,
    totalProvisiones,
    netoPagar,
    costoTotalEmpleador,
    warnings,
  };
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

function sumNovelties(input: PayrollCalculationInput, tipo: string): number {
  return input.novelties
    .filter((n) => n.tipo === tipo)
    .reduce((sum, n) => sum + n.valor, 0);
}

function earning(
  codigo: ConceptCodigo,
  nombre: string,
  valor: number,
): ConceptResult {
  return {
    tipo: 'EARNING',
    codigo,
    nombre,
    base: null,
    factor: null,
    valor: roundPeso(valor),
  };
}

function deduction(
  codigo: ConceptCodigo,
  nombre: string,
  base: number,
  factor: number,
): ConceptResult {
  return {
    tipo: 'DEDUCTION',
    codigo,
    nombre,
    base: roundPeso(base),
    factor,
    valor: roundPeso(base * factor),
  };
}

function contribution(
  codigo: ConceptCodigo,
  nombre: string,
  base: number,
  factor: number,
): ConceptResult {
  return {
    tipo: 'EMPLOYER_CONTRIBUTION',
    codigo,
    nombre,
    base: roundPeso(base),
    factor,
    valor: roundPeso(base * factor),
  };
}

function provision(
  codigo: ConceptCodigo,
  nombre: string,
  base: number,
  factor: number,
): ConceptResult {
  return {
    tipo: 'PROVISION',
    codigo,
    nombre,
    base: roundPeso(base),
    factor,
    valor: roundPeso(base * factor),
  };
}

function sumByType(
  concepts: ConceptResult[],
  tipo: PayrollConceptType,
): number {
  return concepts
    .filter((c) => c.tipo === tipo)
    .reduce((sum, c) => sum + c.valor, 0);
}

function arlFactor(clase: ArlClase, p: LegalParamsSnapshot): number {
  return p.arlPorClase[clase];
}

/** Resuelve la tasa FSP para un IBC expresado en múltiplos de SMMLV. */
function resolveFspPct(ibcEnSmmlv: number, tramos: FspTramo[]): number {
  for (const t of tramos) {
    const dentroDelTramo =
      ibcEnSmmlv >= t.desdeSmmlv &&
      (t.hastaSmmlv === null || ibcEnSmmlv < t.hastaSmmlv);
    if (dentroDelTramo) return t.pct;
  }
  return 0;
}
