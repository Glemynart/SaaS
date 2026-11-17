import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EmployeeDisbursement,
  EmployeeDisbursementMethod,
  EmployeeDisbursementStatus,
  LiquidationStatus,
  PayrollPeriodStatus,
  Prisma,
} from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { AuditService } from '../../audit/audit.service';
import { StorageService } from '../../storage/storage.service';
import { TenantPrismaService } from '../../tenant-prisma/tenant-prisma.service';
import { validateManualDocument } from '../../expediente-docs/manual-document-validation';
import {
  EmployeeDisbursementSourceType,
  CreateEmployeeDisbursementDto,
} from './employee-disbursement.dto';

const COVERAGE_PERIOD_STATUSES: PayrollPeriodStatus[] = [
  PayrollPeriodStatus.APROBADA,
  PayrollPeriodStatus.CAUSADA,
  PayrollPeriodStatus.CERRADA,
];
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

type Source = {
  sourceType: EmployeeDisbursementSourceType;
  sourceId: string;
  employeeId: string;
  amountDue: Prisma.Decimal;
  payrollPeriodStatus?: PayrollPeriodStatus;
  payrollPeriodStart?: Date;
  payrollPeriodEnd?: Date;
  liquidationStatus?: LiquidationStatus;
};

type PaymentWithReversals = Prisma.EmployeeDisbursementGetPayload<{
  include: { reversals: true };
}>;

type Coverage = {
  amountDue: Prisma.Decimal;
  declaredAmount: Prisma.Decimal;
  supportedAmount: Prisma.Decimal;
  verifiedAmount: Prisma.Decimal;
  reversedAmount: Prisma.Decimal;
  netVerifiedAmount: Prisma.Decimal;
  reservedAmount: Prisma.Decimal;
  outstandingAmount: Prisma.Decimal;
  availableToDeclare: Prisma.Decimal;
  payments: PaymentWithReversals[];
};

