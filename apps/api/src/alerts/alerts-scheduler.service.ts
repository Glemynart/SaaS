import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import { AlertsService } from './alerts.service';

const ALERTS_SCHEDULER_LOCK = 731024;
const SCHEDULER_CONTEXT = {
  userId: 'system:alerts-scheduler',
  rol: 'SYSTEM',
  email: 'alerts-scheduler@internal.invalid',
} as const;

export interface DailyAlertGenerationSummary {
  skipped: boolean;
  tenantsProcessed: number;
  contractAlertsCreated: number;
  missingDocAlertsCreated: number;
}

@Injectable()
export class AlertsSchedulerService {
  private readonly logger = new Logger(AlertsSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly alertsService: AlertsService,
    private readonly tenantContext: TenantContextService,
  ) {}

  /**
   * The scheduler runs inside the API process so local and single-instance
   * deployments do not need Redis or an external worker. The transaction
   * advisory lock keeps multiple API instances from generating the same run
   * concurrently.
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM, {
    name: 'alerts-daily-generation',
  })
  async runDailyGeneration(): Promise<DailyAlertGenerationSummary> {
    return this.prisma.$transaction(async (tx) => {
      const lock = await tx.$queryRaw<Array<{ locked: boolean }>>(
        Prisma.sql`SELECT pg_try_advisory_xact_lock(${ALERTS_SCHEDULER_LOCK}) AS locked`,
      );

      if (!lock[0]?.locked) {
        this.logger.log(
          'Daily alert generation skipped: another run is active.',
        );
        return {
          skipped: true,
          tenantsProcessed: 0,
          contractAlertsCreated: 0,
          missingDocAlertsCreated: 0,
        };
      }

      const tenants = await tx.tenant.findMany({
        where: { activo: true },
        select: { id: true },
      });

      const summary = {
        skipped: false,
        tenantsProcessed: 0,
        contractAlertsCreated: 0,
        missingDocAlertsCreated: 0,
      };

      for (const tenant of tenants) {
        await tx.$executeRaw`
          SELECT set_config('app.current_tenant_id', ${tenant.id}, true)
        `;

        const result = await this.tenantContext.run(
          { ...SCHEDULER_CONTEXT, tenantId: tenant.id },
          () => this.alertsService.generateForTenant(tenant.id, tx),
        );

        summary.tenantsProcessed += 1;
        summary.contractAlertsCreated += result.contractAlerts.created;
        summary.missingDocAlertsCreated += result.missingDocAlerts.created;
      }

      this.logger.log(
        `Daily alert generation completed for ${summary.tenantsProcessed} active tenants.`,
      );
      return summary;
    });
  }
}
