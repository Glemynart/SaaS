import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
} from '@nestjs/common';
import { CuentaSistemaMapService } from './cuenta-sistema-map.service';
import { CreateCuentaSistemaMapDto } from './dto/create-cuenta-sistema-map.dto';
import { UpdateCuentaSistemaMapDto } from './dto/update-cuenta-sistema-map.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ActiveTenantGuard } from '../../auth/guards/active-tenant.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@UseGuards(JwtAuthGuard, ActiveTenantGuard, RolesGuard)
@Controller('accounting/cuenta-sistema-map')
export class CuentaSistemaMapController {
  constructor(private readonly service: CuentaSistemaMapService) {}

  @Roles(UserRole.ADMIN)
  @Post()
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateCuentaSistemaMapDto,
  ) {
    return this.service.create(user.tenantId, user.userId, dto);
  }

  @Get()
  findAll(@CurrentUser() user: CurrentUserPayload) {
    return this.service.findAll(user.tenantId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.service.findOne(user.tenantId, id);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateCuentaSistemaMapDto,
  ) {
    return this.service.update(user.tenantId, user.userId, id, dto);
  }
}
