import { Inject, Injectable } from '@nestjs/common';
import { STORAGE_PROVIDER } from './storage.types';
import type {
  PutObjectInput,
  StorageObjectMetadata,
  StorageProvider,
} from './storage.types';

/**
 * Fachada pública de la capa de almacenamiento.
 *
 * Los servicios de dominio dependen de `StorageService`, no del proveedor
 * concreto. Cambiar de disco local a R2 será sustituir el binding del token
 * `STORAGE_PROVIDER` en `StorageModule`, sin tocar a los consumidores.
 */
@Injectable()
export class StorageService {
  constructor(
    @Inject(STORAGE_PROVIDER) private readonly provider: StorageProvider,
  ) {}

  /** Escribe (o sobrescribe) un objeto y devuelve su metadata. */
  putObject(input: PutObjectInput): Promise<StorageObjectMetadata> {
    return this.provider.put(input);
  }

  /** Lee el contenido binario de un objeto. */
  getObject(key: string): Promise<Buffer> {
    return this.provider.get(key);
  }

  /** Elimina un objeto. Idempotente: no falla si la key no existe. */
  deleteObject(key: string): Promise<void> {
    return this.provider.delete(key);
  }

  /** Indica si existe un objeto bajo la key dada. */
  objectExists(key: string): Promise<boolean> {
    return this.provider.exists(key);
  }
}
