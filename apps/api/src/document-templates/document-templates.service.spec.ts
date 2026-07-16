import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextBoundary } from '../tenant-context/tenant-context.boundary';
import { DocumentTemplatesService } from './document-templates.service';

const TENANT_ID = 'tenant-from-context';

describe('DocumentTemplatesService tenant context integration', () => {
  const findMany = jest.fn();
  const count = jest.fn();
  const require = jest.fn();
  const service = new DocumentTemplatesService(
    { documentTemplate: { findMany, count } } as unknown as PrismaService,
    { require } as unknown as TenantContextBoundary,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);
    require.mockReturnValue({ tenantId: TENANT_ID });
  });

  it('uses TenantContext as the only tenant source when listing templates', async () => {
    await service.findAll({});

    expect(require).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: TENANT_ID }),
      }),
    );
    expect(count).toHaveBeenCalledWith(
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
    expect(count).not.toHaveBeenCalled();
  });
});
