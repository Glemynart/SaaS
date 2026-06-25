import {
  Controller,
  Post,
  Param,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { AccountingProvisioningService } from './accounting-provisioning.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ActiveTenantGuard } from '../../auth/guards/active-tenant.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@UseGuards(JwtAuthGuard, ActiveTenantGuard, RolesGuard)
@Controller('accounting/provisioning')
export class AccountingProvisioningController {
  constructor(private readonly service: AccountingProvisioningService) {}

  // Provisión bajo demanda del PROPIO tenant. El :tenantId debe coincidir con el
  // del solicitante: sin rol de plataforma, no se permite provisionar a otros.
  // (No se expone DELETE: la des-provisión es proceso de script/onboarding.)
  @Roles(UserRole.ADMIN)
  @Post(':tenantId')
  provisionar(
    @CurrentUser() user: CurrentUserPayload,
    @Param('tenantId') tenantId: string,
  ) {
    if (tenantId !== user.tenantId) {
      throw new ForbiddenException(
        'Solo puedes provisionar la contabilidad de tu propio tenant',
      );
    }
    return this.service.clonarPlanDeCuentas(tenantId, user.userId);
  }
}
