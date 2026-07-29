import { BatchDocumentGenerationPlanStatus, LoteEstado } from '@prisma/client';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import { BatchDocumentGenerationService } from './batch-document-generation.service';

const loteFindFirst = jest.fn();
const planFindMany = jest.fn();
const execute = jest.fn();

const TENANT = 'tenant-001';
const LOTE = '11111111-1111-4111-8111-111111111111';

type MockClient = {
  loteContrato: { findFirst: typeof loteFindFirst };
  batchDocumentGenerationPlan: {
    findMany: typeof planFindMany;
  };
};

function objectContaining<T extends object>(expected: T): T {
  return expect.objectContaining(expected) as T;
}

describe('BatchDocumentGenerationService', () => {
  let service: BatchDocumentGenerationService;

  beforeEach(() => {
    jest.clearAllMocks();
    loteFindFirst.mockResolvedValue({ estado: LoteEstado.PENDIENTE });
    planFindMany.mockResolvedValue([
      { id: 'plan-1', estado: BatchDocumentGenerationPlanStatus.CONFIRMADO },
      { id: 'plan-2', estado: BatchDocumentGenerationPlanStatus.CONFIRMADO },
    ]);
    execute.mockImplementation(
      (work: (client: MockClient, context: { tenantId: string }) => unknown) =>
        work(
          {
            loteContrato: { findFirst: loteFindFirst },
            batchDocumentGenerationPlan: {
              findMany: planFindMany,
            },
          },
          { tenantId: TENANT },
        ),
    );
    service = new BatchDocumentGenerationService({
      execute,
    } as unknown as TenantPrismaService);
  });

  it('prepara la generación conservando los planes confirmados del lote', async () => {
    await expect(service.start(LOTE)).resolves.toEqual({
      loteId: LOTE,
      total: 2,
      plans: [
        { id: 'plan-1', estado: BatchDocumentGenerationPlanStatus.CONFIRMADO },
        { id: 'plan-2', estado: BatchDocumentGenerationPlanStatus.CONFIRMADO },
      ],
    });
  });

  it('rechaza el inicio cuando no existen planes confirmados', async () => {
    planFindMany.mockResolvedValue([]);

    await expect(service.start(LOTE)).rejects.toThrow(
      'El lote no tiene planes confirmados disponibles para generar.',
    );
  });

  it('rechaza un lote que no puede procesarse', async () => {
    loteFindFirst.mockResolvedValue({ estado: LoteEstado.EN_PROCESO });

    await expect(service.start(LOTE)).rejects.toThrow(
      'El lote no puede iniciar generación en estado "EN_PROCESO".',
    );
    expect(planFindMany).not.toHaveBeenCalled();
  });

  it('aísla lote y planes al tenant activo', async () => {
    await service.start(LOTE);

    expect(loteFindFirst).toHaveBeenCalledWith(
      objectContaining({ where: { id: LOTE, tenantId: TENANT } }),
    );
    expect(planFindMany).toHaveBeenCalledWith(
      objectContaining({
        where: objectContaining({ tenantId: TENANT, loteId: LOTE }),
      }),
    );
  });
});
