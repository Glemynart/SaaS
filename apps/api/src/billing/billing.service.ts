import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InvoiceStatus as PrismaInvoiceStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import {
  TenantPrismaService,
  type TenantPrismaClient,
} from '../tenant-prisma/tenant-prisma.service';
import { LedgerService } from '../accounting/ledger/ledger.service';
import {
  CreateCustomerDto,
  UpdateCustomerDto,
  CreateProductDto,
  UpdateProductDto,
  CreateInvoiceDto,
  InvoiceStatus as BillingInvoiceStatus,
  UpdateInvoiceStatusDto,
} from './dto/billing.dto';
import {
  buildInvoiceAccountingLines,
  INVOICE_ACCOUNTING_REQUIRED_ROLES,
  type InvoiceSystemAccounts,
} from './accounting/invoice-accounting.mapper';

function roundCop(value: Decimal): Decimal {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

function invoiceCalendarDateInColombia(value: Date): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const part = (type: 'year' | 'month' | 'day') =>
    Number(parts.find((entry) => entry.type === type)?.value);
  return new Date(Date.UTC(part('year'), part('month') - 1, part('day')));
}

@Injectable()
export class BillingService {
  constructor(
    private prisma: PrismaService,
    private readonly tenantPrisma: TenantPrismaService,
    private readonly ledger: LedgerService,
  ) {}

