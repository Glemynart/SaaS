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
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

interface RequestUser {
  tenantId: string;
}

@UseGuards(JwtAuthGuard, ActiveTenantGuard, RolesGuard)
@Controller()
export class BillingController {
  constructor(private readonly service: BillingService) {}

  @Get('billing/dashboard')
  getDashboard(@CurrentUser() u: RequestUser) {
    return this.service.getDashboard(u.tenantId);
  }

  @Get('billing/customers')
  findAllCustomers(@CurrentUser() u: RequestUser, @Query('search') s?: string) {
    return this.service.findAllCustomers(u.tenantId, s);
  }
  @Post('billing/customers')
  createCustomer(@CurrentUser() u: RequestUser, @Body() d: CreateCustomerDto) {
    return this.service.createCustomer(u.tenantId, d);
  }
  @Get('billing/customers/:id')
  findCustomer(@CurrentUser() u: RequestUser, @Param('id') id: string) {
    return this.service.findOneCustomer(u.tenantId, id);
  }
  @Patch('billing/customers/:id')
  updateCustomer(
    @CurrentUser() u: RequestUser,
    @Param('id') id: string,
    @Body() d: UpdateCustomerDto,
  ) {
    return this.service.updateCustomer(u.tenantId, id, d);
  }
  @Roles(UserRole.ADMIN)
  @Delete('billing/customers/:id')
  removeCustomer(@CurrentUser() u: RequestUser, @Param('id') id: string) {
    return this.service.removeCustomer(u.tenantId, id);
  }

  @Get('billing/products')
  findAllProducts(@CurrentUser() u: RequestUser, @Query('search') s?: string) {
    return this.service.findAllProducts(u.tenantId, s);
  }
  @Post('billing/products')
  createProduct(@CurrentUser() u: RequestUser, @Body() d: CreateProductDto) {
    return this.service.createProduct(u.tenantId, d);
  }
  @Get('billing/products/:id')
  findProduct(@CurrentUser() u: RequestUser, @Param('id') id: string) {
    return this.service.findOneProduct(u.tenantId, id);
  }
  @Patch('billing/products/:id')
  updateProduct(
    @CurrentUser() u: RequestUser,
    @Param('id') id: string,
    @Body() d: UpdateProductDto,
  ) {
    return this.service.updateProduct(u.tenantId, id, d);
  }

  @Get('billing/invoices')
  findAllInvoices(@CurrentUser() u: RequestUser, @Query('status') s?: string) {
    return this.service.findAllInvoices(u.tenantId, s);
  }
  @Post('billing/invoices')
  createInvoice(@CurrentUser() u: RequestUser, @Body() d: CreateInvoiceDto) {
    return this.service.createInvoice(u.tenantId, d);
  }
  @Get('billing/invoices/:id')
  findInvoice(@CurrentUser() u: RequestUser, @Param('id') id: string) {
    return this.service.findOneInvoice(u.tenantId, id);
  }
  @Patch('billing/invoices/:id/status')
  updateStatus(
    @CurrentUser() u: RequestUser,
    @Param('id') id: string,
    @Body() d: UpdateInvoiceStatusDto,
  ) {
    return this.service.updateInvoiceStatus(u.tenantId, id, d);
  }
}
