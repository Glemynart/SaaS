import { createHash } from 'node:crypto';
import {
  EstadoFacturaElectronica,
  EstadoResultadoIntentoFacturaElectronica,
  Prisma,
  TipoIntentoFacturaElectronica,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { StorageService } from '../storage/storage.service';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import { ElectronicInvoiceTransmissionService } from './electronic-invoice-transmission.service';

const canonicalPayload = '{"version":1,"total":"119.00"}';

describe('ElectronicInvoiceTransmissionService', () => {
  const context = {
    tenantId: 'tenant-a',
    userId: 'user-a',
    rol: 'ADMIN',
    email: 'admin@example.test',
  };
  let prisma: ReturnType<typeof createPrismaMock>;
  let audit: { log: jest.Mock };
  let storage: {
    objectExists: jest.Mock;
    putObject: jest.Mock;
    deleteObject: jest.Mock;
  };
  let service: ElectronicInvoiceTransmissionService;

  beforeEach(() => {
    prisma = createPrismaMock();
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    storage = {
      objectExists: jest.fn().mockResolvedValue(false),
      putObject: jest
        .fn()
        .mockImplementation(({ key, body }: { key: string; body: Buffer }) =>
          Promise.resolve({ key, size: body.length }),
        ),
      deleteObject: jest.fn().mockResolvedValue(undefined),
    };
    const tenantPrisma = {
      execute: jest.fn(
        async (
          work: (client: unknown, tenantContext: typeof context) => unknown,
        ) => Promise.resolve(work(prisma, context)),
      ),
    } as unknown as TenantPrismaService;
    service = new ElectronicInvoiceTransmissionService(
      tenantPrisma,
      audit as unknown as AuditService,
      storage as unknown as StorageService,
    );
  });

  it('registers one immutable event and returns an identical retry idempotently', async () => {
    const transmission = makeTransmission();
    prisma.facturaElectronicaTransmision.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(transmission);
    prisma.facturaElectronicaTransmision.create.mockResolvedValue(transmission);

    const first = await service.registerTransmission(registerInput());
    const retry = await service.registerTransmission(registerInput());

    expect(first).toBe(transmission);
    expect(retry).toBe(transmission);
    expect(prisma.facturaElectronicaTransmision.create).toHaveBeenCalledTimes(
      1,
    );
    expect(prisma.facturaElectronicaTransmision.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: objectContaining({
          eventoId: 'issue-event-1',
          versionPayload: '1',
          hashPayload: createHash('sha256')
            .update(canonicalPayload)
            .digest('hex'),
          payloadCanonico: canonicalPayload,
        }),
      }),
    );
    expect(prisma.transicionFacturaElectronica.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: objectContaining({
          desde: null,
          hasta: EstadoFacturaElectronica.EN_COLA,
          evento: 'TRANSMISSION_REGISTERED',
        }),
      }),
    );
    expect(audit.log).toHaveBeenCalledTimes(1);
  });

  it('rejects reuse of an event identity with a different canonical payload', async () => {
    prisma.facturaElectronicaTransmision.findFirst.mockResolvedValue(
      makeTransmission({ payloadCanonico: '{"version":1,"total":"120.00"}' }),
    );

    await expect(service.registerTransmission(registerInput())).rejects.toThrow(
      'El evento fiscal ya existe con otro contenido',
    );
    expect(prisma.facturaElectronicaTransmision.create).not.toHaveBeenCalled();
  });

  it('starts one durable send from the stored payload and blocks unresolved attempts', async () => {
    prisma.facturaElectronicaTransmision.findFirst
      .mockResolvedValueOnce(
        makeTransmission({
          facturaElectronica: {
            id: 'invoice-a',
            estado: EstadoFacturaElectronica.EN_COLA,
          },
          intentos: [],
        }),
      )
      .mockResolvedValueOnce(
        makeTransmission({
          facturaElectronica: {
            id: 'invoice-a',
            estado: EstadoFacturaElectronica.EN_TRANSMISION,
          },
          ultimoIntento: 1,
          intentos: [{ id: 'attempt-1', resultado: null }],
        }),
      );
    prisma.intentoFacturaElectronica.create.mockResolvedValue({
      id: 'attempt-1',
    });

    const started = await service.startAttempt({
      transmissionId: 'transmission-a',
      type: TipoIntentoFacturaElectronica.ENVIO,
    });

    expect(started).toMatchObject({
      attemptId: 'attempt-1',
      attemptNumber: 1,
      submission: {
        tenantId: 'tenant-a',
        invoiceId: 'invoice-a',
        eventId: 'issue-event-1',
        canonicalPayload,
      },
    });
    await expect(
      service.startAttempt({
        transmissionId: 'transmission-a',
        type: TipoIntentoFacturaElectronica.ENVIO,
      }),
    ).rejects.toThrow('El intento anterior no tiene resultado');
    expect(prisma.intentoFacturaElectronica.create).toHaveBeenCalledTimes(1);
  });

  it('recovers a crashed send by starting reconciliation before any retry', async () => {
    prisma.facturaElectronicaTransmision.findFirst.mockResolvedValue(
      makeTransmission({
        ultimoIntento: 1,
        facturaElectronica: {
          id: 'invoice-a',
          estado: EstadoFacturaElectronica.EN_TRANSMISION,
        },
        intentos: [
          {
            id: 'attempt-1',
            tipo: TipoIntentoFacturaElectronica.ENVIO,
            resultado: null,
          },
        ],
      }),
    );
    prisma.intentoFacturaElectronica.create.mockResolvedValue({
      id: 'attempt-2',
    });

    const started = await service.startAttempt({
      transmissionId: 'transmission-a',
      type: TipoIntentoFacturaElectronica.CONCILIACION,
    });

    expect(started).toMatchObject({
      attemptId: 'attempt-2',
      type: TipoIntentoFacturaElectronica.CONCILIACION,
      reconciliation: {
        tenantId: 'tenant-a',
        invoiceId: 'invoice-a',
        eventId: 'issue-event-1',
      },
    });
    expect(prisma.facturaElectronica.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: objectContaining({
          estado: EstadoFacturaElectronica.EN_TRANSMISION,
        }),
        data: { estado: EstadoFacturaElectronica.PENDIENTE_CONCILIACION },
      }),
    );
    expect(prisma.transicionFacturaElectronica.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: objectContaining({
          evento: 'RECOVER_UNCONFIRMED_ATTEMPT',
        }),
      }),
    );
  });

  it('only retries a technical send after the provider confirms it was not received', async () => {
    prisma.facturaElectronicaTransmision.findFirst.mockResolvedValue(
      makeTransmission({
        ultimoIntento: 1,
        facturaElectronica: {
          id: 'invoice-a',
          estado: EstadoFacturaElectronica.ERROR_TECNICO,
        },
        intentos: [
          {
            id: 'attempt-1',
            tipo: TipoIntentoFacturaElectronica.ENVIO,
            resultado: {
              estado: EstadoResultadoIntentoFacturaElectronica.ERROR_TECNICO,
              receiptConfirmedAbsent: true,
              providerReference: null,
            },
          },
        ],
      }),
    );
    prisma.intentoFacturaElectronica.create.mockResolvedValue({
      id: 'attempt-2',
    });

    const started = await service.startAttempt({
      transmissionId: 'transmission-a',
      type: TipoIntentoFacturaElectronica.ENVIO,
    });

    expect(started).toMatchObject({
      attemptId: 'attempt-2',
      attemptNumber: 2,
      submission: { canonicalPayload },
    });
    expect(prisma.facturaElectronica.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: objectContaining({
          estado: EstadoFacturaElectronica.ERROR_TECNICO,
        }),
        data: { estado: EstadoFacturaElectronica.EN_COLA },
      }),
    );
    expect(prisma.facturaElectronica.updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: objectContaining({ estado: EstadoFacturaElectronica.EN_COLA }),
        data: { estado: EstadoFacturaElectronica.EN_TRANSMISION },
      }),
    );
  });

  it('returns the committed outcome when concurrent outcome writes race', async () => {
    const evidence = Buffer.from('{"accepted":true}');
    const evidenceHash = createHash('sha256').update(evidence).digest('hex');
    const acceptedAt = new Date('2026-11-05T12:00:00.000Z');
    const committedResult = {
      id: 'result-3',
      estado: EstadoResultadoIntentoFacturaElectronica.ACEPTADO,
      providerReference: 'provider-ref-race',
      providerAcceptedAt: acceptedAt,
      sha256Evidencia: evidenceHash,
      issues: null,
    };
    const attempt = makeAttempt({
      transmision: {
        id: 'transmission-a',
        facturaElectronicaId: 'invoice-a',
        facturaElectronica: {
          id: 'invoice-a',
          estado: EstadoFacturaElectronica.EN_TRANSMISION,
        },
      },
    });
    prisma.intentoFacturaElectronica.findFirst
      .mockResolvedValueOnce({ ...attempt, resultado: null })
      .mockResolvedValueOnce({ id: attempt.id })
      .mockResolvedValueOnce({ ...attempt, resultado: null });
    prisma.resultadoIntentoFacturaElectronica.findFirst.mockResolvedValue(
      committedResult,
    );
    prisma.resultadoIntentoFacturaElectronica.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique conflict', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    const result = await service.recordOutcome('transmission-a', 'attempt-1', {
      status: 'ACCEPTED',
      providerReference: 'provider-ref-race',
      acceptedAt: acceptedAt.toISOString(),
      evidence: { contentType: 'application/json', bytes: evidence },
    });

    expect(result).toBe(committedResult);
    expect(storage.deleteObject).not.toHaveBeenCalled();
  });

  it('returns the committed technical failure when concurrent failure writes race', async () => {
    const attempt = makeAttempt();
    const committedResult = {
      id: 'failure-result-1',
      estado: EstadoResultadoIntentoFacturaElectronica.ERROR_TECNICO,
      codigoError: 'SOCKET_TIMEOUT',
      receiptConfirmedAbsent: true,
    };
    prisma.intentoFacturaElectronica.findFirst
      .mockResolvedValueOnce({ ...attempt, resultado: null })
      .mockResolvedValueOnce({ ...attempt, resultado: committedResult });
    prisma.resultadoIntentoFacturaElectronica.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique conflict', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    const result = await service.recordFailure('transmission-a', 'attempt-1', {
      code: 'socket-timeout',
      receiptConfirmedAbsent: true,
    });

    expect(result).toBe(committedResult);
  });

  it('keeps an accepted provider response in reconciliation until evidence is stored', async () => {
    const attempt = makeAttempt({
      tipo: TipoIntentoFacturaElectronica.ENVIO,
      transmision: {
        id: 'transmission-a',
        facturaElectronicaId: 'invoice-a',
        facturaElectronica: {
          id: 'invoice-a',
          estado: EstadoFacturaElectronica.EN_TRANSMISION,
        },
      },
    });
    prisma.intentoFacturaElectronica.findFirst
      .mockResolvedValueOnce({ ...attempt, resultado: null })
      .mockResolvedValueOnce({ ...attempt, resultado: null })
      .mockResolvedValueOnce({ ...attempt, resultado: null });
    prisma.resultadoIntentoFacturaElectronica.create.mockResolvedValue({
      id: 'result-1',
      estado: EstadoResultadoIntentoFacturaElectronica.ACEPTADO,
      providerReference: 'matias-ref-1',
      providerAcceptedAt: new Date('2026-11-05T12:00:00.000Z'),
      sha256Evidencia: null,
      issues: null,
    });

    const result = await service.recordOutcome('transmission-a', 'attempt-1', {
      status: 'ACCEPTED',
      providerReference: 'matias-ref-1',
      acceptedAt: '2026-11-05T12:00:00.000Z',
    });

    expect(result.estado).toBe(
      EstadoResultadoIntentoFacturaElectronica.ACEPTADO,
    );
    expect(prisma.facturaElectronica.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { estado: EstadoFacturaElectronica.PENDIENTE_CONCILIACION },
      }),
    );
    expect(prisma.transicionFacturaElectronica.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: objectContaining({
          hasta: EstadoFacturaElectronica.PENDIENTE_CONCILIACION,
        }),
      }),
    );
  });

  it('stores provider evidence privately before accepting and retains only a digest in history', async () => {
    const evidence = Buffer.from('%PDF-1.7 fake evidence');
    const evidenceHash = createHash('sha256').update(evidence).digest('hex');
    const attempt = makeAttempt({
      tipo: TipoIntentoFacturaElectronica.ENVIO,
      transmision: {
        id: 'transmission-a',
        facturaElectronicaId: 'invoice-a',
        facturaElectronica: {
          id: 'invoice-a',
          estado: EstadoFacturaElectronica.EN_TRANSMISION,
        },
      },
    });
    prisma.intentoFacturaElectronica.findFirst
      .mockResolvedValueOnce({ ...attempt, resultado: null })
      .mockResolvedValueOnce({ ...attempt, resultado: null })
      .mockResolvedValueOnce({ ...attempt, resultado: null });
    prisma.resultadoIntentoFacturaElectronica.create.mockResolvedValue({
      id: 'result-2',
      estado: EstadoResultadoIntentoFacturaElectronica.ACEPTADO,
      providerReference: 'matias-ref-2',
      providerAcceptedAt: new Date('2026-11-05T12:00:00.000Z'),
      sha256Evidencia: evidenceHash,
      issues: null,
    });

    await service.recordOutcome('transmission-a', 'attempt-1', {
      status: 'ACCEPTED',
      providerReference: 'matias-ref-2',
      acceptedAt: '2026-11-05T12:00:00.000Z',
      evidence: { contentType: 'application/pdf', bytes: evidence },
    });

    expect(storage.putObject).toHaveBeenCalledWith(
      expect.objectContaining({
        key: `tenant-a/facturacion-electronica/transmission-a/attempt-1/${evidenceHash}`,
        contentType: 'application/pdf',
        body: evidence,
      }),
    );
    expect(
      prisma.resultadoIntentoFacturaElectronica.create,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: objectContaining({
          storageKeyEvidencia: safeMatcher(
            expect.stringContaining(evidenceHash),
          ),
          sha256Evidencia: evidenceHash,
        }),
      }),
    );
    expect(prisma.facturaElectronica.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { estado: EstadoFacturaElectronica.ACEPTADA },
      }),
    );
  });
});

