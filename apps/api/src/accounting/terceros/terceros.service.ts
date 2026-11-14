import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import {
  TenantPrismaClient,
  TenantPrismaService,
} from '../../tenant-prisma/tenant-prisma.service';
import { CreateTerceroDto } from './dto/create-tercero.dto';
import { UpdateTerceroDto } from './dto/update-tercero.dto';
import { TerceroQueryDto } from './dto/tercero-query.dto';
import { TipoPersona } from '@prisma/client';

@Injectable()
export class TercerosService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(tenantId: string, userId: string, dto: CreateTerceroDto) {
    this.validarNombre(dto.tipoPersona, dto);
    const tercero = await this.tenantPrisma.execute(async (tx, context) => {
      this.assertTenantContext(tenantId, context.tenantId);
      await this.ensureDocumentoDisponible(
        tx,
        tenantId,
        dto.tipoDocumento,
        dto.numeroDocumento,
      );
      await this.ensureMunicipio(tx, dto.municipioId);

      return tx.tercero.create({
        data: {
          tenantId,
          tipoDocumento: dto.tipoDocumento,
          numeroDocumento: dto.numeroDocumento,
          digitoVerificacion: dto.digitoVerificacion,
          tipoPersona: dto.tipoPersona,
          razonSocial: dto.razonSocial,
          primerNombre: dto.primerNombre,
          segundoNombre: dto.segundoNombre,
          primerApellido: dto.primerApellido,
          segundoApellido: dto.segundoApellido,
          nombreComercial: dto.nombreComercial,
          esCliente: dto.esCliente ?? false,
          esProveedor: dto.esProveedor ?? false,
          esEmpleado: dto.esEmpleado ?? false,
          esEntidadGubernamental: dto.esEntidadGubernamental ?? false,
          esBanco: dto.esBanco ?? false,
          responsabilidadesFiscales: dto.responsabilidadesFiscales ?? [],
          regimenSimple: dto.regimenSimple ?? false,
          granContribuyente: dto.granContribuyente ?? false,
          email: dto.email,
          telefono: dto.telefono,
          direccion: dto.direccion,
          municipioId: dto.municipioId,
          ...(dto.activo !== undefined && { activo: dto.activo }),
        },
      });
    });

    this.audit
      .log({
        tenantId,
        userId,
        action: 'TERCERO_CREATE',
        entityType: 'Tercero',
        entityId: tercero.id,
        metadata: {
          tipoDocumento: tercero.tipoDocumento,
          numeroDocumento: tercero.numeroDocumento,
        },
      })
      .catch(() => {});

