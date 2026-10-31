import { createHash } from 'node:crypto';
import {
  parseCorrectionIntentPayload,
  parseCorrectionMaterialization,
} from '../corrections/payroll-correction.types';

export type ServicePremiumStatus = 'LISTA' | 'BLOQUEADA' | 'NO_APLICA';

export interface ServicePremiumEmployee {
  id: string;
  fullName: string;
  identification: string;
  active: boolean;
}

export interface ServicePremiumSnapshot {
  id: string;
  employeeId: string;
  payrollPeriodId: string;
  payloadVersion: number;
  estadoPeriodo: string;
  payload: unknown;
}

export interface ServicePremiumCorrection {
  id: string;
  payrollPeriodId: string;
  status: string;
  intent: unknown;
  materialization: unknown;
}

export interface ServicePremiumCalculation {
  status: ServicePremiumStatus;
  blockCode: string | null;
  blockReason: string | null;
  employee: ServicePremiumEmployee;
  salaryBase: number | null;
  variableSalary: number | null;
  transportAllowance: number | null;
  serviceDays360: number | null;
  amount: number | null;
  sourceFingerprint: string | null;
  snapshot: Record<string, unknown>;
}

type JsonRecord = Record<string, unknown>;
type ServiceInterval = { start: string; end: string };
type ParsedSnapshot = {
  row: ServicePremiumSnapshot;
  payload: JsonRecord;
  period: { start: string; end: string };
  contract: JsonRecord;
  employee: JsonRecord;
  concepts: JsonRecord[];
  novelties: JsonRecord[];
  monthlyAid: number;
  aidWasPaid: boolean;
  salaryBase: number;
};
type ServicePremiumCorrectionEvidence = {
  id: string;
  payrollPeriodId: string;
  entries: Array<{
    snapshotId: string;
    codigo: string;
    tipo: string;
    delta: number;
  }>;
};

