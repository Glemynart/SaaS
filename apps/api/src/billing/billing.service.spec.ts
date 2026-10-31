import { BadRequestException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { BillingService } from './billing.service';

describe('BillingService', () => {
  const prismaMock = {
    customer: { findFirst: jest.fn() },
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

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.customer.findFirst.mockResolvedValue({ id: 'customer-1' });
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
