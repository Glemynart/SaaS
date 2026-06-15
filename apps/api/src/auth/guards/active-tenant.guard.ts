import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { TenantsService } from '../../tenants/tenants.service';
import { CurrentUserPayload } from '../decorators/current-user.decorator';

@Injectable()
export class ActiveTenantGuard implements CanActivate {
  constructor(private tenantsService: TenantsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<{ user?: CurrentUserPayload }>();
    const user = request.user;
    if (!user || !user.tenantId) {
      return false;
    }

    // will throw BadRequestException or NotFoundException if tenant is inactive/not found
    await this.tenantsService.ensureActive(user.tenantId);
    return true;
  }
}
