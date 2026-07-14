import { Type } from '@nestjs/common';
import {
  AuthorizationClassificationSource,
  AuthorizationClassificationStatus,
  AuthorizationOperationClassification,
  AuthorizationPolicyKind,
} from './authorization-policy';
import { AuthorizationSurfaceClassifier } from './authorization-surface.classifier';

type AuthorizationSurfaceReader = Pick<
  AuthorizationSurfaceClassifier,
  'classifyModuleGraph'
>;

export enum AuthorizationActivationBlockerCode {
  LEGACY_INFERRED = 'LEGACY_INFERRED',
  MISSING_POLICY = 'MISSING_POLICY',
  INVALID_CLASSIFICATION = 'INVALID_CLASSIFICATION',
  INVALID_POLICY = 'INVALID_POLICY',
  DUPLICATE_OPERATION = 'DUPLICATE_OPERATION',
}

export interface AuthorizationActivationBlocker {
  code: AuthorizationActivationBlockerCode;
  operationId: string;
  reason: string;
}

export interface AuthorizationActivationEligibility {
  eligible: boolean;
  operationCount: number;
  checks: {
    noLegacyInferred: boolean;
    noOperationsWithoutPolicy: boolean;
    noAmbiguousOperations: boolean;
    allPoliciesValid: boolean;
    surfaceConsistent: boolean;
  };
  blockers: AuthorizationActivationBlocker[];
}

export class AuthorizationActivationIneligibleError extends Error {
  constructor(readonly eligibility: AuthorizationActivationEligibility) {
    super('La activación Deny by Default no es elegible.');
    this.name = AuthorizationActivationIneligibleError.name;
  }
}

export class AuthorizationActivationEligibilityEvaluator {
  constructor(
    private readonly surfaceReader: AuthorizationSurfaceReader = new AuthorizationSurfaceClassifier(),
  ) {}

  evaluate(rootModule: Type<unknown>): AuthorizationActivationEligibility {
    const operations = this.surfaceReader.classifyModuleGraph(rootModule);
    const blockers = operations.flatMap((operation) =>
      this.evaluateOperation(operation),
    );
    const duplicateOperationIds = this.findDuplicateOperationIds(operations);

    duplicateOperationIds.forEach((operationId) => {
      blockers.push({
        code: AuthorizationActivationBlockerCode.DUPLICATE_OPERATION,
        operationId,
        reason: 'La clasificación contiene una operación HTTP duplicada.',
      });
    });

    return {
      eligible: blockers.length === 0,
      operationCount: operations.length,
      checks: {
        noLegacyInferred: !blockers.some(
          ({ code }) =>
            code === AuthorizationActivationBlockerCode.LEGACY_INFERRED,
        ),
        noOperationsWithoutPolicy: !blockers.some(
          ({ code }) =>
            code === AuthorizationActivationBlockerCode.MISSING_POLICY,
        ),
        noAmbiguousOperations: !blockers.some(
          ({ code }) =>
            code === AuthorizationActivationBlockerCode.INVALID_CLASSIFICATION,
        ),
        allPoliciesValid: !blockers.some(
          ({ code }) =>
            code === AuthorizationActivationBlockerCode.INVALID_POLICY,
        ),
        surfaceConsistent: duplicateOperationIds.length === 0,
      },
      blockers,
    };
  }

  assertEligible(
    rootModule: Type<unknown>,
  ): AuthorizationActivationEligibility {
    const eligibility = this.evaluate(rootModule);
    if (!eligibility.eligible) {
      throw new AuthorizationActivationIneligibleError(eligibility);
    }
    return eligibility;
  }

  private evaluateOperation(
    operation: AuthorizationOperationClassification,
  ): AuthorizationActivationBlocker[] {
    const blockers: AuthorizationActivationBlocker[] = [];

    if (
      operation.source === AuthorizationClassificationSource.LEGACY_INFERRED
    ) {
      blockers.push({
        code: AuthorizationActivationBlockerCode.LEGACY_INFERRED,
        operationId: operation.operationId,
        reason: 'La operación conserva una clasificación LEGACY_INFERRED.',
      });
    }

    if (operation.policy === undefined) {
      blockers.push({
        code: AuthorizationActivationBlockerCode.MISSING_POLICY,
        operationId: operation.operationId,
        reason: 'La operación no declara una política de autorización.',
      });
    } else if (!this.isValidPolicy(operation.policy)) {
      blockers.push({
        code: AuthorizationActivationBlockerCode.INVALID_POLICY,
        operationId: operation.operationId,
        reason: `La operación declara una política no válida: ${operation.policy}.`,
      });
    }

    if (operation.status !== AuthorizationClassificationStatus.CLASSIFIED) {
      blockers.push({
        code: AuthorizationActivationBlockerCode.INVALID_CLASSIFICATION,
        operationId: operation.operationId,
        reason:
          operation.reasons.join(' ') ||
          'La operación no tiene una clasificación válida.',
      });
    }

    return blockers;
  }

  private isValidPolicy(policy: AuthorizationPolicyKind): boolean {
    return Object.values(AuthorizationPolicyKind).includes(policy);
  }

  private findDuplicateOperationIds(
    operations: AuthorizationOperationClassification[],
  ): string[] {
    const operationIds = new Set<string>();
    const duplicates = new Set<string>();

    operations.forEach(({ operationId }) => {
      if (operationIds.has(operationId)) duplicates.add(operationId);
      operationIds.add(operationId);
    });

    return [...duplicates];
  }
}
