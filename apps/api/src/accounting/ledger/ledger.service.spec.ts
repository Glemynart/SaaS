import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { LedgerService } from './ledger.service';
import { RegistrarComprobanteInput } from './ledger.types';

// =============================================================================
// Fixtures
// =============================================================================

const TENANT_ID = 't-001';
const USER_ID = 'u-001';
const PERIODO_ID = 'p-001';
const TIPO_COMPROBANTE_ID = 'tc-001';

function cuenta(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cuenta-001',
    codigo: '110505',
    imputable: true,
    activa: true,
    deletedAt: null,
    requiereTercero: false,
    requiereCentroCosto: false,
    requiereBase: false,
    ...overrides,
  };
}

function comprobanteInput(
  overrides: Partial<RegistrarComprobanteInput> = {},
): RegistrarComprobanteInput {
  return {
    tenantId: TENANT_ID,
    userId: USER_ID,
    tipoComprobanteId: TIPO_COMPROBANTE_ID,
    periodoId: PERIODO_ID,
    fecha: new Date('2026-06-01'),
    concepto: 'Test comprobante',
    lineas: [
      { cuentaId: 'cuenta-001', debito: 100000, credito: 0 },
      { cuentaId: 'cuenta-002', debito: 0, credito: 100000 },
    ],
    ...overrides,
  };
}

function comprobanteCreado(overrides: Record<string, unknown> = {}) {
  return {
    id: 'comp-001',
    tenantId: TENANT_ID,
    tipoComprobanteId: TIPO_COMPROBANTE_ID,
    periodoId: PERIODO_ID,
    numero: 1,
    fecha: new Date('2026-06-01'),
    concepto: 'Test comprobante',
    estado: 'CONTABILIZADO',
    totalDebito: new Prisma.Decimal(100000),
    totalCredito: new Prisma.Decimal(100000),
    origenTipo: null,
    origenId: null,
    origenEvento: null,
    reversaAId: null,
    usuarioId: USER_ID,
    contabilizadoAt: new Date(),
    movimientos: [
      {
        id: 'mov-001',
        linea: 1,
        cuentaId: 'cuenta-001',
        debito: new Prisma.Decimal(100000),
        credito: new Prisma.Decimal(0),
      },
      {
        id: 'mov-002',
        linea: 2,
        cuentaId: 'cuenta-002',
        debito: new Prisma.Decimal(0),
        credito: new Prisma.Decimal(100000),
      },
    ],
    ...overrides,
  };
}

// =============================================================================
// Builder
// =============================================================================

function build() {
  const mocks = {
    cuentaFindMany: jest.fn(),
    terceroFindMany: jest.fn(),
    centroCostoFindMany: jest.fn(),
    periodoFindFirst: jest.fn(),
    periodoFindUniqueOrThrow: jest.fn(),
    comprobanteFindFirst: jest.fn(),
    comprobanteCreate: jest.fn(),
    comprobanteUpdate: jest.fn(),
    movimientoFindMany: jest.fn(),
    secuenciaUpsert: jest.fn(),
  };

  const mockTx = {
    cuentaContable: {
      findMany: mocks.cuentaFindMany,
    },
    tercero: {
      findMany: mocks.terceroFindMany,
    },
    centroCosto: {
      findMany: mocks.centroCostoFindMany,
    },
    periodoContable: {
      findFirst: mocks.periodoFindFirst,
      findUniqueOrThrow: mocks.periodoFindUniqueOrThrow,
    },
    comprobanteContable: {
      findFirst: mocks.comprobanteFindFirst,
      create: mocks.comprobanteCreate,
      update: mocks.comprobanteUpdate,
    },
    movimientoContable: {
      findMany: mocks.movimientoFindMany,
    },
    secuenciaComprobante: {
      upsert: mocks.secuenciaUpsert,
    },
  };

  const tenantPrisma = {
    execute: jest.fn((cb: (tx: unknown) => unknown) => cb(mockTx)),
  };

  const audit = { log: jest.fn().mockResolvedValue(undefined) };

  const service = new LedgerService(tenantPrisma as never, audit as never);

  return { service, mocks, tenantPrisma, audit, mockTx };
}

// =============================================================================
// Suite
// =============================================================================

