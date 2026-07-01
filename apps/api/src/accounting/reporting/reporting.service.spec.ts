import { Prisma } from '@prisma/client';
import { ReportingService } from './reporting.service';

const TENANT_ID = 't-001';

function build() {
  const mocks = {
    movimientosGroupBy: jest.fn(),
    cuentasFindMany: jest.fn(),
    comprobanteFindMany: jest.fn(),
    comprobanteCount: jest.fn(),
  };

  const prisma = {
    movimientoContable: {
      groupBy: mocks.movimientosGroupBy,
    },
    cuentaContable: {
      findMany: mocks.cuentasFindMany,
    },
    comprobanteContable: {
      findMany: mocks.comprobanteFindMany,
      count: mocks.comprobanteCount,
    },
  };

  const service = new ReportingService(prisma as any);

  return { service, mocks };
}

function grupoSaldo(cuentaId: string, debito: number, credito: number): any {
  return {
    cuentaId,
    _sum: {
      debito: new Prisma.Decimal(debito),
      credito: new Prisma.Decimal(credito),
    },
  };
}

function cuentaRow(id: string, codigo: string, nombre: string) {
  return { id, codigo, nombre };
}

function comprobanteDiario(overrides: Record<string, unknown> = {}): any {
  return {
    id: 'comp-001',
    tenantId: TENANT_ID,
    numero: 1,
    fecha: new Date('2026-06-01'),
    concepto: 'Venta del día',
    estado: 'CONTABILIZADO',
    tipoComprobanteId: 'tc-001',
    totalDebito: new Prisma.Decimal(100),
    totalCredito: new Prisma.Decimal(100),
    movimientos: [
      {
        linea: 1,
        cuentaId: 'cuenta-001',
        debito: new Prisma.Decimal(100),
        credito: new Prisma.Decimal(0),
        terceroId: null,
        centroCostoId: null,
        descripcion: null,
        cuenta: { codigo: '1105', nombre: 'Caja' },
      },
      {
        linea: 2,
        cuentaId: 'cuenta-002',
        debito: new Prisma.Decimal(0),
        credito: new Prisma.Decimal(100),
        terceroId: null,
        centroCostoId: null,
        descripcion: null,
        cuenta: { codigo: '4105', nombre: 'Ventas' },
      },
    ],
    ...overrides,
  };
}

// =============================================================================
// obtenerBalancePrueba
// =============================================================================

