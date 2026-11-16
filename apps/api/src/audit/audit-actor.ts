export const SYSTEM_AUDIT_ACTORS = {
  ALERTS_SCHEDULER: 'system:alerts-scheduler',
  SERVICE_PREMIUM_WORKER: 'system:service-premium-worker',
  PASSWORD_RESET: 'system:password-reset',
} as const;

export type SystemAuditActorId =
  (typeof SYSTEM_AUDIT_ACTORS)[keyof typeof SYSTEM_AUDIT_ACTORS];

export type AuditActor =
  | { kind: 'HUMAN'; id: string }
  | { kind: 'SYSTEM'; id: SystemAuditActorId };

export type AuditActorKind = AuditActor['kind'];
