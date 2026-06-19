import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreatePayrollPeriodDto,
  CreatePayrollNoveltyDto,
} from './dto/create-payroll.dto';

@Injectable()
export class PayrollService {
  constructor(private prisma: PrismaService) {}

  async createPeriod(tenantId: string, dto: CreatePayrollPeriodDto) {
    return this.prisma.payrollPeriod.create({
      data: {
        ...dto,
        fechaInicio: new Date(dto.fechaInicio),
        fechaFin: new Date(dto.fechaFin),
        tenantId,
      },
    });
  }

  async findAllPeriods(tenantId: string) {
    const periods = await this.prisma.payrollPeriod.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { runs: true } } },
    });
    return periods.map((p) => ({
      ...p,
      empleadosProcesados: p._count.runs,
      _count: undefined,
    }));
  }

  async findOnePeriod(tenantId: string, id: string) {
    const period = await this.prisma.payrollPeriod.findFirst({
      where: { id, tenantId },
    });
    if (!period) throw new NotFoundException('Período no encontrado');

    const runs = await this.prisma.payrollRun.findMany({
      where: { tenantId, payrollPeriodId: id },
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
        concepts: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalDevengos = runs.reduce((s, r) => s + Number(r.totalDevengos), 0);
    const totalDeducciones = runs.reduce(
      (s, r) => s + Number(r.totalDeducciones),
      0,
    );
    const totalNeto = runs.reduce((s, r) => s + Number(r.netoPagar), 0);

    return {
      period,
      runs,
      totals: { totalDevengos, totalDeducciones, totalNeto },
    };
  }

  async closePeriod(tenantId: string, id: string) {
    const period = await this.findOnePeriod(tenantId, id);
    if (period.period.status === 'CLOSED')
      throw new BadRequestException('El período ya está cerrado');
    return this.prisma.payrollPeriod.update({
      where: { id },
      data: { status: 'CLOSED' },
    });
  }

  async generatePayroll(tenantId: string, periodId: string) {
    const period = await this.prisma.payrollPeriod.findFirst({
      where: { id: periodId, tenantId },
    });
    if (!period) throw new NotFoundException('Período no encontrado');
    if (period.status === 'CLOSED')
      throw new BadRequestException(
        'No se puede generar nómina en un período cerrado',
      );

    const employees = await this.prisma.empleado.findMany({
      where: { tenantId, deletedAt: null, estado: 'ACTIVO' },
    });

    // Load all novelties for the period in a single query to avoid N+1
    const allNovelties = await this.prisma.payrollNovelty.findMany({
      where: { tenantId, payrollPeriodId: periodId },
    });
    const noveltiesByEmployee = new Map<string, typeof allNovelties>();
    for (const novelty of allNovelties) {
      const list = noveltiesByEmployee.get(novelty.employeeId) ?? [];
      list.push(novelty);
      noveltiesByEmployee.set(novelty.employeeId, list);
    }

    const created: unknown[] = [];

    try {
      await this.prisma.$transaction(
        async (tx) => {
          for (const emp of employees) {
            const existing = await tx.payrollRun.findFirst({
              where: {
                tenantId,
                payrollPeriodId: periodId,
                employeeId: emp.id,
              },
            });
            if (existing) continue;

            const novelties = noveltiesByEmployee.get(emp.id) ?? [];

            const salarioBase = Number(emp.salario);
            const bonificaciones = novelties
              .filter((n) => n.tipo === 'BONUS')
              .reduce((s, n) => s + Number(n.valor ?? 0), 0);
            const horasExtra = novelties
              .filter((n) => n.tipo === 'OVERTIME')
              .reduce((s, n) => s + Number(n.valor ?? 0), 0);

            const totalDevengos = salarioBase + bonificaciones + horasExtra;
            const salud = totalDevengos * 0.04;
            const pension = totalDevengos * 0.04;
            const totalDeducciones = salud + pension;
            const netoPagar = totalDevengos - totalDeducciones;

            const run = await tx.payrollRun.create({
              data: {
                tenantId,
                payrollPeriodId: periodId,
                employeeId: emp.id,
                totalDevengos,
                totalDeducciones,
                netoPagar,
                concepts: {
                  create: [
                    {
                      tipo: 'EARNING',
                      nombre: 'Salario base',
                      valor: salarioBase,
                    },
                    ...(bonificaciones > 0
                      ? [
                          {
                            tipo: 'EARNING' as const,
                            nombre: 'Bonificaciones',
                            valor: bonificaciones,
                          },
                        ]
                      : []),
                    ...(horasExtra > 0
                      ? [
                          {
                            tipo: 'EARNING' as const,
                            nombre: 'Horas extra',
                            valor: horasExtra,
                          },
                        ]
                      : []),
                    { tipo: 'DEDUCTION', nombre: 'Salud (4%)', valor: salud },
                    {
                      tipo: 'DEDUCTION',
                      nombre: 'Pensión (4%)',
                      valor: pension,
                    },
                  ],
                },
              },
            });
            created.push(run);
          }
        },
        { timeout: 30000 },
      );
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(
          'Ya existe una liquidación para uno de los empleados en este período',
        );
      }
      throw e;
    }

    return {
      created: created.length,
      message: `${created.length} empleados liquidados`,
    };
  }

  async createNovelty(tenantId: string, dto: CreatePayrollNoveltyDto) {
    const [emp, period] = await Promise.all([
      this.prisma.empleado.findFirst({
        where: { id: dto.employeeId, tenantId, deletedAt: null },
      }),
      this.prisma.payrollPeriod.findFirst({
        where: { id: dto.payrollPeriodId, tenantId },
      }),
    ]);
    if (!emp) throw new NotFoundException('Empleado no encontrado');
    if (!period) throw new NotFoundException('Período no encontrado');
    return this.prisma.payrollNovelty.create({
      data: { ...dto, fecha: new Date(dto.fecha), tenantId },
    });
  }

  async findNovelties(tenantId: string, employeeId?: string) {
    return this.prisma.payrollNovelty.findMany({
      where: { tenantId, ...(employeeId ? { employeeId } : {}) },
      include: {
        employee: {
          select: {
            id: true,
            primerNombre: true,
            segundoNombre: true,
            primerApellido: true,
            segundoApellido: true,
          },
        },
      },
      orderBy: { fecha: 'desc' },
    });
  }

  async getDashboard(tenantId: string) {
    const [periods, totalRuns] = await Promise.all([
      this.prisma.payrollPeriod.count({ where: { tenantId } }),
      this.prisma.payrollRun.count({ where: { tenantId } }),
    ]);

    const lastPeriod = await this.prisma.payrollPeriod.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, nombre: true, status: true },
    });

    let lastPeriodTotals = {
      totalDevengos: 0,
      totalDeducciones: 0,
      totalNeto: 0,
    };
    if (lastPeriod) {
      const runs = await this.prisma.payrollRun.findMany({
        where: { tenantId, payrollPeriodId: lastPeriod.id },
      });
      lastPeriodTotals = {
        totalDevengos: runs.reduce((s, r) => s + Number(r.totalDevengos), 0),
        totalDeducciones: runs.reduce(
          (s, r) => s + Number(r.totalDeducciones),
          0,
        ),
        totalNeto: runs.reduce((s, r) => s + Number(r.netoPagar), 0),
      };
    }

    return {
      totalPeriodos: periods,
      empleadosLiquidados: totalRuns,
      ...lastPeriodTotals,
      ultimoPeriodo: lastPeriod?.nombre ?? null,
    };
  }
}