describe('ReportingService', () => {
  describe('obtenerBalancePrueba', () => {
    it('devuelve balance cuadrado (totalDebito == totalCredito)', async () => {
      const { service, mocks } = build();

      mocks.movimientosGroupBy.mockResolvedValue([
        grupoSaldo('c1', 500, 200),
        grupoSaldo('c2', 300, 600),
      ]);

      mocks.cuentasFindMany.mockResolvedValue([
        cuentaRow('c1', '1105', 'Caja'),
        cuentaRow('c2', '2105', 'Bancos'),
      ]);

      const result = await service.obtenerBalancePrueba(TENANT_ID, {});

      // Suma total débitos == Suma total créditos
      const totalDebito = result.reduce(
        (acc, r) => acc.add(r.totalDebito),
        new Prisma.Decimal(0),
      );
      const totalCredito = result.reduce(
        (acc, r) => acc.add(r.totalCredito),
        new Prisma.Decimal(0),
      );

      expect(totalDebito.equals(totalCredito)).toBe(true);
      expect(totalDebito).toEqual(new Prisma.Decimal(800));
    });

    it('devuelve array vacío si no hay movimientos en el rango', async () => {
      const { service, mocks } = build();

      mocks.movimientosGroupBy.mockResolvedValue([]);

      const result = await service.obtenerBalancePrueba(TENANT_ID, {});
      expect(result).toEqual([]);
    });

    it('enriquece cada fila con código y nombre de cuenta', async () => {
      const { service, mocks } = build();

      mocks.movimientosGroupBy.mockResolvedValue([
        grupoSaldo('c1', 100, 0),
        grupoSaldo('c2', 0, 100),
      ]);

      mocks.cuentasFindMany.mockResolvedValue([
        cuentaRow('c1', '110505', 'Caja General'),
        cuentaRow('c2', '410501', 'Ventas'),
      ]);

      const result = await service.obtenerBalancePrueba(TENANT_ID, {});

      expect(result[0].codigo).toBe('110505');
      expect(result[0].nombre).toBe('Caja General');
      expect(result[1].codigo).toBe('410501');
      expect(result[1].nombre).toBe('Ventas');
    });

    it('ordena por código de cuenta ascendentemente', async () => {
      const { service, mocks } = build();

      // Datos en orden no alfabético por código
      mocks.movimientosGroupBy.mockResolvedValue([
        grupoSaldo('c4', 100, 0),
        grupoSaldo('c1', 200, 0),
        grupoSaldo('c2', 300, 0),
      ]);

      mocks.cuentasFindMany.mockResolvedValue([
        cuentaRow('c4', '4', 'Ingresos'),
        cuentaRow('c1', '1', 'Activo'),
        cuentaRow('c2', '2', 'Pasivo'),
      ]);

      const result = await service.obtenerBalancePrueba(TENANT_ID, {});

      expect(result.map((r) => r.codigo)).toEqual(['1', '2', '4']);
    });

    it('filtra movimientos por rango de fechas', async () => {
      const { service, mocks } = build();

      mocks.movimientosGroupBy.mockResolvedValue([]);
      mocks.cuentasFindMany.mockResolvedValue([]);

      const fechaInicio = new Date('2026-06-01');
      const fechaFin = new Date('2026-06-30');

      await service.obtenerBalancePrueba(TENANT_ID, {
        fechaInicio,
        fechaFin,
      });

      expect(mocks.movimientosGroupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: TENANT_ID,
            comprobante: expect.objectContaining({
              estado: 'CONTABILIZADO',
              fecha: expect.objectContaining({
                gte: fechaInicio,
                lte: fechaFin,
              }),
            }),
          }),
        }),
      );
    });

    it('filtra movimientos por nivel de cuenta', async () => {
      const { service, mocks } = build();

      mocks.movimientosGroupBy.mockResolvedValue([]);
      mocks.cuentasFindMany.mockResolvedValue([]);

      await service.obtenerBalancePrueba(TENANT_ID, { nivel: 3 });

      expect(mocks.movimientosGroupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            cuenta: expect.objectContaining({
              nivel: 3,
            }),
          }),
        }),
      );
    });

    it('filtra movimientos por rango de cuentas (cuentaDesde / cuentaHasta)', async () => {
      const { service, mocks } = build();

      mocks.movimientosGroupBy.mockResolvedValue([]);
      mocks.cuentasFindMany.mockResolvedValue([]);

      await service.obtenerBalancePrueba(TENANT_ID, {
        cuentaDesde: '1',
        cuentaHasta: '3',
      });

      expect(mocks.movimientosGroupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            cuenta: expect.objectContaining({
              codigo: expect.objectContaining({
                gte: '1',
                lte: '3',
              }),
            }),
          }),
        }),
      );
    });

    it('excluye comprobantes en estado BORRADOR', async () => {
      const { service, mocks } = build();

      mocks.movimientosGroupBy.mockResolvedValue([]);
      mocks.cuentasFindMany.mockResolvedValue([]);

      await service.obtenerBalancePrueba(TENANT_ID, {});

      expect(mocks.movimientosGroupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            comprobante: expect.objectContaining({
              estado: 'CONTABILIZADO',
            }),
          }),
        }),
      );
    });

    it('cuenta sin código en catálogo muestra N/A', async () => {
      const { service, mocks } = build();

      mocks.movimientosGroupBy.mockResolvedValue([
        grupoSaldo('c-inexistente', 100, 0),
      ]);

      mocks.cuentasFindMany.mockResolvedValue([]);

      const result = await service.obtenerBalancePrueba(TENANT_ID, {});

      expect(result[0].codigo).toBe('N/A');
      expect(result[0].nombre).toBe('Cuenta no encontrada');
    });
  });

  describe('obtenerLibroDiario', () => {
    it('devuelve comprobantes con movimientos anidados', async () => {
      const { service, mocks } = build();

      mocks.comprobanteFindMany.mockResolvedValue([comprobanteDiario()]);
      mocks.comprobanteCount.mockResolvedValue(1);

      const { items, total } = await service.obtenerLibroDiario(TENANT_ID, {});

      expect(total).toBe(1);
      expect(items[0].comprobanteId).toBe('comp-001');
      expect(items[0].concepto).toBe('Venta del día');
      expect(items[0].movimientos).toHaveLength(2);
      expect(items[0].movimientos[0].cuentaCodigo).toBe('1105');
      expect(items[0].movimientos[0].cuentaNombre).toBe('Caja');
      expect(items[0].movimientos[1].cuentaCodigo).toBe('4105');
    });

    it('excluye BORRADOR por defecto', async () => {
      const { service, mocks } = build();

      mocks.comprobanteFindMany.mockResolvedValue([]);
      mocks.comprobanteCount.mockResolvedValue(0);

      await service.obtenerLibroDiario(TENANT_ID, {});

      expect(mocks.comprobanteFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            estado: 'CONTABILIZADO',
          }),
        }),
      );
    });

    it('incluye BORRADOR cuando incluirBorradores es true', async () => {
      const { service, mocks } = build();

      mocks.comprobanteFindMany.mockResolvedValue([]);
      mocks.comprobanteCount.mockResolvedValue(0);

      await service.obtenerLibroDiario(TENANT_ID, {
        incluirBorradores: true,
      });

      expect(mocks.comprobanteFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            estado: { in: ['CONTABILIZADO', 'BORRADOR'] },
          }),
        }),
      );
    });

    it('ordena por fecha DESC y numero DESC en modo normal', async () => {
      const { service, mocks } = build();

      mocks.comprobanteFindMany.mockResolvedValue([]);
      mocks.comprobanteCount.mockResolvedValue(0);

      await service.obtenerLibroDiario(TENANT_ID, {});

      expect(mocks.comprobanteFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ fecha: 'desc' }, { numero: 'desc' }],
        }),
      );
    });

    it('ordena por fecha DESC y createdAt DESC con borradores', async () => {
      const { service, mocks } = build();

      mocks.comprobanteFindMany.mockResolvedValue([]);
      mocks.comprobanteCount.mockResolvedValue(0);

      await service.obtenerLibroDiario(TENANT_ID, {
        incluirBorradores: true,
      });

      expect(mocks.comprobanteFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
        }),
      );
    });

    it('pagina correctamente', async () => {
      const { service, mocks } = build();

      mocks.comprobanteFindMany.mockResolvedValue([]);
      mocks.comprobanteCount.mockResolvedValue(0);

      await service.obtenerLibroDiario(TENANT_ID, {
        page: 2,
        limit: 10,
      });

      expect(mocks.comprobanteFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        }),
      );
    });

    it('filtra por rango de fechas', async () => {
      const { service, mocks } = build();

      mocks.comprobanteFindMany.mockResolvedValue([]);
      mocks.comprobanteCount.mockResolvedValue(0);

      const fechaInicio = new Date('2026-06-01');
      const fechaFin = new Date('2026-06-30');

      await service.obtenerLibroDiario(TENANT_ID, {
        fechaInicio,
        fechaFin,
      });

      expect(mocks.comprobanteFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            fecha: expect.objectContaining({
              gte: fechaInicio,
              lte: fechaFin,
            }),
          }),
        }),
      );
    });

    it('filtra por tipoComprobanteId', async () => {
      const { service, mocks } = build();

      mocks.comprobanteFindMany.mockResolvedValue([]);
      mocks.comprobanteCount.mockResolvedValue(0);

      await service.obtenerLibroDiario(TENANT_ID, {
        tipoComprobanteId: 'tc-001',
      });

      expect(mocks.comprobanteFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tipoComprobanteId: 'tc-001',
          }),
        }),
      );
    });
  });
});
