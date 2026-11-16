import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import {
  TenantPrismaClient,
  TenantPrismaService,
} from '../../tenant-prisma/tenant-prisma.service';
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
    private readonly tenantPrisma: TenantPrismaService,
    private audit: AuditService,
  ) {}

  async create(
    tenantId: string,
    userId: string,
    dto: CreateCuentaSistemaMapDto,
  ) {
    const map = await this.tenantPrisma.execute(async (tx, context) => {
      this.assertTenantContext(tenantId, context.tenantId);
      await this.ensureRolDisponible(tx, tenantId, dto.rol);
      await this.ensureCuentaDelTenant(tx, tenantId, dto.cuentaId);

      const map = await tx.cuentaSistemaMap.create({
        data: {
          tenantId,
          rol: dto.rol,
          cuentaId: dto.cuentaId,
          descripcion: dto.descripcion,
          ...(dto.activo !== undefined && { activo: dto.activo }),
        },
        include: { cuenta: cuentaSelect },
      });
      await this.audit.log(
        {
          tenantId,
          userId,
          action: 'CUENTA_SISTEMA_MAP_CREATE',
          entityType: 'CuentaSistemaMap',
          entityId: map.id,
          metadata: { rol: map.rol, cuentaId: map.cuentaId },
        },
        tx,
      );
      return map;
    });
    return map;
  }

  async findAll(tenantId: string) {
    return this.tenantPrisma.execute((tx, context) => {
      this.assertTenantContext(tenantId, context.tenantId);
      return tx.cuentaSistemaMap.findMany({
        where: { tenantId },
        orderBy: { rol: 'asc' },
        include: { cuenta: cuentaSelect },
      });
    });
  }

  async findOne(tenantId: string, id: string) {
    return this.tenantPrisma.execute(async (tx, context) => {
      this.assertTenantContext(tenantId, context.tenantId);
      const map = await tx.cuentaSistemaMap.findFirst({
        where: { id, tenantId },
        include: { cuenta: cuentaSelect },
      });
      if (!map) throw new NotFoundException('Mapeo de cuenta no encontrado');
      return map;
    });
  }

  async update(
    tenantId: string,
    userId: string,
    id: string,
    dto: UpdateCuentaSistemaMapDto,
  ) {
    const updated = await this.tenantPrisma.execute(async (tx, context) => {
      this.assertTenantContext(tenantId, context.tenantId);
      const current = await tx.cuentaSistemaMap.findFirst({
        where: { id, tenantId },
        include: { cuenta: cuentaSelect },
      });
      if (!current)
        throw new NotFoundException('Mapeo de cuenta no encontrado');
      if (dto.cuentaId !== undefined) {
        await this.ensureCuentaDelTenant(tx, tenantId, dto.cuentaId);
      }

      const updated = await tx.cuentaSistemaMap.update({
        where: { id: current.id },
        data: {
          ...(dto.cuentaId !== undefined && { cuentaId: dto.cuentaId }),
          ...(dto.descripcion !== undefined && {
            descripcion: dto.descripcion,
          }),
          ...(dto.activo !== undefined && { activo: dto.activo }),
        },
        include: { cuenta: cuentaSelect },
      });
      await this.audit.log(
        {
          tenantId,
          userId,
          action: 'CUENTA_SISTEMA_MAP_UPDATE',
          entityType: 'CuentaSistemaMap',
          entityId: updated.id,
          metadata: { rol: updated.rol, cuentaId: updated.cuentaId },
        },
        tx,
      );
      return updated;
    });
    return updated;
  }

  private assertTenantContext(
    requestTenantId: string,
    contextTenantId: string,
  ) {
    if (requestTenantId !== contextTenantId) {
      throw new ForbiddenException('El contexto de tenant no coincide.');
    }
  }

  private async ensureRolDisponible(
    tx: TenantPrismaClient,
    tenantId: string,
    rol: string,
  ) {
    const existing = await tx.cuentaSistemaMap.findFirst({
      where: { tenantId, rol },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        `El rol ${rol} ya está mapeado en este tenant`,
      );
    }
  }

  private async ensureCuentaDelTenant(
    tx: TenantPrismaClient,
    tenantId: string,
    cuentaId: string,
  ) {
    const cuenta = await tx.cuentaContable.findFirst({
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
