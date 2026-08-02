import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { LoteProposito } from '@prisma/client';
import { LotesService } from './lotes.service';
import { LoteEngineService } from './lote-engine.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateLoteDto } from './dto/create-lote.dto';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockPrisma = {
  documentTemplate: { findFirst: jest.fn() },
  sede: { findFirst: jest.fn() },
  loteContrato: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
  },
};

const mockAudit = { log: jest.fn().mockResolvedValue(undefined) };
const mockEngine = { procesarLote: jest.fn() };

// ── Fixtures ─────────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-001';
const USER_ID = 'user-001';
const TEMPLATE_ID = 'dt-001';

function makeDto(overrides: Partial<CreateLoteDto> = {}): CreateLoteDto {
  return {
    nombre: 'Lote enero 2026',
    templateId: TEMPLATE_ID,
    empleadoIds: ['emp-001', 'emp-002'],
    ...overrides,
  };
}

function makeTemplate(overrides: Record<string, unknown> = {}) {
  return {
    id: TEMPLATE_ID,
    tipo: 'CONTRACT',
    activo: true,
    ...overrides,
  };
}

function makeLote(overrides: Record<string, unknown> = {}) {
  return {
    id: 'lote-001',
    tenantId: TENANT_ID,
    documentTemplateId: TEMPLATE_ID,
    estado: 'PENDIENTE',
    total: 2,
    procesados: 0,
    fallidos: 0,
    ...overrides,
  };
}

// ── Setup ────────────────────────────────────────────────────────────────────

