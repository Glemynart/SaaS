import {
  DynamicModule,
  ForwardReference,
  RequestMethod,
  Type,
} from '@nestjs/common';
import {
  GUARDS_METADATA,
  METHOD_METADATA,
  MODULE_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { ActiveTenantGuard } from '../guards/active-tenant.guard';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import {
  AUTHENTICATION_GUARD_KEY,
  AUTHORIZATION_PENDING_KEY,
  AuthorizationClassificationSource,
  AuthorizationClassificationStatus,
  AuthorizationOperationClassification,
  AuthorizationPolicyKind,
} from './authorization-policy';
import {
  getOverrideMetadata,
  resolveAuthorizationPolicy,
} from './authorization-policy.resolver';

type ModuleReference =
  | Type<unknown>
  | DynamicModule
  | ForwardReference<() => Type<unknown>>;
type GuardReference = Type<unknown> | object;

interface EffectiveAuthorizationState {
  policy?: AuthorizationPolicyKind;
  source?: AuthorizationClassificationSource;
  roles: string[];
  hasJwtGuard: boolean;
  hasAuthenticationGuard: boolean;
  hasActiveTenantGuard: boolean;
  hasRolesGuard: boolean;
  reasons: string[];
}

export class AuthorizationSurfaceClassifier {
  classifyModuleGraph(
    rootModule: Type<unknown>,
  ): AuthorizationOperationClassification[] {
    const controllers = this.collectControllers(rootModule);
    return controllers
      .flatMap((controller) => this.classifyController(controller))
      .sort((left, right) => left.operationId.localeCompare(right.operationId));
  }

  classifyController(
    controller: Type<unknown>,
  ): AuthorizationOperationClassification[] {
    const prototype = controller.prototype as Record<string, unknown>;
    return Object.getOwnPropertyNames(prototype)
      .filter((name) => name !== 'constructor')
      .flatMap((handlerName) => {
        const handler = prototype[handlerName];
        if (
          typeof handler !== 'function' ||
          !Reflect.hasMetadata(METHOD_METADATA, handler)
        ) {
          return [];
        }

        return [this.classifyOperation(controller, handlerName, handler)];
      });
  }

  private classifyOperation(
    controller: Type<unknown>,
    handlerName: string,
    handler: object,
  ): AuthorizationOperationClassification {
    const pendingReason = getOverrideMetadata<string>(
      AUTHORIZATION_PENDING_KEY,
      controller,
      handler,
    );
    const state = this.resolveEffectiveState(controller, handler);

    if (pendingReason) {
      return this.buildClassification(
        controller,
        handlerName,
        handler,
        state,
        AuthorizationClassificationStatus.PENDING_DECISION,
        [pendingReason],
      );
    }

    const status =
      state.reasons.length > 0
        ? AuthorizationClassificationStatus.AMBIGUOUS
        : AuthorizationClassificationStatus.CLASSIFIED;

    return this.buildClassification(
      controller,
      handlerName,
      handler,
      state,
      status,
      state.reasons,
    );
  }

  private resolveEffectiveState(
    controller: Type<unknown>,
    handler: object,
  ): EffectiveAuthorizationState {
    const guards = this.getEffectiveGuards(controller, handler);
    const hasJwtGuard = this.hasGuard(guards, JwtAuthGuard);
    const hasAuthenticationGuard =
      hasJwtGuard || this.hasMarkedAuthenticationGuard(guards);
    const hasActiveTenantGuard = this.hasGuard(guards, ActiveTenantGuard);
    const hasRolesGuard = this.hasGuard(guards, RolesGuard);
    const resolution = resolveAuthorizationPolicy(controller, handler);
    const roles = resolution.roles;
    const explicitPolicy = resolution.policy;
    const reasons: string[] = [];

    let legacyPolicy: AuthorizationPolicyKind;
    if (resolution.rolesDeclared) {
      legacyPolicy = AuthorizationPolicyKind.RBAC;
      if (roles.length === 0) {
        reasons.push('La política RBAC no declara ningún rol.');
      }
      if (!hasRolesGuard) {
        reasons.push('Existen roles declarados sin RolesGuard efectivo.');
      }
      if (!hasJwtGuard) {
        reasons.push('Existen roles declarados sin JwtAuthGuard efectivo.');
      }
    } else if (hasAuthenticationGuard) {
      legacyPolicy = AuthorizationPolicyKind.AUTHENTICATED;
    } else {
      legacyPolicy = AuthorizationPolicyKind.UNAUTHENTICATED;
    }

    if (hasActiveTenantGuard && !hasJwtGuard) {
      reasons.push('ActiveTenantGuard existe sin JwtAuthGuard efectivo.');
    }
    if (hasRolesGuard && !hasJwtGuard) {
      reasons.push('RolesGuard existe sin JwtAuthGuard efectivo.');
    }
    if (resolution.invalidPolicy !== undefined) {
      reasons.push('La política explícita declarada no es válida.');
    }
    if (explicitPolicy && explicitPolicy !== legacyPolicy) {
      reasons.push(
        `La política explícita ${explicitPolicy} contradice el comportamiento actual ${legacyPolicy}.`,
      );
    }

    const policy =
      resolution.invalidPolicy !== undefined
        ? undefined
        : (explicitPolicy ?? legacyPolicy);
    const source =
      resolution.source ?? AuthorizationClassificationSource.LEGACY_INFERRED;

    return {
      policy,
      source,
      roles,
      hasJwtGuard,
      hasAuthenticationGuard,
      hasActiveTenantGuard,
      hasRolesGuard,
      reasons,
    };
  }

  private buildClassification(
    controller: Type<unknown>,
    handlerName: string,
    handler: object,
    state: EffectiveAuthorizationState,
    status: AuthorizationClassificationStatus,
    reasons: string[],
  ): AuthorizationOperationClassification {
    const requestMethod = Reflect.getMetadata(METHOD_METADATA, handler) as
      | RequestMethod
      | undefined;

    return {
      operationId: `${controller.name}.${handlerName}`,
      controller: controller.name,
      handler: handlerName,
      requestMethod:
        requestMethod === undefined ? 'UNKNOWN' : RequestMethod[requestMethod],
      controllerPath: this.getPathMetadata(controller),
      operationPath: this.getPathMetadata(handler),
      policy: state.policy,
      status,
      source: state.source,
      roles: state.roles,
      requiresAuthentication: state.hasAuthenticationGuard,
      requiresActiveTenant: state.hasActiveTenantGuard,
      reasons,
    };
  }

  private collectControllers(rootModule: Type<unknown>): Type<unknown>[] {
    const controllers = new Set<Type<unknown>>();
    const visitedModules = new Set<Type<unknown>>();

    const visit = (reference: ModuleReference): void => {
      const dynamicModule = this.asDynamicModule(reference);
      const moduleType =
        dynamicModule?.module ?? this.resolveModuleType(reference);
      if (!moduleType || visitedModules.has(moduleType)) return;
      visitedModules.add(moduleType);

      const moduleControllers = [
        ...this.getModuleMetadata<Type<unknown>>(
          moduleType,
          MODULE_METADATA.CONTROLLERS,
        ),
        ...((dynamicModule?.controllers ?? []) as Type<unknown>[]),
      ];
      moduleControllers.forEach((controller) => controllers.add(controller));

      const imports = [
        ...this.getModuleMetadata<ModuleReference>(
          moduleType,
          MODULE_METADATA.IMPORTS,
        ),
        ...((dynamicModule?.imports ?? []) as ModuleReference[]),
      ];
      imports.forEach(visit);
    };

    visit(rootModule);
    return [...controllers];
  }

  private getEffectiveGuards(
    controller: Type<unknown>,
    handler: object,
  ): GuardReference[] {
    const classGuards =
      (Reflect.getMetadata(GUARDS_METADATA, controller) as
        | GuardReference[]
        | undefined) ?? [];
    const handlerGuards =
      (Reflect.getMetadata(GUARDS_METADATA, handler) as
        | GuardReference[]
        | undefined) ?? [];
    return [...classGuards, ...handlerGuards];
  }

  private hasGuard(
    guards: GuardReference[],
    expectedGuard: Type<unknown>,
  ): boolean {
    return guards.some(
      (guard) =>
        guard === expectedGuard ||
        (typeof guard === 'object' && guard.constructor === expectedGuard),
    );
  }

  private hasMarkedAuthenticationGuard(guards: GuardReference[]): boolean {
    return guards.some((guard) => {
      const target =
        typeof guard === 'function'
          ? guard
          : (guard.constructor as Type<unknown>);
      return Reflect.getMetadata(AUTHENTICATION_GUARD_KEY, target) === true;
    });
  }

  private getPathMetadata(target: object): string | string[] {
    return (
      (Reflect.getMetadata(PATH_METADATA, target) as
        | string
        | string[]
        | undefined) ?? ''
    );
  }

  private getModuleMetadata<T>(moduleType: Type<unknown>, key: string): T[] {
    return (Reflect.getMetadata(key, moduleType) as T[] | undefined) ?? [];
  }

  private asDynamicModule(
    reference: ModuleReference,
  ): DynamicModule | undefined {
    return typeof reference === 'object' && 'module' in reference
      ? reference
      : undefined;
  }

  private resolveModuleType(
    reference: ModuleReference,
  ): Type<unknown> | undefined {
    if (typeof reference === 'function') return reference;
    if ('forwardRef' in reference) return reference.forwardRef();
    return reference.module;
  }
}
