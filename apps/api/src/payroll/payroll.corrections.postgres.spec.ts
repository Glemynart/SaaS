import { Prisma, PayrollPeriodStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { LedgerService } from '../accounting/ledger/ledger.service';
import { PayrollAccountingPreflightService } from './accounting-preflight/payroll-accounting-preflight.service';
import { PayrollService } from './payroll.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextBoundary } from '../tenant-context/tenant-context.boundary';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import { calculate } from './calculator/payroll-calculator';
import { LegalParamsSnapshot } from './calculator/payroll-types';
import {
  PayrollCorrectionCalculationInput,
  PayrollCorrectionIntentKind,
} from './corrections/payroll-correction.types';

describe('Payroll corrections PostgreSQL integration', () => {
  const prisma = new PrismaService();
  const tenantContext = new TenantContextService();
  const tenantPrisma = new TenantPrismaService(
    prisma,
    new TenantContextBoundary(tenantContext),
  );
  const suffix = randomUUID();
  const tenantId = randomUUID();
  const actorId = randomUUID();
  const employeeId = randomUUID();
  const periodId = randomUUID();
  const runId = randomUUID();
  const snapshotId = randomUUID();
  const service = new PayrollService(
    prisma,
    tenantPrisma,
    new AuditService(prisma),
    {} as LedgerService,
    {} as PayrollAccountingPreflightService,
  );

  const legalParams: LegalParamsSnapshot = {
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

  const frozenLegalParams = {
    smmlv: legalParams.smmlv,
    auxilioTransporte: legalParams.auxilioTransporte,
    topes: {
      topeIbcMinSmmlv: legalParams.topeIbcMinSmmlv,
      topeIbcMaxSmmlv: legalParams.topeIbcMaxSmmlv,
      umbralAuxilioSmmlv: legalParams.umbralAuxilioSmmlv,
      umbralExoneracionSmmlv: legalParams.umbralExoneracionSmmlv,
    },
    tarifasEmpleado: {
      pctSaludEmpleado: legalParams.pctSaludEmpleado,
      pctPensionEmpleado: legalParams.pctPensionEmpleado,
    },
    tarifasEmpleador: {
      pctSaludEmpleador: legalParams.pctSaludEmpleador,
      pctPensionEmpleador: legalParams.pctPensionEmpleador,
      pctCaja: legalParams.pctCaja,
      pctIcbf: legalParams.pctIcbf,
      pctSena: legalParams.pctSena,
    },
    tarifasArl: {
      arlClaseI: legalParams.arlPorClase[1],
      arlClaseII: legalParams.arlPorClase[2],
      arlClaseIII: legalParams.arlPorClase[3],
      arlClaseIV: legalParams.arlPorClase[4],
      arlClaseV: legalParams.arlPorClase[5],
    },
    factoresProvision: {
      factorProvPrima: legalParams.factorProvPrima,
      factorProvCesantias: legalParams.factorProvCesantias,
      factorProvIntCesantias: legalParams.factorProvIntCesantias,
      factorProvVacaciones: legalParams.factorProvVacaciones,
    },
    fspTramos: legalParams.fspTramos.map((tramo) => ({
      desdeSmmlv: tramo.desdeSmmlv,
      hastaSmmlv: tramo.hastaSmmlv,
      pct: tramo.pct,
    })),
  };

  const originalCalculation = calculate({
    salarioBase: 2_000_000,
    salarioIntegral: false,
    claseRiesgoArl: 1,
    aportesExonerados: false,
    legalParams,
    novelties: [],
  });

  const originalPayload = {
    employee: { salarioBaseUsado: 2_000_000, salarioIntegralUsado: false },
    contract: { claseRiesgoArlUsada: 1 },
    companyPolicy: { aportesExonerados: false },
    legalParameters: frozenLegalParams,
    concepts: originalCalculation.concepts.map(
      ({ codigo, tipo, nombre, base, factor, valor }) => ({
        codigo,
        tipo,
        nombre,
        base,
        factor,
        valor,
      }),
    ),
  } satisfies Prisma.InputJsonValue;

  beforeAll(async () => {
    await prisma.$connect();
    await prisma.$transaction(async (tx) => {
      await tx.tenant.create({
        data: {
          id: tenantId,
          nombre: `Payroll correction integration ${suffix.slice(0, 8)}`,
          nit: `9${suffix.replaceAll('-', '').slice(0, 9)}`,
          digitoVerif: '1',
          razonSocial: 'Payroll Correction Integration S.A.S.',
        },
      });
      await tx.user.create({
        data: {
          id: actorId,
          tenantId,
          email: `payroll-correction-${suffix}@example.test`,
          passwordHash: 'not-a-real-password-hash',
          nombre: 'Usuario',
          apellido: 'Integración',
          rol: 'ADMIN',
        },
      });
      await tx.empleado.create({
        data: {
          id: employeeId,
          tenantId,
          cedula: `e2e-${suffix}`,
          primerNombre: 'Ana',
          primerApellido: 'Integración',
          cargo: 'Docente',
          salario: 2_000_000,
          fechaIngreso: new Date('2025-01-01T00:00:00.000Z'),
        },
      });
      await tx.payrollPeriod.create({
        data: {
          id: periodId,
          tenantId,
          nombre: 'Período integración correcciones',
          fechaInicio: new Date('2026-03-01T00:00:00.000Z'),
          fechaFin: new Date('2026-03-31T00:00:00.000Z'),
          status: PayrollPeriodStatus.APROBADA,
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
          totalDevengos: originalCalculation.totalDevengos,
          totalDeducciones: originalCalculation.totalDeducciones,
          netoPagar: originalCalculation.netoPagar,
          salarioBaseSnapshot: 2_000_000,
        },
      });
      await tx.payrollSnapshot.create({
        data: {
          id: snapshotId,
          tenantId,
          payrollRunId: runId,
          payrollPeriodId: periodId,
          employeeId,
          estadoPeriodo: PayrollPeriodStatus.APROBADA,
          origen: 'INTEGRATION_TEST',
          payloadVersion: 1,
          payload: originalPayload,
        },
      });
    });
  }, 30000);

  afterAll(async () => {
    try {
      await prisma.payrollCorrection.deleteMany({ where: { tenantId } });
      await prisma.payrollSnapshot.deleteMany({ where: { tenantId } });
      await prisma.payrollRun.deleteMany({ where: { tenantId } });
      await prisma.payrollPeriod.deleteMany({ where: { tenantId } });
      await prisma.empleado.deleteMany({ where: { tenantId } });
      await prisma.auditLog.deleteMany({ where: { tenantId } });
      await prisma.user.deleteMany({ where: { tenantId } });
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
    } finally {
      await prisma.$disconnect();
    }
  }, 30000);

  it('persists the create-review-approve correction cycle without mutating the approved payroll', async () => {
    const created = await service.createCorrection(
      tenantId,
      actorId,
      periodId,
      {
        descripcion: 'Ajuste salarial integración',
        intents: [
          {
            kind: PayrollCorrectionIntentKind.SET_CALCULATION_INPUT,
            snapshotId,
            input: PayrollCorrectionCalculationInput.SALARIO_BASE,
            targetAmount: 2_500_000,
          },
        ],
      },
    );
    expect(created.status).toBe('BORRADOR');

    const submitted = await service.enviarCorrectionARevision(
      tenantId,
      actorId,
      created.id,
    );
    expect(submitted.status).toBe('EN_REVISION');

    const approved = await service.aprobarCorrection(
      tenantId,
      actorId,
      created.id,
    );
    expect(approved.status).toBe('APROBADA');
    const materialization = approved.materialization as {
      version: number;
      snapshotIds: string[];
      entries: Array<{
        snapshotId: string;
        employeeId: string;
        centroCostoId: string | null;
        concept: { codigo: string; tipo: string };
        delta: number;
      }>;
    };
    expect(materialization.version).toBe(1);
    expect(materialization.snapshotIds).toEqual([snapshotId]);
    expect(materialization.entries).toContainEqual({
      snapshotId,
      employeeId,
      centroCostoId: null,
      concept: { codigo: 'SALARIO_BASE', tipo: 'EARNING' },
      delta: 500_000,
    });

    const persisted = await tenantContext.run(
      {
        tenantId,
        userId: actorId,
        rol: 'ADMIN',
        email: 'payroll-corrections@test.local',
      },
      () => service.findPeriodCorrections(tenantId, periodId),
    );
    expect(persisted).toHaveLength(1);
    expect(persisted[0]).toMatchObject({
      id: created.id,
      status: 'APROBADA',
      materialization: approved.materialization,
      accountingVoucher: null,
    });

    const [snapshotAfter, runAfter, periodAfter, auditLogs] = await Promise.all(
      [
        prisma.payrollSnapshot.findUniqueOrThrow({ where: { id: snapshotId } }),
        prisma.payrollRun.findUniqueOrThrow({ where: { id: runId } }),
        prisma.payrollPeriod.findUniqueOrThrow({ where: { id: periodId } }),
        prisma.auditLog.findMany({ where: { tenantId } }),
      ],
    );
    expect(snapshotAfter.payload).toEqual(originalPayload);
    expect(Number(runAfter.salarioBaseSnapshot)).toBe(2_000_000);
    expect(Number(runAfter.totalDevengos)).toBe(
      originalCalculation.totalDevengos,
    );
    expect(periodAfter.status).toBe(PayrollPeriodStatus.APROBADA);
    expect(auditLogs.map((entry) => entry.action).sort()).toEqual(
      [
        'PAYROLL_CORRECTION_APPROVED',
        'PAYROLL_CORRECTION_CREATED',
        'PAYROLL_CORRECTION_SENT_TO_REVIEW',
      ].sort(),
    );

    await expect(
      service.findPeriodCorrections(randomUUID(), periodId),
    ).rejects.toThrow('Período no encontrado');
  }, 30000);
});
