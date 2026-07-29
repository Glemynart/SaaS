import { BadRequestException } from '@nestjs/common';
import { DocumentTemplateType } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import { DocumentProfileConfigurationsService } from './document-profile-configurations.service';

const profileFindFirst = jest.fn();
const templateFindFirst = jest.fn();
const configurationFindFirst = jest.fn();
const configurationCreate = jest.fn();
const configurationUpdate = jest.fn();
const auditLog = jest.fn();
const execute = jest.fn();
const TENANT = 'tenant';
const PROFILE = '11111111-1111-4111-8111-111111111111';
const TEMPLATE = '22222222-2222-4222-8222-222222222222';
const CONFIG = '33333333-3333-4333-8333-333333333333';
type MockTenantClient = {
  perfilContractual: { findFirst: typeof profileFindFirst };
  documentTemplate: { findFirst: typeof templateFindFirst };
  configuracionDocumentalPerfil: {
    findFirst: typeof configurationFindFirst;
    create: typeof configurationCreate;
    update: typeof configurationUpdate;
    findMany: jest.Mock;
  };
};

describe('DocumentProfileConfigurationsService', () => {
  let service: DocumentProfileConfigurationsService;
  beforeEach(() => {
    jest.clearAllMocks();
    profileFindFirst.mockResolvedValue({ id: PROFILE });
    templateFindFirst.mockResolvedValue({ id: TEMPLATE });
    configurationFindFirst.mockResolvedValue(null);
    auditLog.mockResolvedValue(undefined);
    execute.mockImplementation(
      (
        work: (
          client: MockTenantClient,
          context: { tenantId: string },
        ) => unknown,
      ) =>
        work(
          {
            perfilContractual: { findFirst: profileFindFirst },
            documentTemplate: { findFirst: templateFindFirst },
            configuracionDocumentalPerfil: {
              findFirst: configurationFindFirst,
              create: configurationCreate,
              update: configurationUpdate,
              findMany: jest.fn(),
            },
          },
          { tenantId: TENANT },
        ),
    );
    service = new DocumentProfileConfigurationsService(
      { execute } as unknown as TenantPrismaService,
      { log: auditLog } as unknown as AuditService,
    );
  });
  const dto = {
    perfilContractualId: PROFILE,
    plantillaId: TEMPLATE,
    tipoDocumental: DocumentTemplateType.CONTRACT,
    vigenteDesde: '2026-01-01',
  };
  it('crea la configuración Perfil–Tipo–Plantilla y la audita', async () => {
    configurationCreate.mockResolvedValue({ id: CONFIG, ...dto });
    await service.create('user', dto);
    expect(configurationCreate).toHaveBeenCalled();
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DOCUMENT_PROFILE_CONFIGURATION_CREATE',
      }),
    );
  });
  it('rechaza perfil inactivo o de otro tenant', async () => {
    profileFindFirst.mockResolvedValue(null);
    await expect(service.create('user', dto)).rejects.toThrow(
      BadRequestException,
    );
  });
  it('rechaza plantilla inactiva, de otro tenant o de tipo incompatible', async () => {
    templateFindFirst.mockResolvedValue(null);
    await expect(service.create('user', dto)).rejects.toThrow(
      BadRequestException,
    );
  });
  it('rechaza vigencias que se solapan para el mismo perfil y tipo', async () => {
    configurationFindFirst.mockResolvedValue({ id: CONFIG });
    await expect(service.create('user', dto)).rejects.toThrow(
      BadRequestException,
    );
  });
  it('rechaza vigencias invertidas sin persistir', async () => {
    await expect(
      service.create('user', {
        ...dto,
        vigenteDesde: '2026-12-31',
        vigenteHasta: '2026-01-01',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(execute).not.toHaveBeenCalled();
  });
});
