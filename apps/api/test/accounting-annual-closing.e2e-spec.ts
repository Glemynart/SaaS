import { Prisma, PrismaClient } from '@prisma/client';
import { AccountingProvisioningService } from '../src/accounting/provisioning/accounting-provisioning.service';
import { LedgerService } from '../src/accounting/ledger/ledger.service';
import { ManualJournalService } from '../src/accounting/manual-journals/manual-journal.service';
import { PeriodClosureService } from '../src/accounting/period-closures/period-closure.service';
import { ReportingService } from '../src/accounting/reporting/reporting.service';
import { ClosureService } from '../src/accounting/closure/closure.service';
import { AuditService } from '../src/audit/audit.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { TenantContextBoundary } from '../src/tenant-context/tenant-context.boundary';
import { TenantContextService } from '../src/tenant-context/tenant-context.service';
import { TenantPrismaService } from '../src/tenant-prisma/tenant-prisma.service';

describe('Accounting baseline — C0 a C3 (e2e)', () => {
  const prisma = new PrismaClient();
  const tenantContext = new TenantContextService();
  const tenantPrisma = new TenantPrismaService(
    prisma as unknown as PrismaService,
    new TenantContextBoundary(tenantContext),
  );
  const uid = () => Math.random().toString(36).slice(2, 10);
  const anio = 2026;
  const userId = 'accounting-baseline-user';

  let tenantId: string;
  let periodoDiciembreId: string;
  let tipoContabilidadId: string;
  let cuentaCajaId: string;
  let cuentaIngresosId: string;
  let cuentaGastosId: string;
  let cuentaResultadoId: string;
  let terceroId: string;
  let centroCostoId: string;

  const audit = {
    log: jest.fn().mockResolvedValue(undefined),
  } as unknown as AuditService;

  const provisioning = new AccountingProvisioningService(
    prisma as unknown as PrismaService,
    audit,
  );
  const ledger = new LedgerService(tenantPrisma, audit);
  const manualJournals = new ManualJournalService(ledger, tenantPrisma, audit);
  const reporting = new ReportingService(prisma as unknown as PrismaService);
  const closure = new ClosureService(tenantPrisma, reporting, audit, ledger);
  const periodClosures = new PeriodClosureService(closure);

  const runAsTenant = <T>(work: () => Promise<T>): Promise<T> =>
    tenantContext.run(
      {
        tenantId,
        userId,
        rol: 'ADMIN',
        email: 'accounting-baseline@test.local',
      },
      work,
    );

  beforeAll(async () => {
    const tenant = await prisma.tenant.create({
      data: {
        nombre: `Accounting baseline ${uid()}`,
        nit: `90${Date.now()}${uid()}`,
        digitoVerif: '0',
        razonSocial: 'Accounting Baseline SAS',
        email: `accounting-baseline-${uid()}@test.local`,
      },
    });
    tenantId = tenant.id;

    for (let mes = 1; mes <= 12; mes += 1) {
      const periodo = await prisma.periodoContable.create({
        data: {
          tenantId,
          anio,
          mes,
          fechaInicio: new Date(Date.UTC(anio, mes - 1, 1)),
          fechaFin: new Date(Date.UTC(anio, mes, 0)),
          estado: mes === 12 ? 'ABIERTO' : 'CERRADO',
        },
        select: { id: true },
      });

      if (mes === 12) periodoDiciembreId = periodo.id;
    }

    const provisionado = await provisioning.clonarPlanDeCuentas(
      tenantId,
      userId,
    );
    expect(provisionado.status).toBe('provisioned');

    const tipo = await prisma.tipoComprobante.findUniqueOrThrow({
      where: { codigo: 'CC' },
      select: { id: true },
    });
    tipoContabilidadId = tipo.id;

    const cuentas = await prisma.cuentaContable.findMany({
      where: {
        tenantId,
        codigo: { in: ['110505', '360505', '413505', '510506'] },
      },
      select: { id: true, codigo: true },
    });
    const cuentaPorCodigo = new Map(
      cuentas.map((cuenta) => [cuenta.codigo, cuenta.id]),
    );

    cuentaCajaId = cuentaPorCodigo.get('110505')!;
    cuentaResultadoId = cuentaPorCodigo.get('360505')!;
    cuentaIngresosId = cuentaPorCodigo.get('413505')!;
    cuentaGastosId = cuentaPorCodigo.get('510506')!;

    const tercero = await prisma.tercero.create({
      data: {
        tenantId,
        tipoDocumento: 'NIT',
        numeroDocumento: `900${Date.now()}`,
        tipoPersona: 'JURIDICA',
        razonSocial: 'Cliente baseline SAS',
        esCliente: true,
      },
      select: { id: true },
    });
    terceroId = tercero.id;

    const centroCosto = await prisma.centroCosto.create({
      data: {
        tenantId,
        codigo: 'BASELINE',
        nombre: 'Centro de costo baseline',
      },
      select: { id: true },
    });
    centroCostoId = centroCosto.id;
  });

  afterAll(async () => {
    if (tenantId) {
      await prisma.$transaction(async (tx) => {
        await tx.movimientoContable.deleteMany({ where: { tenantId } });
        await tx.comprobanteContable.deleteMany({ where: { tenantId } });
        await tx.secuenciaComprobante.deleteMany({ where: { tenantId } });
        await tx.cuentaSistemaMap.deleteMany({ where: { tenantId } });
        await tx.tercero.deleteMany({ where: { tenantId } });
        await tx.centroCosto.deleteMany({ where: { tenantId } });
        await tx.cuentaContable.deleteMany({ where: { tenantId } });
        await tx.periodoContable.deleteMany({ where: { tenantId } });
        await tx.tenant.delete({ where: { id: tenantId } });
      });
    }
    await prisma.$disconnect();
  });

  function saldoPorCodigo(
    balance: Array<{ codigo: string; saldo: Prisma.Decimal }>,
    codigo: string,
  ) {
    const item = balance.find((cuenta) => cuenta.codigo === codigo);
    expect(item).toBeDefined();
    return item!.saldo;
  }

  it('provisiona RESULTADO_EJERCICIO, conserva el libro perpetuo y cierra el ejercicio sin apertura', async () => {
    const mapaResultado = await prisma.cuentaSistemaMap.findFirst({
      where: { tenantId, rol: 'RESULTADO_EJERCICIO', activo: true },
      include: { cuenta: { select: { codigo: true } } },
    });
    expect(mapaResultado).toMatchObject({ cuentaId: cuentaResultadoId });
    expect(mapaResultado?.cuenta.codigo).toBe('360505');

    const segundoProvisioning = await provisioning.clonarPlanDeCuentas(
      tenantId,
      userId,
    );
    expect(segundoProvisioning.status).toBe('already_provisioned');

    const ingreso = await runAsTenant(() =>
      manualJournals.registrar(tenantId, userId, {
        tipoComprobanteId: tipoContabilidadId,
        periodoId: periodoDiciembreId,
        fecha: new Date(Date.UTC(anio, 11, 15)).toISOString(),
        concepto: 'Ingreso de cierre baseline',
        lineas: [
          { cuentaId: cuentaCajaId, debito: 1000, credito: 0 },
          {
            cuentaId: cuentaIngresosId,
            terceroId,
            debito: 0,
            credito: 1000,
          },
        ],
      }),
    );
    const gasto = await runAsTenant(() =>
      manualJournals.registrar(tenantId, userId, {
        tipoComprobanteId: tipoContabilidadId,
        periodoId: periodoDiciembreId,
        fecha: new Date(Date.UTC(anio, 11, 20)).toISOString(),
        concepto: 'Gasto de cierre baseline',
        lineas: [
          {
            cuentaId: cuentaGastosId,
            centroCostoId,
            debito: 400,
            credito: 0,
          },
          { cuentaId: cuentaCajaId, debito: 0, credito: 400 },
        ],
      }),
    );
    expect([ingreso.numero, gasto.numero]).toEqual([1, 2]);

    const rollback = new Error('forzar rollback del cierre anual');
    const cerrarPeriodo = closure.cerrarPeriodo.bind(closure);
    jest
      .spyOn(closure, 'cerrarPeriodo')
      .mockImplementationOnce(async (...args) => {
        await cerrarPeriodo(...args);
        throw rollback;
      });
    await expect(
      runAsTenant(() => periodClosures.cerrarAnio(tenantId, userId, anio)),
    ).rejects.toBe(rollback);
    jest.spyOn(closure, 'cerrarPeriodo').mockRestore();

    expect(
      await prisma.comprobanteContable.count({ where: { tenantId } }),
    ).toBe(2);
    await expect(
      prisma.periodoContable.findUniqueOrThrow({
        where: { id: periodoDiciembreId },
        select: { estado: true },
      }),
    ).resolves.toMatchObject({ estado: 'ABIERTO' });

    const antesDelCierre = await reporting.obtenerBalancePrueba(tenantId, {
      fechaInicio: new Date(Date.UTC(anio, 0, 1)),
      fechaFin: new Date(Date.UTC(anio, 11, 31)),
    });
    expect(saldoPorCodigo(antesDelCierre, '110505').toString()).toBe('600');
    expect(saldoPorCodigo(antesDelCierre, '413505').toString()).toBe('-1000');
    expect(saldoPorCodigo(antesDelCierre, '510506').toString()).toBe('400');

    const resultadoDimensionado = await reporting.obtenerSaldosDimensionados(
      tenantId,
      {
        fechaInicio: new Date(Date.UTC(anio, 0, 1)),
        fechaFin: new Date(Date.UTC(anio, 11, 31)),
        cuentaDesde: '4',
        cuentaHasta: '7999999999',
        excluirOrigenTipo: 'CIERRE_ANUAL',
        excluirOrigenId: String(anio),
      },
    );
    expect(resultadoDimensionado.map((item) => item.codigo)).toEqual([
      '413505',
      '510506',
    ]);

    const cierre = await runAsTenant(() =>
      periodClosures.cerrarAnio(tenantId, userId, anio),
    );
    expect(cierre).toMatchObject({
      posteado: true,
      yaEstabaPosteado: false,
      diciembreCerrado: true,
    });
    expect(cierre.comprobanteIds).toHaveLength(1);

    const comprobantes = await prisma.comprobanteContable.findMany({
      where: { tenantId },
      orderBy: { numero: 'asc' },
      select: {
        id: true,
        numero: true,
        origenTipo: true,
        origenId: true,
        origenEvento: true,
      },
    });
    expect(comprobantes.map((comprobante) => comprobante.numero)).toEqual([
      1, 2, 3,
    ]);
    expect(
      comprobantes.filter(
        (comprobante) => comprobante.origenTipo === 'APERTURA',
      ),
    ).toHaveLength(0);
    expect(comprobantes[2]).toMatchObject({
      id: cierre.comprobanteIds![0],
      origenTipo: 'CIERRE_ANUAL',
      origenId: String(anio),
      origenEvento: 'CIERRE',
    });

    const despuesDelCierre = await reporting.obtenerBalancePrueba(tenantId, {
      fechaInicio: new Date(Date.UTC(anio, 0, 1)),
      fechaFin: new Date(Date.UTC(anio, 11, 31)),
    });
    expect(saldoPorCodigo(despuesDelCierre, '110505').toString()).toBe('600');
    expect(saldoPorCodigo(despuesDelCierre, '413505').toString()).toBe('0');
    expect(saldoPorCodigo(despuesDelCierre, '510506').toString()).toBe('0');
    expect(saldoPorCodigo(despuesDelCierre, '360505').toString()).toBe('-600');

    const periodoDiciembre = await prisma.periodoContable.findUniqueOrThrow({
      where: { id: periodoDiciembreId },
      select: { estado: true },
    });
    expect(periodoDiciembre.estado).toBe('CERRADO');

    const reintento = await runAsTenant(() =>
      periodClosures.cerrarAnio(tenantId, userId, anio),
    );
    expect(reintento).toMatchObject({
      posteado: false,
      yaEstabaPosteado: true,
      diciembreCerrado: false,
      comprobanteIds: cierre.comprobanteIds,
    });
    expect(
      await prisma.comprobanteContable.count({ where: { tenantId } }),
    ).toBe(3);
  });
});
