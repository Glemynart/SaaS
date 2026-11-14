import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PayrollPeriodStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { LedgerService } from '../accounting/ledger/ledger.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import { PayrollAccountingPreflightService } from './accounting-preflight/payroll-accounting-preflight.service';
import { PayrollService } from './payroll.service';

const findPeriod = jest.fn();
const findRuns = jest.fn();
const findSnapshots = jest.fn();
const tenantPrismaExecute = jest.fn(
  (
    work: (client: {
      payrollSnapshot: { findMany: typeof findSnapshots };
    }) => unknown,
  ) => work({ payrollSnapshot: { findMany: findSnapshots } }),
);

const prisma = {
  payrollPeriod: { findFirst: findPeriod },
  payrollRun: { findMany: findRuns },
};

describe('PayrollService.getPilaPreparation', () => {
  let service: PayrollService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        PayrollService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: TenantPrismaService,
          useValue: { execute: tenantPrismaExecute },
        },
        { provide: AuditService, useValue: {} },
        { provide: LedgerService, useValue: {} },
        { provide: PayrollAccountingPreflightService, useValue: {} },
      ],
    }).compile();
    service = module.get(PayrollService);
  });

  it('lee únicamente snapshots del período aprobado y del tenant solicitado', async () => {
    findPeriod.mockResolvedValue({
      id: 'period-1',
      status: PayrollPeriodStatus.APROBADA,
      fechaInicio: new Date('2026-10-01T00:00:00.000Z'),
      fechaFin: new Date('2026-10-31T00:00:00.000Z'),
    });
    findRuns.mockResolvedValue([{ employeeId: 'employee-1' }]);
    findSnapshots.mockResolvedValue([
      {
        employeeId: 'employee-1',
        pilaPayloadVersion: null,
        pilaPayload: null,
      },
    ]);

    const report = await service.getPilaPreparation('tenant-1', 'period-1');

    expect(findPeriod).toHaveBeenCalledWith({
      where: { id: 'period-1', tenantId: 'tenant-1' },
      select: {
        id: true,
        status: true,
        fechaInicio: true,
        fechaFin: true,
      },
    });
    expect(findRuns).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', payrollPeriodId: 'period-1' },
      select: { employeeId: true },
      orderBy: { employeeId: 'asc' },
    });
    expect(findSnapshots).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', payrollPeriodId: 'period-1' },
      select: {
        employeeId: true,
        pilaPayloadVersion: true,
        pilaPayload: true,
      },
      orderBy: [{ createdAt: 'asc' }, { employeeId: 'asc' }],
    });
    expect(tenantPrismaExecute).toHaveBeenCalledTimes(1);
    const blockerFor = (code: string) => {
      const blocker = report.exportReadiness.blockers.find(
        (candidate) => candidate.code === code,
      );
      if (!blocker) throw new Error(`Expected PILA blocker ${code}.`);
      return blocker;
    };
    expect(report).toMatchObject({
      formatVersion: null,
      normativeSourceStatus: 'RECONCILIATION_PENDING',
      exportReadiness: {
        recordLayoutVersion: 'AT2_V30',
        fileGenerationStatus: 'IMPLEMENTED',
        localValidationStatus: 'PER_EXPORT',
        operatorAcceptanceStatus: 'NOT_VERIFIED',
      },
      period: { fechaPrevistaPagoPila: null },
      snapshotsRevisados: 1,
      empleadosConDatosPendientes: 1,
      archivoGenerable: false,
      estadoArchivo: 'BLOQUEADO',
      detailRecordSequence: {
        status: 'PENDING',
        candidateRecords: 0,
        ruleVersion: null,
      },
    });
    expect(blockerFor('SOI_OPERATOR_FIELDS_UNCONFIRMED')).toMatchObject({
      fields: [
        { record: 'APORTANTE_TIPO_1', fieldNumbers: [28, 29] },
        {
          record: 'CABECERA_TIPO_2',
          fieldNumbers: [2, 15, 17, 18, 22],
        },
      ],
    });
    expect(blockerFor('OPERATOR_UPLOAD_NOT_VERIFIED').scope).toBe(
      'OPERATOR_COMPATIBILITY',
    );
    expect(blockerFor('PILA_PAYMENT_DATE_REQUIRED').scope).toBe(
      'FILE_GENERATION',
    );
    const serializationBlocker = blockerFor(
      'AT2_V30_SERIALIZATION_FIELDS_PENDING',
    );
    expect(serializationBlocker.scope).toBe('FILE_GENERATION');
    expect(serializationBlocker.fields.map(({ record }) => record)).toEqual([
      'APORTANTE_TIPO_1',
      'CABECERA_TIPO_2',
      'DETALLE_TIPO_2',
    ]);
    expect(
      serializationBlocker.fields.every(
        ({ fieldNumbers }) =>
          fieldNumbers.length > 0 && fieldNumbers.every(Number.isInteger),
      ),
    ).toBe(true);
  });

  it('rechaza el período antes de leer snapshots si la nómina no está aprobada', async () => {
    findPeriod.mockResolvedValue({
      id: 'period-1',
      status: PayrollPeriodStatus.BORRADOR,
      fechaInicio: new Date('2026-10-01T00:00:00.000Z'),
      fechaFin: new Date('2026-10-31T00:00:00.000Z'),
    });

    await expect(
      service.getPilaPreparation('tenant-1', 'period-1'),
    ).rejects.toThrow(ConflictException);
    expect(findSnapshots).not.toHaveBeenCalled();
    expect(tenantPrismaExecute).not.toHaveBeenCalled();
    expect(findRuns).not.toHaveBeenCalled();
  });

  it('oculta períodos que no pertenecen al tenant', async () => {
    findPeriod.mockResolvedValue(null);

    await expect(
      service.getPilaPreparation('other-tenant', 'period-1'),
    ).rejects.toThrow(NotFoundException);
    expect(findPeriod).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'period-1', tenantId: 'other-tenant' },
      }),
    );
    expect(findSnapshots).not.toHaveBeenCalled();
    expect(tenantPrismaExecute).not.toHaveBeenCalled();
    expect(findRuns).not.toHaveBeenCalled();
  });
});
