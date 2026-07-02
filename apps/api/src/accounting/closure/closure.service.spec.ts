import { Prisma } from '@prisma/client';
import { ClosureService } from './closure.service';

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
    obtenerBalancePrueba: jest.fn(),
    periodoUpdateMany: jest.fn(),
    auditLog: jest.fn(),
    txUpdateMany: jest.fn(),
  };

  const tx = {
    periodoContable: {
      updateMany: mocks.txUpdateMany,
    },
  };

  const prisma = {
    periodoContable: {
      findFirst: mocks.periodoFindFirst,
      updateMany: mocks.periodoUpdateMany,
    },
    comprobanteContable: {
      count: mocks.comprobanteCount,
    },
    $transaction: jest
      .fn()
      .mockImplementation(async (cb: (tx: unknown) => unknown) => cb(tx)),
  };

  const reporting = {
    obtenerBalancePrueba: mocks.obtenerBalancePrueba,
  };

  const audit = {
    log: mocks.auditLog,
  };

  const service = new ClosureService(
    prisma as never,
    reporting as never,
    audit as never,
  );

  return { service, mocks, audit };
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
});
