import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AlertQueryDto } from './dto/alert-query.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class AlertsService {
  constructor(private prisma: PrismaService) {}

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
              nombre: true,
              apellido: true,
              cedula: true,
              cargo: true,
            },
          },
          employeeFile: { select: { id: true, nombre: true, categoria: true } },
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
            nombre: true,
            apellido: true,
            cedula: true,
            cargo: true,
          },
        },
        employeeFile: { select: { id: true, nombre: true, categoria: true } },
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

    const contractFiles = await this.prisma.employeeFile.findMany({
      where: { tenantId, categoria: 'CONTRACT' },
      include: {
        employee: { select: { id: true, nombre: true, apellido: true } },
      },
    });

    for (const file of contractFiles) {
      const genDoc = file.generatedDocumentId
        ? await this.prisma.generatedDocument.findUnique({
            where: { id: file.generatedDocumentId },
          })
        : null;

      for (const threshold of thresholds) {
        const dueDate = new Date(now);
        dueDate.setDate(dueDate.getDate() + threshold.days);

        if (genDoc) {
          const exists = await this.prisma.alert.findFirst({
            where: {
              tenantId,
              employeeFileId: file.id,
              severity: threshold.severity,
              status: 'OPEN',
            },
          });
          if (exists) continue;

          const alert = await this.prisma.alert.create({
            data: {
              tenantId,
              employeeId: file.employeeId,
              employeeFileId: file.id,
              titulo: `Contrato próximo a vencer (${threshold.label})`,
              descripcion: `El documento "${file.nombre}" del empleado ${file.employee.nombre} ${file.employee.apellido} requiere atención. Quedan aproximadamente ${threshold.days} días.`,
              severity: threshold.severity,
              dueDate,
            },
          });
          created.push(alert);
        }
      }
    }

    return {
      created: created.length,
      message: `${created.length} alertas de contrato generadas`,
    };
  }

  async generateMissingDocAlerts(tenantId: string) {
    const employees = await this.prisma.empleado.findMany({
      where: { tenantId, deletedAt: null, estado: 'ACTIVO' },
      select: { id: true, nombre: true, apellido: true },
    });

    let created = 0;
    for (const emp of employees) {
      const hasContract = await this.prisma.employeeFile.findFirst({
        where: { tenantId, employeeId: emp.id, categoria: 'CONTRACT' },
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
          descripcion: `${emp.nombre} ${emp.apellido} no tiene ningún contrato en su expediente digital.`,
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
