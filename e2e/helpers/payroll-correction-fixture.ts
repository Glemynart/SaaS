import { randomUUID } from 'node:crypto';
import { calculate } from '../../apps/api/src/payroll/calculator/payroll-calculator';
import type { LegalParamsSnapshot } from '../../apps/api/src/payroll/calculator/payroll-types';

type PayrollCorrectionFixture = {
  periodId: string;
  runId: string;
  snapshotId: string;
  centroCostoId: string;
  originalPayload: Record<string, unknown>;
  originalTotals: {
    devengos: number;
    deducciones: number;
    neto: number;
  };
  inspectPersistedState: () => Promise<{
    periodStatus: string | undefined;
    run: {
      salarioBaseSnapshot: number;
      totalDevengos: number;
      totalDeducciones: number;
      netoPagar: number;
    } | null;
    snapshotPayload: unknown;
    snapshotStatus: string | undefined;
    correctionStatus: string | undefined;
    correctionMaterialization: unknown;
    vouchers: Array<{
      id: string;
      estado: string;
      totalDebito: number;
      totalCredito: number;
      movementCount: number;
    }>;
    auditActions: string[];
  }>;
  disconnect: () => Promise<void>;
};

const ACCOUNT_ROLES = [
  'SALARIOS_POR_PAGAR',
  'APORTES_SALUD_POR_PAGAR',
  'APORTES_RIESGOS_LABORALES_POR_PAGAR',
  'APORTES_PARAFISCALES_POR_PAGAR',
  'APORTES_PENSION_POR_PAGAR',
  'PROVISION_CESANTIAS_POR_PAGAR',
  'PROVISION_INTERESES_CESANTIAS_POR_PAGAR',
  'PROVISION_VACACIONES_POR_PAGAR',
  'PROVISION_PRIMA_POR_PAGAR',
  'GASTO_SUELDOS',
  'GASTO_APORTES_SALUD',
  'GASTO_APORTES_PENSION',
  'GASTO_APORTES_RIESGOS_LABORALES',
  'GASTO_APORTES_CAJA',
  'GASTO_APORTES_ICBF',
  'GASTO_APORTES_SENA',
  'GASTO_PROVISION_CESANTIAS',
  'GASTO_PROVISION_INTERESES_CESANTIAS',
  'GASTO_PROVISION_VACACIONES',
  'GASTO_PROVISION_PRIMA',
] as const;

const ACCOUNT_NAMES: Record<(typeof ACCOUNT_ROLES)[number], string> = {
  SALARIOS_POR_PAGAR: 'Salarios netos por pagar',
  APORTES_SALUD_POR_PAGAR: 'Aportes salud por pagar',
  APORTES_RIESGOS_LABORALES_POR_PAGAR: 'Aportes de riesgos laborales por pagar',
  APORTES_PARAFISCALES_POR_PAGAR: 'Aportes parafiscales por pagar',
  APORTES_PENSION_POR_PAGAR: 'Aportes de pensión por pagar',
  PROVISION_CESANTIAS_POR_PAGAR: 'Cesantías por pagar',
  PROVISION_INTERESES_CESANTIAS_POR_PAGAR: 'Intereses de cesantías por pagar',
  PROVISION_VACACIONES_POR_PAGAR: 'Vacaciones por pagar',
  PROVISION_PRIMA_POR_PAGAR: 'Prima de servicios por pagar',
  GASTO_SUELDOS: 'Gastos de personal',
  GASTO_APORTES_SALUD: 'Aporte patronal a EPS',
  GASTO_APORTES_PENSION: 'Aporte patronal a pensión',
  GASTO_APORTES_RIESGOS_LABORALES: 'Aporte patronal a ARL',
  GASTO_APORTES_CAJA: 'Aporte a caja de compensación',
  GASTO_APORTES_ICBF: 'Aporte al ICBF',
  GASTO_APORTES_SENA: 'Aporte al SENA',
  GASTO_PROVISION_CESANTIAS: 'Gasto de cesantías',
  GASTO_PROVISION_INTERESES_CESANTIAS: 'Gasto de intereses de cesantías',
  GASTO_PROVISION_VACACIONES: 'Gasto de vacaciones',
  GASTO_PROVISION_PRIMA: 'Gasto de prima de servicios',
};

const LEGAL_PARAMS: LegalParamsSnapshot = {
  smmlv: 1_423_500,
  auxilioTransporte: 202_897,
  topeIbcMinSmmlv: 1,
  topeIbcMaxSmmlv: 25,
  umbralAuxilioSmmlv: 2,
  umbralExoneracionSmmlv: 10,
  pctSaludEmpleado: 0.04,
  pctPensionEmpleado: 0.04,
  pctSaludEmpleador: 0.085,
  pctPensionEmpleador: 0.12,
  pctCaja: 0.04,
  pctIcbf: 0.03,
  pctSena: 0.02,
  arlPorClase: {
    1: 0.00522,
    2: 0.01044,
    3: 0.02436,
    4: 0.0435,
    5: 0.0696,
  },
  factorProvPrima: 0.0833,
  factorProvCesantias: 0.0833,
  factorProvIntCesantias: 0.01,
  factorProvVacaciones: 0.0417,
  fspTramos: [],
};

