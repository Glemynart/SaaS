import { Global, Module } from '@nestjs/common';
import { CloudflareR2StorageProvider } from './cloudflare-r2-storage.provider';
import { LocalDiskStorageProvider } from './local-disk-storage.provider';
import { StorageService } from './storage.service';
import {
  STORAGE_PROVIDER,
  StorageProvider,
  UnknownStorageProviderError,
} from './storage.types';

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
    CloudflareR2StorageProvider,
    {
      provide: STORAGE_PROVIDER,
      inject: [LocalDiskStorageProvider, CloudflareR2StorageProvider],
      useFactory: (
        local: LocalDiskStorageProvider,
        cloudflareR2: CloudflareR2StorageProvider,
      ): StorageProvider => {
        const provider = process.env.STORAGE_PROVIDER ?? 'local';
        if (provider === 'local') return local;
        if (provider === 'r2') return cloudflareR2;

        throw new UnknownStorageProviderError(provider);
      },
    },
    StorageService,
  ],
  exports: [StorageService],
})
export class StorageModule {}
