import { ForbiddenException, Injectable } from '@nestjs/common';
import { TenantContextService } from './tenant-context.service';
import { TenantExecutionContext } from './tenant-context.types';

/**
 * Frontera de aplicación para operaciones tenant-scoped.
 *
 * Es el consumidor único del contexto propagado en esta etapa. No consulta ni
 * modifica datos; únicamente entrega un alcance de tenant verificable o falla
 * cerrado.
 */
@Injectable()
export class TenantContextBoundary {
  constructor(private readonly tenantContext: TenantContextService) {}

  require(): TenantExecutionContext {
    const context = this.tenantContext.get();

    if (!context || !this.hasExactlyOneTenant(context)) {
      throw new ForbiddenException('Se requiere un contexto de tenant válido.');
    }

    return context;
  }

  private hasExactlyOneTenant(context: TenantExecutionContext): boolean {
    return (
      typeof context.tenantId === 'string' && context.tenantId.trim().length > 0
    );
  }
}