function toFrozenLegalParams(params: LegalParamsSnapshot) {
  return {
    smmlv: params.smmlv,
    auxilioTransporte: params.auxilioTransporte,
    topes: {
      topeIbcMinSmmlv: params.topeIbcMinSmmlv,
      topeIbcMaxSmmlv: params.topeIbcMaxSmmlv,
      umbralAuxilioSmmlv: params.umbralAuxilioSmmlv,
      umbralExoneracionSmmlv: params.umbralExoneracionSmmlv,
    },
    tarifasEmpleado: {
      pctSaludEmpleado: params.pctSaludEmpleado,
      pctPensionEmpleado: params.pctPensionEmpleado,
    },
    tarifasEmpleador: {
      pctSaludEmpleador: params.pctSaludEmpleador,
      pctPensionEmpleador: params.pctPensionEmpleador,
      pctCaja: params.pctCaja,
      pctIcbf: params.pctIcbf,
      pctSena: params.pctSena,
    },
    tarifasArl: {
      arlClaseI: params.arlPorClase[1],
      arlClaseII: params.arlPorClase[2],
      arlClaseIII: params.arlPorClase[3],
      arlClaseIV: params.arlPorClase[4],
      arlClaseV: params.arlPorClase[5],
    },
    factoresProvision: {
      factorProvPrima: params.factorProvPrima,
      factorProvCesantias: params.factorProvCesantias,
      factorProvIntCesantias: params.factorProvIntCesantias,
      factorProvVacaciones: params.factorProvVacaciones,
    },
    fspTramos: params.fspTramos.map((tramo) => ({
      desdeSmmlv: tramo.desdeSmmlv,
      hastaSmmlv: tramo.hastaSmmlv,
      pct: tramo.pct,
    })),
  };
}

