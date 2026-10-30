import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PayrollCorrectionAccountingService } from './payroll-correction-accounting.service';

const tenantId = 'tenant-1';
const userId = 'user-1';
const correctionId = 'correction-1';
const materialization = {
  version: 1,
  generatedAt: '2026-07-22T00:00:00.000Z',
  snapshotIds: ['snapshot-1'],
  approvedCorrectionIds: [],
  entries: [
    {
      snapshotId: 'snapshot-1',
      employeeId: 'employee-1',
      centroCostoId: null,
      concept: { codigo: 'SALARIO_BASE', tipo: 'EARNING' },
      delta: 1000,
    },
  ],
};

function dependency(id: string) {
  return {
    id,
    materialization: {
      ...materialization,
      approvedCorrectionIds: [],
    },
    materializedAt: new Date('2026-07-21T00:00:00.000Z'),
  };
}

function correctionWithDependencies(ids: string[]) {
  return {
    id: correctionId,
    payrollPeriodId: 'payroll-period-1',
    status: 'APROBADA',
    descripcion: 'Ajuste salarial',
    materialization: { ...materialization, approvedCorrectionIds: ids },
    materializedAt: new Date('2026-07-22T00:00:00.000Z'),
  };
}

function lastCallArgument<T>(calls: Array<[T]>): T {
  const call = calls.at(-1);
  if (!call) throw new Error('Expected the mock to have been called.');
  return call[0];
}

function createService(overrides?: {
  correction?: unknown;
  periodStatus?: 'APROBADA' | 'CAUSADA';
  existing?: {
    id: string;
    estado: 'CONTABILIZADO' | 'ANULADO';
    reversos: Array<{ id: string }>;
  } | null;
  payrollVoucher?: {
    id: string;
    estado: 'CONTABILIZADO';
    reversos: Array<{ id: string }>;
  } | null;
  ledgerError?: Error;
  dependencies?: unknown[];
  dependencyVouchers?: Array<{ origenId: string | null }>;
}) {
  const tx = {
    $executeRaw: jest.fn().mockResolvedValue(1),
    payrollCorrection: {
      findFirst: jest.fn().mockResolvedValue(
        overrides?.correction === undefined
          ? {
              id: correctionId,
              payrollPeriodId: 'payroll-period-1',
              status: 'APROBADA',
              descripcion: 'Ajuste salarial',
              materialization,
              materializedAt: new Date('2026-07-22T00:00:00.000Z'),
            }
          : overrides.correction,
      ),
      findMany: jest.fn().mockResolvedValue(overrides?.dependencies ?? []),
    },
    payrollPeriod: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ status: overrides?.periodStatus ?? 'CAUSADA' }),
    },
    comprobanteContable: {
      findFirst: jest
        .fn()
        .mockImplementation((args: { where: { origenTipo: string } }) =>
          args.where.origenTipo === 'PAYROLL'
            ? Promise.resolve(
                overrides?.payrollVoucher === undefined
                  ? {
                      id: 'payroll-voucher-1',
                      estado: 'CONTABILIZADO',
                      reversos: [],
                    }
                  : overrides.payrollVoucher,
              )
            : Promise.resolve(overrides?.existing ?? null),
        ),
      findMany: jest
        .fn()
        .mockResolvedValue(overrides?.dependencyVouchers ?? []),
    },
    cuentaSistemaMap: {
      findMany: jest.fn().mockResolvedValue([
        { rol: 'SALARIOS_POR_PAGAR', cuentaId: 'salary-payable' },
        { rol: 'APORTES_SALUD_POR_PAGAR', cuentaId: 'health-payable' },
        { rol: 'APORTES_PENSION_POR_PAGAR', cuentaId: 'contributions-payable' },
        { rol: 'PROVISION_PRESTACIONES', cuentaId: 'provision-payable' },
        { rol: 'GASTO_SUELDOS', cuentaId: 'salary-expense' },
        { rol: 'GASTO_APORTES_SOCIALES', cuentaId: 'contributions-expense' },
      ]),
    },
    periodoContable: {
      findFirst: jest.fn().mockResolvedValue({ id: 'period-1' }),
    },
    tipoComprobante: {
      findFirst: jest.fn().mockResolvedValue({ id: 'type-1' }),
    },
  };
  const tenantPrisma = {
    execute: jest
      .fn()
      .mockImplementation((work: (client: typeof tx) => Promise<unknown>) =>
        work(tx),
      ),
  };
  const ledger = {
    registrarComprobante: overrides?.ledgerError
      ? jest.fn().mockRejectedValue(overrides.ledgerError)
      : jest.fn().mockResolvedValue({ id: 'voucher-1' }),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  return {
    service: new PayrollCorrectionAccountingService(
      tenantPrisma as never,
      ledger as never,
      audit as never,
    ),
    tx,
    tenantPrisma,
    ledger,
    audit,
  };
}

