import { NotFoundException } from '@nestjs/common';
import { LoteContrato, Prisma } from '@prisma/client';
import { Test } from '@nestjs/testing';
import { ContractsService } from '../contracts/contracts.service';
import { ExpedienteDocsService } from '../expediente-docs/expediente-docs.service';
import { GeneratedDocumentsService } from '../generated-documents/generated-documents.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import { BatchDocumentGenerationService } from '../batch-document-generation/batch-document-generation.service';
import { LoteEngineService } from './lote-engine.service';

const mockLoteFindUnique = jest.fn();
const mockLoteUpdate = jest.fn();
const mockLoteUpdateMany = jest.fn();
const mockContratoFindFirst = jest.fn();
const mockContratoFindMany = jest.fn();
const mockEmpleadoFindFirst = jest.fn();
const mockBatchPlanCount = jest.fn();
const mockPrisma = {
  loteContrato: {
    findUnique: mockLoteFindUnique,
    update: mockLoteUpdate,
    updateMany: mockLoteUpdateMany,
  },
  contrato: {
    findFirst: mockContratoFindFirst,
    findMany: mockContratoFindMany,
  },
  empleado: { findFirst: mockEmpleadoFindFirst },
  batchDocumentGenerationPlan: { count: mockBatchPlanCount },
};
const mockTenantPrisma = {
  execute: jest.fn((work: (client: typeof mockPrisma) => unknown) =>
    work(mockPrisma),
  ),
};

const mockContractsCreate = jest.fn();
const mockEnsureGeneratedDocument = jest.fn();
const mockContractsService = {
  create: mockContractsCreate,
  ensureGeneratedDocument: mockEnsureGeneratedDocument,
};
const mockMaterializePdf = jest.fn();
const mockGeneratedDocumentsService = { materializePdf: mockMaterializePdf };
const mockPublishGeneratedDocument = jest.fn();
const mockExpedienteDocsService = {
  publishGeneratedDocument: mockPublishGeneratedDocument,
};
const mockBatchDocumentGenerationStart = jest.fn();
const mockBatchDocumentGenerationService = {
  start: mockBatchDocumentGenerationStart,
};

const TENANT_ID = 'tenant-001';
const LOTE_ID = 'lote-001';
const USER_ID = 'user-001';
const TEMPLATE_ID = 'template-frozen-001';

function objectContaining<T extends object>(expected: T): T {
  return expect.objectContaining(expected) as T;
}

function anyDate(): Date {
  return expect.any(Date) as Date;
}

function makeLote(overrides: Record<string, unknown> = {}) {
  return {
    id: LOTE_ID,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    tenantId: TENANT_ID,
    documentTemplateId: TEMPLATE_ID,
    sedeId: null,
    creadoPorId: USER_ID,
    nombreLote: null,
    tipoContrato: 'TERMINO_FIJO',
    fechaInicioContrato: new Date('2026-02-01'),
    fechaFinContrato: new Date('2026-12-15'),
    estado: 'PENDIENTE',
    total: 1,
    procesados: 0,
    fallidos: 0,
    iniciadoAt: null,
    completadoAt: null,
    zipKey: null,
    erroresLog: [],
    configuracion: { empleadoIds: ['emp-001'] },
    ...overrides,
  } as LoteContrato;
}

