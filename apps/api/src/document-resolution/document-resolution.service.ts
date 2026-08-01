import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DocumentTemplateType, LoteProposito, Prisma } from '@prisma/client';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import { DocumentResolutionPreviewDto } from './dto/document-resolution-preview.dto';

type TargetConfig = { empleadoIds?: unknown };

type ResolvedEmployee = {
  id: string;
  primerNombre: string;
  segundoNombre: string | null;
  primerApellido: string;
  segundoApellido: string | null;
  tipoDocumento: string;
  cedula: string;
  cargo: string;
  salario: Prisma.Decimal;
  tipoContrato: string;
  fechaIngreso: Date;
  sedeId: string | null;
  sedeRef: { id: string; nombre: string } | null;
};

const toSnapshot = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(
    JSON.stringify(value, (_key, nestedValue: unknown) =>
      nestedValue instanceof Date ? nestedValue.toISOString() : nestedValue,
    ),
  ) as Prisma.InputJsonValue;

@Injectable()
export class DocumentResolutionService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async preview(dto: DocumentResolutionPreviewDto) {
    const results = await this.resolve(dto);
    return results.map((result) =>
      Object.fromEntries(
        Object.entries(result).filter(([key]) => key !== 'internal'),
      ),
    );
  }

  async confirm(dto: DocumentResolutionPreviewDto) {
    return this.tenantPrisma.execute(async (prisma, context) => {
      const [existingPlans, existingExclusions] = await Promise.all([
        prisma.batchDocumentGenerationPlan.findMany({
          where: { tenantId: context.tenantId, loteId: dto.loteId },
        }),
        prisma.batchDocumentGenerationExclusion.findMany({
          where: { tenantId: context.tenantId, loteId: dto.loteId },
        }),
      ]);

      if (existingPlans.length > 0 || existingExclusions.length > 0) {
        return { plans: existingPlans, exclusions: existingExclusions };
      }

      const results = await this.resolve(dto);
      const at = dto.fechaProceso ? new Date(dto.fechaProceso) : new Date();

      const plans = await Promise.all(
        results
          .filter((result) => result.estado === 'RESUELTO')
          .map((result) => {
            const internal = result.internal as {
              relationship: {
                id: string;
                perfilContractualId: string;
                perfilContractual: {
                  id: string;
                  codigo: string;
                  nombre: string;
                };
              };
              configuration: {
                id: string;
                vigenteDesde: Date;
                vigenteHasta: Date | null;
                plantillaId: string;
                plantilla: { id: string; nombre: string; updatedAt: Date };
              };
              empleadoSnapshot: Prisma.InputJsonValue;
              contratoSnapshot: Prisma.InputJsonValue;
            };

            return prisma.batchDocumentGenerationPlan.upsert({
              where: {
                loteId_empleadoId_tipoDocumental: {
                  loteId: dto.loteId,
                  empleadoId: result.empleado.id,
                  tipoDocumental: result.tipoDocumental,
                },
              },
              update: {},
              create: {
                tenantId: context.tenantId,
                loteId: dto.loteId,
                empleadoId: result.empleado.id,
                tipoDocumental: result.tipoDocumental,
                fechaProceso: at,
                vinculoLaboralId: internal.relationship.id,
                perfilContractualId: internal.relationship.perfilContractualId,
                configuracionDocumentalPerfilId: internal.configuration.id,
                plantillaId: internal.configuration.plantillaId,
                perfilSnapshot: toSnapshot(
                  internal.relationship.perfilContractual,
                ),
                configuracionSnapshot: toSnapshot({
                  id: internal.configuration.id,
                  vigenteDesde: internal.configuration.vigenteDesde,
                  vigenteHasta: internal.configuration.vigenteHasta,
                }),
                plantillaSnapshot: toSnapshot(internal.configuration.plantilla),
                empleadoSnapshot: internal.empleadoSnapshot,
                contratoSnapshot: internal.contratoSnapshot,
                motivoResolucion: 'PERFIL_TIPO_DOCUMENTAL_PLANTILLA_VIGENTE',
                resueltoAt: at,
              },
            });
          }),
      );

      const exclusions = await Promise.all(
        results
          .filter((result) => result.estado === 'BLOQUEADO')
          .map((result) =>
            prisma.batchDocumentGenerationExclusion.upsert({
              where: {
                loteId_empleadoId_tipoDocumental: {
                  loteId: dto.loteId,
                  empleadoId: result.empleado.id,
                  tipoDocumental: result.tipoDocumental,
                },
              },
              update: {},
              create: {
                tenantId: context.tenantId,
                loteId: dto.loteId,
                empleadoId: result.empleado.id,
                tipoDocumental: result.tipoDocumental,
                fechaEvaluacion: at,
                motivoBloqueo: result.motivoBloqueo ?? 'RESOLUCION_BLOQUEADA',
                detalle: toSnapshot({
                  empleado: result.empleado,
                  perfilContractual: result.perfilContractual,
                  plantillaSeleccionada: result.plantillaSeleccionada,
                }),
              },
            }),
          ),
      );

      return { plans, exclusions };
    });
  }

  async resolve(dto: DocumentResolutionPreviewDto) {
    const at = dto.fechaProceso ? new Date(dto.fechaProceso) : new Date();

    return this.tenantPrisma.execute(async (prisma, context) => {
      const lote = await prisma.loteContrato.findFirst({
        where: { id: dto.loteId, tenantId: context.tenantId },
        include: {
          documentTemplate: { select: { tipo: true } },
          sede: { select: { id: true, nombre: true } },
        },
      });
      if (!lote) throw new NotFoundException('Lote no encontrado');

      const documentType =
        lote.proposito === LoteProposito.CONTRATACION
          ? DocumentTemplateType.CONTRACT
          : lote.documentTemplate?.tipo;
      if (!documentType) {
        throw new BadRequestException(
          'El lote no tiene un propósito o tipo documental resoluble.',
        );
      }

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
        select: {
          id: true,
          primerNombre: true,
          segundoNombre: true,
          primerApellido: true,
          segundoApellido: true,
          tipoDocumento: true,
          cedula: true,
          cargo: true,
          salario: true,
          tipoContrato: true,
          fechaIngreso: true,
          sedeId: true,
          sedeRef: { select: { id: true, nombre: true } },
        },
      });
      const employeeById = new Map<string, ResolvedEmployee>(
        employees.map((employee) => [
          employee.id,
          employee as ResolvedEmployee,
        ]),
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
            tipoDocumental: documentType,
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
          documentType,
          lote,
        ),
      );
    });
  }

  private resolveEmployee(
    employeeId: string,
    employee: ResolvedEmployee | undefined,
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
      {
        id: string;
        plantillaId: string;
        vigenteDesde: Date;
        vigenteHasta: Date | null;
        plantilla: { id: string; nombre: string; updatedAt: Date };
      }
    >,
    tipoDocumental: DocumentTemplateType,
    lote: {
      sedeId: string | null;
      sede: { id: string; nombre: string } | null;
      tipoContrato: string | null;
      fechaInicioContrato: Date | null;
      fechaFinContrato: Date | null;
    },
  ) {
    const empleadoSnapshot = employee
      ? {
          id: employee.id,
          primerNombre: employee.primerNombre,
          segundoNombre: employee.segundoNombre,
          primerApellido: employee.primerApellido,
          segundoApellido: employee.segundoApellido,
          tipoDocumento: employee.tipoDocumento,
          cedula: employee.cedula,
          cargo: employee.cargo,
          salario: employee.salario.toString(),
          tipoContrato: employee.tipoContrato,
          fechaIngreso: employee.fechaIngreso.toISOString(),
          sedeId: employee.sedeId,
          sede: employee.sedeRef,
        }
      : null;
    const contratoSnapshot = employee
      ? {
          cargo: employee.cargo,
          salario: employee.salario.toString(),
          tipo: lote.tipoContrato ?? employee.tipoContrato,
          fechaInicio: (
            lote.fechaInicioContrato ?? employee.fechaIngreso
          ).toISOString(),
          fechaFin: lote.fechaFinContrato?.toISOString() ?? null,
          sedeId: lote.sedeId ?? employee.sedeId,
          sede: lote.sede ?? employee.sedeRef,
        }
      : null;
    const empleadoPreview = employee
      ? {
          id: employee.id,
          primerNombre: employee.primerNombre,
          segundoNombre: employee.segundoNombre,
          primerApellido: employee.primerApellido,
          segundoApellido: employee.segundoApellido,
        }
      : { id: employeeId };

    const base = {
      empleado: empleadoPreview,
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
      internal: {
        relationship,
        configuration: null as unknown,
        empleadoSnapshot: empleadoSnapshot
          ? toSnapshot(empleadoSnapshot)
          : null,
        contratoSnapshot: contratoSnapshot
          ? toSnapshot(contratoSnapshot)
          : null,
      },
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
      internal: {
        relationship,
        configuration,
        empleadoSnapshot: base.internal.empleadoSnapshot,
        contratoSnapshot: base.internal.contratoSnapshot,
      },
      plantillaSeleccionada: configuration.plantilla,
      estado: 'RESUELTO',
      motivoBloqueo: null,
    };
  }
}
