import { Prisma } from '@prisma/client';
import { ConflictException, BadRequestException } from '@nestjs/common';
import { ClosureService } from './closure.service';
import { RegistrarComprobanteInput } from '../ledger/ledger.types';

const TENANT_ID = 't-001';
const PERIODO_ID = 'p-001';
const USER_ID = 'u-001';

const FECHA_INICIO = new Date('2026-06-01');
const FECHA_FIN = new Date('2026-06-30');

function periodo(data: Record<string, unknown> = {}) {
  return {
    id: PERIODO_ID,
    estado: 'ABIERTO' as const,
    anio: 2026,
    mes: 6,
    fechaInicio: FECHA_INICIO,
    fechaFin: FECHA_FIN,
    ...data,
  };
}

function balanceCuadrado() {
  return [
    {
      cuentaId: 'cuenta-001',
      codigo: '110505',
      nombre: 'Caja',
      totalDebito: new Prisma.Decimal(500000),
      totalCredito: new Prisma.Decimal(0),
      saldo: new Prisma.Decimal(500000),
    },
    {
      cuentaId: 'cuenta-002',
      codigo: '413505',
      nombre: 'Ingresos',
      totalDebito: new Prisma.Decimal(0),
      totalCredito: new Prisma.Decimal(500000),
      saldo: new Prisma.Decimal(-500000),
    },
  ];
}

function balanceDescuadrado() {
  return [
    {
      cuentaId: 'cuenta-001',
      codigo: '110505',
      nombre: 'Caja',
      totalDebito: new Prisma.Decimal(500000),
      totalCredito: new Prisma.Decimal(0),
      saldo: new Prisma.Decimal(500000),
    },
    {
      cuentaId: 'cuenta-002',
      codigo: '413505',
      nombre: 'Ingresos',
      totalDebito: new Prisma.Decimal(0),
      totalCredito: new Prisma.Decimal(400000),
      saldo: new Prisma.Decimal(-400000),
    },
  ];
}

function build() {
  const mocks = {
    periodoFindFirst: jest.fn(),
    comprobanteCount: jest.fn(),
    comprobanteFindFirst: jest.fn(),
    comprobanteFindMany: jest.fn(),
    obtenerBalancePrueba: jest.fn(),
    obtenerSaldosDimensionados: jest.fn(),
    periodoUpdateMany: jest.fn(),
    auditLog: jest.fn(),
    txUpdateMany: jest.fn(),
    tipoComprobanteFindFirst: jest.fn(),
    cuentaSistemaMapFindFirst: jest.fn(),
    registrarComprobante: jest.fn(),
  };

  const tx = {
    periodoContable: {
      updateMany: mocks.txUpdateMany,
    },
  };

  const client = {
    periodoContable: {
      findFirst: mocks.periodoFindFirst,
      updateMany: mocks.txUpdateMany,
    },
    comprobanteContable: {
      count: mocks.comprobanteCount,
      findFirst: mocks.comprobanteFindFirst,
      findMany: mocks.comprobanteFindMany,
    },
    tipoComprobante: {
      findFirst: mocks.tipoComprobanteFindFirst,
    },
    cuentaSistemaMap: {
      findFirst: mocks.cuentaSistemaMapFindFirst,
    },
  };

  const tenantPrisma = {
    execute: jest.fn((cb: (tx: unknown) => unknown) => cb(client)),
  };

  const reporting = {
    obtenerBalancePrueba: mocks.obtenerBalancePrueba,
    obtenerSaldosDimensionados: mocks.obtenerSaldosDimensionados,
  };

  const audit = {
    log: mocks.auditLog,
  };

  const ledger = {
    registrarComprobante: mocks.registrarComprobante,
  };

  const service = new ClosureService(
    tenantPrisma as never,
    reporting as never,
    audit as never,
    ledger as never,
  );

  return { service, mocks, audit, ledger, tenantPrisma, client };
}

