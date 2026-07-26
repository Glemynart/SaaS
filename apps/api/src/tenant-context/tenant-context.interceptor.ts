import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { TenantContextBoundary } from './tenant-context.boundary';
import { TenantContextService } from './tenant-context.service';
import { TenantExecutionContext } from './tenant-context.types';

@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly tenantBoundary: TenantContextBoundary,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context
      .switchToHttp()
      .getRequest<{ user?: CurrentUserPayload }>();
    const user = request.user;

    if (!user?.tenantId) {
      return next.handle();
    }

    const tenantContext: TenantExecutionContext = {
      tenantId: user.tenantId,
      userId: user.userId,
      rol: user.rol,
      email: user.email,
    };

    return new Observable((subscriber) => {
      const subscription = this.tenantContext.run(tenantContext, () => {
        this.tenantBoundary.require();
        return next.handle().subscribe(subscriber);
      });

      return () => subscription.unsubscribe();
    });
  }
}
