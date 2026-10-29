import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  AlertGenerationRunStatus,
  AlertGenerationRunTrigger,
  AlertGenerationRunTenantStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import { AuditService } from '../audit/audit.service';
import { AlertsService } from './alerts.service';

const ALERTS_SCHEDULER_KEY = 'alerts-daily-generation';
const MAX_ATTEMPTS = 2;
const RETENTION_DAYS = 180;
const STALE_RUN_HOURS = 2;
const SCHEDULER_CONTEXT = {
  userId: 'system:alerts-scheduler',
  rol: 'SYSTEM',
  email: 'alerts-scheduler@internal.invalid',
} as const;

type RunActor = {
  userId: string;
  role: string;
};

type RunClaim = {
  run: {
    id: string;
    status: AlertGenerationRunStatus;
    tenantsProcessed: number;
    tenantsFailed: number;
    contractAlertsCreated: number;
    missingDocAlertsCreated: number;
  };
  tenantIds: string[];
  skipped: boolean;
};

export interface DailyAlertGenerationSummary {
  runId: string;
  status: AlertGenerationRunStatus;
  skipped: boolean;
  tenantsProcessed: number;
  tenantsFailed: number;
  contractAlertsCreated: number;
  missingDocAlertsCreated: number;
}

export interface AlertGenerationRunView {
  id: string;
  schedulerKey: string;
  trigger: AlertGenerationRunTrigger;
  parentRunId: string | null;
  status: AlertGenerationRunStatus;
  startedAt: Date;
  finishedAt: Date | null;
  tenantsProcessed: number;
  tenantsFailed: number;
  contractAlertsCreated: number;
  missingDocAlertsCreated: number;
  tenantResult: {
    status: AlertGenerationRunTenantStatus;
    attemptCount: number;
    lastErrorCode: string | null;
    startedAt: Date;
    finishedAt: Date | null;
  } | null;
}

@Injectable()
export class AlertsSchedulerService {
  private readonly logger = new Logger(AlertsSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly alertsService: AlertsService,
    private readonly tenantContext: TenantContextService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * The scheduler runs inside the API process so local and single-instance
   * deployments do not need Redis or an external worker. PostgreSQL owns the
   * one-RUNNING-per-scheduler invariant; each tenant is processed in its own
   * transaction after the run has been claimed.
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM, {
    name: ALERTS_SCHEDULER_KEY,
  })
  async runDailyGeneration(): Promise<DailyAlertGenerationSummary> {
    return this.executeRun({
      trigger: AlertGenerationRunTrigger.SCHEDULED,
      actor: { userId: SCHEDULER_CONTEXT.userId, role: SCHEDULER_CONTEXT.rol },
    });
  }

