import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import {
  createAuditEventId,
  installSignedTenantDatabaseContext,
  SignedDatabaseContextError,
  signAuditEvent,
} from '../tenant-context/signed-database-context';
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
    try {
      await installSignedTenantDatabaseContext(
        client,
        params.tenantId,
        actor.id,
        actor.kind,
      );
    } catch (error) {
      if (error instanceof SignedDatabaseContextError) {
        throw new ForbiddenException(
          'El evento de auditoría no coincide con el contexto firmado activo.',
        );
      }
      throw error;
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

    const event = {
      id: createAuditEventId(),
      tenantId: params.tenantId,
      actorId: actor.id,
      actorType: actor.kind,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      metadata: params.metadata ?? {},
    };
    const signedEvent = signAuditEvent(event);
    const [stored] = await client.$queryRaw<
      {
        id: string;
        createdAt: Date;
        tenantId: string;
        actorId: string;
        actorKind: string;
        action: string;
        entityType: string;
        entityId: string | null;
        metadata: Prisma.JsonValue;
      }[]
    >`
      SELECT *
      FROM audit_private.append_audit_event(
        ${signedEvent.payload},
        ${signedEvent.signature},
        ${signedEvent.keyId}
      )
    `;
    if (!stored) {
      throw new Error('No fue posible registrar el evento de auditoría.');
    }
    return stored;
  }
}
