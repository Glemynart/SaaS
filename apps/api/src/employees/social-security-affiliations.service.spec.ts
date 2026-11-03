import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import { CreateSocialSecurityAffiliationDto } from './dto/create-social-security-affiliation.dto';
import { SocialSecurityAffiliationsService } from './social-security-affiliations.service';

const tenantId = 'tenant-a';
const userId = 'user-a';
const employeeId = 'employee-a';
const openAffiliation = {
  id: 'affiliation-current',
  tenantId,
  empleadoId: employeeId,
  vigenteDesde: new Date('2025-01-01T00:00:00.000Z'),
  vigenteHasta: null,
};

const dto: CreateSocialSecurityAffiliationDto = {
  tipoCotizanteCodigo: '01',
  subtipoCotizanteCodigo: '00',
  epsCodigo: 'EPS001',
  epsNombre: 'EPS de prueba',
  fondoPensionCodigo: 'AFP001',
  fondoPensionNombre: 'Fondo de prueba',
  estadoAfiliacionPensional: 'S',
  arlCodigo: 'ARL001',
  arlNombre: 'ARL de prueba',
  arlClaseRiesgo: '1',
  cajaCompensacionCodigo: 'CCF001',
  cajaCompensacionNombre: 'Caja de prueba',
  cajaCompensacionDepartamentoCodigo: '08',
  extranjeroNoObligadoPension: null,
  colombianoEnElExterior: false,
  vigenteDesde: '2026-04-01',
  vigenteHasta: null,
};

