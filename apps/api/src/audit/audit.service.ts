import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import { AuditActor, SYSTEM_AUDIT_ACTORS } from './audit-actor';

type AuditEventFields = {
  tenantId: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
};

/**
 * `userId` remains accepted for existing human call sites. New system work must
 * use the discriminated `actor` form so it cannot be confused with a user row.
 */
export type AuditLogInput = AuditEventFields &
  ({ actor: AuditActor; userId?: never } | { userId: string; actor?: never });

@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPrisma: TenantPrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async log(params: AuditLogInput, tx?: Prisma.TransactionClient) {
    const actor: AuditActor =
      'actor' in params && params.actor
        ? params.actor
        : { kind: 'HUMAN', id: params.userId };
    const context = this.tenantContext.get();

    this.assertActor(actor);
    if (context && context.tenantId !== params.tenantId) {
      throw new ForbiddenException(
        'El evento de auditoría no coincide con el tenant activo.',
      );
    }
    if (context && context.userId !== actor.id) {
      throw new ForbiddenException(
        'El actor de auditoría no coincide con la identidad activa.',
      );
    }

    if (tx) return this.persist(tx, params, actor);

    if (context) {
      return this.tenantPrisma.execute((client) =>
        this.persist(client, params, actor),
      );
    }

    // Public authentication flows have no request tenant context. They pass a
    // tenant resolved from the database or a validated opaque token; install
    // that scope locally for this single audit transaction.
    return this.prisma.$transaction((client) =>
      this.persist(client, params, actor),
    );
  }

  private assertActor(actor: AuditActor): void {
    if (typeof actor.id !== 'string' || actor.id.trim().length === 0) {
      throw new ForbiddenException('El actor de auditoría no es válido.');
    }

    if (
      actor.kind === 'SYSTEM' &&
      !Object.values(SYSTEM_AUDIT_ACTORS).includes(actor.id)
    ) {
      throw new ForbiddenException(
        'La identidad de sistema no está registrada para auditoría.',
      );
    }
  }

  private async persist(
    client: Prisma.TransactionClient,
    params: AuditEventFields,
    actor: AuditActor,
  ) {
    const [scope] = await client.$queryRaw<{ tenantId: string | null }[]>`
      SELECT NULLIF(current_setting('app.current_tenant_id', true), '')
        AS "tenantId"
    `;

    if (scope?.tenantId && scope.tenantId !== params.tenantId) {
      throw new ForbiddenException(
        'El evento de auditoría no coincide con el tenant de la transacción.',
      );
    }

    if (!scope?.tenantId) {
      await client.$executeRaw`
        SELECT set_config('app.current_tenant_id', ${params.tenantId}, true)
      `;
    }

    if (actor.kind === 'HUMAN' && !this.tenantContext.get()) {
      const actorUser = await client.user.findFirst({
        where: { id: actor.id, tenantId: params.tenantId },
        select: { id: true },
      });
      if (!actorUser) {
        throw new ForbiddenException(
          'El actor humano no pertenece al tenant del evento de auditoría.',
        );
      }
    }

    const metadataInput = (params.metadata ?? {}) as Prisma.InputJsonValue;
    return client.auditLog.create({
      data: {
        tenantId: params.tenantId,
        actorId: actor.id,
        actorKind: actor.kind,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ?? null,
        metadata: metadataInput,
      },
    });
  }
}
