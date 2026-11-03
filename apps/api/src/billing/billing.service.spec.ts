import { BadRequestException } from '@nestjs/common';
import { InvoiceStatus as PrismaInvoiceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import { LedgerService } from '../accounting/ledger/ledger.service';
import type { RegistrarComprobanteInput } from '../accounting/ledger/ledger.types';
import { AuditService } from '../audit/audit.service';
import { BillingService } from './billing.service';

describe('BillingService', () => {
  const prismaMock = {
    customer: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    tercero: { findFirst: jest.fn() },
    productService: { findMany: jest.fn() },
    invoice: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    comprobanteContable: { findFirst: jest.fn() },
  };
  const tenantPrismaMock = { execute: jest.fn() };
  const ledgerMock = { registrarComprobante: jest.fn(), anular: jest.fn() };
  const auditMock = { log: jest.fn() };
  const createdInvoiceInputs: unknown[] = [];
  const createdCustomerInputs: unknown[] = [];
  const registeredVoucherInputs: Array<{
    input: RegistrarComprobanteInput;
    tx: unknown;
  }> = [];
  const invoiceUpdateInputs: unknown[] = [];
  const auditInputs: unknown[] = [];
  const periodQueryInputs: unknown[] = [];
  const txMock = {
    $queryRaw: jest.fn(),
    invoice: { findFirst: jest.fn(), update: jest.fn() },
    customer: { findFirst: jest.fn() },
    tercero: { findFirst: jest.fn() },
    periodoContable: { findFirst: jest.fn() },
    cuentaSistemaMap: { findMany: jest.fn() },
    tipoComprobante: { findFirst: jest.fn() },
    comprobanteContable: { findFirst: jest.fn() },
  };

  let service: BillingService;

  beforeEach(() => {
    jest.clearAllMocks();
    createdInvoiceInputs.length = 0;
    createdCustomerInputs.length = 0;
    registeredVoucherInputs.length = 0;
    invoiceUpdateInputs.length = 0;
    auditInputs.length = 0;
    periodQueryInputs.length = 0;
    tenantPrismaMock.execute.mockImplementation((work: unknown) =>
      (work as (client: typeof txMock) => unknown)(txMock),
    );
    prismaMock.customer.findUnique.mockResolvedValue(null);
    prismaMock.customer.findFirst.mockResolvedValue({
      id: 'customer-1',
      razonSocial: 'Cliente Demo SAS',
      nit: '900123456-7',
      status: 'ACTIVE',
    });
    prismaMock.tercero.findFirst.mockResolvedValue(null);
    prismaMock.customer.create.mockImplementation((input: unknown) => {
      createdCustomerInputs.push(input);
      return Promise.resolve({ id: 'customer-1' });
    });
    prismaMock.productService.findMany.mockResolvedValue([
      { id: 'product-1', impuesto: new Prisma.Decimal(19) },
    ]);
    prismaMock.invoice.create.mockImplementation((input: unknown) => {
      createdInvoiceInputs.push(input);
      return Promise.resolve({ id: 'invoice-1' });
    });
    prismaMock.invoice.findMany.mockResolvedValue([]);
    prismaMock.invoice.findFirst.mockResolvedValue(null);
    prismaMock.comprobanteContable.findFirst.mockResolvedValue(null);
    txMock.invoice.findFirst.mockResolvedValue(null);
    txMock.$queryRaw.mockResolvedValue([]);
    txMock.invoice.update.mockResolvedValue({ id: 'invoice-1' });
    txMock.customer.findFirst.mockResolvedValue(null);
    txMock.tercero.findFirst.mockResolvedValue(null);
    txMock.periodoContable.findFirst.mockResolvedValue(null);
    txMock.cuentaSistemaMap.findMany.mockResolvedValue([]);
    txMock.tipoComprobante.findFirst.mockResolvedValue(null);
    txMock.comprobanteContable.findFirst.mockResolvedValue(null);
    ledgerMock.registrarComprobante.mockResolvedValue({
      id: 'voucher-1',
      numero: 1,
    });
    ledgerMock.registrarComprobante.mockImplementation(
      (input: RegistrarComprobanteInput, tx: unknown) => {
        registeredVoucherInputs.push({ input, tx });
        return Promise.resolve({ id: 'voucher-1', numero: 1 });
      },
    );
    ledgerMock.anular.mockResolvedValue({ id: 'reversal-1', numero: 2 });
    auditMock.log.mockImplementation((input: unknown) => {
      auditInputs.push(input);
      return Promise.resolve(undefined);
    });
    service = new BillingService(
      prismaMock as unknown as PrismaService,
      tenantPrismaMock as unknown as TenantPrismaService,
      ledgerMock as unknown as LedgerService,
      auditMock as unknown as AuditService,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const invoiceDto = {
    customerId: 'customer-1',
    numero: 'FV-001',
    fechaVencimiento: '2099-12-31',
    items: [
      {
        productServiceId: 'product-1',
        descripcion: 'Servicio educativo',
        cantidad: 1,
        valorUnitario: 100_000,
        porcentajeImpuesto: 5,
      },
    ],
  };

  it('vincula un cliente al tercero activo del mismo tenant con NIT coincidente', async () => {
    prismaMock.customer.findFirst.mockResolvedValue(null);
    prismaMock.tercero.findFirst.mockResolvedValue({
      id: 'third-party-1',
      tenantId: 'tenant-1',
      tipoDocumento: 'NIT',
      numeroDocumento: '900123456',
      digitoVerificacion: '7',
      esCliente: true,
      activo: true,
      deletedAt: null,
    });

    await service.createCustomer('tenant-1', {
      razonSocial: 'Cliente Demo SAS',
      nit: '900123456-7',
      terceroId: 'third-party-1',
    });

    expect(prismaMock.tercero.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'third-party-1',
        tenantId: 'tenant-1',
        tipoDocumento: 'NIT',
        esCliente: true,
        activo: true,
        deletedAt: null,
      },
    });
    const createInput = createdCustomerInputs[0] as {
      data: { tenantId: string; terceroId: string };
    };
    expect(createInput.data).toMatchObject({
      tenantId: 'tenant-1',
      terceroId: 'third-party-1',
    });
  });

  it('rechaza vincular un tercero cuyo NIT no coincide con el cliente', async () => {
    prismaMock.customer.findFirst.mockResolvedValue(null);
    prismaMock.tercero.findFirst.mockResolvedValue({
      id: 'third-party-1',
      tenantId: 'tenant-1',
      tipoDocumento: 'NIT',
      numeroDocumento: '900123456',
      digitoVerificacion: '7',
      esCliente: true,
      activo: true,
      deletedAt: null,
    });

    await expect(
      service.createCustomer('tenant-1', {
        razonSocial: 'Cliente Demo SAS',
        nit: '800000000-1',
        terceroId: 'third-party-1',
      }),
    ).rejects.toThrow('no coincide con el documento del tercero');
    expect(prismaMock.customer.create).not.toHaveBeenCalled();
  });

  it('valida que los productos estén activos y pertenezcan al tenant', async () => {
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

  it('rechaza crear una factura sin líneas', async () => {
    await expect(
      service.createInvoice('tenant-1', { ...invoiceDto, items: [] }),
    ).rejects.toThrow('La factura debe tener al menos una línea');

    expect(prismaMock.customer.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.invoice.create).not.toHaveBeenCalled();
  });

  it('rechaza una fecha de vencimiento imposible antes de consultar el cliente', async () => {
    await expect(
      service.createInvoice('tenant-1', {
        ...invoiceDto,
        fechaVencimiento: '2026-02-31',
      }),
    ).rejects.toThrow('La fecha de vencimiento no es válida.');
    expect(prismaMock.customer.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.invoice.create).not.toHaveBeenCalled();
  });

  it('congela el impuesto configurado del producto y redondea cada línea a dos decimales', async () => {
    prismaMock.productService.findMany.mockResolvedValue([
      { id: 'product-1', impuesto: new Prisma.Decimal(5) },
    ]);
    await service.createInvoice('tenant-1', {
      ...invoiceDto,
      items: [{ ...invoiceDto.items[0], cantidad: 1, valorUnitario: 100.1 }],
    });

    const create = createdInvoiceInputs[0] as {
      data: {
        items: { create: Array<Record<string, unknown>> };
        subtotal: string;
        impuestos: string;
        total: string;
      };
    };
    expect(create.data.items.create[0]).toMatchObject({
      porcentajeImpuesto: '5.00',
      valorImpuesto: '5.01',
      subtotal: '100.10',
    });
    expect(create.data.subtotal).toBe('100.10');
    expect(create.data.impuestos).toBe('5.01');
    expect(create.data.total).toBe('105.11');
  });

  it('usa la tasa explícita de las líneas manuales', async () => {
    await service.createInvoice('tenant-1', {
      ...invoiceDto,
      items: [
        {
          ...invoiceDto.items[0],
          productServiceId: undefined,
          porcentajeImpuesto: 0,
        },
      ],
    });

    expect(prismaMock.productService.findMany).not.toHaveBeenCalled();
    const create = createdInvoiceInputs[0] as {
      data: {
        items: { create: Array<Record<string, unknown>> };
        total: string;
      };
    };
    expect(create.data.items.create[0]).toMatchObject({
      porcentajeImpuesto: '0.00',
      valorImpuesto: '0.00',
    });
    expect(create.data.total).toBe('100000.00');
  });

  it('consulta una sola vez cada producto aunque aparezca en varias líneas', async () => {
    await service.createInvoice('tenant-1', {
      ...invoiceDto,
      items: [invoiceDto.items[0], { ...invoiceDto.items[0] }],
    });

    expect(prismaMock.productService.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.productService.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        id: { in: ['product-1'] },
        activo: true,
      },
      select: { id: true, impuesto: true },
    });
  });

  const preparedInvoice = (
    status: PrismaInvoiceStatus = PrismaInvoiceStatus.DRAFT,
  ) => ({
    id: 'invoice-1',
    tenantId: 'tenant-1',
    customerId: 'customer-1',
    numero: 'FV-001',
    status,
    customerRazonSocialSnapshot: 'Cliente Demo SAS',
    customerNitSnapshot: '900123456-7',
    subtotal: new Prisma.Decimal(100),
    impuestos: new Prisma.Decimal(19),
    total: new Prisma.Decimal(119),
    fechaVencimiento: new Date('2099-12-31T00:00:00.000Z'),
    items: [
      {
        subtotal: new Prisma.Decimal(100),
        porcentajeImpuesto: new Prisma.Decimal(19),
        valorImpuesto: new Prisma.Decimal(19),
      },
    ],
  });

  function prepareIssueMocks() {
    txMock.invoice.findFirst.mockResolvedValue(preparedInvoice());
    txMock.customer.findFirst.mockImplementation(
      ({ where }: { where: Record<string, unknown> }) =>
        where.id === 'customer-1'
          ? {
              id: 'customer-1',
              tenantId: 'tenant-1',
              status: 'ACTIVE',
              razonSocial: 'Cliente Demo SAS',
              nit: '900123456-7',
              terceroId: 'third-party-1',
            }
          : null,
    );
    txMock.tercero.findFirst.mockResolvedValue({
      id: 'third-party-1',
      tenantId: 'tenant-1',
      tipoDocumento: 'NIT',
      numeroDocumento: '900123456',
      digitoVerificacion: '7',
      tipoPersona: 'JURIDICA',
      razonSocial: 'Cliente Demo SAS',
      primerNombre: null,
      segundoNombre: null,
      primerApellido: null,
      segundoApellido: null,
      activo: true,
      esCliente: true,
      deletedAt: null,
    });
    txMock.periodoContable.findFirst.mockImplementation((input: unknown) => {
      periodQueryInputs.push(input);
      return Promise.resolve({ id: 'period-1' });
    });
    txMock.cuentaSistemaMap.findMany.mockResolvedValue([
      { rol: 'CLIENTES_NACIONALES', cuentaId: 'account-ar' },
      { rol: 'INGRESOS_OPERACIONALES', cuentaId: 'account-revenue' },
      { rol: 'IVA_GENERADO', cuentaId: 'account-tax' },
    ]);
    txMock.tipoComprobante.findFirst.mockResolvedValue({
      id: 'voucher-type-fv',
    });
    txMock.invoice.update.mockImplementation((input: unknown) => {
      invoiceUpdateInputs.push(input);
      const { data } = input as { data: Record<string, unknown> };
      return {
        ...preparedInvoice(PrismaInvoiceStatus.ISSUED),
        ...data,
        terceroId: 'third-party-1',
      };
    });
  }

  it('emite y contabiliza en la misma transacción con tercero, período y origen', async () => {
    prepareIssueMocks();

    const result = await service.updateInvoiceStatus(
      'tenant-1',
      'user-1',
      'invoice-1',
      {
        status: PrismaInvoiceStatus.ISSUED,
      },
    );

    expect(tenantPrismaMock.execute).toHaveBeenCalledTimes(1);
    expect(registeredVoucherInputs).toHaveLength(1);
    expect(registeredVoucherInputs[0]?.input).toMatchObject({
      tenantId: 'tenant-1',
      userId: 'user-1',
      periodoId: 'period-1',
      origenTipo: 'BILLING_INVOICE',
      origenId: 'invoice-1',
      origenEvento: 'ISSUED',
    });
    expect(registeredVoucherInputs[0]?.input.lineas).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          terceroId: 'third-party-1',
          debito: new Prisma.Decimal(119),
        }),
      ]),
    );
    expect(registeredVoucherInputs[0]?.tx).toBe(txMock);
    const invoiceUpdate = invoiceUpdateInputs[0] as {
      data: {
        status: PrismaInvoiceStatus;
        customerRazonSocialSnapshot: string;
        customerNitSnapshot: string;
        terceroRazonSocialSnapshot: string;
      };
    };
    expect(invoiceUpdate.data.status).toBe(PrismaInvoiceStatus.ISSUED);
    expect(invoiceUpdate.data).toMatchObject({
      customerRazonSocialSnapshot: 'Cliente Demo SAS',
      customerNitSnapshot: '900123456-7',
      terceroRazonSocialSnapshot: 'Cliente Demo SAS',
    });
    expect(result).toEqual(
      expect.objectContaining({
        comprobanteContable: { id: 'voucher-1', numero: 1 },
      }),
    );
  });

  it('usa la fecha calendario de Bogotá al seleccionar el período contable', async () => {
    const emittedAt = new Date('2026-11-01T02:30:00.000Z');
    jest.useFakeTimers().setSystemTime(emittedAt);
    prepareIssueMocks();

    await service.updateInvoiceStatus('tenant-1', 'user-1', 'invoice-1', {
      status: PrismaInvoiceStatus.ISSUED,
    });

    const periodQuery = periodQueryInputs[0];
    expect(periodQuery).toEqual({
      where: {
        tenantId: 'tenant-1',
        estado: 'ABIERTO',
        fechaInicio: { lte: new Date('2026-10-31T00:00:00.000Z') },
        fechaFin: { gte: new Date('2026-10-31T00:00:00.000Z') },
      },
    });
    expect(registeredVoucherInputs[0]?.input.fecha).toEqual(
      new Date('2026-10-31T00:00:00.000Z'),
    );
    const invoiceUpdate = invoiceUpdateInputs[0] as {
      data: { fechaEmision: Date };
    };
    expect(invoiceUpdate.data.fechaEmision).toEqual(emittedAt);
  });

  it('impide emitir una factura cuyo vencimiento antecede la fecha comercial de emisión', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-03T15:00:00.000Z'));
    const invoice = preparedInvoice();
    invoice.fechaVencimiento = new Date('2026-11-02T00:00:00.000Z');
    txMock.invoice.findFirst.mockResolvedValue(invoice);
    prepareIssueMocks();
    txMock.invoice.findFirst.mockResolvedValue(invoice);

    await expect(
      service.updateInvoiceStatus('tenant-1', 'user-1', 'invoice-1', {
        status: PrismaInvoiceStatus.ISSUED,
      }),
    ).rejects.toThrow(
      'La fecha de vencimiento debe ser igual o posterior a la fecha de emisión.',
    );
    expect(ledgerMock.registrarComprobante).not.toHaveBeenCalled();
    expect(txMock.invoice.update).not.toHaveBeenCalled();
  });

  it('permite emitir borradores históricos sin vencimiento', async () => {
    const invoice = preparedInvoice();
    invoice.fechaVencimiento = null as unknown as Date;
    prepareIssueMocks();
    txMock.invoice.findFirst.mockResolvedValue(invoice);

    await expect(
      service.updateInvoiceStatus('tenant-1', 'user-1', 'invoice-1', {
        status: PrismaInvoiceStatus.ISSUED,
      }),
    ).resolves.toEqual(
      expect.objectContaining({ status: PrismaInvoiceStatus.ISSUED }),
    );
    expect(ledgerMock.registrarComprobante).toHaveBeenCalledTimes(1);
    expect(txMock.invoice.update).toHaveBeenCalledTimes(1);
  });

  it('no contabiliza borradores históricos sin snapshots tributarios', async () => {
    const invoice = preparedInvoice();
    invoice.items[0].porcentajeImpuesto = null as unknown as Prisma.Decimal;
    txMock.invoice.findFirst.mockResolvedValue(invoice);

    await expect(
      service.updateInvoiceStatus('tenant-1', 'user-1', 'invoice-1', {
        status: PrismaInvoiceStatus.ISSUED,
      }),
    ).rejects.toThrow('Cree una factura nueva para emitirla');
    expect(ledgerMock.registrarComprobante).not.toHaveBeenCalled();
    expect(txMock.invoice.update).not.toHaveBeenCalled();
  });

  it('cancela factura emitida mediante reversión Ledger y conserva su registro', async () => {
    txMock.invoice.findFirst.mockResolvedValue(
      preparedInvoice(PrismaInvoiceStatus.ISSUED),
    );
    txMock.comprobanteContable.findFirst.mockResolvedValue({
      id: 'voucher-1',
      numero: 1,
    });
    txMock.invoice.update.mockResolvedValue({
      ...preparedInvoice(PrismaInvoiceStatus.ISSUED),
      status: PrismaInvoiceStatus.CANCELLED,
    });

    await service.updateInvoiceStatus('tenant-1', 'user-1', 'invoice-1', {
      status: PrismaInvoiceStatus.CANCELLED,
      motivo: 'Factura de prueba',
    });

    expect(ledgerMock.anular).toHaveBeenCalledWith(
      'tenant-1',
      'user-1',
      'voucher-1',
      'Factura de prueba',
      txMock,
    );
    expect(txMock.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'CANCELLED' } }),
    );
    expect(auditMock.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'BILLING_INVOICE_CANCELLED' }),
      txMock,
    );
  });

  it('impide cancelar una factura con un recaudo activo', async () => {
    txMock.invoice.findFirst.mockResolvedValue(
      preparedInvoice(PrismaInvoiceStatus.ISSUED),
    );
    txMock.$queryRaw.mockImplementation((strings: TemplateStringsArray) =>
      Promise.resolve(
        strings.join('').includes('invoice_receipt_allocations')
          ? [{ invoiceId: 'invoice-1', applied: new Prisma.Decimal(10_000) }]
          : [],
      ),
    );

    await expect(
      service.updateInvoiceStatus('tenant-1', 'user-1', 'invoice-1', {
        status: PrismaInvoiceStatus.CANCELLED,
        motivo: 'Cancelación de prueba',
      }),
    ).rejects.toThrow('Revierta primero los recaudos activos');

    expect(txMock.invoice.update).not.toHaveBeenCalled();
    expect(ledgerMock.anular).not.toHaveBeenCalled();
  });

  it('calcula los saldos de recaudos dentro del contexto tenant-aware', async () => {
    const invoice = {
      id: 'invoice-1',
      status: PrismaInvoiceStatus.ISSUED,
      total: new Prisma.Decimal(100_000),
    };
    prismaMock.invoice.findMany.mockResolvedValue([invoice]);
    prismaMock.invoice.findFirst.mockResolvedValue(invoice);
    txMock.$queryRaw.mockResolvedValue([
      { invoiceId: 'invoice-1', applied: new Prisma.Decimal(25_000) },
    ]);

    const listed = await service.findAllInvoices('tenant-1');
    const detail = await service.findOneInvoice('tenant-1', 'invoice-1');

    expect(tenantPrismaMock.execute).toHaveBeenCalledTimes(2);
    expect(listed[0].totalPagado).toEqual(new Prisma.Decimal(25_000));
    expect(listed[0].saldoPendiente).toEqual(new Prisma.Decimal(75_000));
    expect(detail.totalPagado).toEqual(new Prisma.Decimal(25_000));
    expect(detail.saldoPendiente).toEqual(new Prisma.Decimal(75_000));
  });

  it('permite cancelar con auditoría una factura histórica emitida sin asiento', async () => {
    txMock.invoice.findFirst.mockResolvedValue(
      preparedInvoice(PrismaInvoiceStatus.ISSUED),
    );
    txMock.comprobanteContable.findFirst.mockResolvedValue(null);
    txMock.invoice.update.mockResolvedValue({
      ...preparedInvoice(PrismaInvoiceStatus.ISSUED),
      status: PrismaInvoiceStatus.CANCELLED,
    });

    const result = await service.updateInvoiceStatus(
      'tenant-1',
      'user-1',
      'invoice-1',
      {
        status: PrismaInvoiceStatus.CANCELLED,
        motivo: 'Depuración histórica',
      },
    );

    expect(ledgerMock.anular).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        status: PrismaInvoiceStatus.CANCELLED,
        comprobanteContable: null,
        reversoContable: null,
      }),
    );
    const auditInput = auditInputs[0] as {
      action: string;
      metadata: Record<string, unknown>;
    };
    expect(auditInput.action).toBe('BILLING_INVOICE_CANCELLED');
    expect(auditInput.metadata).toMatchObject({
      motivo: 'Depuración histórica',
      comprobanteOriginalId: null,
      reversoId: null,
      facturaEmitidaSinComprobante: true,
    });
  });
});
