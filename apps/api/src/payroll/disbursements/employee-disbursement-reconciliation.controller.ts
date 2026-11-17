import { Controller, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ActiveTenantGuard } from '../../auth/guards/active-tenant.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { EmployeeDisbursementReconciliationService } from './employee-disbursement-reconciliation.service';

@UseGuards(JwtAuthGuard, ActiveTenantGuard, RolesGuard)
@Controller('payroll/disbursements/reconciliation')
export class EmployeeDisbursementReconciliationController {
  constructor(
    private readonly service: EmployeeDisbursementReconciliationService,
  ) {}

  @Roles(UserRole.ADMIN)
  @Post('supports')
  reconcileSupports(@CurrentUser() user: CurrentUserPayload) {
    return this.service.reconcile(user.tenantId, user.userId);
  }
}
