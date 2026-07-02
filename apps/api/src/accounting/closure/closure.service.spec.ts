import { Prisma } from '@prisma/client';
import { ClosureService } from './closure.service';

const TENANT_ID = 't-001';
const PERIODO_ID = 'p-001';

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
  };

  const prisma = {
    periodoContable: {
      findFirst: mocks.periodoFindFirst,
    },
    comprobanteContable: {
      count: mocks.comprobanteCount,
    },
  };

  const reporting = {
    obtenerBalancePrueba: mocks.obtenerBalancePrueba,
  };

  const service = new ClosureService(prisma as never, reporting as never);

  return { service, mocks };
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
});
