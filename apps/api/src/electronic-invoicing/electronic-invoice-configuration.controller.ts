import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ActiveTenantGuard } from '../auth/guards/active-tenant.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateNumberingRangeDto } from './dto/create-numbering-range.dto';
import { DeactivateNumberingRangeDto } from './dto/deactivate-numbering-range.dto';
import { UpsertIssuerProfileDto } from './dto/upsert-issuer-profile.dto';
import { ElectronicInvoiceConfigurationService } from './electronic-invoice-configuration.service';

@UseGuards(JwtAuthGuard, ActiveTenantGuard, RolesGuard)
@Controller('electronic-invoicing')
export class ElectronicInvoiceConfigurationController {
  constructor(
    private readonly configuration: ElectronicInvoiceConfigurationService,
  ) {}

  @Roles(UserRole.ADMIN)
  @Get('configuration')
  getConfiguration() {
    return this.configuration.getConfiguration();
  }

  @Roles(UserRole.ADMIN)
  @Put('profiles')
  upsertIssuerProfile(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpsertIssuerProfileDto,
  ) {
    return this.configuration.upsertIssuerProfile(user.userId, dto);
  }

  @Roles(UserRole.ADMIN)
  @Post('ranges')
  createNumberingRange(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateNumberingRangeDto,
  ) {
    return this.configuration.createNumberingRange(user.userId, dto);
  }

  @Roles(UserRole.ADMIN)
  @Patch('ranges/:id/deactivate')
  deactivateNumberingRange(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: DeactivateNumberingRangeDto,
  ) {
    return this.configuration.deactivateNumberingRange(user.userId, id, dto);
  }
}
