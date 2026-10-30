import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { LedgerService } from '../../accounting/ledger/ledger.service';
import { lockPayrollCorrectionDependencies } from '../../accounting/payroll-correction-dependency-lock';
import {
  TenantPrismaClient,
  TenantPrismaService,
} from '../../tenant-prisma/tenant-prisma.service';
import { PAYROLL_ACCOUNTING_REQUIRED_ROLES } from '../accounting-preflight/payroll-accounting-preflight.service';
import { parseCorrectionMaterialization } from '../corrections/payroll-correction.types';
import {
  buildPayrollCorrectionAdjustmentLines,
  PayrollCorrectionSystemAccounts,
} from './payroll-correction-accounting.mapper';

export type PayrollCorrectionAccountingResult = {
  status: 'AJUSTADA' | 'YA_AJUSTADA';
  payrollCorrectionId: string;
  comprobanteId: string;
};

const ORIGIN = {
  type: 'PAYROLL_CORRECTION',
  event: 'AJUSTE',
} as const;

class PendingCorrectionDependenciesException extends ConflictException {
  constructor(
    readonly pendingCorrectionIds: string[],
    readonly invalidCorrectionIds: string[],
  ) {
    super(
      `La corrección tiene dependencias pendientes de contabilización: ${pendingCorrectionIds.join(', ')}.`,
    );
  }
}

