import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const schema = readFileSync(
  resolve(process.cwd(), 'prisma/schema.prisma'),
  'utf8',
);
const migration = readFileSync(
  resolve(
    process.cwd(),
    'prisma/migrations/20260729000003_batch_document_generation_plans/migration.sql',
  ),
  'utf8',
);

describe('BatchDocumentGenerationPlan infrastructure', () => {
  it('persists the complete historical snapshot contract', () => {
    expect(schema).toContain('model BatchDocumentGenerationPlan');
    expect(schema).toContain('perfilSnapshot Json');
    expect(schema).toContain('configuracionSnapshot Json');
    expect(schema).toContain('plantillaSnapshot Json');
    expect(schema).toContain('vinculoLaboralId String');
    expect(schema).toContain('perfilContractualId String');
    expect(schema).toContain('configuracionDocumentalPerfilId String');
    expect(schema).toContain('plantillaId String');
  });

  it('defines lifecycle states and tenant-scoped persistence', () => {
    expect(schema).toContain('enum BatchDocumentGenerationPlanStatus');
    expect(schema).toContain('CONFIRMADO');
    expect(schema).toContain('CONSUMIDO');
    expect(schema).toContain('ANULADO');
    expect(schema).toContain('tenantId String');
    expect(migration).toContain('"tenantId" TEXT NOT NULL');
  });

  it('enforces one plan per batch, employee, and document type', () => {
    expect(schema).toContain('@@unique([loteId, empleadoId, tipoDocumental])');
    expect(migration).toContain(
      '"batch_document_generation_plans_loteId_empleadoId_tipoDocumental_key" UNIQUE',
    );
  });
});
