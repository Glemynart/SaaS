import { randomUUID } from 'node:crypto';
import { completeApprovedSnapshot } from '../../apps/api/test/fixtures/pila-at2-v30-approved-snapshot';

type PilaExportFixture = {
  periodId: string;
  employeeCount: number;
  inspectPersistedState: () => Promise<{
    periodStatus: string | undefined;
    snapshotCount: number;
    exports: Array<{
      id: string;
      status: string;
      sourceSnapshotIds: string[];
      type1Sha256: string;
      type1SizeBytes: number;
      type1RecordCount: number;
      type2Sha256: string;
      type2SizeBytes: number;
      type2RecordCount: number;
      detailRecordCount: number;
    }>;
  }>;
  disconnect: () => Promise<void>;
};

function mutableRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('El snapshot PILA de prueba no tiene la estructura esperada.');
  }
  return value as Record<string, unknown>;
}

function mutableRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    throw new Error('El snapshot PILA de prueba no contiene la lista esperada.');
  }
  return value.map(mutableRecord);
}

type PilaExportScenario = 'FULL_MONTH' | 'SINGLE_INGRESS' | 'SINGLE_RETIREMENT';

function buildApprovedSnapshot(
  snapshot: ReturnType<typeof completeApprovedSnapshot>,
  scenario: PilaExportScenario,
) {
  if (scenario === 'FULL_MONTH') return snapshot;

  snapshot.payloadVersion = 10;
  const payload = mutableRecord(snapshot.payload);
  payload.schemaVersion = 10;
  const singleIngress = scenario === 'SINGLE_INGRESS';
  const entryDate = singleIngress ? '2026-10-10' : '2025-01-01';
  const retirementDate = singleIngress ? null : '2026-10-20';
  const days = singleIngress ? 21 : 20;
  const monthlySalary = 8_000_000;
  const proratedSalary = singleIngress ? 5_600_000 : 5_333_333;
  const employee = mutableRecord(payload.employee);
  employee.fechaIngreso = entryDate;
  employee.fechaRetiro = retirementDate;
  const contract = mutableRecord(payload.contract);
  contract.fechaInicio = entryDate;
  contract.fechaFin = retirementDate;
  contract.estado = retirementDate ? 'TERMINADO' : 'VIGENTE';

  const affiliations = mutableRecordArray(payload.affiliations);
  affiliations[0].vigenteDesde = entryDate;
  affiliations[0].vigenteHasta = retirementDate;
  const locations = mutableRecordArray(payload.pilaWorkLocations);
  locations[0].vigenteDesde = entryDate;
  const riskAssignments = mutableRecordArray(payload.pilaRiskAssignments);
  riskAssignments[0].vigenteDesde = entryDate;

  const event = {
    eventId: singleIngress ? 'pila-ing-export-e2e' : 'pila-ret-export-e2e',
    codigo: singleIngress ? 'ING' : 'RET',
    fechaInicio: singleIngress ? entryDate : retirementDate,
    fechaFin: null,
    dias: null,
  };
  payload.pilaEvents = [event];

  const payroll = mutableRecord(payload.payroll);
  payroll.diasNomina = days;
  payroll.salarioBasico = monthlySalary;
  payroll.ibc = proratedSalary;
  payroll.salarioIntegral = false;
  payroll.tipoSalario = 'F';
  payroll.tipoSalarioBloqueos = [];
  payroll.novelties = [];
  payroll.pilaEvents = [event];
  payroll.salarioBasicoCampo40 = {
    valor: proratedSalary,
    reglaVersion: singleIngress
      ? 'PILA_ING_FIELD_40_FROM_APPROVED_BASE_V1'
      : 'PILA_RET_FIELD_40_FROM_APPROVED_BASE_V1',
    bloqueos: [],
  };

  const daysBySubsystem = mutableRecord(payroll.diasCotizadosPorSubsistema);
  for (const subsystem of ['pension', 'salud', 'riesgos', 'cajaCompensacion']) {
    daysBySubsystem[subsystem] = {
      valor: days,
      reglaVersion: singleIngress
        ? 'PILA_ING_DAYS_FROM_APPROVED_PAYROLL_V1'
        : 'PILA_RET_DAYS_FROM_APPROVED_PAYROLL_V1',
      bloqueos: [],
    };
  }

  const subsystemBases = mutableRecord(payroll.ibcPorSubsistema);
  for (const subsystem of ['pension', 'salud', 'riesgos', 'cajaCompensacion']) {
    subsystemBases[subsystem] = { valor: proratedSalary, sourceCount: 1 };
  }
  subsystemBases.otrosParafiscales = {
    valor: proratedSalary,
    sourceCount: 1,
    conceptIds: ['salary-base-concept'],
    reglaVersion: 'CO_PARAFISCAL_BASE_V2',
    bloqueos: [],
  };

  const contributionAmounts: Record<string, number> = singleIngress
    ? {
        PENSION_EMP: 224_000,
        PENSION_PAT: 672_000,
        SALUD_EMP: 224_000,
        SALUD_PAT: 476_000,
        ARL: 29_300,
        CAJA: 224_000,
        SENA: 112_000,
        ICBF: 168_000,
      }
    : {
        PENSION_EMP: 213_400,
        PENSION_PAT: 640_000,
        SALUD_EMP: 213_400,
        SALUD_PAT: 453_400,
        ARL: 27_900,
        CAJA: 213_400,
        SENA: 106_700,
        ICBF: 160_000,
      };
  const concepts = mutableRecordArray(payroll.concepts);
  for (const concept of concepts) {
    const amount = contributionAmounts[String(concept.codigo)];
    if (amount !== undefined) {
      concept.base = proratedSalary;
      concept.valor = amount;
    }
  }
  concepts.push({
    id: 'salary-base-concept',
    codigo: 'SALARIO_BASE',
    tipo: 'EARNING',
    base: null,
    factor: null,
    valor: proratedSalary,
  });
  payroll.concepts = concepts;

  const fsp = mutableRecord(payroll.fspSubaccounts);
  fsp.ibcPensionalAgregado = proratedSalary;
  return snapshot;
}