describe('LoteEngineService', () => {
  let service: LoteEngineService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockLoteUpdate.mockImplementation(({ data }) => Promise.resolve(data));
    mockLoteUpdateMany.mockResolvedValue({ count: 1 });
    mockBatchPlanCount.mockResolvedValue(0);

    const module = await Test.createTestingModule({
      providers: [
        LoteEngineService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: TenantPrismaService, useValue: mockTenantPrisma },
        { provide: ContractsService, useValue: mockContractsService },
        {
          provide: GeneratedDocumentsService,
          useValue: mockGeneratedDocumentsService,
        },
        { provide: ExpedienteDocsService, useValue: mockExpedienteDocsService },
        {
          provide: BatchDocumentGenerationService,
          useValue: mockBatchDocumentGenerationService,
        },
      ],
    }).compile();

    service = module.get(LoteEngineService);
  });

  describe('ensureDocumento', () => {
    it('orquesta la identidad, materialización y publicación con la plantilla congelada', async () => {
      mockEnsureGeneratedDocument.mockResolvedValue({
        outcome: 'CREATED',
        document: { id: 'gendoc-001' },
      });
      mockMaterializePdf.mockResolvedValue({ id: 'gendoc-001' });
      mockPublishGeneratedDocument.mockResolvedValue({ outcome: 'CREATED' });

      await service.ensureDocumento(
        TENANT_ID,
        USER_ID,
        { id: 'contrato-001' },
        TEMPLATE_ID,
      );

      expect(mockEnsureGeneratedDocument).toHaveBeenCalledWith(
        TENANT_ID,
        'contrato-001',
        TEMPLATE_ID,
      );
      expect(mockMaterializePdf).toHaveBeenCalledWith(TENANT_ID, 'gendoc-001');
      expect(mockPublishGeneratedDocument).toHaveBeenCalledWith(
        TENANT_ID,
        USER_ID,
        'gendoc-001',
        expect.anything(),
      );
      expect(
        mockEnsureGeneratedDocument.mock.invocationCallOrder[0],
      ).toBeLessThan(mockMaterializePdf.mock.invocationCallOrder[0]);
      expect(mockMaterializePdf.mock.invocationCallOrder[0]).toBeLessThan(
        mockPublishGeneratedDocument.mock.invocationCallOrder[0],
      );
    });

    it('reutiliza el documento existente y delega su recuperación idempotente', async () => {
      mockEnsureGeneratedDocument.mockResolvedValue({
        outcome: 'EXISTING',
        document: { id: 'gendoc-001' },
      });
      mockMaterializePdf.mockResolvedValue({ id: 'gendoc-001' });
      mockPublishGeneratedDocument.mockResolvedValue({ outcome: 'EXISTING' });

      await service.ensureDocumento(
        TENANT_ID,
        USER_ID,
        { id: 'contrato-001' },
        TEMPLATE_ID,
      );

      expect(mockMaterializePdf).toHaveBeenCalledWith(TENANT_ID, 'gendoc-001');
      expect(mockPublishGeneratedDocument).toHaveBeenCalledWith(
        TENANT_ID,
        USER_ID,
        'gendoc-001',
        expect.anything(),
      );
    });
  });

  describe('procesarLote', () => {
    it('delegates once to the confirmed-plan generation flow after contracts are ensured', async () => {
      mockBatchPlanCount.mockResolvedValue(1);
      mockLoteFindUnique.mockResolvedValue(makeLote());
      mockContratoFindFirst.mockResolvedValue({
        id: 'contrato-emp-001',
        empleadoId: 'emp-001',
      });
      mockBatchDocumentGenerationStart.mockResolvedValue({
        loteId: LOTE_ID,
        total: 1,
        documents: [],
      });

      await service.procesarLote(LOTE_ID);

      expect(mockBatchDocumentGenerationStart).toHaveBeenCalledTimes(1);
      expect(mockBatchDocumentGenerationStart).toHaveBeenCalledWith(LOTE_ID);
      expect(mockEnsureGeneratedDocument).not.toHaveBeenCalled();
      expect(
        mockBatchDocumentGenerationStart.mock.invocationCallOrder[0],
      ).toBeGreaterThan(mockContratoFindFirst.mock.invocationCallOrder[0]);
    });

    it('deja el lote reintentable si falla la generación documental basada en planes', async () => {
      mockBatchPlanCount.mockResolvedValue(1);
      mockLoteFindUnique.mockResolvedValue(makeLote());
      mockContratoFindFirst.mockResolvedValue({
        id: 'contrato-emp-001',
        empleadoId: 'emp-001',
      });
      mockBatchDocumentGenerationStart.mockRejectedValue(
        new Error('storage falló'),
      );

      await expect(service.procesarLote(LOTE_ID)).resolves.toMatchObject({
        estado: 'FALLIDO',
        procesados: 0,
        fallidos: 1,
      });

      expect(mockLoteUpdate).toHaveBeenLastCalledWith(
        objectContaining({
          data: objectContaining({
            estado: 'FALLIDO',
            erroresLog: [
              objectContaining({
                empleadoId: 'BATCH_DOCUMENT_GENERATION',
                error: 'storage falló',
              }),
            ],
          }),
        }),
      );
    });

    it('procesa una sola vez cada empleado del snapshot y completa el lote cuando todos tienen éxito', async () => {
      mockLoteFindUnique.mockResolvedValue(
        makeLote({
          configuracion: {
            empleadoIds: ['emp-001', 'emp-001', 'emp-002'],
          },
        }),
      );
      mockContratoFindFirst.mockImplementation(
        ({ where }: { where: { empleadoId: string } }) =>
          Promise.resolve({
            id: `contrato-${where.empleadoId}`,
            empleadoId: where.empleadoId,
          }),
      );
      mockEnsureGeneratedDocument.mockImplementation(
        (_tenantId: string, contratoId: string) =>
          Promise.resolve({
            outcome: 'EXISTING',
            document: { id: `gendoc-${contratoId}` },
          }),
      );
      mockMaterializePdf.mockImplementation(
        (_tenantId: string, documentId: string) =>
          Promise.resolve({ id: documentId }),
      );

      await service.procesarLote(LOTE_ID);

      expect(mockLoteUpdateMany).toHaveBeenCalledWith(
        objectContaining({
          data: objectContaining({
            estado: 'EN_PROCESO',
            total: 2,
            procesados: 0,
            fallidos: 0,
            erroresLog: [],
          }),
        }),
      );
      expect(mockEnsureGeneratedDocument).toHaveBeenNthCalledWith(
        1,
        TENANT_ID,
        'contrato-emp-001',
        TEMPLATE_ID,
      );
      expect(mockEnsureGeneratedDocument).toHaveBeenNthCalledWith(
        2,
        TENANT_ID,
        'contrato-emp-002',
        TEMPLATE_ID,
      );
      expect(mockEnsureGeneratedDocument).toHaveBeenCalledTimes(2);

      expect(mockLoteUpdate).toHaveBeenLastCalledWith(
        objectContaining({
          data: objectContaining({
            estado: 'COMPLETADO',
            erroresLog: [],
            completadoAt: anyDate(),
          }),
        }),
      );
    });

    it('conserva los éxitos y finaliza con errores detallados cuando solo una parte del lote falla', async () => {
      mockLoteFindUnique.mockResolvedValue(
        makeLote({ configuracion: { empleadoIds: ['emp-001', 'emp-002'] } }),
      );
      mockContratoFindFirst.mockImplementation(
        ({ where }: { where: { empleadoId: string } }) =>
          Promise.resolve({
            id: `contrato-${where.empleadoId}`,
            empleadoId: where.empleadoId,
          }),
      );
      mockEnsureGeneratedDocument.mockImplementation(
        (_tenantId: string, contratoId: string) => {
          if (contratoId === 'contrato-emp-002') {
            return Promise.reject(new Error('Plantilla inválida'));
          }
          return Promise.resolve({
            outcome: 'EXISTING',
            document: { id: 'gendoc-001' },
          });
        },
      );
      mockEmpleadoFindFirst.mockResolvedValue({ cedula: '222' });

      await service.procesarLote(LOTE_ID);

      expect(mockMaterializePdf).toHaveBeenCalledTimes(1);
      expect(mockPublishGeneratedDocument).toHaveBeenCalledTimes(1);
      expect(mockLoteUpdate).toHaveBeenLastCalledWith(
        objectContaining({
          data: objectContaining({
            estado: 'COMPLETADO_CON_ERRORES',
            erroresLog: [
              {
                empleadoId: 'emp-002',
                cedula: '222',
                error: 'Plantilla inválida',
              },
            ],
          }),
        }),
      );
    });

    it('reprocesa un lote completado sin crear otro contrato y repite solo las etapas idempotentes', async () => {
      mockLoteFindUnique.mockResolvedValue(makeLote({ estado: 'COMPLETADO' }));
      mockContratoFindFirst.mockResolvedValue({
        id: 'contrato-001',
        empleadoId: 'emp-001',
      });
      mockEnsureGeneratedDocument.mockResolvedValue({
        outcome: 'EXISTING',
        document: { id: 'gendoc-001' },
      });
      mockMaterializePdf.mockResolvedValue({ id: 'gendoc-001' });
      mockPublishGeneratedDocument.mockResolvedValue({ outcome: 'EXISTING' });

      await service.procesarLote(LOTE_ID);
      await service.procesarLote(LOTE_ID);

      expect(mockContractsCreate).not.toHaveBeenCalled();
      expect(mockEnsureGeneratedDocument).toHaveBeenCalledTimes(2);
      expect(mockMaterializePdf).toHaveBeenCalledTimes(2);
      expect(mockPublishGeneratedDocument).toHaveBeenCalledTimes(2);
      expect(mockLoteUpdate).toHaveBeenLastCalledWith(
        objectContaining({
          data: objectContaining({
            estado: 'COMPLETADO',
            erroresLog: [],
          }),
        }),
      );
    });

    it('permite que un solo proceso adquiera el lote concurrente', async () => {
      const pending = makeLote();
      mockLoteFindUnique
        .mockResolvedValueOnce(pending)
        .mockResolvedValueOnce(pending)
        .mockResolvedValueOnce(makeLote({ estado: 'EN_PROCESO' }));
      let acquired = false;
      mockLoteUpdateMany.mockImplementation(() => {
        if (acquired) return { count: 0 };
        acquired = true;
        return { count: 1 };
      });
      mockContratoFindFirst.mockResolvedValue({
        id: 'contrato-001',
        empleadoId: 'emp-001',
      });
      mockEnsureGeneratedDocument.mockResolvedValue({
        outcome: 'EXISTING',
        document: { id: 'gendoc-001' },
      });

      await Promise.all([
        service.procesarLote(LOTE_ID),
        service.procesarLote(LOTE_ID),
      ]);

      expect(mockLoteUpdateMany).toHaveBeenCalledTimes(2);
      expect(mockEnsureGeneratedDocument).toHaveBeenCalledTimes(1);
      expect(mockMaterializePdf).toHaveBeenCalledTimes(1);
      expect(mockPublishGeneratedDocument).toHaveBeenCalledTimes(1);
    });

    it('usa documentTemplateId del lote para el flujo documental completo', async () => {
      mockLoteFindUnique.mockResolvedValue(makeLote());
      mockContratoFindFirst.mockResolvedValue({
        id: 'contrato-001',
        empleadoId: 'emp-001',
      });
      mockEnsureGeneratedDocument.mockResolvedValue({
        outcome: 'CREATED',
        document: { id: 'gendoc-001' },
      });

      await service.procesarLote(LOTE_ID);

      expect(mockEnsureGeneratedDocument).toHaveBeenCalledWith(
        TENANT_ID,
        'contrato-001',
        TEMPLATE_ID,
      );
      expect(mockMaterializePdf).toHaveBeenCalledWith(TENANT_ID, 'gendoc-001');
      expect(mockPublishGeneratedDocument).toHaveBeenCalledWith(
        TENANT_ID,
        USER_ID,
        'gendoc-001',
        expect.anything(),
      );
      expect(mockLoteUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: { procesados: { increment: 1 } } }),
      );
    });

    it('mantiene la contabilización de error cuando una etapa falla', async () => {
      mockLoteFindUnique.mockResolvedValue(makeLote());
      mockContratoFindFirst.mockResolvedValue({
        id: 'contrato-001',
        empleadoId: 'emp-001',
      });
      mockEnsureGeneratedDocument.mockRejectedValue(
        new Error('Plantilla inválida'),
      );
      mockEmpleadoFindFirst.mockResolvedValue({ cedula: '999' });

      await service.procesarLote(LOTE_ID);

      expect(mockLoteUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: { fallidos: { increment: 1 } } }),
      );
      expect(mockLoteUpdate).toHaveBeenLastCalledWith(
        objectContaining({ data: objectContaining({ estado: 'FALLIDO' }) }),
      );
    });

    it('lanza si el lote no existe', async () => {
      mockLoteFindUnique.mockResolvedValue(null);

      await expect(service.procesarLote(LOTE_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('ensureContrato', () => {
    it('recupera el contrato ganador ante dos creaciones concurrentes', async () => {
      const lote = makeLote();
      mockContratoFindFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'contrato-ganador',
          empleadoId: 'emp-001',
        });
      mockEmpleadoFindFirst.mockResolvedValue({
        cargo: 'Docente',
        salario: 3500000,
        tipoContrato: 'TERMINO_FIJO',
        fechaIngreso: new Date('2026-02-01'),
      });
      const persistedContracts = new Set<string>();
      mockContractsCreate
        .mockImplementationOnce(() => {
          persistedContracts.add('contrato-ganador');
          return { id: 'contrato-ganador' };
        })
        .mockRejectedValueOnce(
          new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
            code: 'P2002',
            clientVersion: '5.0.0',
            meta: { target: ['loteId', 'empleadoId'] },
          }),
        );

      const [first, second] = await Promise.all([
        service.ensureContrato(TENANT_ID, USER_ID, lote, 'emp-001'),
        service.ensureContrato(TENANT_ID, USER_ID, lote, 'emp-001'),
      ]);

      expect(mockContractsCreate).toHaveBeenCalledTimes(2);
      expect(first).toEqual({ id: 'contrato-ganador', empleadoId: 'emp-001' });
      expect(second).toEqual({ id: 'contrato-ganador', empleadoId: 'emp-001' });
      expect(persistedContracts).toEqual(new Set(['contrato-ganador']));
    });
  });
});
