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

export async function seedPilaExportFixture(
  tenantId: string,
  actorId: string,
  employeeCount: number,
): Promise<PilaExportFixture> {
  const { PrismaClient } = require('../../apps/api/node_modules/@prisma/client') as {
    PrismaClient: new () => any;
  };
  const prisma = new PrismaClient();
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const periodId = randomUUID();
  const salary = 3_000_000;
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
      approved: completeApprovedSnapshot({
        tenantId,
        periodId,
        employeeId,
        contractId,
        actorId,
        employeeDocumentNumber: cedula,
      }),
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
          salario: salary,
          fechaIngreso: new Date('2026-01-01T00:00:00.000Z'),
          estado: 'ACTIVO',
        })),
      });
      await tx.contrato.createMany({
        data: employees.map(({ employeeId, contractId }) => ({
          id: contractId,
          tenantId,
          empleadoId: employeeId,
          tipo: 'TERMINO_INDEFINIDO',
          estado: 'VIGENTE',
          fechaInicio: new Date('2026-01-01T00:00:00.000Z'),
          cargo: 'Analista',
          salario: salary,
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
          totalDeducciones: 0,
          netoPagar: salary,
          salarioBaseSnapshot: salary,
          totalAportesPatronales: 900_000,
          totalProvisiones: 250_000,
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
              salarioBaseUsado: salary,
              salarioIntegralUsado: false,
            },
            contract: {
              contratoId: contractId,
              tipo: 'TERMINO_INDEFINIDO',
              estado: 'VIGENTE',
              fechaInicio: '2026-01-01T00:00:00.000Z',
              fechaFin: null,
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