export async function seedPilaExportFixture(
  tenantId: string,
  actorId: string,
  employeeCount: number,
  scenario: PilaExportScenario = 'FULL_MONTH',
): Promise<PilaExportFixture> {
  const singleIngress = scenario === 'SINGLE_INGRESS';
  const singleRetirement = scenario === 'SINGLE_RETIREMENT';
  const singlePartialPeriod = singleIngress || singleRetirement;
  if (singlePartialPeriod && employeeCount !== 1) {
    throw new Error('El fixture parcial requiere exactamente un empleado.');
  }

  const { PrismaClient } = require('../../apps/api/node_modules/@prisma/client') as {
    PrismaClient: new () => any;
  };
  const prisma = new PrismaClient();
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const periodId = randomUUID();
  const monthlySalary = singlePartialPeriod ? 8_000_000 : 3_000_000;
  const salary = singleIngress ? 5_600_000 : singleRetirement ? 5_333_333 : monthlySalary;
  const employeeEntryDate = singleIngress
    ? '2026-10-10'
    : singleRetirement
      ? '2025-01-01'
      : '2026-01-01';
  const retirementDate = singleRetirement ? '2026-10-20' : null;
  const employeeDeductions = singleIngress ? 448_000 : singleRetirement ? 426_800 : 0;
  const employerContributions = singleIngress ? 1_681_300 : singleRetirement ? 1_601_400 : 900_000;
  const employees = Array.from({ length: employeeCount }, (_, index) => {
    const employeeId = randomUUID();
    const contractId = randomUUID();
    const cedula = String(1_000_000_000 + index);
    return {
      employeeId,
      contractId,
      cedula,
      payrollRunId: randomUUID(),
      snapshotId: randomUUID(),
      approved: buildApprovedSnapshot(
        completeApprovedSnapshot({
          tenantId,
          periodId,
          employeeId,
          contractId,
          actorId,
          employeeDocumentNumber: cedula,
          periodStart: '2026-10-01',
          periodEnd: '2026-10-31',
          paymentDate: '2026-11-06',
        }),
        scenario,
      ),
    };
  });

  try {
    await prisma.$connect();
    await prisma.$transaction(async (tx: any) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
      await tx.empleado.createMany({
        data: employees.map(({ employeeId, cedula }) => ({
          id: employeeId,
          tenantId,
          cedula,
          tipoDocumento: 'CC',
          primerNombre: 'Ana',
          primerApellido: 'Pérez',
          cargo: 'Analista',
          salario: monthlySalary,
          fechaIngreso: new Date(employeeEntryDate + 'T00:00:00.000Z'),
          fechaRetiro: retirementDate ? new Date(retirementDate + 'T00:00:00.000Z') : null,
          estado: singleRetirement ? 'RETIRADO' : 'ACTIVO',
        })),
      });
      await tx.contrato.createMany({
        data: employees.map(({ employeeId, contractId }) => ({
          id: contractId,
          tenantId,
          empleadoId: employeeId,
          tipo: 'TERMINO_INDEFINIDO',
          estado: singleRetirement ? 'TERMINADO' : 'VIGENTE',
          fechaInicio: new Date(employeeEntryDate + 'T00:00:00.000Z'),
          fechaFin: retirementDate ? new Date(retirementDate + 'T00:00:00.000Z') : null,
          cargo: 'Analista',
          salario: monthlySalary,
        })),
      });
      await tx.payrollPeriod.create({
        data: {
          id: periodId,
          tenantId,
          nombre: 'Nómina PILA E2E octubre ' + suffix,
          fechaInicio: new Date('2026-10-01T00:00:00.000Z'),
          fechaFin: new Date('2026-10-31T00:00:00.000Z'),
          fechaPrevistaPagoPila: new Date('2026-11-06T00:00:00.000Z'),
          status: 'APROBADA',
          aprobadoPorId: actorId,
          aprobadoEn: new Date('2026-10-31T00:00:00.000Z'),
        },
      });
      await tx.payrollRun.createMany({
        data: employees.map(({ employeeId, payrollRunId }) => ({
          id: payrollRunId,
          tenantId,
          payrollPeriodId: periodId,
          employeeId,
          totalDevengos: salary,
          totalDeducciones: employeeDeductions,
          netoPagar: salary - employeeDeductions,
          salarioBaseSnapshot: monthlySalary,
          totalAportesPatronales: employerContributions,
          totalProvisiones: singleIngress ? 1_000_000 : 250_000,
        })),
      });
      await tx.payrollSnapshot.createMany({
        data: employees.map(({ employeeId, contractId, payrollRunId, snapshotId, approved }) => ({
          id: snapshotId,
          tenantId,
          payrollRunId,
          payrollPeriodId: periodId,
          employeeId,
          contratoId: contractId,
          aprobadoPorId: actorId,
          estadoPeriodo: 'APROBADA',
          origen: 'BROWSER_E2E',
          payloadVersion: 1,
          payload: {
            period: {
              payrollPeriodId: periodId,
              fechaInicio: '2026-10-01',
              fechaFin: '2026-10-31',
            },
            employee: {
              employeeId,
              fechaIngreso: employeeEntryDate,
              fechaRetiro: retirementDate,
              salarioBaseUsado: salary,
              salarioIntegralUsado: false,
            },
            contract: {
              contratoId: contractId,
              tipo: 'TERMINO_INDEFINIDO',
              estado: singleRetirement ? 'TERMINADO' : 'VIGENTE',
              fechaInicio: employeeEntryDate + 'T00:00:00.000Z',
              fechaFin: retirementDate ? retirementDate + 'T00:00:00.000Z' : null,
            },
            legalParameters: { auxilioTransporte: 0 },
            novelties: [],
            concepts: [],
            totals: { auxilioTransporte: 0 },
          },
          pilaPayloadVersion: approved.payloadVersion,
          pilaPayload: approved.payload,
        })),
      });
    });

    return {
      periodId,
      employeeCount,
      inspectPersistedState: async () =>
        prisma.$transaction(async (tx: any) => {
          await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
          const [period, snapshots, exports] = await Promise.all([
            tx.payrollPeriod.findFirst({
              where: { id: periodId, tenantId },
              select: { status: true },
            }),
            tx.payrollSnapshot.count({
              where: { tenantId, payrollPeriodId: periodId },
            }),
            tx.pilaExport.findMany({
              where: { tenantId, payrollPeriodId: periodId },
              orderBy: { createdAt: 'desc' },
              select: {
                id: true,
                status: true,
                sourceSnapshotIds: true,
                type1Sha256: true,
                type1SizeBytes: true,
                type1RecordCount: true,
                type2Sha256: true,
                type2SizeBytes: true,
                type2RecordCount: true,
                detailRecordCount: true,
              },
            }),
          ]);
          return {
            periodStatus: period?.status,
            snapshotCount: snapshots,
            exports,
          };
        }),
      disconnect: () => prisma.$disconnect(),
    };
  } catch (error) {
    await prisma.$disconnect();
    throw error;
  }
}
