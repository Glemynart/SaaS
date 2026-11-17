import { Prisma, UserRole } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AuditService } from './audit.service';
import { SYSTEM_AUDIT_ACTORS } from './audit-actor';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextBoundary } from '../tenant-context/tenant-context.boundary';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import {
  installSignedSystemTenantDatabaseContext,
  installSignedTenantDatabaseContext,
  signAuditEvent,
  signTenantDatabaseContext,
} from '../tenant-context/signed-database-context';

describe('AuditLog PostgreSQL RLS', () => {
  const suffix = randomUUID().replaceAll('-', '');
  const role = `rls_audit_log_${suffix}`;
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const actorA = randomUUID();
  const actorA2 = randomUUID();
  const actorB = randomUUID();
  const auditA = randomUUID();
  const auditB = randomUUID();
  let connected = false;
  const tenantContext = new TenantContextService();
  const prisma = new PrismaService();
  const rolePrisma = {
    $transaction: <T>(
      work: (tx: Prisma.TransactionClient) => Promise<T>,
      options?: {
        maxWait?: number;
        timeout?: number;
        isolationLevel?: Prisma.TransactionIsolationLevel;
      },
    ) =>
      prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe('SET LOCAL ROLE "' + role + '"');
        return work(tx);
      }, options),
  } as unknown as PrismaService;
  const tenantPrisma = new TenantPrismaService(
    rolePrisma,
    new TenantContextBoundary(tenantContext),
  );
  const auditService = new AuditService(
    rolePrisma,
    tenantPrisma,
    tenantContext,
  );

  beforeAll(async () => {
    assertDisposableDatabase();
    process.env.AUDIT_LOG_SIGNING_KEY = Buffer.from(
      'goal02-disposable-audit-signing-key-for-tests-only',
    ).toString('base64');
    process.env.AUDIT_LOG_SIGNING_KEY_ID = 'ci-test-v1';
    await prisma.$connect();
    connected = true;
    await dropTestRole();
    await prisma.$executeRawUnsafe(
      'CREATE ROLE "' + role + '" NOLOGIN NOSUPERUSER NOBYPASSRLS',
    );
    await prisma.$executeRawUnsafe(
      'GRANT USAGE ON SCHEMA public TO "' + role + '"',
    );
    await prisma.$executeRawUnsafe(
      'GRANT SELECT ON TABLE "users" TO "' + role + '"',
    );
    await prisma.$executeRawUnsafe(
      'GRANT USAGE ON SCHEMA audit_private TO "' + role + '"',
    );
    await prisma.$executeRawUnsafe(
      'GRANT EXECUTE ON FUNCTION audit_private.current_tenant_id() TO "' +
        role +
        '"',
    );
    await prisma.$executeRawUnsafe(
      'GRANT EXECUTE ON FUNCTION audit_private.current_actor_id() TO "' +
        role +
        '"',
    );
    await prisma.$executeRawUnsafe(
      'GRANT EXECUTE ON FUNCTION audit_private.current_actor_type() TO "' +
        role +
        '"',
    );
    await prisma.$executeRawUnsafe(
      'GRANT EXECUTE ON FUNCTION audit_private.append_audit_event(text, bytea, text) TO "' +
        role +
        '"',
    );
    await prisma.tenant.createMany({
      data: [tenantData(tenantA, 'a'), tenantData(tenantB, 'b')],
    });
    await prisma.user.createMany({
      data: [
        actorData(actorA, tenantA, 'a'),
        actorData(actorA2, tenantA, 'a2'),
        actorData(actorB, tenantB, 'b'),
      ],
    });
  }, 30000);

  afterAll(async () => {
    if (!connected) return;
    try {
      await prisma.auditLog.deleteMany({
        where: { tenantId: { in: [tenantA, tenantB] } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: [actorA, actorA2, actorB] } },
      });
      await prisma.tenant.deleteMany({
        where: { id: { in: [tenantA, tenantB] } },
      });
    } finally {
      try {
        await dropTestRole();
      } finally {
        await prisma.$disconnect();
      }
    }
  }, 30000);

  it('forces tenant RLS and grants only select and insert policies', async () => {
    const [table] = await prisma.$queryRawUnsafe<
      { rowSecurity: boolean; forceRowSecurity: boolean }[]
    >(
      'SELECT relrowsecurity AS "rowSecurity", ' +
        'relforcerowsecurity AS "forceRowSecurity" ' +
        "FROM pg_class WHERE oid = 'public.audit_logs'::regclass",
    );
    const policies = await prisma.$queryRawUnsafe<
      { command: string; policy: string }[]
    >(
      'SELECT cmd AS command, policyname AS policy FROM pg_policies ' +
        "WHERE schemaname = 'public' AND tablename = 'audit_logs' " +
        'ORDER BY cmd',
    );
    const [privileges] = await prisma.$queryRawUnsafe<
      Record<string, boolean>[]
    >(
      `SELECT ` +
        `has_table_privilege('${role}', 'public.audit_logs', 'SELECT') AS "tableSelect", ` +
        `has_table_privilege('${role}', 'public.audit_logs', 'INSERT') AS "tableInsert", ` +
        `has_table_privilege('${role}', 'public.audit_logs', 'UPDATE') AS "tableUpdate", ` +
        `has_table_privilege('${role}', 'public.audit_logs', 'DELETE') AS "tableDelete", ` +
        `has_table_privilege('${role}', 'public.audit_logs', 'TRUNCATE') AS "tableTruncate", ` +
        `has_column_privilege('${role}', 'public.audit_logs', 'metadata', 'SELECT') AS "columnSelect", ` +
        `has_column_privilege('${role}', 'public.audit_logs', 'metadata', 'UPDATE') AS "columnUpdate"`,
    );
    const [roleAttributes] = await prisma.$queryRawUnsafe<
      {
        superuser: boolean;
        bypassRls: boolean;
        ownsTable: boolean;
        memberOfTableOwner: boolean;
        memberOfFunctionOwner: boolean;
      }[]
    >(
      `SELECT role.rolsuper AS superuser, role.rolbypassrls AS "bypassRls", ` +
        `relation.relowner = role.oid AS "ownsTable", ` +
        `pg_has_role(role.oid, relation.relowner, 'MEMBER') AS "memberOfTableOwner", ` +
        `pg_has_role(role.oid, 'saas_audit_log_function_owner', 'MEMBER') AS "memberOfFunctionOwner" ` +
        `FROM pg_roles AS role ` +
        `CROSS JOIN pg_class AS relation ` +
        `WHERE role.rolname = '${role}' ` +
        `AND relation.oid = 'public.audit_logs'::regclass`,
    );
    const [functionOwnerMemberships] = await prisma.$queryRawUnsafe<
      { hasMemberships: boolean }[]
    >(
      `SELECT EXISTS (` +
        `SELECT 1 FROM pg_auth_members ` +
        `WHERE roleid = (SELECT oid FROM pg_roles WHERE rolname = 'saas_audit_log_function_owner') ` +
        `OR member = (SELECT oid FROM pg_roles WHERE rolname = 'saas_audit_log_function_owner')` +
        `) AS "hasMemberships"`,
    );

    expect(table).toEqual({ rowSecurity: true, forceRowSecurity: true });
    expect(policies).toEqual([
      { command: 'INSERT', policy: 'audit_logs_tenant_insert' },
      { command: 'SELECT', policy: 'audit_logs_tenant_select' },
    ]);
    expect(privileges).toEqual({
      tableSelect: false,
      tableInsert: false,
      tableUpdate: false,
      tableDelete: false,
      tableTruncate: false,
      columnSelect: false,
      columnUpdate: false,
    });
    expect(roleAttributes).toEqual({
      superuser: false,
      bypassRls: false,
      ownsTable: false,
      memberOfTableOwner: false,
      memberOfFunctionOwner: false,
    });
    expect(functionOwnerMemberships).toEqual({ hasMemberships: false });
  });

  it('stores actors and exposes only rows for the active tenant', async () => {
    await withTenant(tenantA, actorA, () =>
      auditService.log({
        tenantId: tenantA,
        userId: actorA,
        action: 'AUDIT_TEST_A',
        entityType: 'AuditLogTest',
        entityId: auditA,
      }),
    );
    await withTenant(tenantB, actorB, () =>
      auditService.log({
        tenantId: tenantB,
        userId: actorB,
        action: 'AUDIT_TEST_B',
        entityType: 'AuditLogTest',
        entityId: auditB,
      }),
    );

    const stored = await prisma.auditLog.findMany({
      where: { entityId: { in: [auditA, auditB] } },
      select: {
        tenantId: true,
        entityId: true,
        actorId: true,
        actorKind: true,
      },
      orderBy: { tenantId: 'asc' },
    });
    expect(stored).toEqual(
      expect.arrayContaining([
        {
          tenantId: tenantA,
          entityId: auditA,
          actorId: actorA,
          actorKind: 'HUMAN',
        },
        {
          tenantId: tenantB,
          entityId: auditB,
          actorId: actorB,
          actorKind: 'HUMAN',
        },
      ]),
    );
    expect(stored).toHaveLength(2);

    await withTenant(tenantA, actorA, () =>
      tenantPrisma.execute(async (tx) => {
        const [context] = await tx.$queryRaw<
          { tenantId: string | null; actorId: string | null }[]
        >`SELECT audit_private.current_tenant_id() AS "tenantId", audit_private.current_actor_id() AS "actorId"`;
        expect(context).toEqual({ tenantId: tenantA, actorId: actorA });
      }),
    );
  });

  it('records a token reset as a system actor and scopes the event to its tenant', async () => {
    await auditService.log({
      tenantId: tenantA,
      actor: { kind: 'SYSTEM', id: SYSTEM_AUDIT_ACTORS.PASSWORD_RESET },
      action: 'PASSWORD_RESET_COMPLETED',
      entityType: 'Auth',
      entityId: actorA,
      metadata: {
        requester: 'UNAUTHENTICATED',
        authenticationMethod: 'PASSWORD_RESET_TOKEN',
        subjectUserId: actorA,
      },
    });

    const visibleToTenantA = await prisma.auditLog.findFirst({
      where: { entityId: actorA, action: 'PASSWORD_RESET_COMPLETED' },
    });

    expect(visibleToTenantA).toMatchObject({
      tenantId: tenantA,
      actorId: SYSTEM_AUDIT_ACTORS.PASSWORD_RESET,
      actorKind: 'SYSTEM',
      action: 'PASSWORD_RESET_COMPLETED',
      entityType: 'Auth',
      entityId: actorA,
      metadata: {
        requester: 'UNAUTHENTICATED',
        authenticationMethod: 'PASSWORD_RESET_TOKEN',
        subjectUserId: actorA,
      },
    });
    await expect(
      runAsRole(
        tenantB,
        (tx) =>
          tx.$queryRaw`SELECT * FROM public.audit_logs WHERE "entityId" = ${actorA}`,
      ),
    ).rejects.toThrow();
  });

  it('validates a pre-authenticated human against the tenant before auditing', async () => {
    const invitationEventId = randomUUID();
    await auditService.log({
      tenantId: tenantA,
      userId: actorA,
      action: 'USER_INVITATION_ACCEPTED',
      entityType: 'UserInvitation',
      entityId: invitationEventId,
      metadata: { authenticationMethod: 'INVITATION_TOKEN' },
    });

    await expect(
      auditService.log({
        tenantId: tenantA,
        userId: actorB,
        action: 'USER_INVITATION_ACCEPTED',
        entityType: 'UserInvitation',
        entityId: randomUUID(),
      }),
    ).rejects.toThrow('El actor humano no pertenece al tenant');

    const stored = await prisma.auditLog.findFirst({
      where: { entityId: invitationEventId },
    });
    expect(stored).toMatchObject({
      tenantId: tenantA,
      actorId: actorA,
      actorKind: 'HUMAN',
      action: 'USER_INVITATION_ACCEPTED',
      metadata: { authenticationMethod: 'INVITATION_TOKEN' },
    });
    await expect(
      prisma.auditLog.count({ where: { entityId: invitationEventId } }),
    ).resolves.toBe(1);
  });

  it('does not trust mutable tenant GUCs and blocks direct table access', async () => {
    const [scope] = await runAsRole(
      tenantB,
      (tx) =>
        tx.$queryRaw<{ tenantId: string | null }[]>`
        SELECT audit_private.current_tenant_id() AS "tenantId"
      `,
    );
    expect(scope.tenantId).toBeNull();

    await expect(
      runAsRole(
        tenantB,
        (tx) =>
          tx.$queryRaw`SELECT * FROM public.audit_logs WHERE "tenantId" = ${tenantA}`,
      ),
    ).rejects.toThrow();

    await expect(
      runAsRole(tenantA, (tx) =>
        tx.auditLog.create({
          data: {
            id: randomUUID(),
            tenantId: tenantA,
            actorId: randomUUID(),
            actorKind: 'HUMAN',
            action: 'INVENTED_HUMAN_INSERT',
            entityType: 'AuditLogTest',
          },
        }),
      ),
    ).rejects.toThrow();

    await expect(
      runAsRole(tenantA, (tx) =>
        tx.auditLog.create({
          data: {
            id: randomUUID(),
            tenantId: tenantB,
            actorId: actorA,
            actorKind: 'HUMAN',
            action: 'CROSS_TENANT_INSERT',
            entityType: 'AuditLogTest',
          },
        }),
      ),
    ).rejects.toThrow();

    await expect(
      runAsRole(
        tenantA,
        (tx) =>
          tx.$executeRaw`UPDATE public.audit_logs SET action = 'MUTATED' WHERE "entityId" = ${auditA}`,
      ),
    ).rejects.toThrow();
    await expect(
      runAsRole(
        tenantA,
        (tx) =>
          tx.$executeRaw`DELETE FROM public.audit_logs WHERE "entityId" = ${auditA}`,
      ),
    ).rejects.toThrow();
    await expect(
      runAsRole(
        tenantA,
        (tx) => tx.$executeRaw`TRUNCATE TABLE public.audit_logs`,
      ),
    ).rejects.toThrow();

    const unchanged = await prisma.auditLog.findFirstOrThrow({
      where: { entityId: auditA },
      select: { action: true },
    });
    expect(unchanged.action).toBe('AUDIT_TEST_A');
  });

  it('fails closed for missing, malformed, altered, and tenant-mismatched signed context', async () => {
    const [empty] = await runAsRole(
      null,
      (tx) =>
        tx.$queryRaw<{ tenantId: string | null }[]>`
        SELECT audit_private.current_tenant_id() AS "tenantId"
      `,
    );
    expect(empty.tenantId).toBeNull();

    const result = await runAsRole(null, async (tx) => {
      const [transaction] = await tx.$queryRaw<{ transactionId: string }[]>`
        SELECT pg_catalog.pg_current_xact_id()::text AS "transactionId"
      `;
      const signed = signTenantDatabaseContext(
        tenantA,
        actorA,
        'HUMAN',
        transaction.transactionId,
      );
      await tx.$executeRaw`
        SELECT
          set_config('app.current_tenant_id', ${tenantA}, true),
          set_config('app.signed_tenant_context', ${signed.payload}, true),
          set_config('app.signed_tenant_context_signature', ${signed.signature.toString('hex')}, true)
      `;
      const [valid] = await tx.$queryRaw<
        { tenantId: string | null; actorId: string | null }[]
      >`
        SELECT audit_private.current_tenant_id() AS "tenantId",
               audit_private.current_actor_id() AS "actorId"
      `;
      await tx.$executeRaw`
        SELECT set_config('app.current_tenant_id', ${tenantB}, true)
      `;
      const [mismatchedTenant] = await tx.$queryRaw<
        { tenantId: string | null }[]
      >`SELECT audit_private.current_tenant_id() AS "tenantId"`;
      await tx.$executeRaw`
        SELECT
          set_config('app.current_tenant_id', ${tenantA}, true),
          set_config(
            'app.signed_tenant_context',
            ${signed.payload.replace(actorA, actorA2)},
            true
          )
      `;
      const [mismatchedActorSignature] = await tx.$queryRaw<
        { actorId: string | null }[]
      >`SELECT audit_private.current_actor_id() AS "actorId"`;
      return { valid, mismatchedTenant, mismatchedActorSignature };
    });
    expect(result.valid).toEqual({ tenantId: tenantA, actorId: actorA });
    expect(result.mismatchedTenant.tenantId).toBeNull();
    expect(result.mismatchedActorSignature.actorId).toBeNull();

    const [alteredSignature] = await runAsRole(null, async (tx) => {
      const [transaction] = await tx.$queryRaw<{ transactionId: string }[]>`
        SELECT pg_catalog.pg_current_xact_id()::text AS "transactionId"
      `;
      const signed = signTenantDatabaseContext(
        tenantA,
        actorA,
        'HUMAN',
        transaction.transactionId,
      );
      await tx.$executeRaw`
        SELECT
          set_config('app.current_tenant_id', ${tenantA}, true),
          set_config('app.signed_tenant_context', ${signed.payload}, true),
          set_config('app.signed_tenant_context_signature', ${'00'.repeat(32)}, true)
      `;
      return tx.$queryRaw<{ tenantId: string | null }[]>`
        SELECT audit_private.current_tenant_id() AS "tenantId"
      `;
    });
    expect(alteredSignature.tenantId).toBeNull();
  });

  it('rejects database-signed append attempts for invented humans and unregistered SYSTEM actors', async () => {
    const inventedActor = randomUUID();
    const inventedHumanEvent = signAuditEvent({
      id: randomUUID(),
      tenantId: tenantA,
      actorId: inventedActor,
      actorType: 'HUMAN',
      action: 'FORGED_HUMAN',
      entityType: 'AuditLogTest',
      entityId: null,
      metadata: {},
    });
    await expect(
      runAsRole(
        null,
        (tx) =>
          tx.$queryRaw`
          SELECT * FROM audit_private.append_audit_event(
            ${inventedHumanEvent.payload},
            ${inventedHumanEvent.signature},
            ${inventedHumanEvent.keyId}
          )
        `,
      ),
    ).rejects.toThrow();

    const unregisteredSystemEvent = signAuditEvent({
      id: randomUUID(),
      tenantId: tenantA,
      actorId: 'system:unregistered-worker',
      actorType: 'SYSTEM',
      action: 'FORGED_SYSTEM',
      entityType: 'AuditLogTest',
      entityId: null,
      metadata: {},
    });
    await expect(
      runAsRole(
        null,
        (tx) =>
          tx.$queryRaw`
          SELECT * FROM audit_private.append_audit_event(
            ${unregisteredSystemEvent.payload},
            ${unregisteredSystemEvent.signature},
            ${unregisteredSystemEvent.keyId}
          )
        `,
      ),
    ).rejects.toThrow();
  });

  it('rejects a correctly signed event whose actor differs from the signed transaction actor', async () => {
    const mismatchedEvent = signAuditEvent({
      id: randomUUID(),
      tenantId: tenantA,
      actorId: actorA2,
      actorType: 'HUMAN',
      action: 'MISMATCHED_SIGNED_ACTOR',
      entityType: 'AuditLogTest',
      entityId: null,
      metadata: {},
    });

    await expect(
      withTenant(tenantA, actorA, () =>
        tenantPrisma.execute(
          (tx) =>
            tx.$queryRaw`
            SELECT * FROM audit_private.append_audit_event(
              ${mismatchedEvent.payload},
              ${mismatchedEvent.signature},
              ${mismatchedEvent.keyId}
            )
          `,
        ),
      ),
    ).rejects.toThrow();
    await expect(
      prisma.auditLog.count({ where: { action: 'MISMATCHED_SIGNED_ACTOR' } }),
    ).resolves.toBe(0);
  });

  it('rolls back an audit event with its enclosing business transaction', async () => {
    const rollbackEventId = randomUUID();
    await expect(
      withTenant(tenantA, actorA, () =>
        tenantPrisma.execute(async () => {
          await auditService.log({
            tenantId: tenantA,
            userId: actorA,
            action: 'ROLLBACK_AUDIT_TEST',
            entityType: 'AuditLogTest',
            entityId: rollbackEventId,
          });
          throw new Error('force rollback');
        }),
      ),
    ).rejects.toThrow('force rollback');
    await expect(
      prisma.auditLog.count({ where: { entityId: rollbackEventId } }),
    ).resolves.toBe(0);
  });

  it('keeps signed tenant context transaction-local across reused connections', async () => {
    const observed: string[] = [];
    for (const [tenantId, actorId] of [
      [tenantA, actorA],
      [tenantB, actorB],
      [tenantA, actorA],
    ]) {
      await withTenant(tenantId, actorId, () =>
        tenantPrisma.execute(async (tx) => {
          const [context] = await tx.$queryRaw<
            { tenantId: string; actorId: string }[]
          >`
            SELECT audit_private.current_tenant_id() AS "tenantId",
                   audit_private.current_actor_id() AS "actorId"
          `;
          observed.push(`${context.tenantId}:${context.actorId}`);
        }),
      );
    }
    expect(observed).toEqual([
      `${tenantA}:${actorA}`,
      `${tenantB}:${actorB}`,
      `${tenantA}:${actorA}`,
    ]);
  });

  it('allows an allowlisted system actor to switch tenant scope in one transaction', async () => {
    const scopes = await runAsRole<{
      scopes: {
        tenantId: string | null;
        actorId: string | null;
        actorType: string | null;
      }[];
      eventIds: string[];
    }>(null, async (tx) => {
      const firstEventId = randomUUID();
      const secondEventId = randomUUID();
      await installSignedSystemTenantDatabaseContext(
        tx,
        tenantA,
        SYSTEM_AUDIT_ACTORS.ALERTS_SCHEDULER,
      );
      const [first] = await tx.$queryRaw<
        {
          tenantId: string | null;
          actorId: string | null;
          actorType: string | null;
        }[]
      >`
        SELECT audit_private.current_tenant_id() AS "tenantId",
               audit_private.current_actor_id() AS "actorId",
               audit_private.current_actor_type() AS "actorType"
      `;
      await auditService.log(
        {
          tenantId: tenantA,
          actor: {
            kind: 'SYSTEM',
            id: SYSTEM_AUDIT_ACTORS.ALERTS_SCHEDULER,
          },
          action: 'SYSTEM_SCOPE_SWITCH_TEST',
          entityType: 'AuditLogTest',
          entityId: firstEventId,
        },
        tx,
      );
      await installSignedSystemTenantDatabaseContext(
        tx,
        tenantB,
        SYSTEM_AUDIT_ACTORS.ALERTS_SCHEDULER,
      );
      const [second] = await tx.$queryRaw<
        {
          tenantId: string | null;
          actorId: string | null;
          actorType: string | null;
        }[]
      >`
        SELECT audit_private.current_tenant_id() AS "tenantId",
               audit_private.current_actor_id() AS "actorId",
               audit_private.current_actor_type() AS "actorType"
      `;
      await auditService.log(
        {
          tenantId: tenantB,
          actor: {
            kind: 'SYSTEM',
            id: SYSTEM_AUDIT_ACTORS.ALERTS_SCHEDULER,
          },
          action: 'SYSTEM_SCOPE_SWITCH_TEST',
          entityType: 'AuditLogTest',
          entityId: secondEventId,
        },
        tx,
      );
      return {
        scopes: [first, second],
        eventIds: [firstEventId, secondEventId],
      };
    });

    expect(scopes.scopes).toEqual([
      {
        tenantId: tenantA,
        actorId: SYSTEM_AUDIT_ACTORS.ALERTS_SCHEDULER,
        actorType: 'SYSTEM',
      },
      {
        tenantId: tenantB,
        actorId: SYSTEM_AUDIT_ACTORS.ALERTS_SCHEDULER,
        actorType: 'SYSTEM',
      },
    ]);
    const storedEvents = await prisma.auditLog.findMany({
      where: { entityId: { in: scopes.eventIds } },
      select: { id: true, tenantId: true, actorId: true, actorKind: true },
      orderBy: { tenantId: 'asc' },
    });
    expect(storedEvents).toHaveLength(2);
    expect(
      storedEvents.map(({ tenantId, actorId, actorKind }) => ({
        tenantId,
        actorId,
        actorKind,
      })),
    ).toEqual(
      expect.arrayContaining([
        {
          tenantId: tenantA,
          actorId: SYSTEM_AUDIT_ACTORS.ALERTS_SCHEDULER,
          actorKind: 'SYSTEM',
        },
        {
          tenantId: tenantB,
          actorId: SYSTEM_AUDIT_ACTORS.ALERTS_SCHEDULER,
          actorKind: 'SYSTEM',
        },
      ]),
    );
    expect(storedEvents.every(({ id }) => typeof id === 'string')).toBe(true);
  });

  it('does not allow a HUMAN context to switch tenant through the system worker path', async () => {
    await expect(
      runAsRole(null, async (tx) => {
        await installSignedTenantDatabaseContext(tx, tenantA, actorA, 'HUMAN');
        await installSignedSystemTenantDatabaseContext(
          tx,
          tenantB,
          SYSTEM_AUDIT_ACTORS.ALERTS_SCHEDULER,
        );
      }),
    ).rejects.toThrow(
      'El contexto firmado no coincide con el actor de la operación.',
    );
  });

  it('serializes concurrent duplicate appends to a single immutable event', async () => {
    const eventId = randomUUID();
    const signed = signAuditEvent({
      id: eventId,
      tenantId: tenantA,
      actorId: actorA,
      actorType: 'HUMAN',
      action: 'CONCURRENT_APPEND',
      entityType: 'AuditLogTest',
      entityId: eventId,
      metadata: { source: 'postgres-concurrency-test' },
    });
    const append = () =>
      withTenant(tenantA, actorA, () =>
        tenantPrisma.execute(
          (tx) =>
            tx.$queryRaw<{ id: string }[]>`
            SELECT * FROM audit_private.append_audit_event(
              ${signed.payload},
              ${signed.signature},
              ${signed.keyId}
            )
          `,
        ),
      );

    const [first, second] = await Promise.all([append(), append()]);
    expect(first[0]?.id).toBe(eventId);
    expect(second[0]?.id).toBe(eventId);
    await expect(
      prisma.auditLog.count({ where: { id: eventId } }),
    ).resolves.toBe(1);
  });

  function withTenant<T>(tenantId: string, userId: string, work: () => T): T {
    return tenantContext.run(
      {
        tenantId,
        userId,
        rol: UserRole.ADMIN,
        email: 'audit-log-rls-test@example.test',
      },
      work,
    );
  }

  function runAsRole<T>(
    tenantId: string | null,
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T>;
  function runAsRole<T>(
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T>;
  function runAsRole<T>(
    tenantOrWork:
      | string
      | null
      | ((tx: Prisma.TransactionClient) => Promise<T>),
    maybeWork?: (tx: Prisma.TransactionClient) => Promise<T>,
  ) {
    const tenantId = typeof tenantOrWork === 'function' ? null : tenantOrWork;
    const work = typeof tenantOrWork === 'function' ? tenantOrWork : maybeWork!;
    return prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL ROLE "' + role + '"');
      if (tenantId) {
        await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
      }
      return work(tx);
    });
  }

  async function dropTestRole() {
    await prisma.$executeRawUnsafe(
      'DO $$ BEGIN\n' +
        "  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '" +
        role +
        "') THEN\n" +
        '    REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM "' +
        role +
        '";\n' +
        '    REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA audit_private FROM "' +
        role +
        '";\n' +
        '    REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA audit_private FROM "' +
        role +
        '";\n' +
        '    REVOKE ALL PRIVILEGES ON SCHEMA audit_private FROM "' +
        role +
        '";\n' +
        '    REVOKE ALL PRIVILEGES ON SCHEMA public FROM "' +
        role +
        '";\n' +
        '    DROP ROLE "' +
        role +
        '";\n' +
        '  END IF;\n' +
        'END; $$',
    );
  }

  function tenantData(id: string, suffix: string) {
    return {
      id,
      nombre: `Tenant audit log ${suffix}`,
      nit: `9000000${suffix}`,
      digitoVerif: '1',
      razonSocial: `Tenant audit log ${suffix}`,
    };
  }

  function assertDisposableDatabase() {
    const value = process.env.DATABASE_URL;
    if (!value)
      throw new Error('DATABASE_URL is required for PostgreSQL tests.');

    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      throw new Error('PostgreSQL tests require a valid DATABASE_URL.');
    }

    const loopbackHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
    const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
    if (
      !loopbackHosts.has(parsed.hostname) ||
      !/(test|ci|disposable)/i.test(databaseName)
    ) {
      throw new Error(
        'PostgreSQL RLS tests require a loopback database whose name identifies it as test, CI, or disposable.',
      );
    }
  }

  function actorData(id: string, tenantId: string, suffix: string) {
    return {
      id,
      tenantId,
      email: `audit-log-${suffix}-${id}@example.test`,
      passwordHash: 'not-a-real-password-hash',
      nombre: 'Audit',
      apellido: 'Test',
      rol: UserRole.ADMIN,
    };
  }
});
