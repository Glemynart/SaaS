import { ConflictException, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import { CreatePilaWorkLocationDto } from './dto/create-pila-work-location.dto';
import { PilaWorkLocationsService } from './pila-work-locations.service';

describe('PilaWorkLocationsService', () => {
  const tenantId = 'tenant-a';
  const employeeId = 'employee-a';
  const userId = 'user-a';
  const municipalityId = 'municipality-a';
  const employeeFindFirst = jest.fn();
  const municipalityFindUnique = jest.fn();
  const locationFindMany = jest.fn();
  const locationCreate = jest.fn();
  const locationUpdateMany = jest.fn();
  const locationFindFirst = jest.fn();
  const locationFindFirstOrThrow = jest.fn();
  const queryRaw = jest.fn();
  const auditLog = jest.fn();
  const execute = jest.fn();
  const prisma = {
    empleado: { findFirst: employeeFindFirst },
    municipioDane: { findUnique: municipalityFindUnique },
    pilaUbicacionLaboral: {
      findMany: locationFindMany,
      create: locationCreate,
      updateMany: locationUpdateMany,
      findFirst: locationFindFirst,
      findFirstOrThrow: locationFindFirstOrThrow,
    },
    $queryRaw: queryRaw,
  };
  let service: PilaWorkLocationsService;

  const input: CreatePilaWorkLocationDto = {
    municipioId: municipalityId,
    vigenteDesde: '2026-04-01',
    vigenteHasta: null,
    confirmacionAportante: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    employeeFindFirst.mockResolvedValue({ id: employeeId });
    municipalityFindUnique.mockResolvedValue({ id: municipalityId });
    locationFindMany.mockResolvedValue([]);
    locationCreate.mockResolvedValue({
      id: 'location-new',
      municipioId: municipalityId,
    });
    locationUpdateMany.mockResolvedValue({ count: 1 });
    locationFindFirst.mockResolvedValue(null);
    locationFindFirstOrThrow.mockResolvedValue({ id: 'location-closed' });
    queryRaw.mockResolvedValue([{ id: employeeId }]);
    auditLog.mockResolvedValue(undefined);
    execute.mockImplementation(
      (
        work: (client: typeof prisma, context: { tenantId: string }) => unknown,
      ) => work(prisma, { tenantId }),
    );
    service = new PilaWorkLocationsService(
      { execute } as unknown as TenantPrismaService,
      { log: auditLog } as unknown as AuditService,
    );
  });

  it('requires the employee to belong to the active tenant', async () => {
    employeeFindFirst.mockResolvedValue(null);

    await expect(service.list('foreign-employee')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(locationFindMany).not.toHaveBeenCalled();
  });

  it('records a confirmed municipality with tenant, employee, effective dates, and audit', async () => {
    await service.create(userId, employeeId, input);

    expect(locationFindMany).toHaveBeenCalledWith({
      where: { tenantId, empleadoId: employeeId },
      orderBy: { vigenteDesde: 'asc' },
    });
    expect(locationCreate).toHaveBeenCalledWith({
      data: {
        tenantId,
        empleadoId: employeeId,
        municipioId: municipalityId,
        vigenteDesde: new Date('2026-04-01T00:00:00.000Z'),
        vigenteHasta: null,
        registradoPorId: userId,
      },
      include: {
        municipio: {
          select: { id: true, codigo: true, nombre: true, departamento: true },
        },
      },
    });
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        userId,
        action: 'PILA_WORK_LOCATION_RECORDED',
        metadata: {
          empleadoId: employeeId,
          municipioId: municipalityId,
          confirmadoPorAportante: true,
          vigenteDesde: '2026-04-01',
          vigenteHasta: null,
        },
      }),
      prisma,
    );
  });

  it('closes the prior open assignment before a new confirmed location starts', async () => {
    locationFindMany.mockResolvedValue([
      {
        id: 'location-old',
        vigenteDesde: new Date('2025-01-01T00:00:00.000Z'),
        vigenteHasta: null,
      },
    ]);

    await service.create(userId, employeeId, input);

    expect(locationUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'location-old',
        tenantId,
        empleadoId: employeeId,
        vigenteHasta: null,
      },
      data: { vigenteHasta: new Date('2026-03-31T00:00:00.000Z') },
    });
  });

  it('rejects overlapping closed history instead of rewriting a prior statement', async () => {
    locationFindMany.mockResolvedValue([
      {
        id: 'location-overlap',
        vigenteDesde: new Date('2026-03-15T00:00:00.000Z'),
        vigenteHasta: new Date('2026-04-15T00:00:00.000Z'),
      },
    ]);

    await expect(
      service.create(userId, employeeId, input),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(locationCreate).not.toHaveBeenCalled();
  });

  it('rejects a municipality outside the DANE catalog', async () => {
    municipalityFindUnique.mockResolvedValue(null);

    await expect(
      service.create(userId, employeeId, input),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(locationCreate).not.toHaveBeenCalled();
  });

  it('closes an existing location without deleting its historical row', async () => {
    const current = {
      id: 'location-current',
      tenantId,
      empleadoId: employeeId,
      municipioId: municipalityId,
      vigenteDesde: new Date('2026-01-01T00:00:00.000Z'),
      vigenteHasta: null,
    };
    locationFindFirst
      .mockResolvedValueOnce(current)
      .mockResolvedValueOnce(null);
    locationFindFirstOrThrow.mockResolvedValue({
      ...current,
      vigenteHasta: new Date('2026-03-31T00:00:00.000Z'),
    });

    await service.close(userId, employeeId, current.id, {
      vigenteHasta: '2026-03-31',
    });

    expect(locationUpdateMany).toHaveBeenCalledWith({
      where: {
        id: current.id,
        tenantId,
        empleadoId: employeeId,
        vigenteHasta: null,
      },
      data: { vigenteHasta: new Date('2026-03-31T00:00:00.000Z') },
    });
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PILA_WORK_LOCATION_CLOSED' }),
      prisma,
    );
  });
});
