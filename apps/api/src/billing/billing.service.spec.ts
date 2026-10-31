import { BadRequestException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import { LedgerService } from '../accounting/ledger/ledger.service';
import { InvoiceStatus } from './dto/billing.dto';
import { BillingService } from './billing.service';

describe('BillingService', () => {
  const prismaMock = {
    customer: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    tercero: { findFirst: jest.fn() },
    productService: { findMany: jest.fn() },
    invoice: { create: jest.fn() },
  };
  const txMock = {
    invoice: { findFirst: jest.fn(), updateMany: jest.fn() },
    cuentaSistemaMap: { findMany: jest.fn() },
    periodoContable: { findFirst: jest.fn() },
    tipoComprobante: { findFirst: jest.fn() },
    comprobanteContable: { findFirst: jest.fn() },
  };
  const tenantPrismaMock = {
    execute: jest.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback(txMock),
    ),
  };
  const ledgerMock = {
    registrarComprobante: jest.fn(),
    anular: jest.fn(),
  };

  let service: BillingService;

  function createdInvoiceData() {
    type CreateData = {
      subtotal: Decimal;
      impuestos: Decimal;
      total: Decimal;
      items: {
        create: Array<{ impuestoTarifa: Decimal; impuestoValor: Decimal }>;
      };
    };
    const calls = prismaMock.invoice.create.mock.calls as unknown as Array<
      [{ data: CreateData }]
    >;
    const firstCall = calls[0];
    if (!firstCall) throw new Error('No se creó la factura esperada.');
    return firstCall[0].data;
  }

  function createdCustomerArgs() {
    type CreateArgs = {
      data: {
        tenantId: string;
        nit: string;
        terceroId: string | null;
      };
      include: { tercero: { select: Record<string, boolean> } };
    };
    const calls = prismaMock.customer.create.mock.calls as unknown as Array<
      [CreateArgs]
    >;
    const firstCall = calls[0];
    if (!firstCall) throw new Error('No se creó el cliente esperado.');
    return firstCall[0];
  }

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.customer.findFirst.mockResolvedValue({
      id: 'customer-1',
      tenantId: 'tenant-1',
      terceroId: null,
    });
    prismaMock.customer.findUnique.mockResolvedValue(null);
    prismaMock.customer.create.mockResolvedValue({ id: 'customer-created' });
    prismaMock.customer.update.mockResolvedValue({ id: 'customer-1' });
    prismaMock.tercero.findFirst.mockResolvedValue({ id: 'tercero-1' });
    prismaMock.productService.findMany.mockResolvedValue([
      { id: 'product-1', impuesto: new Decimal(19) },
    ]);
    prismaMock.invoice.create.mockResolvedValue({ id: 'invoice-1' });
    txMock.invoice.findFirst.mockResolvedValue(null);
    txMock.invoice.updateMany.mockResolvedValue({ count: 1 });
    txMock.cuentaSistemaMap.findMany.mockResolvedValue([]);
    txMock.periodoContable.findFirst.mockResolvedValue(null);
    txMock.tipoComprobante.findFirst.mockResolvedValue(null);
    txMock.comprobanteContable.findFirst.mockResolvedValue(null);
    tenantPrismaMock.execute.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) => callback(txMock),
    );
    service = new BillingService(
      prismaMock as unknown as PrismaService,
      tenantPrismaMock as unknown as TenantPrismaService,
      ledgerMock as unknown as LedgerService,
    );
  });

  const invoiceDto = {
    customerId: 'customer-1',
    numero: 'FV-001',
    items: [
      {
        productServiceId: 'product-1',
        descripcion: 'Servicio educativo',
        cantidad: 1,
        valorUnitario: 100_000,
      },
    ],
  };

  function invoiceForAccounting(status: 'DRAFT' | 'ISSUED' = 'DRAFT') {
    return {
      id: 'invoice-1',
      tenantId: 'tenant-1',
      numero: 'FV-001',
      status,
      fechaEmision: new Date('2026-10-16T04:30:00.000Z'),
      subtotal: new Decimal(100_000),
      impuestos: new Decimal(19_000),
      total: new Decimal(119_000),
      customer: {
        tercero: {
          id: 'tercero-1',
          tenantId: 'tenant-1',
          esCliente: true,
          activo: true,
          deletedAt: null,
        },
      },
      items: [
        {
          descripcion: 'Servicio educativo',
          subtotal: new Decimal(100_000),
          impuestoTarifa: new Decimal(19),
          impuestoValor: new Decimal(19_000),
        },
      ],
    };
  }

  function invoiceAccountMaps() {
    return [
      { rol: 'CLIENTES_NACIONALES', cuentaId: 'account-receivable' },
      { rol: 'INGRESOS_OPERACIONALES', cuentaId: 'account-income' },
      { rol: 'IVA_GENERADO', cuentaId: 'account-tax' },
    ];
  }

  function activeInvoiceVoucher() {
    return {
      id: 'voucher-1',
      numero: 17,
      estado: 'CONTABILIZADO',
      fecha: new Date('2026-10-15T12:00:00.000Z'),
      totalDebito: new Decimal(119_000),
      totalCredito: new Decimal(119_000),
      reversos: [],
    };
  }

  it('vincula un tercero activo con rol cliente del mismo tenant', async () => {
    await service.createCustomer('tenant-1', {
      razonSocial: 'Cliente Uno S.A.S.',
      nit: '900123456',
      terceroId: 'tercero-1',
    });

    expect(prismaMock.tercero.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'tercero-1',
        tenantId: 'tenant-1',
        esCliente: true,
        activo: true,
        deletedAt: null,
      },
      select: { id: true },
    });
    expect(createdCustomerArgs().data).toMatchObject({
      tenantId: 'tenant-1',
      nit: '900123456',
      terceroId: 'tercero-1',
    });
    expect(createdCustomerArgs().include.tercero.select).toMatchObject({
      id: true,
      tipoDocumento: true,
      numeroDocumento: true,
    });
  });

  it('does not infer a third party from a matching customer NIT', async () => {
    await service.createCustomer('tenant-1', {
      razonSocial: 'Cliente Uno S.A.S.',
      nit: '900123456',
    });

    expect(prismaMock.tercero.findFirst).not.toHaveBeenCalled();
    expect(createdCustomerArgs().data.terceroId).toBeNull();
  });

  it('rechaza vincular un tercero de otro tenant, inactivo o sin rol cliente', async () => {
    prismaMock.tercero.findFirst.mockResolvedValue(null);

    await expect(
      service.createCustomer('tenant-1', {
        razonSocial: 'Cliente Uno S.A.S.',
        nit: '900123456',
        terceroId: 'tercero-ajeno',
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'El tercero debe pertenecer a esta empresa, estar activo y tener rol de cliente.',
      ),
    );
    expect(prismaMock.customer.create).not.toHaveBeenCalled();
  });

  it('permite limpiar una vinculación existente', async () => {
    prismaMock.customer.findFirst.mockResolvedValueOnce({
      id: 'customer-1',
      tenantId: 'tenant-1',
      terceroId: 'tercero-1',
    });

    await service.updateCustomer('tenant-1', 'customer-1', { terceroId: null });

    expect(prismaMock.customer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'customer-1' },
        data: { terceroId: null },
      }),
    );
    expect(prismaMock.tercero.findFirst).not.toHaveBeenCalled();
  });

  it('permite productos activos asociados al mismo tenant', async () => {
    await service.createInvoice('tenant-1', invoiceDto);

    expect(prismaMock.productService.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        id: { in: ['product-1'] },
        activo: true,
      },
      select: { id: true, impuesto: true },
    });
    expect(prismaMock.invoice.create).toHaveBeenCalledTimes(1);
    const createData = createdInvoiceData();
    expect(createData.subtotal.toString()).toBe('100000');
    expect(createData.impuestos.toString()).toBe('19000');
    expect(createData.total.toString()).toBe('119000');
    expect(createData.items.create[0].impuestoTarifa.toString()).toBe('19');
    expect(createData.items.create[0].impuestoValor.toString()).toBe('19000');
  });

  it('rechaza productos ajenos, inexistentes o inactivos antes de crear la factura', async () => {
    prismaMock.productService.findMany.mockResolvedValue([]);

    await expect(service.createInvoice('tenant-1', invoiceDto)).rejects.toThrow(
      new BadRequestException(
        'Uno o más productos no están disponibles para esta empresa.',
      ),
    );
    expect(prismaMock.invoice.create).not.toHaveBeenCalled();
  });

  it('requiere una tasa explícita para las líneas manuales', async () => {
    await expect(
      service.createInvoice('tenant-1', {
        ...invoiceDto,
        items: [{ ...invoiceDto.items[0], productServiceId: undefined }],
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'Cada línea manual requiere una tasa configurada explícita.',
      ),
    );

    expect(prismaMock.productService.findMany).not.toHaveBeenCalled();
    expect(prismaMock.invoice.create).not.toHaveBeenCalled();
  });

  it('rechaza null como tasa manual explícita', async () => {
    await expect(
      service.createInvoice('tenant-1', {
        ...invoiceDto,
        items: [
          {
            ...invoiceDto.items[0],
            productServiceId: undefined,
            impuesto: null as unknown as number,
          },
        ],
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'Cada línea manual requiere una tasa configurada explícita.',
      ),
    );
    expect(prismaMock.invoice.create).not.toHaveBeenCalled();
  });

  it('guarda la tasa manual y redondea el impuesto de cada línea a COP', async () => {
    await service.createInvoice('tenant-1', {
      ...invoiceDto,
      items: [
        {
          ...invoiceDto.items[0],
          productServiceId: undefined,
          cantidad: 1,
          valorUnitario: 0.05,
          impuesto: 10,
        },
      ],
    });

    expect(prismaMock.productService.findMany).not.toHaveBeenCalled();
    expect(prismaMock.invoice.create).toHaveBeenCalledTimes(1);
    const createData = createdInvoiceData();
    expect(createData.subtotal.toString()).toBe('0.05');
    expect(createData.impuestos.toString()).toBe('0.01');
    expect(createData.total.toString()).toBe('0.06');
    expect(createData.items.create[0].impuestoTarifa.toString()).toBe('10');
    expect(createData.items.create[0].impuestoValor.toString()).toBe('0.01');
  });

  it('consulta una sola vez cada producto incluso si aparece en varias líneas', async () => {
    await service.createInvoice('tenant-1', {
      ...invoiceDto,
      items: [invoiceDto.items[0], { ...invoiceDto.items[0] }],
    });

    expect(prismaMock.productService.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        id: { in: ['product-1'] },
        activo: true,
      },
      select: { id: true, impuesto: true },
    });
  });

  it('rechaza una tasa manual superior a 100%', async () => {
    await expect(
      service.createInvoice('tenant-1', {
        ...invoiceDto,
        items: [
          {
            ...invoiceDto.items[0],
            productServiceId: undefined,
            impuesto: 100.01,
          },
        ],
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'La tasa de cada línea debe estar entre 0 y 100% con máximo dos decimales.',
      ),
    );
    expect(prismaMock.invoice.create).not.toHaveBeenCalled();
  });

  it('rechaza tasas que no caben en la escala de dos decimales', async () => {
    await expect(
      service.createInvoice('tenant-1', {
        ...invoiceDto,
        items: [
          {
            ...invoiceDto.items[0],
            productServiceId: undefined,
            impuesto: 1.005,
          },
        ],
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'La tasa de cada línea debe estar entre 0 y 100% con máximo dos decimales.',
      ),
    );
    expect(prismaMock.invoice.create).not.toHaveBeenCalled();
  });

  it('emite y contabiliza en la misma transacción con clave de origen estable', async () => {
    txMock.invoice.findFirst.mockResolvedValue(invoiceForAccounting());
    txMock.cuentaSistemaMap.findMany.mockResolvedValue(invoiceAccountMaps());
    txMock.periodoContable.findFirst.mockResolvedValue({ id: 'period-1' });
    txMock.tipoComprobante.findFirst.mockResolvedValue({ id: 'type-fv' });
    ledgerMock.registrarComprobante.mockResolvedValue(activeInvoiceVoucher());

    const result = await service.updateInvoiceStatus(
      'tenant-1',
      'user-1',
      'invoice-1',
      { status: InvoiceStatus.ISSUED },
    );

    expect(txMock.invoice.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'invoice-1', tenantId: 'tenant-1' },
      }),
    );
    expect(txMock.invoice.updateMany).toHaveBeenCalledWith({
      where: { id: 'invoice-1', tenantId: 'tenant-1', status: 'DRAFT' },
      data: { status: 'ISSUED' },
    });
    const [input, client] = ledgerMock.registrarComprobante.mock.calls[0] as [
      {
        userId: string;
        origenTipo: string;
        origenId: string;
        origenEvento: string;
        fecha: Date;
      },
      unknown,
    ];
    expect(input).toMatchObject({
      tenantId: 'tenant-1',
      userId: 'user-1',
      tipoComprobanteId: 'type-fv',
      periodoId: 'period-1',
      origenTipo: 'BILLING_INVOICE',
      origenId: 'invoice-1',
      origenEvento: 'ISSUED',
    });
    expect(input.fecha.toISOString()).toBe('2026-10-15T00:00:00.000Z');
    const periodCalls = txMock.periodoContable.findFirst.mock
      .calls as unknown as Array<
      [
        {
          where: {
            fechaInicio: { lte: Date };
            fechaFin: { gte: Date };
          };
        },
      ]
    >;
    const periodCall = periodCalls[0];
    if (!periodCall) throw new Error('No se consultó el período contable.');
    expect(periodCall[0].where.fechaInicio.lte.toISOString()).toBe(
      '2026-10-15T00:00:00.000Z',
    );
    expect(periodCall[0].where.fechaFin.gte.toISOString()).toBe(
      '2026-10-15T00:00:00.000Z',
    );
    expect(client).toBe(txMock);
    expect(result).toMatchObject({
      status: 'ISSUED',
      comprobanteContable: { id: 'voucher-1', numero: 17 },
    });
  });

  it('requires an open accounting period before changing a draft invoice', async () => {
    txMock.invoice.findFirst.mockResolvedValue(invoiceForAccounting());
    txMock.cuentaSistemaMap.findMany.mockResolvedValue(invoiceAccountMaps());

    await expect(
      service.updateInvoiceStatus('tenant-1', 'user-1', 'invoice-1', {
        status: InvoiceStatus.ISSUED,
      }),
    ).rejects.toThrow('No existe un período contable abierto');

    expect(txMock.invoice.updateMany).not.toHaveBeenCalled();
    expect(ledgerMock.registrarComprobante).not.toHaveBeenCalled();
  });

  it('does not auto-post an issued historical invoice without a voucher', async () => {
    txMock.invoice.findFirst.mockResolvedValue(invoiceForAccounting('ISSUED'));

    await expect(
      service.updateInvoiceStatus('tenant-1', 'user-1', 'invoice-1', {
        status: InvoiceStatus.ISSUED,
      }),
    ).rejects.toThrow('no tiene un comprobante vigente asociado');

    expect(ledgerMock.registrarComprobante).not.toHaveBeenCalled();
  });

  it('returns the existing voucher idempotently when an issued invoice is retried', async () => {
    txMock.invoice.findFirst.mockResolvedValue(invoiceForAccounting('ISSUED'));
    txMock.comprobanteContable.findFirst.mockResolvedValue(
      activeInvoiceVoucher(),
    );

    const result = await service.updateInvoiceStatus(
      'tenant-1',
      'user-1',
      'invoice-1',
      { status: InvoiceStatus.ISSUED },
    );

    expect(result).toMatchObject({
      status: 'ISSUED',
      comprobanteContable: { id: 'voucher-1', estado: 'CONTABILIZADO' },
    });
    expect(txMock.invoice.updateMany).not.toHaveBeenCalled();
    expect(ledgerMock.registrarComprobante).not.toHaveBeenCalled();
  });

  it('reverses an issued invoice with a reason inside its tenant transaction', async () => {
    txMock.invoice.findFirst.mockResolvedValue(invoiceForAccounting('ISSUED'));
    txMock.comprobanteContable.findFirst.mockResolvedValue(
      activeInvoiceVoucher(),
    );
    ledgerMock.anular.mockResolvedValue({
      id: 'voucher-1',
      numero: 17,
      estado: 'ANULADO',
      fecha: new Date('2026-10-15T12:00:00.000Z'),
      totalDebito: new Decimal(119_000),
      totalCredito: new Decimal(119_000),
    });

    const result = await service.updateInvoiceStatus(
      'tenant-1',
      'user-1',
      'invoice-1',
      { status: InvoiceStatus.CANCELLED, motivo: 'Error en los datos' },
    );

    expect(ledgerMock.anular).toHaveBeenCalledWith(
      'tenant-1',
      'user-1',
      'voucher-1',
      'Error en los datos',
      txMock,
    );
    expect(txMock.invoice.updateMany).toHaveBeenCalledWith({
      where: { id: 'invoice-1', tenantId: 'tenant-1', status: 'ISSUED' },
      data: { status: 'CANCELLED' },
    });
    expect(result).toMatchObject({
      status: 'CANCELLED',
      comprobanteAnulacion: { id: 'voucher-1', estado: 'ANULADO' },
    });
  });

  it('does not allow an issued invoice to return to draft', async () => {
    txMock.invoice.findFirst.mockResolvedValue(invoiceForAccounting('ISSUED'));

    await expect(
      service.updateInvoiceStatus('tenant-1', 'user-1', 'invoice-1', {
        status: InvoiceStatus.DRAFT,
      }),
    ).rejects.toThrow('no puede volver a borrador');
    expect(txMock.invoice.updateMany).not.toHaveBeenCalled();
  });

  it('returns the prior cancellation when a request is retried', async () => {
    txMock.invoice.findFirst.mockResolvedValue({
      ...invoiceForAccounting(),
      status: 'CANCELLED',
    });
    txMock.comprobanteContable.findFirst.mockResolvedValue({
      ...activeInvoiceVoucher(),
      estado: 'CONTABILIZADO',
      reversos: [
        {
          id: 'voucher-reversal-1',
          numero: 18,
          estado: 'CONTABILIZADO',
          totalDebito: new Decimal(119_000),
          totalCredito: new Decimal(119_000),
        },
      ],
    });

    const result = await service.updateInvoiceStatus(
      'tenant-1',
      'user-1',
      'invoice-1',
      { status: InvoiceStatus.CANCELLED, motivo: 'Reintento de red' },
    );

    expect(result).toMatchObject({
      status: 'CANCELLED',
      comprobanteAnulacion: { id: 'voucher-reversal-1', numero: 18 },
    });
    expect(ledgerMock.anular).not.toHaveBeenCalled();
    expect(txMock.invoice.updateMany).not.toHaveBeenCalled();
  });
});
