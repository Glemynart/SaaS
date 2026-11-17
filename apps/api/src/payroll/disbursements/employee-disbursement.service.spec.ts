import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  EmployeeDisbursementMethod,
  EmployeeDisbursementStatus,
  PayrollPeriodStatus,
  Prisma,
} from '@prisma/client';
import { createHash } from 'node:crypto';
import { AuditService } from '../../audit/audit.service';
import { StorageService } from '../../storage/storage.service';
import { TenantPrismaService } from '../../tenant-prisma/tenant-prisma.service';
import { EmployeeDisbursementSourceType } from './employee-disbursement.dto';
import { EmployeeDisbursementService } from './employee-disbursement.service';

const TENANT_ID = 'tenant-a';
const USER_ID = 'user-a';
const EMPLOYEE_ID = 'employee-a';
const RUN_ID = 'run-a';
const PAYMENT_ID = 'payment-a';
const IDEMPOTENCY_KEY = 'payment-idem-0001';
const PDF = Buffer.from('%PDF-1.7 test evidence');
const PDF_SHA256 = createHash('sha256').update(PDF).digest('hex');

const makePayrollRun = (overrides: Record<string, unknown> = {}) => ({
  id: RUN_ID,
  employeeId: EMPLOYEE_ID,
  netoPagar: new Prisma.Decimal(100_000),
  payrollPeriod: {
    status: PayrollPeriodStatus.CAUSADA,
    fechaInicio: new Date('2026-01-01T00:00:00.000Z'),
    fechaFin: new Date('2026-01-31T00:00:00.000Z'),
  },
  ...overrides,
});

const makePayment = (overrides: Record<string, unknown> = {}) => ({
  id: PAYMENT_ID,
  tenantId: TENANT_ID,
  employeeId: EMPLOYEE_ID,
  payrollRunId: RUN_ID,
  liquidationId: null,
  amount: new Prisma.Decimal(40_000),
  currency: 'COP',
  paidAt: new Date('2026-01-15T00:00:00.000Z'),
  method: EmployeeDisbursementMethod.BANK_TRANSFER,
  reference: null,
  idempotencyKey: IDEMPOTENCY_KEY,
  status: EmployeeDisbursementStatus.DECLARED,
  supportStorageKey: null,
  supportMimeType: null,
  supportSizeBytes: null,
  supportSha256: null,
  supportedAt: null,
  registeredByUserId: USER_ID,
  verifiedByUserId: null,
  verifiedAt: null,
  cancelledByUserId: null,
  cancelledAt: null,
  cancellationReason: null,
  createdAt: new Date('2026-01-15T00:00:00.000Z'),
  updatedAt: new Date('2026-01-15T00:00:00.000Z'),
  reversals: [],
  ...overrides,
});

