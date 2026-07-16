import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import { TenantExecutionContext } from './tenant-context.types';

@Injectable()
export class TenantContextService {
  private readonly storage = new AsyncLocalStorage<TenantExecutionContext>();

  run<T>(context: TenantExecutionContext, callback: () => T): T {
    return this.storage.run(Object.freeze({ ...context }), callback);
  }

  get(): TenantExecutionContext | undefined {
    return this.storage.getStore();
  }
}
