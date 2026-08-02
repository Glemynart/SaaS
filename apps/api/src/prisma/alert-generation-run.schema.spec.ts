import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const schema = readFileSync(
  resolve(process.cwd(), 'prisma/schema.prisma'),
  'utf8',
);
const migration = readFileSync(
  resolve(
    process.cwd(),
    'prisma/migrations/20260802020000_alert_generation_runs/migration.sql',
  ),
  'utf8',
);

describe('Alert generation run infrastructure', () => {
  it('persists run and tenant-level operational states', () => {
    expect(schema).toContain('model AlertGenerationRun');
    expect(schema).toContain('model AlertGenerationRunTenant');
    expect(schema).toContain('enum AlertGenerationRunStatus');
    expect(schema).toContain('enum AlertGenerationRunTenantStatus');
    expect(schema).toMatch(/lastErrorCode\s+String\?/);
    expect(schema).toContain('@@unique([runId, tenantId])');
  });

  it('enforces one RUNNING execution per scheduler in PostgreSQL', () => {
    expect(migration).toContain(
      'alert_generation_runs_one_running_per_scheduler_idx',
    );
    expect(migration).toContain('WHERE "status" = \'RUNNING\'');
  });

  it('keeps run retention metadata independent from alerts and audit logs', () => {
    expect(migration).toContain('alert_generation_run_tenants_runId_fkey');
    expect(migration).toContain('alert_generation_run_tenants_tenantId_fkey');
  });
});
