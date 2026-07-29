import { Global, Module } from '@nestjs/common';
import { CloudflareR2StorageProvider } from './cloudflare-r2-storage.provider';
import { LocalDiskStorageProvider } from './local-disk-storage.provider';
import { R2MigrationStorageProvider } from './r2-migration-storage.provider';
import { StorageService } from './storage.service';
import {
  STORAGE_PROVIDER,
  StorageProvider,
  UnknownStorageProviderError,
} from './storage.types';

/** Resuelve el proveedor activo al iniciar: local, r2-migration o r2. */
@Global()
@Module({
  providers: [
    LocalDiskStorageProvider,
    CloudflareR2StorageProvider,
    R2MigrationStorageProvider,
    {
      provide: STORAGE_PROVIDER,
      inject: [
        LocalDiskStorageProvider,
        CloudflareR2StorageProvider,
        R2MigrationStorageProvider,
      ],
      useFactory: (
        local: LocalDiskStorageProvider,
        cloudflareR2: CloudflareR2StorageProvider,
        migration: R2MigrationStorageProvider,
      ): StorageProvider => {
        const provider = process.env.STORAGE_PROVIDER ?? 'local';
        if (provider === 'local') return local;
        if (provider === 'r2-migration') {
          cloudflareR2.validateConfiguration();
          return migration;
        }
        if (provider === 'r2') {
          cloudflareR2.validateConfiguration();
          return cloudflareR2;
        }
        throw new UnknownStorageProviderError(provider);
      },
    },
    StorageService,
  ],
  exports: [StorageService],
})
export class StorageModule {}
