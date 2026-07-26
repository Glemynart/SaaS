import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import { AlertQueryDto } from './dto/alert-query.dto';
import { Prisma } from '@prisma/client';
import { formatNombreCompleto } from '@saas/types';

@Injectable()
export class AlertsService {
  constructor(
    private prisma: PrismaService,
    private readonly tenantPrisma: TenantPrismaService,
  ) {}

  async findAll(tenantId: string, query: AlertQueryDto) {
    const { page = 1, limit = 20, status, severity } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.AlertWhereInput = {
      tenantId,
      ...(status && { status }),
      ...(severity && { severity }),
    };

    const [data, total] = await Promise.all([
      this.prisma.alert.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          employee: {
            select: {
              id: true,
              primerNombre: true,
              segundoNombre: true,
              primerApellido: true,
              segundoApellido: true,
              cedula: true,
              cargo: true,
            },
          },
          expedienteDoc: {
            select: { id: true, nombre: true, categoria: true },
          },
        },
      }),
      this.prisma.alert.count({ where }),
    ]);

    const stats = await this.buildStats(tenantId);

    return {
      data,
      stats,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(tenantId: string, id: string) {
    const alert = await this.prisma.alert.findFirst({
      where: { id, tenantId },
      include: {
        employee: {
          select: {
            id: true,
            primerNombre: true,
            segundoNombre: true,
            primerApellido: true,
            segundoApellido: true,
            cedula: true,
            cargo: true,
          },
        },
        expedienteDoc: { select: { id: true, nombre: true, categoria: true } },
      },
    });
    if (!alert) throw new NotFoundException('Alerta no encontrada');
    return alert;
  }

  async resolve(tenantId: string, id: string) {
    const alert = await this.findOne(tenantId, id);
    return this.prisma.alert.update({
      where: { id: alert.id },
      data: { status: 'RESOLVED', resolvedAt: new Date() },
    });
  }

  async generateContractAlerts(tenantId: string) {
    const created: unknown[] = [];
    const now = new Date();
    const thresholds = [
      { days: 30, severity: 'INFO' as const, label: '30 días' },
      { days: 15, severity: 'WARNING' as const, label: '15 días' },
      { days: 7, severity: 'CRITICAL' as const, label: '7 días' },
    ];
    const lookahead = new Date(now);
    lookahead.setDate(lookahead.getDate() + 30);

    const contratos = await this.tenantPrisma.execute((prisma) =>
      prisma.contrato.findMany({
        where: {
          tenantId,
          estado: { in: ['VIGENTE', 'RENOVADO'] },
          fechaFin: { gte: now, lte: lookahead },
        },
        include: {
          empleado: {
            select: {
              id: true,
              primerNombre: true,
              segundoNombre: true,
              primerApellido: true,
              segundoApellido: true,
            },
          },
          expedienteDocs: {
            where: { categoria: 'CONTRATO' },
            orderBy: { version: 'desc' },
            select: { id: true },
            take: 1,
          },
        },
      }),
    );

    for (const contrato of contratos) {
      const diasRestantes = Math.floor(
        (contrato.fechaFin!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
      const expedienteDocId = contrato.expedienteDocs[0]?.id ?? null;

      for (const threshold of thresholds) {
        if (diasRestantes > threshold.days) continue;

        const dedupeWhere = expedienteDocId
          ? {
              tenantId,
              expedienteDocId,
              severity: threshold.severity,
              status: 'OPEN' as const,
            }
          : {
              tenantId,
              employeeId: contrato.empleadoId,
              severity: threshold.severity,
              status: 'OPEN' as const,
              titulo: `Contrato próximo a vencer (${threshold.label})`,
            };

        const exists = await this.prisma.alert.findFirst({
          where: dedupeWhere,
        });
        if (exists) continue;

        const alert = await this.prisma.alert.create({
          data: {
            tenantId,
            employeeId: contrato.empleadoId,
            expedienteDocId,
            titulo: `Contrato próximo a vencer (${threshold.label})`,
            descripcion: `El contrato de ${formatNombreCompleto({ primerNombre: contrato.empleado.primerNombre ?? '', segundoNombre: contrato.empleado.segundoNombre, primerApellido: contrato.empleado.primerApellido ?? '', segundoApellido: contrato.empleado.segundoApellido })} vence el ${contrato.fechaFin!.toLocaleDateString('es-CO')}. Quedan aproximadamente ${diasRestantes} días.`,
            severity: threshold.severity,
            dueDate: contrato.fechaFin,
          },
        });
        created.push(alert);
      }
    }

    return {
      created: created.length,
      message: `${created.length} alertas de contrato generadas`,
    };
  }

  async generateMissingDocAlerts(tenantId: string) {
    const employees = await this.tenantPrisma.execute((prisma) =>
      prisma.empleado.findMany({
        where: { tenantId, deletedAt: null, estado: 'ACTIVO' },
        select: {
          id: true,
          primerNombre: true,
          segundoNombre: true,
          primerApellido: true,
          segundoApellido: true,
        },
      }),
    );

    let created = 0;
    for (const emp of employees) {
      const hasContract = await this.prisma.contrato.findFirst({
        where: {
          tenantId,
          empleadoId: emp.id,
          estado: { in: ['VIGENTE', 'RENOVADO'] },
        },
        select: { id: true },
      });
      if (hasContract) continue;

      const exists = await this.prisma.alert.findFirst({
        where: {
          tenantId,
          employeeId: emp.id,
          titulo: 'Empleado sin contrato registrado',
          status: 'OPEN',
        },
      });
      if (exists) continue;

      await this.prisma.alert.create({
        data: {
          tenantId,
          employeeId: emp.id,
          titulo: 'Empleado sin contrato registrado',
          descripcion: `${formatNombreCompleto({ primerNombre: emp.primerNombre ?? '', segundoNombre: emp.segundoNombre, primerApellido: emp.primerApellido ?? '', segundoApellido: emp.segundoApellido })} no tiene ningún contrato activo registrado.`,
          severity: 'WARNING',
        },
      });
      created++;
    }

    return {
      created,
      message: `${created} alertas de documentos faltantes generadas`,
    };
  }

  private async buildStats(tenantId: string) {
    const [openCount, resolvedCount, criticalCount] = await Promise.all([
      this.prisma.alert.count({ where: { tenantId, status: 'OPEN' } }),
      this.prisma.alert.count({ where: { tenantId, status: 'RESOLVED' } }),
      this.prisma.alert.count({
        where: { tenantId, severity: 'CRITICAL', status: 'OPEN' },
      }),
    ]);
    return {
      open: openCount,
      resolved: resolvedCount,
      critical: criticalCount,
    };
  }
}
