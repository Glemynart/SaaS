import {
  Prisma,
  PayrollCorrectionStatus,
  PayrollPeriodStatus,
} from '@prisma/client';
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
  const suffix = randomUUID();
  const role = 'rls_payroll_correction_' + suffix.replaceAll('-', '');
  const tenantContext = new TenantContextService();
  const rolePrisma = {
    $transaction: <T>(
      work: (tx: Prisma.TransactionClient) => Promise<T>,
      options?: {
        maxWait?: number;
        timeout?: number;
        isolationLevel?: Prisma.TransactionIsolationLevel;
      },
    ) =>
      prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe('SET LOCAL ROLE "' + role + '"');
        return work(tx);
      }, options),
  } as unknown as PrismaService;
  const tenantPrisma = new TenantPrismaService(
    rolePrisma,
    new TenantContextBoundary(tenantContext),
  );
  const tenantId = randomUUID();
  const otherTenantId = randomUUID();
  const actorId = randomUUID();
  const employeeId = randomUUID();
  const periodId = randomUUID();
  const otherPeriodId = randomUUID();
  const draftPeriodId = randomUUID();
  const otherCorrectionId = randomUUID();
  const draftCorrectionId = randomUUID();
  const runId = randomUUID();
  const snapshotId = randomUUID();
  let createdCorrectionId: string | undefined;
  const service = new PayrollService(
    prisma,
    tenantPrisma,
    new AuditService(prisma),
    {} as LedgerService,
    {} as PayrollAccountingPreflightService,
  );
  const withTenantContext = <T>(work: () => Promise<T>) =>
    tenantContext.run(
      {
        tenantId,
        userId: actorId,
        rol: 'ADMIN',
        email: 'payroll-corrections@test.local',
      },
      work,
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
    await dropTestRole();
    await prisma.$executeRawUnsafe(
      'CREATE ROLE "' + role + '" NOLOGIN NOSUPERUSER NOBYPASSRLS',
    );
    await prisma.$executeRawUnsafe(
      'GRANT USAGE ON SCHEMA public TO "' + role + '"',
    );
    await prisma.$executeRawUnsafe(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "payroll_corrections" TO "' +
        role +
        '"',
    );
    await prisma.$executeRawUnsafe(
      'GRANT SELECT ON TABLE "payroll_periods", "payroll_snapshots", ' +
        '"comprobantes_contables", "movimientos_contables", ' +
        '"cuentas_contables", "centros_costo" TO "' +
        role +
        '"',
    );
    await prisma.$executeRawUnsafe(
      'GRANT SELECT, INSERT ON TABLE "audit_logs" TO "' + role + '"',
    );
    await prisma.$executeRawUnsafe(
      'GRANT USAGE ON TYPE "PayrollCorrectionStatus", "PayrollPeriodStatus", ' +
        '"EstadoComprobante" TO "' +
        role +
        '"',
    );
    await prisma.$transaction(async (tx) => {
      await tx.tenant.createMany({
        data: [
          {
            id: tenantId,
            nombre: `Payroll correction integration ${suffix.slice(0, 8)}`,
            nit: `9${suffix.replaceAll('-', '').slice(0, 9)}`,
            digitoVerif: '1',
            razonSocial: 'Payroll Correction Integration S.A.S.',
          },
          {
            id: otherTenantId,
            nombre: `Payroll correction other tenant ${suffix.slice(0, 8)}`,
            nit: `8${suffix.replaceAll('-', '').slice(0, 9)}`,
            digitoVerif: '2',
            razonSocial: 'Payroll Correction Other Tenant S.A.S.',
          },
        ],
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
      await tx.payrollPeriod.createMany({
        data: [
          {
            id: periodId,
            tenantId,
            nombre: 'Período integración correcciones',
            fechaInicio: new Date('2026-03-01T00:00:00.000Z'),
            fechaFin: new Date('2026-03-31T00:00:00.000Z'),
            status: PayrollPeriodStatus.APROBADA,
            aprobadoPorId: actorId,
            aprobadoEn: new Date('2026-03-31T18:00:00.000Z'),
          },
          {
            id: otherPeriodId,
            tenantId: otherTenantId,
            nombre: 'Período de otro tenant',
            fechaInicio: new Date('2026-03-01T00:00:00.000Z'),
            fechaFin: new Date('2026-03-31T00:00:00.000Z'),
            status: PayrollPeriodStatus.APROBADA,
          },
          {
            id: draftPeriodId,
            tenantId,
            nombre: 'Período borrador sin correcciones',
            fechaInicio: new Date('2026-04-01T00:00:00.000Z'),
            fechaFin: new Date('2026-04-30T00:00:00.000Z'),
            status: PayrollPeriodStatus.BORRADOR,
          },
        ],
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
      await tx.payrollCorrection.create({
        data: {
          id: otherCorrectionId,
          tenantId: otherTenantId,
          payrollPeriodId: otherPeriodId,
          descripcion: 'Acto privado de otro tenant',
        },
      });
    });
  }, 30000);

  afterAll(async () => {
    try {
      await prisma.payrollCorrection.deleteMany({
        where: { tenantId: { in: [tenantId, otherTenantId] } },
      });
      await prisma.payrollSnapshot.deleteMany({ where: { tenantId } });
      await prisma.payrollRun.deleteMany({ where: { tenantId } });
      await prisma.payrollPeriod.deleteMany({
        where: { tenantId: { in: [tenantId, otherTenantId] } },
      });
      await prisma.empleado.deleteMany({ where: { tenantId } });
      await prisma.auditLog.deleteMany({ where: { tenantId } });
      await prisma.user.deleteMany({ where: { tenantId } });
      await prisma.tenant.deleteMany({
        where: { id: { in: [tenantId, otherTenantId] } },
      });
    } finally {
      try {
        await dropTestRole();
      } finally {
        await prisma.$disconnect();
      }
    }
  }, 30000);

  it('persists the create-review-approve correction cycle without mutating the approved payroll', async () => {
    const created = await withTenantContext(() =>
      service.createCorrection(tenantId, actorId, periodId, {
        descripcion: 'Ajuste salarial integración',
        intents: [
          {
            kind: PayrollCorrectionIntentKind.SET_CALCULATION_INPUT,
            snapshotId,
            input: PayrollCorrectionCalculationInput.SALARIO_BASE,
            targetAmount: 2_500_000,
          },
        ],
      }),
    );
    createdCorrectionId = created.id;
    expect(created.status).toBe('BORRADOR');

    const submitted = await withTenantContext(() =>
      service.enviarCorrectionARevision(tenantId, actorId, created.id),
    );
    expect(submitted.status).toBe('EN_REVISION');

    const approved = await withTenantContext(() =>
      service.aprobarCorrection(tenantId, actorId, created.id),
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
      withTenantContext(() =>
        service.findPeriodCorrections(randomUUID(), periodId),
      ),
    ).rejects.toThrow('Período no encontrado');
  }, 30000);

  it('forces tenant isolation and blocks invalid lifecycle mutations', async () => {
    if (!createdCorrectionId) {
      throw new Error('La corrección de integración no se creó correctamente.');
    }

    const tableState = await prisma.$queryRawUnsafe<
      { rowSecurity: boolean; forceRowSecurity: boolean }[]
    >(
      'SELECT relrowsecurity AS "rowSecurity", ' +
        'relforcerowsecurity AS "forceRowSecurity" ' +
        "FROM pg_class WHERE oid = 'public.payroll_corrections'::regclass",
    );
    const roleAttributes = await prisma.$queryRaw<
      { superuser: boolean; bypassRls: boolean; canLogin: boolean }[]
    >`
      SELECT rolsuper AS "superuser", rolbypassrls AS "bypassRls",
        rolcanlogin AS "canLogin" FROM pg_roles WHERE rolname = ${role}
    `;
    const policies = await prisma.$queryRaw<
      { command: string; policy: string }[]
    >`
      SELECT cmd AS "command", policyname AS "policy"
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'payroll_corrections'
      ORDER BY cmd, policyname
    `;
    expect(tableState).toEqual([{ rowSecurity: true, forceRowSecurity: true }]);
    expect(roleAttributes).toEqual([
      { superuser: false, bypassRls: false, canLogin: false },
    ]);
    expect(policies).toEqual([
      { command: 'INSERT', policy: 'payroll_corrections_tenant_insert' },
      { command: 'SELECT', policy: 'payroll_corrections_tenant_select' },
      { command: 'UPDATE', policy: 'payroll_corrections_tenant_update' },
    ]);

    const withoutTenant = await runAsRlsRole((tx) =>
      tx.payrollCorrection.findMany({ where: { id: otherCorrectionId } }),
    );
    const crossTenantRead = await withTenantContext(() =>
      tenantPrisma.execute((tx) =>
        tx.payrollCorrection.findMany({ where: { id: otherCorrectionId } }),
      ),
    );
    const ownRead = await withTenantContext(() =>
      tenantPrisma.execute((tx) =>
        tx.payrollCorrection.findMany({ where: { id: createdCorrectionId } }),
      ),
    );
    expect(withoutTenant).toEqual([]);
    expect(crossTenantRead).toEqual([]);
    expect(ownRead).toHaveLength(1);
    const otherTenantRead = await withTenant(otherTenantId, () =>
      tenantPrisma.execute((tx) =>
        tx.payrollCorrection.findMany({ where: { id: otherCorrectionId } }),
      ),
    );
    expect(otherTenantRead).toHaveLength(1);

    const crossTenantUpdate = await withTenantContext(() =>
      tenantPrisma.execute((tx) =>
        tx.payrollCorrection.updateMany({
          where: { id: otherCorrectionId },
          data: { descripcion: 'Intento de cambio cruzado' },
        }),
      ),
    );
    const terminalUpdate = await withTenantContext(() =>
      tenantPrisma.execute((tx) =>
        tx.payrollCorrection.updateMany({
          where: { id: createdCorrectionId },
          data: { descripcion: 'Intento de mutar acto aprobado' },
        }),
      ),
    );
    const deleteOwnCorrection = await withTenantContext(() =>
      tenantPrisma.execute((tx) =>
        tx.payrollCorrection.deleteMany({
          where: { id: createdCorrectionId },
        }),
      ),
    );
    expect(crossTenantUpdate.count).toBe(0);
    expect(terminalUpdate.count).toBe(0);
    expect(deleteOwnCorrection.count).toBe(0);

    const ownDraft = await withTenantContext(() =>
      tenantPrisma.execute((tx) =>
        tx.payrollCorrection.create({
          data: {
            id: draftCorrectionId,
            tenantId,
            payrollPeriodId: periodId,
            descripcion: 'Corrección en borrador',
          },
        }),
      ),
    );
    expect(ownDraft.status).toBe(PayrollCorrectionStatus.BORRADOR);
    const validReviewTransition = await withTenantContext(() =>
      tenantPrisma.execute((tx) =>
        tx.payrollCorrection.updateMany({
          where: { id: draftCorrectionId },
          data: { status: PayrollCorrectionStatus.EN_REVISION },
        }),
      ),
    );
    expect(validReviewTransition.count).toBe(1);

    await expect(
      withTenantContext(() =>
        tenantPrisma.execute((tx) =>
          tx.payrollCorrection.create({
            data: {
              tenantId,
              payrollPeriodId: otherPeriodId,
              descripcion: 'Vínculo a período de otro tenant',
            },
          }),
        ),
      ),
    ).rejects.toThrow();
    await expect(
      withTenantContext(() =>
        tenantPrisma.execute((tx) =>
          tx.payrollCorrection.create({
            data: {
              tenantId,
              payrollPeriodId: periodId,
              status: PayrollCorrectionStatus.APROBADA,
              descripcion: 'No se puede insertar aprobada directamente',
            },
          }),
        ),
      ),
    ).rejects.toThrow();
    await expect(
      withTenantContext(() =>
        tenantPrisma.execute((tx) =>
          tx.payrollCorrection.create({
            data: {
              tenantId,
              payrollPeriodId: draftPeriodId,
              descripcion: 'Período aún no aprobado',
            },
          }),
        ),
      ),
    ).rejects.toThrow();
    await expect(
      runAsRlsRole((tx) =>
        tx.payrollCorrection.create({
          data: {
            tenantId,
            payrollPeriodId: periodId,
            descripcion: 'Inserción sin contexto tenant',
          },
        }),
      ),
    ).rejects.toThrow();
  }, 30000);

  function withTenant<T>(id: string, work: () => Promise<T>) {
    return tenantContext.run(
      {
        tenantId: id,
        userId: actorId,
        rol: 'ADMIN',
        email: 'payroll-corrections@test.local',
      },
      work,
    );
  }

  function runAsRlsRole<T>(work: (tx: Prisma.TransactionClient) => Promise<T>) {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL ROLE "' + role + '"');
      return work(tx);
    });
  }

  async function dropTestRole() {
    await prisma.$executeRawUnsafe(
      `DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${role}') THEN
          REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM "${role}";
          REVOKE USAGE ON TYPE "PayrollCorrectionStatus", "PayrollPeriodStatus", "EstadoComprobante" FROM "${role}";
          REVOKE ALL PRIVILEGES ON SCHEMA public FROM "${role}";
          DROP ROLE "${role}";
        END IF;
      END $$`,
    );
  }
});
