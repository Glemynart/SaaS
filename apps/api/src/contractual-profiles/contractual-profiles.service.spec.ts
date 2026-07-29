import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import { ContractualProfilesService } from './contractual-profiles.service';

const TENANT_ID = 'tenant-001';
const USER_ID = 'user-001';
const PROFILE_ID = '11111111-1111-4111-8111-111111111111';
const CONTRACT_ID = '22222222-2222-4222-8222-222222222222';

const mockProfileFindFirst = jest.fn();
const mockProfileCreate = jest.fn();
const mockProfileFindMany = jest.fn();
const mockProfileUpdate = jest.fn();
const mockContractFindFirst = jest.fn();
const mockContractUpdate = jest.fn();
const mockAuditLog = jest.fn();
const mockExecute = jest.fn();

type MockTenantClient = {
  perfilContractual: {
    findFirst: typeof mockProfileFindFirst;
    findMany: typeof mockProfileFindMany;
    create: typeof mockProfileCreate;
    update: typeof mockProfileUpdate;
  };
  contrato: {
    findFirst: typeof mockContractFindFirst;
    update: typeof mockContractUpdate;
  };
};

function objectContaining<T extends object>(expected: T): T {
  return expect.objectContaining(expected) as T;
}

function makeProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: PROFILE_ID,
    tenantId: TENANT_ID,
    codigo: 'DOCENTE',
    nombre: 'Docente',
    descripcion: null,
    activo: true,
    ...overrides,
  };
}

describe('ContractualProfilesService', () => {
  let service: ContractualProfilesService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuditLog.mockResolvedValue(undefined);
    mockExecute.mockImplementation(
      (
        work: (
          client: MockTenantClient,
          context: { tenantId: string },
        ) => unknown,
      ) =>
        work(
          {
            perfilContractual: {
              findFirst: mockProfileFindFirst,
              findMany: mockProfileFindMany,
              create: mockProfileCreate,
              update: mockProfileUpdate,
            },
            contrato: {
              findFirst: mockContractFindFirst,
              update: mockContractUpdate,
            },
          },
          { tenantId: TENANT_ID },
        ),
    );
    service = new ContractualProfilesService(
      { execute: mockExecute } as unknown as TenantPrismaService,
      { log: mockAuditLog } as unknown as AuditService,
    );
  });

  it('crea un perfil con código estable y lo audita', async () => {
    mockProfileFindFirst.mockResolvedValue(null);
    mockProfileCreate.mockResolvedValue(makeProfile());

    await expect(
      service.create(USER_ID, { codigo: 'DOCENTE', nombre: 'Docente' }),
    ).resolves.toEqual(makeProfile());

    expect(mockProfileCreate).toHaveBeenCalledWith({
      data: { codigo: 'DOCENTE', nombre: 'Docente', tenantId: TENANT_ID },
    });
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CONTRACTUAL_PROFILE_CREATE',
        entityId: PROFILE_ID,
      }),
    );
  });

  it('rechaza un código duplicado dentro del tenant', async () => {
    mockProfileFindFirst.mockResolvedValue({ id: PROFILE_ID });

    await expect(
      service.create(USER_ID, { codigo: 'DOCENTE', nombre: 'Docente' }),
    ).rejects.toThrow(BadRequestException);
    expect(mockProfileCreate).not.toHaveBeenCalled();
  });

  it('actualiza atributos descriptivos sin cambiar el código estable', async () => {
    mockProfileFindFirst.mockResolvedValue(makeProfile());
    mockProfileUpdate.mockResolvedValue(
      makeProfile({ nombre: 'Docente titular', descripcion: 'Escalafón base' }),
    );

    await service.update(USER_ID, PROFILE_ID, {
      nombre: 'Docente titular',
      descripcion: 'Escalafón base',
    });

    expect(mockProfileUpdate).toHaveBeenCalledWith({
      where: { id: PROFILE_ID },
      data: { nombre: 'Docente titular', descripcion: 'Escalafón base' },
    });
  });

  it('activa o inactiva el perfil y conserva la asignación histórica', async () => {
    mockProfileFindFirst.mockResolvedValue(makeProfile({ activo: true }));
    mockProfileUpdate.mockResolvedValue(makeProfile({ activo: false }));

    await service.updateStatus(USER_ID, PROFILE_ID, { activo: false });

    expect(mockProfileUpdate).toHaveBeenCalledWith({
      where: { id: PROFILE_ID },
      data: { activo: false },
    });
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CONTRACTUAL_PROFILE_STATUS_CHANGE',
        metadata: { previousActive: true, active: false },
      }),
    );
  });

  it('asigna explícitamente un perfil activo al contrato del mismo tenant', async () => {
    mockProfileFindFirst.mockResolvedValue(makeProfile());
    mockContractFindFirst.mockResolvedValue({
      id: CONTRACT_ID,
      perfilContractualId: null,
    });
    mockContractUpdate.mockResolvedValue({ id: CONTRACT_ID });

    await service.assignToContract(USER_ID, CONTRACT_ID, {
      perfilContractualId: PROFILE_ID,
    });

    expect(mockContractUpdate).toHaveBeenCalledWith({
      where: { id: CONTRACT_ID },
      data: { perfilContractualId: PROFILE_ID },
    });
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CONTRACTUAL_PROFILE_ASSIGN',
        entityId: CONTRACT_ID,
      }),
    );
  });

  it('rechaza asignar un perfil inactivo o de otro tenant', async () => {
    mockProfileFindFirst.mockResolvedValue(null);

    await expect(
      service.assignToContract(USER_ID, CONTRACT_ID, {
        perfilContractualId: PROFILE_ID,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(mockContractFindFirst).not.toHaveBeenCalled();
    expect(mockContractUpdate).not.toHaveBeenCalled();
  });

  it('rechaza asignar a un contrato que no pertenece al tenant', async () => {
    mockProfileFindFirst.mockResolvedValue(makeProfile());
    mockContractFindFirst.mockResolvedValue(null);

    await expect(
      service.assignToContract(USER_ID, CONTRACT_ID, {
        perfilContractualId: PROFILE_ID,
      }),
    ).rejects.toThrow(NotFoundException);
    expect(mockContractUpdate).not.toHaveBeenCalled();
  });

  it('lista perfiles filtrando siempre por el tenant del contexto', async () => {
    mockProfileFindMany.mockResolvedValue([makeProfile()]);

    await service.findAll({ activo: true, search: 'doc' });

    expect(mockProfileFindMany).toHaveBeenCalledWith(
      objectContaining({
        where: objectContaining({ tenantId: TENANT_ID, activo: true }),
      }),
    );
  });
});
