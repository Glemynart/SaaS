import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CreateCuentaSistemaMapDto } from './dto/create-cuenta-sistema-map.dto';
import { UpdateCuentaSistemaMapDto } from './dto/update-cuenta-sistema-map.dto';

// Lookup PURO rol → cuenta. Sin condiciones, fórmulas ni prioridades: la lógica
// de causación vive en los mappers de cada módulo, no aquí (ADR §8).
const cuentaSelect = {
  select: { id: true, codigo: true, nombre: true },
} as const;

@Injectable()
export class CuentaSistemaMapService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async create(
    tenantId: string,
    userId: string,
    dto: CreateCuentaSistemaMapDto,
  ) {
    await this.ensureRolDisponible(tenantId, dto.rol);
    await this.ensureCuentaDelTenant(tenantId, dto.cuentaId);

    const map = await this.prisma.cuentaSistemaMap.create({
      data: {
        tenantId,
        rol: dto.rol,
        cuentaId: dto.cuentaId,
        descripcion: dto.descripcion,
        ...(dto.activo !== undefined && { activo: dto.activo }),
      },
      include: { cuenta: cuentaSelect },
    });

    this.audit
      .log({
        tenantId,
        userId,
        action: 'CUENTA_SISTEMA_MAP_CREATE',
        entityType: 'CuentaSistemaMap',
        entityId: map.id,
        metadata: { rol: map.rol, cuentaId: map.cuentaId },
      })
      .catch(() => {});

    return map;
  }

  async findAll(tenantId: string) {
    return this.prisma.cuentaSistemaMap.findMany({
      where: { tenantId },
      orderBy: { rol: 'asc' },
      include: { cuenta: cuentaSelect },
    });
  }

  async findOne(tenantId: string, id: string) {
    const map = await this.prisma.cuentaSistemaMap.findFirst({
      where: { id, tenantId },
      include: { cuenta: cuentaSelect },
    });
    if (!map) throw new NotFoundException('Mapeo de cuenta no encontrado');
    return map;
  }

  async update(
    tenantId: string,
    userId: string,
    id: string,
    dto: UpdateCuentaSistemaMapDto,
  ) {
    const current = await this.findOne(tenantId, id);
    if (dto.cuentaId) await this.ensureCuentaDelTenant(tenantId, dto.cuentaId);

    const updated = await this.prisma.cuentaSistemaMap.update({
      where: { id: current.id },
      data: {
        ...(dto.cuentaId !== undefined && { cuentaId: dto.cuentaId }),
        ...(dto.descripcion !== undefined && { descripcion: dto.descripcion }),
        ...(dto.activo !== undefined && { activo: dto.activo }),
      },
      include: { cuenta: cuentaSelect },
    });

    this.audit
      .log({
        tenantId,
        userId,
        action: 'CUENTA_SISTEMA_MAP_UPDATE',
        entityType: 'CuentaSistemaMap',
        entityId: updated.id,
        metadata: { rol: updated.rol, cuentaId: updated.cuentaId },
      })
      .catch(() => {});

    return updated;
  }

  private async ensureRolDisponible(tenantId: string, rol: string) {
    const existing = await this.prisma.cuentaSistemaMap.findFirst({
      where: { tenantId, rol },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        `El rol ${rol} ya está mapeado en este tenant`,
      );
    }
  }

  private async ensureCuentaDelTenant(tenantId: string, cuentaId: string) {
    const cuenta = await this.prisma.cuentaContable.findFirst({
      where: { id: cuentaId, tenantId, deletedAt: null },
      select: { id: true, imputable: true },
    });
    if (!cuenta) {
      throw new BadRequestException(
        'La cuenta no existe en este tenant (¿provisionaste la contabilidad?)',
      );
    }
    if (!cuenta.imputable) {
      throw new BadRequestException(
        'Solo una cuenta imputable (hoja) puede mapearse a un rol de sistema',
      );
    }
  }
}
