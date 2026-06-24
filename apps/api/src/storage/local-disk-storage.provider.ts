import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  InvalidStorageKeyError,
  PutObjectInput,
  StorageObjectMetadata,
  StorageObjectNotFoundError,
  StorageProvider,
} from './storage.types';

/**
 * Proveedor de almacenamiento sobre el sistema de archivos local.
 *
 * Las `key` se resuelven como rutas relativas dentro de un directorio
 * raíz (`STORAGE_LOCAL_ROOT`, por defecto `<repo>/uploads`), espejando el
 * comportamiento que hoy implementan a mano los servicios que escriben en
 * `uploads/`. Toda `key` se valida para impedir path traversal.
 */
@Injectable()
export class LocalDiskStorageProvider implements StorageProvider {
  private readonly logger = new Logger(LocalDiskStorageProvider.name);
  private readonly root: string;

  constructor() {
    this.root = process.env.STORAGE_LOCAL_ROOT
      ? path.resolve(process.env.STORAGE_LOCAL_ROOT)
      : path.resolve(process.cwd(), '..', '..', 'uploads');
    this.logger.log(`LocalDiskStorageProvider listo — root: ${this.root}`);
  }

  async put(input: PutObjectInput): Promise<StorageObjectMetadata> {
    const fullPath = this.resolveKey(input.key);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, input.body);
    return {
      key: input.key,
      size: input.body.length,
      contentType: input.contentType,
    };
  }

  async get(key: string): Promise<Buffer> {
    const fullPath = this.resolveKey(key);
    try {
      return await fs.readFile(fullPath);
    } catch (error: unknown) {
      if (this.isNotFound(error)) {
        throw new StorageObjectNotFoundError(key);
      }
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    const fullPath = this.resolveKey(key);
    try {
      await fs.unlink(fullPath);
    } catch (error: unknown) {
      // Borrado idempotente: si ya no existe, no es un error.
      if (this.isNotFound(error)) return;
      throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    const fullPath = this.resolveKey(key);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Convierte una `key` lógica en una ruta absoluta dentro de `root`,
   * rechazando cualquier intento de escapar del directorio raíz.
   */
  private resolveKey(key: string): string {
    if (!key || key.trim() === '') {
      throw new InvalidStorageKeyError(key, 'la key está vacía');
    }

    // Normalizar a separadores POSIX y descartar prefijos absolutos.
    const cleaned = key.replace(/\\/g, '/').replace(/^\/+/, '');
    const segments = cleaned.split('/').filter((s) => s.length > 0);

    if (segments.some((s) => s === '..')) {
      throw new InvalidStorageKeyError(
        key,
        'contiene segmentos de path traversal',
      );
    }
    if (segments.length === 0) {
      throw new InvalidStorageKeyError(
        key,
        'no resuelve a ninguna ruta válida',
      );
    }

    const fullPath = path.resolve(this.root, ...segments);
    const relative = path.relative(this.root, fullPath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new InvalidStorageKeyError(
        key,
        'resuelve fuera del directorio raíz',
      );
    }

    return fullPath;
  }

  private isNotFound(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as NodeJS.ErrnoException).code === 'ENOENT'
    );
  }
}
