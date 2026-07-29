import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const schema = readFileSync(
  resolve(process.cwd(), 'prisma/schema.prisma'),
  'utf8',
);
const migration = readFileSync(
  resolve(
    process.cwd(),
    'prisma/migrations/20260729000004_generated_document_lifecycle/migration.sql',
  ),
  'utf8',
);

describe('GeneratedDocument lifecycle infrastructure', () => {
  it('mantiene la creación de documentos vinculada al tenant y al ciclo de materialización', () => {
    expect(schema).toContain('model GeneratedDocument');
    expect(schema).toContain('tenantId String');
    expect(schema).toContain(
      'estado         GeneratedDocumentStatus @default(PENDIENTE_MATERIALIZACION)',
    );
    expect(schema).toContain('@@index([tenantId, estado])');
  });

  it('preserva los documentos existentes ya materializados durante la migración', () => {
    expect(migration).toContain('CREATE TYPE "GeneratedDocumentStatus"');
    expect(migration).toContain('PENDIENTE_MATERIALIZACION');
    expect(migration).toContain('MATERIALIZADO');
    expect(migration).toContain('FALLIDO');
    expect(migration).toContain('LEGADO_NO_VERIFICADO');
    expect(migration).toContain('SET "estado" = \'LEGADO_NO_VERIFICADO\'');
  });
});
