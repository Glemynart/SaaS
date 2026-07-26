import { ConflictException, Injectable } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { lockPayrollCorrectionDependencies } from '../payroll-correction-dependency-lock';
import {
  TenantPrismaClient,
  TenantPrismaService,
} from '../../tenant-prisma/tenant-prisma.service';
import { parseCorrectionMaterialization } from '../../payroll/corrections/payroll-correction.types';
import { LedgerService } from '../ledger/ledger.service';
import { CreateManualJournalDto } from './dto/create-manual-journal.dto';

const PAYROLL_CORRECTION_ADJUSTMENT_ORIGIN = {
  type: 'PAYROLL_CORRECTION',
  event: 'AJUSTE',
} as const;

class AccountedCorrectionDependentsException extends ConflictException {
  constructor(
    readonly correctionId: string,
    readonly dependentCorrectionIds: string[],
  ) {
    super(
      'No se puede anular el comprobante porque existen correcciones dependientes contabilizadas que deben anularse primero.',
    );
  }
}

/**
 * Fachada de aplicación para operaciones manuales. No persiste comprobantes
 * ni movimientos: LedgerService conserva el único puerto de escritura.
 */
@Injectable()
export class ManualJournalService {
  constructor(
    private readonly ledger: LedgerService,
    private readonly tenantPrisma: TenantPrismaService,
    private readonly audit: AuditService,
  ) {}

  registrar(tenantId: string, userId: string, dto: CreateManualJournalDto) {
    return this.ledger.registrarComprobante({
      tenantId,
      userId,
      tipoComprobanteId: dto.tipoComprobanteId,
      periodoId: dto.periodoId,
      fecha: new Date(dto.fecha),
      concepto: dto.concepto,
      lineas: dto.lineas,
    });
  }

  async anular(
    tenantId: string,
    userId: string,
    comprobanteId: string,
    motivo: string,
  ) {
    try {
      return await this.tenantPrisma.execute(async (tx) => {
        const comprobante = await tx.comprobanteContable.findFirst({
          where: { id: comprobanteId, tenantId },
          select: {
            estado: true,
            origenTipo: true,
            origenId: true,
            origenEvento: true,
          },
        });

        if (
          comprobante?.estado !== 'ANULADO' &&
          comprobante?.origenTipo ===
            PAYROLL_CORRECTION_ADJUSTMENT_ORIGIN.type &&
          comprobante.origenEvento ===
            PAYROLL_CORRECTION_ADJUSTMENT_ORIGIN.event &&
          comprobante.origenId
        ) {
          await lockPayrollCorrectionDependencies(tx, tenantId, [
            comprobante.origenId,
          ]);
          await this.ensureNoAccountedDependents(
            tx,
            tenantId,
            comprobante.origenId,
          );
        }

        return this.ledger.anular(tenantId, userId, comprobanteId, motivo, tx);
      });
    } catch (error) {
      if (error instanceof AccountedCorrectionDependentsException) {
        await this.audit
          .log({
            tenantId,
            userId,
            action: 'PAYROLL_CORRECTION_VOID_BLOCKED_DEPENDENCIES',
            entityType: 'PayrollCorrection',
            entityId: error.correctionId,
            metadata: {
              correctionId: error.correctionId,
              dependentCorrectionIds: error.dependentCorrectionIds,
              reason: 'ACCOUNTED_DEPENDENT_CORRECTIONS',
            },
          })
          .catch(() => {});
      }
      throw error;
    }
  }

  private async ensureNoAccountedDependents(
    tx: TenantPrismaClient,
    tenantId: string,
    correctionId: string,
  ): Promise<void> {
    const corrections = await tx.payrollCorrection.findMany({
      where: { tenantId, status: 'APROBADA' },
      select: {
        id: true,
        materialization: true,
        materializedAt: true,
      },
    });

    const dependentCorrectionIds = corrections.flatMap((correction) => {
      if (!correction.materialization || !correction.materializedAt) return [];
      try {
        const materialization = parseCorrectionMaterialization(
          correction.materialization,
        );
        return materialization.approvedCorrectionIds.includes(correctionId)
          ? [correction.id]
          : [];
      } catch {
        return [];
      }
    });

    if (dependentCorrectionIds.length === 0) return;

    const accountedDependents = await tx.comprobanteContable.findMany({
      where: {
        tenantId,
        origenTipo: PAYROLL_CORRECTION_ADJUSTMENT_ORIGIN.type,
        origenId: { in: dependentCorrectionIds },
        origenEvento: PAYROLL_CORRECTION_ADJUSTMENT_ORIGIN.event,
        estado: { not: 'ANULADO' },
        reversos: { none: { estado: 'CONTABILIZADO' } },
      },
      select: { origenId: true },
    });

    const accountedDependentIds = [
      ...new Set(
        accountedDependents
          .map((comprobante) => comprobante.origenId)
          .filter((id): id is string => id !== null),
      ),
    ];
    if (accountedDependentIds.length > 0) {
      throw new AccountedCorrectionDependentsException(
        correctionId,
        accountedDependentIds,
      );
    }
  }
}
