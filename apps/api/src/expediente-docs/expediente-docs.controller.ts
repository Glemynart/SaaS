import { Controller, Get, Delete, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActiveTenantGuard } from '../auth/guards/active-tenant.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ExpedienteDocsService } from './expediente-docs.service';

interface RequestUser {
  tenantId: string;
}

@UseGuards(JwtAuthGuard, ActiveTenantGuard)
@Controller()
export class ExpedienteDocsController {
  constructor(private readonly service: ExpedienteDocsService) {}

  @Get('employees/:id/expediente')
  findByEmployee(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.findByEmployee(user.tenantId, id);
  }

  @Get('expediente-docs/:id')
  findOne(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.findOne(user.tenantId, id);
  }

  @Delete('expediente-docs/:id')
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.remove(user.tenantId, id);
  }
}
