import { BadRequestException, ConflictException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import { CreatePilaWorkAssignmentDto } from './dto/create-pila-work-assignment.dto';
import { PilaWorkCentersService } from './pila-work-centers.service';

const tenantId = 'tenant-a';
const userId = 'user-a';
const employeeId = 'employee-a';
const center = {
  id: 'center-a',
  tenantId,
  sedeId: 'site-a',
  arlCodigo: 'ARL001',
  codigoCentro: '0001',
  nombre: 'Centro principal',
  activo: true,
};
const assignmentDto: CreatePilaWorkAssignmentDto = {
  centroTrabajoId: center.id,
  codigoActividadEconomica: '1131202',
  vigenteDesde: '2026-04-01',
  vigenteHasta: null,
};

describe('PilaWorkCentersService', () => {
  const employeeFindFirst = jest.fn();
  const siteFindFirst = jest.fn();
  const centerFindFirst = jest.fn();
  const centerCreate = jest.fn();
  const centerUpdateMany = jest.fn();
  const centerFindFirstOrThrow = jest.fn();
  const assignmentFindMany = jest.fn();
  const assignmentCreate = jest.fn();
  const assignmentUpdateMany = jest.fn();
  const assignmentFindFirst = jest.fn();
  const assignmentFindFirstOrThrow = jest.fn();
  const affiliationFindMany = jest.fn();
  const queryRaw = jest.fn();
  const auditLog = jest.fn();
  const execute = jest.fn();
  const tx = {
    empleado: { findFirst: employeeFindFirst },
    sede: { findFirst: siteFindFirst },
    pilaCentroTrabajo: {
      findFirst: centerFindFirst,
      create: centerCreate,
      updateMany: centerUpdateMany,
      findFirstOrThrow: centerFindFirstOrThrow,
    },
    pilaAsignacionCentroTrabajo: {
      findMany: assignmentFindMany,
      create: assignmentCreate,
      updateMany: assignmentUpdateMany,
      findFirst: assignmentFindFirst,
      findFirstOrThrow: assignmentFindFirstOrThrow,
    },
    afiliacionSeguridadSocial: { findMany: affiliationFindMany },
    $queryRaw: queryRaw,
  };
  let service: PilaWorkCentersService;

  beforeEach(() => {
    jest.clearAllMocks();
    employeeFindFirst.mockResolvedValue({ id: employeeId });
    siteFindFirst.mockResolvedValue({ id: center.sedeId });
    centerFindFirst.mockResolvedValue(center);
    centerCreate.mockResolvedValue(center);
    centerUpdateMany.mockResolvedValue({ count: 1 });
    centerFindFirstOrThrow.mockResolvedValue(center);
    assignmentFindMany.mockResolvedValue([]);
    assignmentCreate.mockResolvedValue({ id: 'assignment-new' });
    assignmentUpdateMany.mockResolvedValue({ count: 1 });
    assignmentFindFirst.mockResolvedValue(null);
    assignmentFindFirstOrThrow.mockResolvedValue({ id: 'assignment-closed' });
    affiliationFindMany.mockResolvedValue([]);
    queryRaw.mockResolvedValue([{ id: employeeId }]);
    auditLog.mockResolvedValue(undefined);
    execute.mockImplementation(
      (work: (client: typeof tx, context: { tenantId: string }) => unknown) =>
        work(tx, { tenantId }),
    );
    service = new PilaWorkCentersService(
      { execute } as unknown as TenantPrismaService,
      { log: auditLog } as unknown as AuditService,
    );
  });

  it('rejects codes that are not in the versioned official activity catalog', async () => {
    await expect(
      service.createAssignment(userId, employeeId, {
        ...assignmentDto,
        codigoActividadEconomica: '1999999',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(execute).not.toHaveBeenCalled();
  });

  it('rejects a site that belongs to another tenant when registering a center', async () => {
    siteFindFirst.mockResolvedValue(null);

    await expect(
      service.createCenter(userId, {
        arlCodigo: center.arlCodigo,
        codigoCentro: center.codigoCentro,
        nombre: center.nombre,
        sedeId: center.sedeId,
      }),
    ).rejects.toThrow('La sede seleccionada no existe.');
    expect(centerCreate).not.toHaveBeenCalled();
  });

  it('closes an earlier open assignment before creating the next effective assignment', async () => {
    assignmentFindMany.mockResolvedValue([
      {
        id: 'assignment-old',
        vigenteDesde: new Date('2025-01-01T00:00:00.000Z'),
        vigenteHasta: null,
      },
    ]);

    await service.createAssignment(userId, employeeId, assignmentDto);

    expect(assignmentUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'assignment-old',
        tenantId,
        empleadoId: employeeId,
        vigenteHasta: null,
      },
      data: { vigenteHasta: new Date('2026-03-31T00:00:00.000Z') },
    });
    expect(assignmentCreate).toHaveBeenCalledWith({
      data: {
        tenantId,
        empleadoId: employeeId,
        centroTrabajoId: center.id,
        codigoActividadEconomica: assignmentDto.codigoActividadEconomica,
        formatoNormativoVersion: 'DECRETO_768_2022',
        registradoPorId: userId,
        vigenteDesde: new Date('2026-04-01T00:00:00.000Z'),
        vigenteHasta: null,
      },
      include: { centroTrabajo: true },
    });
  });

  it('rejects an assignment whose activity risk class conflicts with the effective ARL affiliation', async () => {
    affiliationFindMany.mockResolvedValue([
      { arlCodigo: 'ARL001', arlClaseRiesgo: '2' },
    ]);

    await expect(
      service.createAssignment(userId, employeeId, assignmentDto),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(assignmentCreate).not.toHaveBeenCalled();
  });

  it('rejects overlapping assignment history instead of rewriting it', async () => {
    assignmentFindMany.mockResolvedValue([
      {
        id: 'assignment-existing',
        vigenteDesde: new Date('2026-03-15T00:00:00.000Z'),
        vigenteHasta: new Date('2026-04-15T00:00:00.000Z'),
      },
    ]);

    await expect(
      service.createAssignment(userId, employeeId, assignmentDto),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(assignmentCreate).not.toHaveBeenCalled();
  });
});
