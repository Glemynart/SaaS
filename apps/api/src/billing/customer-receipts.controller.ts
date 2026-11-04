import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ActiveTenantGuard } from '../auth/guards/active-tenant.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  CreateCustomerReceiptDto,
  ReverseCustomerReceiptDto,
} from './dto/billing.dto';
import { CustomerReceiptsService } from './customer-receipts.service';

@UseGuards(JwtAuthGuard, ActiveTenantGuard, RolesGuard)
@Controller()
export class CustomerReceiptsController {
  constructor(private readonly service: CustomerReceiptsService) {}

  @Get('billing/customers/:id/receivable-invoices')
  findReceivableInvoices(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') customerId: string,
  ) {
    return this.service.findReceivableInvoices(user.tenantId, customerId);
  }

  @Get('billing/invoices/:id/receipts')
  findInvoiceApplications(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') invoiceId: string,
  ) {
    return this.service.findInvoiceApplications(user.tenantId, invoiceId);
  }

  @Roles(UserRole.ADMIN, UserRole.OPERADOR)
  @Post('billing/receipts')
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateCustomerReceiptDto,
  ) {
    return this.service.create(user.tenantId, user.userId, dto);
  }

  @Roles(UserRole.ADMIN)
  @Post('billing/receipts/:id/reversal')
  reverse(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') receiptId: string,
    @Body() dto: ReverseCustomerReceiptDto,
  ) {
    return this.service.reverse(user.tenantId, user.userId, receiptId, dto);
  }
}
