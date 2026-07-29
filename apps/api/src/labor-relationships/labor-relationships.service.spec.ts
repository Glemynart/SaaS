import { BadRequestException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import { LaborRelationshipsService } from './labor-relationships.service';

const TENANT_ID = 'tenant-001';
const USER_ID = 'user-001';
const EMPLOYEE_ID = '11111111-1111-4111-8111-111111111111';
const PROFILE_ID = '22222222-2222-4222-8222-222222222222';
const RELATIONSHIP_ID = '33333333-3333-4333-8333-333333333333';

const employeeFindFirst = jest.fn();
const profileFindFirst = jest.fn();
const relationshipFindFirst = jest.fn();
const relationshipFindMany = jest.fn();
const relationshipCreate = jest.fn();
const relationshipUpdate = jest.fn();
const auditLog = jest.fn();
const execute = jest.fn();

type MockTenantClient = {
  empleado: { findFirst: typeof employeeFindFirst };
  perfilContractual: { findFirst: typeof profileFindFirst };
  vinculoLaboral: {
    findFirst: typeof relationshipFindFirst;
    findMany: typeof relationshipFindMany;
    create: typeof relationshipCreate;
    update: typeof relationshipUpdate;
  };
};

function objectContaining<T extends object>(expected: T): T {
  return expect.objectContaining(expected) as T;
}

function relationship(overrides: Record<string, unknown> = {}) {
  return {
    id: RELATIONSHIP_ID,
    tenantId: TENANT_ID,
    empleadoId: EMPLOYEE_ID,
    perfilContractualId: PROFILE_ID,
    vigenteDesde: new Date('2026-01-01'),
    vigenteHasta: null,
    activo: true,
    perfilContractual: { id: PROFILE_ID, activo: true },
    ...overrides,
  };
}

describe('LaborRelationshipsService', () => {
  let service: LaborRelationshipsService;

  beforeEach(() => {
    jest.clearAllMocks();
    auditLog.mockResolvedValue(undefined);
    employeeFindFirst.mockResolvedValue({ id: EMPLOYEE_ID });
    profileFindFirst.mockResolvedValue({ id: PROFILE_ID });
    relationshipFindFirst.mockResolvedValue(null);
    execute.mockImplementation(
      (
        work: (
          client: MockTenantClient,
          context: { tenantId: string },
        ) => unknown,
      ) =>
        work(
          {
            empleado: { findFirst: employeeFindFirst },
            perfilContractual: { findFirst: profileFindFirst },
            vinculoLaboral: {
              findFirst: relationshipFindFirst,
              findMany: relationshipFindMany,
              create: relationshipCreate,
              update: relationshipUpdate,
            },
          },
          { tenantId: TENANT_ID },
        ),
    );
    service = new LaborRelationshipsService(
      { execute } as unknown as TenantPrismaService,
      { log: auditLog } as unknown as AuditService,
    );
  });

  it('crea una asociación precontractual explícita sin consultar contratos', async () => {
    relationshipCreate.mockResolvedValue(relationship());

    await service.create(USER_ID, {
      empleadoId: EMPLOYEE_ID,
      perfilContractualId: PROFILE_ID,
      vigenteDesde: '2026-01-01',
    });

    expect(relationshipCreate).toHaveBeenCalledWith(
      objectContaining({
        data: objectContaining({
          tenantId: TENANT_ID,
          empleadoId: EMPLOYEE_ID,
          perfilContractualId: PROFILE_ID,
          activo: true,
        }),
      }),
    );
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'LABOR_RELATIONSHIP_CREATE' }),
    );
  });

  it('actualiza el perfil y la vigencia de una asociación del tenant', async () => {
    relationshipFindFirst.mockResolvedValueOnce(relationship());
    profileFindFirst.mockResolvedValue({ id: 'profile-new' });
    relationshipUpdate.mockResolvedValue(
      relationship({ perfilContractualId: 'profile-new' }),
    );

    await service.update(USER_ID, RELATIONSHIP_ID, {
      perfilContractualId: 'profile-new',
      vigenteHasta: '2026-12-31',
    });

    expect(relationshipUpdate).toHaveBeenCalledWith(
      objectContaining({
        where: { id: RELATIONSHIP_ID },
        data: objectContaining({ perfilContractualId: 'profile-new' }),
      }),
    );
  });

  it('rechaza empleados de otro tenant o eliminados', async () => {
    employeeFindFirst.mockResolvedValue(null);

    await expect(
      service.create(USER_ID, {
        empleadoId: EMPLOYEE_ID,
        perfilContractualId: PROFILE_ID,
        vigenteDesde: '2026-01-01',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(relationshipCreate).not.toHaveBeenCalled();
  });

  it('rechaza perfiles inactivos o de otro tenant', async () => {
    profileFindFirst.mockResolvedValue(null);

    await expect(
      service.create(USER_ID, {
        empleadoId: EMPLOYEE_ID,
        perfilContractualId: PROFILE_ID,
        vigenteDesde: '2026-01-01',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(relationshipCreate).not.toHaveBeenCalled();
  });

  it('garantiza un único vínculo activo por empleado y empresa', async () => {
    relationshipFindFirst.mockResolvedValue({ id: RELATIONSHIP_ID });

    await expect(
      service.create(USER_ID, {
        empleadoId: EMPLOYEE_ID,
        perfilContractualId: PROFILE_ID,
        vigenteDesde: '2026-01-01',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(relationshipCreate).not.toHaveBeenCalled();
  });

  it('consulta la fuente precontractual vigente por fecha, no el perfil histórico del contrato', async () => {
    relationshipFindFirst.mockResolvedValue(relationship());
    const at = new Date('2026-06-01T00:00:00.000Z');

    await service.findCurrentByEmployee(EMPLOYEE_ID, at);

    expect(relationshipFindFirst).toHaveBeenCalledWith(
      objectContaining({
        where: objectContaining({
          tenantId: TENANT_ID,
          empleadoId: EMPLOYEE_ID,
          activo: true,
          vigenteDesde: { lte: at },
        }),
      }),
    );
  });

  it('rechaza vigencias invertidas antes de persistir', async () => {
    await expect(
      service.create(USER_ID, {
        empleadoId: EMPLOYEE_ID,
        perfilContractualId: PROFILE_ID,
        vigenteDesde: '2026-12-31',
        vigenteHasta: '2026-01-01',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(execute).not.toHaveBeenCalled();
  });
});
