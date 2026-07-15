import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { resolveAuthorizationPolicy } from './authorization-policy.resolver';

@Injectable()
export class DenyByDefaultGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const resolution = resolveAuthorizationPolicy(
      context.getClass(),
      context.getHandler(),
    );

    if (!resolution.policy || resolution.pendingReason) {
      throw new ForbiddenException(
        'Acceso denegado: la operación no declara una política de autorización válida.',
      );
    }

    return true;
  }
}