@Injectable()
export class EmployeeDisbursementService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
  ) {}

  async create(
    tenantId: string,
    userId: string,
    dto: CreateEmployeeDisbursementDto,
  ) {
    const amount = this.parsePositiveAmount(dto.amount);
    const paidAt = this.parseCalendarDate(dto.paidAt);
    const reference = this.normalizeReference(dto.reference);
    this.assertIdempotencyKey(dto.idempotencyKey);

    return this.tenantPrisma.execute(async (tx) => {
      await this.lockIdempotencyKey(tx, tenantId, dto.idempotencyKey);
      const source = await this.lockSource(
        tx,
        tenantId,
        dto.sourceType,
        dto.sourceId,
      );

      const duplicate = await tx.employeeDisbursement.findFirst({
        where: { tenantId, idempotencyKey: dto.idempotencyKey },
        include: { reversals: true },
      });
      if (duplicate) {
        this.assertSameCreateRequest(
          duplicate,
          source,
          amount,
          paidAt,
          dto.method,
          reference,
        );
        return this.toPaymentResponse(duplicate);
      }

      this.assertSourceCanReceiveDisbursement(source);

      const coverage = await this.readCoverage(tx, tenantId, source);
      if (amount.gt(coverage.availableToDeclare)) {
        throw new ConflictException(
          'El desembolso excede el saldo aún no reservado de la obligación.',
        );
      }

      const payment = await tx.employeeDisbursement.create({
        data: {
          tenantId,
          employeeId: source.employeeId,
          payrollRunId:
            source.sourceType === EmployeeDisbursementSourceType.PAYROLL_RUN
              ? source.sourceId
              : null,
          liquidationId:
            source.sourceType === EmployeeDisbursementSourceType.LIQUIDATION
              ? source.sourceId
              : null,
          amount,
          currency: 'COP',
          paidAt,
          method: dto.method,
          reference,
          idempotencyKey: dto.idempotencyKey,
          registeredByUserId: userId,
          status: EmployeeDisbursementStatus.DECLARED,
        },
        include: { reversals: true },
      });

      await this.audit.log(
        {
          tenantId,
          userId,
          action: 'EMPLOYEE_DISBURSEMENT_DECLARED',
          entityType: 'EmployeeDisbursement',
          entityId: payment.id,
          metadata: {
            sourceType: source.sourceType,
            sourceId: source.sourceId,
            employeeId: source.employeeId,
            amount: amount.toFixed(2),
            currency: 'COP',
            paidAt: dto.paidAt,
            method: dto.method,
            referencePresent: reference !== null,
            status: EmployeeDisbursementStatus.DECLARED,
          },
        },
        tx,
      );

      return this.toPaymentResponse(payment);
    });
  }

  async attachSupport(
    tenantId: string,
    userId: string,
    paymentId: string,
    file: Express.Multer.File,
  ) {
    const validated = validateManualDocument(file);
    const sha256 = createHash('sha256').update(file.buffer).digest('hex');
    const suffix = randomUUID();
    let storedKey: string | null = null;

    try {
      const result = await this.tenantPrisma.execute(async (tx) => {
        const current = await this.findPayment(tx, tenantId, paymentId);
        const sourceType = this.sourceTypeOf(current);
        const sourceId = this.sourceIdOf(current);
        const source = await this.lockSource(
          tx,
          tenantId,
          sourceType,
          sourceId,
        );
        const payment = await this.findPayment(tx, tenantId, paymentId);

        this.assertSourceCanReceiveDisbursement(source);

        if (payment.status !== EmployeeDisbursementStatus.DECLARED) {
          throw new ConflictException(
            'El soporte solo puede adjuntarse a un desembolso DECLARED.',
          );
        }

        const key = `tenants/${tenantId}/employee-disbursements/${paymentId}/${suffix}.${validated.extension}`;
        await this.storage.putObject({
          key,
          body: file.buffer,
          contentType: validated.mimeType,
        });
        storedKey = key;

        const supportedAt = new Date();
        const updated = await tx.employeeDisbursement.update({
          where: { id: payment.id },
          data: {
            status: EmployeeDisbursementStatus.SUPPORTED,
            supportStorageKey: key,
            supportMimeType: validated.mimeType,
            supportSizeBytes: validated.size,
            supportSha256: sha256,
            supportedAt,
          },
          include: { reversals: true },
        });

        await this.audit.log(
          {
            tenantId,
            userId,
            action: 'EMPLOYEE_DISBURSEMENT_SUPPORT_ATTACHED',
            entityType: 'EmployeeDisbursement',
            entityId: payment.id,
            metadata: {
              sourceType: source.sourceType,
              sourceId: source.sourceId,
              employeeId: payment.employeeId,
              mimeType: validated.mimeType,
              sizeBytes: validated.size,
              sha256,
              status: EmployeeDisbursementStatus.SUPPORTED,
            },
          },
          tx,
        );

        return this.toPaymentResponse(updated);
      });
      // The transaction wrapper resolves only after COMMIT. Keep the new
      // object eligible for compensation until that point.
      storedKey = null;
      return result;
    } catch (error) {
      if (storedKey) {
        const uploadedKey = storedKey;
        try {
          const persistedRows = await this.tenantPrisma.execute(
            (tx) =>
              tx.$queryRaw<Array<{ supportStorageKey: string | null }>>`
              SELECT "supportStorageKey" FROM "employee_disbursements"
              WHERE "id" = ${paymentId} AND "tenantId" = ${tenantId}
              FOR UPDATE
            `,
          );
          if (persistedRows[0]?.supportStorageKey !== uploadedKey) {
            await this.storage.deleteObject(uploadedKey).catch(() => undefined);
          }
        } catch {
          // A failed commit can have an ambiguous outcome. Keep the object if
          // its database reference cannot be checked; reconciliation can
          // remove an orphan later without breaking a committed support link.
        }
      }
      throw error;
    }
  }

  async verify(tenantId: string, userId: string, paymentId: string) {
    return this.tenantPrisma.execute(async (tx) => {
      const initial = await this.findPayment(tx, tenantId, paymentId);
      const source = await this.lockSource(
        tx,
        tenantId,
        this.sourceTypeOf(initial),
        this.sourceIdOf(initial),
      );
      const payment = await this.findPayment(tx, tenantId, paymentId);

      if (payment.status === EmployeeDisbursementStatus.VERIFIED) {
        return this.toPaymentResponse(payment);
      }
      if (payment.status !== EmployeeDisbursementStatus.SUPPORTED) {
        throw new ConflictException(
          'Solo puede verificarse un desembolso SUPPORTED con soporte adjunto.',
        );
      }
      if (this.isFutureCalendarDate(payment.paidAt)) {
        throw new ConflictException(
          'La fecha del desembolso aún es futura; no puede verificarse como pago realizado.',
        );
      }
      this.assertSourceCanReceiveDisbursement(source);
      await this.assertPayrollRunCanStillBeVerified(tx, tenantId, source);
      const coverage = await this.readCoverage(tx, tenantId, source);
      if (coverage.availableToDeclare.isNegative()) {
        throw new ConflictException(
          'El saldo de la obligación cambió; no se verificó el desembolso.',
        );
      }
      if (
        !payment.supportStorageKey ||
        !this.hasTenantScopedSupportKey(payment)
      ) {
        throw new ConflictException(
          'El soporte privado no está disponible; el desembolso no fue verificado.',
        );
      }
      const support = await this.storage.getObject(payment.supportStorageKey);
      if (
        support.length !== payment.supportSizeBytes ||
        createHash('sha256').update(support).digest('hex') !==
          payment.supportSha256
      ) {
        throw new ConflictException(
          'El soporte no coincide con la huella registrada; el desembolso no fue verificado.',
        );
      }

      const verifiedAt = new Date();
      const updated = await tx.employeeDisbursement.update({
        where: { id: payment.id },
        data: {
          status: EmployeeDisbursementStatus.VERIFIED,
          verifiedByUserId: userId,
          verifiedAt,
        },
        include: { reversals: true },
      });

      await this.audit.log(
        {
          tenantId,
          userId,
          action: 'EMPLOYEE_DISBURSEMENT_VERIFIED',
          entityType: 'EmployeeDisbursement',
          entityId: payment.id,
          metadata: {
            sourceType: source.sourceType,
            sourceId: source.sourceId,
            employeeId: payment.employeeId,
            amount: payment.amount.toFixed(2),
            currency: payment.currency,
            verifiedAt: verifiedAt.toISOString(),
            supportSha256: payment.supportSha256,
          },
        },
        tx,
      );

      return this.toPaymentResponse(updated);
    });
  }

  async cancel(
    tenantId: string,
    userId: string,
    paymentId: string,
    reason: string,
  ) {
    const normalizedReason = reason.trim();
    if (!normalizedReason) {
      throw new BadRequestException('Indique el motivo de cancelación.');
    }
    if (normalizedReason.length > 512) {
      throw new BadRequestException(
        'El motivo de cancelación supera 512 caracteres.',
      );
    }

    return this.tenantPrisma.execute(async (tx) => {
      const initial = await this.findPayment(tx, tenantId, paymentId);
      const source = await this.lockSource(
        tx,
        tenantId,
        this.sourceTypeOf(initial),
        this.sourceIdOf(initial),
      );
      const payment = await this.findPayment(tx, tenantId, paymentId);

      if (payment.status === EmployeeDisbursementStatus.CANCELLED) {
        return this.toPaymentResponse(payment);
      }
      if (payment.status === EmployeeDisbursementStatus.VERIFIED) {
        throw new ConflictException(
          'Un desembolso verificado no se cancela; registre un reverso append-only.',
        );
      }

      const cancelledAt = new Date();
      const updated = await tx.employeeDisbursement.update({
        where: { id: payment.id },
        data: {
          status: EmployeeDisbursementStatus.CANCELLED,
          cancelledByUserId: userId,
          cancelledAt,
          cancellationReason: normalizedReason,
        },
        include: { reversals: true },
      });
      await this.audit.log(
        {
          tenantId,
          userId,
          action: 'EMPLOYEE_DISBURSEMENT_CANCELLED',
          entityType: 'EmployeeDisbursement',
          entityId: payment.id,
          metadata: {
            sourceType: source.sourceType,
            sourceId: source.sourceId,
            amount: payment.amount.toFixed(2),
            reasonProvided: true,
          },
        },
        tx,
      );
      return this.toPaymentResponse(updated);
    });
  }

  async reverse(
    tenantId: string,
    userId: string,
    paymentId: string,
    input: { amount: string; reason: string; idempotencyKey: string },
  ) {
    const amount = this.parsePositiveAmount(input.amount);
    const reason = input.reason.trim();
    if (!reason || reason.length > 512) {
      throw new BadRequestException('Indique un motivo de reverso válido.');
    }
    this.assertIdempotencyKey(input.idempotencyKey);

    return this.tenantPrisma.execute(async (tx) => {
      await this.lockIdempotencyKey(tx, tenantId, input.idempotencyKey);
      const initial = await this.findPayment(tx, tenantId, paymentId);
      const source = await this.lockSource(
        tx,
        tenantId,
        this.sourceTypeOf(initial),
        this.sourceIdOf(initial),
      );
      const payment = await this.findPayment(tx, tenantId, paymentId);

      const duplicate = await tx.employeeDisbursementReversal.findFirst({
        where: { tenantId, idempotencyKey: input.idempotencyKey },
      });
      if (duplicate) {
        if (
          duplicate.disbursementId !== payment.id ||
          !duplicate.amount.equals(amount) ||
          duplicate.reason !== reason
        ) {
          throw new ConflictException(
            'La clave de idempotencia ya se usó con otros datos de reverso.',
          );
        }
        return this.toReversalResponse(duplicate);
      }

      if (payment.status !== EmployeeDisbursementStatus.VERIFIED) {
        throw new ConflictException(
          'Solo puede reversarse un desembolso VERIFIED.',
        );
      }
      await this.assertPayrollRunCanStillBeReversed(tx, tenantId, source);

      const reversed = payment.reversals.reduce(
        (sum, reversal) => sum.plus(reversal.amount),
        new Prisma.Decimal(0),
      );
      const remaining = payment.amount.minus(reversed);
      if (amount.gt(remaining)) {
        throw new ConflictException(
          'El reverso excede el importe verificado aún no reversado.',
        );
      }

      const reversal = await tx.employeeDisbursementReversal.create({
        data: {
          tenantId,
          disbursementId: payment.id,
          amount,
          reason,
          idempotencyKey: input.idempotencyKey,
          createdByUserId: userId,
        },
      });

      await this.audit.log(
        {
          tenantId,
          userId,
          action: 'EMPLOYEE_DISBURSEMENT_REVERSED',
          entityType: 'EmployeeDisbursementReversal',
          entityId: reversal.id,
          metadata: {
            sourceType: source.sourceType,
            sourceId: source.sourceId,
            employeeId: payment.employeeId,
            disbursementId: payment.id,
            amount: amount.toFixed(2),
            currency: payment.currency,
            reasonProvided: true,
          },
        },
        tx,
      );

      return this.toReversalResponse(reversal);
    });
  }

  async getSummary(
    tenantId: string,
    sourceType: EmployeeDisbursementSourceType,
    sourceId: string,
  ) {
    return this.tenantPrisma.execute(async (tx) => {
      const source = await this.loadSource(tx, tenantId, sourceType, sourceId);
      const coverage = await this.readCoverage(tx, tenantId, source);
      return {
        sourceType,
        sourceId,
        employeeId: source.employeeId,
        currency: 'COP',
        amountDue: coverage.amountDue.toFixed(2),
        declaredAmount: coverage.declaredAmount.toFixed(2),
        supportedAmount: coverage.supportedAmount.toFixed(2),
        verifiedAmount: coverage.verifiedAmount.toFixed(2),
        reversedAmount: coverage.reversedAmount.toFixed(2),
        netVerifiedAmount: coverage.netVerifiedAmount.toFixed(2),
        outstandingAmount: coverage.outstandingAmount.toFixed(2),
        reservedAmount: coverage.reservedAmount.toFixed(2),
        availableToDeclare: coverage.availableToDeclare.toFixed(2),
        payments: coverage.payments.map((payment) =>
          this.toPaymentResponse(payment),
        ),
      };
    });
  }

  async downloadSupport(tenantId: string, userId: string, paymentId: string) {
    return this.tenantPrisma.execute(async (tx) => {
      const payment = await this.findPayment(tx, tenantId, paymentId);
      if (!payment.supportStorageKey || !payment.supportMimeType) {
        throw new NotFoundException('El desembolso no tiene soporte adjunto.');
      }
      if (!this.hasTenantScopedSupportKey(payment)) {
        throw new NotFoundException(
          'El soporte no pertenece al tenant activo.',
        );
      }
      const body = await this.storage.getObject(payment.supportStorageKey);
      if (
        body.length !== payment.supportSizeBytes ||
        createHash('sha256').update(body).digest('hex') !==
          payment.supportSha256
      ) {
        throw new ConflictException(
          'El soporte no coincide con la huella registrada; se bloqueó la descarga.',
        );
      }
      await this.audit.log(
        {
          tenantId,
          userId,
          action: 'EMPLOYEE_DISBURSEMENT_SUPPORT_DOWNLOADED',
          entityType: 'EmployeeDisbursement',
          entityId: payment.id,
          metadata: {
            employeeId: payment.employeeId,
            sizeBytes: payment.supportSizeBytes,
            sha256: payment.supportSha256,
          },
        },
        tx,
      );
      return {
        body,
        mimeType: payment.supportMimeType,
        sizeBytes: payment.supportSizeBytes,
      };
    });
  }

  /** Shared with N2D.4 inside its existing tenant transaction. */
  async getPayrollRunNetVerifiedAmount(
    tx: Prisma.TransactionClient,
    tenantId: string,
    payrollRunId: string,
  ): Promise<Prisma.Decimal> {
    const source = await this.loadSource(
      tx,
      tenantId,
      EmployeeDisbursementSourceType.PAYROLL_RUN,
      payrollRunId,
    );
    const coverage = await this.readCoverage(tx, tenantId, source);
    return coverage.netVerifiedAmount;
  }

  /** Used before voiding a liquidation so verified money cannot be orphaned. */
  async getLiquidationNetVerifiedAmount(
    tx: Prisma.TransactionClient,
    tenantId: string,
    liquidationId: string,
  ): Promise<Prisma.Decimal> {
    const source = await this.loadSource(
      tx,
      tenantId,
      EmployeeDisbursementSourceType.LIQUIDATION,
      liquidationId,
    );
    const coverage = await this.readCoverage(tx, tenantId, source);
    return coverage.netVerifiedAmount;
  }

  private async lockSource(
    tx: Prisma.TransactionClient,
    tenantId: string,
    sourceType: EmployeeDisbursementSourceType,
    sourceId: string,
  ): Promise<Source> {
    const initial = await this.loadSource(tx, tenantId, sourceType, sourceId);
    const employee = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "empleados"
      WHERE "tenantId" = ${tenantId} AND "id" = ${initial.employeeId}
      FOR UPDATE
    `;
    if (employee.length === 0) {
      throw new NotFoundException(
        'El beneficiario de la obligación no existe.',
      );
    }

    // Locking the employee serializes this obligation with other payment and
    // liquidation transitions. The finalized PayrollRun row itself is
    // immutable under its RLS policy, which intentionally prevents FOR UPDATE
    // on approved/caused periods for the runtime role.
    return this.loadSource(tx, tenantId, sourceType, sourceId);
  }

  private async loadSource(
    tx: Prisma.TransactionClient,
    tenantId: string,
    sourceType: EmployeeDisbursementSourceType,
    sourceId: string,
  ): Promise<Source> {
    if (sourceType === EmployeeDisbursementSourceType.PAYROLL_RUN) {
      const run = await tx.payrollRun.findFirst({
        where: { id: sourceId, tenantId },
        select: {
          id: true,
          employeeId: true,
          netoPagar: true,
          payrollPeriod: {
            select: { status: true, fechaInicio: true, fechaFin: true },
          },
        },
      });
      if (!run)
        throw new NotFoundException('La obligación de nómina no existe.');
      return {
        sourceType,
        sourceId: run.id,
        employeeId: run.employeeId,
        amountDue: run.netoPagar,
        payrollPeriodStatus: run.payrollPeriod.status,
        payrollPeriodStart: run.payrollPeriod.fechaInicio,
        payrollPeriodEnd: run.payrollPeriod.fechaFin,
      };
    }

    const liquidation = await tx.liquidation.findFirst({
      where: { id: sourceId, tenantId },
      select: {
        id: true,
        empleadoId: true,
        totalLiquidacion: true,
        status: true,
      },
    });
    if (!liquidation) {
      throw new NotFoundException('La obligación de liquidación no existe.');
    }
    return {
      sourceType,
      sourceId: liquidation.id,
      employeeId: liquidation.empleadoId,
      amountDue: liquidation.totalLiquidacion,
      liquidationStatus: liquidation.status,
    };
  }

  private assertSourceCanReceiveDisbursement(source: Source) {
    if (source.sourceType === EmployeeDisbursementSourceType.PAYROLL_RUN) {
      if (!COVERAGE_PERIOD_STATUSES.includes(source.payrollPeriodStatus!)) {
        throw new ConflictException(
          'La ejecución de nómina debe estar aprobada o causada antes de registrar desembolsos.',
        );
      }
    } else if (
      source.liquidationStatus !== LiquidationStatus.APPROVED &&
      source.liquidationStatus !== LiquidationStatus.PAID
    ) {
      throw new ConflictException(
        'La liquidación debe estar aprobada antes del desembolso.',
      );
    }
    if (source.amountDue.isNegative()) {
      throw new ConflictException('La obligación tiene un importe inválido.');
    }
  }

  private async assertPayrollRunCanStillBeVerified(
    tx: Prisma.TransactionClient,
    tenantId: string,
    source: Source,
  ) {
    if (source.sourceType !== EmployeeDisbursementSourceType.PAYROLL_RUN)
      return;

    const capturedInLiquidation = await tx.liquidation.findFirst({
      where: {
        tenantId,
        empleadoId: source.employeeId,
        status: { not: LiquidationStatus.VOIDED },
        ...(source.payrollPeriodStart && source.payrollPeriodEnd
          ? {
              fechaRetiro: {
                gte: source.payrollPeriodStart,
                lte: source.payrollPeriodEnd,
              },
            }
          : {}),
        concepts: { some: { codigo: 'LIQ_SALARIO_PENDIENTE' } },
      },
      select: { id: true },
    });

    if (capturedInLiquidation) {
      throw new ConflictException(
        'La liquidación ya incorporó el salario pendiente de este período. Registre el desembolso en la obligación de liquidación.',
      );
    }
  }

  private async assertPayrollRunCanStillBeReversed(
    tx: Prisma.TransactionClient,
    tenantId: string,
    source: Source,
  ) {
    if (source.sourceType !== EmployeeDisbursementSourceType.PAYROLL_RUN)
      return;
    if (!source.payrollPeriodStart || !source.payrollPeriodEnd) {
      throw new ConflictException(
        'No se pudo validar si una liquidación ya consumió esta cobertura salarial.',
      );
    }

    const liquidation = await tx.liquidation.findFirst({
      where: {
        tenantId,
        empleadoId: source.employeeId,
        status: { not: LiquidationStatus.VOIDED },
        fechaRetiro: {
          gte: source.payrollPeriodStart,
          lte: source.payrollPeriodEnd,
        },
      },
      select: { id: true },
    });
    if (liquidation) {
      throw new ConflictException(
        'La liquidación ya fue generada con la cobertura de esta nómina. Anúlela primero y después registre el reverso.',
      );
    }
  }

  private async lockIdempotencyKey(
    tx: Prisma.TransactionClient,
    tenantId: string,
    idempotencyKey: string,
  ) {
    await tx.$queryRaw<{ locked: number }[]>`
      SELECT 1::integer AS locked
      FROM (
        SELECT pg_advisory_xact_lock(
          hashtext(${tenantId}),
          hashtext(${idempotencyKey})
        )
      ) AS idempotency_lock
    `;
  }

  private hasTenantScopedSupportKey(payment: EmployeeDisbursement): boolean {
    return Boolean(
      payment.supportStorageKey?.startsWith(
        `tenants/${payment.tenantId}/employee-disbursements/${payment.id}/`,
      ),
    );
  }

  private async readCoverage(
    tx: Prisma.TransactionClient,
    tenantId: string,
    source: Source,
  ): Promise<Coverage> {
    const payments = await tx.employeeDisbursement.findMany({
      where: {
        tenantId,
        ...(source.sourceType === EmployeeDisbursementSourceType.PAYROLL_RUN
          ? { payrollRunId: source.sourceId }
          : { liquidationId: source.sourceId }),
      },
      include: { reversals: true },
    });

    let declaredAmount = new Prisma.Decimal(0);
    let supportedAmount = new Prisma.Decimal(0);
    let verifiedAmount = new Prisma.Decimal(0);
    let reversedAmount = new Prisma.Decimal(0);
    let reservedAmount = new Prisma.Decimal(0);

    for (const payment of payments) {
      const reversed = payment.reversals.reduce(
        (sum, reversal) => sum.plus(reversal.amount),
        new Prisma.Decimal(0),
      );
      if (payment.status !== EmployeeDisbursementStatus.CANCELLED) {
        reservedAmount = reservedAmount.plus(payment.amount).minus(reversed);
      }
      if (payment.status === EmployeeDisbursementStatus.DECLARED) {
        declaredAmount = declaredAmount.plus(payment.amount);
      } else if (payment.status === EmployeeDisbursementStatus.SUPPORTED) {
        supportedAmount = supportedAmount.plus(payment.amount);
      } else if (payment.status === EmployeeDisbursementStatus.VERIFIED) {
        verifiedAmount = verifiedAmount.plus(payment.amount);
        reversedAmount = reversedAmount.plus(reversed);
      }
    }

    const netVerifiedAmount = verifiedAmount.minus(reversedAmount);
    const outstandingAmount = source.amountDue.minus(netVerifiedAmount);
    const availableToDeclare = source.amountDue.minus(reservedAmount);
    if (
      netVerifiedAmount.isNegative() ||
      outstandingAmount.isNegative() ||
      availableToDeclare.isNegative()
    ) {
      throw new ConflictException(
        'Los desembolsos exceden la obligación o su historial de reversos es inconsistente.',
      );
    }

    return {
      amountDue: source.amountDue,
      declaredAmount,
      supportedAmount,
      verifiedAmount,
      reversedAmount,
      netVerifiedAmount,
      reservedAmount,
      outstandingAmount,
      availableToDeclare,
      payments,
    };
  }

  private async findPayment(
    tx: Prisma.TransactionClient,
    tenantId: string,
    id: string,
  ): Promise<PaymentWithReversals> {
    const payment = await tx.employeeDisbursement.findFirst({
      where: { id, tenantId },
      include: { reversals: true },
    });
    if (!payment) {
      throw new NotFoundException(
        'El desembolso no existe en el tenant activo.',
      );
    }
    return payment;
  }

  private sourceTypeOf(
    payment: EmployeeDisbursement,
  ): EmployeeDisbursementSourceType {
    if (payment.payrollRunId && !payment.liquidationId) {
      return EmployeeDisbursementSourceType.PAYROLL_RUN;
    }
    if (payment.liquidationId && !payment.payrollRunId) {
      return EmployeeDisbursementSourceType.LIQUIDATION;
    }
    throw new ConflictException('El desembolso tiene una fuente inválida.');
  }

  private sourceIdOf(payment: EmployeeDisbursement): string {
    return payment.payrollRunId ?? payment.liquidationId ?? '';
  }

  private assertSameCreateRequest(
    payment: EmployeeDisbursement,
    source: Source,
    amount: Prisma.Decimal,
    paidAt: Date,
    method: EmployeeDisbursementMethod,
    reference: string | null,
  ) {
    if (
      this.sourceTypeOf(payment) !== source.sourceType ||
      this.sourceIdOf(payment) !== source.sourceId ||
      !payment.amount.equals(amount) ||
      payment.paidAt.toISOString().slice(0, 10) !==
        paidAt.toISOString().slice(0, 10) ||
      payment.method !== method ||
      payment.reference !== reference
    ) {
      throw new ConflictException(
        'La clave de idempotencia ya se usó con otros datos de desembolso.',
      );
    }
  }

  private toPaymentResponse(payment: PaymentWithReversals) {
    const reversedAmount = payment.reversals.reduce(
      (sum, reversal) => sum.plus(reversal.amount),
      new Prisma.Decimal(0),
    );
    return {
      id: payment.id,
      tenantId: payment.tenantId,
      employeeId: payment.employeeId,
      sourceType: this.sourceTypeOf(payment),
      sourceId: this.sourceIdOf(payment),
      amount: payment.amount.toFixed(2),
      currency: payment.currency,
      paidAt: payment.paidAt.toISOString().slice(0, 10),
      method: payment.method,
      reference: payment.reference,
      status: payment.status,
      registeredByUserId: payment.registeredByUserId,
      createdAt: payment.createdAt,
      supportedAt: payment.supportedAt,
      support: payment.supportStorageKey
        ? {
            mimeType: payment.supportMimeType,
            sizeBytes: payment.supportSizeBytes,
            sha256: payment.supportSha256,
          }
        : null,
      verifiedByUserId: payment.verifiedByUserId,
      verifiedAt: payment.verifiedAt,
      cancelledByUserId: payment.cancelledByUserId,
      cancelledAt: payment.cancelledAt,
      cancellationReason: payment.cancellationReason,
      reversedAmount: reversedAmount.toFixed(2),
      reversalCount: payment.reversals.length,
    };
  }

  private toReversalResponse(reversal: {
    id: string;
    disbursementId: string;
    amount: Prisma.Decimal;
    reason: string;
    createdByUserId: string;
    createdAt: Date;
  }) {
    return {
      id: reversal.id,
      disbursementId: reversal.disbursementId,
      amount: reversal.amount.toFixed(2),
      currency: 'COP',
      reason: reversal.reason,
      createdByUserId: reversal.createdByUserId,
      createdAt: reversal.createdAt,
    };
  }

  private parsePositiveAmount(value: string): Prisma.Decimal {
    if (!/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/.test(value)) {
      throw new BadRequestException(
        'El importe debe ser un valor COP positivo con máximo dos decimales.',
      );
    }
    const amount = new Prisma.Decimal(value);
    if (!amount.gt(0)) {
      throw new BadRequestException(
        'El importe del desembolso debe ser mayor que cero.',
      );
    }
    return amount;
  }

  private parseCalendarDate(value: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException('La fecha debe tener formato AAAA-MM-DD.');
    }
    const date = new Date(`${value}T00:00:00.000Z`);
    if (
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value
    ) {
      throw new BadRequestException('La fecha de desembolso no es válida.');
    }
    return date;
  }

  private isFutureCalendarDate(date: Date): boolean {
    const todayInBogota = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(new Date())
      .filter((part) => part.type !== 'literal')
      .reduce<Record<string, string>>((parts, part) => {
        parts[part.type] = part.value;
        return parts;
      }, {});
    const today = `${todayInBogota.year}-${todayInBogota.month}-${todayInBogota.day}`;
    return date.toISOString().slice(0, 10) > today;
  }

  private normalizeReference(reference?: string): string | null {
    const normalized = reference?.trim() ?? '';
    if (normalized.length > 128) {
      throw new BadRequestException(
        'La referencia no puede superar 128 caracteres.',
      );
    }
    return normalized.length > 0 ? normalized : null;
  }

  private assertIdempotencyKey(value: string) {
    if (!IDEMPOTENCY_KEY_PATTERN.test(value)) {
      throw new BadRequestException('La clave de idempotencia no es válida.');
    }
  }
}
