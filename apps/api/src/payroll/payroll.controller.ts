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
import { CurrentUser } from '../auth/decorators/current-user.decorator';

interface RequestUser {
  tenantId: string;
}

@UseGuards(JwtAuthGuard, ActiveTenantGuard)
@Controller()
export class PayrollController {
  constructor(private readonly service: PayrollService) {}

  @Get('payroll/dashboard')
  getDashboard(@CurrentUser() user: RequestUser) {
    return this.service.getDashboard(user.tenantId);
  }

  @Get('payroll/periods')
  findAllPeriods(@CurrentUser() user: RequestUser) {
    return this.service.findAllPeriods(user.tenantId);
  }

  @Post('payroll/periods')
  createPeriod(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreatePayrollPeriodDto,
  ) {
    return this.service.createPeriod(user.tenantId, dto);
  }

  @Get('payroll/periods/:id')
  findOnePeriod(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.findOnePeriod(user.tenantId, id);
  }

  @Patch('payroll/periods/:id/close')
  closePeriod(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.closePeriod(user.tenantId, id);
  }

  @Post('payroll/periods/:id/generate')
  generatePayroll(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.generatePayroll(user.tenantId, id);
  }

  @Get('payroll/novelties')
  findNovelties(
    @CurrentUser() user: RequestUser,
    @Query('employeeId') employeeId?: string,
  ) {
    return this.service.findNovelties(user.tenantId, employeeId);
  }

  @Post('payroll/novelties')
  createNovelty(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreatePayrollNoveltyDto,
  ) {
    return this.service.createNovelty(user.tenantId, dto);
  }
}
