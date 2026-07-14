import {
  Controller,
  ExecutionContext,
  ForbiddenException,
  Get,
  SetMetadata,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../decorators/roles.decorator';
import {
  Authenticated,
  AUTHORIZATION_POLICY_KEY,
  AuthorizationDecisionPending,
  Unauthenticated,
} from './authorization-policy';
import { DenyByDefaultGuard } from './deny-by-default.guard';

describe('DenyByDefaultGuard', () => {
  const guard = new DenyByDefaultGuard();

  it('allows every approved explicit policy category', () => {
    @Controller('public')
    class PublicController {
      @Unauthenticated()
      @Get()
      findAll() {}
    }

    @Controller('authenticated')
    class AuthenticatedController {
      @Authenticated()
      @Get()
      findAll() {}
    }

    @Controller('restricted')
    class RestrictedController {
      @Roles(UserRole.ADMIN)
      @Get()
      findAll() {}
    }

    @Controller('payroll')
    class PayrollController {
      @Get()
      findAll() {}
    }

    expect(guard.canActivate(contextFor(PublicController))).toBe(true);
    expect(guard.canActivate(contextFor(AuthenticatedController))).toBe(true);
    expect(guard.canActivate(contextFor(RestrictedController))).toBe(true);
    expect(guard.canActivate(contextFor(PayrollController))).toBe(true);
  });

  it('denies operations without a valid authorization policy', () => {
    @Controller('unclassified')
    class UnclassifiedController {
      @Get()
      findAll() {}
    }

    @Controller('invalid')
    class InvalidPolicyController {
      @SetMetadata(AUTHORIZATION_POLICY_KEY, 'INVALID')
      @Get()
      findAll() {}
    }

    expect(() => guard.canActivate(contextFor(UnclassifiedController))).toThrow(
      ForbiddenException,
    );
    expect(() =>
      guard.canActivate(contextFor(InvalidPolicyController)),
    ).toThrow(ForbiddenException);
  });

  it('denies an operation pending an authorization decision', () => {
    @Controller('pending')
    class PendingController {
      @AuthorizationDecisionPending('Requiere una decisión de autorización.')
      @Get()
      findAll() {}
    }

    expect(() => guard.canActivate(contextFor(PendingController))).toThrow(
      ForbiddenException,
    );
  });
});

function contextFor(controller: new () => object): ExecutionContext {
  return {
    getClass: () => controller,
    getHandler: () => controller.prototype.findAll,
  } as ExecutionContext;
}
