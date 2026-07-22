import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { LedgerService } from '../../accounting/ledger/ledger.service';
import { TenantPrismaService } from '../../tenant-prisma/tenant-prisma.service';
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
      const action =
        error instanceof HttpException
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
          },
        })
        .catch(() => {});
      throw error;
    }
  }
}
