import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ActiveTenantGuard } from '../../auth/guards/active-tenant.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import {
  CreateServicePremiumBatchDto,
  CreateServicePremiumCorrectionDto,
} from './service-premium.dto';
import { ServicePremiumService } from './service-premium.service';

@UseGuards(JwtAuthGuard, ActiveTenantGuard, RolesGuard)
@Controller('payroll/service-premiums')
export class ServicePremiumController {
  constructor(private readonly service: ServicePremiumService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.OPERADOR)
  list(@CurrentUser() user: CurrentUserPayload) {
    return this.service.list(user.tenantId);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.OPERADOR)
  getOne(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.getOne(user.tenantId, id);
  }

  @Roles(UserRole.ADMIN, UserRole.OPERADOR)
  @Post()
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateServicePremiumBatchDto,
  ) {
    return this.service.createPreview(user.tenantId, user.userId, dto);
  }

  @Roles(UserRole.ADMIN)
  @Post(':id/approve')
  approve(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.approve(user.tenantId, user.userId, id);
  }

  @Roles(UserRole.ADMIN, UserRole.OPERADOR)
  @Post(':id/retry')
  retry(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.retryErrors(user.tenantId, user.userId, id);
  }

  @Roles(UserRole.ADMIN, UserRole.OPERADOR)
  @Post(':id/corrections')
  createCorrection(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateServicePremiumCorrectionDto,
  ) {
    return this.service.createCorrectionVersion(
      user.tenantId,
      user.userId,
      id,
      dto.reason,
    );
  }

  @Get('year/:year')
  @Roles(UserRole.ADMIN, UserRole.OPERADOR)
  listByYear(
    @CurrentUser() user: CurrentUserPayload,
    @Param('year', ParseIntPipe) year: number,
  ) {
    return this.service.list(user.tenantId, year);
  }
}