describe('EmployeeDisbursementService', () => {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: EMPLOYEE_ID }]),
    payrollRun: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    liquidation: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    employeeDisbursement: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    employeeDisbursementReversal: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };
  const tenantPrisma = {
    execute: jest.fn((work: (client: typeof tx) => unknown) => work(tx)),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const storage = {
    putObject: jest.fn(
      ({ key, body }: { key: string; body: Buffer; contentType: string }) =>
        Promise.resolve({ key, size: body.length }),
    ),
    getObject: jest.fn().mockResolvedValue(PDF),
    deleteObject: jest.fn().mockResolvedValue(undefined),
    objectExists: jest.fn().mockResolvedValue(true),
  };
  const service = new EmployeeDisbursementService(
    tenantPrisma as unknown as TenantPrismaService,
    audit as unknown as AuditService,
    storage as unknown as StorageService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    tx.$queryRaw.mockResolvedValue([{ id: EMPLOYEE_ID }]);
    tx.payrollRun.findFirst.mockResolvedValue(makePayrollRun());
    tx.payrollRun.findMany.mockResolvedValue([]);
    tx.payrollRun.count.mockResolvedValue(0);
    tx.liquidation.findFirst.mockResolvedValue(null);
    tx.liquidation.findMany.mockResolvedValue([]);
    tx.liquidation.count.mockResolvedValue(0);
    tx.employeeDisbursement.findFirst.mockResolvedValue(null);
    tx.employeeDisbursement.findMany.mockResolvedValue([]);
    tx.employeeDisbursement.count.mockResolvedValue(0);
    tx.employeeDisbursement.create.mockImplementation(({ data }) =>
      Promise.resolve(makePayment(data as Record<string, unknown>)),
    );
    tx.employeeDisbursement.update.mockImplementation(({ data }) =>
      Promise.resolve(makePayment(data as Record<string, unknown>)),
    );
    tx.employeeDisbursementReversal.findFirst.mockResolvedValue(null);
    tx.employeeDisbursementReversal.create.mockImplementation(({ data }) =>
      Promise.resolve({
        id: 'reversal-a',
        disbursementId: PAYMENT_ID,
        amount: new Prisma.Decimal(10_000),
        reason: 'Reintegro confirmado',
        createdByUserId: USER_ID,
        createdAt: new Date('2026-01-20T00:00:00.000Z'),
        ...data,
      }),
    );
    storage.getObject.mockResolvedValue(PDF);
    storage.objectExists.mockResolvedValue(true);
    storage.deleteObject.mockResolvedValue(undefined);
    audit.log.mockResolvedValue(undefined);
  });

  const createDto = {
    sourceType: EmployeeDisbursementSourceType.PAYROLL_RUN,
    sourceId: RUN_ID,
    amount: '40000.00',
    paidAt: '2026-01-15',
    method: EmployeeDisbursementMethod.BANK_TRANSFER,
    idempotencyKey: IDEMPOTENCY_KEY,
  };

  it('registra el desembolso como DECLARED y no lo considera verificado', async () => {
    const result = await service.create(TENANT_ID, USER_ID, createDto);

    expect(result.status).toBe(EmployeeDisbursementStatus.DECLARED);
    expect(tx.employeeDisbursement.create).toHaveBeenCalledTimes(1);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'EMPLOYEE_DISBURSEMENT_DECLARED' }),
      tx,
    );
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2); // idempotency + tenant employee lock
  });

  it('lista únicamente obligaciones de nómina del tenant y estados aptos', async () => {
    tx.payrollRun.findMany.mockResolvedValue([
      {
        id: RUN_ID,
        netoPagar: new Prisma.Decimal(100_000),
        employee: {
          id: EMPLOYEE_ID,
          primerNombre: 'Valentina',
          segundoNombre: null,
          primerApellido: 'Martínez',
          segundoApellido: null,
          cedula: '12345678',
        },
        payrollPeriod: {
          id: 'period-a',
          nombre: 'Noviembre',
          fechaInicio: new Date('2026-11-01T00:00:00.000Z'),
          fechaFin: new Date('2026-11-30T00:00:00.000Z'),
          status: PayrollPeriodStatus.CAUSADA,
        },
      },
    ]);
    tx.payrollRun.count.mockResolvedValue(1);

    const result = await service.listObligations(TENANT_ID, {
      sourceType: EmployeeDisbursementSourceType.PAYROLL_RUN,
      page: 1,
      limit: 25,
    });

    expect(result.data).toEqual([
      expect.objectContaining({
        sourceType: EmployeeDisbursementSourceType.PAYROLL_RUN,
        sourceId: RUN_ID,
        amountDue: '100000.00',
        employee: {
          id: EMPLOYEE_ID,
          name: 'Valentina Martínez',
          document: '12345678',
        },
      }),
    ]);
    const payrollRunCalls = tx.payrollRun.findMany.mock
      .calls as unknown as Array<
      [{ where: Prisma.PayrollRunWhereInput; take: number }]
    >;
    const payrollRunQuery = payrollRunCalls[0]?.[0];
    expect(payrollRunQuery).toBeDefined();
    expect(payrollRunQuery?.where.tenantId).toBe(TENANT_ID);
    expect(payrollRunQuery?.take).toBe(25);
  });

  it('lista obligaciones aprobadas de liquidación con su beneficiario derivado', async () => {
    tx.liquidation.findMany.mockResolvedValue([
      {
        id: 'liquidation-a',
        status: 'APPROVED',
        totalLiquidacion: new Prisma.Decimal(250_000),
        fechaRetiro: new Date('2026-10-31T00:00:00.000Z'),
        empleado: {
          id: EMPLOYEE_ID,
          primerNombre: 'Mateo',
          segundoNombre: 'Andrés',
          primerApellido: 'López',
          segundoApellido: null,
          cedula: '87654321',
        },
      },
    ]);
    tx.liquidation.count.mockResolvedValue(1);

    const result = await service.listObligations(TENANT_ID, {
      sourceType: EmployeeDisbursementSourceType.LIQUIDATION,
      page: 1,
      limit: 25,
    });

    expect(result.data[0]).toMatchObject({
      sourceType: EmployeeDisbursementSourceType.LIQUIDATION,
      sourceId: 'liquidation-a',
      amountDue: '250000.00',
      employee: { id: EMPLOYEE_ID, name: 'Mateo Andrés López' },
    });
    const liquidationCalls = tx.liquidation.findMany.mock
      .calls as unknown as Array<[{ where: Prisma.LiquidationWhereInput }]>;
    const liquidationQuery = liquidationCalls[0]?.[0];
    expect(liquidationQuery).toBeDefined();
    expect(liquidationQuery?.where.tenantId).toBe(TENANT_ID);
  });

  it('devuelve solo desembolsos SUPPORTED de la organización en la cola de revisión', async () => {
    tx.employeeDisbursement.findMany.mockResolvedValue([
      makePayment({
        status: EmployeeDisbursementStatus.SUPPORTED,
        supportStorageKey: `tenants/${TENANT_ID}/employee-disbursements/${PAYMENT_ID}/00000000-0000-4000-8000-000000000000.pdf`,
        supportMimeType: 'application/pdf',
        supportSizeBytes: PDF.length,
        supportSha256: PDF_SHA256,
        supportedAt: new Date('2026-01-16T00:00:00.000Z'),
        reversals: [],
        employee: {
          id: EMPLOYEE_ID,
          primerNombre: 'Valentina',
          segundoNombre: null,
          primerApellido: 'Martínez',
          segundoApellido: null,
          cedula: '12345678',
        },
        payrollRun: {
          id: RUN_ID,
          netoPagar: new Prisma.Decimal(100_000),
          payrollPeriod: {
            nombre: 'Enero',
            fechaInicio: new Date('2026-01-01T00:00:00.000Z'),
            fechaFin: new Date('2026-01-31T00:00:00.000Z'),
          },
        },
        liquidation: null,
      }),
    ]);
    tx.employeeDisbursement.count.mockResolvedValue(1);

    const result = await service.listPendingVerification(TENANT_ID, {
      page: 1,
      limit: 25,
    });

    expect(result.data[0]).toMatchObject({
      status: EmployeeDisbursementStatus.SUPPORTED,
      sourceLabel: 'Nómina · Enero',
      employee: { name: 'Valentina Martínez', document: '12345678' },
    });
    expect(tx.employeeDisbursement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: TENANT_ID,
          status: EmployeeDisbursementStatus.SUPPORTED,
        },
        take: 25,
      }),
    );
  });

  it('hace idempotente el alta y rechaza reutilizar la clave con otros datos', async () => {
    const existing = makePayment();
    tx.employeeDisbursement.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existing);

    await service.create(TENANT_ID, USER_ID, createDto);
    const retry = await service.create(TENANT_ID, USER_ID, createDto);

    expect(retry.id).toBe(PAYMENT_ID);
    expect(tx.employeeDisbursement.create).toHaveBeenCalledTimes(1);
    tx.employeeDisbursement.findFirst.mockResolvedValue(existing);
    await expect(
      service.create(TENANT_ID, USER_ID, { ...createDto, amount: '50000' }),
    ).rejects.toThrow(ConflictException);
  });

  it('rechaza pagos mayores al saldo no reservado de la obligación', async () => {
    tx.employeeDisbursement.findMany.mockResolvedValue([
      makePayment({ amount: new Prisma.Decimal(90_000) }),
    ]);

    await expect(service.create(TENANT_ID, USER_ID, createDto)).rejects.toThrow(
      ConflictException,
    );
    expect(tx.employeeDisbursement.create).not.toHaveBeenCalled();
  });

  it('adjunta soporte privado y guarda su tamaño y huella', async () => {
    const declared = makePayment();
    tx.employeeDisbursement.findFirst.mockResolvedValue(declared);
    tx.employeeDisbursement.update.mockImplementation(({ data }) =>
      Promise.resolve({ ...declared, ...data, reversals: [] }),
    );

    const result = await service.attachSupport(TENANT_ID, USER_ID, PAYMENT_ID, {
      originalname: 'transferencia.pdf',
      buffer: PDF,
    } as Express.Multer.File);

    expect(result.status).toBe(EmployeeDisbursementStatus.SUPPORTED);
    expect(result.support?.sha256).toBe(PDF_SHA256);
    const uploaded = storage.putObject.mock.calls[0]?.[0];
    expect(uploaded?.key).toMatch(
      new RegExp(`^tenants/${TENANT_ID}/employee-disbursements/${PAYMENT_ID}/`),
    );
    expect(uploaded).toMatchObject({
      body: PDF,
      contentType: 'application/pdf',
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'EMPLOYEE_DISBURSEMENT_SUPPORT_ATTACHED',
      }),
      tx,
    );
  });

  it('si falla la transacción después de cargar el archivo, elimina solo esa carga nueva', async () => {
    const declared = makePayment();
    tx.employeeDisbursement.findFirst.mockResolvedValue(declared);
    audit.log.mockRejectedValueOnce(new Error('audit unavailable'));

    await expect(
      service.attachSupport(TENANT_ID, USER_ID, PAYMENT_ID, {
        originalname: 'transferencia.pdf',
        buffer: PDF,
      } as Express.Multer.File),
    ).rejects.toThrow('audit unavailable');

    const key = storage.putObject.mock.calls[0]?.[0].key;
    expect(key).toBeDefined();
    expect(storage.deleteObject).toHaveBeenCalledWith(key);
  });

  it('compensa el soporte si falla el commit después del callback transaccional', async () => {
    const declared = makePayment();
    tx.employeeDisbursement.findFirst.mockResolvedValue(declared);
    tx.employeeDisbursement.update.mockImplementation(({ data }) =>
      Promise.resolve({ ...declared, ...data, reversals: [] }),
    );
    tenantPrisma.execute.mockImplementationOnce(async (work) => {
      await work(tx);
      throw new Error('transaction commit failed');
    });

    await expect(
      service.attachSupport(TENANT_ID, USER_ID, PAYMENT_ID, {
        originalname: 'transferencia.pdf',
        buffer: PDF,
      } as Express.Multer.File),
    ).rejects.toThrow('transaction commit failed');

    const key = storage.putObject.mock.calls[0]?.[0].key;
    expect(key).toBeDefined();
    expect(storage.deleteObject).toHaveBeenCalledWith(key);
  });

  it('conserva el soporte si el commit pudo guardarse pese a perderse la confirmación', async () => {
    const declared = makePayment();
    tx.employeeDisbursement.findFirst.mockResolvedValue(declared);
    tx.employeeDisbursement.update.mockImplementation(({ data }) =>
      Promise.resolve({ ...declared, ...data, reversals: [] }),
    );
    tenantPrisma.execute.mockImplementationOnce(async (work) => {
      await work(tx);
      const key = storage.putObject.mock.calls[0]?.[0].key;
      tx.$queryRaw.mockResolvedValueOnce([{ supportStorageKey: key }]);
      throw new Error('commit acknowledgement lost');
    });

    await expect(
      service.attachSupport(TENANT_ID, USER_ID, PAYMENT_ID, {
        originalname: 'transferencia.pdf',
        buffer: PDF,
      } as Express.Multer.File),
    ).rejects.toThrow('commit acknowledgement lost');

    expect(storage.deleteObject).not.toHaveBeenCalled();
  });

  it('conserva el soporte si no puede consultar el resultado del commit', async () => {
    tx.employeeDisbursement.findFirst.mockResolvedValue(makePayment());
    tenantPrisma.execute.mockImplementationOnce(async (work) => {
      await work(tx);
      throw new Error('commit outcome unknown');
    });
    tenantPrisma.execute.mockImplementationOnce(() =>
      Promise.reject(new Error('database unavailable')),
    );

    await expect(
      service.attachSupport(TENANT_ID, USER_ID, PAYMENT_ID, {
        originalname: 'transferencia.pdf',
        buffer: PDF,
      } as Express.Multer.File),
    ).rejects.toThrow('commit outcome unknown');

    expect(storage.deleteObject).not.toHaveBeenCalled();
  });

  it('exige soporte íntegro antes de verificar y audita una sola transición', async () => {
    const supported = makePayment({
      status: EmployeeDisbursementStatus.SUPPORTED,
      supportStorageKey: `tenants/${TENANT_ID}/employee-disbursements/${PAYMENT_ID}/proof.pdf`,
      supportMimeType: 'application/pdf',
      supportSizeBytes: PDF.length,
      supportSha256: PDF_SHA256,
      supportedAt: new Date('2026-01-16T00:00:00.000Z'),
    });
    tx.employeeDisbursement.findFirst.mockResolvedValue(supported);
    tx.employeeDisbursement.findMany.mockResolvedValue([supported]);
    tx.employeeDisbursement.update.mockImplementation(({ data }) =>
      Promise.resolve({ ...supported, ...data, reversals: [] }),
    );

    const verified = await service.verify(TENANT_ID, USER_ID, PAYMENT_ID);

    expect(verified.status).toBe(EmployeeDisbursementStatus.VERIFIED);
    expect(storage.getObject).toHaveBeenCalledWith(supported.supportStorageKey);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'EMPLOYEE_DISBURSEMENT_VERIFIED' }),
      tx,
    );
  });

  it('rechaza verificar un desembolso cuya fecha todavía es futura en Colombia', async () => {
    const supported = makePayment({
      status: EmployeeDisbursementStatus.SUPPORTED,
      paidAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      supportStorageKey: `tenants/${TENANT_ID}/employee-disbursements/${PAYMENT_ID}/proof.pdf`,
      supportMimeType: 'application/pdf',
      supportSizeBytes: PDF.length,
      supportSha256: PDF_SHA256,
      supportedAt: new Date(),
    });
    tx.employeeDisbursement.findFirst.mockResolvedValue(supported);

    await expect(
      service.verify(TENANT_ID, USER_ID, PAYMENT_ID),
    ).rejects.toThrow(/fecha del desembolso.*futura/i);

    expect(storage.getObject).not.toHaveBeenCalled();
    expect(tx.employeeDisbursement.update).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('no verifica un desembolso si el objeto almacenado ya no coincide con la huella', async () => {
    const supported = makePayment({
      status: EmployeeDisbursementStatus.SUPPORTED,
      supportStorageKey: `tenants/${TENANT_ID}/employee-disbursements/${PAYMENT_ID}/proof.pdf`,
      supportMimeType: 'application/pdf',
      supportSizeBytes: PDF.length,
      supportSha256: PDF_SHA256,
      supportedAt: new Date(),
    });
    tx.employeeDisbursement.findFirst.mockResolvedValue(supported);
    storage.getObject.mockResolvedValue(Buffer.from('%PDF-tampered'));

    await expect(
      service.verify(TENANT_ID, USER_ID, PAYMENT_ID),
    ).rejects.toThrow(ConflictException);
    expect(tx.employeeDisbursement.update).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('rechaza lectura de un desembolso inexistente en el tenant', async () => {
    tx.employeeDisbursement.findFirst.mockResolvedValue(null);

    await expect(
      service.downloadSupport('tenant-b', USER_ID, PAYMENT_ID),
    ).rejects.toThrow(NotFoundException);
    expect(storage.getObject).not.toHaveBeenCalled();
  });

  it('registra reversos parciales append-only, idempotentes y acotados', async () => {
    const verified = makePayment({
      status: EmployeeDisbursementStatus.VERIFIED,
      verifiedByUserId: USER_ID,
      verifiedAt: new Date('2026-01-16T00:00:00.000Z'),
      reversals: [],
    });
    tx.employeeDisbursement.findFirst.mockResolvedValue(verified);

    const result = await service.reverse(TENANT_ID, USER_ID, PAYMENT_ID, {
      amount: '10000',
      reason: 'Reintegro confirmado',
      idempotencyKey: 'reversal-idem-0001',
    });

    expect(result.amount).toBe('10000.00');
    expect(tx.employeeDisbursementReversal.create).toHaveBeenCalledTimes(1);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'EMPLOYEE_DISBURSEMENT_REVERSED' }),
      tx,
    );
  });

  it('bloquea reversar una nómina mientras una liquidación activa usa esa cobertura', async () => {
    tx.employeeDisbursement.findFirst.mockResolvedValue(
      makePayment({
        status: EmployeeDisbursementStatus.VERIFIED,
        verifiedByUserId: USER_ID,
        verifiedAt: new Date('2026-01-16T00:00:00.000Z'),
      }),
    );
    tx.liquidation.findFirst.mockResolvedValue({ id: 'liquidation-a' });

    await expect(
      service.reverse(TENANT_ID, USER_ID, PAYMENT_ID, {
        amount: '10000',
        reason: 'Reintegro confirmado',
        idempotencyKey: 'reversal-after-liquidation',
      }),
    ).rejects.toThrow(/anúlela primero/i);

    expect(tx.employeeDisbursementReversal.create).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('sirve el soporte solo si la clave pertenece al desembolso y su hash coincide', async () => {
    const supported = makePayment({
      status: EmployeeDisbursementStatus.SUPPORTED,
      supportStorageKey: `tenants/${TENANT_ID}/employee-disbursements/${PAYMENT_ID}/proof.pdf`,
      supportMimeType: 'application/pdf',
      supportSizeBytes: PDF.length,
      supportSha256: PDF_SHA256,
      supportedAt: new Date(),
    });
    tx.employeeDisbursement.findFirst.mockResolvedValue(supported);

    await expect(
      service.downloadSupport(TENANT_ID, USER_ID, PAYMENT_ID),
    ).resolves.toMatchObject({ body: PDF, mimeType: 'application/pdf' });

    tx.employeeDisbursement.findFirst.mockResolvedValue({
      ...supported,
      supportStorageKey:
        'tenants/tenant-b/employee-disbursements/other/proof.pdf',
    });
    await expect(
      service.downloadSupport(TENANT_ID, USER_ID, PAYMENT_ID),
    ).rejects.toThrow(NotFoundException);
  });
});
