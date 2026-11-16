import { Prisma, UserRole } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AuditService } from './audit.service';
import { SYSTEM_AUDIT_ACTORS } from './audit-actor';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextBoundary } from '../tenant-context/tenant-context.boundary';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';

describe('AuditLog PostgreSQL RLS', () => {
  const suffix = randomUUID().replaceAll('-', '');
  const role = `rls_audit_log_${suffix}`;
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const actorA = randomUUID();
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
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "audit_logs" TO "' +
        role +
        '"',
    );
    await prisma.$executeRawUnsafe(
      'GRANT SELECT ON TABLE "users" TO "' + role + '"',
    );
    await prisma.tenant.createMany({
      data: [tenantData(tenantA, 'a'), tenantData(tenantB, 'b')],
    });
    await prisma.user.createMany({
      data: [actorData(actorA, tenantA, 'a'), actorData(actorB, tenantB, 'b')],
    });
  }, 30000);

  afterAll(async () => {
    if (!connected) return;
    try {
      await prisma.auditLog.deleteMany({
        where: { tenantId: { in: [tenantA, tenantB] } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: [actorA, actorB] } },
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
      { canTruncate: boolean; canUpdate: boolean; canDelete: boolean }[]
    >(
      `SELECT has_table_privilege('${role}', 'public.audit_logs', 'TRUNCATE') AS "canTruncate", ` +
        `has_table_privilege('${role}', 'public.audit_logs', 'UPDATE') AS "canUpdate", ` +
        `has_table_privilege('${role}', 'public.audit_logs', 'DELETE') AS "canDelete"`,
    );
    const [roleAttributes] = await prisma.$queryRawUnsafe<
      { superuser: boolean; bypassRls: boolean; ownsTable: boolean }[]
    >(
      `SELECT role.rolsuper AS superuser, role.rolbypassrls AS "bypassRls", ` +
        `relation.relowner = role.oid AS "ownsTable" ` +
        `FROM pg_roles AS role ` +
        `CROSS JOIN pg_class AS relation ` +
        `WHERE role.rolname = '${role}' ` +
        `AND relation.oid = 'public.audit_logs'::regclass`,
    );

    expect(table).toEqual({ rowSecurity: true, forceRowSecurity: true });
    expect(policies).toEqual([
      { command: 'INSERT', policy: 'audit_logs_tenant_insert' },
      { command: 'SELECT', policy: 'audit_logs_tenant_select' },
    ]);
    expect(privileges).toEqual({
      canTruncate: false,
      canUpdate: true,
      canDelete: true,
    });
    expect(roleAttributes).toEqual({
      superuser: false,
      bypassRls: false,
      ownsTable: false,
    });
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

    const noContext = await runAsRole((tx) =>
      tx.auditLog.findMany({ where: { entityId: { in: [auditA, auditB] } } }),
    );
    const onlyTenantA = await runAsRole(tenantA, (tx) =>
      tx.auditLog.findMany({ where: { entityId: { in: [auditA, auditB] } } }),
    );

    expect(noContext).toEqual([]);
    expect(
      onlyTenantA.map(({ entityId, actorId, actorKind }) => ({
        entityId,
        actorId,
        actorKind,
      })),
    ).toEqual([{ entityId: auditA, actorId: actorA, actorKind: 'HUMAN' }]);
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

    const visibleToTenantA = await runAsRole(tenantA, (tx) =>
      tx.auditLog.findFirst({
        where: {
          entityId: actorA,
          action: 'PASSWORD_RESET_COMPLETED',
        },
      }),
    );
    const visibleToTenantB = await runAsRole(tenantB, (tx) =>
      tx.auditLog.findFirst({
        where: {
          entityId: actorA,
          action: 'PASSWORD_RESET_COMPLETED',
        },
      }),
    );

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
    expect(visibleToTenantB).toBeNull();
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

    const stored = await runAsRole(tenantA, (tx) =>
      tx.auditLog.findFirst({ where: { entityId: invitationEventId } }),
    );
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

  it('rejects cross-tenant inserts and prevents runtime updates and deletes', async () => {
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

    await withTenant(tenantA, actorA, async () => {
      const [updated, deleted] = await runAsRole(tenantA, async (tx) =>
        Promise.all([
          tx.auditLog.updateMany({
            where: { entityId: auditA },
            data: { action: 'MUTATED' },
          }),
          tx.auditLog.deleteMany({ where: { entityId: auditA } }),
        ]),
      );

      expect(updated.count).toBe(0);
      expect(deleted.count).toBe(0);
    });

    const unchanged = await prisma.auditLog.findFirstOrThrow({
      where: { entityId: auditA },
      select: { action: true },
    });
    expect(unchanged.action).toBe('AUDIT_TEST_A');
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
