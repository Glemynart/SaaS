import {
  Controller,
  ExecutionContext,
  Get,
  SetMetadata,
  Type,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../decorators/roles.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import {
  Authenticated,
  AUTHORIZATION_POLICY_KEY,
  AuthorizationClassificationSource,
  AuthorizationDecisionPending,
  AuthorizationPolicyKind,
  Unauthenticated,
} from './authorization-policy';
import { resolveAuthorizationPolicy } from './authorization-policy.resolver';
import { AuthorizationSurfaceClassifier } from './authorization-surface.classifier';
import { DenyByDefaultGuard } from './deny-by-default.guard';

describe('Authorization policy resolution contracts', () => {
  it('resolves handler metadata before controller metadata', () => {
    @Authenticated()
    @Controller('overridden')
    class OverriddenController {
      @Unauthenticated()
      @Get()
      findAll() {}
    }

    expect(resolutionFor(OverriddenController)).toMatchObject({
      policy: AuthorizationPolicyKind.UNAUTHENTICATED,
      source: AuthorizationClassificationSource.EXPLICIT,
      roles: [],
      rolesDeclared: false,
    });
  });

  it('resolves declared roles as the existing RBAC policy', () => {
    @Controller('restricted')
    class RestrictedController {
      @Roles(UserRole.ADMIN, UserRole.OPERADOR)
      @Get()
      findAll() {}
    }

    expect(resolutionFor(RestrictedController)).toEqual({
      policy: AuthorizationPolicyKind.RBAC,
      source: AuthorizationClassificationSource.EXISTING_RBAC,
      roles: [UserRole.ADMIN, UserRole.OPERADOR],
      rolesDeclared: true,
    });
  });

  it('never resolves missing, invalid, or pending metadata as a valid policy', () => {
    @Controller('missing')
    class MissingPolicyController {
      @Get()
      findAll() {}
    }

    @Controller('invalid')
    class InvalidPolicyController {
      @SetMetadata(AUTHORIZATION_POLICY_KEY, 'INVALID')
      @Get()
      findAll() {}
    }

    @Controller('pending')
    class PendingPolicyController {
      @AuthorizationDecisionPending('Requiere decisión de autorización.')
      @Get()
      findAll() {}
    }

    const missing = resolutionFor(MissingPolicyController);
    const invalid = resolutionFor(InvalidPolicyController);
    const pending = resolutionFor(PendingPolicyController);

    expect(missing.policy).toBeUndefined();
    expect(invalid.policy).toBeUndefined();
    expect(invalid).toMatchObject({
      invalidPolicy: 'INVALID',
      source: AuthorizationClassificationSource.EXPLICIT,
    });
    expect(pending.policy).toBeUndefined();
    expect(pending).toMatchObject({
      pendingReason: 'Requiere decisión de autorización.',
    });
  });

  it('keeps resolver, classifier, and runtime enforcement on the same policy', () => {
    @Controller('public')
    class PublicController {
      @Unauthenticated()
      @Get()
      findAll() {}
    }

    @UseGuards(JwtAuthGuard)
    @Controller('authenticated')
    class AuthenticatedController {
      @Authenticated()
      @Get()
      findAll() {}
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Controller('restricted')
    class RestrictedController {
      @Roles(UserRole.ADMIN)
      @Get()
      findAll() {}
    }

    const classifier = new AuthorizationSurfaceClassifier();
    const runtimeGuard = new DenyByDefaultGuard();
    const expectations: Array<[Type<unknown>, AuthorizationPolicyKind]> = [
      [PublicController, AuthorizationPolicyKind.UNAUTHENTICATED],
      [AuthenticatedController, AuthorizationPolicyKind.AUTHENTICATED],
      [RestrictedController, AuthorizationPolicyKind.RBAC],
    ];

    expectations.forEach(([controller, expectedPolicy]) => {
      const resolution = resolutionFor(controller);
      const [classification] = classifier.classifyController(controller);

      expect(resolution.policy).toBe(expectedPolicy);
      expect(classification.policy).toBe(resolution.policy);
      expect(runtimeGuard.canActivate(contextFor(controller))).toBe(true);
    });
  });
});

function resolutionFor(controller: Type<unknown>) {
  return resolveAuthorizationPolicy(controller, handlerFor(controller));
}

function handlerFor(controller: Type<unknown>): object {
  return (controller.prototype as { findAll: object }).findAll;
}

function contextFor(controller: Type<unknown>): ExecutionContext {
  return {
    getClass: () => controller,
    getHandler: () => handlerFor(controller),
  } as ExecutionContext;
}
