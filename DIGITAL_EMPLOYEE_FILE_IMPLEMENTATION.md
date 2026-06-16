# DIGITAL_EMPLOYEE_FILE_IMPLEMENTATION.md

# Implementación Completa — Expediente Digital del Empleado

## Objetivo

Implementar el Expediente Digital del Empleado.

Actualmente existe:

- Employees
- DocumentTemplate
- Advanced Templates
- GeneratedDocument
- Tenant Branding
- PDF Engine

Esta fase debe consolidar todos los documentos generados en un expediente digital organizado por empleado.

## No implementar todavía

- Alertas automáticas
- Firma electrónica certificada
- Nómina
- Facturación

## Lectura obligatoria

Antes de comenzar:

- START_HERE.md
- PRD.md
- ARCHITECTURE_COMPLETETO.md
- BACKLOG_COMPLETETO.md
- PRODUCT.md
- DESIGN.md

## Arquitectura

Mantener:

- NestJS
- Prisma
- PostgreSQL
- Next.js App Router
- TanStack Query
- Multiempresa

## Concepto

Cada empleado debe tener un expediente digital.

Ejemplo:

Juan Pérez

Expediente:

- Contrato Inicial.pdf  
  • Certificación Laboral.pdf
- Memorando 001.pdf
- Carta de Renovación.pdf

## Prisma

Crear:

enum EmployeeFileCategory { CONTRACT CERTIFICATION MEMO LETTER OTHER }

model EmployeeFile { id String @id @default(uuid())

tenantId String

employeeId String

generatedDocumentId String?

nombre String

categoria EmployeeFileCategory

archivoUrl String

mimeType String?

tamanoBytes Int?

observaciones String?

createdAt DateTime @default(now())

tenant Tenant @relation(fields: [tenantId], references: [id]) employee Employee @relation(fields: [employeeId], references: [id])

@@index([tenantId]) @@index([employeeId]) }

## Integración automática

Cuando se genere un PDF desde GeneratedDocument:

1. Crear EmployeeFile automáticamente.
2. Asociarlo al empleado.
3. Asociarlo al documento generado.
4. Registrar categoría automáticamente.

Mapeo sugerido:

CONTRACT → CONTRACT

CERTIFICATION → CERTIFICATION

MEMO → MEMO

LETTER → LETTER

## Backend

Crear módulo:

employee-files

Estructura:

employee-files/ — dto/ — employee-files.controller.ts — employee-files.service.ts — employee-files.module.ts

## Endpoints

GET /employees/:id/files

Obtener expediente completo.

GET /employee-files/:id

Obtener archivo específico.

DELETE /employee-files/:id

Eliminar referencia del expediente.

No eliminar físicamente el PDF.

## Multiempresa

Obligatorio:

tenantId desde JWT.

Nunca:

- body
- query
- params

## Frontend

Nueva sección:

Expediente

## Navegación

Desde:

Empleados ↓ Detalle empleado ↓ Expediente

Ruta:

/empleados/[id]/expediente

## Vista principal

Mostrar:

- Nombre del documento
- Categoría
- Fecha de creación
- Tamaño
- Acciones

## Acciones

- Ver PDF
- Descargar PDF
- Eliminar del expediente

## Dashboard del expediente

Mostrar:

Total documentos

Documentos por categoría

Último documento generado

Fecha última actualización

## UX

Mantener identidad:

"La Oficina Nítida"

Utilizar:

- frontend-design
- interface-design

- impeccable
- emil-design-eng
- interaction-design

## Seguridad

Validar:

- Archivo pertenece al tenant.
- Empleado pertenece al tenant.
- Documento pertenece al tenant.

## Calidad

Ejecutar:

pnpm lint

pnpm typecheck

pnpm build

Corregir cualquier error.

## Entrega

Generar walkthrough completo.

Explicar:

- estructura creada
- cambios Prisma
- endpoints
- integración con PDF Engine
- integración con GeneratedDocument
- integración con Employees
- seguridad multiempresa
- resultados de lint
- resultados de typecheck
- resultados de build

## Preparación para siguiente fase

La arquitectura debe quedar preparada para:

Employee File ↓ Alerts ↓ Recordatorios ↓ Vencimientos de contratos ↓ Renovaciones

Sin requerir refactorizaciones mayores.
