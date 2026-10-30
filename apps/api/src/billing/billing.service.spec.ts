import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BillingService } from './billing.service';

describe('BillingService', () => {
  const prismaMock = {
    customer: { findFirst: jest.fn() },
    productService: { findMany: jest.fn() },
    invoice: { create: jest.fn() },
  };

  let service: BillingService;

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.customer.findFirst.mockResolvedValue({ id: 'customer-1' });
    prismaMock.productService.findMany.mockResolvedValue([{ id: 'product-1' }]);
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
      select: { id: true },
    });
    expect(prismaMock.invoice.create).toHaveBeenCalledTimes(1);
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

  it('permite líneas manuales sin consultar productos', async () => {
    await service.createInvoice('tenant-1', {
      ...invoiceDto,
      items: [{ ...invoiceDto.items[0], productServiceId: undefined }],
    });

    expect(prismaMock.productService.findMany).not.toHaveBeenCalled();
    expect(prismaMock.invoice.create).toHaveBeenCalledTimes(1);
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
      select: { id: true },
    });
  });
});
