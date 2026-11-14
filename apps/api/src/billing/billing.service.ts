import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Prisma, TipoDocIdentidad } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import type { TenantPrismaClient } from '../tenant-prisma/tenant-prisma.service';
import { LedgerService } from '../accounting/ledger/ledger.service';
import type { LineaComprobanteInput } from '../accounting/ledger/ledger.types';
import { AuditService } from '../audit/audit.service';
import {
  CreateCustomerDto,
  UpdateCustomerDto,
  CreateProductDto,
  UpdateProductDto,
  CreateInvoiceDto,
  UpdateInvoiceStatusDto,
} from './dto/billing.dto';
import { getActiveReceiptAppliedAmounts } from './customer-receipt-balance';

const BILLING_INVOICE_ORIGIN = {
  type: 'BILLING_INVOICE',
  event: 'ISSUED',
} as const;
const BILLING_ACCOUNT_ROLES = [
  'CLIENTES_NACIONALES',
  'INGRESOS_OPERACIONALES',
  'IVA_GENERADO',
] as const;
const SUPPORTED_IVA_RATES = new Set([0, 5, 19]);
const COP_ROUNDING = Prisma.Decimal.ROUND_HALF_UP;
const BILLING_TIME_ZONE = 'America/Bogota';

function businessCalendarDate(date: Date): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BILLING_TIME_ZONE,
    calendar: 'gregory',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type: 'year' | 'month' | 'day') =>
    Number(parts.find((value) => value.type === type)?.value);
  return new Date(Date.UTC(part('year'), part('month') - 1, part('day')));
}

function parseDateOnly(value: string, label: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BadRequestException(`${label} debe usar AAAA-MM-DD.`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw new BadRequestException(`${label} no es válida.`);
  }
  return parsed;
}

@Injectable()
export class BillingService {
  constructor(
    private prisma: PrismaService,
    private tenantPrisma: TenantPrismaService,
    private ledger: LedgerService,
    private audit: AuditService,
  ) {}

  // --- CUSTOMERS ---
  async createCustomer(tenantId: string, dto: CreateCustomerDto) {
    const exists = await this.prisma.customer.findUnique({
      where: { tenantId_nit: { tenantId, nit: dto.nit } },
    });
    if (exists)
      throw new BadRequestException('Ya existe un cliente con este NIT');
    if (dto.terceroId) {
      await this.validateCustomerThirdParty(tenantId, dto.nit, dto.terceroId);
    }
    return this.prisma.customer.create({
      data: { ...dto, terceroId: dto.terceroId || null, tenantId },
      include: {
        tercero: {
          select: { id: true, razonSocial: true, numeroDocumento: true },
        },
      },
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
      include: {
        tercero: {
          select: { id: true, razonSocial: true, numeroDocumento: true },
        },
      },
    });
  }