  // --- CUSTOMERS ---
  async createCustomer(tenantId: string, dto: CreateCustomerDto) {
    const exists = await this.prisma.customer.findUnique({
      where: { tenantId_nit: { tenantId, nit: dto.nit } },
    });
    if (exists)
      throw new BadRequestException('Ya existe un cliente con este NIT');
    if (dto.terceroId !== undefined && dto.terceroId !== null) {
      await this.ensureCustomerThirdParty(tenantId, dto.terceroId);
    }
    return this.prisma.customer.create({
      data: { ...dto, terceroId: dto.terceroId ?? null, tenantId },
      include: { tercero: { select: this.customerThirdPartySelect } },
    });
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
      include: { tercero: { select: this.customerThirdPartySelect } },
    });
  }

  async findOneCustomer(tenantId: string, id: string) {
    const c = await this.prisma.customer.findFirst({ where: { id, tenantId } });
    if (!c) throw new NotFoundException('Cliente no encontrado');
    return c;
  }

  async updateCustomer(tenantId: string, id: string, dto: UpdateCustomerDto) {
    const current = await this.findOneCustomer(tenantId, id);
    if (
      dto.terceroId !== undefined &&
      dto.terceroId !== null &&
      dto.terceroId !== current.terceroId
    ) {
      await this.ensureCustomerThirdParty(tenantId, dto.terceroId);
    }
    return this.prisma.customer.update({
      where: { id },
      data: dto,
      include: { tercero: { select: this.customerThirdPartySelect } },
    });
  }

  private readonly customerThirdPartySelect = {
    id: true,
    tipoDocumento: true,
    numeroDocumento: true,
    razonSocial: true,
    primerNombre: true,
    primerApellido: true,
    nombreComercial: true,
    esCliente: true,
    activo: true,
    deletedAt: true,
  } as const;

  private async ensureCustomerThirdParty(tenantId: string, terceroId: string) {
    const tercero = await this.prisma.tercero.findFirst({
      where: {
        id: terceroId,
        tenantId,
        esCliente: true,
        activo: true,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!tercero) {
      throw new BadRequestException(
        'El tercero debe pertenecer a esta empresa, estar activo y tener rol de cliente.',
      );
    }
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
    return this.tenantPrisma.execute(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id, tenantId },
        include: { items: true, customer: true },
      });
      if (!invoice) throw new NotFoundException('Factura no encontrada');

      const comprobanteContable = await this.findInvoiceVoucher(
        tx,
        tenantId,
        id,
      );
      return { ...invoice, comprobanteContable };
    });
  }

  async updateInvoiceStatus(
    tenantId: string,
    userId: string,
    id: string,
    dto: UpdateInvoiceStatusDto,
  ) {
    return this.tenantPrisma.execute(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id, tenantId },
        include: {
          items: true,
          customer: { include: { tercero: true } },
        },
      });
      if (!invoice) throw new NotFoundException('Factura no encontrada');

      const existingVoucher = await this.findInvoiceVoucher(tx, tenantId, id);
      const motivo = dto.motivo?.trim() ?? '';
      if (dto.status === BillingInvoiceStatus.CANCELLED && !motivo) {
        throw new BadRequestException(
          'Indica el motivo de cancelación de la factura.',
        );
      }
      if (invoice.status === PrismaInvoiceStatus.CANCELLED) {
        if (dto.status === BillingInvoiceStatus.CANCELLED) {
          const cancellationVoucher =
            existingVoucher?.estado === 'ANULADO'
              ? existingVoucher
              : (existingVoucher?.reversos[0] ?? null);
          return {
            ...invoice,
            comprobanteContable: existingVoucher,
            comprobanteAnulacion: cancellationVoucher,
          };
        }
        throw new BadRequestException(
          'No se puede modificar una factura cancelada.',
        );
      }

      if (dto.status === BillingInvoiceStatus.DRAFT) {
        if (invoice.status !== PrismaInvoiceStatus.DRAFT) {
          throw new BadRequestException(
            'Una factura emitida no puede volver a borrador.',
          );
        }
        if (existingVoucher) {
          throw new ConflictException(
            'Existe un comprobante para esta factura en borrador; requiere revisión contable.',
          );
        }
        return { ...invoice, comprobanteContable: null };
      }

      if (
        dto.status === BillingInvoiceStatus.ISSUED &&
        invoice.status === PrismaInvoiceStatus.ISSUED
      ) {
        if (
          !existingVoucher ||
          existingVoucher.estado !== 'CONTABILIZADO' ||
          existingVoucher.reversos.length > 0
        ) {
          throw new ConflictException(
            'La factura ya está emitida, pero no tiene un comprobante vigente asociado. Requiere revisión contable.',
          );
        }
        return { ...invoice, comprobanteContable: existingVoucher };
      }

      if (dto.status === BillingInvoiceStatus.ISSUED) {
        if (existingVoucher) {
          throw new ConflictException(
            'Ya existe un comprobante contable para esta factura; requiere revisión antes de emitir.',
          );
        }
        const tercero = invoice.customer.tercero;
        if (
          !tercero ||
          tercero.tenantId !== tenantId ||
          !tercero.esCliente ||
          !tercero.activo ||
          tercero.deletedAt
        ) {
          throw new BadRequestException(
            'Asocia un tercero contable activo con rol de cliente antes de emitir la factura.',
          );
        }

        const fechaContable = invoiceCalendarDateInColombia(
          invoice.fechaEmision,
        );
        const [maps, periodo, voucherType] = await Promise.all([
          tx.cuentaSistemaMap.findMany({
            where: {
              tenantId,
              activo: true,
              rol: { in: [...INVOICE_ACCOUNTING_REQUIRED_ROLES] },
            },
            select: { rol: true, cuentaId: true },
          }),
          tx.periodoContable.findFirst({
            where: {
              tenantId,
              estado: 'ABIERTO',
              fechaInicio: { lte: fechaContable },
              fechaFin: { gte: fechaContable },
            },
            select: { id: true },
          }),
          tx.tipoComprobante.findFirst({
            where: { codigo: 'FV', activo: true },
            select: { id: true },
          }),
        ]);

        const mapByRole = new Map(maps.map((map) => [map.rol, map.cuentaId]));
        const missingRoles = INVOICE_ACCOUNTING_REQUIRED_ROLES.filter(
          (role) => !mapByRole.has(role),
        );
        if (missingRoles.length > 0) {
          throw new ConflictException(
            `Faltan mapeos contables activos: ${missingRoles.join(', ')}. Configúralos antes de emitir.`,
          );
        }
        const configuredAccountIds = new Set(
          INVOICE_ACCOUNTING_REQUIRED_ROLES.map((role) => mapByRole.get(role)),
        );
        if (
          configuredAccountIds.size !== INVOICE_ACCOUNTING_REQUIRED_ROLES.length
        ) {
          throw new ConflictException(
            'Los mapeos de clientes, ingresos e impuestos deben usar cuentas contables distintas.',
          );
        }
        if (!periodo) {
          throw new ConflictException(
            'No existe un período contable abierto que incluya la fecha de emisión de esta factura.',
          );
        }
        if (!voucherType) {
          throw new ConflictException(
            'No está disponible el tipo de comprobante FV para contabilizar la factura.',
          );
        }

        const accounts = Object.fromEntries(
          INVOICE_ACCOUNTING_REQUIRED_ROLES.map((role) => [
            role,
            mapByRole.get(role)!,
          ]),
        ) as InvoiceSystemAccounts;
        const lines = buildInvoiceAccountingLines(
          {
            numero: invoice.numero,
            subtotal: invoice.subtotal,
            impuestos: invoice.impuestos,
            total: invoice.total,
            terceroId: tercero.id,
            items: invoice.items,
          },
          accounts,
        );

        const claimed = await tx.invoice.updateMany({
          where: { id, tenantId, status: 'DRAFT' },
          data: { status: 'ISSUED' },
        });
        if (claimed.count !== 1) {
          throw new ConflictException(
            'La factura cambió mientras se procesaba. Actualiza la página e inténtalo de nuevo.',
          );
        }

        const comprobante = await this.ledger.registrarComprobante(
          {
            tenantId,
            userId,
            tipoComprobanteId: voucherType.id,
            periodoId: periodo.id,
            fecha: fechaContable,
            concepto: `Factura interna ${invoice.numero}`,
            lineas: lines,
            origenTipo: 'BILLING_INVOICE',
            origenId: invoice.id,
            origenEvento: 'ISSUED',
          },
          tx,
        );

        return {
          ...invoice,
          status: 'ISSUED' as const,
          comprobanteContable: this.summarizeVoucher(comprobante),
        };
      }

      if (dto.status === BillingInvoiceStatus.CANCELLED) {
        if (invoice.status === PrismaInvoiceStatus.ISSUED) {
          if (
            !existingVoucher ||
            existingVoucher.estado !== 'CONTABILIZADO' ||
            existingVoucher.reversos.length > 0
          ) {
            throw new ConflictException(
              'No se puede cancelar esta factura porque no tiene un comprobante contable vigente asociado. Requiere revisión.',
            );
          }
          const changed = await tx.invoice.updateMany({
            where: { id, tenantId, status: 'ISSUED' },
            data: { status: 'CANCELLED' },
          });
          if (changed.count !== 1) {
            throw new ConflictException(
              'La factura cambió mientras se procesaba. Actualiza la página e inténtalo de nuevo.',
            );
          }
          const anulacion = await this.ledger.anular(
            tenantId,
            userId,
            existingVoucher.id,
            motivo,
            tx,
          );
          return {
            ...invoice,
            status: 'CANCELLED' as const,
            comprobanteContable:
              anulacion.id === existingVoucher.id &&
              anulacion.estado === 'ANULADO'
                ? this.summarizeVoucher(anulacion)
                : existingVoucher,
            comprobanteAnulacion: this.summarizeVoucher(anulacion),
          };
        }

        if (existingVoucher) {
          throw new ConflictException(
            'Existe un comprobante contable asociado a un borrador; requiere revisión antes de cancelarlo.',
          );
        }
        const changed = await tx.invoice.updateMany({
          where: { id, tenantId, status: 'DRAFT' },
          data: { status: 'CANCELLED' },
        });
        if (changed.count !== 1) {
          throw new ConflictException(
            'La factura cambió mientras se procesaba. Actualiza la página e inténtalo de nuevo.',
          );
        }
        return {
          ...invoice,
          status: 'CANCELLED' as const,
          comprobanteContable: null,
          comprobanteAnulacion: null,
        };
      }

      throw new BadRequestException(
        'Transición de estado de factura no soportada.',
      );
    });
  }

  private async findInvoiceVoucher(
    tx: TenantPrismaClient,
    tenantId: string,
    invoiceId: string,
  ) {
    return tx.comprobanteContable.findFirst({
      where: {
        tenantId,
        origenTipo: 'BILLING_INVOICE',
        origenId: invoiceId,
        origenEvento: 'ISSUED',
      },
      select: {
        id: true,
        numero: true,
        estado: true,
        fecha: true,
        totalDebito: true,
        totalCredito: true,
        reversos: {
          where: { tenantId },
          select: {
            id: true,
            numero: true,
            estado: true,
            totalDebito: true,
            totalCredito: true,
          },
        },
      },
    });
  }

  private summarizeVoucher(voucher: {
    id: string;
    numero: number | null;
    estado: string;
    fecha?: Date;
    totalDebito: unknown;
    totalCredito: unknown;
  }) {
    return {
      id: voucher.id,
      numero: voucher.numero,
      estado: voucher.estado,
      fecha: voucher.fecha,
      totalDebito: voucher.totalDebito,
      totalCredito: voucher.totalCredito,
    };
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
