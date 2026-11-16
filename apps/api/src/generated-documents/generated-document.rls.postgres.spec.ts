import { DocumentTemplateType, Prisma, UserRole } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { ExpedienteDocsService } from '../expediente-docs/expediente-docs.service';
import { PdfRenderService } from '../pdf-render/pdf-render.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { TenantContextBoundary } from '../tenant-context/tenant-context.boundary';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import { GeneratedDocumentsService } from './generated-documents.service';

describe('GeneratedDocument PostgreSQL RLS', () => {
  const suffix = randomUUID().replaceAll('-', '');
  const role = `rls_generated_document_${suffix}`;
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const employeeA = randomUUID();
  const employeeB = randomUUID();
  const templateA = randomUUID();
  const templateB = randomUUID();
  const documentA = randomUUID();
  const documentB = randomUUID();
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
  const service = new GeneratedDocumentsService(
    prisma,
    tenantPrisma,
    { publishGeneratedDocument: jest.fn() } as unknown as ExpedienteDocsService,
    { log: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService,
    {} as StorageService,
    {} as PdfRenderService,
  );

  beforeAll(async () => {
    await prisma.$connect();
    await dropTestRole();
    await prisma.$executeRawUnsafe(
      'CREATE ROLE "' + role + '" NOLOGIN NOSUPERUSER NOBYPASSRLS',
    );
    await prisma.$executeRawUnsafe(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "generated_documents" TO "' +
        role +
        '"',
    );
    await prisma.$executeRawUnsafe(
      'GRANT SELECT ON TABLE "empleados", "document_templates", "contratos", ' +
        '"batch_document_generation_plans", "sedes", "plantillas", ' +
        '"lotes_contrato", "perfiles_contractuales", ' +
        '"vinculos_laborales", "configuraciones_documentales_perfil", ' +
        '"users" TO "' +
        role +
        '"',
    );
    await prisma.$executeRawUnsafe(
      'GRANT USAGE ON TYPE "DocumentTemplateType", "GeneratedDocumentStatus" TO "' +
        role +
        '"',
    );

    await prisma.tenant.createMany({
      data: [tenantData(tenantA, '91'), tenantData(tenantB, '92')],
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
    await prisma.generatedDocument.createMany({
      data: [
        documentData(documentA, tenantA, employeeA, templateA),
        documentData(documentB, tenantB, employeeB, templateB),
      ],
    });
  }, 30000);

  afterAll(async () => {
    try {
      await prisma.generatedDocument.deleteMany({
        where: { tenantId: { in: [tenantA, tenantB] } },
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

  it('enables and forces RLS with tenant-scoped CRUD policies', async () => {
    const [table] = await prisma.$queryRawUnsafe<
      { rowSecurity: boolean; forceRowSecurity: boolean }[]
    >(
      'SELECT relrowsecurity AS "rowSecurity", ' +
        'relforcerowsecurity AS "forceRowSecurity" ' +
        "FROM pg_class WHERE oid = 'public.generated_documents'::regclass",
    );
    const policies = await prisma.$queryRawUnsafe<
      { command: string; policy: string }[]
    >(
      'SELECT cmd AS command, policyname AS policy FROM pg_policies ' +
        "WHERE schemaname = 'public' AND tablename = 'generated_documents' " +
        'ORDER BY cmd',
    );

    expect(table).toEqual({ rowSecurity: true, forceRowSecurity: true });
    expect(policies).toEqual([
      { command: 'ALL', policy: 'generated_documents_tenant_isolation' },
    ]);
  });

  it('hides other tenants and rows without context from direct database reads', async () => {
    const withoutContext = await runAsRlsRole((tx) =>
      tx.generatedDocument.findMany({
        where: { id: { in: [documentA, documentB] } },
      }),
    );
    const listedA = await withTenant(tenantA, () =>
      service.findAll(tenantA, { page: 1, limit: 10 }),
    );

    expect(withoutContext).toEqual([]);
    expect(listedA.data.map(({ id }) => id)).toEqual([documentA]);
  });

  it('creates through the API service under tenant context and blocks cross-tenant references', async () => {
    const created = await withTenant(tenantA, () =>
      service.generate(tenantA, 'generated-document-test-user', {
        employeeId: employeeA,
        templateId: templateA,
        nombre: 'Certificación de prueba',
      }),
    );
    expect(created.tenantId).toBe(tenantA);

    await expect(
      withTenant(tenantA, () =>
        tenantPrisma.execute((tx) =>
          tx.generatedDocument.create({
            data: {
              ...documentData(randomUUID(), tenantA, employeeB, templateA),
            },
          }),
        ),
      ),
    ).rejects.toThrow();

    await expect(
      withTenant(tenantA, () =>
        tenantPrisma.execute((tx) =>
          tx.generatedDocument.create({
            data: {
              ...documentData(randomUUID(), tenantA, employeeA, templateB),
            },
          }),
        ),
      ),
    ).rejects.toThrow();

    await expect(
      withTenant(tenantA, () =>
        tenantPrisma.execute((tx) =>
          tx.generatedDocument.update({
            where: { id: created.id },
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
        userId: 'generated-document-rls-test-user',
        rol: UserRole.ADMIN,
        email: 'generated-document-rls-test@example.test',
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

  async function dropTestRole() {
    await prisma.$executeRawUnsafe(
      'DO $$ BEGIN\n' +
        "  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '" +
        role +
        "') THEN\n" +
        '    REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM "' +
        role +
        '";\n' +
        '    REVOKE USAGE ON TYPE "DocumentTemplateType", ' +
        '"GeneratedDocumentStatus" FROM "' +
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
      nombre: `Tenant generated document ${suffix}`,
      nit: `9000000${suffix}`,
      digitoVerif: '1',
      razonSocial: `Tenant generated document ${suffix}`,
    };
  }

  function employeeData(id: string, tenantId: string, suffix: string) {
    return {
      id,
      tenantId,
      cedula: `generated-document-rls-${suffix}-${id}`,
      primerNombre: 'Empleado',
      primerApellido: 'Prueba',
      cargo: 'Analista',
      salario: 2_000_000,
      fechaIngreso: new Date('2025-01-01T00:00:00.000Z'),
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

  function documentData(
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
      nombre: 'Documento de prueba',
      contenidoFinal: 'Contenido de prueba',
      tipo: DocumentTemplateType.CERTIFICATION,
    };
  }
});
