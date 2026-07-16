import { ForbiddenException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextBoundary } from '../tenant-context/tenant-context.boundary';
import { SedesService } from './sedes.service';

const TENANT_ID = 'tenant-from-context';

describe('SedesService tenant context integration', () => {
  const findMany = jest.fn();
  const require = jest.fn();
  const service = new SedesService(
    { sede: { findMany } } as unknown as PrismaService,
    { log: jest.fn() } as unknown as AuditService,
    { require } as unknown as TenantContextBoundary,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    findMany.mockResolvedValue([]);
    require.mockReturnValue({ tenantId: TENANT_ID });
  });

  it('uses TenantContext as the only tenant source when listing sedes', async () => {
    await service.findAll({});

    expect(require).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: TENANT_ID }),
      }),
    );
  });

  it('does not query when TenantContext is unavailable', async () => {
    require.mockImplementation(() => {
      throw new ForbiddenException();
    });

    await expect(service.findAll({})).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(findMany).not.toHaveBeenCalled();
  });
});
