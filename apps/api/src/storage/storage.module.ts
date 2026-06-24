import { Global, Module } from '@nestjs/common';
import { LocalDiskStorageProvider } from './local-disk-storage.provider';
import { StorageService } from './storage.service';
import { STORAGE_PROVIDER } from './storage.types';

/**
 * Módulo global de almacenamiento.
 *
 * Expone `StorageService` a toda la aplicación. El proveedor activo se
 * resuelve a través del token `STORAGE_PROVIDER`; hoy apunta a
 * `LocalDiskStorageProvider`. Para migrar a R2 bastará con cambiar este
 * binding por el proveedor correspondiente.
 */
@Global()
@Module({
  providers: [
    LocalDiskStorageProvider,
    { provide: STORAGE_PROVIDER, useExisting: LocalDiskStorageProvider },
    StorageService,
  ],
  exports: [StorageService],
})
export class StorageModule {}
