import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  ContractsService,
  ContractVariablesSnapshot,
} from './contracts.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { GeneratedDocumentsService } from '../generated-documents/generated-documents.service';
import { ContratoTipo } from './dto/create-contract.dto';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockEmpleadoFindFirst = jest.fn();
const mockContratoCreate = jest.fn();
const mockContratoFindFirst = jest.fn();
const mockContratoFindMany = jest.fn();
const mockContratoCount = jest.fn();
const mockContratoUpdate = jest.fn();
const mockTenantFindUnique = jest.fn();
const mockSedeFindFirst = jest.fn();
const mockPlantillaFindFirst = jest.fn();
const mockDocumentTemplateFindFirst = jest.fn();
const mockDocumentTemplateFindMany = jest.fn();
const mockGeneratedDocumentFindFirst = jest.fn();
const mockGeneratedDocumentCreate = jest.fn();

const mockPrisma = {
  empleado: { findFirst: mockEmpleadoFindFirst },
  contrato: {
    create: mockContratoCreate,
    findFirst: mockContratoFindFirst,
    findMany: mockContratoFindMany,
    count: mockContratoCount,
    update: mockContratoUpdate,
  },
  tenant: { findUnique: mockTenantFindUnique },
  sede: { findFirst: mockSedeFindFirst },
  plantilla: { findFirst: mockPlantillaFindFirst },
  documentTemplate: {
    findFirst: mockDocumentTemplateFindFirst,
    findMany: mockDocumentTemplateFindMany,
  },
  generatedDocument: {
    findFirst: mockGeneratedDocumentFindFirst,
    create: mockGeneratedDocumentCreate,
  },
};

const mockAudit = { log: jest.fn().mockResolvedValue(undefined) };

const mockGeneratePdf = jest.fn();
const mockGenDocsService = { generatePdf: mockGeneratePdf };

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-001';
const USER_ID = 'user-001';

function makeEmployee(overrides: Record<string, unknown> = {}) {
  return {
    id: 'emp-001',
    primerNombre: 'María',
    segundoNombre: 'Elena',
    primerApellido: 'García',
    segundoApellido: 'López',
    tipoDocumento: 'CC',
    cedula: '1234567890',
    ...overrides,
  };
}

function makeTenant(overrides: Record<string, unknown> = {}) {
  return {
    nombre: 'Colegio ABC',
    razonSocial: 'Colegio ABC S.A.S.',
    nit: '900123456',
    representanteLegal: 'Juan Pérez',
    ...overrides,
  };
}

function makeSede(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sede-001',
    nombre: 'Sede Norte',
    ...overrides,
  };
}

function makeCreateDto(overrides: Record<string, unknown> = {}) {
  return {
    employeeId: 'emp-001',
    cargo: 'Docente de Matemáticas',
    salario: 3500000,
    tipo: ContratoTipo.TERMINO_FIJO,
    fechaInicio: '2026-02-01',
    fechaFin: '2026-12-15',
    ...overrides,
  };
}

