import { ConflictException } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { LedgerService } from '../ledger/ledger.service';
import { ManualJournalService } from './manual-journal.service';

const adjustmentVoucher = (overrides = {}) => ({
  estado: 'CONTABILIZADO',
  origenTipo: 'PAYROLL_CORRECTION',
  origenId: 'correction-a',
  origenEvento: 'AJUSTE',
  ...overrides,
});

const materializationDependingOn = (correctionId: string) => ({
  version: 1,
  generatedAt: '2026-07-01T00:00:00.000Z',
  snapshotIds: ['snapshot-1'],
  approvedCorrectionIds: [correctionId],
  entries: [
    {
      snapshotId: 'snapshot-1',
      employeeId: 'employee-1',
      centroCostoId: null,
      concept: { codigo: 'SALARIO', tipo: 'DEVENGO' },
      delta: 100,
    },
  ],
});

describe('ManualJournalService', () => {
  const ledger = {
    registrarComprobante: jest.fn(),
    anular: jest.fn(),
  };
  const tx = {
    $executeRaw: jest.fn().mockResolvedValue(1),
    comprobanteContable: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    payrollCorrection: {
      findMany: jest.fn(),
    },
  };
  const tenantPrisma = {
    execute: jest.fn(),
  };
  const audit = {
    log: jest.fn(),
  };
  const service = new ManualJournalService(
    ledger as unknown as LedgerService,
    tenantPrisma as never,
    audit as unknown as AuditService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    tenantPrisma.execute.mockImplementation(
      (work: (client: typeof tx) => Promise<unknown>) => work(tx),
    );
    audit.log.mockResolvedValue(undefined);
    tx.comprobanteContable.findFirst.mockResolvedValue(adjustmentVoucher());
    tx.payrollCorrection.findMany.mockResolvedValue([]);
    tx.comprobanteContable.findMany.mockResolvedValue([]);
  });

  it('registra un comprobante manual exclusivamente por LedgerService', async () => {
    ledger.registrarComprobante.mockResolvedValue({ id: 'comp-001' });

    await expect(
      service.registrar('tenant-a', 'user-a', {
        tipoComprobanteId: 'tipo-cc',
        periodoId: 'periodo-a',
        fecha: '2026-06-30T00:00:00.000Z',
        concepto: 'Ajuste manual',
        lineas: [
          { cuentaId: 'cuenta-debito', debito: 100, credito: 0 },
          { cuentaId: 'cuenta-credito', debito: 0, credito: 100 },
        ],
      }),
    ).resolves.toEqual({ id: 'comp-001' });

    expect(ledger.registrarComprobante).toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      userId: 'user-a',
      tipoComprobanteId: 'tipo-cc',
      periodoId: 'periodo-a',
      fecha: new Date('2026-06-30T00:00:00.000Z'),
      concepto: 'Ajuste manual',
      lineas: [
        { cuentaId: 'cuenta-debito', debito: 100, credito: 0 },
        { cuentaId: 'cuenta-credito', debito: 0, credito: 100 },
      ],
    });
  });

  it('propaga los rechazos de invariantes del Ledger sin duplicar reglas', async () => {
    const rechazo = new Error('Partida no balanceada');
    ledger.registrarComprobante.mockRejectedValue(rechazo);

    await expect(
      service.registrar('tenant-a', 'user-a', {
        tipoComprobanteId: 'tipo-cc',
        periodoId: 'periodo-a',
        fecha: '2026-06-30T00:00:00.000Z',
        concepto: 'Inválido',
        lineas: [],
      }),
    ).rejects.toBe(rechazo);
  });

  it('anula exclusivamente por el mecanismo aprobado de LedgerService', async () => {
    ledger.anular.mockResolvedValue({ id: 'reverso-001' });

    await expect(
      service.anular('tenant-a', 'user-a', 'comp-001', 'Error de digitación'),
    ).resolves.toEqual({ id: 'reverso-001' });

    expect(ledger.anular).toHaveBeenCalledWith(
      'tenant-a',
      'user-a',
      'comp-001',
      'Error de digitación',
      tx,
    );
  });

  it('bloquea anular directamente el comprobante de un recaudo', async () => {
    tx.comprobanteContable.findFirst.mockResolvedValue(
      adjustmentVoucher({
        origenTipo: 'BILLING_RECEIPT',
        origenId: 'receipt-001',
        origenEvento: 'POSTED',
      }),
    );

    await expect(
      service.anular('tenant-a', 'user-a', 'comp-001', 'Error de digitación'),
    ).rejects.toThrow('Use la opción de reversión del módulo de cartera');

    expect(ledger.anular).not.toHaveBeenCalled();
  });

  it('permite anular un ajuste de nómina sin correcciones dependientes', async () => {
    ledger.anular.mockResolvedValue({ id: 'comp-001', estado: 'ANULADO' });

    await expect(
      service.anular('tenant-a', 'user-a', 'comp-001', 'Corrección inválida'),
    ).resolves.toEqual({ id: 'comp-001', estado: 'ANULADO' });

    expect(tx.payrollCorrection.findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-a', status: 'APROBADA' },
      select: {
        id: true,
        materialization: true,
        materializedAt: true,
      },
    });
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.comprobanteContable.findMany).not.toHaveBeenCalled();
  });

  it('bloquea la anulación cuando existe una corrección dependiente contabilizada', async () => {
    tx.payrollCorrection.findMany.mockResolvedValue([
      {
        id: 'correction-b',
        materialization: materializationDependingOn('correction-a'),
        materializedAt: new Date(),
      },
    ]);
    tx.comprobanteContable.findMany.mockResolvedValue([
      { origenId: 'correction-b' },
    ]);

    await expect(
      service.anular('tenant-a', 'user-a', 'comp-001', 'Corrección inválida'),
    ).rejects.toThrow(ConflictException);

    expect(ledger.anular).not.toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      userId: 'user-a',
      action: 'PAYROLL_CORRECTION_VOID_BLOCKED_DEPENDENCIES',
      entityType: 'PayrollCorrection',
      entityId: 'correction-a',
      metadata: {
        correctionId: 'correction-a',
        dependentCorrectionIds: ['correction-b'],
        reason: 'ACCOUNTED_DEPENDENT_CORRECTIONS',
      },
    });
  });

  it('bloquea la anulación cuando existen varias correcciones dependientes contabilizadas', async () => {
    tx.payrollCorrection.findMany.mockResolvedValue([
      {
        id: 'correction-b',
        materialization: materializationDependingOn('correction-a'),
        materializedAt: new Date(),
      },
      {
        id: 'correction-c',
        materialization: materializationDependingOn('correction-a'),
        materializedAt: new Date(),
      },
    ]);
    tx.comprobanteContable.findMany.mockResolvedValue([
      { origenId: 'correction-b' },
      { origenId: 'correction-c' },
    ]);

    await expect(
      service.anular('tenant-a', 'user-a', 'comp-001', 'Corrección inválida'),
    ).rejects.toThrow(ConflictException);

    expect(audit.log).toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      userId: 'user-a',
      action: 'PAYROLL_CORRECTION_VOID_BLOCKED_DEPENDENCIES',
      entityType: 'PayrollCorrection',
      entityId: 'correction-a',
      metadata: {
        correctionId: 'correction-a',
        dependentCorrectionIds: ['correction-b', 'correction-c'],
        reason: 'ACCOUNTED_DEPENDENT_CORRECTIONS',
      },
    });
    expect(ledger.anular).not.toHaveBeenCalled();
  });

  it('permite anular cuando los comprobantes dependientes ya fueron anulados', async () => {
    tx.payrollCorrection.findMany.mockResolvedValue([
      {
        id: 'correction-b',
        materialization: materializationDependingOn('correction-a'),
        materializedAt: new Date(),
      },
    ]);
    ledger.anular.mockResolvedValue({ id: 'comp-001', estado: 'ANULADO' });

    await expect(
      service.anular('tenant-a', 'user-a', 'comp-001', 'Corrección inválida'),
    ).resolves.toEqual({ id: 'comp-001', estado: 'ANULADO' });

    expect(tx.comprobanteContable.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-a',
        origenTipo: 'PAYROLL_CORRECTION',
        origenId: { in: ['correction-b'] },
        origenEvento: 'AJUSTE',
        estado: { not: 'ANULADO' },
        reversos: { none: { estado: 'CONTABILIZADO' } },
      },
      select: { origenId: true },
    });
    expect(ledger.anular).toHaveBeenCalled();
  });

  it('mantiene el aislamiento del tenant al buscar correcciones dependientes', async () => {
    ledger.anular.mockResolvedValue({ id: 'comp-001', estado: 'ANULADO' });

    await service.anular(
      'tenant-a',
      'user-a',
      'comp-001',
      'Corrección inválida',
    );

    expect(tx.payrollCorrection.findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-a', status: 'APROBADA' },
      select: {
        id: true,
        materialization: true,
        materializedAt: true,
      },
    });
    expect(tx.comprobanteContable.findFirst).toHaveBeenCalledWith({
      where: { id: 'comp-001', tenantId: 'tenant-a' },
      select: {
        estado: true,
        origenTipo: true,
        origenId: true,
        origenEvento: true,
      },
    });
  });
});
