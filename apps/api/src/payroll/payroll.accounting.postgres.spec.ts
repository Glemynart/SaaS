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
  const payrollPeriodId = randomUUID();
  const payrollRunId = randomUUID();
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
            requiereTercero: false,
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
        await tx.payrollConcept.deleteMany({ where: { payrollRunId } });
        await tx.payrollRun.deleteMany({ where: { tenantId } });
        await tx.payrollPeriod.deleteMany({ where: { tenantId } });
        await tx.cuentaSistemaMap.deleteMany({ where: { tenantId } });
        await tx.cuentaContable.deleteMany({ where: { tenantId } });
        await tx.periodoContable.deleteMany({ where: { tenantId } });
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
        const [period, vouchers, snapshot, auditLogs] = await Promise.all([
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
          tx.payrollSnapshot.findFirst({ where: { id: snapshotId, tenantId } }),
          tx.auditLog.findMany({
            where: { tenantId, action: 'PAYROLL_ACCRUED' },
          }),
        ]);
        return { period, vouchers, snapshot, auditLogs };
      }),
    );

    expect(persisted.period?.status).toBe(PayrollPeriodStatus.CAUSADA);
    expect(persisted.vouchers).toHaveLength(1);
    const voucher = persisted.vouchers[0];
    expect(voucher.id).toBe(first.comprobanteId);
    expect(voucher.estado).toBe('CONTABILIZADO');
    expect(Number(voucher.totalDebito)).toBe(1_000_000);
    expect(Number(voucher.totalCredito)).toBe(1_000_000);
    expect(
      voucher.movimientos.map((movement) => ({
        cuentaCodigo: movement.cuenta.codigo,
        debito: Number(movement.debito),
        credito: Number(movement.credito),
      })),
    ).toEqual(
      expect.arrayContaining([
        { cuentaCodigo: 'T5', debito: 1_000_000, credito: 0 },
        { cuentaCodigo: 'T1', debito: 0, credito: 920_000 },
        { cuentaCodigo: 'T2', debito: 0, credito: 40_000 },
        { cuentaCodigo: 'T3', debito: 0, credito: 40_000 },
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
});
