import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createTransport } from 'nodemailer';

export type R2PreflightCommand =
  | PutObjectCommand
  | GetObjectCommand
  | HeadObjectCommand
  | DeleteObjectCommand;

export type R2CommandSender = (command: R2PreflightCommand) => Promise<unknown>;

export interface SmtpPreflightTransportOptions {
  host: string;
  port: number;
  secure: boolean;
  requireTLS: boolean;
  auth: { user: string; pass: string };
  tls: { minVersion: 'TLSv1.2' };
  connectionTimeout: number;
  greetingTimeout: number;
  socketTimeout: number;
}

export interface SmtpPreflightTransport {
  verify(): Promise<boolean>;
  close(): void;
}

export type SmtpPreflightTransportFactory = (
  options: SmtpPreflightTransportOptions,
) => SmtpPreflightTransport;

export type PreflightFailureCode =
  | 'R2_CONFIGURATION_INVALID'
  | 'R2_ACCESS_DENIED'
  | 'R2_CONNECTION_FAILED'
  | 'R2_WRITE_FAILED'
  | 'R2_READ_FAILED'
  | 'R2_HASH_MISMATCH'
  | 'R2_CLEANUP_FAILED'
  | 'SMTP_CONFIGURATION_INVALID'
  | 'SMTP_AUTH_REJECTED'
  | 'SMTP_TLS_OR_CONNECTION_FAILED'
  | 'SMTP_VERIFY_FAILED';

export class DeliveryPreflightError extends Error {
  constructor(
    readonly code: PreflightFailureCode,
    readonly cleanupKey?: string,
  ) {
    super(code);
    this.name = 'DeliveryPreflightError';
  }
}

const R2_ENVIRONMENT_VARIABLES = [
  'R2_ENDPOINT',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
] as const;

/**
 * Executes one synthetic R2 round-trip and deletes its object before returning.
 * The exact bucket name must be confirmed separately from the environment.
 */
export async function verifyR2WriteAccess(
  environment: NodeJS.ProcessEnv,
  confirmedBucket: string | undefined,
  send: R2CommandSender,
): Promise<{ key: string; sha256: string }> {
  const missing = R2_ENVIRONMENT_VARIABLES.filter(
    (name) => !environment[name]?.trim(),
  );
  if (missing.length > 0) {
    throw new DeliveryPreflightError('R2_CONFIGURATION_INVALID');
  }

  const bucket = environment.R2_BUCKET!.trim();
  if (!confirmedBucket || confirmedBucket !== bucket) {
    throw new DeliveryPreflightError('R2_CONFIGURATION_INVALID');
  }

  let endpoint: URL;
  try {
    endpoint = new URL(environment.R2_ENDPOINT!);
  } catch {
    throw new DeliveryPreflightError('R2_CONFIGURATION_INVALID');
  }
  if (
    endpoint.protocol !== 'https:' ||
    !endpoint.hostname.endsWith('.r2.cloudflarestorage.com') ||
    endpoint.pathname !== '/' ||
    endpoint.username !== '' ||
    endpoint.password !== ''
  ) {
    throw new DeliveryPreflightError('R2_CONFIGURATION_INVALID');
  }

  const key = `__health__/preflight/${randomUUID()}.bin`;
  const payload = randomBytes(32);
  const expectedHash = sha256(payload);
  let putAttempted = false;
  let operationFailure: DeliveryPreflightError | undefined;
  let cleanupFailure = false;

  try {
    putAttempted = true;
    await send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: payload,
        ContentType: 'application/octet-stream',
      }),
    );

    const getResponse = (await send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    )) as { Body?: { transformToByteArray?: () => Promise<Uint8Array> } };
    if (!getResponse.Body?.transformToByteArray) {
      throw new DeliveryPreflightError('R2_READ_FAILED');
    }
    const downloaded = Buffer.from(
      await getResponse.Body.transformToByteArray(),
    );
    const downloadedHash = sha256(downloaded);
    if (downloadedHash !== expectedHash) {
      throw new DeliveryPreflightError('R2_HASH_MISMATCH');
    }

    const headResponse = (await send(
      new HeadObjectCommand({ Bucket: bucket, Key: key }),
    )) as { ContentLength?: number };
    if (headResponse.ContentLength !== payload.length) {
      throw new DeliveryPreflightError('R2_READ_FAILED');
    }
  } catch (error) {
    operationFailure =
      error instanceof DeliveryPreflightError
        ? error
        : toR2OperationFailure(error);
  }

  if (putAttempted) {
    try {
      await send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      try {
        await send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        cleanupFailure = true;
      } catch (error) {
        if (!isMissingObject(error)) cleanupFailure = true;
      }
    } catch {
      cleanupFailure = true;
    }
  }

  if (cleanupFailure) {
    throw new DeliveryPreflightError('R2_CLEANUP_FAILED', key);
  }
  if (operationFailure) throw operationFailure;

  return { key, sha256: expectedHash };
}

