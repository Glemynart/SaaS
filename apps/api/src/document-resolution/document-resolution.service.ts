import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import { DocumentResolutionPreviewDto } from './dto/document-resolution-preview.dto';

type TargetConfig = { empleadoIds?: unknown };

@Injectable()
export class DocumentResolutionService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async preview(dto: DocumentResolutionPreviewDto) {
    const results = await this.resolve(dto);
    return results.map(({ internal, ...preview }) => preview);
  }

  async confirm(dto: DocumentResolutionPreviewDto) {
    return this.tenantPrisma.execute(async (prisma, context) => {
      const results = await this.resolve(dto);
      const blocked = results.find((result) => result.estado === 'BLOQUEADO');
      if (blocked) {
        throw new BadRequestException({
          message:
            'La confirmación fue cancelada por una resolución bloqueada.',
          motivo: blocked.motivoBloqueo,
        });
      }

      const at = dto.fechaProceso ? new Date(dto.fechaProceso) : new Date();
      const plans = await Promise.all(
        results.map((result) => {
          const internal = result.internal as {
            relationship: {
              id: string;
              perfilContractualId: string;
              perfilContractual: { id: string; codigo: string; nombre: string };
            };
            configuration: {
              id: string;
              vigenteDesde: Date;
              vigenteHasta: Date | null;
              plantillaId: string;
              plantilla: { id: string; nombre: string; updatedAt: Date };
            };
          };
          return prisma.batchDocumentGenerationPlan.create({
            data: {
              tenantId: context.tenantId,
              loteId: dto.loteId,
              empleadoId: result.empleado.id,
              tipoDocumental: result.tipoDocumental as never,
              fechaProceso: at,
              vinculoLaboralId: internal.relationship.id,
              perfilContractualId: internal.relationship.perfilContractualId,
              configuracionDocumentalPerfilId: internal.configuration.id,
              plantillaId: internal.configuration.plantillaId,
              perfilSnapshot: internal.relationship
                .perfilContractual as unknown as Prisma.InputJsonValue,
              configuracionSnapshot: {
                id: internal.configuration.id,
                vigenteDesde: internal.configuration.vigenteDesde,
                vigenteHasta: internal.configuration.vigenteHasta,
              } as unknown as Prisma.InputJsonValue,
              plantillaSnapshot: {
                id: internal.configuration.plantilla.id,
                nombre: internal.configuration.plantilla.nombre,
                versionEfectiva:
                  internal.configuration.plantilla.updatedAt.toISOString(),
              } as unknown as Prisma.InputJsonValue,
              motivoResolucion: 'PERFIL_TIPO_DOCUMENTAL_PLANTILLA_VIGENTE',
              resueltoAt: at,
            },
          });
        }),
      );
      return plans;
    });
  }

  async resolve(dto: DocumentResolutionPreviewDto) {
    const at = dto.fechaProceso ? new Date(dto.fechaProceso) : new Date();
    return this.tenantPrisma.execute(async (prisma, context) => {
      const lote = await prisma.loteContrato.findFirst({
        where: { id: dto.loteId, tenantId: context.tenantId },
        include: { documentTemplate: { select: { tipo: true } } },
      });
      if (!lote) throw new NotFoundException('Lote no encontrado');
      const config = lote.configuracion as TargetConfig;
      const employeeIds = Array.isArray(config.empleadoIds)
        ? [
            ...new Set(
              config.empleadoIds.filter(
                (id): id is string => typeof id === 'string',
              ),
            ),
          ]
        : [];
      const employees = await prisma.empleado.findMany({
        where: {
          tenantId: context.tenantId,
          id: { in: employeeIds },
          deletedAt: null,
        },
        select: { id: true, primerNombre: true, primerApellido: true },
      });
      const employeeById = new Map(
        employees.map((employee) => [employee.id, employee]),
      );
      const relationships = await prisma.vinculoLaboral.findMany({
        where: {
          tenantId: context.tenantId,
          empleadoId: { in: employeeIds },
          activo: true,
          vigenteDesde: { lte: at },
          OR: [{ vigenteHasta: null }, { vigenteHasta: { gte: at } }],
        },
        include: { perfilContractual: true },
      });
      const relationshipByEmployee = new Map(
        relationships.map((relationship) => [
          relationship.empleadoId,
          relationship,
        ]),
      );
      const profileIds = relationships
        .filter((relationship) => relationship.perfilContractual.activo)
        .map((relationship) => relationship.perfilContractualId);
      const configurations =
        await prisma.configuracionDocumentalPerfil.findMany({
          where: {
            tenantId: context.tenantId,
            perfilContractualId: { in: profileIds },
            tipoDocumental: lote.documentTemplate.tipo,
            activo: true,
            vigenteDesde: { lte: at },
            OR: [{ vigenteHasta: null }, { vigenteHasta: { gte: at } }],
            plantilla: { activo: true, deletedAt: null },
          },
          include: { plantilla: true },
        });
      const configurationByProfile = new Map(
        configurations.map((configuration) => [
          configuration.perfilContractualId,
          configuration,
        ]),
      );
      return employeeIds.map((employeeId) =>
        this.resolveEmployee(
          employeeId,
          employeeById.get(employeeId),
          relationshipByEmployee.get(employeeId),
          configurationByProfile,
          lote.documentTemplate.tipo,
        ),
      );
    });
  }

  private resolveEmployee(
    employeeId: string,
    employee:
      | { id: string; primerNombre: string; primerApellido: string }
      | undefined,
    relationship:
      | {
          id: string;
          perfilContractualId: string;
          perfilContractual: {
            id: string;
            activo: boolean;
            codigo: string;
            nombre: string;
          };
        }
      | undefined,
    configurations: Map<
      string,
      { plantilla: { id: string; nombre: string }; id: string }
    >,
    tipoDocumental: string,
  ) {
    const base = {
      empleado: employee ?? { id: employeeId },
      vinculoUtilizado: relationship ? { id: relationship.id } : null,
      perfilContractual: relationship
        ? {
            id: relationship.perfilContractual.id,
            codigo: relationship.perfilContractual.codigo,
            nombre: relationship.perfilContractual.nombre,
          }
        : null,
      tipoDocumental,
      plantillaSeleccionada: null as { id: string; nombre: string } | null,
      internal: { relationship, configuration: null as unknown },
    };
    if (!employee)
      return {
        ...base,
        estado: 'BLOQUEADO',
        motivoBloqueo: 'EMPLEADO_INEXISTENTE_O_FUERA_DEL_TENANT',
      };
    if (!relationship)
      return {
        ...base,
        estado: 'BLOQUEADO',
        motivoBloqueo: 'VINCULO_INEXISTENTE_O_FUERA_DE_VIGENCIA',
      };
    if (!relationship.perfilContractual.activo)
      return { ...base, estado: 'BLOQUEADO', motivoBloqueo: 'PERFIL_INACTIVO' };
    const configuration = configurations.get(relationship.perfilContractualId);
    if (!configuration)
      return {
        ...base,
        estado: 'BLOQUEADO',
        motivoBloqueo: 'CONFIGURACION_O_PLANTILLA_NO_VIGENTE',
      };
    return {
      ...base,
      internal: { relationship, configuration },
      plantillaSeleccionada: configuration.plantilla,
      estado: 'RESUELTO',
      motivoBloqueo: null,
    };
  }
}