function registerInput() {
  return {
    invoiceId: 'invoice-a',
    eventId: 'issue-event-1',
    payloadVersion: '1',
    canonicalPayload,
    providerId: 'matias',
    contractVersion: '1',
  };
}

function makeTransmission(overrides: Record<string, unknown> = {}) {
  return {
    id: 'transmission-a',
    tenantId: 'tenant-a',
    facturaElectronicaId: 'invoice-a',
    eventoId: 'issue-event-1',
    claveIdempotencia: createHash('sha256')
      .update(
        `tenant-a\u0000invoice-a\u0000issue-event-1\u0000${createHash('sha256').update(canonicalPayload).digest('hex')}`,
      )
      .digest('hex'),
    versionPayload: '1',
    hashPayload: createHash('sha256').update(canonicalPayload).digest('hex'),
    payloadCanonico: canonicalPayload,
    providerId: 'matias',
    contractVersion: '1',
    ultimoIntento: 0,
    facturaElectronica: {
      id: 'invoice-a',
      estado: EstadoFacturaElectronica.EN_COLA,
    },
    intentos: [],
    ...overrides,
  };
}

function makeAttempt(overrides: Record<string, unknown> = {}) {
  return {
    id: 'attempt-1',
    tenantId: 'tenant-a',
    transmisionId: 'transmission-a',
    tipo: TipoIntentoFacturaElectronica.ENVIO,
    resultado: null,
    transmision: {
      id: 'transmission-a',
      facturaElectronicaId: 'invoice-a',
      facturaElectronica: {
        id: 'invoice-a',
        estado: EstadoFacturaElectronica.EN_TRANSMISION,
      },
    },
    ...overrides,
  };
}

function createPrismaMock() {
  return {
    facturaElectronica: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'invoice-a',
        estado: EstadoFacturaElectronica.EN_COLA,
        numero: 1,
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    facturaElectronicaTransmision: {
      findFirst: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    intentoFacturaElectronica: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    resultadoIntentoFacturaElectronica: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
    },
    transicionFacturaElectronica: { create: jest.fn() },
  };
}

function objectContaining(value: Record<string, unknown>): unknown {
  return expect.objectContaining(value) as unknown;
}

function safeMatcher<T>(value: T): unknown {
  return value;
}