describe('LotesService', () => {
  let service: LotesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LotesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: LoteEngineService, useValue: mockEngine },
      ],
    }).compile();
    service = module.get(LotesService);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // create()
  // ────────────────────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('crea lote con DocumentTemplate CONTRACT válido', async () => {
      mockPrisma.documentTemplate.findFirst.mockResolvedValue(makeTemplate());
      mockPrisma.loteContrato.create.mockResolvedValue(makeLote());

      const result = await service.create(TENANT_ID, USER_ID, makeDto());

      expect(mockPrisma.documentTemplate.findFirst).toHaveBeenCalledWith({
        where: { id: TEMPLATE_ID, tenantId: TENANT_ID, deletedAt: null },
        select: { id: true, tipo: true, activo: true },
      });
      expect(mockPrisma.loteContrato.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            documentTemplateId: TEMPLATE_ID,
            tenantId: TENANT_ID,
          }),
        }),
      );
      expect(result).toEqual(makeLote());
    });

    it('crea campaña inteligente sin plantilla y conserva su propósito', async () => {
      mockPrisma.loteContrato.create.mockResolvedValue(
        makeLote({
          documentTemplateId: null,
          proposito: LoteProposito.CONTRATACION,
        }),
      );

      await service.create(
        TENANT_ID,
        USER_ID,
        makeDto({
          templateId: undefined,
          proposito: LoteProposito.CONTRATACION,
        }),
      );

      expect(mockPrisma.documentTemplate.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.loteContrato.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            documentTemplateId: null,
            proposito: LoteProposito.CONTRATACION,
          }),
        }),
      );
    });

    it('exige propósito cuando no se proporciona plantilla', async () => {
      await expect(
        service.create(TENANT_ID, USER_ID, makeDto({ templateId: undefined })),
      ).rejects.toThrow(
        'Una campaña inteligente requiere el propósito CONTRATACION.',
      );
    });

    it('rechaza mezclar plantilla manual y propósito inteligente', async () => {
      await expect(
        service.create(
          TENANT_ID,
          USER_ID,
          makeDto({ proposito: LoteProposito.CONTRATACION }),
        ),
      ).rejects.toThrow(
        'Un lote manual no puede combinar plantilla y propósito inteligente.',
      );
    });

    it('rechaza template inexistente', async () => {
      mockPrisma.documentTemplate.findFirst.mockResolvedValue(null);

      await expect(
        service.create(TENANT_ID, USER_ID, makeDto()),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.create(TENANT_ID, USER_ID, makeDto()),
      ).rejects.toThrow(
        'La plantilla no existe o no pertenece a esta empresa.',
      );
    });

    it('rechaza template inactivo', async () => {
      mockPrisma.documentTemplate.findFirst.mockResolvedValue(
        makeTemplate({ activo: false }),
      );

      await expect(
        service.create(TENANT_ID, USER_ID, makeDto()),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.create(TENANT_ID, USER_ID, makeDto()),
      ).rejects.toThrow('La plantilla está inactiva.');
    });

    it('rechaza template de tipo distinto a CONTRACT', async () => {
      mockPrisma.documentTemplate.findFirst.mockResolvedValue(
        makeTemplate({ tipo: 'CERTIFICATION' }),
      );

      await expect(
        service.create(TENANT_ID, USER_ID, makeDto()),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.create(TENANT_ID, USER_ID, makeDto()),
      ).rejects.toThrow('La plantilla debe ser de tipo CONTRACT.');
    });

    it('rechaza template de otro tenant (findFirst con tenantId no encuentra)', async () => {
      mockPrisma.documentTemplate.findFirst.mockResolvedValue(null);

      await expect(
        service.create('tenant-OTHER', USER_ID, makeDto()),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.documentTemplate.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 'tenant-OTHER' }),
        }),
      );
    });

    it('valida sede cuando se proporciona', async () => {
      mockPrisma.documentTemplate.findFirst.mockResolvedValue(makeTemplate());
      mockPrisma.sede.findFirst.mockResolvedValue(null);

      await expect(
        service.create(TENANT_ID, USER_ID, makeDto({ sedeId: 'sede-999' })),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.create(TENANT_ID, USER_ID, makeDto({ sedeId: 'sede-999' })),
      ).rejects.toThrow('La sede no existe o no pertenece a esta empresa.');
    });

    it('rechaza fechaFin anterior a fechaInicio', async () => {
      mockPrisma.documentTemplate.findFirst.mockResolvedValue(makeTemplate());

      await expect(
        service.create(
          TENANT_ID,
          USER_ID,
          makeDto({
            fechaInicio: '2026-12-01',
            fechaFin: '2026-01-01',
          }),
        ),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.create(
          TENANT_ID,
          USER_ID,
          makeDto({
            fechaInicio: '2026-12-01',
            fechaFin: '2026-01-01',
          }),
        ),
      ).rejects.toThrow(
        'La fecha de fin debe ser posterior a la fecha de inicio.',
      );
    });

    it('persiste empleadoIds deduplicados en configuracion', async () => {
      mockPrisma.documentTemplate.findFirst.mockResolvedValue(makeTemplate());
      mockPrisma.loteContrato.create.mockResolvedValue(makeLote());

      await service.create(
        TENANT_ID,
        USER_ID,
        makeDto({
          empleadoIds: ['emp-001', 'emp-001', 'emp-002'],
        }),
      );

      const createCall = mockPrisma.loteContrato.create.mock.calls[0][0];
      const config = createCall.data.configuracion;
      expect(config.empleadoIds).toEqual(['emp-001', 'emp-002']);
      expect(createCall.data.total).toBe(2);
    });

    it('emite auditoría LOTE_CREATE', async () => {
      mockPrisma.documentTemplate.findFirst.mockResolvedValue(makeTemplate());
      mockPrisma.loteContrato.create.mockResolvedValue(makeLote());

      await service.create(TENANT_ID, USER_ID, makeDto());

      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_ID,
          userId: USER_ID,
          action: 'LOTE_CREATE',
          entityType: 'LoteContrato',
        }),
      );
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // findAll()
  // ────────────────────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('retorna { data, meta } con paginación', async () => {
      mockPrisma.loteContrato.findMany.mockResolvedValue([makeLote()]);
      mockPrisma.loteContrato.count.mockResolvedValue(1);

      const result = await service.findAll(TENANT_ID, { page: 1, limit: 10 });

      expect(result).toEqual({
        data: [makeLote()],
        meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
      });
      expect(mockPrisma.loteContrato.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: TENANT_ID }),
        }),
      );
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // findOne()
  // ────────────────────────────────────────────────────────────────────────────

  describe('findOne()', () => {
    it('retorna lote del tenant', async () => {
      mockPrisma.loteContrato.findFirst.mockResolvedValue(makeLote());
      const result = await service.findOne(TENANT_ID, 'lote-001');
      expect(result).toEqual(makeLote());
    });

    it('404 si no pertenece al tenant', async () => {
      mockPrisma.loteContrato.findFirst.mockResolvedValue(null);
      await expect(
        service.findOne(TENANT_ID, 'lote-inexistente'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // getProgress()
  // ────────────────────────────────────────────────────────────────────────────

  describe('getProgress()', () => {
    it('retorna progreso con porcentaje', async () => {
      mockPrisma.loteContrato.findFirst.mockResolvedValue({
        id: 'lote-001',
        estado: 'EN_PROCESO',
        total: 10,
        procesados: 3,
        fallidos: 2,
        iniciadoAt: new Date(),
        completadoAt: null,
        erroresLog: [],
      });

      const result = await service.getProgress(TENANT_ID, 'lote-001');
      expect(result.porcentaje).toBe(50);
    });

    it('porcentaje 0 si total es 0', async () => {
      mockPrisma.loteContrato.findFirst.mockResolvedValue({
        id: 'lote-001',
        estado: 'PENDIENTE',
        total: 0,
        procesados: 0,
        fallidos: 0,
        iniciadoAt: null,
        completadoAt: null,
        erroresLog: [],
      });

      const result = await service.getProgress(TENANT_ID, 'lote-001');
      expect(result.porcentaje).toBe(0);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // process()
  // ────────────────────────────────────────────────────────────────────────────

  describe('process()', () => {
    it('delega a engine.procesarLote()', async () => {
      mockPrisma.loteContrato.findFirst.mockResolvedValue(
        makeLote({ estado: 'PENDIENTE' }),
      );
      mockEngine.procesarLote.mockResolvedValue(
        makeLote({ estado: 'COMPLETADO' }),
      );

      await service.process(TENANT_ID, USER_ID, 'lote-001');
      expect(mockEngine.procesarLote).toHaveBeenCalledWith('lote-001');
    });

    it('rechaza EN_PROCESO con ConflictException', async () => {
      mockPrisma.loteContrato.findFirst.mockResolvedValue(
        makeLote({ estado: 'EN_PROCESO' }),
      );

      await expect(
        service.process(TENANT_ID, USER_ID, 'lote-001'),
      ).rejects.toThrow(ConflictException);
    });

    it('404 si lote no pertenece al tenant', async () => {
      mockPrisma.loteContrato.findFirst.mockResolvedValue(null);

      await expect(
        service.process(TENANT_ID, USER_ID, 'lote-inexistente'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // retry()
  // ────────────────────────────────────────────────────────────────────────────

  describe('retry()', () => {
    it('permite FALLIDO', async () => {
      mockPrisma.loteContrato.findFirst.mockResolvedValue(
        makeLote({ estado: 'FALLIDO' }),
      );
      mockEngine.procesarLote.mockResolvedValue(
        makeLote({ estado: 'COMPLETADO' }),
      );

      await service.retry(TENANT_ID, USER_ID, 'lote-001');
      expect(mockEngine.procesarLote).toHaveBeenCalledWith('lote-001', {
        retry: true,
      });
    });

    it('permite COMPLETADO_CON_ERRORES', async () => {
      mockPrisma.loteContrato.findFirst.mockResolvedValue(
        makeLote({ estado: 'COMPLETADO_CON_ERRORES' }),
      );
      mockEngine.procesarLote.mockResolvedValue(
        makeLote({ estado: 'COMPLETADO' }),
      );

      await service.retry(TENANT_ID, USER_ID, 'lote-001');
      expect(mockEngine.procesarLote).toHaveBeenCalledWith('lote-001', {
        retry: true,
      });
    });

    it('reintenta solo los empleados registrados como fallidos', async () => {
      mockPrisma.loteContrato.findFirst.mockResolvedValue(
        makeLote({
          estado: 'COMPLETADO_CON_ERRORES',
          erroresLog: [
            { empleadoId: 'emp-002', cedula: '222', error: 'PDF falló' },
            {
              empleadoId: 'emp-002',
              cedula: '222',
              error: 'PDF falló de nuevo',
            },
          ],
        }),
      );
      mockEngine.procesarLote.mockResolvedValue(
        makeLote({ estado: 'COMPLETADO' }),
      );

      await service.retry(TENANT_ID, USER_ID, 'lote-001');

      expect(mockEngine.procesarLote).toHaveBeenCalledWith('lote-001', {
        retry: true,
        employeeIds: ['emp-002'],
      });
    });

    it('rechaza PENDIENTE', async () => {
      mockPrisma.loteContrato.findFirst.mockResolvedValue(
        makeLote({ estado: 'PENDIENTE' }),
      );

      await expect(
        service.retry(TENANT_ID, USER_ID, 'lote-001'),
      ).rejects.toThrow(ConflictException);
    });

    it('rechaza EN_PROCESO', async () => {
      mockPrisma.loteContrato.findFirst.mockResolvedValue(
        makeLote({ estado: 'EN_PROCESO' }),
      );

      await expect(
        service.retry(TENANT_ID, USER_ID, 'lote-001'),
      ).rejects.toThrow(ConflictException);
    });

    it('rechaza COMPLETADO', async () => {
      mockPrisma.loteContrato.findFirst.mockResolvedValue(
        makeLote({ estado: 'COMPLETADO' }),
      );

      await expect(
        service.retry(TENANT_ID, USER_ID, 'lote-001'),
      ).rejects.toThrow(ConflictException);
    });

    it('404 si lote no pertenece al tenant', async () => {
      mockPrisma.loteContrato.findFirst.mockResolvedValue(null);

      await expect(
        service.retry(TENANT_ID, USER_ID, 'lote-inexistente'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
