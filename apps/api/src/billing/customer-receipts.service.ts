import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import type { TenantPrismaClient } from '../tenant-prisma/tenant-prisma.service';
import { LedgerService } from '../accounting/ledger/ledger.service';
import type { LineaComprobanteInput } from '../accounting/ledger/ledger.types';
import { AuditService } from '../audit/audit.service';
import {
  CreateCustomerReceiptDto,
  ReceiptMethod,
  ReverseCustomerReceiptDto,
} from './dto/billing.dto';
import { getActiveReceiptAppliedAmounts } from './customer-receipt-balance';

const RECEIPT_ORIGIN = { type: 'BILLING_RECEIPT', event: 'POSTED' } as const;
const RECEIPT_ACCOUNT_ROLES = ['CLIENTES_NACIONALES'] as const;
const MAX_APPLICATIONS = 100;

function parseCalendarDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BadRequestException('La fecha del recaudo debe usar AAAA-MM-DD.');
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new BadRequestException('La fecha del recaudo no es válida.');
  }
  return date;
}

function normalizeAmount(value: number): Prisma.Decimal {
  const amount = new Prisma.Decimal(String(value));
  if (!amount.isFinite() || !amount.gt(0) || amount.decimalPlaces() > 2) {
    throw new BadRequestException(
      'Los montos deben ser positivos y tener máximo dos decimales.',
    );
  }
  return amount;
}

function normalizedRequest(dto: CreateCustomerReceiptDto) {
  const allocations = dto.aplicaciones
    .map((allocation) => ({
      invoiceId: allocation.invoiceId,
      amount: normalizeAmount(allocation.amount).toFixed(2),
    }))
    .sort((left, right) => left.invoiceId.localeCompare(right.invoiceId));
  const normalized = {
    customerId: dto.customerId,
    fechaRecibo: dto.fechaRecibo,
    medio: dto.medio,
    referencia: dto.referencia?.trim() || null,
    monto: normalizeAmount(dto.monto).toFixed(2),
    aplicaciones: allocations,
  };
  return {
    ...normalized,
    requestHash: createHash('sha256')
      .update(JSON.stringify(normalized))
      .digest('hex'),
    allocations: allocations.map((allocation) => ({
      invoiceId: allocation.invoiceId,
      amount: new Prisma.Decimal(allocation.amount),
    })),
    amount: new Prisma.Decimal(normalized.monto),
  };
}

