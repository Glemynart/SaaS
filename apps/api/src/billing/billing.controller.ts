import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BillingService } from './billing.service';
import {
  CreateCustomerDto,
  UpdateCustomerDto,
  CreateProductDto,
  UpdateProductDto,
  CreateInvoiceDto,
  UpdateInvoiceStatusDto,
} from './dto/billing.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActiveTenantGuard } from '../auth/guards/active-tenant.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@UseGuards(JwtAuthGuard, ActiveTenantGuard, RolesGuard)
@Controller()
export class BillingController {
  constructor(private readonly service: BillingService) {}

  @Get('billing/dashboard')
  getDashboard(@CurrentUser() u: CurrentUserPayload) {
    return this.service.getDashboard(u.tenantId);
  }

  @Get('billing/customers')
  findAllCustomers(
    @CurrentUser() u: CurrentUserPayload,
    @Query('search') s?: string,
  ) {
    return this.service.findAllCustomers(u.tenantId, s);
  }

  @Roles(UserRole.ADMIN, UserRole.OPERADOR)
  @Post('billing/customers')
  createCustomer(
    @CurrentUser() u: CurrentUserPayload,
    @Body() d: CreateCustomerDto,
  ) {
    return this.service.createCustomer(u.tenantId, d);
  }

  @Get('billing/customers/:id')
  findCustomer(@CurrentUser() u: CurrentUserPayload, @Param('id') id: string) {
    return this.service.findOneCustomer(u.tenantId, id);
  }

  @Roles(UserRole.ADMIN, UserRole.OPERADOR)
  @Patch('billing/customers/:id')
  updateCustomer(
    @CurrentUser() u: CurrentUserPayload,
    @Param('id') id: string,
    @Body() d: UpdateCustomerDto,
  ) {
    return this.service.updateCustomer(u.tenantId, id, d);
  }

  @Roles(UserRole.ADMIN)
  @Delete('billing/customers/:id')
  removeCustomer(
    @CurrentUser() u: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.service.removeCustomer(u.tenantId, id);
  }

  @Get('billing/products')
  findAllProducts(
    @CurrentUser() u: CurrentUserPayload,
    @Query('search') s?: string,
  ) {
    return this.service.findAllProducts(u.tenantId, s);
  }

  @Roles(UserRole.ADMIN)
  @Post('billing/products')
  createProduct(
    @CurrentUser() u: CurrentUserPayload,
    @Body() d: CreateProductDto,
  ) {
    return this.service.createProduct(u.tenantId, d);
  }

  @Get('billing/products/:id')
  findProduct(@CurrentUser() u: CurrentUserPayload, @Param('id') id: string) {
    return this.service.findOneProduct(u.tenantId, id);
  }

  @Roles(UserRole.ADMIN)
  @Patch('billing/products/:id')
  updateProduct(
    @CurrentUser() u: CurrentUserPayload,
    @Param('id') id: string,
    @Body() d: UpdateProductDto,
  ) {
    return this.service.updateProduct(u.tenantId, id, d);
  }

  @Get('billing/invoices')
  findAllInvoices(
    @CurrentUser() u: CurrentUserPayload,
    @Query('status') s?: string,
  ) {
    return this.service.findAllInvoices(u.tenantId, s);
  }

  @Roles(UserRole.ADMIN, UserRole.OPERADOR)
  @Post('billing/invoices')
  createInvoice(
    @CurrentUser() u: CurrentUserPayload,
    @Body() d: CreateInvoiceDto,
  ) {
    return this.service.createInvoice(u.tenantId, d);
  }

  @Get('billing/invoices/:id')
  findInvoice(@CurrentUser() u: CurrentUserPayload, @Param('id') id: string) {
    return this.service.findOneInvoice(u.tenantId, id);
  }

  @Roles(UserRole.ADMIN)
  @Patch('billing/invoices/:id/status')
  updateStatus(
    @CurrentUser() u: CurrentUserPayload,
    @Param('id') id: string,
    @Body() d: UpdateInvoiceStatusDto,
  ) {
    return this.service.updateInvoiceStatus(u.tenantId, id, d);
  }
}
