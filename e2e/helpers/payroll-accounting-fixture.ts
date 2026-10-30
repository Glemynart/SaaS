import { randomUUID } from 'node:crypto';

type PayrollAccrualFixture = {
  periodId: string;
  snapshotId: string;
  snapshotPayload: Record<string, unknown>;
  inspectPersistedState: () => Promise<{
    periodStatus: string | undefined;
    vouchers: Array<{ id: string; estado: string }>;
    snapshotPayload: unknown;
    snapshotStatus: string | undefined;
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
  GASTO_SUELDOS: 'Gasto de sueldos',
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

/**
 * Seeds synthetic accounting data in the disposable PostgreSQL database used
 * by Browser E2E. It deliberately uses the API workspace's generated client.
 */
export async function seedPayrollAccrualFixture(
  tenantId: string,
  actorId: string,
): Promise<PayrollAccrualFixture> {
  const { PrismaClient } = require('../../apps/api/node_modules/@prisma/client') as {
    PrismaClient: new () => any;
  };
  const prisma = new PrismaClient();
  const suffix = randomUUID();
  const employeeId = randomUUID();
  const periodId = randomUUID();
  const payrollRunId = randomUUID();
  const snapshotId = randomUUID();
  const fechaFin = new Date('2026-03-31T00:00:00.000Z');
  const snapshotPayload = {
    employee: { salarioBaseUsado: 1_000_000 },
    concepts: [
      { codigo: 'SALARIO_BASE', valor: 1_000_000 },
      { codigo: 'SALUD_EMP', valor: 40_000 },
      { codigo: 'PENSION_EMP', valor: 40_000 },
    ],
  };

  try {
    await prisma.$connect();
    await prisma.$transaction(async (tx: any) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
      await tx.tipoComprobante.upsert({
        where: { codigo: 'NOM' },
        update: { activo: true },
        create: { codigo: 'NOM', nombre: 'Nómina', prefijo: 'NOM' },
      });

      await tx.empleado.create({
        data: {
          id: employeeId,
          tenantId,
          cedula: `payroll-accrual-${suffix}`,
          primerNombre: 'Ana',
          primerApellido: 'Pérez',
          cargo: 'Docente',
          salario: 1_000_000,
          fechaIngreso: new Date('2025-01-01T00:00:00.000Z'),
        },
      });
      await tx.payrollPeriod.create({
        data: {
          id: periodId,
          tenantId,
          nombre: 'Nómina marzo 2026',
          fechaInicio: new Date('2026-03-01T00:00:00.000Z'),
          fechaFin,
          status: 'APROBADA',
          aprobadoPorId: actorId,
          aprobadoEn: fechaFin,
        },
      });
      await tx.payrollRun.create({
        data: {
          id: payrollRunId,
          tenantId,
          payrollPeriodId: periodId,
          employeeId,
          totalDevengos: 1_000_000,
          totalDeducciones: 80_000,
          netoPagar: 920_000,
          totalAportesPatronales: 0,
          totalProvisiones: 0,
          salarioBaseSnapshot: 1_000_000,
          concepts: {
            create: [
              {
                codigo: 'SALARIO_BASE',
                tipo: 'EARNING',
                nombre: 'Salario base',
                valor: 1_000_000,
              },
              {
                codigo: 'SALUD_EMP',
                tipo: 'DEDUCTION',
                nombre: 'Salud empleado',
                valor: 40_000,
              },
              {
                codigo: 'PENSION_EMP',
                tipo: 'DEDUCTION',
                nombre: 'Pensión empleado',
                valor: 40_000,
              },
            ],
          },
        },
      });
      await tx.payrollSnapshot.create({
        data: {
          id: snapshotId,
          tenantId,
          payrollRunId,
          payrollPeriodId: periodId,
          employeeId,
          estadoPeriodo: 'APROBADA',
          origen: 'BROWSER_E2E',
          payloadVersion: 1,
          payload: snapshotPayload,
        },
      });
      await tx.periodoContable.create({
        data: {
          tenantId,
          anio: 2026,
          mes: 3,
          fechaInicio: new Date('2026-03-01T00:00:00.000Z'),
          fechaFin,
          estado: 'ABIERTO',
        },
      });

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
      snapshotId,
      snapshotPayload,
      inspectPersistedState: async () =>
        prisma.$transaction(async (tx: any) => {
          await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
          const [period, vouchers, snapshot] = await Promise.all([
            tx.payrollPeriod.findFirst({ where: { id: periodId, tenantId } }),
            tx.comprobanteContable.findMany({
              where: {
                tenantId,
                origenTipo: 'PAYROLL',
                origenId: periodId,
                origenEvento: 'CAUSACION',
              },
              select: { id: true, estado: true },
            }),
            tx.payrollSnapshot.findFirst({ where: { id: snapshotId, tenantId } }),
          ]);
          return {
            periodStatus: period?.status,
            vouchers,
            snapshotPayload: snapshot?.payload,
            snapshotStatus: snapshot?.estadoPeriodo,
          };
        }),
      disconnect: () => prisma.$disconnect(),
    };
  } catch (error) {
    await prisma.$disconnect();
    throw error;
  }
}
