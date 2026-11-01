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
const findSnapshots = jest.fn();

const prisma = {
  payrollPeriod: { findFirst: findPeriod },
  payrollSnapshot: { findMany: findSnapshots },
};

describe('PayrollService.getPilaPreparation', () => {
  let service: PayrollService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        PayrollService,
        { provide: PrismaService, useValue: prisma },
        { provide: TenantPrismaService, useValue: {} },
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
      fechaPrevistaPagoPila: new Date('2026-11-06T00:00:00.000Z'),
    });
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
        fechaPrevistaPagoPila: true,
      },
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
    expect(report).toMatchObject({
      formatVersion: null,
      normativeSourceStatus: 'RECONCILIATION_PENDING',
      snapshotsRevisados: 1,
      empleadosConDatosPendientes: 1,
      archivoGenerable: false,
      estadoArchivo: 'NO_IMPLEMENTADO',
    });
  });

  it('rechaza el período antes de leer snapshots si la nómina no está aprobada', async () => {
    findPeriod.mockResolvedValue({
      id: 'period-1',
      status: PayrollPeriodStatus.BORRADOR,
      fechaInicio: new Date('2026-10-01T00:00:00.000Z'),
      fechaFin: new Date('2026-10-31T00:00:00.000Z'),
      fechaPrevistaPagoPila: null,
    });

    await expect(
      service.getPilaPreparation('tenant-1', 'period-1'),
    ).rejects.toThrow(ConflictException);
    expect(findSnapshots).not.toHaveBeenCalled();
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
  });
});
