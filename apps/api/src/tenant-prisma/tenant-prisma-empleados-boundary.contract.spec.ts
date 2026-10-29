import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const auditedServices = [
  '../alerts/alerts.service.ts',
  '../contracts/contracts.service.ts',
  '../generated-documents/generated-documents.service.ts',
  '../employee-import/employee-import.service.ts',
  '../expediente-docs/expediente-docs.service.ts',
  '../payroll/payroll.service.ts',
  '../lotes/lote-engine.service.ts',
  '../payroll/liquidation/liquidation.service.ts',
] as const;

describe('empleados tenant-aware access boundary', () => {
  it.each(auditedServices)(
    '%s accesses empleados through TenantPrismaService',
    (relativePath) => {
      const source = readFileSync(join(__dirname, relativePath), 'utf8');

      expect(source).toContain('tenantPrisma.execute');
      expect(source).not.toContain('this.prisma.empleado');
      if (relativePath === '../employee-import/employee-import.service.ts') {
        expect(source).not.toContain('import { PrismaService }');
        expect(source).not.toContain('private prisma:');
        expect(source).not.toContain('this.prisma.');
      }
    },
  );

  it('uses the tenant-aware transaction client for approval block evaluation', () => {
    const source = readFileSync(
      join(__dirname, '../payroll/payroll.service.ts'),
      'utf8',
    );

    expect(source).toContain('return this.tenantPrisma.execute(async (tx)');
    expect(source).toContain('const employees = await tx.empleado.findMany');
  });
});
