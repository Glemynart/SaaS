import {
  ContratoTipo,
  AlertSeverity,
  AlertStatus,
  DocumentTemplateType,
  ExpedienteCategoria,
  Prisma,
  UserRole,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { AlertsService } from '../alerts/alerts.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { TenantContextBoundary } from '../tenant-context/tenant-context.boundary';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import { ExpedienteDocsService } from './expediente-docs.service';

describe('ExpedienteDoc PostgreSQL RLS', () => {
  const suffix = randomUUID().replaceAll('-', '');
  const role = `rls_expediente_doc_${suffix}`;
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const employeeA = randomUUID();
  const employeeB = randomUUID();
  const familyA = randomUUID();
  const familyB = randomUUID();
  const documentA = randomUUID();
  const documentB = randomUUID();
  const templateA = randomUUID();
  const templateB = randomUUID();
  const generatedDocumentB = randomUUID();
  const contractB = randomUUID();
  const premiumBatchB = randomUUID();
  const premiumLineB = randomUUID();
  const alertA = randomUUID();
  const alertB = randomUUID();
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
  const getObject = jest.fn().mockResolvedValue(Buffer.from('PDF bytes'));
  const putObject = jest.fn((input: { key: string; body: Buffer }) =>
    Promise.resolve({
      key: input.key,
      size: input.body.length,
    }),
  );
  const storage = {
    getObject,
    putObject,
    deleteObject: jest.fn().mockResolvedValue(undefined),
  } as unknown as StorageService;
  const service = new ExpedienteDocsService(
    tenantPrisma,
    { log: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService,
    storage,
  );
  const alertsService = new AlertsService(tenantPrisma, {
    log: jest.fn().mockResolvedValue(undefined),
  } as unknown as AuditService);

  beforeAll(async () => {
    await prisma.$connect();
    await dropTestRole();
    await prisma.$executeRawUnsafe(
      'CREATE ROLE "' + role + '" NOLOGIN NOSUPERUSER NOBYPASSRLS',
    );
    await prisma.$executeRawUnsafe(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "expediente_docs" TO "' +
        role +
        '"',
    );
    await prisma.$executeRawUnsafe(
      'GRANT SELECT, INSERT ON TABLE "expediente_doc_families" TO "' +
        role +
        '"',
    );
    await prisma.$executeRawUnsafe(
      'GRANT SELECT ON TABLE "empleados", "sedes", "plantillas", "contratos", ' +
        '"document_templates", "generated_documents", ' +
        '"batch_document_generation_plans", "service_premium_lines", ' +
        '"service_premium_batches", ' +
        '"lotes_contrato", "perfiles_contractuales", ' +
        '"vinculos_laborales", "configuraciones_documentales_perfil", ' +
        '"users", "alerts_new" TO "' +
        role +
        '"',
    );
    await prisma.$executeRawUnsafe(
      'GRANT USAGE ON TYPE "ExpedienteCategoria" TO "' + role + '"',
    );
    await prisma.$executeRawUnsafe(
      'GRANT USAGE ON TYPE "AlertSeverity", "AlertStatus" TO "' + role + '"',
    );

    await prisma.tenant.createMany({
      data: [
        tenantData(tenantA, `${suffix.slice(0, 8)}a`),
        tenantData(tenantB, `${suffix.slice(0, 8)}b`),
      ],
    });
    await prisma.empleado.createMany({
      data: [
        employeeData(employeeA, tenantA, 'a'),
        employeeData(employeeB, tenantB, 'b'),
      ],
    });
    await prisma.documentTemplate.createMany({
      data: [
        templateData(templateA, tenantA),
        templateData(templateB, tenantB),
      ],
    });
    await prisma.generatedDocument.create({
      data: generatedDocumentData(
        generatedDocumentB,
        tenantB,
        employeeB,
        templateB,
      ),
    });
    await prisma.contrato.create({
      data: {
        id: contractB,
        tenantId: tenantB,
        empleadoId: employeeB,
        tipo: ContratoTipo.TERMINO_INDEFINIDO,
        fechaInicio: new Date('2025-01-01T00:00:00.000Z'),
        cargo: 'Analista',
        salario: 2_000_000,
      },
    });
    await prisma.servicePremiumBatch.create({
      data: {
        id: premiumBatchB,
        tenantId: tenantB,
        anio: 2026,
        semestre: 1,
        formulaVersion: 1,
        createdById: 'expediente-doc-rls-test',
      },
    });
    await prisma.servicePremiumLine.create({
      data: {
        id: premiumLineB,
        tenantId: tenantB,
        batchId: premiumBatchB,
        employeeId: employeeB,
        status: 'LISTA',
        snapshot: { source: 'rls-test' },
      },
    });
    await prisma.expedienteDocFamily.createMany({
      data: [
        familyData(familyA, tenantA, employeeA),
        familyData(familyB, tenantB, employeeB),
      ],
    });
    await prisma.expedienteDoc.createMany({
      data: [
        documentData(documentA, tenantA, employeeA, familyA),
        documentData(documentB, tenantB, employeeB, familyB),
      ],
    });
    await prisma.alert.createMany({
      data: [
        {
          id: alertA,
          tenantId: tenantA,
          employeeId: employeeA,
          expedienteDocId: documentA,
          titulo: 'Documento A',
          descripcion: 'Documento del tenant A',
          severity: AlertSeverity.INFO,
        },
        {
          id: alertB,
          tenantId: tenantB,
          employeeId: employeeB,
          expedienteDocId: documentB,
          titulo: 'Documento B',
          descripcion: 'Documento del tenant B',
          severity: AlertSeverity.INFO,
          status: AlertStatus.OPEN,
        },
      ],
    });
  }, 30000);

  afterAll(async () => {
    try {
      await prisma.alert.deleteMany({
        where: { id: { in: [alertA, alertB] } },
      });
      await prisma.expedienteDoc.deleteMany({
        where: { tenantId: { in: [tenantA, tenantB] } },
      });
      await prisma.expedienteDocFamily.deleteMany({
        where: { tenantId: { in: [tenantA, tenantB] } },
      });
      await prisma.generatedDocument.deleteMany({
        where: { id: generatedDocumentB },
      });
      await prisma.contrato.deleteMany({ where: { id: contractB } });
      await prisma.servicePremiumLine.deleteMany({
        where: { id: premiumLineB },
      });
      await prisma.servicePremiumBatch.deleteMany({
        where: { id: premiumBatchB },
      });
      await prisma.documentTemplate.deleteMany({
        where: { id: { in: [templateA, templateB] } },
      });
      await prisma.empleado.deleteMany({
        where: { id: { in: [employeeA, employeeB] } },
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

  it('forces tenant RLS and leaves document history non-deletable', async () => {
    const [families, documents] = await Promise.all([
      tableSecurity('public.expediente_doc_families'),
      tableSecurity('public.expediente_docs'),
    ]);
    const [
      familyPolicies,
      documentPolicies,
      deletePrivilege,
      roleAttributes,
      ownedTables,
    ] = await Promise.all([
      policyCommands('expediente_doc_families'),
      policyCommands('expediente_docs'),
      prisma.$queryRawUnsafe<{ canDelete: boolean }[]>(
        `SELECT has_table_privilege('${role}', 'public.expediente_docs', 'DELETE') AS "canDelete"`,
      ),
      prisma.$queryRawUnsafe<
        {
          canLogin: boolean;
          isSuperuser: boolean;
          canCreateDb: boolean;
          canCreateRole: boolean;
          bypassesRls: boolean;
        }[]
      >(
        'SELECT rolcanlogin AS "canLogin", rolsuper AS "isSuperuser", ' +
          'rolcreatedb AS "canCreateDb", rolcreaterole AS "canCreateRole", ' +
          `rolbypassrls AS "bypassesRls" FROM pg_roles WHERE rolname = '${role}'`,
      ),
      prisma.$queryRawUnsafe<{ count: number }[]>(
        'SELECT count(*)::int AS count FROM pg_class relation ' +
          'JOIN pg_roles owner_role ON owner_role.oid = relation.relowner ' +
          `WHERE owner_role.rolname = '${role}' AND relation.relkind IN ('r', 'p')`,
      ),
    ]);

    expect(families).toEqual({ rowSecurity: true, forceRowSecurity: true });
    expect(documents).toEqual({ rowSecurity: true, forceRowSecurity: true });
    expect(familyPolicies).toEqual(['INSERT', 'SELECT']);
    expect(documentPolicies).toEqual(['INSERT', 'SELECT', 'UPDATE']);
    expect(deletePrivilege).toEqual([{ canDelete: true }]);
    expect(roleAttributes).toEqual([
      {
        canLogin: false,
        isSuperuser: false,
        canCreateDb: false,
        canCreateRole: false,
        bypassesRls: false,
      },
    ]);
    expect(ownedTables).toEqual([{ count: 0 }]);
  });

  it('hides other tenants and requires tenant context for reads and downloads', async () => {
    const withoutContext = await runAsRlsRole(async (tx) => ({
      documents: await tx.expedienteDoc.findMany({
        where: { id: { in: [documentA, documentB] } },
      }),
      families: await tx.expedienteDocFamily.findMany({
        where: { id: { in: [familyA, familyB] } },
      }),
    }));
    const listedA = await withTenant(tenantA, () =>
      service.findByEmployee(tenantA, employeeA),
    );
    const scopedA = await withTenant(tenantA, () =>
      tenantPrisma.execute(async (tx) => ({
        documents: await tx.expedienteDoc.findMany({
          where: { id: { in: [documentA, documentB] } },
        }),
        families: await tx.expedienteDocFamily.findMany({
          where: { id: { in: [familyA, familyB] } },
        }),
      })),
    );
    const historyA = await withTenant(tenantA, () =>
      service.findHistory(tenantA, documentA),
    );
    const downloadedA = await withTenant(tenantA, () =>
      service.download(tenantA, 'rls-test-user', documentA),
    );

    expect(withoutContext).toEqual({ documents: [], families: [] });
    expect(listedA.docs.map(({ id }) => id)).toEqual([documentA]);
    expect(listedA.stats.total).toBe(1);
    expect(scopedA.documents.map(({ id }) => id)).toEqual([documentA]);
    expect(scopedA.families.map(({ id }) => id)).toEqual([familyA]);
    expect(historyA.family.id).toBe(familyA);
    expect(historyA.revisions.map(({ id }) => id)).toEqual([documentA]);
    expect(downloadedA.body).toEqual(Buffer.from('PDF bytes'));
    expect(getObject).toHaveBeenCalledWith(
      documentData(documentA, tenantA, employeeA, familyA).storageKey,
    );
  });

  it('keeps alert document links visible only inside the alert tenant', async () => {
    const result = await withTenant(tenantA, () =>
      alertsService.findAll(tenantA, {}),
    );

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      id: alertA,
      expedienteDoc: { id: documentA },
    });
  });

  it('blocks physical document deletion through RLS even when DELETE is granted', async () => {
    const deleted = await withTenant(tenantA, () =>
      tenantPrisma.execute((tx) =>
        tx.expedienteDoc.deleteMany({ where: { id: documentA } }),
      ),
    );
    const remaining = await prisma.expedienteDoc.count({
      where: { id: documentA },
    });

    expect(deleted.count).toBe(0);
    expect(remaining).toBe(1);
  });

  it('allows tenant-scoped manual document creation and rejects cross-tenant links', async () => {
    const created = await withTenant(tenantA, () =>
      service.uploadManual(
        tenantA,
        'rls-test-user',
        'rls-test@example.test',
        employeeA,
        ExpedienteCategoria.OTRO,
        { originalname: 'demo.pdf', buffer: Buffer.from('%PDF-1.7\ndemo') },
      ),
    );
    expect(created.tenantId).toBe(tenantA);

    await expect(
      withTenant(tenantA, () =>
        tenantPrisma.execute((tx) =>
          tx.expedienteDocFamily.create({
            data: familyData(randomUUID(), tenantA, employeeB),
          }),
        ),
      ),
    ).rejects.toThrow();

    await expect(
      withTenant(tenantA, () =>
        tenantPrisma.execute((tx) =>
          tx.expedienteDoc.create({
            data: documentData(randomUUID(), tenantA, employeeA, familyB),
          }),
        ),
      ),
    ).rejects.toThrow();

    await expect(
      withTenant(tenantA, () =>
        tenantPrisma.execute((tx) =>
          tx.expedienteDoc.create({
            data: {
              ...documentData(randomUUID(), tenantA, employeeA, familyA),
              reemplazaId: documentB,
            },
          }),
        ),
      ),
    ).rejects.toThrow();

    await expect(
      withTenant(tenantA, () =>
        tenantPrisma.execute((tx) =>
          tx.expedienteDoc.create({
            data: {
              ...documentData(randomUUID(), tenantA, employeeA, familyA),
              generatedDocumentId: generatedDocumentB,
            },
          }),
        ),
      ),
    ).rejects.toThrow();

    await expect(
      withTenant(tenantA, () =>
        tenantPrisma.execute((tx) =>
          tx.expedienteDoc.create({
            data: {
              ...documentData(randomUUID(), tenantA, employeeA, familyA),
              contratoId: contractB,
            },
          }),
        ),
      ),
    ).rejects.toThrow();

    await expect(
      withTenant(tenantA, () =>
        tenantPrisma.execute((tx) =>
          tx.expedienteDoc.create({
            data: {
              ...documentData(randomUUID(), tenantA, employeeA, familyA),
              servicePremiumLineId: premiumLineB,
            },
          }),
        ),
      ),
    ).rejects.toThrow();

    await expect(
      withTenant(tenantA, () =>
        tenantPrisma.execute((tx) =>
          tx.expedienteDoc.update({
            where: { id: documentA },
            data: { reemplazaId: documentB },
          }),
        ),
      ),
    ).rejects.toThrow();

    await expect(
      withTenant(tenantA, () =>
        tenantPrisma.execute((tx) =>
          tx.expedienteDoc.update({
            where: { id: documentA },
            data: { tenantId: tenantB },
          }),
        ),
      ),
    ).rejects.toThrow();
  }, 30000);

  function withTenant<T>(tenantId: string, work: () => Promise<T>) {
    return tenantContext.run(
      {
        tenantId,
        userId: 'expediente-doc-rls-test-user',
        rol: UserRole.ADMIN,
        email: 'expediente-doc-rls-test@example.test',
      },
      work,
    );
  }

  function runAsRlsRole<T>(work: (tx: Prisma.TransactionClient) => Promise<T>) {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL ROLE "' + role + '"');
      return work(tx);
    });
  }

  async function tableSecurity(table: string) {
    const [result] = await prisma.$queryRawUnsafe<
      { rowSecurity: boolean; forceRowSecurity: boolean }[]
    >(
      'SELECT relrowsecurity AS "rowSecurity", relforcerowsecurity AS "forceRowSecurity" ' +
        `FROM pg_class WHERE oid = '${table}'::regclass`,
    );
    return result;
  }

  async function policyCommands(table: string) {
    const policies = await prisma.$queryRawUnsafe<{ command: string }[]>(
      'SELECT cmd AS command FROM pg_policies ' +
        `WHERE schemaname = 'public' AND tablename = '${table}' ORDER BY cmd`,
    );
    return policies.map(({ command }) => command);
  }

  async function dropTestRole() {
    await prisma.$executeRawUnsafe(
      'DO $$ BEGIN\n' +
        `  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${role}') THEN\n` +
        `    REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM "${role}";\n` +
        `    REVOKE USAGE ON TYPE "ExpedienteCategoria" FROM "${role}";\n` +
        `    REVOKE USAGE ON TYPE "AlertSeverity", "AlertStatus" FROM "${role}";\n` +
        `    DROP ROLE "${role}";\n` +
        '  END IF;\n' +
        'END; $$',
    );
  }

  function tenantData(id: string, suffix: string) {
    return {
      id,
      nombre: `Tenant expediente docs ${suffix}`,
      nit: `9000000${suffix}`,
      digitoVerif: '1',
      razonSocial: `Tenant expediente docs ${suffix}`,
    };
  }

  function employeeData(id: string, tenantId: string, suffix: string) {
    return {
      id,
      tenantId,
      cedula: `expediente-doc-rls-${suffix}-${id}`,
      primerNombre: 'Empleado',
      primerApellido: 'Prueba',
      cargo: 'Analista',
      salario: 2_000_000,
      fechaIngreso: new Date('2025-01-01T00:00:00.000Z'),
    };
  }

  function familyData(id: string, tenantId: string, employeeId: string) {
    return {
      id,
      tenantId,
      empleadoId: employeeId,
      categoria: ExpedienteCategoria.OTRO,
      nombre: `Familia ${id}`,
    };
  }

  function documentData(
    id: string,
    tenantId: string,
    employeeId: string,
    familyId: string,
  ) {
    return {
      id,
      tenantId,
      empleadoId: employeeId,
      familiaId: familyId,
      categoria: ExpedienteCategoria.OTRO,
      nombre: `Documento ${id}`,
      version: 1,
      vigente: true,
      storageKey: `${tenantId}/expediente/${employeeId}/OTRO/${id}.pdf`,
      mimeType: 'application/pdf',
      tamanoBytes: 8,
    };
  }

  function templateData(id: string, tenantId: string) {
    return {
      id,
      tenantId,
      nombre: 'Certificación de prueba',
      tipo: DocumentTemplateType.CERTIFICATION,
      contenido: 'Certifica {{NOMBRE_COMPLETO}}',
    };
  }

  function generatedDocumentData(
    id: string,
    tenantId: string,
    employeeId: string,
    templateId: string,
  ) {
    return {
      id,
      tenantId,
      employeeId,
      templateId,
      nombre: 'Documento generado de prueba',
      contenidoFinal: 'Contenido de prueba',
      tipo: DocumentTemplateType.CERTIFICATION,
    };
  }
});
