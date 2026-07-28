import { NotFoundException } from '@nestjs/common';
import { LoteContrato, Prisma } from '@prisma/client';
import { Test } from '@nestjs/testing';
import { ContractsService } from '../contracts/contracts.service';
import { ExpedienteDocsService } from '../expediente-docs/expediente-docs.service';
import { GeneratedDocumentsService } from '../generated-documents/generated-documents.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import { LoteEngineService } from './lote-engine.service';

const mockLoteFindUnique = jest.fn();
const mockLoteUpdate = jest.fn();
const mockLoteUpdateMany = jest.fn();
const mockContratoFindFirst = jest.fn();
const mockContratoFindMany = jest.fn();
const mockEmpleadoFindFirst = jest.fn();
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

const TENANT_ID = 'tenant-001';
const LOTE_ID = 'lote-001';
const USER_ID = 'user-001';
const TEMPLATE_ID = 'template-frozen-001';

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
    it('permite que un solo proceso adquiera el lote concurrente', async () => {
      const pending = makeLote();
      mockLoteFindUnique
        .mockResolvedValueOnce(pending)
        .mockResolvedValueOnce(pending)
        .mockResolvedValueOnce(makeLote({ estado: 'EN_PROCESO' }));
      let acquired = false;
      mockLoteUpdateMany.mockImplementation(async () => {
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
      const finalUpdate = mockLoteUpdate.mock.calls.at(-1)![0];
      expect(finalUpdate.data.estado).toBe('FALLIDO');
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
        .mockImplementationOnce(async () => {
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