/**
 * Verifies one SMTP connection/authentication without sending a message.
 * TLS must be enabled either implicitly (SMTPS) or with mandatory STARTTLS.
 */
export async function verifySmtpAccess(
  environment: NodeJS.ProcessEnv,
  transportFactory: SmtpPreflightTransportFactory = createTransport,
): Promise<void> {
  const host = environment.EMAIL_SMTP_HOST?.trim();
  const user = environment.EMAIL_SMTP_USER?.trim();
  const password = environment.EMAIL_SMTP_PASSWORD;
  const from = environment.EMAIL_FROM?.trim();
  const port = Number(environment.EMAIL_SMTP_PORT);
  const secure = environment.EMAIL_SMTP_SECURE;
  const requireTls = environment.EMAIL_SMTP_REQUIRE_TLS;

  if (
    !host ||
    !/^smtp\.email\.[a-z0-9-]+\.oci\.oraclecloud\.com$/i.test(host) ||
    !user ||
    !password ||
    !from ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    (secure !== 'true' && secure !== 'false') ||
    (requireTls !== 'true' && requireTls !== 'false') ||
    (secure !== 'true' && requireTls !== 'true')
  ) {
    throw new DeliveryPreflightError('SMTP_CONFIGURATION_INVALID');
  }

  const transporter = transportFactory({
    host,
    port,
    secure: secure === 'true',
    requireTLS: requireTls === 'true',
    auth: { user, pass: password },
    tls: { minVersion: 'TLSv1.2' },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });

  try {
    await transporter.verify();
  } catch (error) {
    throw new DeliveryPreflightError(toSmtpFailure(error));
  } finally {
    transporter.close();
  }
}

export function createR2PreflightSender(): {
  send: R2CommandSender;
  close: () => void;
} {
  const client = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
    },
  });
  return {
    send: (command) => client.send(command),
    close: () => client.destroy(),
  };
}

function sha256(value: Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function toR2OperationFailure(error: unknown): DeliveryPreflightError {
  const name = getErrorProperty(error, 'name');
  const code = getErrorProperty(error, 'code');
  const status = getStatusCode(error);
  if (status === 401 || status === 403 || name === 'AccessDenied') {
    return new DeliveryPreflightError('R2_ACCESS_DENIED');
  }
  if (
    code === 'TimeoutError' ||
    code === 'NetworkingError' ||
    code === 'ECONNRESET' ||
    code === 'ENOTFOUND' ||
    code === 'ECONNREFUSED' ||
    status === 408 ||
    status === 429 ||
    (status !== undefined && status >= 500)
  ) {
    return new DeliveryPreflightError('R2_CONNECTION_FAILED');
  }
  return new DeliveryPreflightError('R2_WRITE_FAILED');
}

function toSmtpFailure(error: unknown): PreflightFailureCode {
  const code = getErrorProperty(error, 'code');
  const responseCode = getErrorProperty(error, 'responseCode');
  if (code === 'EAUTH' || responseCode === '535') {
    return 'SMTP_AUTH_REJECTED';
  }
  if (
    code === 'ETLS' ||
    code === 'ESOCKET' ||
    code === 'ECONNECTION' ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND'
  ) {
    return 'SMTP_TLS_OR_CONNECTION_FAILED';
  }
  return 'SMTP_VERIFY_FAILED';
}

function getErrorProperty(
  error: unknown,
  property: string,
): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const value = (error as Record<string, unknown>)[property];
  return typeof value === 'string' ? value : undefined;
}

function getStatusCode(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const metadata = (error as Record<string, unknown>)['$metadata'];
  if (!metadata || typeof metadata !== 'object') return undefined;
  const status = (metadata as Record<string, unknown>).httpStatusCode;
  return typeof status === 'number' ? status : undefined;
}

function isMissingObject(error: unknown): boolean {
  return (
    getErrorProperty(error, 'name') === 'NotFound' ||
    getErrorProperty(error, 'name') === 'NoSuchKey' ||
    getStatusCode(error) === 404
  );
}
