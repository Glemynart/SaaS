import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { LiquidationService } from './liquidation.service';
import { ListLiquidationsDto } from '../dto/list-liquidations.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ActiveTenantGuard } from '../../auth/guards/active-tenant.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@UseGuards(JwtAuthGuard, ActiveTenantGuard, RolesGuard)
@Controller('liquidations')
export class LiquidationController {
  constructor(private readonly service: LiquidationService) {}

  @Get()
  findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: ListLiquidationsDto,
  ) {
    return this.service.findAll(user.tenantId, query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.service.findOne(user.tenantId, id);
  }

  @Roles(UserRole.ADMIN, UserRole.OPERADOR)
  @Post(':empleadoId')
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Param('empleadoId') empleadoId: string,
  ) {
    return this.service.createLiquidacion(
      user.tenantId,
      user.userId,
      empleadoId,
    );
  }

  @Roles(UserRole.ADMIN, UserRole.OPERADOR)
  @Post(':id/approve')
  approve(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.service.approveLiquidation(user.tenantId, user.userId, id);
  }

  @Roles(UserRole.ADMIN)
  @Post(':id/pay')
  pay(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.service.markLiquidationPaid(user.tenantId, user.userId, id);
  }

  @Roles(UserRole.ADMIN)
  @Post(':id/void')
  void(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.service.voidLiquidation(user.tenantId, user.userId, id);
  }
}