  async getLatestForTenant(
    tenantId: string,
  ): Promise<AlertGenerationRunView | null> {
    const run = await this.prisma.alertGenerationRun.findFirst({
      where: {
        schedulerKey: ALERTS_SCHEDULER_KEY,
        tenantResults: { some: { tenantId } },
      },
      orderBy: [{ startedAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        tenantResults: {
          where: { tenantId },
          select: {
            status: true,
            attemptCount: true,
            lastErrorCode: true,
            startedAt: true,
            finishedAt: true,
          },
        },
      },
    });

    if (!run) return null;

    const tenantResult = run.tenantResults[0] ?? null;
    return {
      id: run.id,
      schedulerKey: run.schedulerKey,
      trigger: run.trigger,
      parentRunId: run.parentRunId,
      status: run.status,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      tenantsProcessed: run.tenantsProcessed,
      tenantsFailed: run.tenantsFailed,
      contractAlertsCreated: run.contractAlertsCreated,
      missingDocAlertsCreated: run.missingDocAlertsCreated,
      tenantResult,
    };
  }

  async retryFailedTenant(
    tenantId: string,
    failedRunId: string,
    userId: string,
  ): Promise<DailyAlertGenerationSummary> {
    const failedResult = await this.prisma.alertGenerationRunTenant.findFirst({
      where: {
        runId: failedRunId,
        tenantId,
        status: AlertGenerationRunTenantStatus.FAILED,
        run: { schedulerKey: ALERTS_SCHEDULER_KEY },
      },
      select: { id: true },
    });

    if (!failedResult) {
      throw new NotFoundException(
        'No existe un fallo reintentable para esta organización.',
      );
    }

    const result = await this.executeRun({
      trigger: AlertGenerationRunTrigger.MANUAL_RETRY,
      parentRunId: failedRunId,
      tenantIds: [tenantId],
      actor: { userId, role: 'ADMIN' },
    });

    if (result.skipped) {
      throw new ConflictException(
        'Ya existe una ejecución del scheduler en curso.',
      );
    }

    return result;
  }

  private async executeRun(input: {
    trigger: AlertGenerationRunTrigger;
    parentRunId?: string;
    tenantIds?: string[];
    actor: RunActor;
  }): Promise<DailyAlertGenerationSummary> {
    const claim = await this.claimRun(input);

    if (claim.skipped) {
      return this.toSummary(claim.run, true);
    }

    for (const tenantId of claim.tenantIds) {
      await this.processTenant(claim.run.id, tenantId, input.actor);
    }

    return this.finishRun(claim.run.id);
  }

  private async claimRun(input: {
    trigger: AlertGenerationRunTrigger;
    parentRunId?: string;
    tenantIds?: string[];
  }): Promise<RunClaim> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.recoverStaleRuns(tx);
        await this.purgeExpiredRuns(tx);

        const tenants = await tx.tenant.findMany({
          where: input.tenantIds
            ? { id: { in: input.tenantIds } }
            : { activo: true },
          select: { id: true },
          orderBy: { id: 'asc' },
        });
        const tenantIds = tenants.map((tenant) => tenant.id);
        const run = await tx.alertGenerationRun.create({
          data: {
            schedulerKey: ALERTS_SCHEDULER_KEY,
            trigger: input.trigger,
            parentRunId: input.parentRunId,
          },
          select: {
            id: true,
            status: true,
            tenantsProcessed: true,
            tenantsFailed: true,
            contractAlertsCreated: true,
            missingDocAlertsCreated: true,
          },
        });

        if (tenantIds.length > 0) {
          await tx.alertGenerationRunTenant.createMany({
            data: tenantIds.map((tenantId) => ({
              runId: run.id,
              tenantId,
            })),
          });
        }

        return { run, tenantIds, skipped: false };
      });
    } catch (error) {
      if (!this.isUniqueConstraintError(error)) throw error;

      const skippedRun = await this.prisma.alertGenerationRun.create({
        data: {
          schedulerKey: ALERTS_SCHEDULER_KEY,
          trigger: input.trigger,
          parentRunId: input.parentRunId,
          status: AlertGenerationRunStatus.SKIPPED,
          finishedAt: new Date(),
        },
        select: {
          id: true,
          status: true,
          tenantsProcessed: true,
          tenantsFailed: true,
          contractAlertsCreated: true,
          missingDocAlertsCreated: true,
        },
      });

      return { run: skippedRun, tenantIds: [], skipped: true };
    }
  }

  private async processTenant(
    runId: string,
    tenantId: string,
    actor: RunActor,
  ): Promise<void> {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        await this.startTenantAttempt(runId, tenantId);
        await this.recordAudit(tenantId, 'ALERT_GENERATION_STARTED', actor, {
          runId,
          attempt,
        });

        await this.prisma.$transaction(async (tx) => {
          await tx.$executeRaw`
            SELECT set_config('app.current_tenant_id', ${tenantId}, true)
          `;

          const result = await this.tenantContext.run(
            {
              tenantId,
              userId: actor.userId,
              rol: actor.role,
              email:
                actor.userId === SCHEDULER_CONTEXT.userId
                  ? SCHEDULER_CONTEXT.email
                  : 'operator@internal.invalid',
            },
            () => this.alertsService.generateForTenant(tenantId, tx),
          );

          await this.auditService.log(
            {
              tenantId,
              userId: actor.userId,
              action: 'ALERT_GENERATION_FINISHED',
              entityType: 'AlertGenerationRun',
              entityId: runId,
              metadata: {
                runId,
                attempt,
                contractAlertsCreated: result.contractAlerts.created,
                missingDocAlertsCreated: result.missingDocAlerts.created,
              },
            },
            tx,
          );

          await tx.alertGenerationRunTenant.update({
            where: { runId_tenantId: { runId, tenantId } },
            data: {
              status: AlertGenerationRunTenantStatus.SUCCEEDED,
              contractAlertsCreated: result.contractAlerts.created,
              missingDocAlertsCreated: result.missingDocAlerts.created,
              lastErrorCode: null,
              finishedAt: new Date(),
            },
          });

          await tx.alertGenerationRun.update({
            where: { id: runId },
            data: {
              tenantsProcessed: { increment: 1 },
              contractAlertsCreated: {
                increment: result.contractAlerts.created,
              },
              missingDocAlertsCreated: {
                increment: result.missingDocAlerts.created,
              },
            },
          });
        });

        return;
      } catch (error) {
        const errorCode = this.toSafeErrorCode(error);
        const isFinalAttempt = attempt === MAX_ATTEMPTS;
        await this.markTenantFailure(
          runId,
          tenantId,
          errorCode,
          isFinalAttempt,
        );
        try {
          await this.recordAudit(
            tenantId,
            'ALERT_GENERATION_TENANT_FAILED',
            actor,
            {
              runId,
              attempt,
              errorCode,
            },
          );
        } catch (auditError) {
          this.logger.error(
            `Could not record alert generation failure audit for ${runId}/${tenantId}.`,
            auditError instanceof Error ? auditError.stack : undefined,
          );
        }

        if (isFinalAttempt) {
          try {
            await this.recordAudit(
              tenantId,
              'ALERT_GENERATION_FINISHED',
              actor,
              {
                runId,
                attempt,
                status: AlertGenerationRunTenantStatus.FAILED,
                errorCode,
              },
            );
          } catch (auditError) {
            this.logger.error(
              `Could not record alert generation completion audit for ${runId}/${tenantId}.`,
              auditError instanceof Error ? auditError.stack : undefined,
            );
          }
          return;
        }

        try {
          await this.recordAudit(tenantId, 'ALERT_GENERATION_RETRIED', actor, {
            runId,
            attempt: attempt + 1,
            automatic: true,
          });
        } catch (auditError) {
          this.logger.error(
            `Could not record alert generation retry audit for ${runId}/${tenantId}.`,
            auditError instanceof Error ? auditError.stack : undefined,
          );
        }
      }
    }
  }

  private async startTenantAttempt(runId: string, tenantId: string) {
    await this.prisma.alertGenerationRunTenant.update({
      where: { runId_tenantId: { runId, tenantId } },
      data: {
        status: AlertGenerationRunTenantStatus.RUNNING,
        attemptCount: { increment: 1 },
        lastErrorCode: null,
        startedAt: new Date(),
        finishedAt: null,
      },
    });
  }

  private async markTenantFailure(
    runId: string,
    tenantId: string,
    errorCode: string,
    finalAttempt: boolean,
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.alertGenerationRunTenant.update({
        where: { runId_tenantId: { runId, tenantId } },
        data: {
          status: AlertGenerationRunTenantStatus.FAILED,
          lastErrorCode: errorCode,
          ...(finalAttempt ? { finishedAt: new Date() } : {}),
        },
      });

      if (finalAttempt) {
        await tx.alertGenerationRun.update({
          where: { id: runId },
          data: {
            tenantsProcessed: { increment: 1 },
            tenantsFailed: { increment: 1 },
          },
        });
      }
    });
  }

  private async finishRun(runId: string): Promise<DailyAlertGenerationSummary> {
    const tenantResults = await this.prisma.alertGenerationRunTenant.findMany({
      where: { runId },
      select: { status: true },
    });
    const failed = tenantResults.filter(
      (result) => result.status === AlertGenerationRunTenantStatus.FAILED,
    ).length;
    const succeeded = tenantResults.filter(
      (result) => result.status === AlertGenerationRunTenantStatus.SUCCEEDED,
    ).length;
    const status =
      failed === 0
        ? AlertGenerationRunStatus.SUCCEEDED
        : succeeded === 0
          ? AlertGenerationRunStatus.FAILED
          : AlertGenerationRunStatus.PARTIAL;

    const run = await this.prisma.alertGenerationRun.update({
      where: { id: runId },
      data: { status, finishedAt: new Date() },
      select: {
        id: true,
        status: true,
        tenantsProcessed: true,
        tenantsFailed: true,
        contractAlertsCreated: true,
        missingDocAlertsCreated: true,
      },
    });

    return this.toSummary(run, false);
  }

  private async recordAudit(
    tenantId: string,
    action: string,
    actor: RunActor,
    metadata: Record<string, unknown>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT set_config('app.current_tenant_id', ${tenantId}, true)
      `;
      return this.auditService.log(
        {
          tenantId,
          userId: actor.userId,
          action,
          entityType: 'AlertGenerationRun',
          entityId:
            typeof metadata.runId === 'string' ? metadata.runId : undefined,
          metadata,
        },
        tx,
      );
    });
  }

  private async recoverStaleRuns(tx: Prisma.TransactionClient) {
    const cutoff = new Date(Date.now() - STALE_RUN_HOURS * 60 * 60 * 1000);
    const staleRuns = await tx.alertGenerationRun.findMany({
      where: {
        schedulerKey: ALERTS_SCHEDULER_KEY,
        status: AlertGenerationRunStatus.RUNNING,
        startedAt: { lt: cutoff },
      },
      select: {
        id: true,
        tenantResults: {
          where: { status: AlertGenerationRunTenantStatus.RUNNING },
          select: { id: true },
        },
      },
    });

    for (const run of staleRuns) {
      const staleTenantCount = run.tenantResults.length;
      if (staleTenantCount > 0) {
        await tx.alertGenerationRunTenant.updateMany({
          where: {
            id: { in: run.tenantResults.map((result) => result.id) },
            status: AlertGenerationRunTenantStatus.RUNNING,
          },
          data: {
            status: AlertGenerationRunTenantStatus.FAILED,
            lastErrorCode: 'RUN_STALE',
            finishedAt: new Date(),
          },
        });
      }
      await tx.alertGenerationRun.update({
        where: { id: run.id },
        data: {
          status: AlertGenerationRunStatus.FAILED,
          finishedAt: new Date(),
          tenantsProcessed: { increment: staleTenantCount },
          tenantsFailed: { increment: staleTenantCount },
        },
      });
    }
  }

  private async purgeExpiredRuns(tx: Prisma.TransactionClient) {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
    await tx.alertGenerationRun.deleteMany({
      where: {
        schedulerKey: ALERTS_SCHEDULER_KEY,
        status: {
          in: [
            AlertGenerationRunStatus.SUCCEEDED,
            AlertGenerationRunStatus.PARTIAL,
            AlertGenerationRunStatus.FAILED,
            AlertGenerationRunStatus.SKIPPED,
          ],
        },
        finishedAt: { lt: cutoff },
      },
    });
  }

  private toSummary(
    run: RunClaim['run'],
    skipped: boolean,
  ): DailyAlertGenerationSummary {
    return {
      runId: run.id,
      status: run.status,
      skipped,
      tenantsProcessed: run.tenantsProcessed,
      tenantsFailed: run.tenantsFailed,
      contractAlertsCreated: run.contractAlertsCreated,
      missingDocAlertsCreated: run.missingDocAlertsCreated,
    };
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  private toSafeErrorCode(error: unknown): string {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') return 'DATABASE_CONFLICT';
      if (error.code.startsWith('P')) return `DATABASE_${error.code}`;
    }
    return 'ALERT_GENERATION_FAILED';
  }
}
