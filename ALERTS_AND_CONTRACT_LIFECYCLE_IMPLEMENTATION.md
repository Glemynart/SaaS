# ALERTS_AND_CONTRACT_LIFECYCLE_IMPLEMENTATION.md

## Objetivo

Implementar el sistema de alertas y ciclo de vida contractual.

Actualmente existe:

- Employees
- GeneratedDocument
- PDF Engine
- Employee File

Esta fase debe convertir el expediente digital en un sistema activo de seguimiento.

## No implementar todavía

- Correos electrónicos
- WhatsApp
- Push notifications

Las alertas vivirán inicialmente dentro del sistema.

## Prisma

Crear:

enum AlertSeverity { INFO WARNING CRITICAL }

enum AlertStatus { OPEN RESOLVED }

model Alert { id String @id @default(uuid())

tenantId String

employeeId String?

employeeFileId String?

titulo String

descripcion String

severity AlertSeverity

status AlertStatus @default(OPEN)

dueDate DateTime?

createdAt DateTime @default(now())

resolvedAt DateTime?

tenant Tenant @relation(...) }

## Backend

Crear módulo:

alerts

## Generación automática

Crear alertas para:

- Contratos próximos a vencer
- Contratos vencidos
- Empleados sin contrato
- Documentos faltantes

## Dashboard

Nueva sección:

/alertas

## Mostrar

- abiertas
- resueltas
- críticas  
  • por empleado

## Acciones

- Marcar resuelta
- Ver empleado

## Seguridad

Mantener aislamiento multiempresa.

## Calidad

Ejecutar:

pnpm lint

pnpm typecheck

pnpm build

## Entrega

Generar walkthrough completo.
