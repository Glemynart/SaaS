/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import { Prisma } from '@prisma/client';
import { ReportingService } from './reporting.service';

const TENANT_ID = 't-001';

function build() {
  const mocks = {
    movimientosGroupBy: jest.fn(),
    cuentasFindMany: jest.fn(),
    comprobanteFindMany: jest.fn(),
    comprobanteCount: jest.fn(),
    movimientoFindMany: jest.fn(),
    movimientoCount: jest.fn(),
  };

  const prisma = {
    movimientoContable: {
      groupBy: mocks.movimientosGroupBy,
      findMany: mocks.movimientoFindMany,
      count: mocks.movimientoCount,
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

function movimientoMayor(overrides: Record<string, unknown> = {}): any {
  return {
    linea: 1,
    debito: new Prisma.Decimal(100),
    credito: new Prisma.Decimal(0),
    terceroId: null,
    centroCostoId: null,
    descripcion: null,
    comprobante: {
      id: 'comp-001',
      numero: 1,
      concepto: 'Apertura',
      fecha: new Date('2026-06-01'),
    },
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

  // ===========================================================================
  // obtenerSaldosDimensionados
  // ===========================================================================

  describe('obtenerSaldosDimensionados', () => {
    function grupoDim(
      cuentaId: string,
      terceroId: string | null,
      centroCostoId: string | null,
      debito: number,
      credito: number,
    ): any {
      return {
        cuentaId,
        terceroId,
        centroCostoId,
        _sum: {
          debito: new Prisma.Decimal(debito),
          credito: new Prisma.Decimal(credito),
        },
      };
    }

    it('agrupa por la tupla (cuenta, tercero, centro de costo) y no colapsa dimensiones', async () => {
      const { service, mocks } = build();

      mocks.movimientosGroupBy.mockResolvedValue([
        grupoDim('c1', 't1', null, 0, 300),
        grupoDim('c1', 't2', null, 0, 200),
      ]);
      mocks.cuentasFindMany.mockResolvedValue([
        cuentaRow('c1', '413505', 'Ingresos'),
      ]);

      const result = await service.obtenerSaldosDimensionados(TENANT_ID, {});

      expect(mocks.movimientosGroupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          by: ['cuentaId', 'terceroId', 'centroCostoId'],
        }),
      );
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ cuentaId: 'c1', terceroId: 't1' });
      expect(result[0].saldo.toString()).toBe('-300');
      expect(result[1]).toMatchObject({ cuentaId: 'c1', terceroId: 't2' });
    });

    it('ordena de forma total y determinista por (codigo, terceroId, centroCostoId) con nulos al final', async () => {
      const { service, mocks } = build();

      // Entregadas en orden arbitrario por el groupBy.
      mocks.movimientosGroupBy.mockResolvedValue([
        grupoDim('c2', 't2', null, 100, 0),
        grupoDim('c1', null, null, 100, 0), // tercero nulo → al final dentro de su código
        grupoDim('c2', 't1', 'cc1', 100, 0),
        grupoDim('c1', 't1', null, 100, 0),
      ]);
      mocks.cuentasFindMany.mockResolvedValue([
        cuentaRow('c1', '510506', 'Gasto'),
        cuentaRow('c2', '510569', 'Gasto B'),
      ]);

      const result = await service.obtenerSaldosDimensionados(TENANT_ID, {});

      expect(
        result.map((r) => [r.codigo, r.terceroId, r.centroCostoId]),
      ).toEqual([
        ['510506', 't1', null],
        ['510506', null, null],
        ['510569', 't1', 'cc1'],
        ['510569', 't2', null],
      ]);
    });

    it('devuelve array vacío si no hay movimientos', async () => {
      const { service, mocks } = build();
      mocks.movimientosGroupBy.mockResolvedValue([]);

      const result = await service.obtenerSaldosDimensionados(TENANT_ID, {});

      expect(result).toEqual([]);
      // Sin filas no hace la segunda consulta de catálogo.
      expect(mocks.cuentasFindMany).not.toHaveBeenCalled();
    });

    it('excluye el origen indicado (excluirOrigenTipo/excluirOrigenId) vía NOT', async () => {
      const { service, mocks } = build();
      mocks.movimientosGroupBy.mockResolvedValue([]);

      await service.obtenerSaldosDimensionados(TENANT_ID, {
        cuentaDesde: '4',
        cuentaHasta: '7999999999',
        excluirOrigenTipo: 'CIERRE_ANUAL',
        excluirOrigenId: '2026',
      });

      expect(mocks.movimientosGroupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            comprobante: expect.objectContaining({
              estado: 'CONTABILIZADO',
              NOT: { origenTipo: 'CIERRE_ANUAL', origenId: '2026' },
            }),
            cuenta: expect.objectContaining({
              codigo: expect.objectContaining({ gte: '4', lte: '7999999999' }),
            }),
          }),
        }),
      );
    });

    it('no añade NOT cuando solo se pasa uno de los dos campos de exclusión', async () => {
      const { service, mocks } = build();
      mocks.movimientosGroupBy.mockResolvedValue([]);

      await service.obtenerSaldosDimensionados(TENANT_ID, {
        excluirOrigenTipo: 'CIERRE_ANUAL',
      });

      const arg = mocks.movimientosGroupBy.mock.calls[0][0];
      expect(arg.where.comprobante.NOT).toBeUndefined();
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

  describe('obtenerLibroMayor', () => {
    const CUENTA_ID = 'cuenta-001';

    it('devuelve movimientos con saldoCorriente incremental', async () => {
      const { service, mocks } = build();

      mocks.movimientoFindMany.mockResolvedValue([
        movimientoMayor({
          linea: 1,
          debito: new Prisma.Decimal(200),
          credito: new Prisma.Decimal(0),
          comprobante: {
            id: 'comp-001',
            numero: 1,
            concepto: 'Cargo',
            fecha: new Date('2026-06-01'),
          },
        }),
        movimientoMayor({
          linea: 1,
          debito: new Prisma.Decimal(0),
          credito: new Prisma.Decimal(50),
          comprobante: {
            id: 'comp-002',
            numero: 2,
            concepto: 'Abono',
            fecha: new Date('2026-06-02'),
          },
        }),
      ]);
      mocks.movimientoCount.mockResolvedValue(2);
      mocks.movimientosGroupBy.mockResolvedValue([]);

      const { items } = await service.obtenerLibroMayor(TENANT_ID, {
        cuentaId: CUENTA_ID,
      });

      // Saldo inicial = 0 (primera página, sin fechaInicio)
      expect(items[0].saldoCorriente).toEqual(new Prisma.Decimal(200));
      expect(items[1].saldoCorriente).toEqual(new Prisma.Decimal(150));
    });

    it('devuelve array vacío si la cuenta no tiene movimientos', async () => {
      const { service, mocks } = build();

      mocks.movimientoFindMany.mockResolvedValue([]);
      mocks.movimientoCount.mockResolvedValue(0);

      const { items, total } = await service.obtenerLibroMayor(TENANT_ID, {
        cuentaId: CUENTA_ID,
      });

      expect(items).toEqual([]);
      expect(total).toBe(0);
    });

    it('solo incluye comprobantes CONTABILIZADO', async () => {
      const { service, mocks } = build();

      mocks.movimientoFindMany.mockResolvedValue([]);
      mocks.movimientoCount.mockResolvedValue(0);

      await service.obtenerLibroMayor(TENANT_ID, {
        cuentaId: CUENTA_ID,
      });

      expect(mocks.movimientoFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            comprobante: expect.objectContaining({
              estado: 'CONTABILIZADO',
            }),
          }),
        }),
      );
    });

    it('página correctamente', async () => {
      const { service, mocks } = build();

      mocks.movimientoFindMany.mockResolvedValue([]);
      mocks.movimientoCount.mockResolvedValue(0);

      await service.obtenerLibroMayor(TENANT_ID, {
        cuentaId: CUENTA_ID,
        page: 2,
        limit: 10,
      });

      expect(mocks.movimientoFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        }),
      );
    });

    it('calcula saldoInicial desde saldoCuenta con filtro compuesto', async () => {
      const { service, mocks } = build();

      mocks.movimientoFindMany.mockResolvedValue([
        movimientoMayor({
          linea: 1,
          comprobante: {
            id: 'comp-010',
            numero: 10,
            concepto: 'Página 2',
            fecha: new Date('2026-06-15'),
          },
        }),
      ]);
      mocks.movimientoCount.mockResolvedValue(15);
      mocks.movimientosGroupBy.mockResolvedValue([
        grupoSaldo(CUENTA_ID, 500, 200),
      ]);

      const { items } = await service.obtenerLibroMayor(TENANT_ID, {
        cuentaId: CUENTA_ID,
        page: 2,
        limit: 5,
      });

      // groupBy fue llamado con el filtro compuesto para saldoInicial
      expect(mocks.movimientosGroupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({
                comprobante: expect.objectContaining({
                  fecha: { lt: new Date('2026-06-15') },
                }),
              }),
              expect.objectContaining({
                comprobante: expect.objectContaining({
                  fecha: new Date('2026-06-15'),
                  numero: { lt: 10 },
                }),
              }),
              expect.objectContaining({
                comprobante: expect.objectContaining({
                  fecha: new Date('2026-06-15'),
                  numero: 10,
                  id: { lt: 'comp-010' },
                }),
              }),
              expect.objectContaining({
                comprobante: expect.objectContaining({
                  fecha: new Date('2026-06-15'),
                  numero: 10,
                  id: 'comp-010',
                }),
                linea: { lt: 1 },
              }),
            ]),
          }),
        }),
      );

      // saldoInicial = 500 - 200 = 300
      expect(items[0].saldoCorriente).toEqual(new Prisma.Decimal(400));
    });

    it('filtra por rango de fechas', async () => {
      const { service, mocks } = build();

      mocks.movimientoFindMany.mockResolvedValue([]);
      mocks.movimientoCount.mockResolvedValue(0);
      mocks.movimientosGroupBy.mockResolvedValue([]);

      const fechaInicio = new Date('2026-06-01');
      const fechaFin = new Date('2026-06-30');

      await service.obtenerLibroMayor(TENANT_ID, {
        cuentaId: CUENTA_ID,
        fechaInicio,
        fechaFin,
      });

      expect(mocks.movimientoFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
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

    it('ordena cronológicamente por fecha, numero y linea asc', async () => {
      const { service, mocks } = build();

      mocks.movimientoFindMany.mockResolvedValue([]);
      mocks.movimientoCount.mockResolvedValue(0);

      await service.obtenerLibroMayor(TENANT_ID, {
        cuentaId: CUENTA_ID,
      });

      expect(mocks.movimientoFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [
            { comprobante: { fecha: 'asc' } },
            { comprobante: { numero: 'asc' } },
            { comprobante: { id: 'asc' } },
            { linea: 'asc' },
          ],
        }),
      );
    });
  });

  describe('obtenerAuxiliarTercero', () => {
    const CUENTA_ID = 'cuenta-001';
    const TERCERO_ID = 'ter-001';

    it('filtra por cuentaId y terceroId con saldoCorriente', async () => {
      const { service, mocks } = build();

      mocks.movimientoFindMany.mockResolvedValue([
        movimientoMayor({
          linea: 1,
          debito: new Prisma.Decimal(500),
          tercero: { razonSocial: 'Cliente ABC' },
        }),
      ]);
      mocks.movimientoCount.mockResolvedValue(1);
      mocks.movimientosGroupBy.mockResolvedValue([]);

      const { items, total } = await service.obtenerAuxiliarTercero(TENANT_ID, {
        cuentaId: CUENTA_ID,
        terceroId: TERCERO_ID,
      });

      expect(total).toBe(1);
      expect(items[0].terceroNombre).toBe('Cliente ABC');
      expect(items[0].saldoCorriente).toEqual(new Prisma.Decimal(500));
    });

    it('incluye terceroId en el where y en saldoCuenta', async () => {
      const { service, mocks } = build();

      mocks.movimientoFindMany.mockResolvedValue([]);
      mocks.movimientoCount.mockResolvedValue(0);

      await service.obtenerAuxiliarTercero(TENANT_ID, {
        cuentaId: CUENTA_ID,
        terceroId: TERCERO_ID,
      });

      expect(mocks.movimientoFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            cuentaId: CUENTA_ID,
            terceroId: TERCERO_ID,
          }),
        }),
      );
    });

    it('tercero sin razonSocial muestra N/A', async () => {
      const { service, mocks } = build();

      mocks.movimientoFindMany.mockResolvedValue([
        movimientoMayor({
          linea: 1,
          tercero: null,
        }),
      ]);
      mocks.movimientoCount.mockResolvedValue(1);
      mocks.movimientosGroupBy.mockResolvedValue([]);

      const { items } = await service.obtenerAuxiliarTercero(TENANT_ID, {
        cuentaId: CUENTA_ID,
        terceroId: TERCERO_ID,
      });

      expect(items[0].terceroNombre).toBe('N/A');
    });
  });

  describe('obtenerAuxiliarCentroCosto', () => {
    const CUENTA_ID = 'cuenta-001';
    const CC_ID = 'cc-001';

    it('filtra por cuentaId y centroCostoId con saldoCorriente', async () => {
      const { service, mocks } = build();

      mocks.movimientoFindMany.mockResolvedValue([
        movimientoMayor({
          linea: 1,
          debito: new Prisma.Decimal(300),
          centroCosto: { codigo: 'CC01', nombre: 'Oficina Principal' },
        }),
      ]);
      mocks.movimientoCount.mockResolvedValue(1);
      mocks.movimientosGroupBy.mockResolvedValue([]);

      const { items } = await service.obtenerAuxiliarCentroCosto(TENANT_ID, {
        cuentaId: CUENTA_ID,
        centroCostoId: CC_ID,
      });

      expect(items[0].centroCostoCodigo).toBe('CC01');
      expect(items[0].centroCostoNombre).toBe('Oficina Principal');
      expect(items[0].saldoCorriente).toEqual(new Prisma.Decimal(300));
    });

    it('incluye centroCostoId en el where y en saldoCuenta', async () => {
      const { service, mocks } = build();

      mocks.movimientoFindMany.mockResolvedValue([]);
      mocks.movimientoCount.mockResolvedValue(0);

      await service.obtenerAuxiliarCentroCosto(TENANT_ID, {
        cuentaId: CUENTA_ID,
        centroCostoId: CC_ID,
      });

      expect(mocks.movimientoFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            cuentaId: CUENTA_ID,
            centroCostoId: CC_ID,
          }),
        }),
      );
    });

    it('centroCosto sin datos muestra N/A', async () => {
      const { service, mocks } = build();

      mocks.movimientoFindMany.mockResolvedValue([
        movimientoMayor({
          linea: 1,
          centroCosto: null,
        }),
      ]);
      mocks.movimientoCount.mockResolvedValue(1);
      mocks.movimientosGroupBy.mockResolvedValue([]);

      const { items } = await service.obtenerAuxiliarCentroCosto(TENANT_ID, {
        cuentaId: CUENTA_ID,
        centroCostoId: CC_ID,
      });

      expect(items[0].centroCostoCodigo).toBe('N/A');
      expect(items[0].centroCostoNombre).toBe('N/A');
    });
  });
});
