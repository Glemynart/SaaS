import { Controller, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ActiveTenantGuard } from '../auth/guards/active-tenant.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { PilaExportReconciliationService } from './pila-export-reconciliation.service';

@UseGuards(JwtAuthGuard, ActiveTenantGuard, RolesGuard)
@Controller('payroll/pila-exports/reconciliation')
export class PilaExportReconciliationController {
  constructor(private readonly service: PilaExportReconciliationService) {}

  @Roles(UserRole.ADMIN)
  @Post()
  reconcile(@CurrentUser() user: CurrentUserPayload) {
    return this.service.reconcile(user.tenantId, user.userId);
  }
}
