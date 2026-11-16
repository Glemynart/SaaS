import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextBoundary } from '../tenant-context/tenant-context.boundary';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import {
  TenantPrismaClient,
  TenantPrismaService,
} from '../tenant-prisma/tenant-prisma.service';

describe('site and labor metadata PostgreSQL RLS', () => {
  const suffix = randomUUID();
  const role = `rls_site_metadata_${suffix.replaceAll('-', '')}`;
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const siteA = randomUUID();
  const siteB = randomUUID();
  const employeeA = randomUUID();
  const employeeA2 = randomUUID();
  const employeeB = randomUUID();
  const profileA = randomUUID();
  const profileB = randomUUID();
  const templateA = randomUUID();
  const templateB = randomUUID();
  const relationshipA = randomUUID();
  const relationshipB = randomUUID();
  const configurationA = randomUUID();
  const configurationB = randomUUID();
  const userA = randomUUID();
  const userB = randomUUID();
  const batchA = randomUUID();
  const batchB = randomUUID();
  const planA = randomUUID();
  const planB = randomUUID();
  const exclusionA = randomUUID();
  const exclusionB = randomUUID();
  const newTemplateId = randomUUID();
  const newSiteId = randomUUID();
  const newProfileId = randomUUID();
  const newRelationshipId = randomUUID();
  const newConfigurationId = randomUUID();
  const newBatchId = randomUUID();
  const newPlanId = randomUUID();
  const newExclusionId = randomUUID();
  const tenantContext = new TenantContextService();
  const prisma = new PrismaService();
  const tenantPrisma = new TenantPrismaService(
    {
      $transaction: <T>(
        work: (tx: Prisma.TransactionClient) => Promise<T>,
        options?: {
          maxWait?: number;
          timeout?: number;
          isolationLevel?: Prisma.TransactionIsolationLevel;
        },
      ) =>
        prisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(`SET LOCAL ROLE "${role}"`);
          return work(tx);
        }, options),
    } as unknown as PrismaService,
    new TenantContextBoundary(tenantContext),
  );

  beforeAll(async () => {
    await prisma.$connect();
    await dropTestRole();
    await prisma.$executeRawUnsafe(
      `CREATE ROLE "${role}" NOLOGIN NOSUPERUSER NOBYPASSRLS`,
    );
    await prisma.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO "${role}"`);
    await prisma.$executeRawUnsafe(
      `GRANT SELECT ON ALL TABLES IN SCHEMA public TO "${role}"`,
    );
    await prisma.$executeRawUnsafe(
      `REVOKE ALL PRIVILEGES ON TABLE "_prisma_migrations" FROM "${role}"`,
    );
    await prisma.$executeRawUnsafe(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE ` +
        `"sedes", "perfiles_contractuales", "vinculos_laborales", ` +
        `"configuraciones_documentales_perfil", ` +
        `"lotes_contrato", "batch_document_generation_plans", ` +
        `"batch_document_generation_exclusions", "document_templates" ` +
        `TO "${role}"`,
    );

    await prisma.tenant.createMany({
      data: [
        tenantData(tenantA, `91${suffix.slice(0, 7)}`),
        tenantData(tenantB, `92${suffix.slice(0, 7)}`),
      ],
    });
    await prisma.sede.createMany({
      data: [
        siteData(siteA, tenantA, 'Sede A'),
        siteData(siteB, tenantB, 'Sede B'),
      ],
    });
    await prisma.empleado.createMany({
      data: [
        employeeData(employeeA, tenantA, `A-${suffix}`, siteA),
        employeeData(employeeA2, tenantA, `A2-${suffix}`, siteA),
        employeeData(employeeB, tenantB, `B-${suffix}`, siteB),
      ],
    });
    await prisma.perfilContractual.createMany({
      data: [
        profileData(profileA, tenantA, 'PROFILE-A'),
        profileData(profileB, tenantB, 'PROFILE-B'),
      ],
    });
    await prisma.documentTemplate.createMany({
      data: [
        templateData(templateA, tenantA, 'Template A'),
        templateData(templateB, tenantB, 'Template B'),
      ],
    });
    await prisma.user.createMany({
      data: [userData(userA, tenantA), userData(userB, tenantB)],
    });
    await prisma.loteContrato.createMany({
      data: [
        {
          id: batchA,
          tenantId: tenantA,
          total: 1,
          documentTemplateId: templateA,
          sedeId: siteA,
          creadoPorId: userA,
        },
        {
          id: batchB,
          tenantId: tenantB,
          total: 1,
          documentTemplateId: templateB,
          sedeId: siteB,
          creadoPorId: userB,
        },
      ],
    });
    await prisma.vinculoLaboral.createMany({
      data: [
        relationshipData(relationshipA, tenantA, employeeA, profileA),
        relationshipData(relationshipB, tenantB, employeeB, profileB),
      ],
    });
    await prisma.configuracionDocumentalPerfil.createMany({
      data: [
        configurationData(configurationA, tenantA, profileA, templateA),
        configurationData(configurationB, tenantB, profileB, templateB),
      ],
    });
    await prisma.batchDocumentGenerationPlan.createMany({
      data: [
        planData(
          planA,
          tenantA,
          batchA,
          employeeA,
          relationshipA,
          profileA,
          configurationA,
          templateA,
        ),
        planData(
          planB,
          tenantB,
          batchB,
          employeeB,
          relationshipB,
          profileB,
          configurationB,
          templateB,
        ),
      ],
    });
    await prisma.batchDocumentGenerationExclusion.createMany({
      data: [
        exclusionData(exclusionA, tenantA, batchA),
        exclusionData(exclusionB, tenantB, batchB),
      ],
    });
  }, 30000);

  afterAll(async () => {
    try {
      await prisma.batchDocumentGenerationPlan.deleteMany({
        where: { id: { in: [planA, planB, newPlanId] } },
      });
      await prisma.configuracionDocumentalPerfil.deleteMany({
        where: {
          id: {
            in: [configurationA, configurationB, newConfigurationId],
          },
        },
      });
      await prisma.batchDocumentGenerationExclusion.deleteMany({
        where: { id: { in: [exclusionA, exclusionB, newExclusionId] } },
      });
      await prisma.loteContrato.deleteMany({
        where: { id: { in: [batchA, batchB, newBatchId] } },
      });
      await prisma.vinculoLaboral.deleteMany({
        where: {
          id: { in: [relationshipA, relationshipB, newRelationshipId] },
        },
      });
      await prisma.documentTemplate.deleteMany({
        where: { id: { in: [templateA, templateB, newTemplateId] } },
      });
      await prisma.perfilContractual.deleteMany({
        where: { id: { in: [profileA, profileB, newProfileId] } },
      });
      await prisma.empleado.deleteMany({
        where: { id: { in: [employeeA, employeeA2, employeeB] } },
      });
      await prisma.sede.deleteMany({
        where: { id: { in: [siteA, siteB, newSiteId] } },
      });
      await prisma.user.deleteMany({ where: { id: { in: [userA, userB] } } });
      await prisma.tenant.deleteMany({
        where: { id: { in: [tenantA, tenantB] } },
      });
      await dropTestRole();
    } finally {
      await prisma.$disconnect();
    }
  }, 30000);

  it('enables and forces tenant RLS without granting physical deletion', async () => {
    const protectedTables = await prisma.$queryRaw<
      { tableName: string; rowSecurity: boolean; forceRowSecurity: boolean }[]
    >`
      SELECT relname AS "tableName",
             relrowsecurity AS "rowSecurity",
             relforcerowsecurity AS "forceRowSecurity"
      FROM pg_class
      WHERE oid = ANY(ARRAY[
        'public.sedes'::regclass,
        'public.perfiles_contractuales'::regclass,
        'public.vinculos_laborales'::regclass,
        'public.configuraciones_documentales_perfil'::regclass,
        'public.lotes_contrato'::regclass,
        'public.batch_document_generation_plans'::regclass,
        'public.batch_document_generation_exclusions'::regclass,
        'public.document_templates'::regclass
      ])
      ORDER BY relname COLLATE "C"
    `;
    const roles = await prisma.$queryRawUnsafe<
      { canLogin: boolean; superuser: boolean; bypassRls: boolean }[]
    >(
      `SELECT rolcanlogin AS "canLogin", rolsuper AS "superuser", ` +
        `rolbypassrls AS "bypassRls" FROM pg_roles WHERE rolname = $1`,
      role,
    );

    expect(protectedTables).toEqual(
      [
        'batch_document_generation_exclusions',
        'batch_document_generation_plans',
        'configuraciones_documentales_perfil',
        'document_templates',
        'lotes_contrato',
        'perfiles_contractuales',
        'sedes',
        'vinculos_laborales',
      ].map((tableName) => ({
        tableName,
        rowSecurity: true,
        forceRowSecurity: true,
      })),
    );
    expect(roles).toEqual([
      { canLogin: false, superuser: false, bypassRls: false },
    ]);
  });

  it('shows only the active tenant and fails closed without tenant context', async () => {
    const tenantAResult = await withTenant(tenantA, () =>
      readAllProtectedRows(),
    );
    const tenantBResult = await withTenant(tenantB, () =>
      readAllProtectedRows(),
    );
    const noContext = await runAsRlsRole((client) => readRows(client));

    expect(tenantAResult).toEqual({
      sites: [siteA],
      profiles: [profileA],
      relationships: [relationshipA],
      configurations: [configurationA],
      exclusions: [exclusionA],
      templates: [templateA],
      batches: [batchA],
      plans: [planA],
    });
    expect(tenantBResult).toEqual({
      sites: [siteB],
      profiles: [profileB],
      relationships: [relationshipB],
      configurations: [configurationB],
      exclusions: [exclusionB],
      templates: [templateB],
      batches: [batchB],
      plans: [planB],
    });
    expect(noContext).toEqual({
      sites: [],
      profiles: [],
      relationships: [],
      configurations: [],
      exclusions: [],
      templates: [],
      batches: [],
      plans: [],
    });
  });

  it('allows tenant-owned writes and rejects cross-tenant ownership or references', async () => {
    await withTenant(tenantA, () =>
      tenantPrisma.execute(async (client, { tenantId }) => {
        await client.sede.create({
          data: siteData(newSiteId, tenantId, 'Sede nueva A'),
        });
        await client.sede.update({
          where: { id: siteA },
          data: { nombre: 'Sede A actualizada' },
        });
        await client.perfilContractual.create({
          data: profileData(newProfileId, tenantId, 'PROFILE-NEW-A'),
        });
        await client.vinculoLaboral.create({
          data: relationshipData(
            newRelationshipId,
            tenantId,
            employeeA2,
            newProfileId,
          ),
        });
        await client.configuracionDocumentalPerfil.create({
          data: configurationData(
            newConfigurationId,
            tenantId,
            newProfileId,
            templateA,
          ),
        });
        await client.batchDocumentGenerationExclusion.create({
          data: exclusionData(newExclusionId, tenantId, batchA),
        });
        await client.loteContrato.create({
          data: {
            id: newBatchId,
            tenantId,
            total: 1,
            documentTemplateId: templateA,
            sedeId: siteA,
            creadoPorId: userA,
          },
        });
        await client.batchDocumentGenerationPlan.create({
          data: planData(
            newPlanId,
            tenantId,
            newBatchId,
            employeeA,
            relationshipA,
            profileA,
            configurationA,
            templateA,
          ),
        });
        await client.batchDocumentGenerationPlan.update({
          where: { id: newPlanId },
          data: { estado: 'CONSUMIDO' },
        });
        await client.documentTemplate.create({
          data: templateData(newTemplateId, tenantId, 'Template nueva A'),
        });
        await client.documentTemplate.update({
          where: { id: templateA },
          data: { nombre: 'Template A actualizada' },
        });
      }),
    );

    await expect(
      withTenant(tenantA, () =>
        tenantPrisma.execute((client) =>
          client.sede.updateMany({
            where: { id: siteA },
            data: { tenantId: tenantB },
          }),
        ),
      ),
    ).rejects.toThrow();
    await expect(
      withTenant(tenantA, () =>
        tenantPrisma.execute((client, { tenantId }) =>
          client.loteContrato.create({
            data: {
              id: randomUUID(),
              tenantId,
              total: 1,
              documentTemplateId: templateA,
              sedeId: siteB,
              creadoPorId: userA,
            },
          }),
        ),
      ),
    ).rejects.toThrow();
    await expect(
      withTenant(tenantA, () =>
        tenantPrisma.execute((client, { tenantId }) =>
          client.loteContrato.create({
            data: {
              id: randomUUID(),
              tenantId,
              total: 1,
              documentTemplateId: templateA,
              sedeId: siteA,
              creadoPorId: userB,
            },
          }),
        ),
      ),
    ).rejects.toThrow();
    for (const override of [
      { loteId: batchB },
      { empleadoId: employeeB },
      { vinculoLaboralId: relationshipB },
      { perfilContractualId: profileB },
      { configuracionDocumentalPerfilId: configurationB },
      { plantillaId: templateB },
    ]) {
      await expect(
        withTenant(tenantA, () =>
          tenantPrisma.execute((client) =>
            client.batchDocumentGenerationPlan.create({
              data: {
                ...planData(
                  randomUUID(),
                  tenantA,
                  batchA,
                  employeeA,
                  relationshipA,
                  profileA,
                  configurationA,
                  templateA,
                ),
                ...override,
              },
            }),
          ),
        ),
      ).rejects.toThrow();
    }
    await expect(
      withTenant(tenantA, () =>
        tenantPrisma.execute((client, { tenantId }) =>
          client.batchDocumentGenerationExclusion.create({
            data: exclusionData(randomUUID(), tenantId, batchB),
          }),
        ),
      ),
    ).rejects.toThrow();
    await expect(
      withTenant(tenantA, () =>
        tenantPrisma.execute((client) =>
          client.documentTemplate.updateMany({
            where: { id: templateA },
            data: { tenantId: tenantB },
          }),
        ),
      ),
    ).rejects.toThrow();
    await expect(
      withTenant(tenantA, () =>
        tenantPrisma.execute((client) =>
          client.documentTemplate.create({
            data: templateData(randomUUID(), tenantB, 'Template ajena'),
          }),
        ),
      ),
    ).rejects.toThrow();
    await expect(
      withTenant(tenantA, () =>
        tenantPrisma.execute((client, { tenantId }) =>
          client.vinculoLaboral.create({
            data: relationshipData(randomUUID(), tenantId, employeeB, profileA),
          }),
        ),
      ),
    ).rejects.toThrow();
    await expect(
      withTenant(tenantA, () =>
        tenantPrisma.execute((client, { tenantId }) =>
          client.configuracionDocumentalPerfil.create({
            data: configurationData(
              randomUUID(),
              tenantId,
              profileA,
              templateB,
            ),
          }),
        ),
      ),
    ).rejects.toThrow();

    await withTenant(tenantB, async () => {
      const site = await tenantPrisma.execute((client) =>
        client.sede.findUnique({ where: { id: newSiteId } }),
      );
      expect(site).toBeNull();
    });
  });

  it('does not allow physical deletes even when SQL DELETE is granted', async () => {
    await withTenant(tenantA, () =>
      tenantPrisma.execute(async (client) => {
        const [
          sites,
          profiles,
          relationships,
          configurations,
          exclusions,
          templates,
          batches,
          plans,
        ] = await Promise.all([
          client.sede.deleteMany({ where: { id: siteA } }),
          client.perfilContractual.deleteMany({ where: { id: profileA } }),
          client.vinculoLaboral.deleteMany({ where: { id: relationshipA } }),
          client.configuracionDocumentalPerfil.deleteMany({
            where: { id: configurationA },
          }),
          client.batchDocumentGenerationExclusion.deleteMany({
            where: { id: exclusionA },
          }),
          client.documentTemplate.deleteMany({ where: { id: templateA } }),
          client.loteContrato.deleteMany({ where: { id: batchA } }),
          client.batchDocumentGenerationPlan.deleteMany({
            where: { id: planA },
          }),
        ]);
        expect(sites.count).toBe(0);
        expect(profiles.count).toBe(0);
        expect(relationships.count).toBe(0);
        expect(configurations.count).toBe(0);
        expect(exclusions.count).toBe(0);
        expect(templates.count).toBe(0);
        expect(batches.count).toBe(0);
        expect(plans.count).toBe(0);
      }),
    );
  });

  async function readAllProtectedRows() {
    return tenantPrisma.execute((client) => readRows(client));
  }

  function readRows(client: TenantPrismaClient) {
    return Promise.all([
      client.sede.findMany({
        where: { id: { in: [siteA, siteB] } },
        select: { id: true },
        orderBy: { id: 'asc' },
      }),
      client.perfilContractual.findMany({
        where: { id: { in: [profileA, profileB] } },
        select: { id: true },
        orderBy: { id: 'asc' },
      }),
      client.vinculoLaboral.findMany({
        where: { id: { in: [relationshipA, relationshipB] } },
        select: { id: true },
        orderBy: { id: 'asc' },
      }),
      client.configuracionDocumentalPerfil.findMany({
        where: { id: { in: [configurationA, configurationB] } },
        select: { id: true },
        orderBy: { id: 'asc' },
      }),
      client.batchDocumentGenerationExclusion.findMany({
        where: { id: { in: [exclusionA, exclusionB] } },
        select: { id: true },
        orderBy: { id: 'asc' },
      }),
      client.documentTemplate.findMany({
        where: { id: { in: [templateA, templateB] } },
        select: { id: true },
        orderBy: { id: 'asc' },
      }),
      client.loteContrato.findMany({
        where: { id: { in: [batchA, batchB] } },
        select: { id: true },
        orderBy: { id: 'asc' },
      }),
      client.batchDocumentGenerationPlan.findMany({
        where: { id: { in: [planA, planB] } },
        select: { id: true },
        orderBy: { id: 'asc' },
      }),
    ]).then(
      ([
        sites,
        profiles,
        relationships,
        configurations,
        exclusions,
        templates,
        batches,
        plans,
      ]) => ({
        sites: sites.map(({ id }) => id),
        profiles: profiles.map(({ id }) => id),
        relationships: relationships.map(({ id }) => id),
        configurations: configurations.map(({ id }) => id),
        exclusions: exclusions.map(({ id }) => id),
        templates: templates.map(({ id }) => id),
        batches: batches.map(({ id }) => id),
        plans: plans.map(({ id }) => id),
      }),
    );
  }

  function withTenant<T>(tenantId: string, work: () => Promise<T>): Promise<T> {
    return tenantContext.run(
      {
        tenantId,
        userId: `user-${tenantId}`,
        rol: 'ADMIN',
        email: `${tenantId}@example.test`,
      },
      work,
    );
  }

  function runAsRlsRole<T>(
    work: (client: TenantPrismaClient) => Promise<T>,
  ): Promise<T> {
    return prisma.$transaction(async (client) => {
      await client.$executeRawUnsafe(`SET LOCAL ROLE "${role}"`);
      return work(client);
    });
  }

  async function dropTestRole(): Promise<void> {
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${role}') THEN
          REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM "${role}";
          REVOKE ALL PRIVILEGES ON SCHEMA public FROM "${role}";
          DROP ROLE "${role}";
        END IF;
      END
      $$
    `);
  }

  function tenantData(id: string, nit: string) {
    return {
      id,
      nombre: `Tenant ${nit}`,
      nit,
      digitoVerif: '1',
      razonSocial: `Tenant ${nit} SAS`,
    };
  }

  function siteData(id: string, tenantId: string, nombre: string) {
    return { id, tenantId, nombre, activo: true };
  }

  function employeeData(
    id: string,
    tenantId: string,
    cedula: string,
    sedeId: string,
  ) {
    return {
      id,
      tenantId,
      cedula,
      primerNombre: 'Empleado',
      primerApellido: 'Prueba',
      cargo: 'Cargo de prueba',
      salario: 1_000_000,
      fechaIngreso: new Date('2026-01-01T00:00:00.000Z'),
      sedeId,
    };
  }

  function profileData(id: string, tenantId: string, codigo: string) {
    return {
      id,
      tenantId,
      codigo,
      nombre: `Perfil ${codigo}`,
    };
  }

  function templateData(id: string, tenantId: string, nombre: string) {
    return {
      id,
      tenantId,
      nombre,
      tipo: 'CONTRACT' as const,
      contenido: '<p>Contenido de prueba</p>',
    };
  }

  function relationshipData(
    id: string,
    tenantId: string,
    empleadoId: string,
    perfilContractualId: string,
  ) {
    return {
      id,
      tenantId,
      empleadoId,
      perfilContractualId,
      vigenteDesde: new Date('2026-01-01T00:00:00.000Z'),
    };
  }

  function configurationData(
    id: string,
    tenantId: string,
    perfilContractualId: string,
    plantillaId: string,
  ) {
    return {
      id,
      tenantId,
      perfilContractualId,
      tipoDocumental: 'CONTRACT' as const,
      plantillaId,
      vigenteDesde: new Date('2026-01-01T00:00:00.000Z'),
    };
  }

  function exclusionData(id: string, tenantId: string, loteId: string) {
    return {
      id,
      tenantId,
      loteId,
      empleadoId: `employee-no-longer-present-${id}`,
      tipoDocumental: 'CONTRACT' as const,
      fechaEvaluacion: new Date('2026-01-01T00:00:00.000Z'),
      motivoBloqueo: 'SIN_VINCULO_VIGENTE',
    };
  }

  function userData(id: string, tenantId: string) {
    return {
      id,
      tenantId,
      email: `${id}@example.test`,
      passwordHash: 'test-only-hash',
      nombre: 'Usuario',
      apellido: 'Prueba',
      rol: 'ADMIN' as const,
    };
  }

  function planData(
    id: string,
    tenantId: string,
    loteId: string,
    empleadoId: string,
    vinculoLaboralId: string,
    perfilContractualId: string,
    configuracionDocumentalPerfilId: string,
    plantillaId: string,
  ) {
    const at = new Date('2026-01-15T00:00:00.000Z');
    return {
      id,
      tenantId,
      loteId,
      empleadoId,
      tipoDocumental: 'CONTRACT' as const,
      fechaProceso: at,
      vinculoLaboralId,
      perfilContractualId,
      configuracionDocumentalPerfilId,
      plantillaId,
      perfilSnapshot: { codigo: 'PROFILE' },
      configuracionSnapshot: { id: configuracionDocumentalPerfilId },
      plantillaSnapshot: { id: plantillaId },
      motivoResolucion: 'Configuración vigente',
      resueltoAt: at,
    };
  }
});
