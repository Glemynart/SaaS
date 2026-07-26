import { ForbiddenException } from '@nestjs/common';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import { DocumentTemplatesService } from './document-templates.service';

const TENANT_ID = 'tenant-from-context';

describe('DocumentTemplatesService tenant context integration', () => {
  const findMany = jest.fn();
  const count = jest.fn();
  const execute = jest.fn();
  const service = new DocumentTemplatesService({
    execute,
  } as unknown as TenantPrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);
    execute.mockImplementation(
      (work: (client: unknown, context: { tenantId: string }) => unknown) =>
        work(
          { documentTemplate: { findMany, count } },
          { tenantId: TENANT_ID },
        ),
    );
  });

  it('uses TenantContext as the only tenant source when listing templates', async () => {
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
    expect(count).toHaveBeenCalledWith(
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
    expect(count).not.toHaveBeenCalled();
  });
});