describe('LedgerService', () => {
  // ============================================================================
  // registrarComprobante
  // ============================================================================

  describe('registrarComprobante()', () => {
    it('crea un comprobante balanceado', async () => {
      const { service, mocks, tenantPrisma, mockTx } = build();

      mocks.periodoFindFirst.mockResolvedValue({
        id: PERIODO_ID,
        estado: 'ABIERTO',
      });
      mocks.cuentaFindMany.mockResolvedValue([
        cuenta({ id: 'cuenta-001' }),
        cuenta({ id: 'cuenta-002' }),
      ]);
      mocks.secuenciaUpsert.mockResolvedValue({ ultimoNumero: 1 });
      mocks.comprobanteCreate.mockResolvedValue(comprobanteCreado());

      const result = await service.registrarComprobante(comprobanteInput());

      expect(result.estado).toBe('CONTABILIZADO');
      expect(tenantPrisma.execute).toHaveBeenCalledTimes(1);
      expect(mocks.comprobanteCreate.mock.contexts[0]).toBe(
        mockTx.comprobanteContable,
      );
      expect(result.numero).toBe(1);
      expect(mocks.comprobanteCreate).toHaveBeenCalledTimes(1);
    });

    it('rechaza comprobante desbalanceado', async () => {
      const { service, mocks } = build();

      mocks.periodoFindFirst.mockResolvedValue({
        id: PERIODO_ID,
        estado: 'ABIERTO',
      });
      mocks.cuentaFindMany.mockResolvedValue([
        cuenta({ id: 'cuenta-001' }),
        cuenta({ id: 'cuenta-002' }),
      ]);

      await expect(
        service.registrarComprobante(
          comprobanteInput({
            lineas: [
              { cuentaId: 'cuenta-001', debito: 100000, credito: 0 },
              { cuentaId: 'cuenta-002', debito: 0, credito: 50000 },
            ],
          }),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza menos de dos líneas', async () => {
      const { service } = build();

      await expect(
        service.registrarComprobante(
          comprobanteInput({
            lineas: [{ cuentaId: 'cuenta-001', debito: 100000, credito: 0 }],
          }),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza línea con débito y crédito simultáneamente', async () => {
      const { service } = build();

      await expect(
        service.registrarComprobante(
          comprobanteInput({
            lineas: [
              { cuentaId: 'cuenta-001', debito: 100000, credito: 50000 },
              { cuentaId: 'cuenta-002', debito: 0, credito: 100000 },
            ],
          }),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza línea con ambos valores en cero', async () => {
      const { service } = build();

      await expect(
        service.registrarComprobante(
          comprobanteInput({
            lineas: [
              { cuentaId: 'cuenta-001', debito: 0, credito: 0 },
              { cuentaId: 'cuenta-002', debito: 0, credito: 0 },
            ],
          }),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza valores negativos', async () => {
      const { service } = build();

      await expect(
        service.registrarComprobante(
          comprobanteInput({
            lineas: [
              { cuentaId: 'cuenta-001', debito: -100000, credito: 0 },
              { cuentaId: 'cuenta-002', debito: 0, credito: 100000 },
            ],
          }),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza cuenta inexistente', async () => {
      const { service, mocks } = build();

      mocks.periodoFindFirst.mockResolvedValue({
        id: PERIODO_ID,
        estado: 'ABIERTO',
      });
      mocks.cuentaFindMany.mockResolvedValue([cuenta({ id: 'cuenta-002' })]); // falta cuenta-001

      await expect(
        service.registrarComprobante(comprobanteInput()),
      ).rejects.toThrow(NotFoundException);
    });

    it('rechaza cuenta inactiva', async () => {
      const { service, mocks } = build();

      mocks.periodoFindFirst.mockResolvedValue({
        id: PERIODO_ID,
        estado: 'ABIERTO',
      });
      mocks.cuentaFindMany.mockResolvedValue([
        { ...cuenta({ id: 'cuenta-001' }), activa: false },
        cuenta({ id: 'cuenta-002' }),
      ]);

      await expect(
        service.registrarComprobante(comprobanteInput()),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza cuenta no imputable', async () => {
      const { service, mocks } = build();

      mocks.periodoFindFirst.mockResolvedValue({
        id: PERIODO_ID,
        estado: 'ABIERTO',
      });
      mocks.cuentaFindMany.mockResolvedValue([
        { ...cuenta({ id: 'cuenta-001' }), imputable: false },
        cuenta({ id: 'cuenta-002' }),
      ]);

      await expect(
        service.registrarComprobante(comprobanteInput()),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza tercero inexistente', async () => {
      const { service, mocks } = build();

      mocks.periodoFindFirst.mockResolvedValue({
        id: PERIODO_ID,
        estado: 'ABIERTO',
      });
      mocks.cuentaFindMany.mockResolvedValue([
        cuenta({ id: 'cuenta-001' }),
        cuenta({ id: 'cuenta-002' }),
      ]);
      mocks.terceroFindMany.mockResolvedValue([]); // no encuentra el tercero

      await expect(
        service.registrarComprobante(
          comprobanteInput({
            lineas: [
              {
                cuentaId: 'cuenta-001',
                debito: 100000,
                credito: 0,
                terceroId: 't-fake',
              },
              { cuentaId: 'cuenta-002', debito: 0, credito: 100000 },
            ],
          }),
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('rechaza centro de costo inexistente', async () => {
      const { service, mocks } = build();

      mocks.periodoFindFirst.mockResolvedValue({
        id: PERIODO_ID,
        estado: 'ABIERTO',
      });
      mocks.cuentaFindMany.mockResolvedValue([
        cuenta({ id: 'cuenta-001' }),
        cuenta({ id: 'cuenta-002' }),
      ]);
      mocks.centroCostoFindMany.mockResolvedValue([]); // no encuentra el centro

      await expect(
        service.registrarComprobante(
          comprobanteInput({
            lineas: [
              {
                cuentaId: 'cuenta-001',
                debito: 100000,
                credito: 0,
                centroCostoId: 'cc-fake',
              },
              { cuentaId: 'cuenta-002', debito: 0, credito: 100000 },
            ],
          }),
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('rechaza período cerrado', async () => {
      const { service, mocks } = build();

      mocks.periodoFindFirst.mockResolvedValue({
        id: PERIODO_ID,
        estado: 'CERRADO',
      });

      await expect(
        service.registrarComprobante(comprobanteInput()),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza período inexistente', async () => {
      const { service, mocks } = build();

      mocks.periodoFindFirst.mockResolvedValue(null);

      await expect(
        service.registrarComprobante(comprobanteInput()),
      ).rejects.toThrow(NotFoundException);
    });

    it('rechaza comprobante duplicado (idempotencia)', async () => {
      const { service, mocks } = build();

      mocks.periodoFindFirst.mockResolvedValue({
        id: PERIODO_ID,
        estado: 'ABIERTO',
      });
      mocks.cuentaFindMany.mockResolvedValue([
        cuenta({ id: 'cuenta-001' }),
        cuenta({ id: 'cuenta-002' }),
      ]);
      mocks.comprobanteFindFirst.mockResolvedValueOnce({
        id: 'comp-existente',
        numero: 5,
      }); // idempotencia

      await expect(
        service.registrarComprobante(
          comprobanteInput({
            origenTipo: 'PAYROLL',
            origenId: 'pay-001',
            origenEvento: 'CAUSACION',
          }),
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('asigna consecutivo incremental', async () => {
      const { service, mocks } = build();

      mocks.periodoFindFirst.mockResolvedValue({
        id: PERIODO_ID,
        estado: 'ABIERTO',
      });
      mocks.cuentaFindMany.mockResolvedValue([
        cuenta({ id: 'cuenta-001' }),
        cuenta({ id: 'cuenta-002' }),
      ]);
      mocks.secuenciaUpsert.mockResolvedValue({ ultimoNumero: 42 });
      mocks.comprobanteCreate.mockResolvedValue(
        comprobanteCreado({ numero: 42 }),
      );

      const result = await service.registrarComprobante(comprobanteInput());

      expect(result.numero).toBe(42);
    });

    it('rechaza clave de origen incompleta', async () => {
      const { service } = build();

      await expect(
        service.registrarComprobante(
          comprobanteInput({
            origenTipo: 'PAYROLL',
            origenId: 'pay-001',
            // sin origenEvento
          }),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza cuenta con requiereTercero sin terceroId', async () => {
      const { service, mocks } = build();

      mocks.periodoFindFirst.mockResolvedValue({
        id: PERIODO_ID,
        estado: 'ABIERTO',
      });
      mocks.cuentaFindMany.mockResolvedValue([
        {
          ...cuenta({ id: 'cuenta-001', codigo: '250505' }),
          requiereTercero: true,
        },
        cuenta({ id: 'cuenta-002' }),
      ]);

      await expect(
        service.registrarComprobante(
          comprobanteInput({
            lineas: [
              { cuentaId: 'cuenta-001', debito: 100000, credito: 0 },
              { cuentaId: 'cuenta-002', debito: 0, credito: 100000 },
            ],
          }),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza cuenta con requiereCentroCosto sin centroCostoId', async () => {
      const { service, mocks } = build();

      mocks.periodoFindFirst.mockResolvedValue({
        id: PERIODO_ID,
        estado: 'ABIERTO',
      });
      mocks.cuentaFindMany.mockResolvedValue([
        { ...cuenta({ id: 'cuenta-001' }), requiereCentroCosto: true },
        cuenta({ id: 'cuenta-002' }),
      ]);

      await expect(
        service.registrarComprobante(
          comprobanteInput({
            lineas: [
              { cuentaId: 'cuenta-001', debito: 100000, credito: 0 },
              { cuentaId: 'cuenta-002', debito: 0, credito: 100000 },
            ],
          }),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza cuenta con requiereBase sin baseGravable', async () => {
      const { service, mocks } = build();

      mocks.periodoFindFirst.mockResolvedValue({
        id: PERIODO_ID,
        estado: 'ABIERTO',
      });
      mocks.cuentaFindMany.mockResolvedValue([
        { ...cuenta({ id: 'cuenta-001' }), requiereBase: true },
        cuenta({ id: 'cuenta-002' }),
      ]);

      await expect(
        service.registrarComprobante(
          comprobanteInput({
            lineas: [
              { cuentaId: 'cuenta-001', debito: 100000, credito: 0 },
              { cuentaId: 'cuenta-002', debito: 0, credito: 100000 },
            ],
          }),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('permite comprobante manual sin clave de origen', async () => {
      const { service, mocks } = build();

      mocks.periodoFindFirst.mockResolvedValue({
        id: PERIODO_ID,
        estado: 'ABIERTO',
      });
      mocks.cuentaFindMany.mockResolvedValue([
        cuenta({ id: 'cuenta-001' }),
        cuenta({ id: 'cuenta-002' }),
      ]);
      mocks.secuenciaUpsert.mockResolvedValue({ ultimoNumero: 1 });
      mocks.comprobanteCreate.mockResolvedValue(comprobanteCreado());

      const result = await service.registrarComprobante(comprobanteInput());

      expect(result.estado).toBe('CONTABILIZADO');
      // No debería llamar a comprobanteFindFirst (idempotencia) para origen sin clave
    });
  });

  // ============================================================================
  // anular
  // ============================================================================

  describe('anular()', () => {
    it('devuelve idempotente si ya está ANULADO', async () => {
      const { service, mocks } = build();

      mocks.comprobanteFindFirst.mockResolvedValue(
        comprobanteCreado({ estado: 'ANULADO' }),
      );

      const result = await service.anular(
        TENANT_ID,
        USER_ID,
        'comp-001',
        'error',
      );

      expect(result.estado).toBe('ANULADO');
      expect(mocks.comprobanteUpdate).not.toHaveBeenCalled();
      expect(mocks.movimientoFindMany).not.toHaveBeenCalled();
    });

    it('rechaza comprobante en BORRADOR', async () => {
      const { service, mocks } = build();

      mocks.comprobanteFindFirst.mockResolvedValue(
        comprobanteCreado({ estado: 'BORRADOR' }),
      );

      await expect(
        service.anular(TENANT_ID, USER_ID, 'comp-001', 'error'),
      ).rejects.toThrow(BadRequestException);
    });

    it('anula comprobante CONTABILIZADO con período ABIERTO', async () => {
      const { service, mocks } = build();

      mocks.comprobanteFindFirst.mockResolvedValue(
        comprobanteCreado({ estado: 'CONTABILIZADO' }),
      );
      mocks.periodoFindUniqueOrThrow.mockResolvedValue({
        id: PERIODO_ID,
        estado: 'ABIERTO',
      });
      mocks.comprobanteUpdate.mockResolvedValue(
        comprobanteCreado({ estado: 'ANULADO' }),
      );

      const result = await service.anular(
        TENANT_ID,
        USER_ID,
        'comp-001',
        'error',
      );

      expect(result.estado).toBe('ANULADO');
      expect(mocks.comprobanteUpdate).toHaveBeenCalledWith({
        where: { id: 'comp-001' },
        data: { estado: 'ANULADO' },
        include: { movimientos: { orderBy: { linea: 'asc' } } },
      });
      // No debe crear reverso
      expect(mocks.movimientoFindMany).not.toHaveBeenCalled();
    });

    it('crea reverso con período CERRADO (append-only)', async () => {
      const { service, mocks } = build();

      const original = comprobanteCreado({
        estado: 'CONTABILIZADO',
        numero: 10,
        concepto: 'Nómina enero',
      });
      mocks.comprobanteFindFirst.mockResolvedValue(original);
      mocks.periodoFindUniqueOrThrow.mockResolvedValue({
        id: PERIODO_ID,
        estado: 'CERRADO',
      });
      mocks.periodoFindFirst.mockResolvedValue({
        id: 'periodo-abierto',
        estado: 'ABIERTO',
      });

      mocks.movimientoFindMany.mockResolvedValue([
        {
          linea: 1,
          cuentaId: 'cuenta-001',
          terceroId: null,
          centroCostoId: null,
          debito: new Prisma.Decimal(100000),
          credito: new Prisma.Decimal(0),
          baseGravable: null,
          descripcion: 'Sueldos',
        },
        {
          linea: 2,
          cuentaId: 'cuenta-002',
          terceroId: null,
          centroCostoId: null,
          debito: new Prisma.Decimal(0),
          credito: new Prisma.Decimal(100000),
          baseGravable: null,
          descripcion: null,
        },
      ]);

      mocks.secuenciaUpsert.mockResolvedValue({ ultimoNumero: 11 });

      const reversoCreado = comprobanteCreado({
        id: 'comp-002',
        numero: 11,
        estado: 'CONTABILIZADO',
        reversaAId: 'comp-001',
      });
      mocks.comprobanteCreate.mockResolvedValue(reversoCreado);

      const result = await service.anular(
        TENANT_ID,
        USER_ID,
        'comp-001',
        'error detectado',
      );

      // Verifica que NO se modificó el original
      expect(mocks.comprobanteUpdate).not.toHaveBeenCalled();

      // Verifica que se creó un nuevo comprobante de reverso
      expect(result.estado).toBe('CONTABILIZADO');
      expect(result.reversaAId).toBe('comp-001');

      // Verifica débitos y créditos invertidos
      const call = mocks.comprobanteCreate.mock.calls[0][0];
      expect(call.data.totalDebito.toString()).toBe('100000');
      expect(call.data.totalCredito.toString()).toBe('100000');
      expect(call.data.movimientos.create[0].debito.toString()).toBe('0');
      expect(call.data.movimientos.create[0].credito.toString()).toBe('100000');
      expect(call.data.movimientos.create[1].debito.toString()).toBe('100000');
      expect(call.data.movimientos.create[1].credito.toString()).toBe('0');
    });

    it('rechaza comprobante inexistente', async () => {
      const { service, mocks } = build();

      mocks.comprobanteFindFirst.mockResolvedValue(null);

      await expect(
        service.anular(TENANT_ID, USER_ID, 'comp-fake', 'motivo'),
      ).rejects.toThrow(NotFoundException);
    });

    it('lleva audit en reverso', async () => {
      const { service, mocks, audit } = build();

      const original = comprobanteCreado({
        estado: 'CONTABILIZADO',
        numero: 10,
        concepto: 'Nómina enero',
      });
      mocks.comprobanteFindFirst.mockResolvedValue(original);
      mocks.periodoFindUniqueOrThrow.mockResolvedValue({
        id: PERIODO_ID,
        estado: 'CERRADO',
      });
      mocks.periodoFindFirst.mockResolvedValue({
        id: 'periodo-abierto',
        estado: 'ABIERTO',
      });
      mocks.movimientoFindMany.mockResolvedValue([
        {
          linea: 1,
          cuentaId: 'cuenta-001',
          terceroId: null,
          centroCostoId: null,
          debito: new Prisma.Decimal(100000),
          credito: new Prisma.Decimal(0),
          baseGravable: null,
          descripcion: null,
        },
        {
          linea: 2,
          cuentaId: 'cuenta-002',
          terceroId: null,
          centroCostoId: null,
          debito: new Prisma.Decimal(0),
          credito: new Prisma.Decimal(100000),
          baseGravable: null,
          descripcion: null,
        },
      ]);
      mocks.secuenciaUpsert.mockResolvedValue({ ultimoNumero: 11 });
      mocks.comprobanteCreate.mockResolvedValue(
        comprobanteCreado({
          id: 'comp-002',
          numero: 11,
          reversaAId: 'comp-001',
        }),
      );

      await service.anular(TENANT_ID, USER_ID, 'comp-001', 'error detectado');

      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'COMPROBANTE_REVERSO',
          entityType: 'ComprobanteContable',
          metadata: expect.objectContaining({
            motivo: 'error detectado',
            originalId: 'comp-001',
          }),
        }),
      );
    });
  });
});
