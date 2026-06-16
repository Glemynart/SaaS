import { Controller, Get, Param, Delete, UseGuards } from '@nestjs/common';
import { EmployeeFilesService } from './employee-files.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActiveTenantGuard } from '../auth/guards/active-tenant.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

interface RequestUser {
  tenantId: string;
}

@UseGuards(JwtAuthGuard, ActiveTenantGuard)
@Controller()
export class EmployeeFilesController {
  constructor(private readonly service: EmployeeFilesService) {}

  @Get('employees/:id/files')
  findByEmployee(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.findByEmployee(user.tenantId, id);
  }

  @Get('employee-files/:id')
  findOne(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.findOne(user.tenantId, id);
  }

  @Delete('employee-files/:id')
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.remove(user.tenantId, id);
  }
}