describe('ClosureService', () => {
  describe('validarCierrePeriodo()', () => {
    it('devuelve procede=false y bloqueo PERIODO_NO_ENCONTRADO cuando el período no existe', async () => {
      const { service, mocks } = build();
      mocks.periodoFindFirst.mockResolvedValue(null);

      const result = await service.validarCierrePeriodo(TENANT_ID, PERIODO_ID);

      expect(result).toEqual({
        procede: false,
        bloqueos: ['PERIODO_NO_ENCONTRADO'],
      });
      expect(mocks.periodoFindFirst).toHaveBeenCalledWith({
        where: { id: PERIODO_ID, tenantId: TENANT_ID },
        select: {
          id: true,
          estado: true,
          anio: true,
          mes: true,
          fechaInicio: true,
          fechaFin: true,
        },
      });
    });

    it('devuelve procede=false y bloqueo PERIODO_YA_CERRADO cuando el período está cerrado', async () => {
      const { service, mocks } = build();
      mocks.periodoFindFirst.mockResolvedValue(periodo({ estado: 'CERRADO' }));

      const result = await service.validarCierrePeriodo(TENANT_ID, PERIODO_ID);

      expect(result).toEqual({
        procede: false,
        bloqueos: ['PERIODO_YA_CERRADO'],
      });
    });

    it('devuelve procede=false y bloqueo BORRADORES_PENDIENTES cuando hay borradores', async () => {
      const { service, mocks } = build();
      mocks.periodoFindFirst
        .mockResolvedValueOnce(periodo())
        .mockResolvedValueOnce(null);
      mocks.comprobanteCount.mockResolvedValue(3);
      mocks.obtenerBalancePrueba.mockResolvedValue(balanceCuadrado());

      const result = await service.validarCierrePeriodo(TENANT_ID, PERIODO_ID);

      expect(result).toEqual({
        procede: false,
        bloqueos: ['BORRADORES_PENDIENTES'],
      });
      expect(mocks.comprobanteCount).toHaveBeenCalledWith({
        where: {
          tenantId: TENANT_ID,
          periodoId: PERIODO_ID,
          estado: 'BORRADOR',
        },
      });
    });

    it('devuelve procede=false y bloqueo CIERRE_CRONOLOGICO cuando el mes anterior sigue abierto', async () => {
      const { service, mocks } = build();
      mocks.periodoFindFirst
        .mockResolvedValueOnce(periodo({ anio: 2026, mes: 6 }))
        .mockResolvedValueOnce({ id: 'p-005' });
      mocks.comprobanteCount.mockResolvedValue(0);
      mocks.obtenerBalancePrueba.mockResolvedValue(balanceCuadrado());

      const result = await service.validarCierrePeriodo(TENANT_ID, PERIODO_ID);

      expect(result).toEqual({
        procede: false,
        bloqueos: ['CIERRE_CRONOLOGICO'],
      });
      expect(mocks.periodoFindFirst).toHaveBeenCalledTimes(2);
      expect(mocks.periodoFindFirst).toHaveBeenNthCalledWith(2, {
        where: {
          tenantId: TENANT_ID,
          anio: 2026,
          mes: 5,
          estado: 'ABIERTO',
        },
        select: { id: true },
      });
    });

    it('calcula correctamente el mes anterior al cruzar el año', async () => {
      const { service, mocks } = build();
      mocks.periodoFindFirst
        .mockResolvedValueOnce(periodo({ anio: 2026, mes: 1 }))
        .mockResolvedValueOnce(null);
      mocks.comprobanteCount.mockResolvedValue(0);
      mocks.obtenerBalancePrueba.mockResolvedValue(balanceCuadrado());

      const result = await service.validarCierrePeriodo(TENANT_ID, PERIODO_ID);

      expect(result.procede).toBe(true);
      expect(mocks.periodoFindFirst).toHaveBeenNthCalledWith(2, {
        where: {
          tenantId: TENANT_ID,
          anio: 2025,
          mes: 12,
          estado: 'ABIERTO',
        },
        select: { id: true },
      });
    });

    it('devuelve procede=false y bloqueo DESCUADRE cuando débitos ≠ créditos', async () => {
      const { service, mocks } = build();
      mocks.periodoFindFirst
        .mockResolvedValueOnce(periodo())
        .mockResolvedValueOnce(null);
      mocks.comprobanteCount.mockResolvedValue(0);
      mocks.obtenerBalancePrueba.mockResolvedValue(balanceDescuadrado());

      const result = await service.validarCierrePeriodo(TENANT_ID, PERIODO_ID);

      expect(result).toEqual({
        procede: false,
        bloqueos: ['DESCUADRE'],
      });
    });

    it('devuelve procede=true sin bloqueos cuando todas las validaciones pasan', async () => {
      const { service, mocks } = build();
      mocks.periodoFindFirst
        .mockResolvedValueOnce(periodo())
        .mockResolvedValueOnce(null);
      mocks.comprobanteCount.mockResolvedValue(0);
      mocks.obtenerBalancePrueba.mockResolvedValue(balanceCuadrado());

      const result = await service.validarCierrePeriodo(TENANT_ID, PERIODO_ID);

      expect(result).toEqual({
        procede: true,
        bloqueos: [],
      });
    });

    it('acumula múltiples bloqueos cuando varias validaciones fallan', async () => {
      const { service, mocks } = build();
      mocks.periodoFindFirst
        .mockReset()
        .mockResolvedValueOnce(periodo())
        .mockResolvedValueOnce({ id: 'p-005' });
      mocks.comprobanteCount.mockResolvedValue(2);
      mocks.obtenerBalancePrueba.mockResolvedValue(balanceDescuadrado());

      const result = await service.validarCierrePeriodo(TENANT_ID, PERIODO_ID);

      expect(result.procede).toBe(false);
      expect(result.bloqueos).toContain('BORRADORES_PENDIENTES');
      expect(result.bloqueos).toContain('CIERRE_CRONOLOGICO');
      expect(result.bloqueos).toContain('DESCUADRE');
      expect(result.bloqueos).toHaveLength(3);
    });

    it('consume C2 para la validación de cuadre — no calcula saldos', async () => {
      const { service, mocks } = build();
      mocks.periodoFindFirst
        .mockResolvedValueOnce(periodo())
        .mockResolvedValueOnce(null);
      mocks.comprobanteCount.mockResolvedValue(0);
      mocks.obtenerBalancePrueba.mockResolvedValue(balanceCuadrado());

      await service.validarCierrePeriodo(TENANT_ID, PERIODO_ID);

      expect(mocks.obtenerBalancePrueba).toHaveBeenCalledWith(TENANT_ID, {
        fechaInicio: FECHA_INICIO,
        fechaFin: FECHA_FIN,
      });
    });
  });

  describe('cerrarPeriodo()', () => {
    it('cierra exitosamente un período que pasa todas las validaciones', async () => {
      const { service, mocks, audit } = build();
      mocks.periodoFindFirst
        .mockResolvedValueOnce(periodo())
        .mockResolvedValueOnce(null);
      mocks.comprobanteCount.mockResolvedValue(0);
      mocks.obtenerBalancePrueba.mockResolvedValue(balanceCuadrado());
      mocks.txUpdateMany.mockResolvedValue({ count: 1 });
      mocks.auditLog.mockResolvedValue(undefined);

      const result = await service.cerrarPeriodo(
        TENANT_ID,
        PERIODO_ID,
        USER_ID,
      );

      expect(result).toEqual({ cerrado: true, yaEstabaCerrado: false });
      expect(mocks.txUpdateMany).toHaveBeenCalledWith({
        where: { id: PERIODO_ID, tenantId: TENANT_ID, estado: 'ABIERTO' },
        data: {
          estado: 'CERRADO',
          cerradoAt: expect.any(Date),
          cerradoPorId: USER_ID,
        },
      });
      expect(audit.log).toHaveBeenCalledWith({
        tenantId: TENANT_ID,
        userId: USER_ID,
        action: 'PERIODO_CONTABLE_CERRADO',
        entityType: 'PeriodoContable',
        entityId: PERIODO_ID,
      });
    });

    it('devuelve cerrado=false con bloqueos cuando el período no existe', async () => {
      const { service, mocks } = build();
      mocks.periodoFindFirst.mockResolvedValue(null);

      const result = await service.cerrarPeriodo(
        TENANT_ID,
        PERIODO_ID,
        USER_ID,
      );

      expect(result).toEqual({
        cerrado: false,
        yaEstabaCerrado: false,
        bloqueos: ['PERIODO_NO_ENCONTRADO'],
      });
    });

    it('devuelve cerrado=true yaEstabaCerrado=true cuando el período ya está cerrado', async () => {
      const { service, mocks } = build();
      mocks.periodoFindFirst.mockResolvedValue(periodo({ estado: 'CERRADO' }));

      const result = await service.cerrarPeriodo(
        TENANT_ID,
        PERIODO_ID,
        USER_ID,
      );

      expect(result).toEqual({ cerrado: true, yaEstabaCerrado: true });
    });

    it('devuelve cerrado=false con bloqueos cuando la validación falla por borradores', async () => {
      const { service, mocks } = build();
      mocks.periodoFindFirst
        .mockResolvedValueOnce(periodo())
        .mockResolvedValueOnce(null);
      mocks.comprobanteCount.mockResolvedValue(5);
      mocks.obtenerBalancePrueba.mockResolvedValue(balanceCuadrado());

      const result = await service.cerrarPeriodo(
        TENANT_ID,
        PERIODO_ID,
        USER_ID,
      );

      expect(result).toEqual({
        cerrado: false,
        yaEstabaCerrado: false,
        bloqueos: ['BORRADORES_PENDIENTES'],
      });
    });

    it('devuelve cerrado=true yaEstabaCerrado=true cuando un cierre concurrente ya cerró el período', async () => {
      const { service, mocks } = build();
      mocks.periodoFindFirst
        .mockResolvedValueOnce(periodo())
        .mockResolvedValueOnce(null);
      mocks.comprobanteCount.mockResolvedValue(0);
      mocks.obtenerBalancePrueba.mockResolvedValue(balanceCuadrado());
      mocks.txUpdateMany.mockResolvedValue({ count: 0 });

      const result = await service.cerrarPeriodo(
        TENANT_ID,
        PERIODO_ID,
        USER_ID,
      );

      expect(result).toEqual({ cerrado: true, yaEstabaCerrado: true });
    });

    it('no registra auditoría cuando el cierre es rechazado por validación', async () => {
      const { service, mocks, audit } = build();
      mocks.periodoFindFirst.mockResolvedValue(null);

      await service.cerrarPeriodo(TENANT_ID, PERIODO_ID, USER_ID);

      expect(audit.log).not.toHaveBeenCalled();
    });

    it('no registra auditoría cuando el cierre concurrente no actualiza filas', async () => {
      const { service, mocks, audit } = build();
      mocks.periodoFindFirst
        .mockResolvedValueOnce(periodo())
        .mockResolvedValueOnce(null);
      mocks.comprobanteCount.mockResolvedValue(0);
      mocks.obtenerBalancePrueba.mockResolvedValue(balanceCuadrado());
      mocks.txUpdateMany.mockResolvedValue({ count: 0 });

      await service.cerrarPeriodo(TENANT_ID, PERIODO_ID, USER_ID);

      expect(audit.log).not.toHaveBeenCalled();
    });
  });

  describe('reabrirPeriodo()', () => {
    const MOTIVO = 'Corrección de asiento detectada por auditoría externa';

    it('devuelve bloqueo PERIODO_NO_ENCONTRADO cuando el período no existe', async () => {
      const { service, mocks } = build();
      mocks.periodoFindFirst.mockResolvedValueOnce(null);

      const result = await service.reabrirPeriodo(
        TENANT_ID,
        PERIODO_ID,
        USER_ID,
        MOTIVO,
      );

      expect(result).toEqual({
        reabierto: false,
        yaEstabaAbierto: false,
        bloqueos: ['PERIODO_NO_ENCONTRADO'],
      });
    });

    it('devuelve bloqueo MOTIVO_REQUERIDO cuando el motivo está vacío', async () => {
      const { service, mocks } = build();
      mocks.periodoFindFirst.mockResolvedValueOnce(
        periodo({ estado: 'CERRADO' }),
      );

      const result = await service.reabrirPeriodo(
        TENANT_ID,
        PERIODO_ID,
        USER_ID,
        '   ',
      );

      expect(result).toEqual({
        reabierto: false,
        yaEstabaAbierto: false,
        bloqueos: ['MOTIVO_REQUERIDO'],
      });
    });

    it('devuelve reabierto=true yaEstabaAbierto=true cuando el período ya está ABIERTO (no-op)', async () => {
      const { service, mocks, audit } = build();
      mocks.periodoFindFirst.mockResolvedValueOnce(
        periodo({ estado: 'ABIERTO' }),
      );

      const result = await service.reabrirPeriodo(
        TENANT_ID,
        PERIODO_ID,
        USER_ID,
        MOTIVO,
      );

      expect(result).toEqual({ reabierto: true, yaEstabaAbierto: true });
      expect(audit.log).not.toHaveBeenCalled();
      expect(mocks.periodoFindFirst).toHaveBeenCalledTimes(1);
    });

    it('devuelve bloqueo NO_ES_ULTIMO_PERIODO_CERRADO cuando existe un período CERRADO posterior', async () => {
      const { service, mocks } = build();
      mocks.periodoFindFirst
        .mockResolvedValueOnce(
          periodo({ estado: 'CERRADO', anio: 2026, mes: 5 }),
        )
        .mockResolvedValueOnce({ id: 'p-006' }); // junio 2026, también CERRADO
      mocks.comprobanteFindFirst.mockResolvedValue(null);

      const result = await service.reabrirPeriodo(
        TENANT_ID,
        PERIODO_ID,
        USER_ID,
        MOTIVO,
      );

      expect(result).toEqual({
        reabierto: false,
        yaEstabaAbierto: false,
        bloqueos: ['NO_ES_ULTIMO_PERIODO_CERRADO'],
      });
      expect(mocks.periodoFindFirst).toHaveBeenNthCalledWith(2, {
        where: {
          tenantId: TENANT_ID,
          estado: 'CERRADO',
          OR: [{ anio: { gt: 2026 } }, { anio: 2026, mes: { gt: 5 } }],
        },
        select: { id: true },
      });
    });

    it('detecta LIFO correctamente al cruzar el año (diciembre cerrado bloquea reapertura de noviembre del año anterior)', async () => {
      const { service, mocks } = build();
      mocks.periodoFindFirst
        .mockResolvedValueOnce(
          periodo({ estado: 'CERRADO', anio: 2025, mes: 12 }),
        )
        .mockResolvedValueOnce({ id: 'p-ene-2026' });
      mocks.comprobanteFindFirst.mockResolvedValue(null);

      const result = await service.reabrirPeriodo(
        TENANT_ID,
        PERIODO_ID,
        USER_ID,
        MOTIVO,
      );

      expect(result.bloqueos).toEqual(['NO_ES_ULTIMO_PERIODO_CERRADO']);
      expect(mocks.periodoFindFirst).toHaveBeenNthCalledWith(2, {
        where: {
          tenantId: TENANT_ID,
          estado: 'CERRADO',
          OR: [{ anio: { gt: 2025 } }, { anio: 2025, mes: { gt: 12 } }],
        },
        select: { id: true },
      });
    });

    it('devuelve bloqueo CIERRE_ANUAL_POSTEADO cuando existe un comprobante de cierre anual no anulado', async () => {
      const { service, mocks } = build();
      mocks.periodoFindFirst
        .mockResolvedValueOnce(periodo({ estado: 'CERRADO' }))
        .mockResolvedValueOnce(null);
      mocks.comprobanteFindFirst.mockResolvedValue({ id: 'cc-001' });

      const result = await service.reabrirPeriodo(
        TENANT_ID,
        PERIODO_ID,
        USER_ID,
        MOTIVO,
      );

      expect(result).toEqual({
        reabierto: false,
        yaEstabaAbierto: false,
        bloqueos: ['CIERRE_ANUAL_POSTEADO'],
      });
      expect(mocks.comprobanteFindFirst).toHaveBeenCalledWith({
        where: {
          tenantId: TENANT_ID,
          periodoId: PERIODO_ID,
          origenTipo: 'CIERRE_ANUAL',
          estado: { not: 'ANULADO' },
        },
        select: { id: true },
      });
    });

    it('no bloquea cuando el cierre anual existente ya fue ANULADO', async () => {
      const { service, mocks } = build();
      mocks.periodoFindFirst
        .mockResolvedValueOnce(periodo({ estado: 'CERRADO' }))
        .mockResolvedValueOnce(null);
      mocks.comprobanteFindFirst.mockResolvedValue(null); // filtrado por estado:{not:'ANULADO'}
      mocks.txUpdateMany.mockResolvedValue({ count: 1 });
      mocks.auditLog.mockResolvedValue(undefined);

      const result = await service.reabrirPeriodo(
        TENANT_ID,
        PERIODO_ID,
        USER_ID,
        MOTIVO,
      );

      expect(result).toEqual({ reabierto: true, yaEstabaAbierto: false });
    });

    it('reabre exitosamente el único período cerrado (la frontera) y audita con el motivo', async () => {
      const { service, mocks, audit } = build();
      mocks.periodoFindFirst
        .mockResolvedValueOnce(periodo({ estado: 'CERRADO' }))
        .mockResolvedValueOnce(null);
      mocks.comprobanteFindFirst.mockResolvedValue(null);
      mocks.txUpdateMany.mockResolvedValue({ count: 1 });
      mocks.auditLog.mockResolvedValue(undefined);

      const result = await service.reabrirPeriodo(
        TENANT_ID,
        PERIODO_ID,
        USER_ID,
        MOTIVO,
      );

      expect(result).toEqual({ reabierto: true, yaEstabaAbierto: false });
      expect(mocks.txUpdateMany).toHaveBeenCalledWith({
        where: { id: PERIODO_ID, tenantId: TENANT_ID, estado: 'CERRADO' },
        data: {
          estado: 'ABIERTO',
          cerradoAt: null,
          cerradoPorId: null,
        },
      });
      expect(audit.log).toHaveBeenCalledWith({
        tenantId: TENANT_ID,
        userId: USER_ID,
        action: 'PERIODO_CONTABLE_REABIERTO',
        entityType: 'PeriodoContable',
        entityId: PERIODO_ID,
        metadata: { motivo: MOTIVO },
      });
    });

    it('devuelve reabierto=true yaEstabaAbierto=true cuando una reapertura concurrente ya actuó (carrera)', async () => {
      const { service, mocks, audit } = build();
      mocks.periodoFindFirst
        .mockResolvedValueOnce(periodo({ estado: 'CERRADO' }))
        .mockResolvedValueOnce(null);
      mocks.comprobanteFindFirst.mockResolvedValue(null);
      mocks.txUpdateMany.mockResolvedValue({ count: 0 });

      const result = await service.reabrirPeriodo(
        TENANT_ID,
        PERIODO_ID,
        USER_ID,
        MOTIVO,
      );

      expect(result).toEqual({ reabierto: true, yaEstabaAbierto: true });
      expect(audit.log).not.toHaveBeenCalled();
    });

    it('no registra auditoría cuando la reapertura es rechazada por bloqueos', async () => {
      const { service, mocks, audit } = build();
      mocks.periodoFindFirst.mockResolvedValueOnce(null);

      await service.reabrirPeriodo(TENANT_ID, PERIODO_ID, USER_ID, MOTIVO);

      expect(audit.log).not.toHaveBeenCalled();
    });
  });

  describe('cerrarAnioFiscal()', () => {
    const ANIO = 2026;
    const DICIEMBRE_ID = 'p-dic-2026';
    const FECHA_FIN_DICIEMBRE = new Date(Date.UTC(2026, 11, 31));
    const CUENTA_RESULTADO_ID = 'cta-patrimonio-360505';
    const COMPROBANTE_ID = 'cc-2026-001';

    function diciembre(data: Record<string, unknown> = {}) {
      return {
        id: DICIEMBRE_ID,
        estado: 'ABIERTO' as const,
        fechaFin: FECHA_FIN_DICIEMBRE,
        ...data,
      };
    }

    function balanceUtilidad() {
      // Ingresos (clase 4, saldo crédito 800000) > Gastos (clase 5, saldo débito 500000) → utilidad 300000.
      return [
        {
          cuentaId: 'cta-ingresos',
          codigo: '413505',
          nombre: 'Ingresos',
          totalDebito: new Prisma.Decimal(0),
          totalCredito: new Prisma.Decimal(800000),
          saldo: new Prisma.Decimal(-800000),
        },
        {
          cuentaId: 'cta-gastos',
          codigo: '510506',
          nombre: 'Gasto sueldos',
          totalDebito: new Prisma.Decimal(500000),
          totalCredito: new Prisma.Decimal(0),
          saldo: new Prisma.Decimal(500000),
        },
      ];
    }

    function balancePerdida() {
      // Ingresos 300000 < Gastos 500000 → pérdida 200000.
      return [
        {
          cuentaId: 'cta-ingresos',
          codigo: '413505',
          nombre: 'Ingresos',
          totalDebito: new Prisma.Decimal(0),
          totalCredito: new Prisma.Decimal(300000),
          saldo: new Prisma.Decimal(-300000),
        },
        {
          cuentaId: 'cta-gastos',
          codigo: '510506',
          nombre: 'Gasto sueldos',
          totalDebito: new Prisma.Decimal(500000),
          totalCredito: new Prisma.Decimal(0),
          saldo: new Prisma.Decimal(500000),
        },
      ];
    }

    function balanceNeutro() {
      // Ingresos 500000 = Gastos 500000 → neto exactamente cero.
      return [
        {
          cuentaId: 'cta-ingresos',
          codigo: '413505',
          nombre: 'Ingresos',
          totalDebito: new Prisma.Decimal(0),
          totalCredito: new Prisma.Decimal(500000),
          saldo: new Prisma.Decimal(-500000),
        },
        {
          cuentaId: 'cta-gastos',
          codigo: '510506',
          nombre: 'Gasto sueldos',
          totalDebito: new Prisma.Decimal(500000),
          totalCredito: new Prisma.Decimal(0),
          saldo: new Prisma.Decimal(500000),
        },
      ];
    }

    function balanceContraNatural() {
      // Cuenta de gasto (clase 5) con saldo NETO CRÉDITO (contra-natural,
      // p.ej. un reverso mayor que el gasto original). El diseño saldo-dirigido
      // debe cancelarla con un DÉBITO — no con un crédito por su "naturaleza".
      return [
        {
          cuentaId: 'cta-gasto-contranatural',
          codigo: '510506',
          nombre: 'Gasto sueldos',
          totalDebito: new Prisma.Decimal(0),
          totalCredito: new Prisma.Decimal(200000),
          saldo: new Prisma.Decimal(-200000),
        },
      ];
    }

    // Saldo dimensionado (lo que consume U4 vía obtenerSaldosDimensionados).
    function dim(
      cuentaId: string,
      saldo: number,
      terceroId: string | null = null,
      centroCostoId: string | null = null,
    ) {
      const s = new Prisma.Decimal(saldo);
      return {
        cuentaId,
        codigo: cuentaId,
        nombre: cuentaId,
        terceroId,
        centroCostoId,
        totalDebito: s.gt(0) ? s : new Prisma.Decimal(0),
        totalCredito: s.lt(0) ? s.abs() : new Prisma.Decimal(0),
        saldo: s,
      };
    }

    function mockDependenciasOk(mocks: ReturnType<typeof build>['mocks']) {
      mocks.periodoFindFirst
        .mockResolvedValueOnce(diciembre()) // 1. diciembre
        .mockResolvedValueOnce(null); // 2. mesAnteriorAbierto (ninguno abierto)
      mocks.comprobanteFindMany.mockResolvedValue([]); // posted = ∅ por defecto
      mocks.tipoComprobanteFindFirst.mockResolvedValue({ id: 'tipo-cc' });
      mocks.cuentaSistemaMapFindFirst.mockResolvedValue({
        cuentaId: CUENTA_RESULTADO_ID,
      });
      mocks.auditLog.mockResolvedValue(undefined);
    }

    // Captura el input entregado a LedgerService.registrarComprobante con un
    // tipo conocido — evita indexar `mock.calls` (valor `any`) en las
    // aserciones.
    function capturarComprobante(mocks: ReturnType<typeof build>['mocks']) {
      const capturado: { input?: RegistrarComprobanteInput } = {};
      mocks.registrarComprobante.mockImplementationOnce(
        (input: RegistrarComprobanteInput) => {
          capturado.input = input;
          return Promise.resolve({ id: COMPROBANTE_ID });
        },
      );
      return capturado;
    }

    // Captura TODOS los borradores entregados al puerto (para cierres de varios
    // lotes). Devuelve ids deterministas cc-1, cc-2, …
    function capturarComprobantes(mocks: ReturnType<typeof build>['mocks']) {
      const inputs: RegistrarComprobanteInput[] = [];
      mocks.registrarComprobante.mockImplementation(
        (input: RegistrarComprobanteInput) => {
          inputs.push(input);
          return Promise.resolve({ id: `cc-${inputs.length}` });
        },
      );
      return inputs;
    }

    it('COMPLETE: conjunto completo presente y diciembre CERRADO → idempotencia sin re-postear ni tocar diciembre', async () => {
      const { service, mocks, audit, ledger } = build();
      mocks.periodoFindFirst.mockResolvedValueOnce(
        diciembre({ estado: 'CERRADO' }),
      );
      mocks.comprobanteFindMany.mockResolvedValue([
        { id: COMPROBANTE_ID, origenEvento: 'CIERRE' },
      ]);
      mocks.obtenerSaldosDimensionados.mockResolvedValue([
        dim('cta-ingresos', -800000),
        dim('cta-gastos', 500000),
      ]);
      const cerrarPeriodoSpy = jest.spyOn(service, 'cerrarPeriodo');

      const result = await service.cerrarAnioFiscal(TENANT_ID, ANIO, USER_ID);

      expect(result).toEqual({
        posteado: false,
        yaEstabaPosteado: true,
        diciembreCerrado: false,
        comprobanteIds: [COMPROBANTE_ID],
      });
      // `posted` se lee con findMany (conjunto), no findFirst.
      expect(mocks.comprobanteFindMany).toHaveBeenCalledWith({
        where: {
          tenantId: TENANT_ID,
          origenTipo: 'CIERRE_ANUAL',
          origenId: String(ANIO),
          estado: { not: 'ANULADO' },
        },
        select: { id: true, origenEvento: true },
      });
      // El plan excluye su propio cierre del año (estabilidad, C3 §8.3).
      expect(mocks.obtenerSaldosDimensionados).toHaveBeenCalledWith(
        TENANT_ID,
        expect.objectContaining({
          excluirOrigenTipo: 'CIERRE_ANUAL',
          excluirOrigenId: String(ANIO),
        }),
      );
      // No re-postea, no toca diciembre (ya CERRADO), no audita.
      expect(ledger.registrarComprobante).not.toHaveBeenCalled();
      expect(cerrarPeriodoSpy).not.toHaveBeenCalled();
      expect(audit.log).not.toHaveBeenCalled();
    });

    it('COMPLETE-tail: conjunto completo pero diciembre ABIERTO → cierra diciembre sin re-postear', async () => {
      const { service, mocks, ledger } = build();
      mocks.periodoFindFirst.mockResolvedValueOnce(diciembre()); // ABIERTO
      mocks.comprobanteFindMany.mockResolvedValue([
        { id: COMPROBANTE_ID, origenEvento: 'CIERRE' },
      ]);
      mocks.obtenerSaldosDimensionados.mockResolvedValue([
        dim('cta-ingresos', -800000),
        dim('cta-gastos', 500000),
      ]);
      const cerrarPeriodoSpy = jest
        .spyOn(service, 'cerrarPeriodo')
        .mockResolvedValue({ cerrado: true, yaEstabaCerrado: false });

      const result = await service.cerrarAnioFiscal(TENANT_ID, ANIO, USER_ID);

      expect(result).toEqual({
        posteado: false,
        yaEstabaPosteado: true,
        diciembreCerrado: true,
        comprobanteIds: [COMPROBANTE_ID],
      });
      expect(ledger.registrarComprobante).not.toHaveBeenCalled();
      expect(cerrarPeriodoSpy).toHaveBeenCalledWith(
        TENANT_ID,
        DICIEMBRE_ID,
        USER_ID,
      );
    });

    it('devuelve bloqueo PERIODO_DICIEMBRE_NO_ENCONTRADO cuando diciembre no existe', async () => {
      const { service, mocks } = build();
      mocks.periodoFindFirst.mockResolvedValueOnce(null);

      const result = await service.cerrarAnioFiscal(TENANT_ID, ANIO, USER_ID);

      expect(result).toEqual({
        posteado: false,
        yaEstabaPosteado: false,
        diciembreCerrado: false,
        bloqueos: ['PERIODO_DICIEMBRE_NO_ENCONTRADO'],
      });
    });

    it('devuelve bloqueo DICIEMBRE_YA_CERRADO cuando diciembre ya está cerrado (con resultado por postear)', async () => {
      const { service, mocks } = build();
      mocks.periodoFindFirst
        .mockResolvedValueOnce(diciembre({ estado: 'CERRADO' }))
        .mockResolvedValueOnce(null);
      mocks.comprobanteFindMany.mockResolvedValue([]);
      mocks.obtenerSaldosDimensionados.mockResolvedValue([
        dim('cta-ingresos', -800000),
        dim('cta-gastos', 500000),
      ]);
      mocks.tipoComprobanteFindFirst.mockResolvedValue({ id: 'tipo-cc' });
      mocks.cuentaSistemaMapFindFirst.mockResolvedValue({
        cuentaId: CUENTA_RESULTADO_ID,
      });

      const result = await service.cerrarAnioFiscal(TENANT_ID, ANIO, USER_ID);

      expect(result).toEqual({
        posteado: false,
        yaEstabaPosteado: false,
        diciembreCerrado: false,
        bloqueos: ['DICIEMBRE_YA_CERRADO'],
      });
    });

    it('devuelve bloqueo MESES_ANTERIORES_ABIERTOS cuando algún mes 1–11 sigue abierto', async () => {
      const { service, mocks } = build();
      mocks.periodoFindFirst
        .mockResolvedValueOnce(diciembre())
        .mockResolvedValueOnce({ id: 'p-005' });
      mocks.comprobanteFindMany.mockResolvedValue([]);
      mocks.obtenerSaldosDimensionados.mockResolvedValue([
        dim('cta-ingresos', -800000),
        dim('cta-gastos', 500000),
      ]);
      mocks.tipoComprobanteFindFirst.mockResolvedValue({ id: 'tipo-cc' });
      mocks.cuentaSistemaMapFindFirst.mockResolvedValue({
        cuentaId: CUENTA_RESULTADO_ID,
      });

      const result = await service.cerrarAnioFiscal(TENANT_ID, ANIO, USER_ID);

      expect(result).toEqual({
        posteado: false,
        yaEstabaPosteado: false,
        diciembreCerrado: false,
        bloqueos: ['MESES_ANTERIORES_ABIERTOS'],
      });
      expect(mocks.periodoFindFirst).toHaveBeenNthCalledWith(2, {
        where: {
          tenantId: TENANT_ID,
          anio: ANIO,
          mes: { gte: 1, lte: 11 },
          estado: 'ABIERTO',
        },
        select: { id: true },
      });
    });

    it('devuelve bloqueo TIPO_CC_NO_ENCONTRADO cuando el tipo de comprobante CC no existe', async () => {
      const { service, mocks } = build();
      mocks.periodoFindFirst
        .mockResolvedValueOnce(diciembre())
        .mockResolvedValueOnce(null);
      mocks.comprobanteFindMany.mockResolvedValue([]);
      mocks.obtenerSaldosDimensionados.mockResolvedValue([
        dim('cta-ingresos', -800000),
        dim('cta-gastos', 500000),
      ]);
      mocks.tipoComprobanteFindFirst.mockResolvedValue(null);
      mocks.cuentaSistemaMapFindFirst.mockResolvedValue({
        cuentaId: CUENTA_RESULTADO_ID,
      });

      const result = await service.cerrarAnioFiscal(TENANT_ID, ANIO, USER_ID);

      expect(result).toEqual({
        posteado: false,
        yaEstabaPosteado: false,
        diciembreCerrado: false,
        bloqueos: ['TIPO_CC_NO_ENCONTRADO'],
      });
    });

    it('devuelve bloqueo RESULTADO_EJERCICIO_NO_MAPEADO cuando el rol no está mapeado (RF2)', async () => {
      const { service, mocks } = build();
      mocks.periodoFindFirst
        .mockResolvedValueOnce(diciembre())
        .mockResolvedValueOnce(null);
      mocks.comprobanteFindMany.mockResolvedValue([]);
      mocks.obtenerSaldosDimensionados.mockResolvedValue([
        dim('cta-ingresos', -800000),
        dim('cta-gastos', 500000),
      ]);
      mocks.tipoComprobanteFindFirst.mockResolvedValue({ id: 'tipo-cc' });
      mocks.cuentaSistemaMapFindFirst.mockResolvedValue(null);

      const result = await service.cerrarAnioFiscal(TENANT_ID, ANIO, USER_ID);

      expect(result).toEqual({
        posteado: false,
        yaEstabaPosteado: false,
        diciembreCerrado: false,
        bloqueos: ['RESULTADO_EJERCICIO_NO_MAPEADO'],
      });
      expect(mocks.registrarComprobante).not.toHaveBeenCalled();
    });

    it('acumula múltiples bloqueos cuando varias precondiciones fallan', async () => {
      const { service, mocks } = build();
      mocks.periodoFindFirst
        .mockResolvedValueOnce(diciembre({ estado: 'CERRADO' }))
        .mockResolvedValueOnce({ id: 'p-005' });
      mocks.comprobanteFindMany.mockResolvedValue([]);
      mocks.obtenerSaldosDimensionados.mockResolvedValue([
        dim('cta-ingresos', -800000),
        dim('cta-gastos', 500000),
      ]);
      mocks.tipoComprobanteFindFirst.mockResolvedValue(null);
      mocks.cuentaSistemaMapFindFirst.mockResolvedValue(null);

      const result = await service.cerrarAnioFiscal(TENANT_ID, ANIO, USER_ID);

      expect(result.posteado).toBe(false);
      expect(result.bloqueos).toEqual(
        expect.arrayContaining([
          'DICIEMBRE_YA_CERRADO',
          'MESES_ANTERIORES_ABIERTOS',
          'TIPO_CC_NO_ENCONTRADO',
          'RESULTADO_EJERCICIO_NO_MAPEADO',
        ]),
      );
      expect(result.bloqueos).toHaveLength(4);
    });

    it('sin saldos de resultado (B1): no postea asiento pero cierra diciembre en esta invocación', async () => {
      const { service, mocks, ledger } = build();
      mockDependenciasOk(mocks);
      mocks.obtenerSaldosDimensionados.mockResolvedValue([]);
      const cerrarPeriodoSpy = jest
        .spyOn(service, 'cerrarPeriodo')
        .mockResolvedValue({ cerrado: true, yaEstabaCerrado: false });

      const result = await service.cerrarAnioFiscal(TENANT_ID, ANIO, USER_ID);

      expect(result).toEqual({
        posteado: false,
        yaEstabaPosteado: false,
        sinResultados: true,
        diciembreCerrado: true,
      });
      expect(ledger.registrarComprobante).not.toHaveBeenCalled();
      expect(cerrarPeriodoSpy).toHaveBeenCalledWith(
        TENANT_ID,
        DICIEMBRE_ID,
        USER_ID,
      );
    });

    it('postea el asiento de utilidad, cierra diciembre y audita — solo porque esta invocación posteó', async () => {
      const { service, mocks, ledger, audit, client } = build();
      mockDependenciasOk(mocks);
      mocks.obtenerSaldosDimensionados.mockResolvedValue(balanceUtilidad());
      const capturado = capturarComprobante(mocks);
      const cerrarPeriodoSpy = jest
        .spyOn(service, 'cerrarPeriodo')
        .mockResolvedValue({ cerrado: true, yaEstabaCerrado: false });

      const result = await service.cerrarAnioFiscal(TENANT_ID, ANIO, USER_ID);

      expect(result).toEqual({
        posteado: true,
        yaEstabaPosteado: false,
        diciembreCerrado: true,
        comprobanteIds: [COMPROBANTE_ID],
      });

      expect(ledger.registrarComprobante).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_ID,
          userId: USER_ID,
          tipoComprobanteId: 'tipo-cc',
          periodoId: DICIEMBRE_ID,
          fecha: FECHA_FIN_DICIEMBRE,
          concepto: `Cierre anual ejercicio ${ANIO}`,
          origenTipo: 'CIERRE_ANUAL',
          origenId: String(ANIO),
          origenEvento: 'CIERRE',
        }),
        expect.anything(),
      );
      expect(mocks.registrarComprobante.mock.calls[0][1]).toBe(client);

      const lineas = capturado.input!.lineas;
      expect(lineas).toHaveLength(3);
      expect(lineas[0].debito.toString()).toBe('800000'); // cancela ingresos
      expect(lineas[1].credito.toString()).toBe('500000'); // cancela gastos
      expect(lineas[2].cuentaId).toBe(CUENTA_RESULTADO_ID);
      expect(lineas[2].credito.toString()).toBe('300000'); // utilidad → crédito a patrimonio

      expect(cerrarPeriodoSpy).toHaveBeenCalledWith(
        TENANT_ID,
        DICIEMBRE_ID,
        USER_ID,
      );
      expect(audit.log).toHaveBeenCalledWith({
        tenantId: TENANT_ID,
        userId: USER_ID,
        action: 'CIERRE_ANUAL_EJECUTADO',
        entityType: 'PeriodoContable',
        entityId: DICIEMBRE_ID,
        metadata: { anio: ANIO, comprobanteIds: [COMPROBANTE_ID] },
      });
    });

    it('postea el asiento de pérdida — el neto queda en débito de la cuenta de patrimonio', async () => {
      const { service, mocks } = build();
      mockDependenciasOk(mocks);
      mocks.obtenerSaldosDimensionados.mockResolvedValue(balancePerdida());
      const capturado = capturarComprobante(mocks);
      jest
        .spyOn(service, 'cerrarPeriodo')
        .mockResolvedValue({ cerrado: true, yaEstabaCerrado: false });

      await service.cerrarAnioFiscal(TENANT_ID, ANIO, USER_ID);

      const lineas = capturado.input!.lineas;
      const lineaPatrimonio = lineas.find(
        (l) => l.cuentaId === CUENTA_RESULTADO_ID,
      )!;
      expect(lineaPatrimonio.debito.toString()).toBe('200000'); // pérdida → débito a patrimonio
      expect(lineaPatrimonio.credito.toString()).toBe('0');
    });

    it('neto exactamente cero: no añade línea de patrimonio (las cuentas de resultado ya cuadran)', async () => {
      const { service, mocks } = build();
      mockDependenciasOk(mocks);
      mocks.obtenerSaldosDimensionados.mockResolvedValue(balanceNeutro());
      const capturado = capturarComprobante(mocks);
      jest
        .spyOn(service, 'cerrarPeriodo')
        .mockResolvedValue({ cerrado: true, yaEstabaCerrado: false });

      await service.cerrarAnioFiscal(TENANT_ID, ANIO, USER_ID);

      const lineas = capturado.input!.lineas;
      expect(lineas).toHaveLength(2);
      expect(lineas.some((l) => l.cuentaId === CUENTA_RESULTADO_ID)).toBe(
        false,
      );
    });

    it('cuenta contra-natural: se cancela por su saldo neto, no por su naturaleza esperada', async () => {
      const { service, mocks } = build();
      mockDependenciasOk(mocks);
      mocks.obtenerSaldosDimensionados.mockResolvedValue(
        balanceContraNatural(),
      );
      const capturado = capturarComprobante(mocks);
      jest
        .spyOn(service, 'cerrarPeriodo')
        .mockResolvedValue({ cerrado: true, yaEstabaCerrado: false });

      await service.cerrarAnioFiscal(TENANT_ID, ANIO, USER_ID);

      const lineas = capturado.input!.lineas;
      const lineaGasto = lineas.find(
        (l) => l.cuentaId === 'cta-gasto-contranatural',
      )!;
      // Saldo -200000 (neto crédito) en cuenta de gasto → se cancela con DÉBITO.
      expect(lineaGasto.debito.toString()).toBe('200000');
      expect(lineaGasto.credito.toString()).toBe('0');
    });

    it('carrera: un lote lanza ConflictException pero se confirma su presencia → continúa y cierra diciembre', async () => {
      const { service, mocks } = build();
      mockDependenciasOk(mocks); // posted = ∅
      mocks.obtenerSaldosDimensionados.mockResolvedValue(balanceUtilidad()); // 1 lote 'CIERRE'
      mocks.registrarComprobante.mockRejectedValue(
        new ConflictException('carrera'),
      );
      // buscarLoteCierre confirma que ESE lote quedó posteado por el otro actor.
      mocks.comprobanteFindFirst.mockResolvedValue({ id: COMPROBANTE_ID });
      const cerrarPeriodoSpy = jest
        .spyOn(service, 'cerrarPeriodo')
        .mockResolvedValue({ cerrado: true, yaEstabaCerrado: false });

      const result = await service.cerrarAnioFiscal(TENANT_ID, ANIO, USER_ID);

      expect(result).toEqual({
        posteado: true,
        yaEstabaPosteado: false,
        diciembreCerrado: true,
        comprobanteIds: [COMPROBANTE_ID],
      });
      // Confirmación por la clave COMPLETA del lote (incluye origenEvento).
      expect(mocks.comprobanteFindFirst).toHaveBeenCalledWith({
        where: {
          tenantId: TENANT_ID,
          origenTipo: 'CIERRE_ANUAL',
          origenId: String(ANIO),
          origenEvento: 'CIERRE',
          estado: { not: 'ANULADO' },
        },
        select: { id: true },
      });
      expect(cerrarPeriodoSpy).toHaveBeenCalled();
    });

    it('ConflictException por origen ajeno (lote no confirmable) → se propaga (fail-secure)', async () => {
      const { service, mocks } = build();
      mockDependenciasOk(mocks);
      mocks.obtenerSaldosDimensionados.mockResolvedValue(balanceUtilidad());
      mocks.registrarComprobante.mockRejectedValue(
        new ConflictException('origen ajeno'),
      );
      mocks.comprobanteFindFirst.mockResolvedValue(null); // no se confirma → anomalía real
      const cerrarPeriodoSpy = jest.spyOn(service, 'cerrarPeriodo');

      await expect(
        service.cerrarAnioFiscal(TENANT_ID, ANIO, USER_ID),
      ).rejects.toThrow('origen ajeno');
      expect(cerrarPeriodoSpy).not.toHaveBeenCalled();
    });

    it('propaga cualquier otro error del puerto sin tratarlo como carrera', async () => {
      const { service, mocks } = build();
      mockDependenciasOk(mocks);
      mocks.obtenerSaldosDimensionados.mockResolvedValue(balanceUtilidad());
      mocks.registrarComprobante.mockRejectedValue(
        new BadRequestException('cuenta inactiva'),
      );
      const cerrarPeriodoSpy = jest.spyOn(service, 'cerrarPeriodo');

      await expect(
        service.cerrarAnioFiscal(TENANT_ID, ANIO, USER_ID),
      ).rejects.toThrow('cuenta inactiva');
      expect(cerrarPeriodoSpy).not.toHaveBeenCalled();
      // No se re-consulta el lote para un error que no es de conflicto.
      expect(mocks.comprobanteFindFirst).not.toHaveBeenCalled();
    });

    it('un cierre anual ANULADO no cuenta como efectivo (findMany filtra estado ≠ ANULADO) → postea fresco', async () => {
      const { service, mocks } = build();
      // El mock simula la BD real: el ANULADO queda excluido por el where →
      // posted = ∅ (lo entrega mockDependenciasOk).
      mockDependenciasOk(mocks);
      mocks.obtenerSaldosDimensionados.mockResolvedValue(balanceUtilidad());
      mocks.registrarComprobante.mockResolvedValue({ id: 'cc-2026-002' });
      jest
        .spyOn(service, 'cerrarPeriodo')
        .mockResolvedValue({ cerrado: true, yaEstabaCerrado: false });

      const result = await service.cerrarAnioFiscal(TENANT_ID, ANIO, USER_ID);

      expect(result.posteado).toBe(true);
      expect(result.comprobanteIds).toEqual(['cc-2026-002']);
    });

    it('I6: propaga tercero y centro de costo a las líneas de resultado', async () => {
      const { service, mocks } = build();
      mockDependenciasOk(mocks);
      mocks.obtenerSaldosDimensionados.mockResolvedValue([
        dim('cta-ingresos', -500000, 'tercero-1', 'cc-ventas'),
      ]);
      const capturado = capturarComprobante(mocks);
      jest
        .spyOn(service, 'cerrarPeriodo')
        .mockResolvedValue({ cerrado: true, yaEstabaCerrado: false });

      await service.cerrarAnioFiscal(TENANT_ID, ANIO, USER_ID);

      expect(capturado.input!.lineas[0]).toMatchObject({
        cuentaId: 'cta-ingresos',
        terceroId: 'tercero-1',
        centroCostoId: 'cc-ventas',
      });
    });

    it('NONE multi-lote: particiona en >1 comprobante (origenEvento CIERRE#NN) respetando MAX_LINEAS', async () => {
      const { service, ledger, mocks } = build();
      mockDependenciasOk(mocks);
      // 200 tuplas de ingreso → 2 lotes (199 + 1); reserva 1 línea de patrimonio.
      const tuplas = Array.from({ length: 200 }, (_, i) =>
        dim('cta-ingresos', -100, `t${i}`),
      );
      mocks.obtenerSaldosDimensionados.mockResolvedValue(tuplas);
      const inputs = capturarComprobantes(mocks);
      jest
        .spyOn(service, 'cerrarPeriodo')
        .mockResolvedValue({ cerrado: true, yaEstabaCerrado: false });

      const result = await service.cerrarAnioFiscal(TENANT_ID, ANIO, USER_ID);

      expect(ledger.registrarComprobante).toHaveBeenCalledTimes(2);
      expect(inputs.map((i) => i.origenEvento)).toEqual([
        'CIERRE#01',
        'CIERRE#02',
      ]);
      // Lote 1: 199 resultado + 1 patrimonio = 200 (== MAX_LINEAS). Lote 2: 1 + 1.
      expect(inputs[0].lineas).toHaveLength(200);
      expect(inputs[1].lineas).toHaveLength(2);
      expect(result.posteado).toBe(true);
      expect(result.comprobanteIds).toEqual(['cc-1', 'cc-2']);
    });

    it('PARTIAL: reanuda posteando solo los lotes faltantes; no re-postea los presentes', async () => {
      const { service, ledger, mocks } = build();
      mockDependenciasOk(mocks);
      const tuplas = Array.from({ length: 200 }, (_, i) =>
        dim('cta-ingresos', -100, `t${i}`),
      );
      mocks.obtenerSaldosDimensionados.mockResolvedValue(tuplas);
      // El lote 1 ya estaba posteado (corrida previa interrumpida).
      mocks.comprobanteFindMany.mockResolvedValue([
        { id: 'ya-1', origenEvento: 'CIERRE#01' },
      ]);
      const inputs = capturarComprobantes(mocks);
      jest
        .spyOn(service, 'cerrarPeriodo')
        .mockResolvedValue({ cerrado: true, yaEstabaCerrado: false });

      const result = await service.cerrarAnioFiscal(TENANT_ID, ANIO, USER_ID);

      // Solo se postea el faltante (#02); el #01 no se re-postea.
      expect(ledger.registrarComprobante).toHaveBeenCalledTimes(1);
      expect(inputs).toHaveLength(1);
      expect(inputs[0].origenEvento).toBe('CIERRE#02');
      expect(result).toEqual({
        posteado: true,
        yaEstabaPosteado: false,
        diciembreCerrado: true,
        comprobanteIds: ['ya-1', 'cc-1'],
      });
    });

    it('ANOMALÍA (posted ⊄ expected): bloquea CIERRE_ANUAL_INCONSISTENTE, no postea ni cierra diciembre', async () => {
      const { service, ledger, mocks } = build();
      mocks.periodoFindFirst.mockResolvedValueOnce(diciembre());
      // El plan es de 1 lote ('CIERRE'), pero el libro tiene un lote ajeno.
      mocks.comprobanteFindMany.mockResolvedValue([
        { id: 'x', origenEvento: 'CIERRE#09' },
      ]);
      mocks.obtenerSaldosDimensionados.mockResolvedValue([
        dim('cta-ingresos', -800000),
        dim('cta-gastos', 500000),
      ]);
      const cerrarPeriodoSpy = jest.spyOn(service, 'cerrarPeriodo');

      const result = await service.cerrarAnioFiscal(TENANT_ID, ANIO, USER_ID);

      expect(result).toEqual({
        posteado: false,
        yaEstabaPosteado: false,
        diciembreCerrado: false,
        bloqueos: ['CIERRE_ANUAL_INCONSISTENTE'],
      });
      expect(ledger.registrarComprobante).not.toHaveBeenCalled();
      expect(cerrarPeriodoSpy).not.toHaveBeenCalled();
    });
  });
});
