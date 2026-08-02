import {
  Controller,
  Get,
  Post,
  Param,
  Patch,
  UseGuards,
  Query,
} from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { AlertsSchedulerService } from './alerts-scheduler.service';
import { AlertQueryDto } from './dto/alert-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActiveTenantGuard } from '../auth/guards/active-tenant.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@UseGuards(JwtAuthGuard, ActiveTenantGuard, RolesGuard)
@Controller('alerts')
export class AlertsController {
  constructor(
    private readonly service: AlertsService,
    private readonly scheduler: AlertsSchedulerService,
  ) {}

  @Get()
  findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: AlertQueryDto,
  ) {
    return this.service.findAll(user.tenantId, query);
  }

  @Get('generation-runs/latest')
  getLatestGenerationRun(@CurrentUser() user: CurrentUserPayload) {
    return this.scheduler.getLatestForTenant(user.tenantId);
  }

  @Roles(UserRole.ADMIN)
  @Post('generation-runs/:runId/retry')
  retryGenerationRun(
    @CurrentUser() user: CurrentUserPayload,
    @Param('runId') runId: string,
  ) {
    return this.scheduler.retryFailedTenant(user.tenantId, runId, user.userId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.service.findOne(user.tenantId, id);
  }

  @Roles(UserRole.ADMIN, UserRole.OPERADOR)
  @Patch(':id/resolve')
  resolve(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.service.resolve(user.tenantId, id, user.userId);
  }

  @Roles(UserRole.ADMIN)
  @Post('generate-contract-alerts')
  generateContractAlerts(@CurrentUser() user: CurrentUserPayload) {
    return this.service.generateContractAlerts(user.tenantId);
  }

  @Roles(UserRole.ADMIN)
  @Post('generate-missing-doc-alerts')
  generateMissingDocAlerts(@CurrentUser() user: CurrentUserPayload) {
    return this.service.generateMissingDocAlerts(user.tenantId);
  }
}
