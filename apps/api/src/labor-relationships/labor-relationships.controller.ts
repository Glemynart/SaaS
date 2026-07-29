import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ActiveTenantGuard } from '../auth/guards/active-tenant.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateLaborRelationshipDto } from './dto/create-labor-relationship.dto';
import { LaborRelationshipQueryDto } from './dto/labor-relationship-query.dto';
import { UpdateLaborRelationshipDto } from './dto/update-labor-relationship.dto';
import { LaborRelationshipsService } from './labor-relationships.service';

@UseGuards(JwtAuthGuard, ActiveTenantGuard, RolesGuard)
@Controller('labor-relationships')
export class LaborRelationshipsController {
  constructor(private readonly service: LaborRelationshipsService) {}

  @Roles(UserRole.ADMIN)
  @Post()
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateLaborRelationshipDto,
  ) {
    return this.service.create(user.userId, dto);
  }

  @Get()
  findAll(@Query() query: LaborRelationshipQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateLaborRelationshipDto,
  ) {
    return this.service.update(user.userId, id, dto);
  }
}