describe('SocialSecurityAffiliationsService', () => {
  const employeeFindFirst = jest.fn();
  const affiliationFindMany = jest.fn();
  const affiliationFindFirst = jest.fn();
  const affiliationFindFirstOrThrow = jest.fn();
  const affiliationUpdateMany = jest.fn();
  const affiliationCreate = jest.fn();
  const queryRaw = jest.fn();
  const auditLog = jest.fn();
  const execute = jest.fn();
  const tx = {
    empleado: { findFirst: employeeFindFirst },
    afiliacionSeguridadSocial: {
      findMany: affiliationFindMany,
      findFirst: affiliationFindFirst,
      findFirstOrThrow: affiliationFindFirstOrThrow,
      updateMany: affiliationUpdateMany,
      create: affiliationCreate,
    },
    $queryRaw: queryRaw,
  };
  let service: SocialSecurityAffiliationsService;

  beforeEach(() => {
    jest.clearAllMocks();
    employeeFindFirst.mockResolvedValue({
      id: employeeId,
      tipoDocumento: 'CC',
    });
    affiliationFindMany.mockResolvedValue([]);
    affiliationFindFirst.mockResolvedValue(openAffiliation);
    affiliationFindFirstOrThrow.mockResolvedValue({
      ...openAffiliation,
      vigenteHasta: new Date('2026-04-30T00:00:00.000Z'),
    });
    affiliationUpdateMany.mockResolvedValue({ count: 1 });
    affiliationCreate.mockResolvedValue({ id: 'affiliation-new' });
    queryRaw.mockResolvedValue([
      { tipoDocumento: 'CC', tipoContrato: 'TERMINO_FIJO' },
    ]);
    auditLog.mockResolvedValue(undefined);
    execute.mockImplementation(
      (work: (client: typeof tx, context: { tenantId: string }) => unknown) =>
        work(tx, { tenantId }),
    );
    service = new SocialSecurityAffiliationsService(
      { execute } as unknown as TenantPrismaService,
      { log: auditLog } as unknown as AuditService,
    );
  });

  it('lists only affiliation history for the active tenant and employee', async () => {
    await service.list(employeeId);

    expect(employeeFindFirst).toHaveBeenCalledWith({
      where: { id: employeeId, tenantId, deletedAt: null },
      select: { id: true, tipoDocumento: true },
    });
    expect(affiliationFindMany).toHaveBeenCalledWith({
      where: { tenantId, empleadoId: employeeId },
      orderBy: [{ vigenteDesde: 'desc' }, { createdAt: 'desc' }],
    });
  });

  it('rejects an invalid effective interval before touching persistence', async () => {
    await expect(
      service.create(userId, employeeId, {
        ...dto,
        vigenteHasta: '2026-03-31',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(execute).not.toHaveBeenCalled();
  });

  it('rejects a CCF department code outside DIVIPOLA before touching persistence', async () => {
    await expect(
      service.create(userId, employeeId, {
        ...dto,
        cajaCompensacionDepartamentoCodigo: '99X',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(execute).not.toHaveBeenCalled();
  });

  it('rejects an employee outside the current tenant', async () => {
    employeeFindFirst.mockResolvedValue(null);

    await expect(
      service.create(userId, employeeId, dto),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(queryRaw).not.toHaveBeenCalled();
    expect(affiliationCreate).not.toHaveBeenCalled();
  });

  it('records the submitted official identifiers without copying legacy employee values', async () => {
    await service.create(userId, employeeId, dto);

    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(affiliationCreate).toHaveBeenCalledTimes(1);
    const [createCall] = affiliationCreate.mock.calls as unknown as Array<
      [{ data: Record<string, unknown> }]
    >;
    expect(createCall?.[0].data).toMatchObject({
      tenantId,
      empleadoId: employeeId,
      registradoPorId: userId,
      versionCaptura: 'PILA_AFFILIATION_CAPTURE_V4',
      cajaCompensacionDepartamentoCodigo: '08',
      tipoCotizanteCodigo: '01',
      subtipoCotizanteCodigo: '00',
      extranjeroNoObligadoPension: null,
      colombianoEnElExterior: false,
      epsCodigo: 'EPS001',
      epsNombre: 'EPS de prueba',
      estadoAfiliacionPensional: 'S',
      vigenteDesde: new Date('2026-04-01T00:00:00.000Z'),
      vigenteHasta: null,
    });
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        userId,
        action: 'EMPLOYEE_SOCIAL_SECURITY_AFFILIATION_RECORDED',
      }),
      tx,
    );
  });

  it('rejects standard PILA affiliation for a contractor', async () => {
    queryRaw.mockResolvedValue([
      { tipoDocumento: 'CC', tipoContrato: 'PRESTACION_SERVICIOS' },
    ]);

    await expect(
      service.create(userId, employeeId, dto),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(affiliationFindMany).not.toHaveBeenCalled();
    expect(affiliationCreate).not.toHaveBeenCalled();
  });

  it.each(['CE', 'PA'])(
    'requires an explicit foreign pension declaration for %s employees',
    async (tipoDocumento) => {
      employeeFindFirst.mockResolvedValue({ id: employeeId, tipoDocumento });
      queryRaw.mockResolvedValue([
        { tipoDocumento, tipoContrato: 'TERMINO_FIJO' },
      ]);

      await expect(
        service.create(userId, employeeId, {
          ...dto,
          colombianoEnElExterior: null,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(affiliationCreate).not.toHaveBeenCalled();
    },
  );

  it('stores the applicable foreign exemption and leaves the abroad declaration empty', async () => {
    employeeFindFirst.mockResolvedValue({
      id: employeeId,
      tipoDocumento: 'CE',
    });
    queryRaw.mockResolvedValue([
      { tipoDocumento: 'CE', tipoContrato: 'TERMINO_FIJO' },
    ]);

    await service.create(userId, employeeId, {
      ...dto,
      extranjeroNoObligadoPension: true,
      colombianoEnElExterior: null,
    });

    const [createCall] = affiliationCreate.mock.calls as unknown as Array<
      [{ data: Record<string, unknown> }]
    >;
    expect(createCall?.[0].data).toMatchObject({
      extranjeroNoObligadoPension: true,
      colombianoEnElExterior: null,
      versionCaptura: 'PILA_AFFILIATION_CAPTURE_V4',
    });
  });

  it('rejects a declaration that does not apply to the employee document type', async () => {
    await expect(
      service.create(userId, employeeId, {
        ...dto,
        extranjeroNoObligadoPension: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(affiliationCreate).not.toHaveBeenCalled();
  });

  it('requires an explicit exterior declaration for Colombian document types', async () => {
    await expect(
      service.create(userId, employeeId, {
        ...dto,
        colombianoEnElExterior: null,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(affiliationCreate).not.toHaveBeenCalled();
  });

  it('closes an open historical affiliation on the day before a new one starts', async () => {
    affiliationFindMany.mockResolvedValue([
      {
        id: 'affiliation-current',
        vigenteDesde: new Date('2025-01-01T00:00:00.000Z'),
        vigenteHasta: null,
      },
    ]);

    await service.create(userId, employeeId, dto);

    expect(affiliationUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'affiliation-current',
        tenantId,
        vigenteHasta: null,
      },
      data: { vigenteHasta: new Date('2026-03-31T00:00:00.000Z') },
    });
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'EMPLOYEE_SOCIAL_SECURITY_AFFILIATION_CLOSED',
        entityId: 'affiliation-current',
      }),
      tx,
    );
    expect(affiliationCreate).toHaveBeenCalledTimes(1);
  });

  it('rejects overlapping historical ranges instead of rewriting them', async () => {
    affiliationFindMany.mockResolvedValue([
      {
        id: 'affiliation-closed',
        vigenteDesde: new Date('2026-02-01T00:00:00.000Z'),
        vigenteHasta: new Date('2026-04-15T00:00:00.000Z'),
      },
    ]);

    await expect(
      service.create(userId, employeeId, dto),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(affiliationCreate).not.toHaveBeenCalled();
  });

  it('closes an open affiliation without changing its other historical fields', async () => {
    affiliationFindFirst
      .mockResolvedValueOnce(openAffiliation)
      .mockResolvedValueOnce(null);
    await service.close(userId, employeeId, openAffiliation.id, {
      vigenteHasta: '2026-04-30',
    });

    expect(affiliationUpdateMany).toHaveBeenCalledWith({
      where: {
        id: openAffiliation.id,
        tenantId,
        empleadoId: employeeId,
        vigenteHasta: null,
      },
      data: { vigenteHasta: new Date('2026-04-30T00:00:00.000Z') },
    });
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        userId,
        action: 'EMPLOYEE_SOCIAL_SECURITY_AFFILIATION_CLOSED',
        entityId: openAffiliation.id,
      }),
      tx,
    );
  });

  it('rejects closing an affiliation before its start date', async () => {
    await expect(
      service.close(userId, employeeId, openAffiliation.id, {
        vigenteHasta: '2024-12-31',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(affiliationUpdateMany).not.toHaveBeenCalled();
  });

  it('rejects closing an affiliation over a later affiliation', async () => {
    affiliationFindFirst
      .mockResolvedValueOnce(openAffiliation)
      .mockResolvedValueOnce({ id: 'affiliation-later' });

    await expect(
      service.close(userId, employeeId, openAffiliation.id, {
        vigenteHasta: '2026-04-30',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(affiliationUpdateMany).not.toHaveBeenCalled();
  });
});