    return tercero;
  }

  async findAll(tenantId: string, query: TerceroQueryDto) {
    return this.tenantPrisma.execute((tx, context) => {
      this.assertTenantContext(tenantId, context.tenantId);
      const where: Prisma.TerceroWhereInput = {
        tenantId,
        ...(query.includeDeleted ? {} : { deletedAt: null }),
        ...(query.esCliente !== undefined && { esCliente: query.esCliente }),
        ...(query.esProveedor !== undefined && {
          esProveedor: query.esProveedor,
        }),
        ...(query.activo !== undefined && { activo: query.activo }),
      };

      if (query.search) {
        where.OR = [
          { razonSocial: { contains: query.search, mode: 'insensitive' } },
          { numeroDocumento: { contains: query.search, mode: 'insensitive' } },
          { primerNombre: { contains: query.search, mode: 'insensitive' } },
          { primerApellido: { contains: query.search, mode: 'insensitive' } },
        ];
      }

      return tx.tercero.findMany({
        where,
        orderBy: [{ razonSocial: 'asc' }, { primerApellido: 'asc' }],
      });
    });
  }

  async findOne(tenantId: string, id: string) {
    return this.tenantPrisma.execute(async (tx, context) => {
      this.assertTenantContext(tenantId, context.tenantId);
      const tercero = await tx.tercero.findFirst({
        where: { id, tenantId },
      });
      if (!tercero) throw new NotFoundException('Tercero no encontrado');
      return tercero;
    });
  }

  async update(
    tenantId: string,
    userId: string,
    id: string,
    dto: UpdateTerceroDto,
  ) {
    const updated = await this.tenantPrisma.execute(async (tx, context) => {
      this.assertTenantContext(tenantId, context.tenantId);
      const current = await tx.tercero.findFirst({
        where: { id, tenantId },
      });
      if (!current) throw new NotFoundException('Tercero no encontrado');

      const tipoPersona = dto.tipoPersona ?? current.tipoPersona;
      this.validarNombre(tipoPersona, {
        razonSocial: dto.razonSocial ?? current.razonSocial ?? undefined,
        primerNombre: dto.primerNombre ?? current.primerNombre ?? undefined,
        primerApellido:
          dto.primerApellido ?? current.primerApellido ?? undefined,
      });
      if (dto.municipioId) await this.ensureMunicipio(tx, dto.municipioId);

      return tx.tercero.update({
        where: { id: current.id },
        data: {
          ...(dto.digitoVerificacion !== undefined && {
            digitoVerificacion: dto.digitoVerificacion,
          }),
          ...(dto.tipoPersona !== undefined && {
            tipoPersona: dto.tipoPersona,
          }),
          ...(dto.razonSocial !== undefined && {
            razonSocial: dto.razonSocial,
          }),
          ...(dto.primerNombre !== undefined && {
            primerNombre: dto.primerNombre,
          }),
          ...(dto.segundoNombre !== undefined && {
            segundoNombre: dto.segundoNombre,
          }),
          ...(dto.primerApellido !== undefined && {
            primerApellido: dto.primerApellido,
          }),
          ...(dto.segundoApellido !== undefined && {
            segundoApellido: dto.segundoApellido,
          }),
          ...(dto.nombreComercial !== undefined && {
            nombreComercial: dto.nombreComercial,
          }),
          ...(dto.esCliente !== undefined && { esCliente: dto.esCliente }),
          ...(dto.esProveedor !== undefined && {
            esProveedor: dto.esProveedor,
          }),
          ...(dto.esEmpleado !== undefined && { esEmpleado: dto.esEmpleado }),
          ...(dto.esEntidadGubernamental !== undefined && {
            esEntidadGubernamental: dto.esEntidadGubernamental,
          }),
          ...(dto.esBanco !== undefined && { esBanco: dto.esBanco }),
          ...(dto.responsabilidadesFiscales !== undefined && {
            responsabilidadesFiscales: dto.responsabilidadesFiscales,
          }),
          ...(dto.regimenSimple !== undefined && {
            regimenSimple: dto.regimenSimple,
          }),
          ...(dto.granContribuyente !== undefined && {
            granContribuyente: dto.granContribuyente,
          }),
          ...(dto.email !== undefined && { email: dto.email }),
          ...(dto.telefono !== undefined && { telefono: dto.telefono }),
          ...(dto.direccion !== undefined && { direccion: dto.direccion }),
          ...(dto.municipioId !== undefined && {
            municipioId: dto.municipioId,
          }),
          ...(dto.activo !== undefined && { activo: dto.activo }),
        },
      });
    });

    this.audit
      .log({
        tenantId,
        userId,
        action: 'TERCERO_UPDATE',
        entityType: 'Tercero',
        entityId: updated.id,
      })
      .catch(() => {});

    return updated;
  }

  async remove(tenantId: string, userId: string, id: string) {
    const result = await this.tenantPrisma.execute(async (tx, context) => {
      this.assertTenantContext(tenantId, context.tenantId);
      const tercero = await tx.tercero.findFirst({
        where: { id, tenantId },
      });
      if (!tercero) throw new NotFoundException('Tercero no encontrado');
      if (tercero.deletedAt) return { tercero, changed: false };

      return {
        tercero: await tx.tercero.update({
          where: { id: tercero.id },
          data: { deletedAt: new Date(), activo: false },
        }),
        changed: true,
      };
    });

    if (result.changed) {
      this.audit
        .log({
          tenantId,
          userId,
          action: 'TERCERO_DELETE',
          entityType: 'Tercero',
          entityId: result.tercero.id,
        })
        .catch(() => {});
    }

    return result.tercero;
  }

  private validarNombre(
    tipoPersona: TipoPersona,
    datos: {
      razonSocial?: string;
      primerNombre?: string;
      primerApellido?: string;
    },
  ) {
    if (tipoPersona === TipoPersona.JURIDICA) {
      if (!datos.razonSocial) {
        throw new BadRequestException(
          'Una persona jurídica requiere razonSocial',
        );
      }
    } else if (!datos.primerNombre || !datos.primerApellido) {
      throw new BadRequestException(
        'Una persona natural requiere primerNombre y primerApellido',
      );
    }
  }

  private assertTenantContext(
    requestTenantId: string,
    contextTenantId: string,
  ) {
    if (requestTenantId !== contextTenantId) {
      throw new ForbiddenException('El contexto de tenant no coincide.');
    }
  }

  private async ensureDocumentoDisponible(
    tx: TenantPrismaClient,
    tenantId: string,
    tipoDocumento: CreateTerceroDto['tipoDocumento'],
    numeroDocumento: string,
  ) {
    const existing = await tx.tercero.findFirst({
      where: { tenantId, tipoDocumento, numeroDocumento },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'Ya existe un tercero con ese documento en este tenant',
      );
    }
  }

  private async ensureMunicipio(tx: TenantPrismaClient, municipioId?: string) {
    if (!municipioId) return;
    const municipio = await tx.municipioDane.findUnique({
      where: { id: municipioId },
      select: { id: true },
    });
    if (!municipio) throw new BadRequestException('Municipio no encontrado');
  }
}
