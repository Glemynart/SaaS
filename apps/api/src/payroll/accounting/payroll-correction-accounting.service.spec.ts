import { ConflictException, NotFoundException } from '@nestjs/common';
import { PayrollCorrectionAccountingService } from './payroll-correction-accounting.service';

const tenantId = 'tenant-1';
const userId = 'user-1';
const correctionId = 'correction-1';
const materialization = {
  version: 1,
  generatedAt: '2026-07-22T00:00:00.000Z',
  snapshotIds: ['snapshot-1'],
  approvedCorrectionIds: [correctionId],
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

function createService(overrides?: {
  correction?: unknown;
  existing?: { id: string } | null;
  ledgerError?: Error;
}) {
  const tx = {
    payrollCorrection: {
      findFirst: jest.fn().mockResolvedValue(
        overrides?.correction === undefined
          ? {
              id: correctionId,
              status: 'APROBADA',
              descripcion: 'Ajuste salarial',
              materialization,
              materializedAt: new Date('2026-07-22T00:00:00.000Z'),
            }
          : overrides.correction,
      ),
    },
    comprobanteContable: {
      findFirst: jest.fn().mockResolvedValue(overrides?.existing ?? null),
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
    execute: jest.fn().mockImplementation((work) => work(tx)),
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
  it('posts one voucher through LedgerService using the same transaction', async () => {
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
  });

  it('returns the existing voucher on a safe repeated execution', async () => {
    const { service, tx, ledger } = createService();
    tx.comprobanteContable.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'voucher-1' });

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