const FORMULA_VERSION = 1;
const SUPPORTED_CONTRACT_TYPES = new Set([
  'TERMINO_FIJO',
  'TERMINO_INDEFINIDO',
  'OBRA_LABOR',
]);
const SUPPORTED_NON_BLOCKING_NOVELTY_TYPES = new Set([
  'OVERTIME',
  'SICKNESS',
  'VACATION',
]);
const SUPPORTED_CORRECTION_CONCEPTS = new Set([
  'SALARIO_BASE',
  'BONUS',
  'OVERTIME',
  'SALUD_EMP',
  'PENSION_EMP',
  'FSP',
  'SALUD_PAT',
  'PENSION_PAT',
  'ARL',
  'CAJA',
  'ICBF',
  'SENA',
  'PROV_PRIMA',
  'PROV_CESANTIAS',
  'PROV_INT_CESANTIAS',
  'PROV_VACACIONES',
]);

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  if (!match) return null;
  const date = new Date(`${match[1]}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== match[1]
    ? null
    : match[1];
}

function addDays(value: string, count: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

function maxDate(left: string, right: string): string {
  return left > right ? left : right;
}

function minDate(left: string, right: string): string {
  return left < right ? left : right;
}

/** 30/360 convention: start inclusive, end exclusive, day 31 normalized to 30. */
export function days360(start: string, endExclusive: string): number {
  const [year1, month1, day1] = start.split('-').map(Number);
  const [year2, month2, day2] = endExclusive.split('-').map(Number);
  return (
    360 * (year2 - year1) +
    30 * (month2 - month1) +
    Math.min(day2, 30) -
    Math.min(day1, 30)
  );
}

function amount(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function getBlock(
  employee: ServicePremiumEmployee,
  code: string,
  reason: string,
  snapshot: Record<string, unknown> = {},
): ServicePremiumCalculation {
  return {
    status: 'BLOQUEADA',
    blockCode: code,
    blockReason: reason,
    employee,
    salaryBase: null,
    variableSalary: null,
    transportAllowance: null,
    serviceDays360: null,
    amount: null,
    sourceFingerprint: null,
    snapshot,
  };
}

function parseSnapshot(row: ServicePremiumSnapshot): ParsedSnapshot | null {
  if (
    row.payloadVersion !== 1 ||
    !['APROBADA', 'CAUSADA'].includes(row.estadoPeriodo) ||
    !isRecord(row.payload)
  ) {
    return null;
  }
  const period = isRecord(row.payload.period) ? row.payload.period : null;
  const employee = isRecord(row.payload.employee) ? row.payload.employee : null;
  const contract = isRecord(row.payload.contract) ? row.payload.contract : null;
  const totals = isRecord(row.payload.totals) ? row.payload.totals : null;
  const legal = isRecord(row.payload.legalParameters)
    ? row.payload.legalParameters
    : null;
  const concepts = row.payload.concepts;
  const novelties = row.payload.novelties;
  if (!period || !employee || !contract || !totals || !legal) return null;

  const start = parseDate(period.fechaInicio);
  const inclusiveEnd = parseDate(period.fechaFin);
  const salaryBase = amount(employee.salarioBaseUsado);
  const transportTotal = amount(totals.auxilioTransporte);
  const monthlyAid = amount(legal.auxilioTransporte);
  if (
    !start ||
    !inclusiveEnd ||
    inclusiveEnd < start ||
    salaryBase === null ||
    transportTotal === null ||
    monthlyAid === null ||
    typeof contract.contratoId !== 'string' ||
    typeof contract.tipo !== 'string' ||
    typeof employee.salarioIntegralUsado !== 'boolean' ||
    !Array.isArray(concepts) ||
    !concepts.every(isRecord) ||
    !Array.isArray(novelties) ||
    !novelties.every(isRecord)
  ) {
    return null;
  }

  return {
    row,
    payload: row.payload,
    period: { start, end: addDays(inclusiveEnd, 1) },
    contract,
    employee,
    concepts,
    novelties,
    monthlyAid,
    aidWasPaid: transportTotal > 0,
    salaryBase,
  };
}

function contractIntervals(
  snapshots: ParsedSnapshot[],
  semester: ServiceInterval,
) {
  const byContract = new Map<string, ServiceInterval>();
  for (const snapshot of snapshots) {
    const contract = snapshot.contract;
    const contractId = contract.contratoId as string;
    const start = parseDate(contract.fechaInicio);
    const end =
      contract.fechaFin === null ? semester.end : parseDate(contract.fechaFin);
    if (!start || (contract.fechaFin !== null && !end)) return null;
    const interval = {
      start: maxDate(start, semester.start),
      end: minDate(end ? addDays(end, 1) : semester.end, semester.end),
    };
    if (interval.start < interval.end) {
      const previous = byContract.get(contractId);
      if (
        previous &&
        (previous.start !== interval.start || previous.end !== interval.end)
      ) {
        return null;
      }
      byContract.set(contractId, interval);
    }
  }
  const intervals = [...byContract.values()].sort((a, b) =>
    a.start.localeCompare(b.start),
  );
  if (intervals.length === 0) return null;
  for (let index = 1; index < intervals.length; index += 1) {
    if (intervals[index].start < intervals[index - 1].end) return null;
  }
  return intervals;
}

function overlap(
  left: ServiceInterval,
  right: ServiceInterval,
): ServiceInterval | null {
  const start = maxDate(left.start, right.start);
  const end = minDate(left.end, right.end);
  return start < end ? { start, end } : null;
}

function isCovered(
  intervals: ServiceInterval[],
  period: ServiceInterval,
): boolean {
  const clips = intervals
    .map((interval) => overlap(interval, period))
    .filter((item): item is ServiceInterval => item !== null)
    .sort((a, b) => a.start.localeCompare(b.start));
  if (clips.length === 0 || clips[0].start !== period.start) return false;
  let end = clips[0].end;
  for (const clip of clips.slice(1)) {
    if (clip.start > end) return false;
    if (clip.end > end) end = clip.end;
  }
  return end >= period.end;
}

function monthStart(value: string): string {
  return `${value.slice(0, 7)}-01`;
}

function nextMonth(value: string): string {
  const [year, month] = value.split('-').map(Number);
  const next = new Date(Date.UTC(year, month, 1));
  return next.toISOString().slice(0, 10);
}

function stableHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function correctionEntries(
  snapshots: ParsedSnapshot[],
  corrections: ServicePremiumCorrection[],
): {
  deltas: Map<string, Map<string, number>>;
  correctionIds: string[];
  correctionEvidence: ServicePremiumCorrectionEvidence[];
  blockCode?: string;
} {
  const snapshotIds = new Set(snapshots.map(({ row }) => row.id));
  const periodIds = new Set(snapshots.map(({ row }) => row.payrollPeriodId));
  const deltas = new Map<string, Map<string, number>>();
  const correctionIds: string[] = [];
  const correctionEvidence: ServicePremiumCorrectionEvidence[] = [];
  for (const correction of corrections.filter((item) =>
    periodIds.has(item.payrollPeriodId),
  )) {
    let affectedSnapshotIds: string[] = [];
    if (correction.status === 'APROBADA') {
      try {
        const parsed = parseCorrectionMaterialization(
          correction.materialization,
        );
        const applicableEntries = parsed.entries.filter((entry) =>
          snapshotIds.has(entry.snapshotId),
        );
        affectedSnapshotIds = applicableEntries.map(
          (entry) => entry.snapshotId,
        );
        if (affectedSnapshotIds.length > 0) correctionIds.push(correction.id);
        if (applicableEntries.length > 0) {
          correctionEvidence.push({
            id: correction.id,
            payrollPeriodId: correction.payrollPeriodId,
            entries: applicableEntries
              .map((entry) => ({
                snapshotId: entry.snapshotId,
                codigo: entry.concept.codigo,
                tipo: entry.concept.tipo,
                delta: entry.delta,
              }))
              .sort(
                (left, right) =>
                  left.snapshotId.localeCompare(right.snapshotId) ||
                  left.codigo.localeCompare(right.codigo) ||
                  left.tipo.localeCompare(right.tipo) ||
                  left.delta - right.delta,
              ),
          });
        }
        for (const entry of applicableEntries) {
          if (!SUPPORTED_CORRECTION_CONCEPTS.has(entry.concept.codigo)) {
            return {
              deltas,
              correctionIds,
              correctionEvidence,
              blockCode: 'CORRECCION_CONCEPTO_NO_SOPORTADO',
            };
          }
          if (
            ['SALARIO_BASE', 'BONUS', 'OVERTIME'].includes(
              entry.concept.codigo,
            ) &&
            entry.concept.tipo !== 'EARNING'
          ) {
            return {
              deltas,
              correctionIds,
              correctionEvidence,
              blockCode: 'CORRECCION_CONCEPTO_INVALIDO',
            };
          }
          const byCode =
            deltas.get(entry.snapshotId) ?? new Map<string, number>();
          byCode.set(
            entry.concept.codigo,
            (byCode.get(entry.concept.codigo) ?? 0) + entry.delta,
          );
          deltas.set(entry.snapshotId, byCode);
        }
      } catch {
        try {
          const intent = parseCorrectionIntentPayload(correction.intent);
          affectedSnapshotIds = intent.intents
            .map((item) => item.snapshotId)
            .filter((id) => snapshotIds.has(id));
        } catch {
          affectedSnapshotIds = [...snapshotIds].filter((id) =>
            snapshots.some(
              ({ row }) =>
                row.id === id &&
                row.payrollPeriodId === correction.payrollPeriodId,
            ),
          );
        }
        if (affectedSnapshotIds.length > 0)
          return {
            deltas,
            correctionIds,
            correctionEvidence,
            blockCode: 'CORRECCION_APROBADA_SIN_MATERIALIZACION',
          };
      }
    } else if (['BORRADOR', 'EN_REVISION'].includes(correction.status)) {
      try {
        const intent = parseCorrectionIntentPayload(correction.intent);
        affectedSnapshotIds = intent.intents
          .map((item) => item.snapshotId)
          .filter((id) => snapshotIds.has(id));
      } catch {
        affectedSnapshotIds = [...snapshotIds].filter((id) =>
          snapshots.some(
            ({ row }) =>
              row.id === id &&
              row.payrollPeriodId === correction.payrollPeriodId,
          ),
        );
      }
      if (affectedSnapshotIds.length > 0)
        return {
          deltas,
          correctionIds,
          correctionEvidence,
          blockCode: 'CORRECCION_PENDIENTE',
        };
    }
  }
  return { deltas, correctionIds, correctionEvidence };
}

export function calculateServicePremium(input: {
  employee: ServicePremiumEmployee;
  year: number;
  semester: number;
  snapshots: ServicePremiumSnapshot[];
  corrections?: ServicePremiumCorrection[];
}): ServicePremiumCalculation {
  const { employee, year, semester } = input;
  const semesterStart = semester === 1 ? `${year}-01-01` : `${year}-07-01`;
  const semesterEnd = semester === 1 ? `${year}-07-01` : `${year + 1}-01-01`;
  const base = { start: semesterStart, end: semesterEnd };

  if (!employee.active) {
    return {
      ...getBlock(
        employee,
        'EMPLEADO_INACTIVO',
        'Solo se procesa el grupo MVP de empleados activos.',
      ),
      status: 'NO_APLICA',
    };
  }
  if (semester !== 1) {
    return getBlock(
      employee,
      'SEMESTRE_NO_HABILITADO',
      'El segundo semestre está bloqueado hasta aprobar su regla de corte de diciembre.',
    );
  }

  const sourceRows = input.snapshots.filter(
    (row) => row.employeeId === employee.id,
  );
  if (sourceRows.length === 0)
    return getBlock(
      employee,
      'SIN_SNAPSHOTS',
      'No hay nóminas aprobadas para cubrir el semestre.',
    );
  const parsed = sourceRows.map(parseSnapshot);
  if (parsed.some((item) => item === null)) {
    return getBlock(
      employee,
      'SNAPSHOT_INCOMPATIBLE',
      'Una nómina aprobada no contiene una versión completa y compatible para liquidar prima.',
    );
  }
  const snapshots = (parsed as ParsedSnapshot[]).filter((snapshot) =>
    overlap(snapshot.period, base),
  );
  if (snapshots.length === 0)
    return getBlock(
      employee,
      'SIN_SNAPSHOTS',
      'No hay nóminas aprobadas que se crucen con el semestre.',
    );
  if (
    snapshots.some(
      ({ period }) => period.start < base.start || period.end > base.end,
    )
  ) {
    return getBlock(
      employee,
      'PERIODO_CRUZA_SEMESTRE',
      'Una nómina fuente contiene días por fuera del semestre y sus conceptos no se pueden repartir por fecha.',
    );
  }

  const intervals = contractIntervals(snapshots, base);
  if (!intervals)
    return getBlock(
      employee,
      'CONTRATO_INCOMPATIBLE',
      'El contrato de origen falta, no coincide o sus fechas se solapan.',
    );
  if (
    snapshots.some(
      (snapshot) =>
        !SUPPORTED_CONTRACT_TYPES.has(String(snapshot.contract.tipo)),
    )
  ) {
    return getBlock(
      employee,
      'TIPO_CONTRATO_NO_SOPORTADO',
      'La primera versión solo admite contratos laborales estándar dependientes.',
    );
  }
  const integral = snapshots.map(
    ({ employee: source }) => source.salarioIntegralUsado,
  );
  if (integral.every((value) => value === true)) {
    return {
      status: 'NO_APLICA',
      blockCode: null,
      blockReason:
        'El salario integral no genera prima separada en este flujo.',
      employee,
      salaryBase: null,
      variableSalary: null,
      transportAllowance: null,
      serviceDays360: 0,
      amount: null,
      sourceFingerprint: stableHash(snapshots.map(({ row }) => row.id).sort()),
      snapshot: {
        formulaVersion: FORMULA_VERSION,
        reason: 'SALARIO_INTEGRAL',
        sourceSnapshotIds: snapshots.map(({ row }) => row.id).sort(),
      },
    };
  }
  if (integral.some(Boolean))
    return getBlock(
      employee,
      'SALARIO_INTEGRAL_CAMBIO',
      'La evidencia histórica mezcla salario integral y ordinario dentro del semestre.',
    );

  const clippedPeriods = snapshots
    .map(({ period }) => overlap(period, base))
    .filter((item): item is ServiceInterval => item !== null)
    .sort((a, b) => a.start.localeCompare(b.start));
  for (let index = 1; index < clippedPeriods.length; index += 1) {
    if (clippedPeriods[index].start < clippedPeriods[index - 1].end) {
      return getBlock(
        employee,
        'PERIODOS_SOLAPADOS',
        'Los períodos de nómina fuente se solapan.',
      );
    }
  }
  for (const interval of intervals) {
    if (!isCovered(clippedPeriods, interval))
      return getBlock(
        employee,
        'COBERTURA_INCOMPLETA',
        'Falta una nómina aprobada para algún día de servicio del semestre.',
      );
  }

  const corrections = correctionEntries(snapshots, input.corrections ?? []);
  if (corrections.blockCode)
    return getBlock(
      employee,
      corrections.blockCode,
      'Hay una corrección de nómina pendiente o no reconstruible para el período fuente.',
    );
  const deltas = corrections.deltas;

  const salaryBases = new Set<number>();
  let variableTotal = 0;
  const monthlySnapshots = new Map<string, ParsedSnapshot[]>();
  for (const snapshot of snapshots) {
    const effectiveSalaryBase = snapshot.salaryBase;
    const byCode = deltas.get(snapshot.row.id);
    let overtimeValue = 0;
    for (const [code, delta] of byCode ?? []) {
      if (code === 'SALARIO_BASE' && delta !== 0) {
        return getBlock(
          employee,
          'CAMBIO_SALARIO_BASE',
          'Una corrección cambia el salario fijo y no hay una regla aprobada para ponderarlo.',
        );
      }
      if (code === 'BONUS' && delta !== 0) {
        return getBlock(
          employee,
          'BONIFICACION_SIN_NATURALEZA',
          'La corrección incluye una bonificación sin clasificación salarial explícita.',
        );
      }
      if (code === 'OVERTIME') overtimeValue += delta;
    }
    salaryBases.add(effectiveSalaryBase);
    for (const concept of snapshot.concepts) {
      const code = concept.codigo;
      const type = concept.tipo;
      const value = amount(concept.valor);
      if (
        typeof code !== 'string' ||
        typeof type !== 'string' ||
        value === null
      ) {
        return getBlock(
          employee,
          'CONCEPTO_INVALIDO',
          'Un concepto salarial del snapshot no tiene código, tipo o valor válido.',
        );
      }
      if (
        ['SALARIO_BASE', 'AUX_TRANSP', 'OVERTIME', 'BONUS'].includes(code) &&
        type !== 'EARNING'
      ) {
        return getBlock(
          employee,
          'CONCEPTO_INVALIDO',
          `El concepto ${code} tiene una clasificación incompatible con su código.`,
        );
      }
      if (type !== 'EARNING' || value === 0) continue;
      if (code === 'SALARIO_BASE' || code === 'AUX_TRANSP') continue;
      if (code === 'OVERTIME') {
        overtimeValue += value;
        continue;
      }
      if (code === 'BONUS')
        return getBlock(
          employee,
          'BONIFICACION_SIN_NATURALEZA',
          'Existe una bonificación cuya naturaleza salarial no está clasificada.',
        );
      else
        return getBlock(
          employee,
          'CONCEPTO_SALARIAL_NO_SOPORTADO',
          `El concepto ${code} no tiene regla de prima aprobada.`,
        );
    }
    if (overtimeValue < 0) {
      return getBlock(
        employee,
        'CORRECCION_SALARIAL_NEGATIVA',
        'La corrección aprobada produce horas extra negativas en un snapshot.',
      );
    }
    variableTotal += overtimeValue;
    for (const novelty of snapshot.novelties) {
      const type = novelty.tipo;
      if (type === 'BONUS')
        return getBlock(
          employee,
          'BONIFICACION_SIN_NATURALEZA',
          'Existe una novedad de bonificación sin clasificación salarial explícita.',
        );
      if (
        typeof type !== 'string' ||
        !SUPPORTED_NON_BLOCKING_NOVELTY_TYPES.has(type)
      ) {
        return getBlock(
          employee,
          'NOVEDAD_NO_CARACTERIZADA',
          `La novedad ${String(type)} no tiene un tratamiento aprobado para prima.`,
        );
      }
    }
    const clippedPeriod = overlap(snapshot.period, base);
    if (clippedPeriod) {
      let month = monthStart(clippedPeriod.start);
      while (month < clippedPeriod.end) {
        const monthRows = monthlySnapshots.get(month) ?? [];
        monthRows.push(snapshot);
        monthlySnapshots.set(month, monthRows);
        month = nextMonth(month);
      }
    }
  }
  if (salaryBases.size !== 1)
    return getBlock(
      employee,
      'CAMBIO_SALARIO_BASE',
      'El salario nominal cambia durante el semestre; se requiere regla salarial con vigencia.',
    );

  for (const interval of intervals) {
    const firstMonth = monthStart(interval.start);
    let month = firstMonth;
    while (month < interval.end) {
      const monthEnd = nextMonth(month);
      const segment = overlap(interval, { start: month, end: monthEnd });
      if (segment) {
        const rows = monthlySnapshots.get(month) ?? [];
        if (rows.length === 0)
          return getBlock(
            employee,
            'COBERTURA_INCOMPLETA',
            `No hay snapshot del mes ${month}.`,
          );
        const evidence = rows.map(
          (row) => `${row.aidWasPaid ? '1' : '0'}:${row.monthlyAid}`,
        );
        const distinctEvidence = new Set(evidence);
        if (distinctEvidence.size > 1) {
          const aidValues = new Set(
            rows.filter((row) => row.aidWasPaid).map((row) => row.monthlyAid),
          );
          if (aidValues.size > 1)
            return getBlock(
              employee,
              'AUXILIO_CAMBIA_EN_MES',
              `El auxilio de transporte cambia dentro del mes ${month}.`,
            );
          if (
            rows.some((row) => row.aidWasPaid) &&
            rows.some((row) => !row.aidWasPaid)
          ) {
            return getBlock(
              employee,
              'AUXILIO_INCONSISTENTE',
              `Los snapshots del mes ${month} no permiten confirmar consistentemente el auxilio causado.`,
            );
          }
        }
      }
      month = monthEnd;
    }
  }

  const serviceDays360 = intervals.reduce(
    (total, item) => total + days360(item.start, item.end),
    0,
  );
  if (serviceDays360 <= 0 || serviceDays360 > 180)
    return getBlock(
      employee,
      'DIAS_SERVICIO_INVALIDOS',
      'La duración de servicio excede el semestre o no es positiva.',
    );
  let aidWeighted = 0;
  for (const interval of intervals) {
    let month = monthStart(interval.start);
    while (month < interval.end) {
      const segment = overlap(interval, {
        start: month,
        end: nextMonth(month),
      });
      if (segment) {
        const rows = monthlySnapshots.get(month) ?? [];
        const caused = rows.some(({ aidWasPaid }) => aidWasPaid);
        if (caused) {
          const aid =
            rows.find(({ aidWasPaid }) => aidWasPaid)?.monthlyAid ?? 0;
          aidWeighted += (aid * days360(segment.start, segment.end)) / 30;
        }
      }
      month = nextMonth(month);
    }
  }

  const salaryBase = [...salaryBases][0];
  const variableSalary = (variableTotal * 30) / serviceDays360;
  const transportAllowance = (aidWeighted * 30) / serviceDays360;
  const amountValue = Math.floor(
    ((salaryBase + variableSalary + transportAllowance) * serviceDays360) /
      360 +
      0.5,
  );
  const sourceSnapshotIds = snapshots.map(({ row }) => row.id).sort();
  const sourceData = {
    formulaVersion: FORMULA_VERSION,
    year,
    semester,
    convention: '30/360_START_INCLUSIVE_END_EXCLUSIVE',
    employee,
    serviceIntervals: intervals,
    salaryBase,
    variableSalaryTotal: variableTotal,
    transportWeightedTotal: aidWeighted,
    serviceDays360,
    amount: amountValue,
    sourceSnapshotIds,
    correctionIds: corrections.correctionIds.sort(),
    correctionEvidence: corrections.correctionEvidence.sort((left, right) =>
      left.id.localeCompare(right.id),
    ),
    snapshotPayloads: snapshots.map(({ row, payload }) => ({
      id: row.id,
      payload,
    })),
  };
  return {
    status: 'LISTA',
    blockCode: null,
    blockReason: null,
    employee,
    salaryBase,
    variableSalary,
    transportAllowance,
    serviceDays360,
    amount: amountValue,
    sourceFingerprint: stableHash(sourceData),
    snapshot: sourceData,
  };
}
