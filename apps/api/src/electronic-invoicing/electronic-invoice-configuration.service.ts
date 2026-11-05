import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AmbienteEmisorElectronico,
  EstadoRangoNumeracionElectronica,
  Prisma,
  TipoDocumentoElectronico,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import {
  TenantPrismaClient,
  TenantPrismaService,
} from '../tenant-prisma/tenant-prisma.service';
import { CreateNumberingRangeDto } from './dto/create-numbering-range.dto';
import { DeactivateNumberingRangeDto } from './dto/deactivate-numbering-range.dto';
import { UpsertIssuerProfileDto } from './dto/upsert-issuer-profile.dto';
import {
  addCalendarYears,
  getNumberingRangeStatus,
  parseDateOnly,
} from './domain/numbering';

interface AllocatedElectronicInvoiceNumber {
  prefijo: string;
  numero: number;
  numeroAutorizacion: string;
  fechaAutorizacion: Date;
  vigenciaDesde: Date;
  vigenciaHasta: Date;
}

@Injectable()
export class ElectronicInvoiceConfigurationService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly audit: AuditService,
  ) {}

  getConfiguration() {
    return this.tenantPrisma.execute(async (prisma, { tenantId }) => {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          razonSocial: true,
          nombre: true,
          nit: true,
          digitoVerif: true,
          direccion: true,
          ciudad: true,
          departamento: true,
          municipioId: true,
          telefono: true,
          email: true,
        },
      });
      if (!tenant) throw new NotFoundException('Empresa no encontrada.');

      const perfiles = await prisma.perfilEmisorElectronico.findMany({
        where: { tenantId },
        include: {
          rangos: {
            orderBy: [{ vigenciaHasta: 'desc' }, { createdAt: 'desc' }],
          },
        },
        orderBy: { ambiente: 'asc' },
      });

      return {
        identidadFiscal: tenant,
        perfiles: perfiles.map((profile) => ({
          ...profile,
          rangos: profile.rangos.map((range) => ({
            ...range,
            estadoOperativo: getNumberingRangeStatus(range),
            siguienteNumero:
              range.estado === EstadoRangoNumeracionElectronica.ACTIVO &&
              range.ultimoNumeroAsignado < range.numeroHasta
                ? range.ultimoNumeroAsignado + 1
                : null,
          })),
        })),
      };
    });
  }

  async upsertIssuerProfile(userId: string, dto: UpsertIssuerProfileDto) {
    const responsibilities = [
      ...new Set(
        dto.responsabilidadesTributarias
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    ].sort((a, b) => a.localeCompare(b));

    return this.tenantPrisma.execute(async (prisma, { tenantId }) => {
      const existing = await prisma.perfilEmisorElectronico.findUnique({
        where: {
          tenantId_ambiente: { tenantId, ambiente: dto.ambiente },
        },
      });
      const changed =
        !existing ||
        JSON.stringify(existing.responsabilidadesTributarias) !==
          JSON.stringify(responsibilities);

      const profile = await prisma.perfilEmisorElectronico.upsert({
        where: {
          tenantId_ambiente: { tenantId, ambiente: dto.ambiente },
        },
        create: {
          tenantId,
          ambiente: dto.ambiente,
          responsabilidadesTributarias: responsibilities,
        },
        update: { responsabilidadesTributarias: responsibilities },
      });

      if (changed) {
        await this.audit.log(
          {
            tenantId,
            userId,
            action: existing
              ? 'ELECTRONIC_INVOICE_ISSUER_PROFILE_UPDATED'
              : 'ELECTRONIC_INVOICE_ISSUER_PROFILE_CREATED',
            entityType: 'PerfilEmisorElectronico',
            entityId: profile.id,
            metadata: {
              ambiente: profile.ambiente,
              fields: ['responsabilidadesTributarias'],
              reason: dto.motivo,
            },
          },
          prisma,
        );
      }
      return profile;
    });
  }

  async createNumberingRange(userId: string, dto: CreateNumberingRangeDto) {
    const authorizationDate = this.parseBusinessDate(dto.fechaAutorizacion);
    const validFrom = this.parseBusinessDate(dto.vigenciaDesde);
    const validUntil = this.parseBusinessDate(dto.vigenciaHasta);
    if (
      authorizationDate > validFrom ||
      validFrom > validUntil ||
      validUntil > addCalendarYears(authorizationDate, 2)
    ) {
      throw new BadRequestException(
        'La vigencia debe iniciar después de la autorización y no puede superar dos años desde su fecha.',
      );
    }
    if (dto.numeroHasta < dto.numeroDesde) {
      throw new BadRequestException(
        'El número final debe ser igual o mayor al número inicial.',
      );
    }

    return this.tenantPrisma.execute(async (prisma, { tenantId }) => {
      await this.lockTenantRangeConfiguration(prisma, tenantId);
      const profile = await prisma.perfilEmisorElectronico.findUnique({
        where: {
          tenantId_ambiente: { tenantId, ambiente: dto.ambiente },
        },
        select: { id: true },
      });
      if (!profile) {
        throw new ConflictException(
          'Guarda primero el perfil emisor de este ambiente.',
        );
      }

      const overlappingRange =
        await prisma.rangoNumeracionElectronica.findFirst({
          where: {
            tenantId,
            tipoDocumento: TipoDocumentoElectronico.FACTURA_VENTA,
            prefijo: dto.prefijo,
            numeroDesde: { lte: dto.numeroHasta },
            numeroHasta: { gte: dto.numeroDesde },
            perfilEmisor: { ambiente: dto.ambiente },
          },
          select: { id: true },
        });
      if (overlappingRange) {
        throw new ConflictException(
          'Este rango reutiliza números que ya están registrados para el mismo prefijo y ambiente.',
        );
      }

      let range;
      try {
        range = await prisma.rangoNumeracionElectronica.create({
          data: {
            tenantId,
            perfilEmisorId: profile.id,
            tipoDocumento: TipoDocumentoElectronico.FACTURA_VENTA,
            numeroAutorizacion: dto.numeroAutorizacion,
            fechaAutorizacion: authorizationDate,
            vigenciaDesde: validFrom,
            vigenciaHasta: validUntil,
            prefijo: dto.prefijo,
            numeroDesde: dto.numeroDesde,
            numeroHasta: dto.numeroHasta,
            ultimoNumeroAsignado: dto.numeroDesde - 1,
          },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2003'
        ) {
          throw new ConflictException(
            'El rango no coincide con un perfil emisor de la empresa.',
          );
        }
        throw error;
      }

      await this.audit.log(
        {
          tenantId,
          userId,
          action: 'ELECTRONIC_INVOICE_NUMBER_RANGE_CREATED',
          entityType: 'RangoNumeracionElectronica',
          entityId: range.id,
          metadata: {
            ambiente: dto.ambiente,
            numeroAutorizacion: range.numeroAutorizacion,
            fechaAutorizacion: dto.fechaAutorizacion,
            vigenciaDesde: dto.vigenciaDesde,
            vigenciaHasta: dto.vigenciaHasta,
            prefijo: range.prefijo,
            numeroDesde: range.numeroDesde,
            numeroHasta: range.numeroHasta,
            reason: dto.motivo,
          },
        },
        prisma,
      );
      return {
        ...range,
        estadoOperativo: getNumberingRangeStatus(range),
        siguienteNumero: range.ultimoNumeroAsignado + 1,
      };
    });
  }

  async deactivateNumberingRange(
    userId: string,
    rangeId: string,
    dto: DeactivateNumberingRangeDto,
  ) {
    return this.tenantPrisma.execute(async (prisma, { tenantId }) => {
      await this.lockTenantRangeConfiguration(prisma, tenantId);
      const range = await prisma.rangoNumeracionElectronica.findFirst({
        where: { id: rangeId, tenantId },
        include: { perfilEmisor: { select: { ambiente: true } } },
      });
      if (!range) throw new NotFoundException('Rango no encontrado.');
      if (range.estado === EstadoRangoNumeracionElectronica.INACTIVO) {
        return {
          ...range,
          estadoOperativo: getNumberingRangeStatus(range),
          siguienteNumero: null,
        };
      }

      const updated = await prisma.rangoNumeracionElectronica.update({
        where: { id: range.id },
        data: {
          estado: EstadoRangoNumeracionElectronica.INACTIVO,
          inactivadoAt: new Date(),
          motivoInactivacion: dto.motivo,
        },
      });
      await this.audit.log(
        {
          tenantId,
          userId,
          action: 'ELECTRONIC_INVOICE_NUMBER_RANGE_DEACTIVATED',
          entityType: 'RangoNumeracionElectronica',
          entityId: updated.id,
          metadata: {
            ambiente: range.perfilEmisor.ambiente,
            prefijo: range.prefijo,
            numeroAutorizacion: range.numeroAutorizacion,
            ultimoNumeroAsignado: range.ultimoNumeroAsignado,
            reason: dto.motivo,
          },
        },
        prisma,
      );
      return {
        ...updated,
        estadoOperativo: getNumberingRangeStatus(updated),
        siguienteNumero: null,
      };
    });
  }

  /**
   * Consume one number only inside the caller's already-open tenant transaction.
   * The issuance use case must persist the invoice, snapshot, and transmission
   * using this same transaction before it commits.
   */
  async allocateNextNumber(input: {
    tenantId: string;
    userId: string;
    rangeId: string;
    ambiente: AmbienteEmisorElectronico;
    fechaEmision: Date;
  }): Promise<AllocatedElectronicInvoiceNumber> {
    return this.tenantPrisma.executeWithinTransaction(
      async (prisma, { tenantId }) => {
        if (input.tenantId !== tenantId) {
          throw new BadRequestException(
            'El rango pertenece a un tenant diferente al de la transacción.',
          );
        }

        const [allocated] = await prisma.$queryRaw<
          AllocatedElectronicInvoiceNumber[]
        >`
          UPDATE "rangos_numeracion_electronica" AS range
          SET "ultimoNumeroAsignado" = range."ultimoNumeroAsignado" + 1,
              "updatedAt" = CURRENT_TIMESTAMP
          FROM "perfiles_emisor_electronicos" AS profile
          WHERE range."id" = ${input.rangeId}
            AND range."tenantId" = ${tenantId}
            AND range."perfilEmisorId" = profile."id"
            AND range."tenantId" = profile."tenantId"
            AND profile."ambiente" = ${input.ambiente}::"AmbienteEmisorElectronico"
            AND range."tipoDocumento" = 'FACTURA_VENTA'
            AND range."estado" = 'ACTIVO'
            AND range."vigenciaDesde" <= ${input.fechaEmision}::date
            AND range."vigenciaHasta" >= ${input.fechaEmision}::date
            AND range."ultimoNumeroAsignado" < range."numeroHasta"
          RETURNING range."prefijo" AS "prefijo",
                    range."ultimoNumeroAsignado" AS "numero",
                    range."numeroAutorizacion" AS "numeroAutorizacion",
                    range."fechaAutorizacion" AS "fechaAutorizacion",
                    range."vigenciaDesde" AS "vigenciaDesde",
                    range."vigenciaHasta" AS "vigenciaHasta"
        `;
        if (!allocated) {
          throw new ConflictException(
            'No hay un rango activo, vigente y disponible para la fecha de emisión.',
          );
        }

        await this.audit.log(
          {
            tenantId,
            userId: input.userId,
            action: 'ELECTRONIC_INVOICE_NUMBER_ALLOCATED',
            entityType: 'RangoNumeracionElectronica',
            entityId: input.rangeId,
            metadata: {
              ambiente: input.ambiente,
              prefijo: allocated.prefijo,
              numero: allocated.numero,
            },
          },
          prisma,
        );
        return allocated;
      },
    );
  }

  private parseBusinessDate(value: string): Date {
    try {
      return parseDateOnly(value);
    } catch {
      throw new BadRequestException(
        'Las fechas deben existir y tener formato AAAA-MM-DD.',
      );
    }
  }

  private async lockTenantRangeConfiguration(
    prisma: TenantPrismaClient,
    tenantId: string,
  ) {
    await prisma.$queryRaw<boolean[]>`
      SELECT pg_advisory_xact_lock(hashtextextended(${tenantId}, 1)) IS NULL
        AS "locked"
    `;
  }
}
