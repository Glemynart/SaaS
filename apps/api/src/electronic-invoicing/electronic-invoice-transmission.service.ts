import { createHash, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EstadoFacturaElectronica,
  EstadoResultadoIntentoFacturaElectronica,
  Prisma,
  TipoIntentoFacturaElectronica,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { StorageService } from '../storage/storage.service';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import {
  ElectronicInvoiceProviderOutcome,
  ElectronicInvoiceSubmission,
} from './provider/electronic-invoice-provider.port';
import { transitionElectronicInvoice } from './domain/electronic-invoice';

const MAX_EVIDENCE_BYTES = 20 * 1024 * 1024;
const MAX_CANONICAL_PAYLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_EVIDENCE_TYPES = new Set([
  'application/json',
  'application/pdf',
  'application/xml',
  'application/octet-stream',
  'text/xml',
]);

export type RegisterTransmissionInput = Readonly<{
  invoiceId: string;
  eventId: string;
  payloadVersion: string;
  canonicalPayload: string;
  providerId: string;
  contractVersion: string;
}>;

export type StartTransmissionAttemptInput = Readonly<{
  transmissionId: string;
  type: TipoIntentoFacturaElectronica;
}>;

export type StartedTransmissionAttempt = Readonly<{
  attemptId: string;
  attemptNumber: number;
  type: TipoIntentoFacturaElectronica;
  submission?: ElectronicInvoiceSubmission;
  reconciliation?: {
    tenantId: string;
    invoiceId: string;
    eventId: string;
    idempotencyKey: string;
    providerReference?: string;
  };
}>;

@Injectable()
export class ElectronicInvoiceTransmissionService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
  ) {}

  /**
   * Persists the stable event identity before any provider request. The caller
   * supplies the already-numbered invoice and canonical payload; this method
   * never allocates a number or transmits a document.
   */
  async registerTransmission(input: RegisterTransmissionInput) {
    const canonicalPayload = input.canonicalPayload;
    const eventId = input.eventId.trim();
    const payloadVersion = input.payloadVersion.trim();
    const providerId = input.providerId.trim();
    const contractVersion = input.contractVersion.trim();
    if (
      !input.invoiceId.trim() ||
      !eventId ||
      eventId.length > 120 ||
      !payloadVersion ||
      payloadVersion.length > 40 ||
      !providerId ||
      providerId.length > 80 ||
      !contractVersion ||
      contractVersion.length > 80 ||
      !canonicalPayload.trim() ||
      Buffer.byteLength(canonicalPayload, 'utf8') > MAX_CANONICAL_PAYLOAD_BYTES
    ) {
      throw new BadRequestException(
        'La identidad y el payload de transmisión no son válidos.',
      );
    }
    let parsedPayload: unknown;
    try {
      parsedPayload = JSON.parse(canonicalPayload);
    } catch {
      throw new BadRequestException(
        'El payload canónico de transmisión debe ser JSON válido.',
      );
    }
    if (
      parsedPayload === null ||
      typeof parsedPayload !== 'object' ||
      Array.isArray(parsedPayload)
    ) {
      throw new BadRequestException(
        'El payload canónico de transmisión debe ser un objeto JSON.',
      );
    }
    const payloadHash = sha256(canonicalPayload);

    return this.tenantPrisma
      .execute(async (prisma, context) => {
        const idempotencyKey = sha256(
          [context.tenantId, input.invoiceId, eventId, payloadHash].join(
            '\u0000',
          ),
        );
        const existing = await prisma.facturaElectronicaTransmision.findFirst({
          where: {
            tenantId: context.tenantId,
            facturaElectronicaId: input.invoiceId,
            eventoId: eventId,
          },
        });
        if (existing) {
          assertSameTransmission(existing, {
            idempotencyKey,
            payloadHash,
            payloadVersion,
            canonicalPayload,
            providerId,
            contractVersion,
          });
          return existing;
        }

        const invoice = await prisma.facturaElectronica.findFirst({
          where: { id: input.invoiceId, tenantId: context.tenantId },
          select: { id: true, estado: true, numero: true },
        });
        if (!invoice)
          throw new NotFoundException('Factura electrónica no encontrada.');
        if (
          invoice.estado !== EstadoFacturaElectronica.EN_COLA ||
          invoice.numero === null
        ) {
          throw new ConflictException(
            'Solo se puede registrar una transmisión para una factura numerada en cola.',
          );
        }

        const transmission = await prisma.facturaElectronicaTransmision.create({
          data: {
            id: randomUUID(),
            tenantId: context.tenantId,
            facturaElectronicaId: invoice.id,
            eventoId: eventId,
            claveIdempotencia: idempotencyKey,
            versionPayload: payloadVersion,
            hashPayload: payloadHash,
            payloadCanonico: canonicalPayload,
            providerId,
            contractVersion,
          },
        });
        await prisma.transicionFacturaElectronica.create({
          data: {
            id: randomUUID(),
            tenantId: context.tenantId,
            facturaElectronicaId: invoice.id,
            transmisionId: transmission.id,
            desde: null,
            hasta: EstadoFacturaElectronica.EN_COLA,
            evento: 'TRANSMISSION_REGISTERED',
            actorUserId: context.userId,
          },
        });
        await this.audit.log(
          {
            tenantId: context.tenantId,
            userId: context.userId,
            action: 'ELECTRONIC_INVOICE_TRANSMISSION_REGISTERED',
            entityType: 'FacturaElectronicaTransmision',
            entityId: transmission.id,
            metadata: {
              facturaElectronicaId: invoice.id,
              eventoId: eventId,
              payloadVersion,
              payloadHash,
              providerId,
              contractVersion,
            },
          },
          prisma,
        );
        return transmission;
      })
      .catch(async (error: unknown) => {
        if (
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          error.code !== 'P2002'
        ) {
          throw error;
        }
        return this.tenantPrisma.execute(async (prisma, context) => {
          const existing = await prisma.facturaElectronicaTransmision.findFirst(
            {
              where: {
                tenantId: context.tenantId,
                facturaElectronicaId: input.invoiceId,
                eventoId: eventId,
              },
            },
          );
          if (!existing) {
            throw new ConflictException(
              'La transmisión cambió mientras se registraba el evento.',
            );
          }
          assertSameTransmission(existing, {
            idempotencyKey: sha256(
              [context.tenantId, input.invoiceId, eventId, payloadHash].join(
                '\u0000',
              ),
            ),
            payloadHash,
            payloadVersion,
            canonicalPayload,
            providerId,
            contractVersion,
          });
          return existing;
        });
      });
  }

  /** Starts one durable attempt and returns the exact stored request for a worker. */
  async startAttempt(
    input: StartTransmissionAttemptInput,
  ): Promise<StartedTransmissionAttempt> {
    if (
      input.type !== TipoIntentoFacturaElectronica.ENVIO &&
      input.type !== TipoIntentoFacturaElectronica.CONCILIACION
    ) {
      throw new BadRequestException(
        'Tipo de intento de transmisión no válido.',
      );
    }
    return this.tenantPrisma.execute(async (prisma, context) => {
      const transmission = await prisma.facturaElectronicaTransmision.findFirst(
        {
          where: { id: input.transmissionId, tenantId: context.tenantId },
          include: {
            facturaElectronica: { select: { id: true, estado: true } },
            intentos: {
              orderBy: { numeroIntento: 'desc' },
              take: 1,
              include: { resultado: true },
            },
          },
        },
      );
      if (!transmission) {
        throw new NotFoundException(
          'Transmisión de factura electrónica no encontrada.',
        );
      }

      const latestAttempt = transmission.intentos[0];
      if (
        input.type === TipoIntentoFacturaElectronica.ENVIO &&
        latestAttempt &&
        !latestAttempt.resultado
      ) {
        throw new ConflictException(
          'El intento anterior no tiene resultado; debe conciliarse antes de iniciar otro.',
        );
      }

      let currentStatus = transmission.facturaElectronica.estado;
      if (input.type === TipoIntentoFacturaElectronica.ENVIO) {
        if (
          currentStatus === EstadoFacturaElectronica.ERROR_TECNICO &&
          latestAttempt?.resultado?.estado ===
            EstadoResultadoIntentoFacturaElectronica.ERROR_TECNICO &&
          latestAttempt.resultado.receiptConfirmedAbsent
        ) {
          const queuedStatus = transitionElectronicInvoice(currentStatus, {
            type: 'RETRY_TECHNICAL',
            receiptConfirmedAbsent: true,
          });
          await this.changeInvoiceStatus(prisma, {
            tenantId: context.tenantId,
            invoiceId: transmission.facturaElectronicaId,
            transmissionId: transmission.id,
            attemptId: latestAttempt.id,
            from: currentStatus,
            to: queuedStatus,
            event: 'RETRY_TECHNICAL',
            actorUserId: context.userId,
          });
          currentStatus = queuedStatus;
        }
        if (currentStatus !== EstadoFacturaElectronica.EN_COLA) {
          throw new ConflictException(
            'Solo se puede enviar una factura en cola o reintentar un fallo confirmado como no recibido.',
          );
        }
      } else {
        if (
          currentStatus === EstadoFacturaElectronica.EN_TRANSMISION &&
          latestAttempt?.tipo === TipoIntentoFacturaElectronica.ENVIO &&
          !latestAttempt.resultado
        ) {
          const pendingStatus = transitionElectronicInvoice(currentStatus, {
            type: 'AMBIGUOUS_OUTCOME',
          });
          await this.changeInvoiceStatus(prisma, {
            tenantId: context.tenantId,
            invoiceId: transmission.facturaElectronicaId,
            transmissionId: transmission.id,
            attemptId: latestAttempt.id,
            from: currentStatus,
            to: pendingStatus,
            event: 'RECOVER_UNCONFIRMED_ATTEMPT',
            actorUserId: context.userId,
          });
          currentStatus = pendingStatus;
        }
        if (currentStatus !== EstadoFacturaElectronica.PENDIENTE_CONCILIACION) {
          throw new ConflictException(
            'Solo se puede conciliar una factura pendiente o recuperar un envío sin resultado.',
          );
        }
      }

      const nextAttemptNumber = transmission.ultimoIntento + 1;
      const sequenceUpdate =
        await prisma.facturaElectronicaTransmision.updateMany({
          where: {
            id: transmission.id,
            tenantId: context.tenantId,
            ultimoIntento: transmission.ultimoIntento,
          },
          data: { ultimoIntento: { increment: 1 } },
        });
      if (sequenceUpdate.count !== 1) {
        throw new ConflictException(
          'La transmisión cambió mientras se iniciaba el intento.',
        );
      }

      const attempt = await prisma.intentoFacturaElectronica.create({
        data: {
          id: randomUUID(),
          tenantId: context.tenantId,
          transmisionId: transmission.id,
          numeroIntento: nextAttemptNumber,
          tipo: input.type,
          providerId: transmission.providerId,
          contractVersion: transmission.contractVersion,
        },
      });

      const nextStatus =
        input.type === TipoIntentoFacturaElectronica.ENVIO
          ? transitionElectronicInvoice(currentStatus, {
              type: 'START_TRANSMISSION',
            })
          : currentStatus;
      await this.changeInvoiceStatus(prisma, {
        tenantId: context.tenantId,
        invoiceId: transmission.facturaElectronicaId,
        transmissionId: transmission.id,
        attemptId: attempt.id,
        from: currentStatus,
        to: nextStatus,
        event:
          input.type === TipoIntentoFacturaElectronica.ENVIO
            ? 'START_TRANSMISSION'
            : 'RECONCILIATION_STARTED',
        actorUserId: context.userId,
      });
      await this.audit.log(
        {
          tenantId: context.tenantId,
          userId: context.userId,
          action: 'ELECTRONIC_INVOICE_ATTEMPT_STARTED',
          entityType: 'IntentoFacturaElectronica',
          entityId: attempt.id,
          metadata: {
            transmissionId: transmission.id,
            attemptNumber: nextAttemptNumber,
            type: input.type,
            providerId: transmission.providerId,
            contractVersion: transmission.contractVersion,
          },
        },
        prisma,
      );

      if (input.type === TipoIntentoFacturaElectronica.ENVIO) {
        return {
          attemptId: attempt.id,
          attemptNumber: nextAttemptNumber,
          type: input.type,
          submission: {
            tenantId: context.tenantId,
            invoiceId: transmission.facturaElectronicaId,
            eventId: transmission.eventoId,
            idempotencyKey: transmission.claveIdempotencia,
            payloadVersion: transmission.versionPayload,
            payloadHash: transmission.hashPayload,
            canonicalPayload: transmission.payloadCanonico,
          },
        };
      }

      return {
        attemptId: attempt.id,
        attemptNumber: nextAttemptNumber,
        type: input.type,
        reconciliation: {
          tenantId: context.tenantId,
          invoiceId: transmission.facturaElectronicaId,
          eventId: transmission.eventoId,
          idempotencyKey: transmission.claveIdempotencia,
          providerReference:
            latestAttempt?.resultado?.providerReference ?? undefined,
        },
      };
    });
  }

  /** Persists normalized provider output before advancing the fiscal state. */
  async recordOutcome(
    transmissionId: string,
    attemptId: string,
    outcome: ElectronicInvoiceProviderOutcome,
  ) {
    const existing = await this.tenantPrisma.execute(
      async (prisma, { tenantId }) => {
        const attempt = await prisma.intentoFacturaElectronica.findFirst({
          where: { id: attemptId, tenantId, transmisionId: transmissionId },
          include: { resultado: true },
        });
        if (!attempt)
          throw new NotFoundException('Intento de transmisión no encontrado.');
        return attempt.resultado;
      },
    );
    const evidenceInfo = outcome.evidence
      ? inspectEvidence(outcome.evidence)
      : undefined;
    const evidenceHash = evidenceInfo?.sha256;
    const desiredState = resultStatus(outcome.status);
    if (existing) {
      assertSameOutcome(existing, outcome, evidenceHash);
      return existing;
    }

    let evidenceKey: string | undefined;
    if (outcome.evidence && evidenceHash) {
      const { tenantId } = await this.tenantPrisma.execute(
        async (prisma, context) => {
          const attempt = await prisma.intentoFacturaElectronica.findFirst({
            where: {
              id: attemptId,
              tenantId: context.tenantId,
              transmisionId: transmissionId,
            },
            select: { id: true },
          });
          if (!attempt)
            throw new NotFoundException(
              'Intento de transmisión no encontrado.',
            );
          return { tenantId: context.tenantId };
        },
      );
      evidenceKey = `${tenantId}/facturacion-electronica/${transmissionId}/${attemptId}/${evidenceHash}`;
      if (await this.storage.objectExists(evidenceKey)) {
        const storedEvidence = await this.storage.getObject(evidenceKey);
        const storedHash = createHash('sha256')
          .update(storedEvidence)
          .digest('hex');
        if (storedHash !== evidenceHash) {
          throw new ConflictException(
            'La evidencia almacenada no coincide con su checksum.',
          );
        }
      } else {
        const storedMetadata = await this.storage.putObject({
          key: evidenceKey,
          body: outcome.evidence.bytes,
          contentType: evidenceInfo?.contentType,
        });
        if (
          storedMetadata.key !== evidenceKey ||
          storedMetadata.size !== outcome.evidence.bytes.length
        ) {
          throw new ConflictException(
            'El almacenamiento no confirmó la evidencia completa.',
          );
        }
      }
    }

    try {
      return await this.tenantPrisma.execute(async (prisma, context) => {
        const attempt = await prisma.intentoFacturaElectronica.findFirst({
          where: {
            id: attemptId,
            tenantId: context.tenantId,
            transmisionId: transmissionId,
          },
          include: {
            resultado: true,
            transmision: { include: { facturaElectronica: true } },
          },
        });
        if (!attempt)
          throw new NotFoundException('Intento de transmisión no encontrado.');
        if (attempt.resultado) {
          assertSameOutcome(attempt.resultado, outcome, evidenceHash);
          return attempt.resultado;
        }

        const invoice = attempt.transmision.facturaElectronica;
        const providerAcceptedAt =
          outcome.status === 'ACCEPTED'
            ? parseProviderDate(outcome.acceptedAt)
            : null;
        const hasEvidence = Boolean(evidenceKey);
        const acceptanceEvidenceComplete =
          hasEvidence &&
          providerAcceptedAt !== null &&
          normalizeProviderReference(
            outcome.status === 'ACCEPTED'
              ? outcome.providerReference
              : undefined,
          ) !== undefined;
        const nextStatus = nextStatusFromOutcome(
          invoice.estado,
          attempt.tipo,
          outcome.status,
          outcome.status === 'ACCEPTED'
            ? acceptanceEvidenceComplete
            : hasEvidence,
        );
        const issues =
          outcome.status === 'REJECTED'
            ? sanitizeIssues(outcome.issues)
            : undefined;
        const providerReference =
          'providerReference' in outcome
            ? normalizeProviderReference(outcome.providerReference)
            : undefined;

        const result = await prisma.resultadoIntentoFacturaElectronica.create({
          data: {
            id: randomUUID(),
            tenantId: context.tenantId,
            intentoId: attempt.id,
            estado: desiredState,
            providerReference,
            providerAcceptedAt,
            contenidoTypeEvidencia: evidenceInfo?.contentType,
            storageKeyEvidencia: evidenceKey,
            sha256Evidencia: evidenceHash,
            ...(issues ? { issues: issues } : {}),
          },
        });
        await this.changeInvoiceStatus(prisma, {
          tenantId: context.tenantId,
          invoiceId: invoice.id,
          transmissionId,
          attemptId: attempt.id,
          from: invoice.estado,
          to: nextStatus,
          event: `OUTCOME_${outcome.status}`,
          actorUserId: context.userId,
        });
        await this.audit.log(
          {
            tenantId: context.tenantId,
            userId: context.userId,
            action: 'ELECTRONIC_INVOICE_ATTEMPT_RECORDED',
            entityType: 'ResultadoIntentoFacturaElectronica',
            entityId: result.id,
            metadata: {
              transmissionId,
              attemptId,
              result: desiredState,
              resultingInvoiceState: nextStatus,
              evidencePersisted: hasEvidence,
              acceptanceEvidenceComplete,
            },
          },
          prisma,
        );
        return result;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const committedResult = await this.tenantPrisma.execute(
          async (prisma, { tenantId }) =>
            prisma.resultadoIntentoFacturaElectronica.findFirst({
              where: { tenantId, intentoId: attemptId },
            }),
        );
        if (committedResult) {
          if (evidenceKey) {
            await this.deleteUnreferencedEvidence(attemptId, evidenceKey);
          }
          assertSameOutcome(committedResult, outcome, evidenceHash);
          return committedResult;
        }
      }
      if (evidenceKey) {
        await this.deleteUnreferencedEvidence(attemptId, evidenceKey);
      }
      throw error;
    }
  }

  /** A thrown provider/network error is safe to retry only if absence was confirmed. */
  async recordFailure(
    transmissionId: string,
    attemptId: string,
    input: { code: string; receiptConfirmedAbsent: boolean },
  ) {
    try {
      return await this.tenantPrisma.execute(async (prisma, context) => {
        const attempt = await prisma.intentoFacturaElectronica.findFirst({
          where: {
            id: attemptId,
            tenantId: context.tenantId,
            transmisionId: transmissionId,
          },
          include: {
            resultado: true,
            transmision: { include: { facturaElectronica: true } },
          },
        });
        if (!attempt)
          throw new NotFoundException('Intento de transmisión no encontrado.');
        const receiptConfirmedAbsent =
          attempt.tipo === TipoIntentoFacturaElectronica.ENVIO &&
          input.receiptConfirmedAbsent;
        if (attempt.resultado) {
          if (
            attempt.resultado.estado ===
              EstadoResultadoIntentoFacturaElectronica.ERROR_TECNICO &&
            attempt.resultado.codigoError === normalizeErrorCode(input.code) &&
            attempt.resultado.receiptConfirmedAbsent === receiptConfirmedAbsent
          ) {
            return attempt.resultado;
          }
          throw new ConflictException(
            'El intento ya tiene un resultado distinto.',
          );
        }

        const invoice = attempt.transmision.facturaElectronica;
        const nextStatus =
          attempt.tipo === TipoIntentoFacturaElectronica.ENVIO
            ? transitionElectronicInvoice(invoice.estado, {
                type: 'TECHNICAL_FAILURE',
                receiptConfirmedAbsent,
              })
            : invoice.estado;
        const result = await prisma.resultadoIntentoFacturaElectronica.create({
          data: {
            id: randomUUID(),
            tenantId: context.tenantId,
            intentoId: attempt.id,
            estado: EstadoResultadoIntentoFacturaElectronica.ERROR_TECNICO,
            codigoError: normalizeErrorCode(input.code),
            receiptConfirmedAbsent,
          },
        });
        await this.changeInvoiceStatus(prisma, {
          tenantId: context.tenantId,
          invoiceId: invoice.id,
          transmissionId,
          attemptId: attempt.id,
          from: invoice.estado,
          to: nextStatus,
          event:
            attempt.tipo === TipoIntentoFacturaElectronica.ENVIO
              ? 'TECHNICAL_FAILURE'
              : 'RECONCILIATION_FAILURE',
          actorUserId: context.userId,
        });
        await this.audit.log(
          {
            tenantId: context.tenantId,
            userId: context.userId,
            action: 'ELECTRONIC_INVOICE_ATTEMPT_FAILED',
            entityType: 'ResultadoIntentoFacturaElectronica',
            entityId: result.id,
            metadata: {
              transmissionId,
              attemptId,
              errorCode: result.codigoError,
              receiptConfirmedAbsent: result.receiptConfirmedAbsent,
              resultingInvoiceState: nextStatus,
            },
          },
          prisma,
        );
        return result;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const committedAttempt = await this.tenantPrisma.execute(
          async (prisma, { tenantId }) =>
            prisma.intentoFacturaElectronica.findFirst({
              where: { id: attemptId, tenantId, transmisionId: transmissionId },
              include: { resultado: true },
            }),
        );
        const committedResult = committedAttempt?.resultado;
        const receiptConfirmedAbsent =
          committedAttempt?.tipo === TipoIntentoFacturaElectronica.ENVIO &&
          input.receiptConfirmedAbsent;
        if (
          committedResult?.estado ===
            EstadoResultadoIntentoFacturaElectronica.ERROR_TECNICO &&
          committedResult.codigoError === normalizeErrorCode(input.code) &&
          committedResult.receiptConfirmedAbsent === receiptConfirmedAbsent
        ) {
          return committedResult;
        }
        if (committedResult) {
          throw new ConflictException(
            'El intento ya tiene un resultado distinto.',
          );
        }
      }
      throw error;
    }
  }

  private async deleteUnreferencedEvidence(
    attemptId: string,
    evidenceKey: string,
  ) {
    const isReferenced = await this.tenantPrisma
      .execute(async (prisma, { tenantId }) => {
        const result =
          await prisma.resultadoIntentoFacturaElectronica.findFirst({
            where: {
              tenantId,
              intentoId: attemptId,
              storageKeyEvidencia: evidenceKey,
            },
            select: { id: true },
          });
        return Boolean(result);
      })
      .catch(() => true);
    if (!isReferenced)
      await this.storage.deleteObject(evidenceKey).catch(() => undefined);
  }

  private async changeInvoiceStatus(
    prisma: Prisma.TransactionClient,
    input: {
      tenantId: string;
      invoiceId: string;
      transmissionId: string;
      attemptId: string;
      from: EstadoFacturaElectronica;
      to: EstadoFacturaElectronica;
      event: string;
      actorUserId: string;
    },
  ) {
    if (input.from !== input.to) {
      const updated = await prisma.facturaElectronica.updateMany({
        where: {
          id: input.invoiceId,
          tenantId: input.tenantId,
          estado: input.from,
        },
        data: { estado: input.to },
      });
      if (updated.count !== 1) {
        throw new ConflictException(
          'La factura cambió mientras se registraba la transmisión.',
        );
      }
    }
    await prisma.transicionFacturaElectronica.create({
      data: {
        id: randomUUID(),
        tenantId: input.tenantId,
        facturaElectronicaId: input.invoiceId,
        transmisionId: input.transmissionId,
        intentoId: input.attemptId,
        desde: input.from,
        hasta: input.to,
        evento: input.event,
        actorUserId: input.actorUserId,
      },
    });
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function assertSameTransmission(
  existing: {
    claveIdempotencia: string;
    hashPayload: string;
    versionPayload: string;
    payloadCanonico: string;
    providerId: string;
    contractVersion: string;
  },
  expected: {
    idempotencyKey: string;
    payloadHash: string;
    payloadVersion: string;
    canonicalPayload: string;
    providerId: string;
    contractVersion: string;
  },
) {
  if (
    existing.claveIdempotencia !== expected.idempotencyKey ||
    existing.hashPayload !== expected.payloadHash ||
    existing.versionPayload !== expected.payloadVersion ||
    existing.payloadCanonico !== expected.canonicalPayload ||
    existing.providerId !== expected.providerId ||
    existing.contractVersion !== expected.contractVersion
  ) {
    throw new ConflictException(
      'El evento fiscal ya existe con otro contenido, proveedor o versión.',
    );
  }
}

function inspectEvidence(evidence: { contentType: string; bytes: Buffer }) {
  const contentType = evidence.contentType
    .split(';', 1)[0]
    .trim()
    .toLowerCase();
  if (!ALLOWED_EVIDENCE_TYPES.has(contentType)) {
    throw new ConflictException(
      'El tipo de evidencia del proveedor no está permitido.',
    );
  }
  if (
    evidence.bytes.length === 0 ||
    evidence.bytes.length > MAX_EVIDENCE_BYTES
  ) {
    throw new ConflictException(
      'El tamaño de evidencia del proveedor no está permitido.',
    );
  }
  return {
    contentType,
    sha256: createHash('sha256').update(evidence.bytes).digest('hex'),
  };
}

function resultStatus(status: ElectronicInvoiceProviderOutcome['status']) {
  switch (status) {
    case 'ACCEPTED':
      return EstadoResultadoIntentoFacturaElectronica.ACEPTADO;
    case 'REJECTED':
      return EstadoResultadoIntentoFacturaElectronica.RECHAZADO;
    case 'PENDING':
      return EstadoResultadoIntentoFacturaElectronica.PENDIENTE;
    case 'UNKNOWN':
      return EstadoResultadoIntentoFacturaElectronica.DESCONOCIDO;
  }
}

function nextStatusFromOutcome(
  currentStatus: EstadoFacturaElectronica,
  type: TipoIntentoFacturaElectronica,
  outcome: ElectronicInvoiceProviderOutcome['status'],
  evidencePersisted: boolean,
): EstadoFacturaElectronica {
  if (type === TipoIntentoFacturaElectronica.ENVIO) {
    if (outcome === 'ACCEPTED' && evidencePersisted) {
      return transitionElectronicInvoice(currentStatus, {
        type: 'ACCEPT',
        evidencePersisted: true,
      });
    }
    if (outcome === 'REJECTED' && evidencePersisted) {
      return transitionElectronicInvoice(currentStatus, {
        type: 'REJECT',
        evidencePersisted: true,
      });
    }
    return transitionElectronicInvoice(currentStatus, {
      type: 'AMBIGUOUS_OUTCOME',
    });
  }

  if (outcome === 'ACCEPTED') {
    return transitionElectronicInvoice(currentStatus, {
      type: 'RECONCILE',
      outcome: 'ACCEPTED',
      evidencePersisted,
    });
  }
  if (outcome === 'REJECTED') {
    return transitionElectronicInvoice(currentStatus, {
      type: 'RECONCILE',
      outcome: 'REJECTED',
      evidencePersisted,
    });
  }
  return transitionElectronicInvoice(currentStatus, {
    type: 'RECONCILE',
    outcome: 'UNKNOWN',
  });
}

function parseProviderDate(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeErrorCode(value: string): string {
  const normalized = value
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '_')
    .slice(0, 100);
  return normalized || 'PROVIDER_ERROR';
}

function normalizeProviderReference(value?: string): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim();
  if (
    !normalized ||
    normalized.length > 200 ||
    [...normalized].some((character) => {
      const code = character.charCodeAt(0);
      return code <= 0x1f || code === 0x7f;
    })
  ) {
    return undefined;
  }
  return normalized;
}

function sanitizeIssues(issues: readonly { code: string; field?: string }[]) {
  return issues.slice(0, 100).map(({ code, field }) => ({
    code:
      code
        .toUpperCase()
        .replace(/[^A-Z0-9_]/g, '_')
        .slice(0, 100) || 'PROVIDER_REJECTION',
    ...(field && /^[A-Za-z0-9_.-]{1,120}$/.test(field) ? { field } : {}),
  }));
}

function assertSameOutcome(
  existing: {
    estado: EstadoResultadoIntentoFacturaElectronica;
    providerReference: string | null;
    providerAcceptedAt: Date | null;
    sha256Evidencia: string | null;
    issues: Prisma.JsonValue | null;
  },
  outcome: ElectronicInvoiceProviderOutcome,
  evidenceHash?: string,
) {
  const providerReference =
    'providerReference' in outcome ? (outcome.providerReference ?? null) : null;
  const acceptedAt =
    outcome.status === 'ACCEPTED'
      ? parseProviderDate(outcome.acceptedAt)
      : null;
  const issues =
    outcome.status === 'REJECTED' ? sanitizeIssues(outcome.issues) : null;
  if (
    existing.estado !== resultStatus(outcome.status) ||
    existing.providerReference !==
      normalizeProviderReference(providerReference ?? undefined) ||
    existing.providerAcceptedAt?.getTime() !== acceptedAt?.getTime() ||
    existing.sha256Evidencia !== (evidenceHash ?? null) ||
    JSON.stringify(existing.issues ?? null) !== JSON.stringify(issues)
  ) {
    throw new ConflictException('El intento ya tiene un resultado distinto.');
  }
}