@Injectable()
export class PayrollCorrectionAccountingService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly ledger: LedgerService,
    private readonly audit: AuditService,
  ) {}

  async contabilizar(
    tenantId: string,
    userId: string,
    correctionId: string,
  ): Promise<PayrollCorrectionAccountingResult> {
    try {
      return await this.tenantPrisma.execute(async (tx) => {
        const correction = await tx.payrollCorrection.findFirst({
          where: { id: correctionId, tenantId },
          select: {
            id: true,
            payrollPeriodId: true,
            status: true,
            descripcion: true,
            materialization: true,
            materializedAt: true,
          },
        });
        if (!correction) {
          throw new NotFoundException('Corrección de nómina no encontrada.');
        }
        if (correction.status !== 'APROBADA') {
          throw new BadRequestException(
            `Solo se puede contabilizar una corrección APROBADA; estado actual: ${correction.status}.`,
          );
        }
        if (!correction.materialization || !correction.materializedAt) {
          throw new ConflictException(
            'La corrección aprobada no tiene una materialización contable disponible.',
          );
        }

        const materialization = parseCorrectionMaterialization(
          correction.materialization,
        );
        const existing = await tx.comprobanteContable.findFirst({
          where: {
            tenantId,
            origenTipo: ORIGIN.type,
            origenId: correction.id,
            origenEvento: ORIGIN.event,
            estado: { not: 'ANULADO' },
          },
          select: { id: true },
        });
        if (existing) {
          await this.audit.log(
            {
              tenantId,
              userId,
              action: 'PAYROLL_CORRECTION_ACCOUNTING_REUSED',
              entityType: 'PayrollCorrection',
              entityId: correction.id,
              metadata: { comprobanteId: existing.id },
            },
            tx,
          );
          return {
            status: 'YA_AJUSTADA',
            payrollCorrectionId: correction.id,
            comprobanteId: existing.id,
          };
        }

        const payrollPeriod = await tx.payrollPeriod.findFirst({
          where: { id: correction.payrollPeriodId, tenantId },
          select: { status: true },
        });
        if (!payrollPeriod) {
          throw new NotFoundException('Período de nómina no encontrado.');
        }
        if (payrollPeriod.status !== 'CAUSADA') {
          throw new BadRequestException(
            'Solo se puede contabilizar un ajuste cuando la nómina original ya está causada en el Ledger.',
          );
        }
        const payrollVoucher = await tx.comprobanteContable.findFirst({
          where: {
            tenantId,
            origenTipo: 'PAYROLL',
            origenId: correction.payrollPeriodId,
            origenEvento: 'CAUSACION',
            estado: { not: 'ANULADO' },
          },
          select: { id: true },
        });
        if (!payrollVoucher) {
          throw new ConflictException(
            'No se encontró el comprobante vigente de causación original; el ajuste no se contabilizó.',
          );
        }

        await lockPayrollCorrectionDependencies(
          tx,
          tenantId,
          materialization.approvedCorrectionIds,
        );
        await this.validateAccountingDependencies(
          tx,
          tenantId,
          materialization.approvedCorrectionIds,
        );

        await this.audit.log(
          {
            tenantId,
            userId,
            action: 'PAYROLL_CORRECTION_ACCOUNTING_STARTED',
            entityType: 'PayrollCorrection',
            entityId: correction.id,
          },
          tx,
        );

        const [maps, accountingPeriod, voucherType] = await Promise.all([
          tx.cuentaSistemaMap.findMany({
            where: {
              tenantId,
              activo: true,
              rol: { in: [...PAYROLL_ACCOUNTING_REQUIRED_ROLES] },
            },
            select: { rol: true, cuentaId: true },
          }),
          tx.periodoContable.findFirst({
            where: {
              tenantId,
              estado: 'ABIERTO',
              fechaInicio: { lte: correction.materializedAt },
              fechaFin: { gte: correction.materializedAt },
            },
            select: { id: true },
          }),
          tx.tipoComprobante.findFirst({
            where: { codigo: 'NOM', activo: true },
            select: { id: true },
          }),
        ]);

        if (!accountingPeriod || !voucherType) {
          throw new ConflictException(
            'No existe una configuración contable disponible para el ajuste.',
          );
        }
        const mapsByRole = new Map(maps.map((map) => [map.rol, map.cuentaId]));
        const accounts = Object.fromEntries(
          PAYROLL_ACCOUNTING_REQUIRED_ROLES.map((role) => {
            const accountId = mapsByRole.get(role);
            if (!accountId) {
              throw new ConflictException(
                `El mapeo contable ${role} no está disponible para el ajuste.`,
              );
            }
            return [role, accountId];
          }),
        ) as PayrollCorrectionSystemAccounts;

        const comprobante = await this.ledger.registrarComprobante(
          {
            tenantId,
            userId,
            tipoComprobanteId: voucherType.id,
            periodoId: accountingPeriod.id,
            fecha: correction.materializedAt,
            concepto: `Ajuste nómina: ${correction.descripcion}`,
            lineas: buildPayrollCorrectionAdjustmentLines(
              materialization,
              accounts,
            ),
            origenTipo: ORIGIN.type,
            origenId: correction.id,
            origenEvento: ORIGIN.event,
          },
          tx,
        );

        await this.audit.log(
          {
            tenantId,
            userId,
            action: 'PAYROLL_CORRECTION_ACCOUNTING_COMPLETED',
            entityType: 'PayrollCorrection',
            entityId: correction.id,
            metadata: {
              comprobanteId: comprobante.id,
              materializationVersion: materialization.version,
            },
          },
          tx,
        );
        return {
          status: 'AJUSTADA',
          payrollCorrectionId: correction.id,
          comprobanteId: comprobante.id,
        };
      });
    } catch (error) {
      const dependencyError =
        error instanceof PendingCorrectionDependenciesException ? error : null;
      const action = dependencyError
        ? 'PAYROLL_CORRECTION_ACCOUNTING_BLOCKED_DEPENDENCIES'
        : error instanceof HttpException
          ? 'PAYROLL_CORRECTION_ACCOUNTING_REJECTED'
          : 'PAYROLL_CORRECTION_ACCOUNTING_ERROR';
      await this.audit
        .log({
          tenantId,
          userId,
          action,
          entityType: 'PayrollCorrection',
          entityId: correctionId,
          metadata: {
            reason: error instanceof Error ? error.message : 'Unknown error',
            ...(dependencyError
              ? {
                  pendingCorrectionIds: dependencyError.pendingCorrectionIds,
                  invalidCorrectionIds: dependencyError.invalidCorrectionIds,
                }
              : {}),
          },
        })
        .catch(() => {});
      throw error;
    }
  }

  private async validateAccountingDependencies(
    tx: TenantPrismaClient,
    tenantId: string,
    rawDependencyIds: string[],
  ): Promise<void> {
    const dependencyIds = [...new Set(rawDependencyIds)];
    if (dependencyIds.length === 0) return;

    const [dependencies, vouchers] = await Promise.all([
      tx.payrollCorrection.findMany({
        where: {
          id: { in: dependencyIds },
          tenantId,
          status: 'APROBADA',
        },
        select: {
          id: true,
          materialization: true,
          materializedAt: true,
        },
      }),
      tx.comprobanteContable.findMany({
        where: {
          tenantId,
          origenTipo: ORIGIN.type,
          origenId: { in: dependencyIds },
          origenEvento: ORIGIN.event,
          estado: { not: 'ANULADO' },
        },
        select: { origenId: true },
      }),
    ]);

    const validCorrectionIds = new Set<string>();
    for (const dependency of dependencies) {
      if (!dependency.materialization || !dependency.materializedAt) continue;
      try {
        parseCorrectionMaterialization(dependency.materialization);
        validCorrectionIds.add(dependency.id);
      } catch {
        // Una dependencia inválida se reporta como bloqueada; nunca se repara aquí.
      }
    }

    const voucherCorrectionIds = new Set(
      vouchers
        .map((voucher) => voucher.origenId)
        .filter((id): id is string => id !== null),
    );
    const invalidCorrectionIds = dependencyIds.filter(
      (id) => !validCorrectionIds.has(id),
    );
    const pendingCorrectionIds = dependencyIds.filter(
      (id) => !validCorrectionIds.has(id) || !voucherCorrectionIds.has(id),
    );

    if (pendingCorrectionIds.length > 0) {
      throw new PendingCorrectionDependenciesException(
        pendingCorrectionIds,
        invalidCorrectionIds,
      );
    }
  }
}
