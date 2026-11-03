import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isColombiaDaneDepartmentCode } from '@saas/types';
import { AuditService } from '../audit/audit.service';
import {
  TenantPrismaClient,
  TenantPrismaService,
} from '../tenant-prisma/tenant-prisma.service';
import { CreateSocialSecurityAffiliationDto } from './dto/create-social-security-affiliation.dto';
import { CloseSocialSecurityAffiliationDto } from './dto/close-social-security-affiliation.dto';
import {
  SOCIAL_SECURITY_AFFILIATION_CAPTURE_VERSION,
  validatePilaAffiliationDeclarations,
} from './social-security-affiliation.policy';

@Injectable()
export class SocialSecurityAffiliationsService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly auditService: AuditService,
  ) {}

  list(employeeId: string) {
    return this.tenantPrisma.execute(async (prisma, { tenantId }) => {
      await this.requireEmployee(prisma, tenantId, employeeId);
      return prisma.afiliacionSeguridadSocial.findMany({
        where: { tenantId, empleadoId: employeeId },
        orderBy: [{ vigenteDesde: 'desc' }, { createdAt: 'desc' }],
      });
    });
  }

  async create(
    userId: string,
    employeeId: string,
    dto: CreateSocialSecurityAffiliationDto,
  ) {
    const vigenteDesde = parseDate(dto.vigenteDesde, 'vigenteDesde');
    const vigenteHasta = dto.vigenteHasta
      ? parseDate(dto.vigenteHasta, 'vigenteHasta')
      : null;

    if (!isColombiaDaneDepartmentCode(dto.cajaCompensacionDepartamentoCodigo)) {
      throw new BadRequestException(
        'Selecciona un departamento válido según DIVIPOLA para la caja de compensación.',
      );
    }

    if (vigenteHasta && vigenteHasta < vigenteDesde) {
      throw new BadRequestException(
        'La fecha final no puede ser anterior a la fecha inicial.',
      );
    }

    const created = await this.tenantPrisma.execute(
      async (prisma, { tenantId }) => {
        await this.requireEmployee(prisma, tenantId, employeeId);

        // Serializa registros concurrentes del mismo empleado antes de revisar
        // intervalos; la transacción instala el tenant para respetar RLS.
        const lockedEmployeeRows = await prisma.$queryRaw<
          Array<{ tipoDocumento: string }>
        >`
          SELECT "tipoDocumento" FROM "empleados"
          WHERE "id" = ${employeeId} AND "tenantId" = ${tenantId}
          FOR UPDATE
        `;
        const lockedEmployee = lockedEmployeeRows[0];
        if (!lockedEmployee) {
          throw new NotFoundException('Empleado no encontrado.');
        }
        this.validatePilaDeclarations(lockedEmployee.tipoDocumento, dto);

        const existing = await prisma.afiliacionSeguridadSocial.findMany({
          where: { tenantId, empleadoId: employeeId },
          orderBy: { vigenteDesde: 'asc' },
        });
        const requestedEnd =
          vigenteHasta ?? new Date('9999-12-31T00:00:00.000Z');
        const overlaps = existing.filter(
          (record) =>
            record.vigenteDesde <= requestedEnd &&
            (record.vigenteHasta === null ||
              record.vigenteHasta >= vigenteDesde),
        );

        const superseded =
          vigenteHasta === null
            ? overlaps.find(
                (record) =>
                  record.vigenteHasta === null &&
                  record.vigenteDesde < vigenteDesde,
              )
            : undefined;
        const conflicts = overlaps.filter(
          (record) => record.id !== superseded?.id,
        );

        if (conflicts.length > 0) {
          throw new ConflictException(
            'La vigencia se cruza con otra afiliación histórica. Revisa las fechas antes de guardarla.',
          );
        }

        if (superseded) {
          const endOfPreviousDay = new Date(vigenteDesde);
          endOfPreviousDay.setUTCDate(endOfPreviousDay.getUTCDate() - 1);

          if (endOfPreviousDay < superseded.vigenteDesde) {
            throw new ConflictException(
              'La nueva vigencia debe empezar después de la afiliación vigente.',
            );
          }

          await prisma.afiliacionSeguridadSocial.updateMany({
            where: {
              id: superseded.id,
              tenantId,
              vigenteHasta: null,
            },
            data: { vigenteHasta: endOfPreviousDay },
          });

          await this.auditService.log(
            {
              tenantId,
              userId,
              action: 'EMPLOYEE_SOCIAL_SECURITY_AFFILIATION_CLOSED',
              entityType: 'AfiliacionSeguridadSocial',
              entityId: superseded.id,
              metadata: {
                empleadoId: employeeId,
                vigenteHasta: endOfPreviousDay.toISOString().slice(0, 10),
                reemplazadaDesde: vigenteDesde.toISOString().slice(0, 10),
              },
            },
            prisma,
          );
        }

        const affiliation = await prisma.afiliacionSeguridadSocial.create({
          data: {
            ...dto,
            extranjeroNoObligadoPension:
              dto.extranjeroNoObligadoPension ?? null,
            colombianoEnElExterior: dto.colombianoEnElExterior ?? null,
            vigenteDesde,
            vigenteHasta,
            subtipoCotizanteCodigo: dto.subtipoCotizanteCodigo || null,
            versionCaptura: SOCIAL_SECURITY_AFFILIATION_CAPTURE_VERSION,
            registradoPorId: userId,
            tenantId,
            empleadoId: employeeId,
          },
        });

        await this.auditService.log(
          {
            tenantId,
            userId,
            action: 'EMPLOYEE_SOCIAL_SECURITY_AFFILIATION_RECORDED',
            entityType: 'AfiliacionSeguridadSocial',
            entityId: affiliation.id,
            metadata: {
              empleadoId: employeeId,
              vigenteDesde: vigenteDesde.toISOString().slice(0, 10),
              vigenteHasta: vigenteHasta?.toISOString().slice(0, 10) ?? null,
              versionCaptura: SOCIAL_SECURITY_AFFILIATION_CAPTURE_VERSION,
              campos: Object.keys(dto),
            },
          },
          prisma,
        );

        return affiliation;
      },
    );

    return created;
  }

  async close(
    userId: string,
    employeeId: string,
    affiliationId: string,
    dto: CloseSocialSecurityAffiliationDto,
  ) {
    const vigenteHasta = parseDate(dto.vigenteHasta, 'vigenteHasta');

    return this.tenantPrisma.execute(async (prisma, { tenantId }) => {
      await this.requireEmployee(prisma, tenantId, employeeId);
      await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "empleados"
        WHERE "id" = ${employeeId} AND "tenantId" = ${tenantId}
        FOR UPDATE
      `;

      const current = await prisma.afiliacionSeguridadSocial.findFirst({
        where: { id: affiliationId, tenantId, empleadoId: employeeId },
      });
      if (!current) {
        throw new NotFoundException('Afiliación no encontrada.');
      }
      if (current.vigenteHasta !== null) {
        throw new ConflictException('Esta vigencia ya tiene una fecha final.');
      }
      if (vigenteHasta < current.vigenteDesde) {
        throw new BadRequestException(
          'La fecha final no puede ser anterior a la fecha inicial.',
        );
      }

      const laterAffiliation = await prisma.afiliacionSeguridadSocial.findFirst(
        {
          where: {
            tenantId,
            empleadoId: employeeId,
            id: { not: affiliationId },
            vigenteDesde: { gt: current.vigenteDesde, lte: vigenteHasta },
          },
          select: { id: true },
        },
      );
      if (laterAffiliation) {
        throw new ConflictException(
          'La fecha final se cruza con una afiliación posterior del historial.',
        );
      }

      const result = await prisma.afiliacionSeguridadSocial.updateMany({
        where: {
          id: affiliationId,
          tenantId,
          empleadoId: employeeId,
          vigenteHasta: null,
        },
        data: { vigenteHasta },
      });
      if (result.count === 0) {
        throw new ConflictException(
          'La afiliación cambió mientras se guardaba. Actualiza el historial e inténtalo de nuevo.',
        );
      }

      const closed = await prisma.afiliacionSeguridadSocial.findFirstOrThrow({
        where: { id: affiliationId, tenantId, empleadoId: employeeId },
      });
      await this.auditService.log(
        {
          tenantId,
          userId,
          action: 'EMPLOYEE_SOCIAL_SECURITY_AFFILIATION_CLOSED',
          entityType: 'AfiliacionSeguridadSocial',
          entityId: affiliationId,
          metadata: {
            empleadoId: employeeId,
            vigenteDesde: current.vigenteDesde.toISOString().slice(0, 10),
            vigenteHasta: vigenteHasta.toISOString().slice(0, 10),
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
      select: { id: true, tipoDocumento: true },
    });
    if (!employee) throw new NotFoundException('Empleado no encontrado.');
    return employee;
  }

  private validatePilaDeclarations(
    tipoDocumento: string,
    dto: CreateSocialSecurityAffiliationDto,
  ) {
    const declarationError = validatePilaAffiliationDeclarations(
      tipoDocumento,
      {
        extranjeroNoObligadoPension: dto.extranjeroNoObligadoPension ?? null,
        colombianoEnElExterior: dto.colombianoEnElExterior ?? null,
      },
    )[0];

    if (declarationError) {
      throw new BadRequestException(declarationError.message);
    }
  }
}

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
