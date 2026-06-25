import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CreateCuentaContableDto } from './dto/create-cuenta-contable.dto';
import { UpdateCuentaContableDto } from './dto/update-cuenta-contable.dto';
import { CuentaContableQueryDto } from './dto/cuenta-contable-query.dto';

@Injectable()
export class CuentasContablesService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async create(tenantId: string, userId: string, dto: CreateCuentaContableDto) {
    await this.ensureCodigoDisponible(tenantId, dto.codigo);
    const cuentaPadreId = await this.resolveCuentaPadre(
      tenantId,
      dto.cuentaPadreId,
    );

    const cuenta = await this.prisma.cuentaContable.create({
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

    this.audit
      .log({
        tenantId,
        userId,
        action: 'CUENTA_CONTABLE_CREATE',
        entityType: 'CuentaContable',
        entityId: cuenta.id,
        metadata: { codigo: cuenta.codigo },
      })
      .catch(() => {});

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

    return this.prisma.cuentaContable.findMany({
      where,
      orderBy: { codigo: 'asc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const cuenta = await this.prisma.cuentaContable.findFirst({
      where: { id, tenantId },
    });
    if (!cuenta) throw new NotFoundException('Cuenta contable no encontrada');
    return cuenta;
  }

  async update(
    tenantId: string,
    userId: string,
    id: string,
    dto: UpdateCuentaContableDto,
  ) {
    const current = await this.findOne(tenantId, id);

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

    const updated = await this.prisma.cuentaContable.update({
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

    this.audit
      .log({
        tenantId,
        userId,
        action: 'CUENTA_CONTABLE_UPDATE',
        entityType: 'CuentaContable',
        entityId: updated.id,
        metadata: { codigo: updated.codigo },
      })
      .catch(() => {});

    return updated;
  }

  async remove(tenantId: string, userId: string, id: string) {
    const cuenta = await this.findOne(tenantId, id);

    if (cuenta.deletedAt) return cuenta; // idempotente

    if (cuenta.esCuentaSistema) {
      throw new ConflictException(
        'Una cuenta de sistema no puede eliminarse; desactívala con activa=false',
      );
    }

    const hijasVivas = await this.prisma.cuentaContable.count({
      where: { tenantId, cuentaPadreId: cuenta.id, deletedAt: null },
    });
    if (hijasVivas > 0) {
      throw new ConflictException(
        'La cuenta tiene subcuentas activas; elimínalas o reasígnalas primero',
      );
    }

    const eliminada = await this.prisma.cuentaContable.update({
      where: { id: cuenta.id },
      data: { deletedAt: new Date(), activa: false },
    });

    this.audit
      .log({
        tenantId,
        userId,
        action: 'CUENTA_CONTABLE_DELETE',
        entityType: 'CuentaContable',
        entityId: eliminada.id,
        metadata: { codigo: eliminada.codigo },
      })
      .catch(() => {});

    return eliminada;
  }

  private async ensureCodigoDisponible(tenantId: string, codigo: string) {
    const existing = await this.prisma.cuentaContable.findFirst({
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
    tenantId: string,
    cuentaPadreId?: string,
  ): Promise<string | null> {
    if (!cuentaPadreId) return null;
    const padre = await this.prisma.cuentaContable.findFirst({
      where: { id: cuentaPadreId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!padre) {
      throw new BadRequestException('La cuenta padre no existe en este tenant');
    }
    return padre.id;
  }
}
