import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  ListObjectsV2CommandOutput,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import {
  CloudflareR2StorageConfigurationError,
  CloudflareR2StorageUnavailableError,
  InvalidStorageKeyError,
  PutObjectInput,
  StorageObjectMetadata,
  StorageObjectNotFoundError,
  StorageProvider,
} from './storage.types';
import { createR2TenantPrefixCredentials } from './r2-tenant-prefix-credentials';

const R2_REQUIRED_ENVIRONMENT_VARIABLES = [
  'R2_ENDPOINT',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
] as const;

/** Adaptador S3 oficial para Cloudflare R2. */
@Injectable()
export class CloudflareR2StorageProvider implements StorageProvider {
  private readonly client: S3Client;

  constructor() {
    this.client = new S3Client({
      region: 'auto',
      endpoint: process.env.R2_ENDPOINT?.trim(),
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
      },
    });
  }

  validateConfiguration(): void {
    const missing = R2_REQUIRED_ENVIRONMENT_VARIABLES.filter(
      (name) => !process.env[name]?.trim(),
    );
    if (missing.length > 0) {
      throw new CloudflareR2StorageConfigurationError(
        `faltan variables de configuración: ${missing.join(', ')}`,
      );
    }

    let endpoint: URL;
    try {
      endpoint = new URL(process.env.R2_ENDPOINT!.trim());
    } catch {
      throw new CloudflareR2StorageConfigurationError(
        'R2_ENDPOINT debe ser una URL válida',
      );
    }

    if (
      endpoint.protocol !== 'https:' ||
      !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/i.test(endpoint.hostname) ||
      endpoint.port !== '' ||
      endpoint.pathname !== '/' ||
      endpoint.username !== '' ||
      endpoint.password !== '' ||
      endpoint.search !== '' ||
      endpoint.hash !== ''
    ) {
      throw new CloudflareR2StorageConfigurationError(
        'R2_ENDPOINT debe usar HTTPS y un host oficial de Cloudflare R2',
      );
    }
  }

  async put(input: PutObjectInput): Promise<StorageObjectMetadata> {
    this.validateConfiguration();
    this.validateKey(input.key);

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: process.env.R2_BUCKET,
          Key: input.key,
          Body: input.body,
          ContentType: input.contentType,
        }),
      );
    } catch (error) {
      throw this.translateError(error, input.key);
    }

    return {
      key: input.key,
      size: input.body.length,
      contentType: input.contentType,
    };
  }

  /**
   * Operación exclusiva del migrador: crea el objeto sólo si sigue ausente en
   * R2. `null` indica que un escritor concurrente ya ocupó la key.
   */
  async putIfAbsent(
    input: PutObjectInput,
  ): Promise<StorageObjectMetadata | null> {
    this.validateConfiguration();
    this.validateKey(input.key);

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: process.env.R2_BUCKET,
          Key: input.key,
          Body: input.body,
          ContentType: input.contentType,
          IfNoneMatch: '*',
        }),
      );
    } catch (error) {
      if (this.isPreconditionFailed(error)) return null;
      throw this.translateError(error, input.key);
    }

    return {
      key: input.key,
      size: input.body.length,
      contentType: input.contentType,
    };
  }

  async get(key: string): Promise<Buffer> {
    this.validateConfiguration();
    this.validateKey(key);

    try {
      const response = await this.client.send(
        new GetObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }),
      );
      if (!response.Body) {
        throw new CloudflareR2StorageUnavailableError(
          'R2 devolvió una respuesta sin cuerpo',
        );
      }
      return Buffer.from(await response.Body.transformToByteArray());
    } catch (error) {
      if (error instanceof CloudflareR2StorageUnavailableError) throw error;
      throw this.translateError(error, key);
    }
  }

  async delete(key: string): Promise<void> {
    this.validateConfiguration();
    this.validateKey(key);

    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }),
      );
    } catch (error) {
      if (this.isMissingObject(error)) return;
      throw this.translateError(error, key);
    }
  }

  async exists(key: string): Promise<boolean> {
    this.validateConfiguration();
    this.validateKey(key);

    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }),
      );
      return true;
    } catch (error) {
      if (this.isMissingObject(error)) return false;
      throw this.translateError(error, key);
    }
  }

  async list(prefix: string): Promise<StorageObjectMetadata[]> {
    this.validateConfiguration();
    this.validateKey(prefix);

    const credentials = createR2TenantPrefixCredentials({
      endpoint: process.env.R2_ENDPOINT!.trim(),
      bucket: process.env.R2_BUCKET!,
      parentAccessKeyId: process.env.R2_ACCESS_KEY_ID!,
      parentSecretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      prefix,
    });
    const scopedClient = new S3Client({
      region: 'auto',
      endpoint: process.env.R2_ENDPOINT!.trim(),
      forcePathStyle: true,
      credentials,
    });

    const results: StorageObjectMetadata[] = [];
    let continuationToken: string | undefined;
    const seenContinuationTokens = new Set<string>();
    try {
      for (;;) {
        let page: ListObjectsV2CommandOutput;
        try {
          page = await scopedClient.send(
            new ListObjectsV2Command({
              Bucket: process.env.R2_BUCKET,
              Prefix: prefix,
              MaxKeys: 1000,
              ContinuationToken: continuationToken,
            }),
          );
        } catch (error) {
          throw this.translateError(error, prefix);
        }
        for (const object of page.Contents ?? []) {
          if (!object.Key?.startsWith(prefix)) continue;
          results.push({ key: object.Key, size: object.Size ?? 0 });
        }
        if (!page.IsTruncated) break;

        const nextToken = page.NextContinuationToken;
        if (
          !nextToken ||
          nextToken === continuationToken ||
          seenContinuationTokens.has(nextToken)
        ) {
          throw new CloudflareR2StorageUnavailableError(
            'R2 devolvió una paginación incompleta o repetida',
          );
        }
        seenContinuationTokens.add(nextToken);
        continuationToken = nextToken;
      }
    } finally {
      scopedClient.destroy();
    }

    return results.sort((left, right) => left.key.localeCompare(right.key));
  }

  async checkReadiness(): Promise<void> {
    await this.exists('__health__/storage-probe');
  }

  private validateKey(key: string): void {
    if (!key || key.trim() === '') {
      throw new InvalidStorageKeyError(key, 'la key está vacía');
    }

    const cleaned = key.replace(/\\/g, '/').replace(/^\/+/, '');
    const segments = cleaned.split('/').filter((segment) => segment.length > 0);
    if (segments.length === 0 || segments.some((segment) => segment === '..')) {
      throw new InvalidStorageKeyError(
        key,
        'no resuelve a una key lógica válida',
      );
    }
  }

  private translateError(error: unknown, key: string): Error {
    if (this.isNoSuchKey(error)) return new StorageObjectNotFoundError(key);
    if (this.isTemporary(error)) {
      return new CloudflareR2StorageUnavailableError(
        `fallo transitorio al acceder a "${key}"`,
      );
    }
    return error instanceof Error
      ? error
      : new Error('Error desconocido de R2');
  }

  private isNoSuchKey(error: unknown): boolean {
    return this.getErrorName(error) === 'NoSuchKey';
  }

  private isMissingObject(error: unknown): boolean {
    const name = this.getErrorName(error);
    return name === 'NoSuchKey' || name === 'NotFound';
  }

  private isPreconditionFailed(error: unknown): boolean {
    return (
      this.getStatusCode(error) === 412 ||
      this.getErrorName(error) === 'PreconditionFailed'
    );
  }

  private isTemporary(error: unknown): boolean {
    const statusCode = this.getStatusCode(error);
    if (
      statusCode === 408 ||
      statusCode === 429 ||
      (statusCode !== undefined && statusCode >= 500 && statusCode <= 599)
    ) {
      return true;
    }

    const code = this.getErrorCode(error);
    return (
      code !== undefined &&
      [
        'TimeoutError',
        'RequestTimeout',
        'NetworkingError',
        'ECONNRESET',
        'ECONNREFUSED',
        'ENOTFOUND',
        'ETIMEDOUT',
      ].includes(code)
    );
  }

  private getStatusCode(error: unknown): number | undefined {
    if (
      typeof error !== 'object' ||
      error === null ||
      !('$metadata' in error)
    ) {
      return undefined;
    }
    const metadata = (error as { $metadata?: { httpStatusCode?: unknown } })
      .$metadata;
    return typeof metadata?.httpStatusCode === 'number'
      ? metadata.httpStatusCode
      : undefined;
  }

  private getErrorName(error: unknown): string | undefined {
    return typeof error === 'object' && error !== null && 'name' in error
      ? String(error.name)
      : undefined;
  }

  private getErrorCode(error: unknown): string | undefined {
    if (typeof error !== 'object' || error === null) return undefined;
    if ('code' in error) return String(error.code);
    if ('cause' in error) {
      const cause = error.cause;
      if (typeof cause === 'object' && cause !== null && 'code' in cause) {
        return String(cause.code);
      }
    }
    return this.getErrorName(error);
  }
}
