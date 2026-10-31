import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AppModule } from '../../app.module';
import { Roles } from '../decorators/roles.decorator';
import { ActiveTenantGuard } from '../guards/active-tenant.guard';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { PlatformS2sGuard } from '../../platform-admin/guards/platform-s2s.guard';
import {
  AUTHENTICATION_GUARD_KEY,
  Authenticated,
  AuthorizationClassificationSource,
  AuthorizationClassificationStatus,
  AuthorizationDecisionPending,
  AuthorizationPolicyKind,
  Unauthenticated,
} from './authorization-policy';
import { AuthorizationSurfaceClassifier } from './authorization-surface.classifier';

describe('AuthorizationSurfaceClassifier', () => {
  const classifier = new AuthorizationSurfaceClassifier();

  it('classifies the complete current HTTP surface without ambiguity', () => {
    const operations = classifier.classifyModuleGraph(AppModule);

    expect(operations).toHaveLength(183);
    expect(new Set(operations.map(({ operationId }) => operationId)).size).toBe(
      operations.length,
    );
    expect(
      operations.filter(
        ({ status }) => status !== AuthorizationClassificationStatus.CLASSIFIED,
      ),
    ).toEqual([]);
    expect(operations.filter(({ policy }) => policy === undefined)).toEqual([]);
    expect(
      operations.find(
        ({ operationId }) =>
          operationId === 'AuthController.validateResetToken',
      ),
    ).toMatchObject({
      requestMethod: 'POST',
      operationPath: 'validate-reset-token',
      policy: AuthorizationPolicyKind.UNAUTHENTICATED,
      requiresAuthentication: false,
      requiresActiveTenant: false,
      status: AuthorizationClassificationStatus.CLASSIFIED,
    });

    expect(countBy(operations, 'policy')).toEqual({
      [AuthorizationPolicyKind.UNAUTHENTICATED]: 12,
      [AuthorizationPolicyKind.AUTHENTICATED]: 60,
      [AuthorizationPolicyKind.RBAC]: 111,
    });
    expect(countBy(operations, 'source')).toEqual({
      [AuthorizationClassificationSource.EXPLICIT]: 72,
      [AuthorizationClassificationSource.EXISTING_RBAC]: 111,
    });
    expect(
      operations.filter(
        ({ source }) =>
          source === AuthorizationClassificationSource.LEGACY_INFERRED,
      ),
    ).toEqual([]);

    expect(
      operations.find(
        ({ operationId }) =>
          operationId === 'ExpedienteDocsController.uploadManual',
      ),
    ).toMatchObject({
      requestMethod: 'POST',
      operationPath: 'employees/:id/expediente',
      policy: AuthorizationPolicyKind.RBAC,
      roles: [UserRole.ADMIN, UserRole.OPERADOR],
      requiresAuthentication: true,
      requiresActiveTenant: true,
      status: AuthorizationClassificationStatus.CLASSIFIED,
    });
  });

  it('detects a declaration that contradicts the effective legacy policy', () => {
    @Controller('ambiguous')
    class AmbiguousController {
      @Authenticated()
      @Get()
      findAll() {}
    }

    const [operation] = classifier.classifyController(AmbiguousController);

    expect(operation.status).toBe(AuthorizationClassificationStatus.AMBIGUOUS);
    expect(operation.reasons).toContain(
      'La política explícita AUTHENTICATED contradice el comportamiento actual UNAUTHENTICATED.',
    );
  });

  it('detects operations explicitly marked as pending a decision', () => {
    @Controller('pending')
    class PendingController {
      @AuthorizationDecisionPending('Requiere decisión del módulo propietario.')
      @Get()
      findAll() {}
    }

    const [operation] = classifier.classifyController(PendingController);

    expect(operation.status).toBe(
      AuthorizationClassificationStatus.PENDING_DECISION,
    );
    expect(operation.reasons).toEqual([
      'Requiere decisión del módulo propietario.',
    ]);
  });

  it('recognizes all three approved policy categories', () => {
    @UseGuards(JwtAuthGuard, ActiveTenantGuard, RolesGuard)
    @Controller('classified')
    class ClassifiedController {
      @Unauthenticated()
      @Get('public')
      publicOperation() {}

      @Authenticated()
      @Get('authenticated')
      authenticatedOperation() {}

      @Roles(UserRole.ADMIN)
      @Get('restricted')
      restrictedOperation() {}
    }

    const operations = classifier.classifyController(ClassifiedController);

    expect(
      operations.map(({ policy, status }) => ({ policy, status })),
    ).toEqual([
      {
        policy: AuthorizationPolicyKind.UNAUTHENTICATED,
        status: AuthorizationClassificationStatus.AMBIGUOUS,
      },
      {
        policy: AuthorizationPolicyKind.AUTHENTICATED,
        status: AuthorizationClassificationStatus.CLASSIFIED,
      },
      {
        policy: AuthorizationPolicyKind.RBAC,
        status: AuthorizationClassificationStatus.CLASSIFIED,
      },
    ]);
  });

  it('classifies PlatformS2sGuard as authentication for deny-by-default', () => {
    expect(
      Reflect.getMetadata(AUTHENTICATION_GUARD_KEY, PlatformS2sGuard),
    ).toBe(true);

    const operation = classifier
      .classifyModuleGraph(AppModule)
      .find(
        ({ operationId }) =>
          operationId === 'PlatformTenantsController.findOne',
      );

    expect(operation).toMatchObject({
      requestMethod: 'GET',
      controllerPath: 'platform/admin/v1/tenants',
      operationPath: ':tenantId',
      policy: AuthorizationPolicyKind.AUTHENTICATED,
      source: AuthorizationClassificationSource.EXPLICIT,
      requiresAuthentication: true,
      requiresActiveTenant: false,
      status: AuthorizationClassificationStatus.CLASSIFIED,
    });
  });
});

function countBy(
  operations: ReturnType<AuthorizationSurfaceClassifier['classifyModuleGraph']>,
  field: 'policy' | 'source',
): Record<string, number> {
  return operations.reduce<Record<string, number>>((counts, operation) => {
    const value = operation[field];
    if (value) counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}
