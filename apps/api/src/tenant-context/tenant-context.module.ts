import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TenantContextBoundary } from './tenant-context.boundary';
import { TenantContextInterceptor } from './tenant-context.interceptor';
import { TenantContextService } from './tenant-context.service';

@Global()
@Module({
  providers: [
    TenantContextService,
    TenantContextBoundary,
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantContextInterceptor,
    },
  ],
  exports: [TenantContextService, TenantContextBoundary],
})
export class TenantContextModule {}
