import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { LoteEngineService } from './lote-engine.service';
import { PrismaService } from '../prisma/prisma.service';
import { ContractsService } from '../contracts/contracts.service';
import { GeneratedDocumentsService } from '../generated-documents/generated-documents.service';
import { ExpedienteDocsService } from '../expediente-docs/expediente-docs.service';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockLoteFindUnique = jest.fn();
const mockLoteUpdate = jest.fn();
const mockContratoFindFirst = jest.fn();
const mockContratoFindMany = jest.fn();
const mockEmpleadoFindFirst = jest.fn();
const mockGeneratedDocumentFindFirst = jest.fn();
const mockExpedienteDocFindFirst = jest.fn();

const mockPrisma = {
  loteContrato: { findUnique: mockLoteFindUnique, update: mockLoteUpdate },
  contrato: {
    findFirst: mockContratoFindFirst,
    findMany: mockContratoFindMany,
  },
  empleado: { findFirst: mockEmpleadoFindFirst },
  generatedDocument: { findFirst: mockGeneratedDocumentFindFirst },
  expedienteDoc: { findFirst: mockExpedienteDocFindFirst },
};

const mockContractsCreate = jest.fn();
const mockContractsGenerateDocument = jest.fn();
const mockContractsService = {
  create: mockContractsCreate,
  generateDocument: mockContractsGenerateDocument,
};

const mockGenDocsRemove = jest.fn();
const mockGenDocsService = { remove: mockGenDocsRemove };

const mockCreateFromGeneratedDoc = jest.fn();
const mockExpedienteService = {
  createFromGeneratedDoc: mockCreateFromGeneratedDoc,
};

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-001';
const LOTE_ID = 'lote-001';

function makeLote(overrides: Record<string, unknown> = {}) {
  return {
    id: LOTE_ID,
    tenantId: TENANT_ID,
    plantillaId: 'plantilla-001',
    sedeId: null,
    creadoPorId: 'user-001',
    tipoContrato: 'TERMINO_FIJO',
    fechaInicioContrato: new Date('2026-02-01'),
    fechaFinContrato: new Date('2026-12-15'),
    estado: 'PENDIENTE',
    total: 1,
    procesados: 0,
    fallidos: 0,
    erroresLog: [],
    configuracion: { empleadoIds: ['emp-001'] },
    ...overrides,
  };
}

