# ADR-007: Ejecución, reintentos y visibilidad operativa del scheduler de alertas

**Date**: 2026-08-02
**Status**: proposed
**Deciders**: pendiente de aprobación del responsable de producto y arquitectura

## Context

E6.1 ejecuta la generación diaria de alertas para todos los tenants activos dentro
de una única transacción de PostgreSQL protegida por un advisory lock. Si un tenant
falla, la excepción revierte el lote completo y el único rastro operativo queda en
los logs del proceso. E6.2 permite consultar y resolver alertas, pero no permite
saber si la última ejecución del scheduler terminó bien, qué tenant falló ni cómo
recuperarlo.

El `AuditLog` existente es un registro append-only de hechos de seguridad y negocio;
no debe convertirse en el estado mutable de una ejecución operativa. E6.3 necesita
por tanto una semántica explícita para separar estado de ejecución, reintentos y
auditoría sin introducir una dependencia de staging, correo, R2 o servicios
externos.

## Decision

Se propone modelar las ejecuciones del scheduler como estado operativo separado del
`AuditLog`:

1. Una ejecución (`AlertGenerationRun`) representa un disparo diario y conserva
   `startedAt`, `finishedAt`, estado y totales agregados. Sus estados serán
   `RUNNING`, `SUCCEEDED`, `PARTIAL`, `FAILED` y `SKIPPED`.
2. Cada tenant tendrá un resultado asociado (`AlertGenerationRunTenant`) con su
   estado, número de intento, cantidades generadas y un código de error seguro.
   Cada tenant se procesará en su propia transacción; un fallo no revierte los
   resultados ya completados de otros tenants.
3. El scheduler reclamará una ejecución mediante una operación corta protegida por
   PostgreSQL y procesará después los tenants de forma aislada. Una ejecución
   abandonada podrá identificarse como incompleta sin bloquear permanentemente las
   siguientes.
4. Cada tenant tendrá como máximo un reintento automático dentro de la misma
   ejecución. La operación podrá iniciar un nuevo reintento explícito para los
   resultados fallidos. La deduplicación existente de alertas seguirá siendo la
   garantía de idempotencia.
5. Los eventos `ALERT_GENERATION_STARTED`, `ALERT_GENERATION_TENANT_FAILED`,
   `ALERT_GENERATION_RETRIED` y `ALERT_GENERATION_FINISHED` se escribirán en el
   `AuditLog`, usando el contexto de sistema y un `runId`. Nunca se almacenarán
   secretos, stack traces ni contenido sensible.
6. La API y la pantalla de Alertas mostrarán la última ejecución, su estado, los
   tenants fallidos y la acción de reintento disponible para `ADMIN`. La consulta
   será tenant-aware y no expondrá ejecuciones de otra organización.

## Alternatives Considered

### Alternative 1: Mantener únicamente logs y reintentar todo el lote

- **Pros**: no requiere migración ni nuevos endpoints.
- **Cons**: no deja estado consultable, repite tenants exitosos y conserva el
  rollback global.
- **Why not**: no satisface la visibilidad ni el aislamiento de fallos requeridos
  por E6.3.

### Alternative 2: Usar `AuditLog` como tabla de ejecuciones

- **Pros**: reutiliza una tabla y un servicio existentes.
- **Cons**: mezcla hechos append-only con estado operativo mutable y dificulta
  consultar/reintentar una ejecución de forma segura.
- **Why not**: contradice la separación establecida por ADR-SEC-001.

### Alternative 3: Incorporar una cola o un sistema de jobs externo

- **Pros**: ofrece reintentos, backoff y observabilidad especializados.
- **Cons**: añade infraestructura, secretos y operación fuera del alcance actual.
- **Why not**: E6.3 debe funcionar con la arquitectura NestJS/PostgreSQL vigente y
  no puede depender de staging ni de otro proveedor.

## Consequences

### Positive

- La operación puede distinguir éxito total, éxito parcial y fallo.
- Un tenant defectuoso no oculta ni revierte el trabajo válido de los demás.
- Los reintentos son acotados, idempotentes y auditables.
- El historial operativo queda separado de la auditoría append-only.

### Negative

- Añade dos estructuras persistentes, endpoints y una superficie de UI.
- Requiere definir recuperación de ejecuciones abandonadas y retención de sus
  resultados.

### Risks

- Un reintento de una alerta cuyo detector cambió durante la ejecución podría
  producir resultados distintos; se mitiga conservando el `runId`, el tenant y el
  intento, y aplicando la deduplicación existente.
- Mensajes de error demasiado detallados podrían filtrar información interna; se
  mitiga persistiendo únicamente códigos y mensajes sanitizados.
