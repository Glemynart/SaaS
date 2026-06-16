import {
  Controller,
  Get,
  Post,
  Param,
  Patch,
  UseGuards,
  Query,
} from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { AlertQueryDto } from './dto/alert-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActiveTenantGuard } from '../auth/guards/active-tenant.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

interface RequestUser {
  tenantId: string;
}

@UseGuards(JwtAuthGuard, ActiveTenantGuard)
@Controller('alerts')
export class AlertsController {
  constructor(private readonly service: AlertsService) {}

  @Get()
  findAll(@CurrentUser() user: RequestUser, @Query() query: AlertQueryDto) {
    return this.service.findAll(user.tenantId, query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.findOne(user.tenantId, id);
  }

  @Patch(':id/resolve')
  resolve(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.resolve(user.tenantId, id);
  }

  @Post('generate-contract-alerts')
  generateContractAlerts(@CurrentUser() user: RequestUser) {
    return this.service.generateContractAlerts(user.tenantId);
  }

  @Post('generate-missing-doc-alerts')
  generateMissingDocAlerts(@CurrentUser() user: RequestUser) {
    return this.service.generateMissingDocAlerts(user.tenantId);
  }
}
