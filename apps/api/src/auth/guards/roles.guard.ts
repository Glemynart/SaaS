import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { CurrentUserPayload } from '../decorators/current-user.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles) {
      return true;
    }
    const request = context
      .switchToHttp()
      .getRequest<{ user?: CurrentUserPayload }>();
    const user = request.user;
    if (!user || !user.rol) {
      throw new ForbiddenException(
        'Acceso denegado: rol de usuario no definido.',
      );
    }

    const hasRole = requiredRoles.includes(user.rol as UserRole);
    if (!hasRole) {
      throw new ForbiddenException(
        'Acceso denegado: no tienes permisos suficientes para esta ruta.',
      );
    }
    return true;
  }
}
