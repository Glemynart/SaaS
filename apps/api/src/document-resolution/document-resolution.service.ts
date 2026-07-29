import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import { DocumentResolutionPreviewDto } from './dto/document-resolution-preview.dto';

type TargetConfig = { empleadoIds?: unknown };

@Injectable()
export class DocumentResolutionService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async preview(dto: DocumentResolutionPreviewDto) {
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
        this.resolve(
          employeeId,
          employeeById.get(employeeId),
          relationshipByEmployee.get(employeeId),
          configurationByProfile,
          lote.documentTemplate.tipo,
        ),
      );
    });
  }

  private resolve(
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
      plantillaSeleccionada: configuration.plantilla,
      estado: 'RESUELTO',
      motivoBloqueo: null,
    };
  }
}