describe('PayrollCorrectionAccountingService', () => {
  it('requires the original payroll accrual before posting a correction', async () => {
    const { service, ledger } = createService({ periodStatus: 'APROBADA' });

    await expect(
      service.contabilizar(tenantId, userId, correctionId),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(ledger.registrarComprobante).not.toHaveBeenCalled();
  });

  it('does not post an adjustment if the original accrual voucher is missing', async () => {
    const { service, ledger } = createService({ payrollVoucher: null });

    await expect(
      service.contabilizar(tenantId, userId, correctionId),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(ledger.registrarComprobante).not.toHaveBeenCalled();
  });

  it('does not post an adjustment when the original accrual has an active reversal', async () => {
    const { service, tx, ledger } = createService({ payrollVoucher: null });

    await expect(
      service.contabilizar(tenantId, userId, correctionId),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(tx.comprobanteContable.findFirst).toHaveBeenNthCalledWith(2, {
      where: {
        tenantId,
        origenTipo: 'PAYROLL',
        origenId: 'payroll-period-1',
        origenEvento: 'CAUSACION',
        estado: 'CONTABILIZADO',
        reversos: {
          none: { tenantId, estado: 'CONTABILIZADO' },
        },
      },
      select: { id: true },
    });
    expect(ledger.registrarComprobante).not.toHaveBeenCalled();
  });

  it('posts a correction without dependencies through LedgerService', async () => {
    const { service, tx, ledger } = createService();

    await expect(
      service.contabilizar(tenantId, userId, correctionId),
    ).resolves.toEqual({
      status: 'AJUSTADA',
      payrollCorrectionId: correctionId,
      comprobanteId: 'voucher-1',
    });
    expect(ledger.registrarComprobante).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        origenTipo: 'PAYROLL_CORRECTION',
        origenId: correctionId,
        origenEvento: 'AJUSTE',
      }),
      tx,
    );
    expect(tx.payrollCorrection.findMany).not.toHaveBeenCalled();
  });

  it('accepts a correction whose dependencies are fully accounted', async () => {
    const { service, ledger, tx } = createService({
      correction: correctionWithDependencies(['correction-previous']),
      dependencies: [dependency('correction-previous')],
      dependencyVouchers: [{ origenId: 'correction-previous' }],
    });

    await expect(
      service.contabilizar(tenantId, userId, correctionId),
    ).resolves.toMatchObject({ status: 'AJUSTADA' });
    expect(ledger.registrarComprobante).toHaveBeenCalledTimes(1);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('blocks a correction when a referenced dependency does not exist', async () => {
    const { service, ledger, audit } = createService({
      correction: correctionWithDependencies(['correction-missing']),
    });

    await expect(
      service.contabilizar(tenantId, userId, correctionId),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(ledger.registrarComprobante).not.toHaveBeenCalled();
    const auditCalls = audit.log.mock.calls as unknown as Array<
      [
        {
          action: string;
          metadata: {
            pendingCorrectionIds: string[];
            invalidCorrectionIds: string[];
          };
        },
      ]
    >;
    const auditParams = lastCallArgument(auditCalls);
    expect(auditParams.action).toBe(
      'PAYROLL_CORRECTION_ACCOUNTING_BLOCKED_DEPENDENCIES',
    );
    expect(auditParams.metadata).toMatchObject({
      pendingCorrectionIds: ['correction-missing'],
      invalidCorrectionIds: ['correction-missing'],
    });
  });

  it('validates several dependencies before invoking LedgerService', async () => {
    const dependencyIds = ['correction-a', 'correction-b'];
    const { service, tx, ledger } = createService({
      correction: correctionWithDependencies(dependencyIds),
      dependencies: dependencyIds.map(dependency),
      dependencyVouchers: dependencyIds.map((origenId) => ({ origenId })),
    });

    await service.contabilizar(tenantId, userId, correctionId);

    const dependencyQueries = tx.payrollCorrection.findMany.mock
      .calls as unknown as Array<[{ where: Record<string, unknown> }]>;
    const dependencyQuery = dependencyQueries.at(-1)?.[0];
    expect(dependencyQuery?.where).toMatchObject({
      tenantId,
      id: { in: dependencyIds },
      status: 'APROBADA',
    });
    expect(ledger.registrarComprobante).toHaveBeenCalledTimes(1);
  });

  it('does not accept a dependency that is unavailable in the current tenant', async () => {
    const { service, tx, ledger } = createService({
      correction: correctionWithDependencies(['foreign-correction']),
      dependencies: [],
      dependencyVouchers: [],
    });

    await expect(
      service.contabilizar(tenantId, userId, correctionId),
    ).rejects.toBeInstanceOf(ConflictException);
    const dependencyQueries = tx.payrollCorrection.findMany.mock
      .calls as unknown as Array<[{ where: Record<string, unknown> }]>;
    const dependencyQuery = dependencyQueries.at(-1)?.[0];
    expect(dependencyQuery?.where).toMatchObject({ tenantId });
    expect(ledger.registrarComprobante).not.toHaveBeenCalled();
  });

  it('rejects out-of-order accounting when a valid dependency has no voucher', async () => {
    const { service, ledger, audit } = createService({
      correction: correctionWithDependencies(['correction-previous']),
      dependencies: [dependency('correction-previous')],
      dependencyVouchers: [],
    });

    await expect(
      service.contabilizar(tenantId, userId, correctionId),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(ledger.registrarComprobante).not.toHaveBeenCalled();
    const auditCalls = audit.log.mock.calls as unknown as Array<
      [
        {
          action: string;
          metadata: {
            pendingCorrectionIds: string[];
            invalidCorrectionIds: string[];
          };
        },
      ]
    >;
    const auditParams = lastCallArgument(auditCalls);
    expect(auditParams.action).toBe(
      'PAYROLL_CORRECTION_ACCOUNTING_BLOCKED_DEPENDENCIES',
    );
    expect(auditParams.metadata).toMatchObject({
      pendingCorrectionIds: ['correction-previous'],
      invalidCorrectionIds: [],
    });
  });

  it('returns the existing voucher on a safe repeated execution', async () => {
    const { service, tx, ledger } = createService();
    tx.comprobanteContable.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'payroll-voucher-1',
        estado: 'CONTABILIZADO',
        reversos: [],
      })
      .mockResolvedValueOnce({
        id: 'voucher-1',
        estado: 'CONTABILIZADO',
        reversos: [],
      });

    await service.contabilizar(tenantId, userId, correctionId);

    await expect(
      service.contabilizar(tenantId, userId, correctionId),
    ).resolves.toEqual({
      status: 'YA_AJUSTADA',
      payrollCorrectionId: correctionId,
      comprobanteId: 'voucher-1',
    });
    expect(ledger.registrarComprobante).toHaveBeenCalledTimes(1);
  });

  it('does not report a reversed correction voucher as an idempotent success', async () => {
    const { service, ledger } = createService({
      existing: {
        id: 'voucher-reversed',
        estado: 'CONTABILIZADO',
        reversos: [{ id: 'voucher-reversal' }],
      },
    });

    await expect(
      service.contabilizar(tenantId, userId, correctionId),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(ledger.registrarComprobante).not.toHaveBeenCalled();
  });

  it('fails securely when the correction is outside the tenant', async () => {
    const { service, ledger } = createService({ correction: null });

    await expect(
      service.contabilizar(tenantId, userId, correctionId),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(ledger.registrarComprobante).not.toHaveBeenCalled();
  });

  it('rejects an approved correction without a materialization', async () => {
    const { service, ledger } = createService({
      correction: {
        id: correctionId,
        status: 'APROBADA',
        descripcion: 'Ajuste salarial',
        materialization: null,
        materializedAt: null,
      },
    });

    await expect(
      service.contabilizar(tenantId, userId, correctionId),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(ledger.registrarComprobante).not.toHaveBeenCalled();
  });

  it('propagates LedgerService failures without completing the accounting operation', async () => {
    const { service, tx, ledger, audit } = createService({
      ledgerError: new Error('ledger failed'),
    });

    await expect(
      service.contabilizar(tenantId, userId, correctionId),
    ).rejects.toThrow('ledger failed');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PAYROLL_CORRECTION_ACCOUNTING_ERROR',
      }),
    );
    expect(ledger.registrarComprobante).toHaveBeenCalledWith(
      expect.anything(),
      tx,
    );
  });
});
