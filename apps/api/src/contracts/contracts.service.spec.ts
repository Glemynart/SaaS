import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Test } from '@nestjs/testing';
import {
  ContractsService,
  ContractVariablesSnapshot,
} from './contracts.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import { AuditService } from '../audit/audit.service';
import { GeneratedDocumentsService } from '../generated-documents/generated-documents.service';
import { ExpedienteDocsService } from '../expediente-docs/expediente-docs.service';
import { ContratoTipo } from './dto/create-contract.dto';
import { ContratoEstado } from './dto/update-contract-status.dto';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockEmpleadoFindFirst = jest.fn();
const mockContratoCreate = jest.fn();
const mockContratoFindFirst = jest.fn();
const mockContratoFindMany = jest.fn();
const mockContratoCount = jest.fn();
const mockContratoUpdate = jest.fn();
const mockTenantFindUnique = jest.fn();
const mockSedeFindFirst = jest.fn();
const mockPerfilContractualFindFirst = jest.fn();
const mockDocumentTemplateFindFirst = jest.fn();
const mockDocumentTemplateFindMany = jest.fn();
const mockGeneratedDocumentFindFirst = jest.fn();
const mockGeneratedDocumentCreate = jest.fn();
const mockGeneratedDocumentDelete = jest.fn();

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
  perfilContractual: { findFirst: mockPerfilContractualFindFirst },
  documentTemplate: {
    findFirst: mockDocumentTemplateFindFirst,
    findMany: mockDocumentTemplateFindMany,
  },
  generatedDocument: {
    findFirst: mockGeneratedDocumentFindFirst,
    create: mockGeneratedDocumentCreate,
    delete: mockGeneratedDocumentDelete,
  },
};
const mockTenantPrisma = {
  execute: jest.fn((work: (client: typeof mockPrisma) => unknown) =>
    work(mockPrisma),
  ),
};

const mockAudit = { log: jest.fn().mockResolvedValue(undefined) };

