import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { LotesService } from './lotes.service';
import { CreateLoteDto } from './dto/create-lote.dto';
import { LoteQueryDto } from './dto/lote-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActiveTenantGuard } from '../auth/guards/active-tenant.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@UseGuards(JwtAuthGuard, ActiveTenantGuard, RolesGuard)
@Controller('contracts/lotes')
export class LotesController {
  constructor(private readonly service: LotesService) {}

  @Roles(UserRole.ADMIN, UserRole.OPERADOR)
  @Post()
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateLoteDto) {
    return this.service.create(user.tenantId, user.userId, dto);
  }

  @Get()
  findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: LoteQueryDto,
  ) {
    return this.service.findAll(user.tenantId, query);
  }

  @Get(':id/progress')
  getProgress(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.service.getProgress(user.tenantId, id);
  }

  @Get(':id')
  findOne(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.service.findOne(user.tenantId, id);
  }

  @Roles(UserRole.ADMIN, UserRole.OPERADOR)
  @Post(':id/process')
  process(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.service.process(user.tenantId, user.userId, id);
  }

  @Roles(UserRole.ADMIN, UserRole.OPERADOR)
  @Post(':id/retry')
  retry(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.service.retry(user.tenantId, user.userId, id);
  }
}
