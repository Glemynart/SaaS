import { Type } from '@nestjs/common';
import { AppModule } from '../../app.module';
import {
  AuthorizationClassificationSource,
  AuthorizationClassificationStatus,
  AuthorizationOperationClassification,
  AuthorizationPolicyKind,
} from './authorization-policy';
import {
  AuthorizationActivationBlockerCode,
  AuthorizationActivationEligibilityEvaluator,
  AuthorizationActivationIneligibleError,
} from './authorization-activation-eligibility';

class TestModule {}

describe('AuthorizationActivationEligibilityEvaluator', () => {
  it('declares the current HTTP surface eligible for Deny by Default activation', () => {
    const evaluator = new AuthorizationActivationEligibilityEvaluator();

    const eligibility = evaluator.evaluate(AppModule);

    expect(eligibility).toEqual({
      eligible: true,
      operationCount: 217,
      checks: {
        noLegacyInferred: true,
        noOperationsWithoutPolicy: true,
        noAmbiguousOperations: true,
        allPoliciesValid: true,
        surfaceConsistent: true,
      },
      blockers: [],
    });
  });

  it('reports every migration-debt condition as an activation blocker', () => {
    const evaluator = new AuthorizationActivationEligibilityEvaluator(
      surfaceReader([
        operation({
          operationId: 'LegacyController.findAll',
          source: AuthorizationClassificationSource.LEGACY_INFERRED,
        }),
        operation({
          operationId: 'MissingPolicyController.findAll',
          policy: undefined,
        }),
        operation({
          operationId: 'AmbiguousController.findAll',
          status: AuthorizationClassificationStatus.AMBIGUOUS,
          reasons: ['La política contradice el comportamiento actual.'],
        }),
        operation({
          operationId: 'InvalidPolicyController.findAll',
          policy: 'UNKNOWN' as AuthorizationPolicyKind,
        }),
        operation({ operationId: 'DuplicateController.findAll' }),
        operation({ operationId: 'DuplicateController.findAll' }),
      ]),
    );

    const eligibility = evaluator.evaluate(TestModule);

    expect(eligibility.eligible).toBe(false);
    expect(eligibility.checks).toEqual({
      noLegacyInferred: false,
      noOperationsWithoutPolicy: false,
      noAmbiguousOperations: false,
      allPoliciesValid: false,
      surfaceConsistent: false,
    });
    expect(eligibility.blockers.map(({ code }) => code)).toEqual([
      AuthorizationActivationBlockerCode.LEGACY_INFERRED,
      AuthorizationActivationBlockerCode.MISSING_POLICY,
      AuthorizationActivationBlockerCode.INVALID_CLASSIFICATION,
      AuthorizationActivationBlockerCode.INVALID_POLICY,
      AuthorizationActivationBlockerCode.DUPLICATE_OPERATION,
    ]);
  });

  it('has no bypass: failed eligibility throws before a future activation can proceed', () => {
    const evaluator = new AuthorizationActivationEligibilityEvaluator(
      surfaceReader([
        operation({
          operationId: 'PendingController.findAll',
          status: AuthorizationClassificationStatus.PENDING_DECISION,
          reasons: ['Requiere una decisión de autorización.'],
        }),
      ]),
    );

    expect(() => evaluator.assertEligible(TestModule)).toThrow(
      AuthorizationActivationIneligibleError,
    );
    expect(() => evaluator.assertEligible(TestModule)).toThrow(
      'La activación Deny by Default no es elegible.',
    );
  });
});

function surfaceReader(operations: AuthorizationOperationClassification[]) {
  return {
    classifyModuleGraph: (_rootModule: Type<unknown>) => {
      void _rootModule;
      return operations;
    },
  };
}

function operation(
  overrides: Partial<AuthorizationOperationClassification> = {},
): AuthorizationOperationClassification {
  return {
    operationId: 'ClassifiedController.findAll',
    controller: 'ClassifiedController',
    handler: 'findAll',
    requestMethod: 'GET',
    controllerPath: 'classified',
    operationPath: '',
    policy: AuthorizationPolicyKind.AUTHENTICATED,
    status: AuthorizationClassificationStatus.CLASSIFIED,
    source: AuthorizationClassificationSource.EXPLICIT,
    roles: [],
    requiresAuthentication: true,
    requiresActiveTenant: false,
    reasons: [],
    ...overrides,
  };
}
