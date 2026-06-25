import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PeriodosContablesService } from './periodos-contables.service';
import { CreatePeriodoContableDto } from './dto/create-periodo-contable.dto';
import { GenerarAnioDto } from './dto/generar-anio.dto';
import { PeriodoContableQueryDto } from './dto/periodo-contable-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ActiveTenantGuard } from '../../auth/guards/active-tenant.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

// C0: alta y consulta del catálogo de períodos. El cierre/reapertura (control de
// contabilización, ADR §6) corresponde al puerto contable de C1, no a C0.
@UseGuards(JwtAuthGuard, ActiveTenantGuard, RolesGuard)
@Controller('accounting/periodos-contables')
export class PeriodosContablesController {
  constructor(private readonly service: PeriodosContablesService) {}

  @Roles(UserRole.ADMIN)
  @Post()
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreatePeriodoContableDto,
  ) {
    return this.service.create(user.tenantId, user.userId, dto);
  }

  @Roles(UserRole.ADMIN)
  @Post('generar-anio')
  generarAnio(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: GenerarAnioDto,
  ) {
    return this.service.generarAnio(user.tenantId, user.userId, dto);
  }

  @Get()
  findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: PeriodoContableQueryDto,
  ) {
    return this.service.findAll(user.tenantId, query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.service.findOne(user.tenantId, id);
  }
}
