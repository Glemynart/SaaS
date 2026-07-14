import { SetMetadata } from '@nestjs/common';

export const AUTHORIZATION_POLICY_KEY = 'authorization:policy';
export const AUTHORIZATION_PENDING_KEY = 'authorization:pending';

export enum AuthorizationPolicyKind {
  UNAUTHENTICATED = 'UNAUTHENTICATED',
  AUTHENTICATED = 'AUTHENTICATED',
  RBAC = 'RBAC',
}

export enum AuthorizationClassificationStatus {
  CLASSIFIED = 'CLASSIFIED',
  AMBIGUOUS = 'AMBIGUOUS',
  PENDING_DECISION = 'PENDING_DECISION',
}

export enum AuthorizationClassificationSource {
  EXPLICIT = 'EXPLICIT',
  EXISTING_RBAC = 'EXISTING_RBAC',
  LEGACY_INFERRED = 'LEGACY_INFERRED',
}

export interface AuthorizationOperationClassification {
  operationId: string;
  controller: string;
  handler: string;
  requestMethod: string;
  controllerPath: string | string[];
  operationPath: string | string[];
  policy?: AuthorizationPolicyKind;
  status: AuthorizationClassificationStatus;
  source?: AuthorizationClassificationSource;
  roles: string[];
  requiresAuthentication: boolean;
  requiresActiveTenant: boolean;
  reasons: string[];
}

export const Unauthenticated = () =>
  SetMetadata(
    AUTHORIZATION_POLICY_KEY,
    AuthorizationPolicyKind.UNAUTHENTICATED,
  );

export const Authenticated = () =>
  SetMetadata(AUTHORIZATION_POLICY_KEY, AuthorizationPolicyKind.AUTHENTICATED);

export const AuthorizationDecisionPending = (reason: string) =>
  SetMetadata(AUTHORIZATION_PENDING_KEY, reason);
