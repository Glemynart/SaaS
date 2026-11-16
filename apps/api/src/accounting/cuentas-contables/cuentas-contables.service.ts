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
import { CreateCuentaContableDto } from './dto/create-cuenta-contable.dto';
import { UpdateCuentaContableDto } from './dto/update-cuenta-contable.dto';
import { CuentaContableQueryDto } from './dto/cuenta-contable-query.dto';

@Injectable()
export class CuentasContablesService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(tenantId: string, userId: string, dto: CreateCuentaContableDto) {
    const cuenta = await this.tenantPrisma.execute(async (tx, context) => {
      this.assertTenantContext(tenantId, context.tenantId);
      await this.ensureCodigoDisponible(tx, tenantId, dto.codigo);
      const cuentaPadreId = await this.resolveCuentaPadre(
        tx,
        tenantId,
        dto.cuentaPadreId,
      );

      const cuenta = await tx.cuentaContable.create({
        data: {
          tenantId,
          codigo: dto.codigo,
          nombre: dto.nombre,
          claseContable: dto.claseContable,
          naturaleza: dto.naturaleza,
          nivel: dto.nivel,
          cuentaPadreId,
          imputable: dto.imputable ?? false,
          requiereTercero: dto.requiereTercero ?? false,
          requiereCentroCosto: dto.requiereCentroCosto ?? false,
          requiereBase: dto.requiereBase ?? false,
          ...(dto.activa !== undefined && { activa: dto.activa }),
          // esCuentaSistema queda en false: solo el seed/clonado crea cuentas de sistema.
        },
      });
      await this.audit.log(
        {
          tenantId,
          userId,
          action: 'CUENTA_CONTABLE_CREATE',
          entityType: 'CuentaContable',
          entityId: cuenta.id,
          metadata: { codigo: cuenta.codigo },
        },
        tx,
      );
      return cuenta;
    });
    return cuenta;
  }

  async findAll(tenantId: string, query: CuentaContableQueryDto) {
    const where: Prisma.CuentaContableWhereInput = {
      tenantId,
      ...(query.includeDeleted ? {} : { deletedAt: null }),
      ...(query.claseContable && { claseContable: query.claseContable }),
      ...(query.imputable !== undefined && { imputable: query.imputable }),
      ...(query.activa !== undefined && { activa: query.activa }),
    };

    if (query.search) {
      where.OR = [
        { codigo: { contains: query.search, mode: 'insensitive' } },
        { nombre: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return this.tenantPrisma.execute((tx, context) => {
      this.assertTenantContext(tenantId, context.tenantId);
      return tx.cuentaContable.findMany({
        where,
        orderBy: { codigo: 'asc' },
      });
    });
  }

  async findOne(tenantId: string, id: string) {
    return this.tenantPrisma.execute(async (tx, context) => {
      this.assertTenantContext(tenantId, context.tenantId);
      return this.findOneInTenant(tx, tenantId, id);
    });
  }

  async update(
    tenantId: string,
    userId: string,
    id: string,
    dto: UpdateCuentaContableDto,
  ) {
    const updated = await this.tenantPrisma.execute(async (tx, context) => {
      this.assertTenantContext(tenantId, context.tenantId);
      const current = await this.findOneInTenant(tx, tenantId, id);

      // Una cuenta de sistema solo admite cambios inocuos (nombre). Sus banderas
      // de control son contrato para C1 (CuentaSistemaMap / invariantes I5/I6):
      // desactivarla o cambiar su naturaleza rompería el posteo silenciosamente.
      if (current.esCuentaSistema) {
        const protegidos: (keyof UpdateCuentaContableDto)[] = [
          'activa',
          'imputable',
          'requiereTercero',
          'requiereCentroCosto',
          'requiereBase',
        ];
        const intentos = protegidos.filter((campo) => dto[campo] !== undefined);
        if (intentos.length > 0) {
          throw new ConflictException(
            `Una cuenta de sistema no permite modificar: ${intentos.join(', ')}`,
          );
        }
      }

      const updated = await tx.cuentaContable.update({
        where: { id: current.id },
        data: {
          ...(dto.nombre !== undefined && { nombre: dto.nombre }),
          ...(dto.imputable !== undefined && { imputable: dto.imputable }),
          ...(dto.requiereTercero !== undefined && {
            requiereTercero: dto.requiereTercero,
          }),
          ...(dto.requiereCentroCosto !== undefined && {
            requiereCentroCosto: dto.requiereCentroCosto,
          }),
          ...(dto.requiereBase !== undefined && {
            requiereBase: dto.requiereBase,
          }),
          ...(dto.activa !== undefined && { activa: dto.activa }),
        },
      });
      await this.audit.log(
        {
          tenantId,
          userId,
          action: 'CUENTA_CONTABLE_UPDATE',
          entityType: 'CuentaContable',
          entityId: updated.id,
          metadata: { codigo: updated.codigo },
        },
        tx,
      );
      return updated;
    });
    return updated;
  }

  async remove(tenantId: string, userId: string, id: string) {
    const eliminada = await this.tenantPrisma.execute(async (tx, context) => {
      this.assertTenantContext(tenantId, context.tenantId);
      const cuenta = await this.findOneInTenant(tx, tenantId, id);

      if (cuenta.deletedAt) return cuenta; // idempotente

      if (cuenta.esCuentaSistema) {
        throw new ConflictException(
          'Una cuenta de sistema no puede eliminarse; desactívala con activa=false',
        );
      }

      const hijasVivas = await tx.cuentaContable.count({
        where: { tenantId, cuentaPadreId: cuenta.id, deletedAt: null },
      });
      if (hijasVivas > 0) {
        throw new ConflictException(
          'La cuenta tiene subcuentas activas; elimínalas o reasígnalas primero',
        );
      }

      const eliminada = await tx.cuentaContable.update({
        where: { id: cuenta.id },
        data: { deletedAt: new Date(), activa: false },
      });
      await this.audit.log(
        {
          tenantId,
          userId,
          action: 'CUENTA_CONTABLE_DELETE',
          entityType: 'CuentaContable',
          entityId: eliminada.id,
          metadata: { codigo: eliminada.codigo },
        },
        tx,
      );
      return eliminada;
    });
    return eliminada;
  }

  private assertTenantContext(
    requestTenantId: string,
    contextTenantId: string,
  ) {
    if (requestTenantId !== contextTenantId) {
      throw new ForbiddenException('El contexto de tenant no coincide.');
    }
  }

  private async findOneInTenant(
    tx: TenantPrismaClient,
    tenantId: string,
    id: string,
  ) {
    const cuenta = await tx.cuentaContable.findFirst({
      where: { id, tenantId },
    });
    if (!cuenta) throw new NotFoundException('Cuenta contable no encontrada');
    return cuenta;
  }

  private async ensureCodigoDisponible(
    tx: TenantPrismaClient,
    tenantId: string,
    codigo: string,
  ) {
    const existing = await tx.cuentaContable.findFirst({
      where: { tenantId, codigo },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        `Ya existe la cuenta ${codigo} en este tenant`,
      );
    }
  }

  private async resolveCuentaPadre(
    tx: TenantPrismaClient,
    tenantId: string,
    cuentaPadreId?: string,
  ): Promise<string | null> {
    if (!cuentaPadreId) return null;
    const padre = await tx.cuentaContable.findFirst({
      where: { id: cuentaPadreId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!padre) {
      throw new BadRequestException('La cuenta padre no existe en este tenant');
    }
    return padre.id;
  }
}
