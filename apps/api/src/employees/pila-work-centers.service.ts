import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import {
  TenantPrismaClient,
  TenantPrismaService,
} from '../tenant-prisma/tenant-prisma.service';
import { CreatePilaWorkCenterDto } from './dto/create-pila-work-center.dto';
import { CreatePilaWorkAssignmentDto } from './dto/create-pila-work-assignment.dto';
import { ClosePilaWorkAssignmentDto } from './dto/close-pila-work-assignment.dto';
import { PatchPilaWorkCenterDto } from './dto/patch-pila-work-center.dto';
import {
  PILA_RISK_ACTIVITY_CATALOG_VERSION,
  PILA_RISK_ACTIVITY_CODES,
} from '../payroll/pila-risk-activity-catalog';

@Injectable()
export class PilaWorkCentersService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly auditService: AuditService,
  ) {}

  listCenters() {
    return this.tenantPrisma.execute(async (prisma, { tenantId }) =>
      prisma.pilaCentroTrabajo.findMany({
        where: { tenantId, activo: true },
        include: { sede: { select: { id: true, nombre: true } } },
        orderBy: [{ nombre: 'asc' }, { codigoCentro: 'asc' }],
      }),
    );
  }

  async createCenter(userId: string, dto: CreatePilaWorkCenterDto) {
    return this.tenantPrisma.execute(async (prisma, { tenantId }) => {
      if (dto.sedeId) {
        const site = await prisma.sede.findFirst({
          where: { id: dto.sedeId, tenantId, activo: true },
          select: { id: true },
        });
        if (!site)
          throw new NotFoundException('La sede seleccionada no existe.');
      }

      let center;
      try {
        center = await prisma.pilaCentroTrabajo.create({
          data: { ...dto, sedeId: dto.sedeId || null, tenantId },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          throw new ConflictException(
            'Ya existe este código de centro para la ARL en la empresa.',
          );
        }
        throw error;
      }

      await this.auditService.log(
        {
          tenantId,
          userId,
          action: 'PILA_WORK_CENTER_RECORDED',
          entityType: 'PilaCentroTrabajo',
          entityId: center.id,
          metadata: {
            arlCodigo: center.arlCodigo,
            codigoCentro: center.codigoCentro,
            sedeId: center.sedeId,
          },
        },
        prisma,
      );
      return center;
    });
  }

  async setCenterStatus(
    userId: string,
    centerId: string,
    dto: PatchPilaWorkCenterDto,
  ) {
    return this.tenantPrisma.execute(async (prisma, { tenantId }) => {
      const result = await prisma.pilaCentroTrabajo.updateMany({
        where: { id: centerId, tenantId },
        data: { activo: dto.activo },
      });
      if (result.count === 0) {
        throw new NotFoundException('Centro de trabajo no encontrado.');
      }
      const center = await prisma.pilaCentroTrabajo.findFirstOrThrow({
        where: { id: centerId, tenantId },
      });
      await this.auditService.log(
        {
          tenantId,
          userId,
          action: dto.activo
            ? 'PILA_WORK_CENTER_ACTIVATED'
            : 'PILA_WORK_CENTER_DEACTIVATED',
          entityType: 'PilaCentroTrabajo',
          entityId: centerId,
          metadata: { activo: dto.activo },
        },
        prisma,
      );
      return center;
    });
  }

  listAssignments(employeeId: string) {
    return this.tenantPrisma.execute(async (prisma, { tenantId }) => {
      await this.requireEmployee(prisma, tenantId, employeeId);
      return prisma.pilaAsignacionCentroTrabajo.findMany({
        where: { tenantId, empleadoId: employeeId },
        include: {
          centroTrabajo: {
            include: { sede: { select: { id: true, nombre: true } } },
          },
        },
        orderBy: [{ vigenteDesde: 'desc' }, { createdAt: 'desc' }],
      });
    });
  }

  async createAssignment(
    userId: string,
    employeeId: string,
    dto: CreatePilaWorkAssignmentDto,
  ) {
    const vigenteDesde = parseDate(dto.vigenteDesde, 'vigenteDesde');
    const vigenteHasta = dto.vigenteHasta
      ? parseDate(dto.vigenteHasta, 'vigenteHasta')
      : null;
    if (vigenteHasta && vigenteHasta < vigenteDesde) {
      throw new BadRequestException(
        'La fecha final no puede ser anterior a la fecha inicial.',
      );
    }
    if (!PILA_RISK_ACTIVITY_CODES.has(dto.codigoActividadEconomica)) {
      throw new BadRequestException(
        `El código no pertenece al catálogo ${PILA_RISK_ACTIVITY_CATALOG_VERSION}. Confirma el dato con la ARL.`,
      );
    }
    return this.tenantPrisma.execute((prisma, { tenantId }) =>
      this.createAssignmentInTransaction(
        prisma,
        tenantId,
        userId,
        employeeId,
        dto,
      ),
    );
  }

  async createAssignmentInTransaction(
    prisma: TenantPrismaClient,
    tenantId: string,
    userId: string,
    employeeId: string,
    dto: CreatePilaWorkAssignmentDto,
  ) {
    const { vigenteDesde, vigenteHasta, center, superseded } =
      await this.prepareAssignmentInTransaction(
        prisma,
        tenantId,
        employeeId,
        dto,
      );

    if (superseded) {
      const previousEnd = new Date(vigenteDesde);
      previousEnd.setUTCDate(previousEnd.getUTCDate() - 1);
      if (previousEnd < superseded.vigenteDesde) {
        throw new ConflictException(
          'La nueva asignación debe iniciar después de la asignación vigente.',
        );
      }
      await prisma.pilaAsignacionCentroTrabajo.updateMany({
        where: {
          id: superseded.id,
          tenantId,
          empleadoId: employeeId,
          vigenteHasta: null,
        },
        data: { vigenteHasta: previousEnd },
      });
      await this.auditService.log(
        {
          tenantId,
          userId,
          action: 'PILA_WORK_ASSIGNMENT_CLOSED',
          entityType: 'PilaAsignacionCentroTrabajo',
          entityId: superseded.id,
          metadata: {
            empleadoId: employeeId,
            vigenteHasta: formatDate(previousEnd),
            reemplazadaDesde: formatDate(vigenteDesde),
          },
        },
        prisma,
      );
    }

    const assignment = await prisma.pilaAsignacionCentroTrabajo.create({
      data: {
        tenantId,
        empleadoId: employeeId,
        centroTrabajoId: center.id,
        codigoActividadEconomica: dto.codigoActividadEconomica,
        formatoNormativoVersion: PILA_RISK_ACTIVITY_CATALOG_VERSION,
        vigenteDesde,
        vigenteHasta,
        registradoPorId: userId,
      },
      include: { centroTrabajo: true },
    });
    await this.auditService.log(
      {
        tenantId,
        userId,
        action: 'PILA_WORK_ASSIGNMENT_RECORDED',
        entityType: 'PilaAsignacionCentroTrabajo',
        entityId: assignment.id,
        metadata: {
          empleadoId: employeeId,
          centroTrabajoId: center.id,
          codigoActividadEconomica: assignment.codigoActividadEconomica,
          formatoNormativoVersion: assignment.formatoNormativoVersion,
          vigenteDesde: formatDate(vigenteDesde),
          vigenteHasta: vigenteHasta ? formatDate(vigenteHasta) : null,
        },
      },
      prisma,
    );
    return assignment;
  }

  async validateAssignmentInTransaction(
    prisma: TenantPrismaClient,
    tenantId: string,
    employeeId: string,
    dto: CreatePilaWorkAssignmentDto,
  ) {
    await this.prepareAssignmentInTransaction(
      prisma,
      tenantId,
      employeeId,
      dto,
    );
  }

  async closeAssignment(
    userId: string,
    employeeId: string,
    assignmentId: string,
    dto: ClosePilaWorkAssignmentDto,
  ) {
    const vigenteHasta = parseDate(dto.vigenteHasta, 'vigenteHasta');
    return this.tenantPrisma.execute(async (prisma, { tenantId }) => {
      await this.requireEmployee(prisma, tenantId, employeeId);
      await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "empleados"
        WHERE "id" = ${employeeId} AND "tenantId" = ${tenantId}
        FOR UPDATE
      `;
      const current = await prisma.pilaAsignacionCentroTrabajo.findFirst({
        where: { id: assignmentId, tenantId, empleadoId: employeeId },
      });
      if (!current) {
        throw new NotFoundException('Asignación PILA no encontrada.');
      }
      if (current.vigenteHasta !== null) {
        throw new ConflictException('Esta asignación ya tiene fecha final.');
      }
      if (vigenteHasta < current.vigenteDesde) {
        throw new BadRequestException(
          'La fecha final no puede ser anterior a la fecha inicial.',
        );
      }
      const laterAssignment =
        await prisma.pilaAsignacionCentroTrabajo.findFirst({
          where: {
            tenantId,
            empleadoId: employeeId,
            id: { not: assignmentId },
            vigenteDesde: { gt: current.vigenteDesde, lte: vigenteHasta },
          },
          select: { id: true },
        });
      if (laterAssignment) {
        throw new ConflictException(
          'La fecha final se cruza con una asignación posterior del historial.',
        );
      }
      const result = await prisma.pilaAsignacionCentroTrabajo.updateMany({
        where: {
          id: assignmentId,
          tenantId,
          empleadoId: employeeId,
          vigenteHasta: null,
        },
        data: { vigenteHasta },
      });
      if (result.count === 0) {
        throw new ConflictException(
          'La asignación cambió mientras se guardaba. Actualiza e inténtalo de nuevo.',
        );
      }
      const closed = await prisma.pilaAsignacionCentroTrabajo.findFirstOrThrow({
        where: { id: assignmentId, tenantId, empleadoId: employeeId },
      });
      await this.auditService.log(
        {
          tenantId,
          userId,
          action: 'PILA_WORK_ASSIGNMENT_CLOSED',
          entityType: 'PilaAsignacionCentroTrabajo',
          entityId: assignmentId,
          metadata: {
            empleadoId: employeeId,
            vigenteDesde: formatDate(current.vigenteDesde),
            vigenteHasta: formatDate(vigenteHasta),
          },
        },
        prisma,
      );
      return closed;
    });
  }

  private async requireEmployee(
    prisma: TenantPrismaClient,
    tenantId: string,
    employeeId: string,
  ) {
    const employee = await prisma.empleado.findFirst({
      where: { id: employeeId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!employee) throw new NotFoundException('Empleado no encontrado.');
    return employee;
  }

  private async prepareAssignmentInTransaction(
    prisma: TenantPrismaClient,
    tenantId: string,
    employeeId: string,
    dto: CreatePilaWorkAssignmentDto,
  ) {
    const vigenteDesde = parseDate(dto.vigenteDesde, 'vigenteDesde');
    const vigenteHasta = dto.vigenteHasta
      ? parseDate(dto.vigenteHasta, 'vigenteHasta')
      : null;
    if (vigenteHasta && vigenteHasta < vigenteDesde) {
      throw new BadRequestException(
        'La fecha final no puede ser anterior a la fecha inicial.',
      );
    }
    if (!PILA_RISK_ACTIVITY_CODES.has(dto.codigoActividadEconomica)) {
      throw new BadRequestException(
        `El código no pertenece al catálogo ${PILA_RISK_ACTIVITY_CATALOG_VERSION}. Confirma el dato con la ARL.`,
      );
    }

    await this.requireEmployee(prisma, tenantId, employeeId);
    await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "empleados"
      WHERE "id" = ${employeeId} AND "tenantId" = ${tenantId}
      FOR UPDATE
    `;

    const center = await prisma.pilaCentroTrabajo.findFirst({
      where: { id: dto.centroTrabajoId, tenantId, activo: true },
    });
    if (!center) {
      throw new NotFoundException('Centro de trabajo no encontrado.');
    }

    const affiliations = await prisma.afiliacionSeguridadSocial.findMany({
      where: {
        tenantId,
        empleadoId: employeeId,
        vigenteDesde: { lte: vigenteHasta ?? FAR_FUTURE },
        OR: [{ vigenteHasta: null }, { vigenteHasta: { gte: vigenteDesde } }],
      },
      select: { arlCodigo: true, arlClaseRiesgo: true },
    });
    if (
      affiliations.some(
        (affiliation) =>
          affiliation.arlCodigo !== center.arlCodigo ||
          affiliation.arlClaseRiesgo !== dto.codigoActividadEconomica[0],
      )
    ) {
      throw new ConflictException(
        'La ARL o clase de riesgo del centro/actividad no coincide con alguna afiliación vigente en ese intervalo.',
      );
    }

    const existing = await prisma.pilaAsignacionCentroTrabajo.findMany({
      where: { tenantId, empleadoId: employeeId },
      orderBy: { vigenteDesde: 'asc' },
    });
    const requestedEnd = vigenteHasta ?? FAR_FUTURE;
    const overlaps = existing.filter(
      (record) =>
        record.vigenteDesde <= requestedEnd &&
        (record.vigenteHasta === null || record.vigenteHasta >= vigenteDesde),
    );
    const superseded =
      vigenteHasta === null
        ? overlaps.find(
            (record) =>
              record.vigenteHasta === null &&
              record.vigenteDesde < vigenteDesde,
          )
        : undefined;
    if (overlaps.some((record) => record.id !== superseded?.id)) {
      throw new ConflictException(
        'La vigencia se cruza con otra asignación de centro/actividad del empleado.',
      );
    }
    if (superseded) {
      const previousEnd = new Date(vigenteDesde);
      previousEnd.setUTCDate(previousEnd.getUTCDate() - 1);
      if (previousEnd < superseded.vigenteDesde) {
        throw new ConflictException(
          'La nueva asignación debe iniciar después de la asignación vigente.',
        );
      }
    }

    return { vigenteDesde, vigenteHasta, center, superseded };
  }
}

const FAR_FUTURE = new Date('9999-12-31T00:00:00.000Z');

function parseDate(value: string, field: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BadRequestException(`La fecha ${field} no tiene formato válido.`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw new BadRequestException(`La fecha ${field} no existe.`);
  }
  return parsed;
}

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}