/** Seeds a synthetic approved payroll and accounting setup for Browser E2E. */
export async function seedPayrollCorrectionFixture(
  tenantId: string,
  actorId: string,
): Promise<PayrollCorrectionFixture> {
  const { PrismaClient } = require('../../apps/api/node_modules/@prisma/client') as {
    PrismaClient: new () => any;
  };
  const prisma = new PrismaClient();
  const suffix = randomUUID();
  const employeeId = randomUUID();
  const periodId = randomUUID();
  const runId = randomUUID();
  const snapshotId = randomUUID();
  const centroCostoId = randomUUID();
  const fechaInicioNomina = new Date('2026-03-01T00:00:00.000Z');
  const fechaFinNomina = new Date('2026-03-31T00:00:00.000Z');
  const calculation = calculate({
    salarioBase: 2_000_000,
    salarioIntegral: false,
    claseRiesgoArl: 1,
    aportesExonerados: false,
    legalParams: LEGAL_PARAMS,
    novelties: [],
  });
  const originalPayload = {
    employee: { salarioBaseUsado: 2_000_000, salarioIntegralUsado: false },
    contract: { claseRiesgoArlUsada: 1 },
    companyPolicy: { aportesExonerados: false },
    legalParameters: toFrozenLegalParams(LEGAL_PARAMS),
    concepts: calculation.concepts.map(({ codigo, tipo, nombre, base, factor, valor }) => ({
      codigo,
      tipo,
      nombre,
      base,
      factor,
      valor,
    })),
  };
  const now = new Date();
  const periodoDesde = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const periodoHasta = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));

  try {
    await prisma.$connect();
    await prisma.$transaction(async (tx: any) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
      await tx.tipoComprobante.upsert({
        where: { codigo: 'NOM' },
        update: { activo: true },
        create: { codigo: 'NOM', nombre: 'Nómina', prefijo: 'NOM' },
      });
      await tx.centroCosto.create({
        data: {
          id: centroCostoId,
          tenantId,
          codigo: `E2E-${suffix.slice(0, 8)}`,
          nombre: 'Sede Centro',
        },
      });
      await tx.empleado.create({
        data: {
          id: employeeId,
          tenantId,
          cedula: `payroll-correction-${suffix}`,
          tipoDocumento: 'CC',
          primerNombre: 'Ana',
          primerApellido: 'Pérez',
          cargo: 'Docente',
          salario: 2_000_000,
          fechaIngreso: new Date('2025-01-01T00:00:00.000Z'),
        },
      });
      await tx.tercero.create({
        data: {
          tenantId,
          tipoDocumento: 'CC',
          numeroDocumento: `payroll-correction-${suffix}`,
          tipoPersona: 'NATURAL',
          primerNombre: 'Ana',
          primerApellido: 'Pérez',
          esEmpleado: true,
        },
      });
      await tx.payrollPeriod.create({
        data: {
          id: periodId,
          tenantId,
          nombre: 'Nómina marzo 2026',
          fechaInicio: fechaInicioNomina,
          fechaFin: fechaFinNomina,
          status: 'APROBADA',
          aprobadoPorId: actorId,
          aprobadoEn: new Date('2026-03-31T18:00:00.000Z'),
        },
      });
      await tx.payrollRun.create({
        data: {
          id: runId,
          tenantId,
          payrollPeriodId: periodId,
          employeeId,
          centroCostoId,
          totalDevengos: calculation.totalDevengos,
          totalDeducciones: calculation.totalDeducciones,
          netoPagar: calculation.netoPagar,
          totalAportesPatronales: calculation.totalAportesPatronales,
          totalProvisiones: calculation.totalProvisiones,
          salarioBaseSnapshot: 2_000_000,
          concepts: {
            create: calculation.concepts.map((concept) => ({
              codigo: concept.codigo,
              tipo: concept.tipo,
              nombre: concept.nombre,
              valor: concept.valor,
              base: concept.base,
              factor: concept.factor,
            })),
          },
        },
      });
      await tx.payrollSnapshot.create({
        data: {
          id: snapshotId,
          tenantId,
          payrollRunId: runId,
          payrollPeriodId: periodId,
          employeeId,
          centroCostoId,
          aprobadoPorId: actorId,
          estadoPeriodo: 'APROBADA',
          origen: 'BROWSER_E2E',
          payloadVersion: 1,
          payload: originalPayload,
        },
      });
      await tx.periodoContable.create({
        data: {
          tenantId,
          anio: now.getUTCFullYear(),
          mes: now.getUTCMonth() + 1,
          fechaInicio: periodoDesde,
          fechaFin: periodoHasta,
          estado: 'ABIERTO',
        },
      });
      if (
        periodoDesde.getUTCFullYear() !== fechaFinNomina.getUTCFullYear() ||
        periodoDesde.getUTCMonth() !== fechaFinNomina.getUTCMonth()
      ) {
        await tx.periodoContable.create({
          data: {
            tenantId,
            anio: fechaFinNomina.getUTCFullYear(),
            mes: fechaFinNomina.getUTCMonth() + 1,
            fechaInicio: fechaInicioNomina,
            fechaFin: fechaFinNomina,
            estado: 'ABIERTO',
          },
        });
      }

      for (const [index, role] of ACCOUNT_ROLES.entries()) {
        const isExpense = role.startsWith('GASTO_');
        const account = await tx.cuentaContable.create({
          data: {
            tenantId,
            codigo: `E2E-${suffix.slice(0, 8)}-${index + 1}`,
            nombre: ACCOUNT_NAMES[role],
            claseContable: isExpense ? 'GASTOS' : 'PASIVO',
            naturaleza: isExpense ? 'DEBITO' : 'CREDITO',
            nivel: 5,
            imputable: true,
            esCuentaSistema: false,
            requiereTercero: false,
            requiereCentroCosto: false,
            requiereBase: false,
            activa: true,
          },
        });
        await tx.cuentaSistemaMap.create({
          data: { tenantId, rol: role, cuentaId: account.id },
        });
      }
    });

    return {
      periodId,
      runId,
      snapshotId,
      centroCostoId,
      originalPayload,
      originalTotals: {
        devengos: calculation.totalDevengos,
        deducciones: calculation.totalDeducciones,
        neto: calculation.netoPagar,
      },
      inspectPersistedState: async () =>
        prisma.$transaction(async (tx: any) => {
          await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
          const [period, run, snapshot, correction, vouchers, auditLogs] = await Promise.all([
            tx.payrollPeriod.findFirst({ where: { id: periodId, tenantId } }),
            tx.payrollRun.findFirst({ where: { id: runId, tenantId } }),
            tx.payrollSnapshot.findFirst({ where: { id: snapshotId, tenantId } }),
            tx.payrollCorrection.findFirst({ where: { tenantId, payrollPeriodId: periodId } }),
            tx.comprobanteContable.findMany({
              where: {
                tenantId,
                origenTipo: 'PAYROLL_CORRECTION',
                origenId: { not: null },
                origenEvento: 'AJUSTE',
                estado: { not: 'ANULADO' },
              },
              include: { movimientos: { select: { id: true } } },
            }),
            tx.auditLog.findMany({ where: { tenantId } }),
          ]);
          return {
            periodStatus: period?.status,
            run: run
              ? {
                  salarioBaseSnapshot: Number(run.salarioBaseSnapshot),
                  totalDevengos: Number(run.totalDevengos),
                  totalDeducciones: Number(run.totalDeducciones),
                  netoPagar: Number(run.netoPagar),
                }
              : null,
            snapshotPayload: snapshot?.payload,
            snapshotStatus: snapshot?.estadoPeriodo,
            correctionStatus: correction?.status,
            correctionMaterialization: correction?.materialization,
            vouchers: vouchers.map((voucher: any) => ({
              id: voucher.id,
              estado: voucher.estado,
              totalDebito: Number(voucher.totalDebito),
              totalCredito: Number(voucher.totalCredito),
              movementCount: voucher.movimientos.length,
            })),
            auditActions: auditLogs.map((entry: any) => entry.action),
          };
        }),
      disconnect: () => prisma.$disconnect(),
    };
  } catch (error) {
    await prisma.$disconnect();
    throw error;
  }
}