@Injectable()
export class CustomerReceiptsService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly ledger: LedgerService,
    private readonly audit: AuditService,
  ) {}

  async create(
    tenantId: string,
    userId: string,
    dto: CreateCustomerReceiptDto,
  ) {
    const normalized = normalizedRequest(dto);
    const receiptDate = parseCalendarDate(dto.fechaRecibo);
    const ids = normalized.allocations.map(
      (allocation) => allocation.invoiceId,
    );
    if (ids.length > MAX_APPLICATIONS || new Set(ids).size !== ids.length) {
      throw new BadRequestException(
        'Incluya entre 1 y 100 facturas distintas por recaudo.',
      );
    }
    const applicationsTotal = normalized.allocations.reduce(
      (sum, allocation) => sum.plus(allocation.amount),
      new Prisma.Decimal(0),
    );
    if (!applicationsTotal.eq(normalized.amount)) {
      throw new BadRequestException(
        'La suma de las aplicaciones debe ser exactamente igual al valor recibido.',
      );
    }

    try {
      return await this.tenantPrisma.execute(async (tx) => {
        const existing = await tx.customerReceipt.findUnique({
          where: {
            tenantId_idempotencyKey: {
              tenantId,
              idempotencyKey: dto.idempotencyKey,
            },
          },
        });
        if (existing) {
          if (existing.requestHash !== normalized.requestHash) {
            throw new ConflictException(
              'La clave de idempotencia ya se usó con otros datos.',
            );
          }
          return this.findReceiptWithVoucher(tx, tenantId, existing.id);
        }

        await this.lockInvoices(tx, tenantId, ids);
        const concurrentReceipt = await tx.customerReceipt.findUnique({
          where: {
            tenantId_idempotencyKey: {
              tenantId,
              idempotencyKey: dto.idempotencyKey,
            },
          },
        });
        if (concurrentReceipt) {
          if (concurrentReceipt.requestHash !== normalized.requestHash) {
            throw new ConflictException(
              'La clave de idempotencia ya se usó con otros datos.',
            );
          }
          return this.findReceiptWithVoucher(
            tx,
            tenantId,
            concurrentReceipt.id,
          );
        }

        const invoices = await tx.invoice.findMany({
          where: { id: { in: ids }, tenantId },
          select: {
            id: true,
            numero: true,
            customerId: true,
            terceroId: true,
            total: true,
            status: true,
          },
        });
        if (invoices.length !== ids.length) {
          throw new NotFoundException(
            'Una o más facturas no existen en este tenant.',
          );
        }
        const invoiceById = new Map(
          invoices.map((invoice) => [invoice.id, invoice]),
        );
        if (invoices.some((invoice) => invoice.customerId !== dto.customerId)) {
          throw new BadRequestException(
            'Un recaudo solo se puede aplicar a facturas del cliente indicado.',
          );
        }
        if (invoices.some((invoice) => invoice.status !== 'ISSUED')) {
          throw new BadRequestException(
            'Solo se pueden aplicar recaudos a facturas emitidas y vigentes.',
          );
        }
        if (invoices.some((invoice) => !invoice.terceroId)) {
          throw new ConflictException(
            'Una factura no conserva el tercero contable requerido para el recaudo.',
          );
        }

        const emittedVouchers = await tx.comprobanteContable.findMany({
          where: {
            tenantId,
            origenTipo: 'BILLING_INVOICE',
            origenEvento: 'ISSUED',
            origenId: { in: ids },
            estado: 'CONTABILIZADO',
          },
          select: { origenId: true },
        });
        const invoicesWithVoucher = new Set(
          emittedVouchers.map((voucher) => voucher.origenId).filter(Boolean),
        );
        if (ids.some((id) => !invoicesWithVoucher.has(id))) {
          throw new ConflictException(
            'Una factura no tiene un comprobante de emisión activo. No se aplicó el recaudo.',
          );
        }

        const appliedAmounts = await getActiveReceiptAppliedAmounts(
          tx,
          tenantId,
          ids,
        );
        for (const allocation of normalized.allocations) {
          const invoice = invoiceById.get(allocation.invoiceId)!;
          const applied =
            appliedAmounts.get(allocation.invoiceId) ?? new Prisma.Decimal(0);
          const outstanding = new Prisma.Decimal(invoice.total).minus(applied);
          if (outstanding.lte(0) || allocation.amount.gt(outstanding)) {
            throw new ConflictException(
              `La factura ${invoice.numero} tiene un saldo pendiente de ${outstanding.toFixed(2)}.`,
            );
          }
        }

        const accountingPeriods = await tx.periodoContable.findMany({
          where: {
            tenantId,
            estado: 'ABIERTO',
            fechaInicio: { lte: receiptDate },
            fechaFin: { gte: receiptDate },
          },
          select: { id: true },
        });
        if (accountingPeriods.length === 0) {
          throw new BadRequestException(
            'No hay un período contable abierto para la fecha del recaudo.',
          );
        }
        if (accountingPeriods.length > 1) {
          throw new ConflictException(
            'Hay períodos contables abiertos superpuestos para la fecha del recaudo.',
          );
        }

        const cashRole =
          dto.medio === ReceiptMethod.EFECTIVO
            ? 'CAJA_GENERAL'
            : 'BANCO_PRINCIPAL';
        const mappings = await tx.cuentaSistemaMap.findMany({
          where: {
            tenantId,
            activo: true,
            rol: { in: [cashRole, ...RECEIPT_ACCOUNT_ROLES] },
          },
          select: { rol: true, cuentaId: true },
        });
        const accountByRole = new Map(
          mappings.map((mapping) => [mapping.rol, mapping.cuentaId]),
        );
        const cashAccountId = accountByRole.get(cashRole);
        const receivableAccountId = accountByRole.get('CLIENTES_NACIONALES');
        if (!cashAccountId || !receivableAccountId) {
          throw new ConflictException(
            `Falta configurar el mapeo contable ${!cashAccountId ? cashRole : 'CLIENTES_NACIONALES'} para registrar recaudos.`,
          );
        }
        if (cashAccountId === receivableAccountId) {
          throw new ConflictException(
            'Las cuentas de caja/banco y cartera deben ser distintas.',
          );
        }
        const voucherType = await tx.tipoComprobante.findFirst({
          where: { codigo: 'CI', activo: true },
          select: { id: true },
        });
        if (!voucherType) {
          throw new ConflictException(
            'No está configurado el tipo CI para contabilizar recaudos.',
          );
        }

        const receipt = await tx.customerReceipt.create({
          data: {
            tenantId,
            customerId: dto.customerId,
            fechaRecibo: receiptDate,
            medio: dto.medio,
            referencia: normalized.referencia,
            monto: normalized.amount,
            idempotencyKey: dto.idempotencyKey,
            requestHash: normalized.requestHash,
            registradoPorId: userId,
            aplicaciones: {
              create: normalized.allocations.map((allocation) => ({
                invoiceId: allocation.invoiceId,
                amount: allocation.amount,
              })),
            },
          },
          select: { id: true },
        });

        const amountsByThirdParty = new Map<
          string,
          { amount: Prisma.Decimal; invoices: string[] }
        >();
        for (const allocation of normalized.allocations) {
          const invoice = invoiceById.get(allocation.invoiceId)!;
          const terceroId = invoice.terceroId!;
          const existing = amountsByThirdParty.get(terceroId) ?? {
            amount: new Prisma.Decimal(0),
            invoices: [],
          };
          existing.amount = existing.amount.plus(allocation.amount);
          existing.invoices.push(invoice.numero);
          amountsByThirdParty.set(terceroId, existing);
        }
        const lines: LineaComprobanteInput[] = [
          {
            cuentaId: cashAccountId,
            debito: normalized.amount,
            credito: 0,
            descripcion: `Recaudo de cliente ${receipt.id}`,
          },
          ...[...amountsByThirdParty.entries()].map(([terceroId, entry]) => ({
            cuentaId: receivableAccountId,
            terceroId,
            debito: 0,
            credito: entry.amount,
            descripcion: `Aplicación recaudo a facturas ${entry.invoices.join(', ')}`,
          })),
        ];
        const voucher = await this.ledger.registrarComprobante(
          {
            tenantId,
            userId,
            tipoComprobanteId: voucherType.id,
            periodoId: accountingPeriods[0].id,
            fecha: receiptDate,
            concepto: `Recaudo de cliente · ${normalized.referencia ?? receipt.id}`,
            lineas: lines,
            origenTipo: RECEIPT_ORIGIN.type,
            origenId: receipt.id,
            origenEvento: RECEIPT_ORIGIN.event,
          },
          tx,
        );
        await this.audit.log(
          {
            tenantId,
            userId,
            action: 'BILLING_CUSTOMER_RECEIPT_POSTED',
            entityType: 'CustomerReceipt',
            entityId: receipt.id,
            metadata: {
              fechaRecibo: dto.fechaRecibo,
              medio: dto.medio,
              monto: normalized.amount.toFixed(2),
              facturas: normalized.allocations.map(
                ({ invoiceId }) => invoiceId,
              ),
              comprobanteId: voucher.id,
            },
          },
          tx,
        );
        return this.findReceiptWithVoucher(tx, tenantId, receipt.id);
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return this.tenantPrisma.execute(async (tx) => {
          const existing = await tx.customerReceipt.findUnique({
            where: {
              tenantId_idempotencyKey: {
                tenantId,
                idempotencyKey: dto.idempotencyKey,
              },
            },
          });
          if (!existing) throw error;
          if (existing.requestHash !== normalized.requestHash) {
            throw new ConflictException(
              'La clave de idempotencia ya se usó con otros datos.',
            );
          }
          return this.findReceiptWithVoucher(tx, tenantId, existing.id);
        });
      }
      throw error;
    }
  }

  async findInvoiceApplications(tenantId: string, invoiceId: string) {
    return this.tenantPrisma.execute(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id: invoiceId, tenantId },
        select: { id: true },
      });
      if (!invoice) throw new NotFoundException('Factura no encontrada.');
      const applications = await tx.invoiceReceiptAllocation.findMany({
        where: { tenantId, invoiceId },
        include: {
          receipt: {
            include: {
              reversal: true,
              aplicaciones: {
                include: { invoice: { select: { numero: true } } },
                orderBy: { invoiceId: 'asc' },
              },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      });
      const receiptIds = [
        ...new Set(applications.map(({ receiptId }) => receiptId)),
      ];
      const vouchers = receiptIds.length
        ? await tx.comprobanteContable.findMany({
            where: {
              tenantId,
              origenTipo: RECEIPT_ORIGIN.type,
              origenEvento: RECEIPT_ORIGIN.event,
              origenId: { in: receiptIds },
            },
            include: {
              tipoComprobante: { select: { codigo: true, nombre: true } },
              movimientos: {
                orderBy: { linea: 'asc' },
                include: { cuenta: { select: { codigo: true, nombre: true } } },
              },
              reversos: {
                select: { id: true, numero: true, estado: true },
                orderBy: { createdAt: 'asc' },
              },
            },
          })
        : [];
      const voucherByReceiptId = new Map(
        vouchers.map((voucher) => [voucher.origenId, voucher]),
      );
      return applications.map((application) => ({
        id: application.id,
        amount: application.amount,
        receipt: {
          ...application.receipt,
          aplicaciones: application.receipt.aplicaciones.map((allocation) => ({
            invoiceId: allocation.invoiceId,
            numero: allocation.invoice.numero,
            amount: allocation.amount,
          })),
        },
        comprobanteContable:
          voucherByReceiptId.get(application.receiptId) ?? null,
      }));
    });
  }

  async findReceivableInvoices(tenantId: string, customerId: string) {
    return this.tenantPrisma.execute(async (tx) => {
      const customer = await tx.customer.findFirst({
        where: { id: customerId, tenantId },
        select: { id: true },
      });
      if (!customer) throw new NotFoundException('Cliente no encontrado.');

      const invoices = await tx.invoice.findMany({
        where: {
          tenantId,
          customerId,
          status: 'ISSUED',
          terceroId: { not: null },
        },
        select: {
          id: true,
          numero: true,
          fechaVencimiento: true,
          total: true,
        },
        orderBy: [{ fechaEmision: 'asc' }, { id: 'asc' }],
      });
      if (invoices.length === 0) return [];

      const invoiceIds = invoices.map(({ id }) => id);
      const activeVouchers = await tx.comprobanteContable.findMany({
        where: {
          tenantId,
          origenTipo: 'BILLING_INVOICE',
          origenEvento: 'ISSUED',
          origenId: { in: invoiceIds },
          estado: 'CONTABILIZADO',
        },
        select: { origenId: true },
      });
      const receivableInvoiceIds = new Set(
        activeVouchers.map(({ origenId }) => origenId).filter(Boolean),
      );
      const eligibleInvoices = invoices.filter(({ id }) =>
        receivableInvoiceIds.has(id),
      );
      if (eligibleInvoices.length === 0) return [];

      const appliedAmounts = await getActiveReceiptAppliedAmounts(
        tx,
        tenantId,
        eligibleInvoices.map(({ id }) => id),
      );
      return eligibleInvoices.flatMap((invoice) => {
        const totalPagado =
          appliedAmounts.get(invoice.id) ?? new Prisma.Decimal(0);
        const saldoPendiente = new Prisma.Decimal(invoice.total).minus(
          totalPagado,
        );
        if (saldoPendiente.lte(0)) return [];
        return [{ ...invoice, totalPagado, saldoPendiente }];
      });
    });
  }

  async reverse(
    tenantId: string,
    userId: string,
    receiptId: string,
    dto: ReverseCustomerReceiptDto,
  ) {
    const reason = dto.reason.trim();
    if (reason.length < 3) {
      throw new BadRequestException(
        'Indique un motivo de reversión de al menos 3 caracteres.',
      );
    }
    return this.tenantPrisma.execute(async (tx) => {
      const beforeLock = await tx.customerReceipt.findFirst({
        where: { id: receiptId, tenantId },
        select: {
          id: true,
          aplicaciones: { select: { invoiceId: true } },
        },
      });
      if (!beforeLock) throw new NotFoundException('Recaudo no encontrado.');
      await this.lockInvoices(
        tx,
        tenantId,
        beforeLock.aplicaciones.map(({ invoiceId }) => invoiceId),
      );
      await tx.$queryRaw`
        SELECT "id" FROM "customer_receipts"
        WHERE "id" = ${receiptId} AND "tenantId" = ${tenantId}
        FOR UPDATE
      `;
      const receipt = await tx.customerReceipt.findFirst({
        where: { id: receiptId, tenantId },
        include: { reversal: true },
      });
      if (!receipt) throw new NotFoundException('Recaudo no encontrado.');
      if (receipt.reversal) {
        const voucher = await this.findVoucherById(
          tx,
          tenantId,
          receipt.reversal.reversalVoucherId,
        );
        return { ...receipt.reversal, comprobanteContable: voucher };
      }

      const originalVoucher = await tx.comprobanteContable.findFirst({
        where: {
          tenantId,
          origenTipo: RECEIPT_ORIGIN.type,
          origenId: receipt.id,
          origenEvento: RECEIPT_ORIGIN.event,
        },
        select: { id: true, estado: true },
      });
      if (!originalVoucher || originalVoucher.estado !== 'CONTABILIZADO') {
        throw new ConflictException(
          'No se puede reversar el recaudo porque su comprobante no está contabilizado.',
        );
      }
      const ledgerResult = await this.ledger.anular(
        tenantId,
        userId,
        originalVoucher.id,
        reason,
        tx,
      );
      const reversal = await tx.customerReceiptReversal.create({
        data: {
          tenantId,
          receiptId,
          reason,
          reversedById: userId,
          originalVoucherId: originalVoucher.id,
          reversalVoucherId: ledgerResult.id,
        },
      });
      await this.audit.log(
        {
          tenantId,
          userId,
          action: 'BILLING_CUSTOMER_RECEIPT_REVERSED',
          entityType: 'CustomerReceipt',
          entityId: receiptId,
          metadata: {
            reason,
            originalVoucherId: originalVoucher.id,
            reversalVoucherId: ledgerResult.id,
          },
        },
        tx,
      );
      return { ...reversal, comprobanteContable: ledgerResult };
    });
  }

  private async lockInvoices(
    tx: TenantPrismaClient,
    tenantId: string,
    invoiceIds: string[],
  ) {
    for (const invoiceId of [...invoiceIds].sort()) {
      await tx.$queryRaw`
        SELECT "id" FROM "invoices"
        WHERE "id" = ${invoiceId} AND "tenantId" = ${tenantId}
        FOR UPDATE
      `;
    }
  }

  private async findReceiptWithVoucher(
    tx: TenantPrismaClient,
    tenantId: string,
    receiptId: string,
  ) {
    const receipt = await tx.customerReceipt.findFirst({
      where: { id: receiptId, tenantId },
      include: {
        reversal: true,
        aplicaciones: {
          include: {
            invoice: { select: { id: true, numero: true, total: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!receipt) throw new NotFoundException('Recaudo no encontrado.');
    const voucher = await tx.comprobanteContable.findFirst({
      where: {
        tenantId,
        origenTipo: RECEIPT_ORIGIN.type,
        origenId: receiptId,
        origenEvento: RECEIPT_ORIGIN.event,
      },
      include: {
        tipoComprobante: { select: { codigo: true, nombre: true } },
        movimientos: {
          orderBy: { linea: 'asc' },
          include: { cuenta: { select: { codigo: true, nombre: true } } },
        },
        reversos: {
          select: { id: true, numero: true, estado: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!voucher) {
      throw new ConflictException(
        'El recaudo no tiene un comprobante de Ledger.',
      );
    }
    return { ...receipt, comprobanteContable: voucher };
  }

  private async findVoucherById(
    tx: TenantPrismaClient,
    tenantId: string,
    voucherId: string,
  ) {
    return tx.comprobanteContable.findFirst({
      where: { id: voucherId, tenantId },
      include: {
        tipoComprobante: { select: { codigo: true, nombre: true } },
        movimientos: {
          orderBy: { linea: 'asc' },
          include: { cuenta: { select: { codigo: true, nombre: true } } },
        },
        reversos: {
          select: { id: true, numero: true, estado: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }
}
