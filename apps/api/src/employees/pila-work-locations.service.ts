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
import { ClosePilaWorkLocationDto } from './dto/close-pila-work-location.dto';
import { CreatePilaWorkLocationDto } from './dto/create-pila-work-location.dto';

@Injectable()
export class PilaWorkLocationsService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly auditService: AuditService,
  ) {}

  list(employeeId: string) {
    return this.tenantPrisma.execute(async (prisma, { tenantId }) => {
      await this.requireEmployee(prisma, tenantId, employeeId);
      return prisma.pilaUbicacionLaboral.findMany({
        where: { tenantId, empleadoId: employeeId },
        include: {
          municipio: {
            select: {
              id: true,
              codigo: true,
              nombre: true,
              departamento: true,
            },
          },
        },
        orderBy: [{ vigenteDesde: 'desc' }, { createdAt: 'desc' }],
      });
    });
  }

  async create(
    userId: string,
    employeeId: string,
    dto: CreatePilaWorkLocationDto,
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

    return this.tenantPrisma.execute(async (prisma, { tenantId }) => {
      await this.requireEmployee(prisma, tenantId, employeeId);
      await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "empleados"
        WHERE "id" = ${employeeId} AND "tenantId" = ${tenantId}
        FOR UPDATE
      `;
      const municipality = await prisma.municipioDane.findUnique({
        where: { id: dto.municipioId },
        select: { id: true },
      });
      if (!municipality) {
        throw new NotFoundException(
          'El municipio DANE seleccionado no existe.',
        );
      }

      const existing = await prisma.pilaUbicacionLaboral.findMany({
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
          'La vigencia se cruza con otra ubicación laboral PILA del empleado.',
        );
      }

      if (superseded) {
        const previousEnd = new Date(vigenteDesde);
        previousEnd.setUTCDate(previousEnd.getUTCDate() - 1);
        if (previousEnd < superseded.vigenteDesde) {
          throw new ConflictException(
            'La nueva ubicación debe iniciar después de la ubicación vigente.',
          );
        }
        await prisma.pilaUbicacionLaboral.updateMany({
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
            action: 'PILA_WORK_LOCATION_CLOSED',
            entityType: 'PilaUbicacionLaboral',
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

      let location;
      try {
        location = await prisma.pilaUbicacionLaboral.create({
          data: {
            tenantId,
            empleadoId: employeeId,
            municipioId: municipality.id,
            vigenteDesde,
            vigenteHasta,
            registradoPorId: userId,
          },
          include: {
            municipio: {
              select: {
                id: true,
                codigo: true,
                nombre: true,
                departamento: true,
              },
            },
          },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2003'
        ) {
          throw new NotFoundException(
            'El municipio DANE seleccionado no existe.',
          );
        }
        throw error;
      }

      await this.auditService.log(
        {
          tenantId,
          userId,
          action: 'PILA_WORK_LOCATION_RECORDED',
          entityType: 'PilaUbicacionLaboral',
          entityId: location.id,
          metadata: {
            empleadoId: employeeId,
            municipioId: location.municipioId,
            confirmadoPorAportante: true,
            vigenteDesde: formatDate(vigenteDesde),
            vigenteHasta: vigenteHasta ? formatDate(vigenteHasta) : null,
          },
        },
        prisma,
      );
      return location;
    });
  }

  async close(
    userId: string,
    employeeId: string,
    locationId: string,
    dto: ClosePilaWorkLocationDto,
  ) {
    const vigenteHasta = parseDate(dto.vigenteHasta, 'vigenteHasta');
    return this.tenantPrisma.execute(async (prisma, { tenantId }) => {
      await this.requireEmployee(prisma, tenantId, employeeId);
      await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "empleados"
        WHERE "id" = ${employeeId} AND "tenantId" = ${tenantId}
        FOR UPDATE
      `;
      const current = await prisma.pilaUbicacionLaboral.findFirst({
        where: { id: locationId, tenantId, empleadoId: employeeId },
      });
      if (!current) {
        throw new NotFoundException('Ubicación laboral PILA no encontrada.');
      }
      if (current.vigenteHasta !== null) {
        throw new ConflictException('Esta ubicación ya tiene fecha final.');
      }
      if (vigenteHasta < current.vigenteDesde) {
        throw new BadRequestException(
          'La fecha final no puede ser anterior a la fecha inicial.',
        );
      }
      const later = await prisma.pilaUbicacionLaboral.findFirst({
        where: {
          tenantId,
          empleadoId: employeeId,
          id: { not: locationId },
          vigenteDesde: { gt: current.vigenteDesde, lte: vigenteHasta },
        },
        select: { id: true },
      });
      if (later) {
        throw new ConflictException(
          'La fecha final se cruza con una ubicación posterior del historial.',
        );
      }
      const updated = await prisma.pilaUbicacionLaboral.updateMany({
        where: {
          id: locationId,
          tenantId,
          empleadoId: employeeId,
          vigenteHasta: null,
        },
        data: { vigenteHasta },
      });
      if (updated.count === 0) {
        throw new ConflictException(
          'La ubicación cambió mientras se guardaba. Actualiza e inténtalo de nuevo.',
        );
      }
      const closed = await prisma.pilaUbicacionLaboral.findFirstOrThrow({
        where: { id: locationId, tenantId, empleadoId: employeeId },
        include: {
          municipio: {
            select: {
              id: true,
              codigo: true,
              nombre: true,
              departamento: true,
            },
          },
        },
      });
      await this.auditService.log(
        {
          tenantId,
          userId,
          action: 'PILA_WORK_LOCATION_CLOSED',
          entityType: 'PilaUbicacionLaboral',
          entityId: locationId,
          metadata: {
            empleadoId: employeeId,
            municipioId: current.municipioId,
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
