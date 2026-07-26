import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
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
import { ReopenPeriodDto } from './dto/reopen-period.dto';
import { PeriodClosureService } from './period-closure.service';

@UseGuards(JwtAuthGuard, ActiveTenantGuard, RolesGuard)
@Controller('accounting/cierres')
export class PeriodClosureController {
  constructor(private readonly periodClosures: PeriodClosureService) {}

  @Roles(UserRole.ADMIN)
  @Get('periodos/:id/validar')
  validar(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') periodoId: string,
  ) {
    return this.periodClosures.validar(user.tenantId, periodoId);
  }

  @Roles(UserRole.ADMIN)
  @Post('periodos/:id/cerrar')
  cerrar(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') periodoId: string,
  ) {
    return this.periodClosures.cerrar(user.tenantId, user.userId, periodoId);
  }

  @Roles(UserRole.ADMIN)
  @Post('periodos/:id/reabrir')
  reabrir(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') periodoId: string,
    @Body() dto: ReopenPeriodDto,
  ) {
    return this.periodClosures.reabrir(
      user.tenantId,
      user.userId,
      periodoId,
      dto.motivo,
    );
  }

  @Roles(UserRole.ADMIN)
  @Post('anios/:anio/cerrar')
  cerrarAnio(
    @CurrentUser() user: CurrentUserPayload,
    @Param('anio', ParseIntPipe) anio: number,
  ) {
    return this.periodClosures.cerrarAnio(user.tenantId, user.userId, anio);
  }
}
