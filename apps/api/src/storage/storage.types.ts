/**
 * Contratos de la capa de almacenamiento de objetos (binarios).
 *
 * La capa es agnóstica del dominio: opera exclusivamente sobre `key`
 * (la `storageKey` que ya construyen los servicios, p. ej.
 * `${tenantId}/expediente/${empleadoId}/...`) y `Buffer`. No conoce
 * Prisma, ExpedienteDoc ni ningún modelo de negocio.
 */

/** Token de inyección para el proveedor de almacenamiento activo. */
export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');

export interface PutObjectInput {
  /** Ruta lógica del objeto dentro del almacenamiento (storageKey). */
  key: string;
  /** Contenido binario del objeto. */
  body: Buffer;
  /** MIME type opcional (ej. `application/pdf`). */
  contentType?: string;
}

export interface StorageObjectMetadata {
  key: string;
  /** Tamaño en bytes del objeto almacenado. */
  size: number;
  contentType?: string;
}

/**
 * Abstracción de un backend de almacenamiento. Hoy sólo existe
 * `LocalDiskStorageProvider`; en el futuro R2 implementará esta misma
 * interfaz sin que los consumidores de `StorageService` cambien.
 */
export interface StorageProvider {
  put(input: PutObjectInput): Promise<StorageObjectMetadata>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

/** Se lanza cuando se solicita una `key` que no existe en el backend. */
export class StorageObjectNotFoundError extends Error {
  constructor(public readonly key: string) {
    super(`Objeto no encontrado en almacenamiento: ${key}`);
    this.name = 'StorageObjectNotFoundError';
  }
}

/** Se lanza cuando una `key` es inválida o intenta escapar del directorio raíz. */
export class InvalidStorageKeyError extends Error {
  constructor(key: string, reason: string) {
    super(`storageKey inválida ("${key}"): ${reason}`);
    this.name = 'InvalidStorageKeyError';
  }
}

/** Se lanza cuando se intenta usar R2 antes de habilitar transferencias reales. */
export class CloudflareR2StorageUnavailableError extends Error {
  constructor(reason: string) {
    super(`Cloudflare R2 no está disponible: ${reason}`);
    this.name = 'CloudflareR2StorageUnavailableError';
  }
}

/** Se lanza cuando R2 está seleccionado pero su configuración es inválida. */
export class CloudflareR2StorageConfigurationError extends Error {
  constructor(reason: string) {
    super(`Cloudflare R2 está mal configurado: ${reason}`);
    this.name = 'CloudflareR2StorageConfigurationError';
  }
}

/** Se lanza cuando el proveedor configurado no corresponde a un binding conocido. */
export class UnknownStorageProviderError extends Error {
  constructor(provider: string) {
    super(`Proveedor de almacenamiento desconocido: ${provider}`);
    this.name = 'UnknownStorageProviderError';
  }
}
