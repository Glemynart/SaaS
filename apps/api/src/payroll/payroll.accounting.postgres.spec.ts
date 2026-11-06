import {
  ClaseContable,
  EstadoPeriodo,
  NaturalezaContable,
  PayrollPeriodStatus,
  Prisma,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { LedgerService } from '../accounting/ledger/ledger.service';
import { TenantContextBoundary } from '../tenant-context/tenant-context.boundary';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  PayrollAccountingPreflightService,
  PAYROLL_ACCOUNTING_REQUIRED_ROLES,
} from './accounting-preflight/payroll-accounting-preflight.service';
import { PayrollService } from './payroll.service';

describe('Payroll accounting PostgreSQL integration', () => {
  const prisma = new PrismaService();
  const suffix = randomUUID();
  const tenantId = randomUUID();
  const actorId = randomUUID();
  const employeeId = randomUUID();
  const thirdPartyId = randomUUID();
  const payrollPeriodId = randomUUID();
  const payrollRunId = randomUUID();
  const snapshotApprovalPeriodId = randomUUID();
  const snapshotApprovalRunId = randomUUID();
  const snapshotApprovalContractId = randomUUID();
  const snapshotApprovalLegalParamId = randomUUID();
  const snapshotId = randomUUID();
  const accountingPeriodId = randomUUID();
  const contextService = new TenantContextService();
  const tenantPrisma = new TenantPrismaService(
    prisma,
    new TenantContextBoundary(contextService),
  );
  const audit = new AuditService(prisma);
  const service = new PayrollService(
    prisma,
    tenantPrisma,
    audit,
    new LedgerService(tenantPrisma, audit),
    new PayrollAccountingPreflightService(prisma),
  );
  const context = {
    tenantId,
    userId: actorId,
    rol: 'ADMIN',
    email: `payroll-accounting-${suffix}@example.test`,
  } as const;
  const fechaFin = new Date('2026-03-31T00:00:00.000Z');
  const snapshotPayload = {
    employee: { salarioBaseUsado: 1_000_000 },
    concepts: [
      { codigo: 'SALARIO_BASE', valor: 1_000_000 },
      { codigo: 'SALUD_EMP', valor: 40_000 },
      { codigo: 'PENSION_EMP', valor: 40_000 },
    ],
  } satisfies Prisma.InputJsonValue;
  const pilaSourcePayload = {
    schemaVersion: 1,
    capturedAt: '2026-03-31T00:00:00.000Z',
    employee: { cedula: '1000000001', tipoSalarioPila: 'F' },
    affiliations: [{ affiliationId: 'affiliation-1', epsCodigo: 'EPS001' }],
  } satisfies Prisma.InputJsonValue;
  const pilaSnapshotPayload = {
    ...pilaSourcePayload,
    payroll: {
      payrollRunId,
      fechaPrevistaPagoPila: '2026-04-05',
      salarioBasico: 1_000_000,
      tipoSalario: 'F',
    },
  } satisfies Prisma.InputJsonValue;
  let voucherTypeCreated = false;

  beforeAll(async () => {
    await prisma.$connect();
    let voucherType = await prisma.tipoComprobante.findUnique({
      where: { codigo: 'NOM' },
    });
    if (!voucherType) {
      voucherType = await prisma.tipoComprobante.create({
        data: { codigo: 'NOM', nombre: 'Nómina', prefijo: 'NOM' },
      });
      voucherTypeCreated = true;
    }

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
      await tx.tenant.create({
        data: {
          id: tenantId,
          nombre: `Payroll accounting integration ${suffix.slice(0, 8)}`,
          nit: `8${suffix.replaceAll('-', '').slice(0, 9)}`,
          digitoVerif: '1',
          razonSocial: 'Payroll Accounting Integration S.A.S.',
        },
      });
      await tx.user.create({
        data: {
          id: actorId,
          tenantId,
          email: context.email,
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
          cedula: `payroll-accounting-${suffix}`,
          primerNombre: 'Ana',
          primerApellido: 'Integración',
          cargo: 'Docente',
          salario: 1_000_000,
          fechaIngreso: new Date('2025-01-01T00:00:00.000Z'),
        },
      });
      await tx.tercero.create({
        data: {
          id: thirdPartyId,
          tenantId,
          tipoDocumento: 'CC',
          numeroDocumento: `payroll-accounting-${suffix}`,
          tipoPersona: 'NATURAL',
          primerNombre: 'Ana',
          primerApellido: 'Integración',
          esEmpleado: true,
        },
      });
      await tx.payrollPeriod.create({
        data: {
          id: payrollPeriodId,
          tenantId,
          nombre: 'Nómina integración marzo 2026',
          fechaInicio: new Date('2026-03-01T00:00:00.000Z'),
          fechaFin,
          status: PayrollPeriodStatus.APROBADA,
          aprobadoPorId: actorId,
          aprobadoEn: fechaFin,
        },
      });
      await tx.payrollRun.create({
        data: {
          id: payrollRunId,
          tenantId,
          payrollPeriodId,
          employeeId,
          totalDevengos: new Prisma.Decimal(1_000_000),
          totalDeducciones: new Prisma.Decimal(80_000),
          netoPagar: new Prisma.Decimal(920_000),
          totalAportesPatronales: new Prisma.Decimal(0),
          totalProvisiones: new Prisma.Decimal(0),
          salarioBaseSnapshot: new Prisma.Decimal(1_000_000),
          pilaSource: pilaSourcePayload,
          concepts: {
            create: [
              {
                codigo: 'SALARIO_BASE',
                tipo: 'EARNING',
                nombre: 'Salario base',
                valor: new Prisma.Decimal(1_000_000),
              },
              {
                codigo: 'SALUD_EMP',
                tipo: 'DEDUCTION',
                nombre: 'Salud empleado',
                valor: new Prisma.Decimal(40_000),
              },
              {
                codigo: 'PENSION_EMP',
                tipo: 'DEDUCTION',
                nombre: 'Pensión empleado',
                valor: new Prisma.Decimal(40_000),
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
          payrollPeriodId,
          employeeId,
          estadoPeriodo: PayrollPeriodStatus.APROBADA,
          origen: 'INTEGRATION_TEST',
          payloadVersion: 1,
          payload: snapshotPayload,
          pilaPayloadVersion: 1,
          pilaPayload: pilaSnapshotPayload,
        },
      });
      await tx.parametroLegalNomina.create({
        data: {
          id: snapshotApprovalLegalParamId,
          tenantId,
          vigenciaDesde: new Date('2026-03-01T00:00:00.000Z'),
          anio: 2026,
          smmlv: new Prisma.Decimal(1_423_500),
          auxilioTransporte: new Prisma.Decimal(202_897),
          uvt: new Prisma.Decimal(49_799),
          topeIbcMinSmmlv: 1,
          topeIbcMaxSmmlv: 25,
          umbralAuxilioSmmlv: new Prisma.Decimal(2),
          umbralExoneracionSmmlv: 10,
          pctSaludEmpleado: new Prisma.Decimal(0.04),
          pctPensionEmpleado: new Prisma.Decimal(0.04),
          pctSaludEmpleador: new Prisma.Decimal(0.085),
          pctPensionEmpleador: new Prisma.Decimal(0.12),
          pctCaja: new Prisma.Decimal(0.04),
          pctIcbf: new Prisma.Decimal(0.03),
          pctSena: new Prisma.Decimal(0.02),
          arlClaseI: new Prisma.Decimal(0.00522),
          arlClaseII: new Prisma.Decimal(0.01044),
          arlClaseIII: new Prisma.Decimal(0.02436),
          arlClaseIV: new Prisma.Decimal(0.0435),
          arlClaseV: new Prisma.Decimal(0.0696),
          factorProvPrima: new Prisma.Decimal(0.0833),
          factorProvCesantias: new Prisma.Decimal(0.0833),
          factorProvIntCesantias: new Prisma.Decimal(0.01),
          factorProvVacaciones: new Prisma.Decimal(0.0417),
          fspTramos: [],
          fuente: 'Fixture de integración',
        },
      });
      await tx.contrato.create({
        data: {
          id: snapshotApprovalContractId,
          tenantId,
          empleadoId: employeeId,
          tipo: 'TERMINO_FIJO',
          estado: 'VIGENTE',
          fechaInicio: new Date('2025-01-01T00:00:00.000Z'),
          cargo: 'Docente',
          salario: new Prisma.Decimal(1_000_000),
          claseRiesgoArl: 1,
        },
      });
      const approvalPeriodStart = new Date('2026-03-01T00:00:00.000Z');
      const approvalPeriodEnd = new Date('2026-03-31T00:00:00.000Z');
      const approvalPilaSource = {
        schemaVersion: 1,
        capturedAt: '2026-03-31T00:00:00.000Z',
        period: {
          payrollPeriodId: snapshotApprovalPeriodId,
          fechaInicio: '2026-03-01',
          fechaFin: '2026-03-31',
        },
        employee: {
          cedula: '1000000001',
          primerNombre: 'Ana',
          tipoSalarioPila: 'F',
        },
        affiliations: [
          {
            affiliationId: 'affiliation-approval',
            epsCodigo: 'EPS001',
            vigenteDesde: '2026-01-01',
            vigenteHasta: null,
          },
        ],
        pilaEvents: [],
      } satisfies Prisma.InputJsonValue;
      await tx.payrollPeriod.create({
        data: {
          id: snapshotApprovalPeriodId,
          tenantId,
          nombre: 'Nómina aprobación PILA marzo 2026',
          fechaInicio: approvalPeriodStart,
          fechaFin: approvalPeriodEnd,
          fechaPrevistaPagoPila: new Date('2026-04-05T00:00:00.000Z'),
          status: PayrollPeriodStatus.EN_REVISION,
        },
      });
      await tx.payrollRun.create({
        data: {
          id: snapshotApprovalRunId,
          tenantId,
          payrollPeriodId: snapshotApprovalPeriodId,
          employeeId,
          totalDevengos: new Prisma.Decimal(1_000_000),
          totalDeducciones: new Prisma.Decimal(80_000),
          netoPagar: new Prisma.Decimal(920_000),
          salarioBaseSnapshot: new Prisma.Decimal(1_000_000),
          ibc: new Prisma.Decimal(1_000_000),
          parametroLegalId: snapshotApprovalLegalParamId,
          calculationTrace: {
            traceVersion: 1,
            period: {
              nombre: 'Nómina aprobación PILA marzo 2026',
              fechaInicio: approvalPeriodStart.toISOString(),
              fechaFin: approvalPeriodEnd.toISOString(),
            },
            employee: { salarioIntegralUsado: false },
            contract: {
              contratoId: snapshotApprovalContractId,
              tipo: 'TERMINO_FIJO',
              estado: 'VIGENTE',
              fechaInicio: '2025-01-01T00:00:00.000Z',
              fechaFin: null,
              salarioContrato: 1_000_000,
              sedeId: null,
              claseRiesgoArlUsada: 1,
            },
            costCenter: null,
            companyPolicy: { aportesExonerados: false },
            legalParameters: { anio: 2026 },
            novelties: [],
            calculationEvidence: { fixture: true },
          },
          pilaSource: approvalPilaSource,
          concepts: {
            create: [
              {
                codigo: 'SALARIO_BASE',
                tipo: 'EARNING',
                nombre: 'Salario base',
                valor: new Prisma.Decimal(1_000_000),
              },
              {
                codigo: 'PENSION_EMP',
                tipo: 'DEDUCTION',
                nombre: 'Pensión empleado',
                base: new Prisma.Decimal(1_000_000),
                factor: new Prisma.Decimal(0.04),
                valor: new Prisma.Decimal(40_000),
              },
              {
                codigo: 'SALUD_EMP',
                tipo: 'DEDUCTION',
                nombre: 'Salud empleado',
                base: new Prisma.Decimal(1_000_000),
                factor: new Prisma.Decimal(0.04),
                valor: new Prisma.Decimal(40_000),
              },
              {
                codigo: 'ARL',
                tipo: 'EMPLOYER_CONTRIBUTION',
                nombre: 'ARL',
                base: new Prisma.Decimal(1_000_000),
                factor: new Prisma.Decimal(0.00522),
                valor: new Prisma.Decimal(5_220),
              },
              {
                codigo: 'CAJA',
                tipo: 'EMPLOYER_CONTRIBUTION',
                nombre: 'Caja de compensación',
                base: new Prisma.Decimal(1_000_000),
                factor: new Prisma.Decimal(0.04),
                valor: new Prisma.Decimal(40_000),
              },
            ],
          },
        },
      });
      await tx.periodoContable.create({
        data: {
          id: accountingPeriodId,
          tenantId,
          anio: 2026,
          mes: 3,
          fechaInicio: new Date('2026-03-01T00:00:00.000Z'),
          fechaFin,
          estado: EstadoPeriodo.ABIERTO,
        },
      });

      const maps = [];
      for (const [index, role] of PAYROLL_ACCOUNTING_REQUIRED_ROLES.entries()) {
        const isExpense = role.startsWith('GASTO_');
        const account = await tx.cuentaContable.create({
          data: {
            tenantId,
            codigo: `T${index + 1}`,
            nombre: role,
            claseContable: isExpense
              ? ClaseContable.GASTOS
              : ClaseContable.PASIVO,
            naturaleza: isExpense
              ? NaturalezaContable.DEBITO
              : NaturalezaContable.CREDITO,
            nivel: 5,
            imputable: true,
            esCuentaSistema: false,
            requiereTercero: role === 'SALARIOS_POR_PAGAR',
            requiereCentroCosto: false,
            requiereBase: false,
            activa: true,
          },
        });
        maps.push({ tenantId, rol: role, cuentaId: account.id });
      }
      await tx.cuentaSistemaMap.createMany({ data: maps });
    });
  }, 30000);

  afterAll(async () => {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
        await tx.movimientoContable.deleteMany({ where: { tenantId } });
        await tx.comprobanteContable.deleteMany({ where: { tenantId } });
        await tx.secuenciaComprobante.deleteMany({ where: { tenantId } });
        await tx.payrollSnapshot.deleteMany({ where: { tenantId } });
        await tx.payrollConcept.deleteMany({
          where: {
            payrollRunId: { in: [payrollRunId, snapshotApprovalRunId] },
          },
        });
        await tx.payrollRun.deleteMany({ where: { tenantId } });
        await tx.payrollPeriod.deleteMany({ where: { tenantId } });
        await tx.contrato.deleteMany({ where: { tenantId } });
        await tx.parametroLegalNomina.deleteMany({ where: { tenantId } });
        await tx.cuentaSistemaMap.deleteMany({ where: { tenantId } });
        await tx.cuentaContable.deleteMany({ where: { tenantId } });
        await tx.periodoContable.deleteMany({ where: { tenantId } });
        await tx.tercero.deleteMany({ where: { tenantId } });
        await tx.empleado.deleteMany({ where: { tenantId } });
        await tx.auditLog.deleteMany({ where: { tenantId } });
        await tx.user.deleteMany({ where: { tenantId } });
        await tx.tenant.deleteMany({ where: { id: tenantId } });
      });
      if (voucherTypeCreated) {
        await prisma.tipoComprobante.deleteMany({ where: { codigo: 'NOM' } });
      }
    } finally {
      await prisma.$disconnect();
    }
  }, 30000);

  it('persists one balanced voucher, preserves the snapshot and retries by origin', async () => {
    const first = await contextService.run(context, () =>
      service.contabilizar(tenantId, actorId, payrollPeriodId),
    );
    expect(first.status).toBe('CAUSADA');
    if (first.status === 'PREFLIGHT_ERROR') throw new Error('Preflight failed');

    const second = await contextService.run(context, () =>
      service.contabilizar(tenantId, actorId, payrollPeriodId),
    );
    expect(second).toEqual({
      status: 'YA_CAUSADA',
      payrollPeriodId,
      comprobanteId: first.comprobanteId,
    });

    const persisted = await contextService.run(context, () =>
      tenantPrisma.execute(async (tx) => {
        const [period, vouchers, run, snapshot, auditLogs] = await Promise.all([
          tx.payrollPeriod.findFirst({
            where: { id: payrollPeriodId, tenantId },
          }),
          tx.comprobanteContable.findMany({
            where: {
              tenantId,
              origenTipo: 'PAYROLL',
              origenId: payrollPeriodId,
              origenEvento: 'CAUSACION',
            },
            include: {
              movimientos: {
                include: { cuenta: true },
                orderBy: { linea: 'asc' },
              },
            },
          }),
          tx.payrollRun.findFirst({
            where: { id: payrollRunId, tenantId },
            select: { pilaSource: true },
          }),
          tx.payrollSnapshot.findFirst({ where: { id: snapshotId, tenantId } }),
          tx.auditLog.findMany({
            where: { tenantId, action: 'PAYROLL_ACCRUED' },
          }),
        ]);
        return { period, vouchers, run, snapshot, auditLogs };
      }),
    );

    expect(persisted.period?.status).toBe(PayrollPeriodStatus.CAUSADA);
    expect(persisted.run?.pilaSource).toEqual(pilaSourcePayload);
    expect(persisted.snapshot?.pilaPayloadVersion).toBe(1);
    expect(persisted.snapshot?.pilaPayload).toEqual(pilaSnapshotPayload);
    expect(persisted.vouchers).toHaveLength(1);
    const voucher = persisted.vouchers[0];
    expect(voucher.id).toBe(first.comprobanteId);
    expect(voucher.estado).toBe('CONTABILIZADO');
    expect(Number(voucher.totalDebito)).toBe(1_000_000);
    expect(Number(voucher.totalCredito)).toBe(1_000_000);
    expect(
      voucher.movimientos.map((movement) => ({
        cuentaCodigo: movement.cuenta.codigo,
        terceroId: movement.terceroId,
        debito: Number(movement.debito),
        credito: Number(movement.credito),
      })),
    ).toEqual(
      expect.arrayContaining([
        {
          cuentaCodigo: 'T10',
          terceroId: null,
          debito: 1_000_000,
          credito: 0,
        },
        {
          cuentaCodigo: 'T1',
          terceroId: thirdPartyId,
          debito: 0,
          credito: 920_000,
        },
        { cuentaCodigo: 'T2', terceroId: null, debito: 0, credito: 40_000 },
        { cuentaCodigo: 'T5', terceroId: null, debito: 0, credito: 40_000 },
      ]),
    );
    expect(persisted.snapshot?.payload).toEqual(snapshotPayload);
    expect(persisted.snapshot?.estadoPeriodo).toBe(
      PayrollPeriodStatus.APROBADA,
    );
    expect(persisted.auditLogs).toHaveLength(1);

    await expect(
      contextService.run(context, () =>
        service.contabilizar(randomUUID(), actorId, payrollPeriodId),
      ),
    ).rejects.toThrow('Período de nómina no encontrado');
  }, 30000);

  it('persists the PILA source payload through the payroll approval service', async () => {
    const approved = await contextService.run(context, () =>
      service.aprobar(tenantId, actorId, snapshotApprovalPeriodId),
    );
    expect(approved.status).toBe(PayrollPeriodStatus.APROBADA);

    const persisted = await contextService.run(context, () =>
      tenantPrisma.execute(async (tx) => {
        const [period, snapshot] = await Promise.all([
          tx.payrollPeriod.findFirst({
            where: { id: snapshotApprovalPeriodId, tenantId },
          }),
          tx.payrollSnapshot.findFirst({
            where: { tenantId, payrollRunId: snapshotApprovalRunId },
          }),
        ]);
        return { period, snapshot };
      }),
    );

    expect(persisted.period?.status).toBe(PayrollPeriodStatus.APROBADA);
    expect(persisted.snapshot?.pilaPayloadVersion).toBe(10);
    expect(persisted.snapshot?.pilaPayload).toMatchObject({
      schemaVersion: 10,
      capturedAt: '2026-03-31T00:00:00.000Z',
      employee: { cedula: '1000000001', primerNombre: 'Ana' },
      affiliations: [
        {
          affiliationId: 'affiliation-approval',
          epsCodigo: 'EPS001',
          vigenteDesde: '2026-01-01',
          vigenteHasta: null,
        },
      ],
      payroll: {
        payrollRunId: snapshotApprovalRunId,
        fechaPrevistaPagoPila: '2026-04-05',
        salarioBasico: 1_000_000,
        tipoSalario: 'F',
        ibc: 1_000_000,
        novelties: [],
        ibcPorSubsistema: {
          pension: {
            valor: 1_000_000,
            sourceCount: 1,
            conceptIds: [expect.any(String)],
          },
          salud: {
            valor: 1_000_000,
            sourceCount: 1,
            conceptIds: [expect.any(String)],
          },
          riesgos: {
            valor: 1_000_000,
            sourceCount: 1,
            conceptIds: [expect.any(String)],
          },
          cajaCompensacion: {
            valor: 1_000_000,
            sourceCount: 1,
            conceptIds: [expect.any(String)],
          },
        },
      },
    });
  }, 30000);
});
