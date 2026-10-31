import { BadRequestException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
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
    service = new BillingService(prismaMock as unknown as PrismaService);
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
});
