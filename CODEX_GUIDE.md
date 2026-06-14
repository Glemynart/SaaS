# CODEX_GUIDE.md

# Guía para Codex

## Regla #1

Leer obligatoriamente:

- START_HERE.md
- PRD.md
- ARCHITECTURE_COMPLETO.md
- BACKLOG_COMPLETO.md
- schema.prisma

Antes de escribir código.

## Regla #2

Nunca implementar funcionalidades fuera del MVP.

## Regla #3

Trabajar una tarea del backlog a la vez.

## Regla #4

No modificar arquitectura sin aprobación.

## Multiempresa

Todas las consultas deben filtrar por:

tenantId

El tenantId proviene del JWT.

Nunca desde body o query params.

## Backend

- Controllers delgados.
- Lógica en Services.
- Prisma desde Services.
- DTOs para validación.

## Frontend

- Next.js App Router.
- TypeScript estricto.
- Tailwind.
- shadcn/ui.

## Seguridad

Implementar:

- JWT
- Refresh Tokens
- Rate limiting
- Validación de archivos

## Contratos

Resolver DOCX → PDF antes de implementar generación masiva.

## Facturación

Implementar:

- Numeración atómica.
- Retry.
- Circuit breaker.
- Logging.

## Flujo de Trabajo

1. Analizar tarea.
2. Mostrar plan.
3. Implementar.
4. Ejecutar validaciones.
5. Explicar cambios.

Nunca saltar varias tareas simultáneamente.
