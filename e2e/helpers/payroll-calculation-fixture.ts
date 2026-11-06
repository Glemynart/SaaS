import { randomUUID } from 'node:crypto';

type PayrollCalculationFixture = {
  employeeId: string;
  employeeName: string;
  inspect: (periodId: string) => Promise<{
    periodStatus: string | undefined;
    runs: Array<{
      id: string;
      totalDevengos: number;
      totalDeducciones: number;
      netoPagar: number;
      salarioBaseSnapshot: number | null;
      ibc: number | null;
      calculationTrace: { employee?: { diasNomina?: number } } | null;
      concepts: Array<{ codigo: string; valor: number }>;
    }>;
    snapshots: Array<{
      estadoPeriodo: string;
      payload: any;
      pilaPayloadVersion: number | null;
      pilaPayload: any;
    }>;
    vouchers: Array<{
      id: string;
      totalDebito: number;
      totalCredito: number;
      movimientoCount: number;
    }>;
  }>;
  disconnect: () => Promise<void>;
};

type PayrollCalculationFixtureOptions = {
  salarioMensual?: number;
  fechaIngreso?: string;
  fechaInicioContrato?: string;
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

/** Seeds only disposable account, contract, employee and legal-rule data for the UI flow. */
export async function seedPayrollCalculationFixture(
  tenantId: string,
  options: PayrollCalculationFixtureOptions = {},
): Promise<PayrollCalculationFixture> {
  const { PrismaClient } = require('../../apps/api/node_modules/@prisma/client') as {
    PrismaClient: new () => any;
  };
  const prisma = new PrismaClient();
  const employeeId = randomUUID();
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const cedula = `payroll-flow-${suffix}`;
  const employeeName = 'Ana Gómez';
  const legalParameterId = randomUUID();
  const contractId = randomUUID();
  const salarioMensual = options.salarioMensual ?? 8_000_000;
  const fechaIngreso = options.fechaIngreso ?? '2025-01-01';
  const fechaInicioContrato = options.fechaInicioContrato ?? fechaIngreso;

  try {
    await prisma.$connect();
    await prisma.$transaction(async (tx: any) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
      await tx.tipoComprobante.upsert({
        where: { codigo: 'NOM' },
        update: { activo: true },
        create: { codigo: 'NOM', nombre: 'Nómina', prefijo: 'NOM' },
      });
      await tx.parametroLegalNomina.create({
        data: {
          id: legalParameterId,
          tenantId,
          vigenciaDesde: new Date('2026-01-01T00:00:00.000Z'),
          anio: 2026,
          smmlv: 1_750_905,
          auxilioTransporte: 249_095,
          uvt: 52_374,
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
          arlClaseI: 0.00522,
          arlClaseII: 0.01044,
          arlClaseIII: 0.02436,
          arlClaseIV: 0.0435,
          arlClaseV: 0.0696,
          factorProvPrima: 0.0833,
          factorProvCesantias: 0.0833,
          factorProvIntCesantias: 0.01,
          factorProvVacaciones: 0.0417,
          fspTramos: [
            { desdeSmmlv: 0, hastaSmmlv: 4, pct: 0 },
            { desdeSmmlv: 4, hastaSmmlv: 16, pct: 0.01 },
            { desdeSmmlv: 16, hastaSmmlv: 17, pct: 0.012 },
            { desdeSmmlv: 17, hastaSmmlv: 18, pct: 0.014 },
            { desdeSmmlv: 18, hastaSmmlv: 19, pct: 0.016 },
            { desdeSmmlv: 19, hastaSmmlv: 20, pct: 0.018 },
            { desdeSmmlv: 20, hastaSmmlv: null, pct: 0.02 },
          ],
          fuente: 'Fixture sintético de Browser E2E; no es una parametrización operativa.',
          notas: 'Valores controlados por la prueba para el período de octubre de 2026.',
        },
      });
      await tx.empleado.create({
        data: {
          id: employeeId,
          tenantId,
          cedula,
          tipoDocumento: 'CC',
          primerNombre: 'Ana',
          primerApellido: 'Gómez',
          cargo: 'Auxiliar administrativa',
          salario: salarioMensual,
          fechaIngreso: new Date(`${fechaIngreso}T00:00:00.000Z`),
        },
      });
      await tx.tercero.create({
        data: {
          tenantId,
          tipoDocumento: 'CC',
          numeroDocumento: cedula,
          tipoPersona: 'NATURAL',
          primerNombre: 'Ana',
          primerApellido: 'Gómez',
          esEmpleado: true,
          activo: true,
        },
      });
      await tx.contrato.create({
        data: {
          id: contractId,
          tenantId,
          empleadoId: employeeId,
          tipo: 'TERMINO_INDEFINIDO',
          estado: 'VIGENTE',
          fechaInicio: new Date(`${fechaInicioContrato}T00:00:00.000Z`),
          cargo: 'Auxiliar administrativa',
          salario: salarioMensual,
          claseRiesgoArl: 1,
        },
      });
      await tx.periodoContable.create({
        data: {
          tenantId,
          anio: 2026,
          mes: 10,
          fechaInicio: new Date('2026-10-01T00:00:00.000Z'),
          fechaFin: new Date('2026-10-31T00:00:00.000Z'),
          estado: 'ABIERTO',
        },
      });

      for (const [index, role] of ACCOUNT_ROLES.entries()) {
        const isExpense = role.startsWith('GASTO_');
        const account = await tx.cuentaContable.create({
          data: {
            tenantId,
            codigo: `FLOW-${suffix}-${index + 1}`,
            nombre: role,
            claseContable: isExpense ? 'GASTOS' : 'PASIVO',
            naturaleza: isExpense ? 'DEBITO' : 'CREDITO',
            nivel: 5,
            imputable: true,
            esCuentaSistema: false,
            requiereTercero: role === 'SALARIOS_POR_PAGAR',
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
      employeeId,
      employeeName,
      inspect: async (periodId) =>
        prisma.$transaction(async (tx: any) => {
          await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
          const [period, runs, snapshots, vouchers] = await Promise.all([
            tx.payrollPeriod.findFirst({
              where: { id: periodId, tenantId },
              select: { status: true },
            }),
            tx.payrollRun.findMany({
              where: { tenantId, payrollPeriodId: periodId, employeeId },
              select: {
                id: true,
                totalDevengos: true,
                totalDeducciones: true,
                netoPagar: true,
                salarioBaseSnapshot: true,
                ibc: true,
                calculationTrace: true,
                concepts: { select: { codigo: true, valor: true } },
              },
            }),
            tx.payrollSnapshot.findMany({
              where: { tenantId, payrollPeriodId: periodId, employeeId },
              select: {
                estadoPeriodo: true,
                payload: true,
                pilaPayloadVersion: true,
                pilaPayload: true,
              },
            }),
            tx.comprobanteContable.findMany({
              where: {
                tenantId,
                origenTipo: 'PAYROLL',
                origenId: periodId,
                origenEvento: 'CAUSACION',
                estado: 'CONTABILIZADO',
              },
              include: { movimientos: { select: { id: true } } },
            }),
          ]);
          return {
            periodStatus: period?.status,
            runs: runs.map((run: any) => ({
              id: run.id,
              totalDevengos: Number(run.totalDevengos),
              totalDeducciones: Number(run.totalDeducciones),
              netoPagar: Number(run.netoPagar),
              salarioBaseSnapshot:
                run.salarioBaseSnapshot === null ? null : Number(run.salarioBaseSnapshot),
              ibc: run.ibc === null ? null : Number(run.ibc),
              calculationTrace: run.calculationTrace,
              concepts: run.concepts.map((concept: any) => ({
                codigo: concept.codigo,
                valor: Number(concept.valor),
              })),
            })),
            snapshots: snapshots.map((snapshot: any) => ({
              estadoPeriodo: snapshot.estadoPeriodo,
              payload: snapshot.payload,
              pilaPayloadVersion: snapshot.pilaPayloadVersion,
              pilaPayload: snapshot.pilaPayload,
            })),
            vouchers: vouchers.map((voucher: any) => ({
              id: voucher.id,
              totalDebito: Number(voucher.totalDebito),
              totalCredito: Number(voucher.totalCredito),
              movimientoCount: voucher.movimientos.length,
            })),
          };
        }),
      disconnect: () => prisma.$disconnect(),
    };
  } catch (error) {
    await prisma.$disconnect();
    throw error;
  }
}
