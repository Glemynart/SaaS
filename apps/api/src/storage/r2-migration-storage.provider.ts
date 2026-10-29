import { Injectable, Logger } from '@nestjs/common';
import { CloudflareR2StorageProvider } from './cloudflare-r2-storage.provider';
import { LocalDiskStorageProvider } from './local-disk-storage.provider';
import {
  CloudflareR2StorageUnavailableError,
  PutObjectInput,
  StorageObjectMetadata,
  StorageObjectNotFoundError,
  StorageProvider,
} from './storage.types';

/** Composición temporal: R2 escribe; LocalDisk sólo respalda lecturas. */
@Injectable()
export class R2MigrationStorageProvider implements StorageProvider {
  private readonly logger = new Logger(R2MigrationStorageProvider.name);

  constructor(
    private readonly local: LocalDiskStorageProvider,
    private readonly r2: CloudflareR2StorageProvider,
  ) {}

  put(input: PutObjectInput): Promise<StorageObjectMetadata> {
    return this.r2.put(input);
  }

  async get(key: string): Promise<Buffer> {
    try {
      return await this.r2.get(key);
    } catch (r2Error) {
      if (!this.canFallback(r2Error)) throw r2Error;

      this.logger.warn(
        `Fallback de lectura R2 -> LocalDisk para key "${key}" (${this.reason(r2Error)})`,
      );
      try {
        return await this.local.get(key);
      } catch (localError) {
        if (localError instanceof StorageObjectNotFoundError) throw r2Error;
        throw localError;
      }
    }
  }

  delete(key: string): Promise<void> {
    return this.r2.delete(key);
  }

  /** Debe consultar sólo R2 para preservar la escritura idempotente. */
  exists(key: string): Promise<boolean> {
    return this.r2.exists(key);
  }

  checkReadiness(): Promise<void> {
    return this.r2.checkReadiness();
  }

  private canFallback(error: unknown): boolean {
    return (
      error instanceof StorageObjectNotFoundError ||
      error instanceof CloudflareR2StorageUnavailableError
    );
  }

  private reason(error: unknown): string {
    return error instanceof StorageObjectNotFoundError
      ? 'NOT_FOUND'
      : 'R2_TRANSIENT_FAILURE';
  }
}