function makeGenDoc(overrides: Record<string, unknown> = {}) {
  return {
    id: 'gendoc-001',
    pdfUrl: '/uploads/pdfs/tenant-001-gendoc-001.pdf',
    employeeId: 'emp-001',
    nombre: 'Contrato — María García',
    tipo: 'CONTRACT',
    contratoId: 'contrato-001',
    ...overrides,
  };
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('LoteEngineService', () => {
  let service: LoteEngineService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockLoteUpdate.mockImplementation(({ data }) => Promise.resolve(data));

    const module = await Test.createTestingModule({
      providers: [
        LoteEngineService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ContractsService, useValue: mockContractsService },
        { provide: GeneratedDocumentsService, useValue: mockGenDocsService },
        { provide: ExpedienteDocsService, useValue: mockExpedienteService },
      ],
    }).compile();

    service = module.get(LoteEngineService);
  });

  // ── ensureContrato (S0 / S1) ───────────────────────────────────────────────

  describe('ensureContrato', () => {
    it('S1: reutiliza el contrato existente (find-before-create)', async () => {
      mockContratoFindFirst.mockResolvedValue({
        id: 'contrato-001',
        empleadoId: 'emp-001',
      });

      const result = await service.ensureContrato(
        TENANT_ID,
        'user-001',
        makeLote() as never,
        'emp-001',
      );

      expect(result.id).toBe('contrato-001');
      expect(mockContractsCreate).not.toHaveBeenCalled();
    });

    it('S0: crea el contrato vía ContractsService.create con loteId', async () => {
      mockContratoFindFirst.mockResolvedValue(null);
      mockEmpleadoFindFirst.mockResolvedValue({
        cargo: 'Docente',
        salario: 3500000,
        tipoContrato: 'TERMINO_FIJO',
        fechaIngreso: new Date('2026-01-15'),
      });
      mockContractsCreate.mockResolvedValue({ id: 'contrato-new' });

      const result = await service.ensureContrato(
        TENANT_ID,
        'user-001',
        makeLote() as never,
        'emp-001',
      );

      expect(result.id).toBe('contrato-new');
      expect(mockContractsCreate).toHaveBeenCalledWith(
        TENANT_ID,
        'user-001',
        expect.objectContaining({ employeeId: 'emp-001', cargo: 'Docente' }),
        LOTE_ID,
      );
    });

    it('S0: lanza si el empleado no existe', async () => {
      mockContratoFindFirst.mockResolvedValue(null);
      mockEmpleadoFindFirst.mockResolvedValue(null);

      await expect(
        service.ensureContrato(
          TENANT_ID,
          'user-001',
          makeLote() as never,
          'emp-x',
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ── ensureDocumento (S1 / S2 / S3 / S4) ────────────────────────────────────

  describe('ensureDocumento', () => {
    it('S1: GeneratedDocument ausente → genera documento', async () => {
      mockGeneratedDocumentFindFirst.mockResolvedValue(null);

      await service.ensureDocumento(TENANT_ID, 'user-001', {
        id: 'contrato-001',
      });

      expect(mockContractsGenerateDocument).toHaveBeenCalledWith(
        TENANT_ID,
        'user-001',
        'contrato-001',
      );
      expect(mockGenDocsRemove).not.toHaveBeenCalled();
    });

    it('S2: pdfUrl null → limpia y regenera', async () => {
      mockGeneratedDocumentFindFirst.mockResolvedValue(
        makeGenDoc({ pdfUrl: null }),
      );

      await service.ensureDocumento(TENANT_ID, 'user-001', {
        id: 'contrato-001',
      });

      expect(mockGenDocsRemove).toHaveBeenCalledWith(TENANT_ID, 'gendoc-001');
      expect(mockContractsGenerateDocument).toHaveBeenCalledWith(
        TENANT_ID,
        'user-001',
        'contrato-001',
      );
    });

    it('S3: pdfUrl + ExpedienteDoc presente → skip', async () => {
      mockGeneratedDocumentFindFirst.mockResolvedValue(makeGenDoc());
      mockExpedienteDocFindFirst.mockResolvedValue({ id: 'exp-001' });

      await service.ensureDocumento(TENANT_ID, 'user-001', {
        id: 'contrato-001',
      });

      expect(mockContractsGenerateDocument).not.toHaveBeenCalled();
      expect(mockCreateFromGeneratedDoc).not.toHaveBeenCalled();
      expect(mockGenDocsRemove).not.toHaveBeenCalled();
    });

    it('S4: pdfUrl + ExpedienteDoc ausente → repara sin regenerar PDF', async () => {
      mockGeneratedDocumentFindFirst.mockResolvedValue(makeGenDoc());
      mockExpedienteDocFindFirst.mockResolvedValue(null);

      await service.ensureDocumento(TENANT_ID, 'user-001', {
        id: 'contrato-001',
      });

      expect(mockContractsGenerateDocument).not.toHaveBeenCalled();
      expect(mockCreateFromGeneratedDoc).toHaveBeenCalledWith(
        TENANT_ID,
        'gendoc-001',
        'emp-001',
        'Contrato — María García',
        'CONTRACT',
        undefined,
        'contrato-001',
      );
    });
  });

  // ── procesarLote (orquestación + contadores) ───────────────────────────────

  describe('procesarLote', () => {
    it('lanza si el lote no existe', async () => {
      mockLoteFindUnique.mockResolvedValue(null);
      await expect(service.procesarLote('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('procesa un empleado nuevo de extremo a extremo → COMPLETADO', async () => {
      mockLoteFindUnique.mockResolvedValue(makeLote());
      mockContratoFindFirst.mockResolvedValue(null);
      mockEmpleadoFindFirst.mockResolvedValue({
        cargo: 'Docente',
        salario: 3500000,
        tipoContrato: 'TERMINO_FIJO',
        fechaIngreso: new Date('2026-01-15'),
      });
      mockContractsCreate.mockResolvedValue({ id: 'contrato-new' });
      mockGeneratedDocumentFindFirst.mockResolvedValue(null);
      mockContractsGenerateDocument.mockResolvedValue({ id: 'gendoc-new' });

      await service.procesarLote(LOTE_ID);

      // EN_PROCESO + reset, increment procesados, finalize COMPLETADO
      expect(mockLoteUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ estado: 'EN_PROCESO' }),
        }),
      );
      expect(mockLoteUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { procesados: { increment: 1 } },
        }),
      );
      const finalize = mockLoteUpdate.mock.calls.at(-1)![0];
      expect(finalize.data.estado).toBe('COMPLETADO');
      expect(finalize.data.erroresLog).toEqual([]);
    });

    it('registra fallidos y finaliza FALLIDO cuando todo falla', async () => {
      mockLoteFindUnique.mockResolvedValue(makeLote());
      mockContratoFindFirst.mockResolvedValue(null);
      mockEmpleadoFindFirst
        .mockResolvedValueOnce(null) // ensureContrato → empleado ausente
        .mockResolvedValueOnce({ cedula: '999' }); // safeCedula

      await service.procesarLote(LOTE_ID);

      expect(mockLoteUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: { fallidos: { increment: 1 } } }),
      );
      const finalize = mockLoteUpdate.mock.calls.at(-1)![0];
      expect(finalize.data.estado).toBe('FALLIDO');
      expect(finalize.data.erroresLog).toHaveLength(1);
      expect(finalize.data.erroresLog[0]).toMatchObject({
        empleadoId: 'emp-001',
        cedula: '999',
      });
    });

    it('mezcla éxito y fallo → COMPLETADO_CON_ERRORES', async () => {
      mockLoteFindUnique.mockResolvedValue(
        makeLote({ configuracion: { empleadoIds: ['emp-ok', 'emp-bad'] } }),
      );
      // emp-ok: contrato existe y ya procesado (S3); emp-bad: empleado ausente
      mockContratoFindFirst
        .mockResolvedValueOnce({ id: 'c-ok', empleadoId: 'emp-ok' })
        .mockResolvedValueOnce(null);
      mockGeneratedDocumentFindFirst.mockResolvedValue(makeGenDoc());
      mockExpedienteDocFindFirst.mockResolvedValue({ id: 'exp-ok' });
      mockEmpleadoFindFirst
        .mockResolvedValueOnce(null) // ensureContrato emp-bad
        .mockResolvedValueOnce({ cedula: '111' }); // safeCedula emp-bad

      await service.procesarLote(LOTE_ID);

      const finalize = mockLoteUpdate.mock.calls.at(-1)![0];
      expect(finalize.data.estado).toBe('COMPLETADO_CON_ERRORES');
      expect(finalize.data.erroresLog).toHaveLength(1);
    });

    it('EN_PROCESO → retorna lote sin reprocesar (idempotente)', async () => {
      const loteEnProceso = makeLote({ estado: 'EN_PROCESO' });
      mockLoteFindUnique.mockResolvedValue(loteEnProceso);

      const result = await service.procesarLote(LOTE_ID);

      expect(result).toBe(loteEnProceso);
      expect(mockLoteUpdate).not.toHaveBeenCalled();
    });

    it('recalcula total desde empleadoIds.length', async () => {
      mockLoteFindUnique.mockResolvedValue(
        makeLote({
          total: 999,
          configuracion: { empleadoIds: ['emp-001', 'emp-002', 'emp-003'] },
        }),
      );
      // Todos los empleados en S3 (ya procesados)
      mockContratoFindFirst.mockResolvedValue({
        id: 'c-ok',
        empleadoId: 'emp-001',
      });
      mockGeneratedDocumentFindFirst.mockResolvedValue(makeGenDoc());
      mockExpedienteDocFindFirst.mockResolvedValue({ id: 'exp-ok' });

      await service.procesarLote(LOTE_ID);

      const enProcesoCall = mockLoteUpdate.mock.calls.find(
        (call) => call[0].data.estado === 'EN_PROCESO',
      );
      expect(enProcesoCall).toBeDefined();
      expect(enProcesoCall![0].data.total).toBe(3);
    });
  });

  // ── Batch Safety: P2002 idempotente ────────────────────────────────────────

  describe('batch safety — P2002 idempotente', () => {
    it('S1: carrera resuelta (ConflictException) → skip sin error', async () => {
      // generateDocument lanza ConflictException tanto por el find-before-create
      // ("ya tiene un documento generado") como por el catch P2002. Ambos casos
      // representan una carrera ya resuelta por otro proceso → el engine omite.
      mockGeneratedDocumentFindFirst.mockResolvedValue(null);
      mockContractsGenerateDocument.mockRejectedValue(
        new ConflictException(
          'Este contrato ya tiene un documento generado. Elimine el existente antes de generar uno nuevo.',
        ),
      );

      await expect(
        service.ensureDocumento(TENANT_ID, 'user-001', { id: 'contrato-001' }),
      ).resolves.toBeUndefined();

      expect(mockContractsGenerateDocument).toHaveBeenCalled();
    });

    it('S1: snapshot inválido (BadRequestException) → sigue fallando', async () => {
      mockGeneratedDocumentFindFirst.mockResolvedValue(null);
      mockContractsGenerateDocument.mockRejectedValue(
        new BadRequestException(
          'El contrato contrato-001 tiene un variablesSnapshot incompatible con la generación de documentos.',
        ),
      );

      await expect(
        service.ensureDocumento(TENANT_ID, 'user-001', { id: 'contrato-001' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('S1: plantilla inválida (BadRequestException) → sigue fallando', async () => {
      mockGeneratedDocumentFindFirst.mockResolvedValue(null);
      mockContractsGenerateDocument.mockRejectedValue(
        new BadRequestException('La plantilla debe ser de tipo CONTRACT'),
      );

      await expect(
        service.ensureDocumento(TENANT_ID, 'user-001', { id: 'contrato-001' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('S4: P2002 en ExpedienteDoc → skip sin error', async () => {
      mockGeneratedDocumentFindFirst.mockResolvedValue(makeGenDoc());
      mockExpedienteDocFindFirst.mockResolvedValue(null);

      const p2002 = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '5.0.0',
          meta: { target: ['generatedDocumentId'] },
        },
      );
      mockCreateFromGeneratedDoc.mockRejectedValue(p2002);

      await expect(
        service.ensureDocumento(TENANT_ID, 'user-001', { id: 'contrato-001' }),
      ).resolves.toBeUndefined();

      expect(mockCreateFromGeneratedDoc).toHaveBeenCalled();
    });

    it('S1: error no-P2002 se propaga normalmente', async () => {
      mockGeneratedDocumentFindFirst.mockResolvedValue(null);
      mockContractsGenerateDocument.mockRejectedValue(
        new Error('Unexpected DB failure'),
      );

      await expect(
        service.ensureDocumento(TENANT_ID, 'user-001', { id: 'contrato-001' }),
      ).rejects.toThrow('Unexpected DB failure');
    });

    it('S4: error no-P2002 se propaga normalmente', async () => {
      mockGeneratedDocumentFindFirst.mockResolvedValue(makeGenDoc());
      mockExpedienteDocFindFirst.mockResolvedValue(null);
      mockCreateFromGeneratedDoc.mockRejectedValue(new Error('Disk full'));

      await expect(
        service.ensureDocumento(TENANT_ID, 'user-001', { id: 'contrato-001' }),
      ).rejects.toThrow('Disk full');
    });
  });
});
