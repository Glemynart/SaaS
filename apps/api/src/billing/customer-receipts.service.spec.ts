import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import { LedgerService } from '../accounting/ledger/ledger.service';
import { AuditService } from '../audit/audit.service';
import { CustomerReceiptsService } from './customer-receipts.service';
import { ReceiptMethod } from './dto/billing.dto';

describe('CustomerReceiptsService', () => {
  const tenantPrisma = { execute: jest.fn() };
  const ledger = { registrarComprobante: jest.fn(), anular: jest.fn() };
  const audit = { log: jest.fn() };
  const createdReceiptInputs: Array<{
    data: {
      tenantId: string;
      customerId: string;
      medio: ReceiptMethod;
      monto: Prisma.Decimal;
      requestHash: string;
      aplicaciones: {
        create: Array<{ invoiceId: string; amount: Prisma.Decimal }>;
      };
    };
  }> = [];
  const tx = {
    $queryRaw: jest.fn(),
    customerReceipt: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    customer: { findFirst: jest.fn() },
    invoice: { findMany: jest.fn(), findFirst: jest.fn() },
    invoiceReceiptAllocation: { findMany: jest.fn() },
    comprobanteContable: { findMany: jest.fn(), findFirst: jest.fn() },
    periodoContable: { findMany: jest.fn() },
    cuentaSistemaMap: { findMany: jest.fn() },
    tipoComprobante: { findFirst: jest.fn() },
    customerReceiptReversal: { create: jest.fn() },
  };
  let service: CustomerReceiptsService;

  const dto = {
    customerId: 'customer-1',
    fechaRecibo: '2026-11-03',
    medio: ReceiptMethod.TRANSFERENCIA,
    referencia: 'TRX-001',
    monto: 40_000,
    idempotencyKey: 'f0cf0fb9-14ca-4c6d-a3ef-8de777335653',
    aplicaciones: [{ invoiceId: 'invoice-1', amount: 40_000 }],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    createdReceiptInputs.length = 0;
    tenantPrisma.execute.mockImplementation((work: unknown) =>
      (work as (client: typeof tx) => unknown)(tx),
    );
    tx.$queryRaw.mockImplementation((strings: TemplateStringsArray) =>
      Promise.resolve(
        strings.join('').includes('invoice_receipt_allocations') ? [] : [],
      ),
    );
    tx.customerReceipt.findUnique.mockResolvedValue(null);
    tx.customer.findFirst.mockResolvedValue({ id: 'customer-1' });
    tx.customerReceipt.findFirst.mockResolvedValue({
      id: 'receipt-1',
      tenantId: 'tenant-1',
      customerId: 'customer-1',
      monto: new Prisma.Decimal(40_000),
      reversal: null,
      aplicaciones: [
        {
          invoiceId: 'invoice-1',
          amount: new Prisma.Decimal(40_000),
          invoice: {
            id: 'invoice-1',
            numero: 'FV-001',
            total: new Prisma.Decimal(126_000),
          },
        },
      ],
    });
    tx.customerReceipt.create.mockImplementation(
      (input: (typeof createdReceiptInputs)[number]) => {
        createdReceiptInputs.push(input);
        return Promise.resolve({ id: 'receipt-1' });
      },
    );
    tx.invoice.findMany.mockResolvedValue([
      {
        id: 'invoice-1',
        numero: 'FV-001',
        customerId: 'customer-1',
        terceroId: 'third-party-1',
        total: new Prisma.Decimal(126_000),
        status: 'ISSUED',
      },
    ]);
    tx.invoiceReceiptAllocation.findMany.mockResolvedValue([]);
    tx.comprobanteContable.findMany.mockResolvedValue([
      { origenId: 'invoice-1' },
    ]);
    tx.comprobanteContable.findFirst.mockResolvedValue({
      id: 'receipt-voucher-1',
      numero: 12,
    });
    tx.periodoContable.findMany.mockResolvedValue([{ id: 'period-2026-11' }]);
    tx.cuentaSistemaMap.findMany.mockResolvedValue([
      { rol: 'BANCO_PRINCIPAL', cuentaId: 'account-bank' },
      { rol: 'CLIENTES_NACIONALES', cuentaId: 'account-ar' },
    ]);
    tx.tipoComprobante.findFirst.mockResolvedValue({ id: 'voucher-type-ci' });
    ledger.registrarComprobante.mockResolvedValue({
      id: 'receipt-voucher-1',
      numero: 12,
    });
    ledger.anular.mockResolvedValue({ id: 'receipt-reversal-1', numero: 13 });
    audit.log.mockResolvedValue(undefined);
    tx.customerReceiptReversal.create.mockResolvedValue({ id: 'reversal-1' });
    service = new CustomerReceiptsService(
      tenantPrisma as unknown as TenantPrismaService,
      ledger as unknown as LedgerService,
      audit as unknown as AuditService,
    );
  });

  it('lista solo facturas contabilizadas del cliente con saldo pendiente', async () => {
    tx.invoice.findMany.mockResolvedValue([
      {
        id: 'invoice-1',
        numero: 'FV-001',
        fechaVencimiento: new Date('2026-12-03T00:00:00.000Z'),
        total: new Prisma.Decimal(100_000),
      },
      {
        id: 'invoice-2',
        numero: 'FV-002',
        fechaVencimiento: null,
        total: new Prisma.Decimal(50_000),
      },
      {
        id: 'invoice-3',
        numero: 'FV-003',
        fechaVencimiento: null,
        total: new Prisma.Decimal(30_000),
      },
    ]);
    tx.comprobanteContable.findMany.mockResolvedValue([
      { origenId: 'invoice-1' },
      { origenId: 'invoice-2' },
    ]);
    tx.$queryRaw.mockImplementation((strings: TemplateStringsArray) =>
      Promise.resolve(
        strings.join('').includes('invoice_receipt_allocations')
          ? [{ invoiceId: 'invoice-1', applied: new Prisma.Decimal(25_000) }]
          : [],
      ),
    );

    const result = await service.findReceivableInvoices(
      'tenant-1',
      'customer-1',
    );

    expect(tx.customer.findFirst).toHaveBeenCalledWith({
      where: { id: 'customer-1', tenantId: 'tenant-1' },
      select: { id: true },
    });
    expect(tx.invoice.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        customerId: 'customer-1',
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
    const voucherCalls = tx.comprobanteContable.findMany.mock
      .calls as unknown as Array<[{ where: Record<string, unknown> }]>;
    const voucherQuery = voucherCalls[0]?.[0];
    expect(voucherQuery?.where).toMatchObject({
      tenantId: 'tenant-1',
      origenId: { in: ['invoice-1', 'invoice-2', 'invoice-3'] },
      estado: 'CONTABILIZADO',
    });
    expect(result).toEqual([
      {
        id: 'invoice-1',
        numero: 'FV-001',
        fechaVencimiento: new Date('2026-12-03T00:00:00.000Z'),
        total: new Prisma.Decimal(100_000),
        totalPagado: new Prisma.Decimal(25_000),
        saldoPendiente: new Prisma.Decimal(75_000),
      },
      {
        id: 'invoice-2',
        numero: 'FV-002',
        fechaVencimiento: null,
        total: new Prisma.Decimal(50_000),
        totalPagado: new Prisma.Decimal(0),
        saldoPendiente: new Prisma.Decimal(50_000),
      },
    ]);
  });

  it('incluye todas las facturas del recaudo para advertir su reversión total', async () => {
    tx.invoice.findFirst.mockResolvedValue({ id: 'invoice-1' });
    tx.invoiceReceiptAllocation.findMany.mockResolvedValue([
      {
        id: 'allocation-1',
        receiptId: 'receipt-1',
        amount: new Prisma.Decimal(20_000),
        receipt: {
          id: 'receipt-1',
          monto: new Prisma.Decimal(50_000),
          reversal: null,
          aplicaciones: [
            {
              invoiceId: 'invoice-1',
              amount: new Prisma.Decimal(20_000),
              invoice: { numero: 'FV-001' },
            },
            {
              invoiceId: 'invoice-2',
              amount: new Prisma.Decimal(30_000),
              invoice: { numero: 'FV-002' },
            },
          ],
        },
      },
    ]);
    tx.comprobanteContable.findMany.mockResolvedValue([
      { origenId: 'receipt-1', id: 'receipt-voucher-1' },
    ]);

    const result = await service.findInvoiceApplications(
      'tenant-1',
      'invoice-1',
    );

    expect(result[0]?.receipt.aplicaciones).toEqual([
      {
        invoiceId: 'invoice-1',
        numero: 'FV-001',
        amount: new Prisma.Decimal(20_000),
      },
      {
        invoiceId: 'invoice-2',
        numero: 'FV-002',
        amount: new Prisma.Decimal(30_000),
      },
    ]);
  });

  it('registra un recaudo parcial, aplica cartera y contabiliza CI en la misma transacción', async () => {
    const result = await service.create('tenant-1', 'user-1', dto);

    expect(result).toEqual(expect.objectContaining({ id: 'receipt-1' }));
    expect(tx.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['invoice-1'] }, tenantId: 'tenant-1' },
      }),
    );
    expect(createdReceiptInputs).toHaveLength(1);
    expect(createdReceiptInputs[0]?.data).toMatchObject({
      tenantId: 'tenant-1',
      customerId: 'customer-1',
      medio: ReceiptMethod.TRANSFERENCIA,
      monto: new Prisma.Decimal(40_000),
      aplicaciones: {
        create: [
          {
            invoiceId: 'invoice-1',
            amount: new Prisma.Decimal(40_000),
          },
        ],
      },
    });
    expect(ledger.registrarComprobante).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        userId: 'user-1',
        tipoComprobanteId: 'voucher-type-ci',
        periodoId: 'period-2026-11',
        fecha: new Date('2026-11-03T00:00:00.000Z'),
        origenTipo: 'BILLING_RECEIPT',
        origenId: 'receipt-1',
        origenEvento: 'POSTED',
        lineas: [
          expect.objectContaining({
            cuentaId: 'account-bank',
            debito: new Prisma.Decimal(40_000),
          }) as unknown,
          expect.objectContaining({
            cuentaId: 'account-ar',
            terceroId: 'third-party-1',
            credito: new Prisma.Decimal(40_000),
          }),
        ],
      }),
      tx,
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'BILLING_CUSTOMER_RECEIPT_POSTED',
        entityId: 'receipt-1',
      }),
      tx,
    );
  });

  it('rechaza si las aplicaciones no suman exactamente el valor recibido', async () => {
    await expect(
      service.create('tenant-1', 'user-1', {
        ...dto,
        aplicaciones: [{ invoiceId: 'invoice-1', amount: 39_999 }],
      }),
    ).rejects.toThrow(BadRequestException);
    expect(tenantPrisma.execute).not.toHaveBeenCalled();
  });

  it('no permite aplicar por encima del saldo bajo bloqueo de la factura', async () => {
    tx.$queryRaw.mockImplementation((strings: TemplateStringsArray) =>
      Promise.resolve(
        strings.join('').includes('invoice_receipt_allocations')
          ? [{ invoiceId: 'invoice-1', applied: new Prisma.Decimal(120_000) }]
          : [],
      ),
    );

    await expect(
      service.create('tenant-1', 'user-1', {
        ...dto,
        monto: 7_000,
        aplicaciones: [{ invoiceId: 'invoice-1', amount: 7_000 }],
        idempotencyKey: '105b05bd-4641-4236-9d92-f43ecfe73b82',
      }),
    ).rejects.toThrow('saldo pendiente de 6000.00');
    expect(tx.customerReceipt.create).not.toHaveBeenCalled();
    expect(ledger.registrarComprobante).not.toHaveBeenCalled();
  });

  it('devuelve el recaudo previo si se repite la misma solicitud con su clave', async () => {
    await service.create('tenant-1', 'user-1', dto);
    const requestHash = createdReceiptInputs[0].data.requestHash;
    tx.customerReceipt.findUnique.mockResolvedValue({
      id: 'receipt-1',
      requestHash,
    });

    const replay = await service.create('tenant-1', 'user-1', dto);

    expect(replay).toEqual(expect.objectContaining({ id: 'receipt-1' }));
    expect(tx.customerReceipt.create).toHaveBeenCalledTimes(1);
    expect(ledger.registrarComprobante).toHaveBeenCalledTimes(1);
  });

  it('rechecks idempotency after a concurrent request releases the invoice lock', async () => {
    await service.create('tenant-1', 'user-1', dto);
    const requestHash = createdReceiptInputs[0]?.data.requestHash;
    tx.customerReceipt.findUnique.mockReset();
    tx.customerReceipt.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'receipt-1', requestHash });
    const invoiceReadCount = tx.invoice.findMany.mock.calls.length;

    const replay = await service.create('tenant-1', 'user-1', dto);

    expect(tx.customerReceipt.findUnique).toHaveBeenCalledTimes(2);
    expect(tx.invoice.findMany).toHaveBeenCalledTimes(invoiceReadCount);
    expect(createdReceiptInputs).toHaveLength(1);
    expect(ledger.registrarComprobante).toHaveBeenCalledTimes(1);
    expect(replay).toEqual(expect.objectContaining({ id: 'receipt-1' }));
  });

  it('rechaza reutilizar la clave de idempotencia con otro contenido', async () => {
    tx.customerReceipt.findUnique.mockResolvedValue({
      id: 'receipt-1',
      requestHash: 'hash-de-otra-solicitud',
    });

    await expect(
      service.create('tenant-1', 'user-1', {
        ...dto,
        referencia: 'TRX-DIFERENTE',
      }),
    ).rejects.toThrow('La clave de idempotencia ya se usó con otros datos.');
    expect(tx.customerReceipt.create).not.toHaveBeenCalled();
    expect(ledger.registrarComprobante).not.toHaveBeenCalled();
  });

  it('rechaza la fecha si encuentra períodos contables abiertos superpuestos', async () => {
    tx.periodoContable.findMany.mockResolvedValue([
      { id: 'period-2026-11' },
      { id: 'period-overlap' },
    ]);

    await expect(service.create('tenant-1', 'user-1', dto)).rejects.toThrow(
      'Hay períodos contables abiertos superpuestos para la fecha del recaudo.',
    );
    expect(tx.customerReceipt.create).not.toHaveBeenCalled();
    expect(ledger.registrarComprobante).not.toHaveBeenCalled();
  });

  it('reverses the ledger voucher and preserves the receipt reversal event', async () => {
    tx.customerReceipt.findFirst
      .mockResolvedValueOnce({
        id: 'receipt-1',
        aplicaciones: [{ invoiceId: 'invoice-1' }],
      })
      .mockResolvedValueOnce({ id: 'receipt-1', reversal: null });
    tx.comprobanteContable.findFirst.mockResolvedValue({
      id: 'receipt-voucher-1',
      estado: 'CONTABILIZADO',
    });

    const result = await service.reverse('tenant-1', 'admin-1', 'receipt-1', {
      reason: 'Transferencia duplicada',
    });

    expect(ledger.anular).toHaveBeenCalledWith(
      'tenant-1',
      'admin-1',
      'receipt-voucher-1',
      'Transferencia duplicada',
      tx,
    );
    expect(tx.customerReceiptReversal.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        receiptId: 'receipt-1',
        reason: 'Transferencia duplicada',
        reversedById: 'admin-1',
        originalVoucherId: 'receipt-voucher-1',
        reversalVoucherId: 'receipt-reversal-1',
      }) as unknown,
    });
    expect(result).toEqual(expect.objectContaining({ id: 'reversal-1' }));
  });
});
