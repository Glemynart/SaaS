import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PayrollService } from './payroll.service';
import {
  CreatePayrollPeriodDto,
  CreatePayrollNoveltyDto,
} from './dto/create-payroll.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActiveTenantGuard } from '../auth/guards/active-tenant.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@UseGuards(JwtAuthGuard, ActiveTenantGuard, RolesGuard)
@Controller()
export class PayrollController {
  constructor(private readonly service: PayrollService) {}

  @Get('payroll/dashboard')
  getDashboard(@CurrentUser() user: CurrentUserPayload) {
    return this.service.getDashboard(user.tenantId);
  }

  @Get('payroll/periods')
  findAllPeriods(@CurrentUser() user: CurrentUserPayload) {
    return this.service.findAllPeriods(user.tenantId);
  }

  @Roles(UserRole.ADMIN, UserRole.OPERADOR)
  @Post('payroll/periods')
  createPeriod(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreatePayrollPeriodDto,
  ) {
    return this.service.createPeriod(user.tenantId, user.userId, dto);
  }

  @Get('payroll/periods/:id')
  findOnePeriod(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.service.findOnePeriod(user.tenantId, id);
  }

  @Roles(UserRole.ADMIN)
  @Patch('payroll/periods/:id/close')
  closePeriod(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.service.closePeriod(user.tenantId, user.userId, id);
  }

  @Roles(UserRole.ADMIN, UserRole.OPERADOR)
  @Post('payroll/periods/:id/generate')
  generatePayroll(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.service.generatePayroll(user.tenantId, user.userId, id);
  }

  @Roles(UserRole.ADMIN)
  @Post('payroll/periods/:id/recalculate')
  recalculatePayroll(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.service.recalculatePayroll(user.tenantId, user.userId, id);
  }

  @Get('payroll/novelties')
  findNovelties(
    @CurrentUser() user: CurrentUserPayload,
    @Query('employeeId') employeeId?: string,
  ) {
    return this.service.findNovelties(user.tenantId, employeeId);
  }

  @Roles(UserRole.ADMIN, UserRole.OPERADOR)
  @Post('payroll/novelties')
  createNovelty(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreatePayrollNoveltyDto,
  ) {
    return this.service.createNovelty(user.tenantId, user.userId, dto);
  }
}
