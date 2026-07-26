/**
 * Contexto inmutable de una operación tenant-scoped ya autenticada.
 *
 * Se construye exclusivamente a partir del usuario validado por los guards.
 * No es una fuente alternativa de tenant ni reemplaza los filtros actuales.
 */
export interface TenantExecutionContext {
  readonly tenantId: string;
  readonly userId: string;
  readonly rol: string;
  readonly email: string;
}
