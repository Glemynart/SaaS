import { ForbiddenException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import { SedesService } from './sedes.service';

const TENANT_ID = 'tenant-from-context';

describe('SedesService tenant context integration', () => {
  const findMany = jest.fn();
  const execute = jest.fn();
  const service = new SedesService(
    { execute } as unknown as TenantPrismaService,
    { log: jest.fn() } as unknown as AuditService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    findMany.mockResolvedValue([]);
    execute.mockImplementation(
      (work: (client: unknown, context: { tenantId: string }) => unknown) =>
        work({ sede: { findMany } }, { tenantId: TENANT_ID }),
    );
  });

  it('uses TenantContext as the only tenant source when listing sedes', async () => {
    await service.findAll({});
    const tenantWhere: unknown = expect.objectContaining({
      tenantId: TENANT_ID,
    });

    expect(execute).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: tenantWhere,
      }),
    );
  });

  it('does not query when TenantContext is unavailable', async () => {
    execute.mockImplementation(() => {
      throw new ForbiddenException();
    });

    await expect(service.findAll({})).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(findMany).not.toHaveBeenCalled();
  });
});
