import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  PayrollCorrectionStatus,
  PayrollPeriodStatus,
  Prisma,
  ServicePremiumBatchStatus,
  ServicePremiumLineStatus,
} from '@prisma/client';
import { randomUUID, createHash } from 'node:crypto';
import { AuditService } from '../../audit/audit.service';
import { ExpedienteDocsService } from '../../expediente-docs/expediente-docs.service';
import { PdfRenderService } from '../../pdf-render/pdf-render.service';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { TenantContextService } from '../../tenant-context/tenant-context.service';
import { TenantExecutionContext } from '../../tenant-context/tenant-context.types';
import { TenantPrismaService } from '../../tenant-prisma/tenant-prisma.service';
import {
  calculateServicePremium,
  SERVICE_PREMIUM_FORMULA_VERSION,
} from './service-premium-calculator';
import { CreateServicePremiumBatchDto } from './service-premium.dto';

const LEASE_MS = 5 * 60_000;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatCop(value: unknown): string {
  const amount = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(amount)) return 'No disponible';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

@Injectable()
export class ServicePremiumService {
  private readonly logger = new Logger(ServicePremiumService.name);
  private readonly workerId = randomUUID();

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPrisma: TenantPrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly audit: AuditService,
    private readonly pdfRender: PdfRenderService,
    private readonly storage: StorageService,
    private readonly expediente: ExpedienteDocsService,
  ) {}

  async list(tenantId: string, year?: number) {
    if (
      year !== undefined &&
      (!Number.isInteger(year) || year < 2000 || year > 9999)
    ) {
      throw new BadRequestException('Año inválido.');
    }
    return this.tenantPrisma.execute((tx) =>
      tx.servicePremiumBatch.findMany({
        where: { tenantId, ...(year ? { anio: year } : {}) },
        orderBy: [{ anio: 'desc' }, { semestre: 'desc' }, { version: 'desc' }],
        include: {
          _count: { select: { lines: true } },
          lines: {
            select: { status: true, amount: true },
          },
        },
      }),
    );
  }

  async getOne(tenantId: string, id: string) {
    const batch = await this.tenantPrisma.execute((tx) =>
      tx.servicePremiumBatch.findFirst({
        where: { tenantId, id },
        include: {
          lines: {
            orderBy: [
              { employee: { primerApellido: 'asc' } },
              { employee: { primerNombre: 'asc' } },
            ],
            include: {
              employee: {
                select: {
                  id: true,
                  cedula: true,
                  primerNombre: true,
                  segundoNombre: true,
                  primerApellido: true,
                  segundoApellido: true,
                },
              },
              expedienteDoc: { select: { id: true } },
            },
          },
        },
      }),
    );
    if (!batch) throw new NotFoundException('Lote de prima no encontrado.');
    return batch;
  }

  async createPreview(
    tenantId: string,
    userId: string,
    dto: CreateServicePremiumBatchDto,
  ) {
    this.validateYearSemester(dto.year, dto.semester);
    const existing = await this.tenantPrisma.execute((tx) =>
      tx.servicePremiumBatch.findFirst({
        where: {
          tenantId,
          anio: dto.year,
          semestre: dto.semester,
          status: { not: 'ANULADO' },
        },
        orderBy: { version: 'desc' },
        select: { id: true },
      }),
    );
    if (existing) return this.getOne(tenantId, existing.id);
    try {
      return await this.createVersion(tenantId, userId, dto, { version: 1 });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const concurrent = await this.tenantPrisma.execute((tx) =>
          tx.servicePremiumBatch.findFirst({
            where: {
              tenantId,
              anio: dto.year,
              semestre: dto.semester,
              status: { not: ServicePremiumBatchStatus.ANULADO },
            },
            orderBy: { version: 'desc' },
            select: { id: true },
          }),
        );
        if (concurrent) return this.getOne(tenantId, concurrent.id);
      }
      throw error;
    }
  }

  async createCorrectionVersion(
    tenantId: string,
    userId: string,
    sourceBatchId: string,
    reason: string,
  ) {
    const normalizedReason = reason.trim();
    if (normalizedReason.length < 15 || normalizedReason.length > 500) {
      throw new BadRequestException(
        'La razón de corrección debe tener entre 15 y 500 caracteres.',
      );
    }
    const source = await this.getOne(tenantId, sourceBatchId);
    if (!['COMPLETADO', 'COMPLETADO_CON_BLOQUEOS'].includes(source.status)) {
      throw new ConflictException(
        'Solo se puede corregir un lote ya terminado.',
      );
    }
    const latest = await this.tenantPrisma.execute((tx) =>
      tx.servicePremiumBatch.findFirst({
        where: { tenantId, anio: source.anio, semestre: source.semestre },
        orderBy: { version: 'desc' },
        select: { version: true },
      }),
    );
    return this.createVersion(
      tenantId,
      userId,
      { year: source.anio, semester: source.semestre },
      {
        version: (latest?.version ?? source.version) + 1,
        supersedesBatchId: source.id,
        correctionReason: normalizedReason,
      },
    );
  }

  async approve(tenantId: string, userId: string, id: string) {
    return this.tenantPrisma.execute(async (tx) => {
      const batch = await tx.servicePremiumBatch.findFirst({
        where: { id, tenantId },
        select: { id: true, status: true, _count: { select: { lines: true } } },
      });
      if (!batch) throw new NotFoundException('Lote de prima no encontrado.');
      if (batch.status !== ServicePremiumBatchStatus.BORRADOR) {
        throw new ConflictException(
          'El lote ya no está en estado de borrador.',
        );
      }
      const readyCount = await tx.servicePremiumLine.count({
        where: {
          tenantId,
          batchId: id,
          status: ServicePremiumLineStatus.LISTA,
        },
      });
      if (readyCount === 0) {
        throw new ConflictException(
          'No hay empleados con un cálculo válido para aprobar.',
        );
      }
      const updated = await tx.servicePremiumBatch.updateMany({
        where: { id, tenantId, status: ServicePremiumBatchStatus.BORRADOR },
        data: {
          status: ServicePremiumBatchStatus.APROBADO,
          approvedById: userId,
          approvedAt: new Date(),
        },
      });
      if (updated.count !== 1)
        throw new ConflictException('El lote cambió durante la aprobación.');
      await tx.servicePremiumLine.updateMany({
        where: {
          tenantId,
          batchId: id,
          status: ServicePremiumLineStatus.LISTA,
        },
        data: { status: ServicePremiumLineStatus.APROBADA },
      });
      await this.audit.log(
        {
          tenantId,
          userId,
          action: 'SERVICE_PREMIUM_BATCH_APPROVED',
          entityType: 'ServicePremiumBatch',
          entityId: id,
          metadata: { approvedLineCount: readyCount },
        },
        tx,
      );
      return tx.servicePremiumBatch.findUniqueOrThrow({
        where: { id },
        include: { _count: { select: { lines: true } } },
      });
    });
  }

  async retryErrors(tenantId: string, userId: string, id: string) {
    return this.tenantPrisma.execute(async (tx) => {
      const batch = await tx.servicePremiumBatch.findFirst({
        where: { id, tenantId },
        select: { status: true },
      });
      if (!batch) throw new NotFoundException('Lote de prima no encontrado.');
      if (!['COMPLETADO_CON_BLOQUEOS', 'ERROR'].includes(batch.status)) {
        throw new ConflictException(
          'Solo se pueden reintentar documentos fallidos de un lote terminado.',
        );
      }
      const reset = await tx.servicePremiumLine.updateMany({
        where: {
          tenantId,
          batchId: id,
          status: ServicePremiumLineStatus.ERROR,
        },
        data: {
          status: ServicePremiumLineStatus.APROBADA,
          lastErrorCode: null,
        },
      });
      if (reset.count === 0)
        throw new ConflictException(
          'El lote no tiene documentos fallidos para reintentar.',
        );
      const updated = await tx.servicePremiumBatch.updateMany({
        where: {
          id,
          tenantId,
          status: {
            in: [
              ServicePremiumBatchStatus.COMPLETADO_CON_BLOQUEOS,
              ServicePremiumBatchStatus.ERROR,
            ],
          },
        },
        data: {
          status: ServicePremiumBatchStatus.APROBADO,
          completedAt: null,
          lastErrorCode: null,
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException(
          'El lote cambió mientras se preparaban los documentos para reintento.',
        );
      }
      await this.audit.log(
        {
          tenantId,
          userId,
          action: 'SERVICE_PREMIUM_DOCUMENTS_RETRY_REQUESTED',
          entityType: 'ServicePremiumBatch',
          entityId: id,
          metadata: { retriedLines: reset.count },
        },
        tx,
      );
      return {
        batchId: id,
        retriedLines: reset.count,
        status: ServicePremiumBatchStatus.APROBADO,
      };
    });
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async processApprovedBatches() {
    const tenants = await this.prisma.tenant.findMany({
      where: { activo: true },
      select: { id: true },
    });
    for (const tenant of tenants) {
      const context: TenantExecutionContext = {
        tenantId: tenant.id,
        userId: 'service-premium-worker',
        rol: 'ADMIN',
        email: 'service-premium-worker@system.invalid',
      };
      await this.tenantContext.run(context, async () => {
        try {
          await this.processNextBatch(tenant.id);
        } catch (error) {
          this.logger.error(
            `Falló el worker de prima para un tenant: ${String(error)}`,
          );
        }
      });
    }
  }

  private async createVersion(
    tenantId: string,
    userId: string,
    dto: CreateServicePremiumBatchDto,
    options: {
      version: number;
      supersedesBatchId?: string;
      correctionReason?: string;
    },
  ) {
    const preview = await this.buildPreview(tenantId, dto.year, dto.semester);
    if (preview.length === 0)
      throw new BadRequestException(
        'No hay empleados activos para construir el preview.',
      );
    const batch = await this.tenantPrisma.execute(async (tx) => {
      const created = await tx.servicePremiumBatch.create({
        data: {
          tenantId,
          anio: dto.year,
          semestre: dto.semester,
          version: options.version,
          formulaVersion: SERVICE_PREMIUM_FORMULA_VERSION,
          createdById: userId,
          correctionReason: options.correctionReason,
          supersedesBatchId: options.supersedesBatchId,
          lines: {
            create: preview.map((line) => ({
              employeeId: line.employee.id,
              status: line.status,
              snapshot: line.snapshot as Prisma.InputJsonValue,
              sourceFingerprint: line.sourceFingerprint,
              salaryBase: line.salaryBase,
              variableSalary: line.variableSalary,
              transportAllowance: line.transportAllowance,
              serviceDays360: line.serviceDays360,
              amount: line.amount,
              blockReason: line.blockReason,
              lastErrorCode: line.blockCode,
            })),
          },
        },
        select: { id: true },
      });
      await this.audit.log(
        {
          tenantId,
          userId,
          action: options.supersedesBatchId
            ? 'SERVICE_PREMIUM_CORRECTION_PREVIEW_CREATED'
            : 'SERVICE_PREMIUM_PREVIEW_CREATED',
          entityType: 'ServicePremiumBatch',
          entityId: created.id,
          metadata: {
            year: dto.year,
            semester: dto.semester,
            version: options.version,
            sourceBatchId: options.supersedesBatchId ?? null,
            correctionReason: options.correctionReason ?? null,
            ready: preview.filter((line) => line.status === 'LISTA').length,
            blocked: preview.filter((line) => line.status === 'BLOQUEADA')
              .length,
            notApplicable: preview.filter((line) => line.status === 'NO_APLICA')
              .length,
          },
        },
        tx,
      );
      return created;
    });
    return this.getOne(tenantId, batch.id);
  }

  private async buildPreview(tenantId: string, year: number, semester: number) {
    const semesterStart =
      semester === 1
        ? new Date(`${year}-01-01T00:00:00.000Z`)
        : new Date(`${year}-07-01T00:00:00.000Z`);
    const semesterEnd =
      semester === 1
        ? new Date(`${year}-07-01T00:00:00.000Z`)
        : new Date(`${year + 1}-01-01T00:00:00.000Z`);
    return this.tenantPrisma.execute(async (tx) => {
      const employees = await tx.empleado.findMany({
        where: {
          tenantId,
          deletedAt: null,
          estado: 'ACTIVO',
          fechaIngreso: { lt: semesterEnd },
        },
        select: {
          id: true,
          cedula: true,
          primerNombre: true,
          segundoNombre: true,
          primerApellido: true,
          segundoApellido: true,
        },
        orderBy: [{ primerApellido: 'asc' }, { primerNombre: 'asc' }],
      });
      const employeeIds = employees.map(({ id }) => id);
      if (employeeIds.length === 0) return [];
      const snapshots = await tx.payrollSnapshot.findMany({
        where: {
          tenantId,
          employeeId: { in: employeeIds },
          estadoPeriodo: {
            in: [PayrollPeriodStatus.APROBADA, PayrollPeriodStatus.CAUSADA],
          },
          payrollPeriod: {
            is: {
              tenantId,
              status: {
                in: [PayrollPeriodStatus.APROBADA, PayrollPeriodStatus.CAUSADA],
              },
              fechaInicio: { lt: semesterEnd },
              fechaFin: { gte: semesterStart },
            },
          },
        },
        select: {
          id: true,
          employeeId: true,
          payrollPeriodId: true,
          payloadVersion: true,
          estadoPeriodo: true,
          payload: true,
        },
        orderBy: { createdAt: 'asc' },
      });
      const periodIds = [
        ...new Set(snapshots.map(({ payrollPeriodId }) => payrollPeriodId)),
      ];
      const corrections = periodIds.length
        ? await tx.payrollCorrection.findMany({
            where: {
              tenantId,
              payrollPeriodId: { in: periodIds },
              status: {
                in: [
                  PayrollCorrectionStatus.BORRADOR,
                  PayrollCorrectionStatus.EN_REVISION,
                  PayrollCorrectionStatus.APROBADA,
                ],
              },
            },
            select: {
              id: true,
              payrollPeriodId: true,
              status: true,
              intent: true,
              materialization: true,
            },
          })
        : [];
      return employees.map((row) =>
        calculateServicePremium({
          employee: {
            id: row.id,
            fullName: [
              row.primerNombre,
              row.segundoNombre,
              row.primerApellido,
              row.segundoApellido,
            ]
              .filter(Boolean)
              .join(' '),
            identification: row.cedula,
            active: true,
          },
          year,
          semester,
          snapshots: snapshots.map((source) => ({
            id: source.id,
            employeeId: source.employeeId,
            payrollPeriodId: source.payrollPeriodId,
            payloadVersion: source.payloadVersion,
            estadoPeriodo: source.estadoPeriodo,
            payload: source.payload,
          })),
          corrections: corrections.map((correction) => ({
            id: correction.id,
            payrollPeriodId: correction.payrollPeriodId,
            status: correction.status,
            intent: correction.intent,
            materialization: correction.materialization,
          })),
        }),
      );
    });
  }

  private async processNextBatch(tenantId: string) {
    const now = new Date();
    const batchId = await this.tenantPrisma.execute(async (tx) => {
      const candidate = await tx.servicePremiumBatch.findFirst({
        where: {
          tenantId,
          OR: [
            { status: ServicePremiumBatchStatus.APROBADO },
            {
              status: ServicePremiumBatchStatus.PROCESANDO,
              processingLeaseUntil: { lt: now },
            },
          ],
        },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      if (!candidate) return null;
      const claim = await tx.servicePremiumBatch.updateMany({
        where: {
          id: candidate.id,
          tenantId,
          OR: [
            { status: ServicePremiumBatchStatus.APROBADO },
            {
              status: ServicePremiumBatchStatus.PROCESANDO,
              processingLeaseUntil: { lt: now },
            },
          ],
        },
        data: {
          status: ServicePremiumBatchStatus.PROCESANDO,
          processingLeaseOwner: this.workerId,
          processingLeaseUntil: new Date(now.getTime() + LEASE_MS),
        },
      });
      if (claim.count !== 1) return null;
      await tx.servicePremiumLine.updateMany({
        where: {
          tenantId,
          batchId: candidate.id,
          status: ServicePremiumLineStatus.PROCESANDO,
        },
        data: { status: ServicePremiumLineStatus.APROBADA },
      });
      return candidate.id;
    });
    if (!batchId) return;

    const batch = await this.tenantPrisma.execute((tx) =>
      tx.servicePremiumBatch.findFirst({
        where: { id: batchId, tenantId, processingLeaseOwner: this.workerId },
        include: {
          lines: {
            where: { status: ServicePremiumLineStatus.APROBADA },
            include: {
              employee: {
                select: {
                  id: true,
                  primerNombre: true,
                  segundoNombre: true,
                  primerApellido: true,
                  segundoApellido: true,
                  cedula: true,
                },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      }),
    );
    if (!batch) return;
    const actorId = batch.approvedById ?? batch.createdById;
    for (const line of batch.lines) {
      const claim = await this.tenantPrisma.execute((tx) =>
        tx.servicePremiumLine.updateMany({
          where: {
            id: line.id,
            tenantId,
            batchId,
            status: ServicePremiumLineStatus.APROBADA,
          },
          data: {
            status: ServicePremiumLineStatus.PROCESANDO,
            processingAttempts: { increment: 1 },
          },
        }),
      );
      if (claim.count !== 1) continue;
      try {
        await this.tenantPrisma.execute((tx) =>
          tx.servicePremiumBatch.updateMany({
            where: {
              id: batchId,
              tenantId,
              processingLeaseOwner: this.workerId,
            },
            data: { processingLeaseUntil: new Date(Date.now() + LEASE_MS) },
          }),
        );
        const result = await this.materializePdf({ tenantId, batch, line });
        await this.expediente.publishServicePremiumDocument({
          tenantId,
          userId: actorId,
          lineId: line.id,
          storageKey: result.key,
          sizeBytes: result.size,
          sha256: result.sha256,
        });
      } catch (error) {
        this.logger.error(
          `No se pudo generar el documento de prima ${line.id}: ${String(error)}`,
        );
        await this.tenantPrisma.execute((tx) =>
          tx.servicePremiumLine.updateMany({
            where: {
              id: line.id,
              tenantId,
              status: ServicePremiumLineStatus.PROCESANDO,
            },
            data: {
              status: ServicePremiumLineStatus.ERROR,
              lastErrorCode: 'PDF_OR_EXPEDIENTE_ERROR',
            },
          }),
        );
      }
    }
    const counts = await this.tenantPrisma.execute((tx) =>
      tx.servicePremiumLine.groupBy({
        by: ['status'],
        where: { tenantId, batchId },
        _count: { _all: true },
      }),
    );
    const hasBlockers = counts.some(
      ({ status, _count }) =>
        (status === ServicePremiumLineStatus.BLOQUEADA ||
          status === ServicePremiumLineStatus.ERROR) &&
        _count._all > 0,
    );
    await this.tenantPrisma.execute(async (tx) => {
      await tx.servicePremiumBatch.updateMany({
        where: {
          id: batchId,
          tenantId,
          status: ServicePremiumBatchStatus.PROCESANDO,
          processingLeaseOwner: this.workerId,
        },
        data: {
          status: hasBlockers
            ? ServicePremiumBatchStatus.COMPLETADO_CON_BLOQUEOS
            : ServicePremiumBatchStatus.COMPLETADO,
          completedAt: new Date(),
          processingLeaseOwner: null,
          processingLeaseUntil: null,
        },
      });
    });
  }

  private async materializePdf(input: {
    tenantId: string;
    batch: Prisma.ServicePremiumBatchGetPayload<{
      include: {
        lines: {
          include: {
            employee: {
              select: {
                id: true;
                primerNombre: true;
                segundoNombre: true;
                primerApellido: true;
                segundoApellido: true;
                cedula: true;
              };
            };
          };
        };
      };
    }>;
    line: Prisma.ServicePremiumLineGetPayload<{
      include: {
        employee: {
          select: {
            id: true;
            primerNombre: true;
            segundoNombre: true;
            primerApellido: true;
            segundoApellido: true;
            cedula: true;
          };
        };
      };
    }>;
  }) {
    const { tenantId, batch, line } = input;
    const key = `${tenantId}/nomina/prima/${batch.anio}/S${batch.semestre}/v${batch.version}/${line.id}.pdf`;
    let pdf: Buffer;
    if (await this.storage.objectExists(key)) {
      pdf = await this.storage.getObject(key);
    } else {
      const snapshot = isRecord(line.snapshot) ? line.snapshot : {};
      const employee = isRecord(snapshot.employee) ? snapshot.employee : {};
      const fullName =
        typeof employee.fullName === 'string'
          ? employee.fullName
          : [
              line.employee.primerNombre,
              line.employee.segundoNombre,
              line.employee.primerApellido,
              line.employee.segundoApellido,
            ]
              .filter(Boolean)
              .join(' ');
      const identification =
        typeof employee.identification === 'string'
          ? employee.identification
          : line.employee.cedula;
      const sourceIds = Array.isArray(snapshot.sourceSnapshotIds)
        ? snapshot.sourceSnapshotIds.filter(
            (id): id is string => typeof id === 'string',
          )
        : [];
      const formulaCode = `PRIMA_SEMESTRAL_V${batch.formulaVersion}`;
      const formula = `(${formatCop(line.salaryBase)} + ${formatCop(line.variableSalary)} + ${formatCop(line.transportAllowance)}) × ${line.serviceDays360} / 360`;
      const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
        body{font-family:Arial,sans-serif;color:#172033;font-size:12px;line-height:1.55}h1{font-size:22px;margin:0 0 4px}h2{font-size:14px;margin:22px 0 8px;color:#334155}.muted{color:#64748b}.brand{border-bottom:2px solid #1d4ed8;padding-bottom:14px;margin-bottom:22px}.card{border:1px solid #cbd5e1;padding:14px;border-radius:6px}.amount{font-size:24px;font-weight:bold;color:#1d4ed8}.notice{margin-top:24px;padding:10px;background:#eff6ff;color:#1e3a8a}table{width:100%;border-collapse:collapse}td{padding:7px;border-bottom:1px solid #e2e8f0}td:first-child{color:#64748b;width:38%}
        </style></head><body><div class="brand"><h1>Prima de servicios</h1><div class="muted">Liquidación semestral • ${batch.anio} • ${batch.semestre === 1 ? 'Enero a junio' : 'Julio a diciembre'} • Versión ${batch.version}</div></div>
        <h2>Empleado</h2><div class="card"><table><tr><td>Nombre</td><td>${escapeHtml(fullName || 'No disponible')}</td></tr><tr><td>Identificación</td><td>${escapeHtml(identification)}</td></tr></table></div>
        <h2>Detalle del cálculo</h2><div class="card"><table><tr><td>Salario fijo mensual</td><td>${formatCop(line.salaryBase)}</td></tr><tr><td>Promedio variable salarial</td><td>${formatCop(line.variableSalary)}</td></tr><tr><td>Auxilio de transporte promedio causado</td><td>${formatCop(line.transportAllowance)}</td></tr><tr><td>Días de servicio (convención 30/360)</td><td>${line.serviceDays360}</td></tr><tr><td>Fórmula versionada</td><td>${formula}</td></tr></table><p class="amount">${formatCop(line.amount)}</p></div>
        <h2>Origen y trazabilidad</h2><p>Este cálculo usa ${sourceIds.length} snapshot(s) de nómina aprobada. Huella de origen: ${escapeHtml(line.sourceFingerprint ?? 'No disponible')}.</p><p class="muted">Código de fórmula: ${formulaCode}. Este documento conserva el resultado aprobado del lote; no incluye pagos ni asientos contables.</p>
        <div class="notice">Resultado calculado con la regla ${formulaCode} y datos aprobados congelados. Verifica el cálculo con el responsable de nómina antes de usarlo para pagar una obligación. Este documento no acredita el pago de la prima.</div></body></html>`;
      pdf = await this.pdfRender.renderPdf(html);
      await this.storage.putObject({
        key,
        body: pdf,
        contentType: 'application/pdf',
      });
    }
    return {
      key,
      size: pdf.length,
      sha256: createHash('sha256').update(pdf).digest('hex'),
    };
  }

  private validateYearSemester(year: number, semester: number) {
    if (
      !Number.isInteger(year) ||
      year < 2000 ||
      year > 9999 ||
      ![1, 2].includes(semester)
    ) {
      throw new BadRequestException('Año o semestre inválido.');
    }
    if (semester !== 1) {
      throw new BadRequestException(
        'La prima de julio–diciembre aún no está habilitada.',
      );
    }
  }
}
