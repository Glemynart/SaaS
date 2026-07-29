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
import { ActiveTenantGuard } from '../auth/guards/active-tenant.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AssignContractualProfileDto } from './dto/assign-contractual-profile.dto';
import { ContractualProfileQueryDto } from './dto/contractual-profile-query.dto';
import { CreateContractualProfileDto } from './dto/create-contractual-profile.dto';
import { UpdateContractualProfileStatusDto } from './dto/update-contractual-profile-status.dto';
import { UpdateContractualProfileDto } from './dto/update-contractual-profile.dto';
import { ContractualProfilesService } from './contractual-profiles.service';

@UseGuards(JwtAuthGuard, ActiveTenantGuard, RolesGuard)
@Controller('contractual-profiles')
export class ContractualProfilesController {
  constructor(private readonly service: ContractualProfilesService) {}

  @Roles(UserRole.ADMIN)
  @Post()
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateContractualProfileDto,
  ) {
    return this.service.create(user.userId, dto);
  }

  @Get()
  findAll(@Query() query: ContractualProfileQueryDto) {
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
    @Body() dto: UpdateContractualProfileDto,
  ) {
    return this.service.update(user.userId, id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/status')
  updateStatus(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateContractualProfileStatusDto,
  ) {
    return this.service.updateStatus(user.userId, id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Patch('contracts/:contractId/assignment')
  assignToContract(
    @CurrentUser() user: CurrentUserPayload,
    @Param('contractId') contractId: string,
    @Body() dto: AssignContractualProfileDto,
  ) {
    return this.service.assignToContract(user.userId, contractId, dto);
  }
}
