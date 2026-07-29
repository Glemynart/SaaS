import { Injectable } from '@nestjs/common';
import {
  CloudflareR2StorageUnavailableError,
  PutObjectInput,
  StorageObjectMetadata,
  StorageProvider,
} from './storage.types';

const R2_REQUIRED_ENVIRONMENT_VARIABLES = [
  'R2_ENDPOINT',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
] as const;

/**
 * Adaptador de Cloudflare R2 para el contrato `StorageProvider`.
 *
 * PR8B sólo establece el límite de infraestructura y el registro de Nest.
 * No crea un cliente S3 ni realiza operaciones de red: incluso con
 * credenciales completas las transferencias quedan reservadas para el PR que
 * autorice las cargas reales.
 */
@Injectable()
export class CloudflareR2StorageProvider implements StorageProvider {
  put(input: PutObjectInput): Promise<StorageObjectMetadata> {
    void input;
    return this.rejectUnavailable();
  }

  get(key: string): Promise<Buffer> {
    void key;
    return this.rejectUnavailable();
  }

  delete(key: string): Promise<void> {
    void key;
    return this.rejectUnavailable();
  }

  exists(key: string): Promise<boolean> {
    void key;
    return this.rejectUnavailable();
  }

  private rejectUnavailable<T>(): Promise<T> {
    return Promise.reject(this.unavailable());
  }

  private unavailable(): CloudflareR2StorageUnavailableError {
    const missing = R2_REQUIRED_ENVIRONMENT_VARIABLES.filter(
      (name) => !process.env[name],
    );

    if (missing.length > 0) {
      return new CloudflareR2StorageUnavailableError(
        `faltan variables de configuración: ${missing.join(', ')}`,
      );
    }

    return new CloudflareR2StorageUnavailableError(
      'las transferencias aún no están habilitadas por este PR',
    );
  }
}
