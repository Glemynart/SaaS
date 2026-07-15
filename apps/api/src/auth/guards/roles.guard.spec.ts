import { ExecutionContext, ForbiddenException, Type } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { CurrentUserPayload } from '../decorators/current-user.decorator';
import { Roles } from '../decorators/roles.decorator';
import { RolesGuard } from './roles.guard';

describe('RolesGuard authorization contracts', () => {
  const guard = new RolesGuard(new Reflector());

  class RestrictedController {
    @Roles(UserRole.ADMIN, UserRole.OPERADOR)
    restrictedOperation(this: void) {}
  }

  it.each([UserRole.ADMIN, UserRole.OPERADOR])(
    'allows the declared role %s',
    (role) => {
      expect(
        guard.canActivate(
          contextFor(
            RestrictedController,
            RestrictedController.prototype.restrictedOperation,
            userWith(role),
          ),
        ),
      ).toBe(true);
    },
  );

  it('rejects a role that is not declared for the operation', () => {
    expect(() =>
      guard.canActivate(
        contextFor(
          RestrictedController,
          RestrictedController.prototype.restrictedOperation,
          userWith(UserRole.VIEWER),
        ),
      ),
    ).toThrow(ForbiddenException);
  });

  it('rejects the operation when no authenticated role context exists', () => {
    expect(() =>
      guard.canActivate(
        contextFor(
          RestrictedController,
          RestrictedController.prototype.restrictedOperation,
        ),
      ),
    ).toThrow(ForbiddenException);
  });
});

function userWith(role: UserRole): CurrentUserPayload {
  return {
    userId: 'user-1',
    tenantId: 'tenant-1',
    rol: role,
    email: 'user@example.com',
  };
}

function contextFor(
  controller: Type<unknown>,
  handler: object,
  user?: CurrentUserPayload,
): ExecutionContext {
  return {
    getClass: () => controller,
    getHandler: () => handler,
    switchToHttp: () => ({
      getRequest: () => ({ user }),
      getResponse: () => undefined,
      getNext: () => undefined,
    }),
  } as ExecutionContext;
}