function makeContract(overrides: Record<string, unknown> = {}) {
  return {
    id: 'contract-001',
    tenantId: TENANT_ID,
    empleadoId: 'emp-001',
    cargo: 'Docente de Matemáticas',
    salario: 3500000,
    tipo: 'TERMINO_FIJO',
    estado: 'VIGENTE',
    fechaInicio: new Date('2026-02-01'),
    fechaFin: new Date('2026-12-15'),
    variablesSnapshot: {},
    empleado: {
      id: 'emp-001',
      primerNombre: 'María',
      primerApellido: 'García',
      cedula: '1234567890',
    },
    sede: null,
    ...overrides,
  };
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('ContractsService', () => {
  let service: ContractsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        ContractsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: GeneratedDocumentsService, useValue: mockGenDocsService },
      ],
    }).compile();

    service = module.get(ContractsService);
  });

  // ── Snapshot: estructura ──────────────────────────────────────────────────

  describe('variablesSnapshot — estructura', () => {
    it('captura snapshot completo al crear un contrato con sede', async () => {
      const emp = makeEmployee();
      const tenant = makeTenant();
      const sede = makeSede();
      const dto = makeCreateDto({ sedeId: 'sede-001' });
      const contract = makeContract();

      mockEmpleadoFindFirst.mockResolvedValue(emp);
      mockSedeFindFirst.mockResolvedValue(sede);
      mockTenantFindUnique.mockResolvedValue(tenant);
      mockContratoCreate.mockResolvedValue(contract);

      await service.create(TENANT_ID, USER_ID, dto);

      const createCall = mockContratoCreate.mock.calls[0][0];
      const snapshot: ContractVariablesSnapshot =
        createCall.data.variablesSnapshot;

      expect(snapshot.empleado).toEqual({
        nombreCompleto: 'María Elena García López',
        primerNombre: 'María',
        segundoNombre: 'Elena',
        primerApellido: 'García',
        segundoApellido: 'López',
        tipoDocumento: 'CC',
        cedula: '1234567890',
      });

      expect(snapshot.contrato).toEqual({
        cargo: 'Docente de Matemáticas',
        salario: '3500000',
        tipo: 'TERMINO_FIJO',
        fechaInicio: '2026-02-01',
        fechaFin: '2026-12-15',
      });

      expect(snapshot.empresa).toEqual({
        nombre: 'Colegio ABC',
        razonSocial: 'Colegio ABC S.A.S.',
        nit: '900123456',
        representanteLegal: 'Juan Pérez',
      });

      expect(snapshot.sede).toEqual({ nombre: 'Sede Norte' });

      expect(snapshot.metadata.version).toBe(1);
      expect(snapshot.metadata.generatedAt).toBeDefined();
    });

    it('sede es null cuando no se asocia sede', async () => {
      mockEmpleadoFindFirst.mockResolvedValue(makeEmployee());
      mockTenantFindUnique.mockResolvedValue(makeTenant());
      mockContratoCreate.mockResolvedValue(makeContract());

      await service.create(TENANT_ID, USER_ID, makeCreateDto());

      const snapshot: ContractVariablesSnapshot =
        mockContratoCreate.mock.calls[0][0].data.variablesSnapshot;
      expect(snapshot.sede).toBeNull();
    });

    it('fechaFin es null para contratos indefinidos', async () => {
      mockEmpleadoFindFirst.mockResolvedValue(makeEmployee());
      mockTenantFindUnique.mockResolvedValue(makeTenant());
      mockContratoCreate.mockResolvedValue(makeContract());

      const dto = makeCreateDto({
        tipo: ContratoTipo.TERMINO_INDEFINIDO,
        fechaFin: undefined,
      });

      await service.create(TENANT_ID, USER_ID, dto);

      const snapshot: ContractVariablesSnapshot =
        mockContratoCreate.mock.calls[0][0].data.variablesSnapshot;
      expect(snapshot.contrato.fechaFin).toBeNull();
      expect(snapshot.contrato.tipo).toBe('TERMINO_INDEFINIDO');
    });

    it('maneja empleado sin segundoNombre ni segundoApellido', async () => {
      const emp = makeEmployee({
        segundoNombre: null,
        segundoApellido: null,
      });

      mockEmpleadoFindFirst.mockResolvedValue(emp);
      mockTenantFindUnique.mockResolvedValue(makeTenant());
      mockContratoCreate.mockResolvedValue(makeContract());

      await service.create(TENANT_ID, USER_ID, makeCreateDto());

      const snapshot: ContractVariablesSnapshot =
        mockContratoCreate.mock.calls[0][0].data.variablesSnapshot;
      expect(snapshot.empleado.nombreCompleto).toBe('María García');
      expect(snapshot.empleado.segundoNombre).toBeNull();
      expect(snapshot.empleado.segundoApellido).toBeNull();
    });

    it('representanteLegal puede ser null en el snapshot', async () => {
      mockEmpleadoFindFirst.mockResolvedValue(makeEmployee());
      mockTenantFindUnique.mockResolvedValue(
        makeTenant({ representanteLegal: null }),
      );
      mockContratoCreate.mockResolvedValue(makeContract());

      await service.create(TENANT_ID, USER_ID, makeCreateDto());

      const snapshot: ContractVariablesSnapshot =
        mockContratoCreate.mock.calls[0][0].data.variablesSnapshot;
      expect(snapshot.empresa.representanteLegal).toBeNull();
    });

    it('salario se persiste como string en el snapshot', async () => {
      mockEmpleadoFindFirst.mockResolvedValue(makeEmployee());
      mockTenantFindUnique.mockResolvedValue(makeTenant());
      mockContratoCreate.mockResolvedValue(makeContract());

      await service.create(
        TENANT_ID,
        USER_ID,
        makeCreateDto({ salario: 1423000.5 }),
      );

      const snapshot: ContractVariablesSnapshot =
        mockContratoCreate.mock.calls[0][0].data.variablesSnapshot;
      expect(snapshot.contrato.salario).toBe('1423000.5');
      expect(typeof snapshot.contrato.salario).toBe('string');
    });
  });

  // ── Snapshot: inmutabilidad ───────────────────────────────────────────────

  describe('variablesSnapshot — inmutabilidad', () => {
    it('updateStatus no modifica variablesSnapshot', async () => {
      const contract = makeContract({
        plantilla: null,
        lote: null,
      });
      mockContratoFindFirst.mockResolvedValue(contract);
      mockContratoUpdate.mockResolvedValue({
        ...contract,
        estado: 'TERMINADO',
      });

      await service.updateStatus(TENANT_ID, USER_ID, 'contract-001', {
        estado: 'TERMINADO' as any,
      });

      const updateCall = mockContratoUpdate.mock.calls[0][0];
      expect(updateCall.data).not.toHaveProperty('variablesSnapshot');
    });
  });

  // ── Validaciones de create ────────────────────────────────────────────────

  describe('create — validaciones', () => {
    it('lanza BadRequestException si el empleado no existe', async () => {
      mockEmpleadoFindFirst.mockResolvedValue(null);

      await expect(
        service.create(TENANT_ID, USER_ID, makeCreateDto()),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza BadRequestException si la sede no existe', async () => {
      mockEmpleadoFindFirst.mockResolvedValue(makeEmployee());
      mockSedeFindFirst.mockResolvedValue(null);

      await expect(
        service.create(
          TENANT_ID,
          USER_ID,
          makeCreateDto({ sedeId: 'sede-bad' }),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza NotFoundException si el tenant no existe', async () => {
      mockEmpleadoFindFirst.mockResolvedValue(makeEmployee());
      mockTenantFindUnique.mockResolvedValue(null);

      await expect(
        service.create(TENANT_ID, USER_ID, makeCreateDto()),
      ).rejects.toThrow(NotFoundException);
    });

    it('lanza BadRequestException si fechaFin <= fechaInicio', async () => {
      mockEmpleadoFindFirst.mockResolvedValue(makeEmployee());

      await expect(
        service.create(
          TENANT_ID,
          USER_ID,
          makeCreateDto({
            fechaInicio: '2026-12-01',
            fechaFin: '2026-01-01',
          }),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza BadRequestException si la plantilla no existe', async () => {
      mockEmpleadoFindFirst.mockResolvedValue(makeEmployee());
      mockPlantillaFindFirst.mockResolvedValue(null);

      await expect(
        service.create(
          TENANT_ID,
          USER_ID,
          makeCreateDto({ plantillaId: 'plantilla-bad' }),
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── Snapshot: metadata ────────────────────────────────────────────────────

  describe('variablesSnapshot — metadata', () => {
    it('generatedAt es un ISO 8601 válido', async () => {
      mockEmpleadoFindFirst.mockResolvedValue(makeEmployee());
      mockTenantFindUnique.mockResolvedValue(makeTenant());
      mockContratoCreate.mockResolvedValue(makeContract());

      await service.create(TENANT_ID, USER_ID, makeCreateDto());

      const snapshot: ContractVariablesSnapshot =
        mockContratoCreate.mock.calls[0][0].data.variablesSnapshot;
      const parsed = new Date(snapshot.metadata.generatedAt);
      expect(parsed.toISOString()).toBe(snapshot.metadata.generatedAt);
    });

    it('version es siempre 1 para nuevos contratos', async () => {
      mockEmpleadoFindFirst.mockResolvedValue(makeEmployee());
      mockTenantFindUnique.mockResolvedValue(makeTenant());
      mockContratoCreate.mockResolvedValue(makeContract());

      await service.create(TENANT_ID, USER_ID, makeCreateDto());

      const snapshot: ContractVariablesSnapshot =
        mockContratoCreate.mock.calls[0][0].data.variablesSnapshot;
      expect(snapshot.metadata.version).toBe(1);
    });
  });

  // ── Snapshot: datos contractuales (no operativos) ─────────────────────────

  describe('variablesSnapshot — solo datos contractuales', () => {
    it('usa cargo y salario del DTO, no del empleado', async () => {
      mockEmpleadoFindFirst.mockResolvedValue(makeEmployee());
      mockTenantFindUnique.mockResolvedValue(makeTenant());
      mockContratoCreate.mockResolvedValue(makeContract());

      const dto = makeCreateDto({
        cargo: 'Rector',
        salario: 8000000,
      });

      await service.create(TENANT_ID, USER_ID, dto);

      const snapshot: ContractVariablesSnapshot =
        mockContratoCreate.mock.calls[0][0].data.variablesSnapshot;
      expect(snapshot.contrato.cargo).toBe('Rector');
      expect(snapshot.contrato.salario).toBe('8000000');
    });

    it('no incluye campos operativos del empleado (eps, arl, etc.)', async () => {
      mockEmpleadoFindFirst.mockResolvedValue(makeEmployee());
      mockTenantFindUnique.mockResolvedValue(makeTenant());
      mockContratoCreate.mockResolvedValue(makeContract());

      await service.create(TENANT_ID, USER_ID, makeCreateDto());

      const snapshot =
        mockContratoCreate.mock.calls[0][0].data.variablesSnapshot;
      const flatJson = JSON.stringify(snapshot);
      expect(flatJson).not.toContain('eps');
      expect(flatJson).not.toContain('arl');
      expect(flatJson).not.toContain('fondoPension');
      expect(flatJson).not.toContain('cajaCompensacion');
      expect(flatJson).not.toContain('fechaNacimiento');
      expect(flatJson).not.toContain('telefono');
      expect(flatJson).not.toContain('email');
    });
  });

  // ── Auditoría ─────────────────────────────────────────────────────────────

  describe('create — auditoría', () => {
    it('registra evento CONTRACT_CREATE en auditoría', async () => {
      mockEmpleadoFindFirst.mockResolvedValue(makeEmployee());
      mockTenantFindUnique.mockResolvedValue(makeTenant());
      const contract = makeContract();
      mockContratoCreate.mockResolvedValue(contract);

      await service.create(TENANT_ID, USER_ID, makeCreateDto());

      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_ID,
          userId: USER_ID,
          action: 'CONTRACT_CREATE',
          entityType: 'Contrato',
          entityId: contract.id,
        }),
      );
    });
  });

  // ── generateDocument ────────────────────────────────────────────────────

  describe('generateDocument', () => {
    const SNAPSHOT: ContractVariablesSnapshot = {
      empleado: {
        nombreCompleto: 'María Elena García López',
        primerNombre: 'María',
        segundoNombre: 'Elena',
        primerApellido: 'García',
        segundoApellido: 'López',
        tipoDocumento: 'CC',
        cedula: '1234567890',
      },
      contrato: {
        cargo: 'Docente de Matemáticas',
        salario: '3500000',
        tipo: 'TERMINO_FIJO',
        fechaInicio: '2026-02-01',
        fechaFin: '2026-12-15',
      },
      empresa: {
        nombre: 'Colegio ABC',
        razonSocial: 'Colegio ABC S.A.S.',
        nit: '900123456',
        representanteLegal: 'Juan Pérez',
      },
      sede: { nombre: 'Sede Norte' },
      metadata: { generatedAt: '2026-02-01T00:00:00.000Z', version: 1 },
    };

    function makeContractWithSnapshot(overrides: Record<string, unknown> = {}) {
      return {
        id: 'contract-001',
        tenantId: TENANT_ID,
        empleadoId: 'emp-001',
        variablesSnapshot: SNAPSHOT,
        ...overrides,
      };
    }

    function makeTemplate(overrides: Record<string, unknown> = {}) {
      return {
        id: 'template-001',
        tenantId: TENANT_ID,
        nombre: 'Contrato Laboral',
        tipo: 'CONTRACT',
        contenido: '<p>Empleado: {{NOMBRE_COMPLETO}}, Cargo: {{CARGO}}</p>',
        activo: true,
        deletedAt: null,
        createdAt: new Date(),
        ...overrides,
      };
    }

    function setupSuccessful(opts?: { useExplicitTemplate?: boolean }) {
      mockContratoFindFirst.mockResolvedValue(makeContractWithSnapshot());
      if (opts?.useExplicitTemplate) {
        mockDocumentTemplateFindFirst.mockResolvedValue(makeTemplate());
      } else {
        mockDocumentTemplateFindMany.mockResolvedValue([makeTemplate()]);
      }
      mockGeneratedDocumentFindFirst.mockResolvedValue(null);
      mockGeneratedDocumentCreate.mockResolvedValue({
        id: 'gendoc-001',
        tenantId: TENANT_ID,
      });
      mockGeneratePdf.mockResolvedValue({
        id: 'gendoc-001',
        pdfUrl: '/uploads/pdfs/test.pdf',
        nombre: 'Contrato — María Elena García López',
      });
    }

    it('lanza NotFoundException si el contrato no existe', async () => {
      mockContratoFindFirst.mockResolvedValue(null);

      await expect(
        service.generateDocument(TENANT_ID, USER_ID, 'contract-bad'),
      ).rejects.toThrow(NotFoundException);
    });

    it('lanza NotFoundException si el contrato no pertenece al tenant', async () => {
      mockContratoFindFirst.mockResolvedValue(null);

      await expect(
        service.generateDocument('other-tenant', USER_ID, 'contract-001'),
      ).rejects.toThrow(NotFoundException);
    });

    it('lanza NotFoundException si no hay plantilla CONTRACT activa', async () => {
      mockContratoFindFirst.mockResolvedValue(makeContractWithSnapshot());
      mockDocumentTemplateFindMany.mockResolvedValue([]);

      await expect(
        service.generateDocument(TENANT_ID, USER_ID, 'contract-001'),
      ).rejects.toThrow(NotFoundException);
    });

    it('lanza NotFoundException si el templateId explícito no existe', async () => {
      mockContratoFindFirst.mockResolvedValue(makeContractWithSnapshot());
      mockDocumentTemplateFindFirst.mockResolvedValue(null);

      await expect(
        service.generateDocument(TENANT_ID, USER_ID, 'contract-001', {
          templateId: 'template-bad',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('lanza BadRequestException si el template no es tipo CONTRACT', async () => {
      mockContratoFindFirst.mockResolvedValue(makeContractWithSnapshot());
      mockDocumentTemplateFindFirst.mockResolvedValue(
        makeTemplate({ tipo: 'CERTIFICATION' }),
      );

      await expect(
        service.generateDocument(TENANT_ID, USER_ID, 'contract-001', {
          templateId: 'template-001',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza BadRequestException si el template está inactivo', async () => {
      mockContratoFindFirst.mockResolvedValue(makeContractWithSnapshot());
      mockDocumentTemplateFindFirst.mockResolvedValue(
        makeTemplate({ activo: false }),
      );

      await expect(
        service.generateDocument(TENANT_ID, USER_ID, 'contract-001', {
          templateId: 'template-001',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza BadRequestException si ya existe documento generado para el contrato', async () => {
      mockContratoFindFirst.mockResolvedValue(makeContractWithSnapshot());
      mockDocumentTemplateFindMany.mockResolvedValue([makeTemplate()]);
      mockGeneratedDocumentFindFirst.mockResolvedValue({ id: 'existing-doc' });

      await expect(
        service.generateDocument(TENANT_ID, USER_ID, 'contract-001'),
      ).rejects.toThrow(BadRequestException);
    });

    it('crea GeneratedDocument con contratoId vinculado', async () => {
      setupSuccessful();

      await service.generateDocument(TENANT_ID, USER_ID, 'contract-001');

      expect(mockGeneratedDocumentCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: TENANT_ID,
          employeeId: 'emp-001',
          templateId: 'template-001',
          contratoId: 'contract-001',
          tipo: 'CONTRACT',
        }),
      });
    });

    it('usa variablesSnapshot para reemplazar variables del template', async () => {
      setupSuccessful();

      await service.generateDocument(TENANT_ID, USER_ID, 'contract-001');

      const createCall = mockGeneratedDocumentCreate.mock.calls[0][0];
      expect(createCall.data.contenidoFinal).toContain(
        'María Elena García López',
      );
      expect(createCall.data.contenidoFinal).toContain(
        'Docente de Matemáticas',
      );
      expect(createCall.data.contenidoFinal).not.toContain(
        '{{NOMBRE_COMPLETO}}',
      );
      expect(createCall.data.contenidoFinal).not.toContain('{{CARGO}}');
    });

    it('delega la generación de PDF a GeneratedDocumentsService.generatePdf', async () => {
      setupSuccessful();

      const result = await service.generateDocument(
        TENANT_ID,
        USER_ID,
        'contract-001',
      );

      expect(mockGeneratePdf).toHaveBeenCalledWith(
        TENANT_ID,
        USER_ID,
        'gendoc-001',
      );
      expect(result).toEqual({
        id: 'gendoc-001',
        pdfUrl: '/uploads/pdfs/test.pdf',
        nombre: 'Contrato — María Elena García López',
      });
    });

    it('genera nombre del documento con nombre del empleado del snapshot', async () => {
      setupSuccessful();

      await service.generateDocument(TENANT_ID, USER_ID, 'contract-001');

      const createCall = mockGeneratedDocumentCreate.mock.calls[0][0];
      expect(createCall.data.nombre).toBe(
        'Contrato — María Elena García López',
      );
    });

    it('auto-selecciona plantilla CONTRACT activa si no se provee templateId', async () => {
      setupSuccessful();

      await service.generateDocument(TENANT_ID, USER_ID, 'contract-001');

      expect(mockDocumentTemplateFindMany).toHaveBeenCalledWith({
        where: {
          tenantId: TENANT_ID,
          tipo: 'CONTRACT',
          activo: true,
          deletedAt: null,
        },
      });
    });

    it('busca por templateId explícito cuando se provee', async () => {
      setupSuccessful({ useExplicitTemplate: true });

      await service.generateDocument(TENANT_ID, USER_ID, 'contract-001', {
        templateId: 'template-001',
      });

      expect(mockDocumentTemplateFindFirst).toHaveBeenCalledWith({
        where: {
          id: 'template-001',
          tenantId: TENANT_ID,
          deletedAt: null,
        },
      });
    });

    // ── Snapshot legacy ───────────────────────────────────────────────────

    it('lanza BadRequestException si variablesSnapshot es vacío ({})', async () => {
      mockContratoFindFirst.mockResolvedValue(
        makeContractWithSnapshot({ variablesSnapshot: {} }),
      );
      mockDocumentTemplateFindMany.mockResolvedValue([makeTemplate()]);
      mockGeneratedDocumentFindFirst.mockResolvedValue(null);

      await expect(
        service.generateDocument(TENANT_ID, USER_ID, 'contract-001'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.generateDocument(TENANT_ID, USER_ID, 'contract-001'),
      ).rejects.toThrow(/variablesSnapshot incompatible/);
    });

    it('lanza BadRequestException si variablesSnapshot no tiene metadata.version', async () => {
      const snapshotSinVersion = {
        empleado: SNAPSHOT.empleado,
        contrato: SNAPSHOT.contrato,
        empresa: SNAPSHOT.empresa,
        sede: SNAPSHOT.sede,
      };
      mockContratoFindFirst.mockResolvedValue(
        makeContractWithSnapshot({ variablesSnapshot: snapshotSinVersion }),
      );
      mockDocumentTemplateFindMany.mockResolvedValue([makeTemplate()]);
      mockGeneratedDocumentFindFirst.mockResolvedValue(null);

      await expect(
        service.generateDocument(TENANT_ID, USER_ID, 'contract-001'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.generateDocument(TENANT_ID, USER_ID, 'contract-001'),
      ).rejects.toThrow(/variablesSnapshot incompatible/);
    });

    it('acepta variablesSnapshot válido sin error', async () => {
      setupSuccessful();

      await expect(
        service.generateDocument(TENANT_ID, USER_ID, 'contract-001'),
      ).resolves.not.toThrow();
    });

    // ── Selección de plantilla: ambigüedad ────────────────────────────────

    it('lanza BadRequestException cuando existen múltiples plantillas CONTRACT activas', async () => {
      mockContratoFindFirst.mockResolvedValue(makeContractWithSnapshot());
      mockDocumentTemplateFindMany.mockResolvedValue([
        makeTemplate({ id: 'template-001' }),
        makeTemplate({ id: 'template-002', nombre: 'Contrato Alternativo' }),
      ]);

      await expect(
        service.generateDocument(TENANT_ID, USER_ID, 'contract-001'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.generateDocument(TENANT_ID, USER_ID, 'contract-001'),
      ).rejects.toThrow(/Indique templateId/);
    });

    it('con templateId explícito ignora la ambigüedad de múltiples plantillas', async () => {
      setupSuccessful({ useExplicitTemplate: true });

      await expect(
        service.generateDocument(TENANT_ID, USER_ID, 'contract-001', {
          templateId: 'template-001',
        }),
      ).resolves.not.toThrow();
    });

    it('incluye el contratoId en el mensaje de error de snapshot legacy', async () => {
      mockContratoFindFirst.mockResolvedValue(
        makeContractWithSnapshot({
          id: 'contract-legacy-99',
          variablesSnapshot: {},
        }),
      );
      mockDocumentTemplateFindMany.mockResolvedValue([makeTemplate()]);
      mockGeneratedDocumentFindFirst.mockResolvedValue(null);

      await expect(
        service.generateDocument(TENANT_ID, USER_ID, 'contract-legacy-99'),
      ).rejects.toThrow(/contract-legacy-99/);
    });
  });
});
