import { Type } from '@nestjs/common';
import { ROLES_KEY } from '../decorators/roles.decorator';
import {
  AUTHORIZATION_PENDING_KEY,
  AUTHORIZATION_POLICY_KEY,
  AuthorizationClassificationSource,
  AuthorizationPolicyKind,
} from './authorization-policy';
import { getDeclaredControllerPolicy } from './authorization-policy.declarations';

export interface AuthorizationPolicyResolution {
  policy?: AuthorizationPolicyKind;
  source?: AuthorizationClassificationSource;
  roles: string[];
  rolesDeclared: boolean;
  pendingReason?: string;
  invalidPolicy?: unknown;
}

export const resolveAuthorizationPolicy = (
  controller: Type<unknown>,
  handler: object,
): AuthorizationPolicyResolution => {
  const roles = getOverrideMetadata<string[]>(ROLES_KEY, controller, handler);
  const pendingReason = getOverrideMetadata<string>(
    AUTHORIZATION_PENDING_KEY,
    controller,
    handler,
  );
  const metadataPolicy = getOverrideMetadata<unknown>(
    AUTHORIZATION_POLICY_KEY,
    controller,
    handler,
  );

  if (pendingReason) {
    return {
      roles: roles ?? [],
      rolesDeclared: roles !== undefined,
      pendingReason,
    };
  }

  if (
    metadataPolicy !== undefined &&
    !isAuthorizationPolicyKind(metadataPolicy)
  ) {
    return {
      roles: roles ?? [],
      rolesDeclared: roles !== undefined,
      source: AuthorizationClassificationSource.EXPLICIT,
      invalidPolicy: metadataPolicy,
    };
  }

  if (metadataPolicy !== undefined) {
    return {
      policy: metadataPolicy,
      source: AuthorizationClassificationSource.EXPLICIT,
      roles: roles ?? [],
      rolesDeclared: roles !== undefined,
    };
  }

  if (roles !== undefined) {
    return {
      policy: AuthorizationPolicyKind.RBAC,
      source: AuthorizationClassificationSource.EXISTING_RBAC,
      roles,
      rolesDeclared: true,
    };
  }

  const declaredPolicy = getDeclaredControllerPolicy(controller.name);
  return {
    policy: declaredPolicy,
    source: declaredPolicy
      ? AuthorizationClassificationSource.EXPLICIT
      : undefined,
    roles: [],
    rolesDeclared: false,
  };
};

export const isAuthorizationPolicyKind = (
  value: unknown,
): value is AuthorizationPolicyKind =>
  Object.values(AuthorizationPolicyKind).includes(
    value as AuthorizationPolicyKind,
  );

export const getOverrideMetadata = <T>(
  key: string,
  controller: Type<unknown>,
  handler: object,
): T | undefined => {
  const handlerValue = Reflect.getMetadata(key, handler) as T | undefined;
  return (
    handlerValue ?? (Reflect.getMetadata(key, controller) as T | undefined)
  );
};
