import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  ContractsService,
  ContractVariablesSnapshot,
} from './contracts.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
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
};

const mockAudit = { log: jest.fn().mockResolvedValue(undefined) };

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
});