  async findOneCustomer(tenantId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, tenantId },
      include: {
        tercero: {
          select: { id: true, razonSocial: true, numeroDocumento: true },
        },
      },
    });
    if (!customer) throw new NotFoundException('Cliente no encontrado');
    return customer;
  }

  async updateCustomer(tenantId: string, id: string, dto: UpdateCustomerDto) {
    const current = await this.findOneCustomer(tenantId, id);
    const nit = dto.nit ?? current.nit;
    const terceroId =
      dto.terceroId === undefined ? current.terceroId : dto.terceroId;
    if (terceroId) {
      await this.validateCustomerThirdParty(
        tenantId,
        nit,
        terceroId,
        this.prisma,
        id,
      );
    }
    return this.prisma.customer.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.terceroId !== undefined && {
          terceroId: dto.terceroId || null,
        }),
      },
      include: {
        tercero: {
          select: { id: true, razonSocial: true, numeroDocumento: true },
        },
      },
    });
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
    const product = await this.prisma.productService.findFirst({
      where: { id, tenantId },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');
    return product;
  }

  async updateProduct(tenantId: string, id: string, dto: UpdateProductDto) {
    await this.findOneProduct(tenantId, id);
    return this.prisma.productService.update({ where: { id }, data: dto });
  }

  // --- INVOICES ---
  async createInvoice(tenantId: string, dto: CreateInvoiceDto) {
    const fechaVencimiento = parseDateOnly(
      dto.fechaVencimiento,
      'La fecha de vencimiento',
    );
    if (dto.items.length === 0) {
      throw new BadRequestException(
        'La factura debe tener al menos una línea.',
      );
    }
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, tenantId, status: 'ACTIVE' },
    });
    if (!customer) throw new NotFoundException('Cliente activo no encontrado');

    const productRates = await this.validateInvoiceProducts(
      tenantId,
      dto.items,
    );
    const items = dto.items.map((item) => {
      const rate = item.productServiceId
        ? productRates.get(item.productServiceId)
        : new Prisma.Decimal(item.porcentajeImpuesto);
      if (!rate) {
        throw new BadRequestException(
          'No se pudo determinar la tasa de IVA del producto.',
        );
      }
      const porcentajeImpuesto = new Prisma.Decimal(rate);
      if (!SUPPORTED_IVA_RATES.has(porcentajeImpuesto.toNumber())) {
        throw new BadRequestException(
          `La tasa ${porcentajeImpuesto.toString()}% no está soportada para facturas internas. Use 0%, 5% o 19%.`,
        );
      }
      const subtotal = new Prisma.Decimal(item.cantidad)
        .mul(item.valorUnitario)
        .toDecimalPlaces(2, COP_ROUNDING);
      const valorImpuesto = subtotal
        .mul(porcentajeImpuesto)
        .div(100)
        .toDecimalPlaces(2, COP_ROUNDING);
      return {
        productServiceId: item.productServiceId ?? null,
        descripcion: item.descripcion,
        cantidad: new Prisma.Decimal(item.cantidad),
        valorUnitario: new Prisma.Decimal(item.valorUnitario),
        subtotal: subtotal.toFixed(2),
        porcentajeImpuesto: porcentajeImpuesto.toFixed(2),
        valorImpuesto: valorImpuesto.toFixed(2),
      };
    });

    const subtotal = items.reduce(
      (sum, item) => sum.plus(item.subtotal),
      new Prisma.Decimal(0),
    );
    const impuestos = items.reduce(
      (sum, item) => sum.plus(item.valorImpuesto),
      new Prisma.Decimal(0),
    );
    const total = subtotal.plus(impuestos);

    return this.prisma.invoice.create({
      data: {
        tenantId,
        customerId: dto.customerId,
        numero: dto.numero,
        fechaVencimiento,
        customerRazonSocialSnapshot: customer.razonSocial,
        customerNitSnapshot: customer.nit,
        subtotal: subtotal.toFixed(2),
        impuestos: impuestos.toFixed(2),
        total: total.toFixed(2),
        items: { create: items },
      },
      include: {
        items: true,
        customer: { select: { razonSocial: true, nit: true } },
      },
    });
  }

  async findAllInvoices(tenantId: string, status?: string) {
    const invoices = await this.prisma.invoice.findMany({
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
    const appliedAmounts = invoices.length
      ? await this.tenantPrisma.execute((tx) =>
          getActiveReceiptAppliedAmounts(
            tx,
            tenantId,
            invoices.map(({ id }) => id),
          ),
        )
      : new Map<string, Prisma.Decimal>();
    return invoices.map((invoice) => {
      if (invoice.status !== 'ISSUED') {
        return { ...invoice, totalPagado: null, saldoPendiente: null };
      }
      const totalPagado =
        appliedAmounts.get(invoice.id) ?? new Prisma.Decimal(0);
      return {
        ...invoice,
        totalPagado,
        saldoPendiente: new Prisma.Decimal(invoice.total).minus(totalPagado),
      };
    });
  }

  async findOneInvoice(tenantId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, tenantId },
      include: { items: true, customer: true, tercero: true },
    });
    if (!invoice) throw new NotFoundException('Factura no encontrada');
    const comprobanteContable = await this.tenantPrisma.execute((tx) =>
      this.findInvoiceVoucher(tx, tenantId, invoice.id),
    );
    const appliedAmounts = await this.tenantPrisma.execute((tx) =>
      getActiveReceiptAppliedAmounts(tx, tenantId, [invoice.id]),
    );
    const totalPagado =
      invoice.status === 'ISSUED'
        ? (appliedAmounts.get(invoice.id) ?? new Prisma.Decimal(0))
        : null;
    const saldoPendiente =
      invoice.status === 'ISSUED'
        ? new Prisma.Decimal(invoice.total).minus(totalPagado!)
        : null;
    return { ...invoice, totalPagado, saldoPendiente, comprobanteContable };
  }

  async updateInvoiceStatus(
    tenantId: string,
    userId: string,
    id: string,
    dto: UpdateInvoiceStatusDto,
  ) {
    return this.tenantPrisma.execute(async (tx) => {
      await tx.$queryRaw`
        SELECT "id" FROM "invoices"
        WHERE "id" = ${id} AND "tenantId" = ${tenantId}
        FOR UPDATE
      `;
      const invoice = await tx.invoice.findFirst({
        where: { id, tenantId },
        include: { items: true, customer: true },
      });
      if (!invoice) throw new NotFoundException('Factura no encontrada');

      if (invoice.status === dto.status) {
        if (invoice.status === 'ISSUED') {
          const voucher = await this.findInvoiceVoucher(tx, tenantId, id);
          if (!voucher) {
            throw new ConflictException(
              'Esta factura se emitió antes de la integración contable. No se contabilizará retroactivamente; cree una factura nueva.',
            );
          }
          return { ...invoice, comprobanteContable: voucher };
        }
        return invoice;
      }

      if (invoice.status === 'CANCELLED') {
        throw new ConflictException(
          'Una factura cancelada no se puede modificar.',
        );
      }

      if (dto.status === 'CANCELLED' && invoice.status === 'ISSUED') {
        const appliedAmounts = await getActiveReceiptAppliedAmounts(
          tx,
          tenantId,
          [id],
        );
        if ((appliedAmounts.get(id) ?? new Prisma.Decimal(0)).gt(0)) {
          throw new ConflictException(
            'Revierta primero los recaudos activos de esta factura antes de cancelarla.',
          );
        }
      }

      if (dto.status === 'DRAFT') {
        throw new BadRequestException(
          'Una factura emitida o cancelada no puede volver a borrador.',
        );
      }

      if (dto.status === 'ISSUED') {
        const voucher = await this.issueInvoice(tx, tenantId, userId, invoice);
        return { ...voucher.invoice, comprobanteContable: voucher.comprobante };
      }

      const motivo = dto.motivo?.trim();
      if (!motivo) {
        throw new BadRequestException(
          'Indique el motivo para cancelar la factura.',
        );
      }

      let reverso = null;
      let comprobanteOriginalId: string | null = null;
      if (invoice.status === 'ISSUED') {
        const original = await this.findInvoiceVoucher(tx, tenantId, id);
        if (original) {
          comprobanteOriginalId = original.id;
          reverso = await this.ledger.anular(
            tenantId,
            userId,
            original.id,
            motivo,
            tx,
          );
        }
      }

      const cancelled = await tx.invoice.update({
        where: { id: invoice.id },
        data: { status: 'CANCELLED' },
        include: { items: true, customer: true, tercero: true },
      });
      await this.audit.log(
        {
          tenantId,
          userId,
          action: 'BILLING_INVOICE_CANCELLED',
          entityType: 'Invoice',
          entityId: invoice.id,
          metadata: {
            motivo,
            comprobanteOriginalId,
            reversoId: reverso?.id ?? null,
            facturaEmitidaSinComprobante:
              invoice.status === 'ISSUED' && !comprobanteOriginalId,
          },
        },
        tx,
      );
      const comprobanteContable = await this.findInvoiceVoucher(
        tx,
        tenantId,
        id,
      );
      return { ...cancelled, comprobanteContable, reversoContable: reverso };
    });
  }

  // --- DASHBOARD ---
  async getDashboard(tenantId: string) {
    const [summary] = await this.tenantPrisma.execute(
      (tx) =>
        tx.$queryRaw<
          Array<{
            activeCustomers: bigint;
            issuedInvoiceCount: bigint;
            draftInvoiceCount: bigint;
            totalInvoiced: Prisma.Decimal;
            totalCollected: Prisma.Decimal;
          }>
        >`
        WITH tenant_invoices AS (
          SELECT "id", "total", "status"
          FROM "invoices"
          WHERE "tenantId" = ${tenantId}
        ), active_applications AS (
          SELECT a."invoiceId", SUM(a."amount") AS "amount"
          FROM "invoice_receipt_allocations" a
          JOIN "customer_receipts" r
            ON r."id" = a."receiptId" AND r."tenantId" = a."tenantId"
          JOIN tenant_invoices i
            ON i."id" = a."invoiceId" AND i."status" = 'ISSUED'
          LEFT JOIN "customer_receipt_reversals" x
            ON x."receiptId" = r."id" AND x."tenantId" = r."tenantId"
          WHERE a."tenantId" = ${tenantId}
            AND x."id" IS NULL
          GROUP BY a."invoiceId"
        )
        SELECT
          (SELECT COUNT(*) FROM "customers"
            WHERE "tenantId" = ${tenantId} AND "status" = 'ACTIVE') AS "activeCustomers",
          (SELECT COUNT(*) FROM tenant_invoices WHERE "status" = 'ISSUED') AS "issuedInvoiceCount",
          (SELECT COUNT(*) FROM tenant_invoices WHERE "status" = 'DRAFT') AS "draftInvoiceCount",
          COALESCE((SELECT SUM("total") FROM tenant_invoices WHERE "status" = 'ISSUED'), 0)::numeric AS "totalInvoiced",
          COALESCE((SELECT SUM("amount") FROM active_applications), 0)::numeric AS "totalCollected"
      `,
    );
    const totalFacturado = new Prisma.Decimal(summary?.totalInvoiced ?? 0);
    const totalRecaudado = new Prisma.Decimal(summary?.totalCollected ?? 0);

    return {
      clientesActivos: Number(summary?.activeCustomers ?? 0),
      facturasEmitidas: Number(summary?.issuedInvoiceCount ?? 0),
      facturasBorrador: Number(summary?.draftInvoiceCount ?? 0),
      ingresosEstimados: Number(totalFacturado),
      totalFacturado: Number(totalFacturado),
      totalRecaudado: Number(totalRecaudado),
      carteraPendiente: Number(totalFacturado.minus(totalRecaudado)),
    };
  }

  private async issueInvoice(
    tx: TenantPrismaClient,
    tenantId: string,
    userId: string,
    invoice: Prisma.InvoiceGetPayload<{
      include: { items: true; customer: true };
    }>,
  ) {
    if (
      !invoice.customerRazonSocialSnapshot ||
      !invoice.customerNitSnapshot ||
      invoice.items.some(
        (item) =>
          item.porcentajeImpuesto === null || item.valorImpuesto === null,
      )
    ) {
      throw new BadRequestException(
        'Este borrador no tiene snapshots de cliente e impuestos. Cree una factura nueva para emitirla.',
      );
    }
    if (invoice.items.length === 0) {
      throw new BadRequestException(
        'La factura debe tener al menos una línea.',
      );
    }
    const subtotal = invoice.items.reduce(
      (sum, item) => sum.plus(item.subtotal),
      new Prisma.Decimal(0),
    );
    const impuestos = invoice.items.reduce(
      (sum, item) => sum.plus(item.valorImpuesto!),
      new Prisma.Decimal(0),
    );
    if (
      !subtotal.eq(invoice.subtotal) ||
      !impuestos.eq(invoice.impuestos) ||
      !subtotal.plus(impuestos).eq(invoice.total)
    ) {
      throw new ConflictException(
        'Los totales de la factura no concilian con sus líneas; no se puede emitir.',
      );
    }

    const customer = await tx.customer.findFirst({
      where: { id: invoice.customerId, tenantId, status: 'ACTIVE' },
    });
    if (!customer || !customer.terceroId) {
      throw new BadRequestException(
        'Vincule el cliente con un tercero contable activo antes de emitir.',
      );
    }
    const thirdParty = await this.validateCustomerThirdParty(
      tenantId,
      customer.nit,
      customer.terceroId,
      tx,
      invoice.customerId,
    );

    const fechaEmision = new Date();
    const fechaContable = businessCalendarDate(fechaEmision);
    const fechaVencimiento = invoice.fechaVencimiento
      ?.toISOString()
      .slice(0, 10);
    const fechaComercialEmision = fechaContable.toISOString().slice(0, 10);
    if (fechaVencimiento && fechaVencimiento < fechaComercialEmision) {
      throw new BadRequestException(
        'La fecha de vencimiento debe ser igual o posterior a la fecha de emisión.',
      );
    }
    const periodo = await tx.periodoContable.findFirst({
      where: {
        tenantId,
        estado: 'ABIERTO',
        fechaInicio: { lte: fechaContable },
        fechaFin: { gte: fechaContable },
      },
    });
    if (!periodo) {
      throw new BadRequestException(
        'No hay un período contable abierto para la fecha de emisión.',
      );
    }

    const mappings = await tx.cuentaSistemaMap.findMany({
      where: {
        tenantId,
        activo: true,
        rol: { in: [...BILLING_ACCOUNT_ROLES] },
      },
      select: { rol: true, cuentaId: true },
    });
    const accounts = new Map(
      mappings.map((mapping) => [mapping.rol, mapping.cuentaId]),
    );
    const accountId = (role: (typeof BILLING_ACCOUNT_ROLES)[number]) => {
      const id = accounts.get(role);
      if (!id) {
        throw new ConflictException(
          `Falta configurar el mapeo contable ${role} para emitir facturas.`,
        );
      }
      return id;
    };

    const voucherType = await tx.tipoComprobante.findFirst({
      where: { codigo: 'FV', activo: true },
      select: { id: true },
    });
    if (!voucherType) {
      throw new ConflictException(
        'No está configurado el tipo de comprobante FV para facturación.',
      );
    }

    const lines: LineaComprobanteInput[] = [
      {
        cuentaId: accountId('CLIENTES_NACIONALES'),
        terceroId: customer.terceroId,
        debito: invoice.total,
        credito: 0,
        descripcion: `Cuenta por cobrar factura ${invoice.numero}`,
      },
      {
        cuentaId: accountId('INGRESOS_OPERACIONALES'),
        terceroId: customer.terceroId,
        debito: 0,
        credito: subtotal,
        descripcion: `Ingreso factura ${invoice.numero}`,
      },
    ];
    if (impuestos.gt(0)) {
      const taxableBase = invoice.items.reduce(
        (sum, item) =>
          item.porcentajeImpuesto!.gt(0) ? sum.plus(item.subtotal) : sum,
        new Prisma.Decimal(0),
      );
      lines.push({
        cuentaId: accountId('IVA_GENERADO'),
        terceroId: customer.terceroId,
        debito: 0,
        credito: impuestos,
        baseGravable: taxableBase,
        descripcion: `IVA generado factura ${invoice.numero}`,
      });
    }

    const comprobante = await this.ledger.registrarComprobante(
      {
        tenantId,
        userId,
        tipoComprobanteId: voucherType.id,
        periodoId: periodo.id,
        // El comprobante guarda DATE; usar el día comercial de Bogotá para
        // que coincida con el período elegido incluso cerca de medianoche.
        fecha: fechaContable,
        concepto: `Factura interna ${invoice.numero}`,
        lineas: lines,
        origenTipo: BILLING_INVOICE_ORIGIN.type,
        origenId: invoice.id,
        origenEvento: BILLING_INVOICE_ORIGIN.event,
      },
      tx,
    );

    const issued = await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        status: 'ISSUED',
        fechaEmision,
        customerRazonSocialSnapshot: customer.razonSocial,
        customerNitSnapshot: customer.nit,
        terceroId: thirdParty.id,
        terceroRazonSocialSnapshot: this.thirdPartyName(thirdParty),
        terceroTipoDocumentoSnapshot: thirdParty.tipoDocumento,
        terceroNumeroDocumentoSnapshot: thirdParty.numeroDocumento,
        terceroDigitoVerificacionSnapshot: thirdParty.digitoVerificacion,
      },
      include: { items: true, customer: true, tercero: true },
    });
    await this.audit.log(
      {
        tenantId,
        userId,
        action: 'BILLING_INVOICE_ISSUED',
        entityType: 'Invoice',
        entityId: invoice.id,
        metadata: { comprobanteId: comprobante.id, numero: invoice.numero },
      },
      tx,
    );
    return { invoice: issued, comprobante };
  }

  private async findInvoiceVoucher(
    client: TenantPrismaClient,
    tenantId: string,
    invoiceId: string,
  ) {
    return client.comprobanteContable.findFirst({
      where: {
        tenantId,
        origenTipo: BILLING_INVOICE_ORIGIN.type,
        origenId: invoiceId,
        origenEvento: BILLING_INVOICE_ORIGIN.event,
      },
      include: {
        tipoComprobante: { select: { codigo: true, nombre: true } },
        movimientos: {
          orderBy: { linea: 'asc' },
          include: { cuenta: { select: { codigo: true, nombre: true } } },
        },
        reversos: {
          orderBy: { createdAt: 'asc' },
          select: { id: true, numero: true, estado: true },
        },
      },
    });
  }

  private async validateCustomerThirdParty(
    tenantId: string,
    customerNit: string,
    terceroId: string,
    client: PrismaService | TenantPrismaClient = this.prisma,
    excludeCustomerId?: string,
  ) {
    const thirdParty = await client.tercero.findFirst({
      where: {
        id: terceroId,
        tenantId,
        tipoDocumento: TipoDocIdentidad.NIT,
        esCliente: true,
        activo: true,
        deletedAt: null,
      },
    });
    if (!thirdParty) {
      throw new BadRequestException(
        'Seleccione un tercero NIT activo de este tenant con rol de cliente.',
      );
    }
    const normalizedCustomerNit = customerNit.replace(/\D/g, '');
    const normalizedThirdPartyNumber = thirdParty.numeroDocumento.replace(
      /\D/g,
      '',
    );
    const normalizedVerificationDigit = (
      thirdParty.digitoVerificacion ?? ''
    ).replace(/\D/g, '');
    const matches =
      normalizedCustomerNit === normalizedThirdPartyNumber ||
      (normalizedVerificationDigit.length > 0 &&
        normalizedCustomerNit ===
          normalizedThirdPartyNumber + normalizedVerificationDigit);
    if (!matches) {
      throw new BadRequestException(
        'El NIT del cliente no coincide con el documento del tercero contable.',
      );
    }
    const existingLink = await client.customer.findFirst({
      where: {
        tenantId,
        terceroId,
        ...(excludeCustomerId && { id: { not: excludeCustomerId } }),
      },
      select: { id: true },
    });
    if (existingLink) {
      throw new ConflictException(
        'Este tercero ya está vinculado a otro cliente de facturación.',
      );
    }
    return thirdParty;
  }

  private thirdPartyName(thirdParty: {
    razonSocial: string | null;
    primerNombre: string | null;
    segundoNombre: string | null;
    primerApellido: string | null;
    segundoApellido: string | null;
  }) {
    return (
      thirdParty.razonSocial ??
      [
        thirdParty.primerNombre,
        thirdParty.segundoNombre,
        thirdParty.primerApellido,
        thirdParty.segundoApellido,
      ]
        .filter(Boolean)
        .join(' ')
    );
  }

  private async validateInvoiceProducts(
    tenantId: string,
    items: CreateInvoiceDto['items'],
  ): Promise<Map<string, Prisma.Decimal>> {
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
    return new Map(
      products.map((product) => [
        product.id,
        new Prisma.Decimal(product.impuesto),
      ]),
    );
  }
}
