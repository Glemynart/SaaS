import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateCustomerDto,
  UpdateCustomerDto,
  CreateProductDto,
  UpdateProductDto,
  CreateInvoiceDto,
  UpdateInvoiceStatusDto,
} from './dto/billing.dto';

function roundCop(value: Decimal): Decimal {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

@Injectable()
export class BillingService {
  constructor(private prisma: PrismaService) {}

  // --- CUSTOMERS ---
  async createCustomer(tenantId: string, dto: CreateCustomerDto) {
    const exists = await this.prisma.customer.findUnique({
      where: { tenantId_nit: { tenantId, nit: dto.nit } },
    });
    if (exists)
      throw new BadRequestException('Ya existe un cliente con este NIT');
    return this.prisma.customer.create({ data: { ...dto, tenantId } });
  }

  async findAllCustomers(tenantId: string, search?: string) {
    return this.prisma.customer.findMany({
      where: {
        tenantId,
        ...(search
          ? {
              OR: [
                { razonSocial: { contains: search, mode: 'insensitive' } },
                { nit: { contains: search } },
              ],
            }
          : {}),
      },
      orderBy: { razonSocial: 'asc' },
    });
  }

  async findOneCustomer(tenantId: string, id: string) {
    const c = await this.prisma.customer.findFirst({ where: { id, tenantId } });
    if (!c) throw new NotFoundException('Cliente no encontrado');
    return c;
  }

  async updateCustomer(tenantId: string, id: string, dto: UpdateCustomerDto) {
    await this.findOneCustomer(tenantId, id);
    return this.prisma.customer.update({ where: { id }, data: dto });
  }

  async removeCustomer(tenantId: string, id: string) {
    await this.findOneCustomer(tenantId, id);
    return this.prisma.customer.delete({ where: { id } });
  }

  // --- PRODUCTS ---
  async createProduct(tenantId: string, dto: CreateProductDto) {
    return this.prisma.productService.create({ data: { ...dto, tenantId } });
  }

  async findAllProducts(tenantId: string, search?: string) {
    return this.prisma.productService.findMany({
      where: {
        tenantId,
        activo: true,
        ...(search
          ? { nombre: { contains: search, mode: 'insensitive' } }
          : {}),
      },
      orderBy: { nombre: 'asc' },
    });
  }

  async findOneProduct(tenantId: string, id: string) {
    const p = await this.prisma.productService.findFirst({
      where: { id, tenantId },
    });
    if (!p) throw new NotFoundException('Producto no encontrado');
    return p;
  }

  async updateProduct(tenantId: string, id: string, dto: UpdateProductDto) {
    await this.findOneProduct(tenantId, id);
    return this.prisma.productService.update({ where: { id }, data: dto });
  }

  // --- INVOICES ---
  async createInvoice(tenantId: string, dto: CreateInvoiceDto) {
    void (await this.findOneCustomer(tenantId, dto.customerId));
    const productRates = await this.validateInvoiceProducts(
      tenantId,
      dto.items,
    );

    const items = dto.items.map((item) => {
      const manualRate = item.impuesto as number | null | undefined;
      const configuredRate = item.productServiceId
        ? productRates.get(item.productServiceId)
        : undefined;
      if (item.productServiceId && configuredRate === undefined) {
        throw new BadRequestException(
          'Uno o más productos no están disponibles para esta empresa.',
        );
      }
      if (
        !item.productServiceId &&
        (manualRate === undefined || manualRate === null)
      ) {
        throw new BadRequestException(
          'Cada línea manual requiere una tasa configurada explícita.',
        );
      }

      let impuestoTarifa: Decimal;
      if (configuredRate !== undefined) {
        impuestoTarifa = configuredRate;
      } else if (manualRate !== undefined && manualRate !== null) {
        impuestoTarifa = new Decimal(manualRate.toString());
      } else {
        throw new BadRequestException(
          'Cada línea manual requiere una tasa configurada explícita.',
        );
      }
      if (
        !impuestoTarifa.isFinite() ||
        impuestoTarifa.isNegative() ||
        impuestoTarifa.greaterThan(100) ||
        impuestoTarifa.decimalPlaces() > 2
      ) {
        throw new BadRequestException(
          'La tasa de cada línea debe estar entre 0 y 100% con máximo dos decimales.',
        );
      }

      const base = roundCop(
        new Decimal(item.cantidad.toString()).mul(
          new Decimal(item.valorUnitario.toString()),
        ),
      );
      const impuestoValor = roundCop(base.mul(impuestoTarifa).div(100));

      return {
        productServiceId: item.productServiceId ?? null,
        descripcion: item.descripcion,
        cantidad: item.cantidad,
        valorUnitario: item.valorUnitario,
        subtotal: base,
        impuestoTarifa,
        impuestoValor,
      };
    });

    const subtotal = items.reduce(
      (sum, item) => sum.plus(item.subtotal),
      new Decimal(0),
    );
    const impuestos = items.reduce(
      (sum, item) => sum.plus(item.impuestoValor),
      new Decimal(0),
    );
    const total = subtotal.plus(impuestos);

    return this.prisma.invoice.create({
      data: {
        tenantId,
        customerId: dto.customerId,
        numero: dto.numero,
        subtotal,
        impuestos,
        total,
        items: { create: items },
      },
      include: {
        items: true,
        customer: { select: { razonSocial: true, nit: true } },
      },
    });
  }

  async findAllInvoices(tenantId: string, status?: string) {
    return this.prisma.invoice.findMany({
      where: {
        tenantId,
        ...(status
          ? { status: status as 'DRAFT' | 'ISSUED' | 'CANCELLED' }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { razonSocial: true, nit: true } },
        _count: { select: { items: true } },
      },
    });
  }

  async findOneInvoice(tenantId: string, id: string) {
    const inv = await this.prisma.invoice.findFirst({
      where: { id, tenantId },
      include: { items: true, customer: true },
    });
    if (!inv) throw new NotFoundException('Factura no encontrada');
    return inv;
  }

  async updateInvoiceStatus(
    tenantId: string,
    id: string,
    dto: UpdateInvoiceStatusDto,
  ) {
    const inv = await this.findOneInvoice(tenantId, id);
    if (inv.status === 'CANCELLED')
      throw new BadRequestException(
        'No se puede modificar una factura cancelada',
      );
    return this.prisma.invoice.update({
      where: { id },
      data: { status: dto.status },
    });
  }

  // --- DASHBOARD ---
  async getDashboard(tenantId: string) {
    const [activeCustomers, invoiceCounts] = await Promise.all([
      this.prisma.customer.count({ where: { tenantId, status: 'ACTIVE' } }),
      this.prisma.invoice.groupBy({
        by: ['status'],
        where: { tenantId },
        _sum: { total: true },
        _count: true,
      }),
    ]);

    const issued = invoiceCounts.filter((i) => i.status === 'ISSUED');
    const draft = invoiceCounts.filter((i) => i.status === 'DRAFT');

    return {
      clientesActivos: activeCustomers,
      facturasEmitidas: issued.reduce((s, i) => s + i._count, 0),
      facturasBorrador: draft.reduce((s, i) => s + i._count, 0),
      ingresosEstimados: issued.reduce(
        (s, i) => s + Number(i._sum.total ?? 0),
        0,
      ),
      totalFacturado: issued.reduce((s, i) => s + Number(i._sum.total ?? 0), 0),
    };
  }

  private async validateInvoiceProducts(
    tenantId: string,
    items: CreateInvoiceDto['items'],
  ): Promise<Map<string, Decimal>> {
    const productIds = [
      ...new Set(
        items
          .map((item) => item.productServiceId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    if (productIds.length === 0) return new Map();

    const products = await this.prisma.productService.findMany({
      where: { tenantId, id: { in: productIds }, activo: true },
      select: { id: true, impuesto: true },
    });
    if (products.length !== productIds.length) {
      throw new BadRequestException(
        'Uno o más productos no están disponibles para esta empresa.',
      );
    }

    return new Map(products.map((product) => [product.id, product.impuesto]));
  }
}