const mockMaterializePdf = jest.fn();
const mockGenDocsService = { materializePdf: mockMaterializePdf };
const mockPublishGeneratedDocument = jest.fn();
const mockExpedienteDocsService = {
  publishGeneratedDocument: mockPublishGeneratedDocument,
};

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
    mockContratoFindFirst.mockResolvedValue(null);
    mockGeneratedDocumentFindFirst.mockResolvedValue(null);
    mockMaterializePdf.mockResolvedValue({
      id: 'gendoc-001',
      pdfUrl: '/uploads/pdfs/test.pdf',
    });
    mockPublishGeneratedDocument.mockResolvedValue({ outcome: 'CREATED' });

    const module = await Test.createTestingModule({
      providers: [
        ContractsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: TenantPrismaService, useValue: mockTenantPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: GeneratedDocumentsService, useValue: mockGenDocsService },
        {
          provide: ExpedienteDocsService,
          useValue: mockExpedienteDocsService,
        },
      ],
    }).compile();

    service = module.get(ContractsService);
  });

  describe('tenant isolation contracts', () => {
    it('always applies the tenant filter when listing contracts', async () => {
      mockContratoFindMany.mockResolvedValue([]);
      mockContratoCount.mockResolvedValue(0);

      await service.findAll(TENANT_ID, { page: 1, limit: 10 });

      const expectedWhere = { tenantId: TENANT_ID };
      expect(mockContratoFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere }),
      );
      expect(mockContratoCount).toHaveBeenCalledWith({ where: expectedWhere });
    });

    it('does not read a contract belonging to another tenant', async () => {
      mockContratoFindFirst.mockResolvedValue(null);

      await expect(
        service.findOne('other-tenant', 'contract-001'),
      ).rejects.toThrow(NotFoundException);

      expect(mockContratoFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'contract-001', tenantId: 'other-tenant' },
        }),
      );
    });

    it('expone la única referencia documental contractual desde la consulta existente', async () => {
      mockContratoFindFirst.mockResolvedValue(
        makeContract({
          generatedDocuments: [
            {
              id: 'gendoc-001',
              nombre: 'Contrato — María García',
              pdfUrl: '/uploads/pdfs/tenant-001-gendoc-001.pdf',
              pdfStorageKey: 'pdfs/tenant-001-gendoc-001.pdf',
              expedienteDocs: [{ id: 'expediente-001' }],
            },
          ],
        }),
      );

      const result = await service.findOne(TENANT_ID, 'contract-001');

      expect(result.generatedDocument).toEqual({
        id: 'gendoc-001',
        nombre: 'Contrato — María García',
        pdfUrl: '/uploads/pdfs/tenant-001-gendoc-001.pdf',
        pdfStorageKey: 'pdfs/tenant-001-gendoc-001.pdf',
        expedienteDocId: 'expediente-001',
      });
      expect(mockContratoFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'contract-001', tenantId: TENANT_ID },
          include: expect.objectContaining({
            generatedDocuments: expect.objectContaining({
              where: { tenantId: TENANT_ID, tipo: 'CONTRACT' },
              take: 1,
            }),
          }),
        }),
      );
    });

    it('rejects a cross-tenant status update before issuing a write', async () => {
      mockContratoFindFirst.mockResolvedValue(null);

      await expect(
        service.updateStatus('other-tenant', USER_ID, 'contract-001', {
          estado: ContratoEstado.TERMINADO,
        }),
      ).rejects.toThrow(NotFoundException);

      expect(mockContratoFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'contract-001', tenantId: 'other-tenant' },
        }),
      );
      expect(mockContratoUpdate).not.toHaveBeenCalled();
    });
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

    it('conserva el perfil y los snapshots confirmados de una campaña', async () => {
      const historicalSnapshot = {
        empleado: {
          id: 'emp-001',
          primerNombre: 'Nombre confirmado',
          segundoNombre: null,
          primerApellido: 'Apellido confirmado',
          segundoApellido: null,
          tipoDocumento: 'CC',
          cedula: '111222333',
          cargo: 'Cargo confirmado',
          salario: '3200000',
          tipoContrato: 'TERMINO_FIJO',
          fechaIngreso: '2026-01-01T00:00:00.000Z',
          sedeId: null,
          sede: null,
        },
        contrato: {
          cargo: 'Cargo confirmado',
          salario: '3200000',
          tipo: 'TERMINO_FIJO',
          fechaInicio: '2026-02-01T00:00:00.000Z',
          fechaFin: '2026-12-15T00:00:00.000Z',
          sedeId: null,
          sede: null,
        },
      };
      mockEmpleadoFindFirst.mockResolvedValue(makeEmployee());
      mockPerfilContractualFindFirst.mockResolvedValue({ id: 'profile-001' });
      mockTenantFindUnique.mockResolvedValue(makeTenant());
      mockContratoCreate.mockResolvedValue(makeContract());

      await service.create(
        TENANT_ID,
        USER_ID,
        makeCreateDto({ cargo: 'Cargo actual', salario: 9999999 }),
        'lote-001',
        {
          perfilContractualId: 'profile-001',
          historicalSnapshot,
        },
      );

      const createCalls = mockContratoCreate.mock.calls as unknown as Array<
        unknown[]
      >;
      const createCall = createCalls[0]?.[0] as {
        data: Record<string, unknown> & {
          variablesSnapshot: ContractVariablesSnapshot;
        };
      };
      expect(createCall.data).toEqual(
        expect.objectContaining({
          perfilContractualId: 'profile-001',
          cargo: 'Cargo confirmado',
          salario: 3200000,
          fechaInicio: new Date('2026-02-01T00:00:00.000Z'),
          fechaFin: new Date('2026-12-15T00:00:00.000Z'),
        }),
      );
      expect(createCall.data.variablesSnapshot.empleado).toEqual(
        expect.objectContaining({
          nombreCompleto: 'Nombre confirmado Apellido confirmado',
          cedula: '111222333',
        }),
      );
      expect(createCall.data.variablesSnapshot.contrato).toEqual(
        expect.objectContaining({
          cargo: 'Cargo confirmado',
          salario: '3200000',
        }),
      );
      expect(mockPerfilContractualFindFirst).toHaveBeenCalledWith({
        where: { id: 'profile-001', tenantId: TENANT_ID },
        select: { id: true },
      });
    });

    it('rechaza un perfil contractual de otro tenant', async () => {
      mockEmpleadoFindFirst.mockResolvedValue(makeEmployee());
      mockPerfilContractualFindFirst.mockResolvedValue(null);

      await expect(
        service.create(TENANT_ID, USER_ID, makeCreateDto(), undefined, {
          perfilContractualId: 'profile-other-tenant',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockPerfilContractualFindFirst).toHaveBeenCalledWith({
        where: { id: 'profile-other-tenant', tenantId: TENANT_ID },
        select: { id: true },
      });
      expect(mockContratoCreate).not.toHaveBeenCalled();
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
    it.each([
      ContratoEstado.VENCIDO,
      ContratoEstado.TERMINADO,
      ContratoEstado.RENOVADO,
    ])(
      'bloquea la transición a %s cuando no existe documento contractual',
      async (estado) => {
        const contract = makeContract({
          plantilla: null,
          lote: null,
          generatedDocument: null,
        });
        mockContratoFindFirst.mockResolvedValue(contract);

        await expect(
          service.updateStatus(TENANT_ID, USER_ID, 'contract-001', {
            estado,
          }),
        ).rejects.toThrow('debe tener un documento contractual publicado');

        expect(mockContratoUpdate).not.toHaveBeenCalled();
      },
    );

    it('permite la transición terminal cuando existe un documento contractual', async () => {
      const contract = makeContract({
        generatedDocuments: [
          {
            id: 'gendoc-001',
            nombre: 'Contrato — María García',
            pdfUrl: '/uploads/pdfs/tenant-001-gendoc-001.pdf',
            pdfStorageKey: 'pdfs/tenant-001-gendoc-001.pdf',
            expedienteDocs: [{ id: 'expediente-001' }],
          },
        ],
      });
      mockContratoFindFirst.mockResolvedValue(contract);
      mockContratoUpdate.mockResolvedValue({ ...contract, estado: 'VENCIDO' });

      await service.updateStatus(TENANT_ID, USER_ID, 'contract-001', {
        estado: ContratoEstado.VENCIDO,
      });

      expect(mockContratoUpdate).toHaveBeenCalledWith({
        where: { id: 'contract-001', tenantId: TENANT_ID },
        data: { estado: 'VENCIDO' },
      });
    });

    it('bloquea la transición terminal si existe la identidad pero falta la publicación', async () => {
      const contract = makeContract({
        generatedDocuments: [
          {
            id: 'gendoc-001',
            nombre: 'Contrato — María García',
            pdfStorageKey: null,
            pdfUrl: null,
            expedienteDocs: [],
          },
        ],
      });
      mockContratoFindFirst.mockResolvedValue(contract);

      await expect(
        service.updateStatus(TENANT_ID, USER_ID, 'contract-001', {
          estado: ContratoEstado.TERMINADO,
        }),
      ).rejects.toThrow('debe tener un documento contractual publicado');

      expect(mockContratoUpdate).not.toHaveBeenCalled();
    });

    it('updateStatus no modifica variablesSnapshot', async () => {
      const contract = makeContract({
        plantilla: null,
        lote: null,
        generatedDocuments: [
          {
            id: 'gendoc-001',
            nombre: 'Contrato — María García',
            pdfUrl: '/uploads/pdfs/tenant-001-gendoc-001.pdf',
            pdfStorageKey: 'pdfs/tenant-001-gendoc-001.pdf',
            expedienteDocs: [{ id: 'expediente-001' }],
          },
        ],
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

    it('permite crear otro contrato del mismo empleado en un año posterior', async () => {
      mockEmpleadoFindFirst.mockResolvedValue(makeEmployee());
      mockContratoFindFirst.mockImplementation(({ where }) =>
        where.anioContrato === 2026 ? { id: 'contrato-2026' } : null,
      );
      mockTenantFindUnique.mockResolvedValue(makeTenant());
      mockContratoCreate.mockResolvedValue(makeContract());

      await service.create(
        TENANT_ID,
        USER_ID,
        makeCreateDto({
          fechaInicio: '2027-01-01',
          fechaFin: '2027-12-15',
        }),
      );

      expect(mockContratoFindFirst).toHaveBeenCalledWith({
        where: {
          tenantId: TENANT_ID,
          empleadoId: 'emp-001',
          anioContrato: 2027,
        },
        select: { id: true },
      });
      expect(mockContratoCreate.mock.calls[0]?.[0].data.anioContrato).toBe(
        2027,
      );
    });

    it('rechaza un segundo contrato del empleado en el mismo año', async () => {
      mockEmpleadoFindFirst.mockResolvedValue(makeEmployee());
      mockContratoFindFirst.mockResolvedValue({ id: 'contrato-2026' });

      await expect(
        service.create(TENANT_ID, USER_ID, makeCreateDto()),
      ).rejects.toThrow(ConflictException);
      await expect(
        service.create(TENANT_ID, USER_ID, makeCreateDto()),
      ).rejects.toThrow('Ya existe un contrato para este empleado en 2026.');
      expect(mockContratoCreate).not.toHaveBeenCalled();
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

  describe('ensureGeneratedDocument', () => {
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

    function makeDocumentContract(overrides: Record<string, unknown> = {}) {
      return {
        id: 'contract-001',
        tenantId: TENANT_ID,
        empleadoId: 'emp-001',
        estado: 'VIGENTE',
        variablesSnapshot: SNAPSHOT,
        empleado: { deletedAt: null },
        ...overrides,
      };
    }

    function makeTemplate(overrides: Record<string, unknown> = {}) {
      return {
        id: 'template-001',
        tenantId: TENANT_ID,
        nombre: 'Contrato Laboral',
        tipo: 'CONTRACT',
        contenido: '<p>{{NOMBRE_COMPLETO}} — {{CARGO}}</p>',
        activo: true,
        deletedAt: null,
        createdAt: new Date(),
        ...overrides,
      };
    }

    it('crea la identidad documental desde el snapshot sin invocar PDF', async () => {
      mockContratoFindFirst.mockResolvedValue(makeDocumentContract());
      mockGeneratedDocumentFindFirst.mockResolvedValue(null);
      mockDocumentTemplateFindMany.mockResolvedValue([makeTemplate()]);
      mockGeneratedDocumentCreate.mockResolvedValue({ id: 'gendoc-001' });

      const result = await service.ensureGeneratedDocument(
        TENANT_ID,
        'contract-001',
      );

      expect(result).toEqual({
        outcome: 'CREATED',
        document: { id: 'gendoc-001' },
      });
      expect(mockGeneratedDocumentCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          contratoId: 'contract-001',
          contenidoFinal:
            '<p>María Elena García López — Docente de Matemáticas</p>',
        }),
      });
      expect(mockMaterializePdf).not.toHaveBeenCalled();
    });

    it('devuelve el documento existente sin validar nuevamente la plantilla', async () => {
      const existing = { id: 'gendoc-existing', contratoId: 'contract-001' };
      mockContratoFindFirst.mockResolvedValue(makeDocumentContract());
      mockGeneratedDocumentFindFirst.mockResolvedValue(existing);

      await expect(
        service.ensureGeneratedDocument(TENANT_ID, 'contract-001'),
      ).resolves.toEqual({ outcome: 'EXISTING', document: existing });

      expect(mockDocumentTemplateFindMany).not.toHaveBeenCalled();
      expect(mockGeneratedDocumentCreate).not.toHaveBeenCalled();
    });

    it('lee la relación del empleado dentro del contexto tenant', async () => {
      const existing = { id: 'gendoc-existing', contratoId: 'contract-001' };
      const scopedFindFirst = jest
        .fn()
        .mockResolvedValue(makeDocumentContract());
      mockContratoFindFirst.mockRejectedValue(
        new Error('La relación empleado no es visible fuera del tenant'),
      );
      mockTenantPrisma.execute.mockImplementationOnce(
        (work: (client: typeof mockPrisma) => unknown) =>
          work({
            ...mockPrisma,
            contrato: { ...mockPrisma.contrato, findFirst: scopedFindFirst },
          }),
      );
      mockGeneratedDocumentFindFirst.mockResolvedValue(existing);

      await expect(
        service.ensureGeneratedDocument(TENANT_ID, 'contract-001'),
      ).resolves.toEqual({ outcome: 'EXISTING', document: existing });

      expect(scopedFindFirst).toHaveBeenCalledWith({
        where: { id: 'contract-001', tenantId: TENANT_ID },
        include: { empleado: { select: { deletedAt: true } } },
      });
      expect(mockContratoFindFirst).not.toHaveBeenCalled();
    });

    it('recupera un documento existente aunque el contrato ya no esté vigente', async () => {
      const existing = { id: 'gendoc-existing', contratoId: 'contract-001' };
      mockContratoFindFirst.mockResolvedValue(
        makeDocumentContract({ estado: 'VENCIDO' }),
      );
      mockGeneratedDocumentFindFirst.mockResolvedValue(existing);

      await expect(
        service.ensureGeneratedDocument(TENANT_ID, 'contract-001'),
      ).resolves.toEqual({ outcome: 'EXISTING', document: existing });

      expect(mockDocumentTemplateFindMany).not.toHaveBeenCalled();
      expect(mockGeneratedDocumentCreate).not.toHaveBeenCalled();
    });

    it('rechaza un contrato no vigente antes de crear un documento', async () => {
      mockContratoFindFirst.mockResolvedValue(
        makeDocumentContract({ estado: 'VENCIDO' }),
      );

      await expect(
        service.ensureGeneratedDocument(TENANT_ID, 'contract-001'),
      ).rejects.toThrow('contrato VIGENTE');

      expect(mockGeneratedDocumentFindFirst).toHaveBeenCalledWith({
        where: { contratoId: 'contract-001', tenantId: TENANT_ID },
      });
    });

    it('rechaza un empleado eliminado', async () => {
      mockContratoFindFirst.mockResolvedValue(
        makeDocumentContract({ empleado: { deletedAt: new Date() } }),
      );

      await expect(
        service.ensureGeneratedDocument(TENANT_ID, 'contract-001'),
      ).rejects.toThrow('empleado eliminado');
    });

    it('relee y devuelve el documento ganador ante una carrera de creación', async () => {
      const existing = { id: 'gendoc-concurrent', contratoId: 'contract-001' };
      mockContratoFindFirst.mockResolvedValue(makeDocumentContract());
      mockGeneratedDocumentFindFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(existing);
      mockDocumentTemplateFindMany.mockResolvedValue([makeTemplate()]);
      mockGeneratedDocumentCreate.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '5.0.0',
          meta: { target: ['contratoId'] },
        }),
      );

      await expect(
        service.ensureGeneratedDocument(TENANT_ID, 'contract-001'),
      ).resolves.toEqual({ outcome: 'EXISTING', document: existing });
    });
  });

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
        estado: 'VIGENTE',
        empleado: { deletedAt: null },
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
        nombre: 'Contrato — María Elena García López',
      });
      mockMaterializePdf.mockResolvedValue({
        id: 'gendoc-001',
        pdfUrl: '/uploads/pdfs/test.pdf',
      });
      mockPublishGeneratedDocument.mockResolvedValue({ outcome: 'CREATED' });
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

    it('reutiliza el documento existente y completa el flujo unificado', async () => {
      mockContratoFindFirst.mockResolvedValue(makeContractWithSnapshot());
      mockGeneratedDocumentFindFirst.mockResolvedValue({
        id: 'existing-doc',
        nombre: 'Contrato existente',
      });

      await expect(
        service.generateDocument(TENANT_ID, USER_ID, 'contract-001'),
      ).resolves.toEqual({
        id: 'existing-doc',
        pdfUrl: '/uploads/pdfs/test.pdf',
        nombre: 'Contrato existente',
      });

      expect(mockGeneratedDocumentCreate).not.toHaveBeenCalled();
      expect(mockMaterializePdf).toHaveBeenCalledWith(
        TENANT_ID,
        'existing-doc',
      );
      expect(mockPublishGeneratedDocument).toHaveBeenCalledWith(
        TENANT_ID,
        USER_ID,
        'existing-doc',
        expect.anything(),
      );
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

    it('reutiliza exactamente la materialización y publicación del flujo unificado', async () => {
      setupSuccessful();

      const result = await service.generateDocument(
        TENANT_ID,
        USER_ID,
        'contract-001',
      );

      expect(mockMaterializePdf).toHaveBeenCalledWith(TENANT_ID, 'gendoc-001');
      expect(mockPublishGeneratedDocument).toHaveBeenCalledWith(
        TENANT_ID,
        USER_ID,
        'gendoc-001',
        expect.anything(),
      );
      expect(mockMaterializePdf.mock.invocationCallOrder[0]).toBeLessThan(
        mockPublishGeneratedDocument.mock.invocationCallOrder[0],
      );
      expect(result).toEqual({
        id: 'gendoc-001',
        pdfUrl: '/uploads/pdfs/test.pdf',
        nombre: 'Contrato — María Elena García López',
      });
    });

    it('es idempotente al invocar dos veces la generación individual', async () => {
      setupSuccessful();
      mockGeneratedDocumentFindFirst
        .mockReset()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'gendoc-001',
          nombre: 'Contrato — María Elena García López',
        });

      await service.generateDocument(TENANT_ID, USER_ID, 'contract-001');
      await service.generateDocument(TENANT_ID, USER_ID, 'contract-001');

      expect(mockGeneratedDocumentCreate).toHaveBeenCalledTimes(1);
      expect(mockMaterializePdf).toHaveBeenCalledTimes(2);
      expect(mockPublishGeneratedDocument).toHaveBeenCalledTimes(2);
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

    // ── Hardening: cleanup huérfano (Parte A) ──────────────────────────────

    it('propaga un fallo de materialización sin eliminar la identidad documental', async () => {
      setupSuccessful();
      const pdfError = new Error('Puppeteer crashed');
      mockMaterializePdf.mockRejectedValue(pdfError);

      await expect(
        service.generateDocument(TENANT_ID, USER_ID, 'contract-001'),
      ).rejects.toThrow(pdfError);

      expect(mockGeneratedDocumentDelete).not.toHaveBeenCalled();
    });

    it('propaga un fallo de publicación sin ejecutar un flujo alternativo', async () => {
      setupSuccessful();
      const publishError = new Error('Publicación fallida');
      mockPublishGeneratedDocument.mockRejectedValue(publishError);

      await expect(
        service.generateDocument(TENANT_ID, USER_ID, 'contract-001'),
      ).rejects.toThrow(publishError);

      expect(mockGeneratedDocumentDelete).not.toHaveBeenCalled();
    });

    // ── Hardening: TOCTOU / unique constraint (Parte B) ────────────────────

    it('recupera la identidad ganadora si el unique index detecta una carrera', async () => {
      mockContratoFindFirst.mockResolvedValue(makeContractWithSnapshot());
      mockDocumentTemplateFindMany.mockResolvedValue([makeTemplate()]);
      mockGeneratedDocumentFindFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'gendoc-concurrent',
          nombre: 'Contrato concurrente',
        });
      mockGeneratedDocumentCreate.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '5.0.0',
          meta: { target: ['contratoId'] },
        }),
      );

      await expect(
        service.generateDocument(TENANT_ID, USER_ID, 'contract-001'),
      ).resolves.toEqual({
        id: 'gendoc-concurrent',
        pdfUrl: '/uploads/pdfs/test.pdf',
        nombre: 'Contrato concurrente',
      });
    });

    // ── Hardening: camino feliz intacto ────────────────────────────────────

    it('no intenta cleanup cuando generatePdf tiene éxito', async () => {
      setupSuccessful();

      await service.generateDocument(TENANT_ID, USER_ID, 'contract-001');

      expect(mockGeneratedDocumentDelete).not.toHaveBeenCalled();
    });
  });
});
