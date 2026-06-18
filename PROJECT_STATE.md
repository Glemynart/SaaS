# <a name="project_state.md"></a>PROJECT_STATE.md

# <a name="la-oficina-nítida"></a>La Oficina Nítida

## Última actualización: ExpedienteDoc Consolidation — PR4

# <a name="descripción-del-producto"></a>Descripción del producto

La Oficina Nítida es un SaaS orientado inicialmente a operadores educativos colombianos.

El objetivo es centralizar:

- Gestión de empleados.
- Contratación laboral.
- Expedientes digitales.
- Alertas.
- Generación documental.
- Gestión multisede.
- Nómina electrónica (futuro).
- Facturación electrónica (futuro).

---

# <a name="cliente-objetivo"></a>Cliente objetivo

Operadores educativos colombianos.

Características habituales:

- Administran uno o varios colegios.
- Manejan múltiples sedes.
- Gestionan personal administrativo y docente.
- Requieren cumplimiento normativo colombiano.
- Manejan alta carga documental.

---

# <a name="posicionamiento"></a>Posicionamiento

La Oficina Nítida NO se posiciona inicialmente como:

- software de nómina electrónica
- software de facturación electrónica

aunque ambos módulos existirán en el futuro.

La propuesta de valor actual es:

“Centralizar la gestión laboral, documental y operativa de operadores educativos colombianos.”

---

# <a name="stack-tecnológico"></a>Stack Tecnológico

Frontend:

- Next.js
- TypeScript

Backend:

- NestJS
- Prisma
- PostgreSQL

Servicios:

- Firebase

---

# <a name="principios-arquitectónicos"></a>Principios Arquitectónicos

- Multiempresa desde el diseño.
- Multisede desde el diseño.
- Arquitectura modular.
- Simplicidad antes que sobreingeniería.
- Migraciones por fases.
- Commits pequeños y reversibles.
- Build verde antes de commit.
- Typecheck verde antes de commit.

---

# <a name="estado-general-del-proyecto"></a>Estado General del Proyecto

## <a name="landing-saas"></a>Landing SaaS

Estado:

✅ Completada

Objetivo:

- Captación de leads.
- Solicitud de demos.
- SEO.

Commit principal:

bcacb8e

---

# <a name="employee-colombia-expansion"></a>Employee Colombia Expansion

Rama:

feat/employee-colombia-expansion

Estado:

✅ COMPLETADA

Resultado:

- Modelo laboral colombiano estabilizado.
- Contrato de API actualizado.
- Migración de nombres completada.
- Sin referencias funcionales activas a nombre/apellido.
- Base preparada para futuras integraciones normativas.

Objetivo alcanzado:

Modernizar el modelo laboral colombiano y preparar la plataforma para futuras integraciones normativas.

---

## <a name="fase-1"></a>FASE 1

Commit:

8da9011

Implementado:

- Entidad Sede.
- Tenant.municipioId.
- Contrato.sedeId.
- Contrato.contratoRenovaId.
- ExpedienteDoc extendido.
- Nuevos enums.

---

## <a name="fase-2"></a>FASE 2

Commit:

d1e2986

Implementado:

- municipioExpedicionDocId.
- salarioIntegral.
- jornadaLaboral.
- fechaRetiro.
- motivoRetiro.

---

## <a name="fase-3"></a>FASE 3

Commit:

c8e4cfb

Implementado:

- TipoDocIdentidad como enum oficial.

Valores:

- CC
- CE
- TI
- PA
- NIT
- PEP
- PPT

---

## <a name="fase-4a"></a>FASE 4A

Commit:

feat(employee): phase 4a split names and surnames

Implementado:

- primerNombre
- segundoNombre
- primerApellido
- segundoApellido
- formatNombreCompleto()
- Migración de frontend y backend

---

## <a name="fase-4b"></a>FASE 4B

Commit:

feat(employee): phase 4b remove legacy name fields

Implementado:

- Backfill de empleados existentes.
- primerNombre NOT NULL.
- primerApellido NOT NULL.
- Eliminación de nombre.
- Eliminación de apellido.
- Eliminación de compatibilidad temporal.
- Limpieza de DTOs.
- Limpieza de servicios.
- Limpieza de tipos.

---

## <a name="xde958a9ac0eefe7d47949dfc18eca234f252f2e"></a>Decisiones arquitectónicas aprobadas en FASE 4

### <a name="modelo-oficial-de-nombres"></a>Modelo oficial de nombres

El modelo oficial de empleado queda compuesto por:

- primerNombre
- segundoNombre
- primerApellido
- segundoApellido

Los campos:

- nombre
- apellido

fueron eliminados definitivamente en FASE 4B.

No deben reintroducirse.

---

### <a name="fuente-única-para-nombre-completo"></a>Fuente única para nombre completo

La única forma aprobada de construir nombres completos es:

formatNombreCompleto()

ubicado en:

@saas/types

No se permiten nuevas concatenaciones manuales en frontend o backend.

---

### <a name="estrategia-de-backfill-aprobada"></a>Estrategia de backfill aprobada

Se decidió NO separar automáticamente nombres compuestos.

La migración utilizó:

- nombre → primerNombre
- apellido → primerApellido

Motivo:

- sin pérdida de datos
- reversible
- menor riesgo

---

### <a name="contrato-oficial-de-api"></a>Contrato oficial de API

Las APIs de empleados ya no exponen:

- nombre
- apellido

El contrato oficial queda basado únicamente en:

- primerNombre
- segundoNombre
- primerApellido
- segundoApellido

---

# <a name="incidentes-resueltos-durante-fase-4"></a>Incidentes resueltos durante FASE 4

### <a name="runtime-de-saastypes"></a>Runtime de @saas/types

Problema:

- incompatibilidad entre ESM emitido por TypeScript y ejecución en Node.js

Decisión:

- mantener @saas/types en CommonJS

Implementación:

- fix(@saas/types): override module to CommonJS

Estado:

✅ Resuelto

---

### <a name="generated-documents"></a>Generated Documents

Problema:

- findAll() no retornaba los nuevos campos de nombre desagregado

Impacto:

- nombres vacíos en el listado documental

Implementación:

- fix(generated-documents): add disaggregated name fields to findAll

Estado:

✅ Resuelto

---

### <a name="email-opcional"></a>Email opcional

Problema:

- manejo inconsistente de email vacío

Implementación:

- fix(employee): handle empty optional email

Estado:

✅ Resuelto

---

# <a name="decisiones-arquitectónicas-vigentes"></a>Decisiones Arquitectónicas Vigentes

## <a name="saastypes"></a>@saas/types

El paquete compartido @saas/types compila actualmente a CommonJS.

Motivo:

- compatibilidad con NestJS
- compatibilidad con Next.js SSR
- menor riesgo operativo

No migrar a ESM sin una decisión arquitectónica explícita.

---

## <a name="modelo-oficial-de-nombres-1"></a>Modelo oficial de nombres

Ver:

Employee Colombia Expansion → Decisiones arquitectónicas aprobadas en FASE 4.

---

## <a name="tipo-de-documento"></a>Tipo de documento

TipoDocumento utiliza exclusivamente:

TipoDocIdentidad

No utilizar strings libres.

---

## <a name="multisede"></a>Multisede

La arquitectura multisede está aprobada.

La entidad Sede es la fuente de verdad.

No crear nuevas referencias textuales de sede.

Toda nueva funcionalidad debe utilizar:

sedeId

---

## <a name="expedientes"></a>Expedientes

La dirección arquitectónica aprobada es:

Empleado → ExpedienteDoc

EmployeeFile es considerado legado. No desarrollar nuevas funcionalidades sobre EmployeeFile.

La migración está en `feat/expedientedoc-consolidation` mediante una estrategia de fases (PR1–PR6). PR4 completado: la UI del expediente ya lee desde `ExpedienteDoc`. Pendiente: PR5 (retiro de dual-write y consumidores activos) y PR6 (DROP destructivo). Ver sección **ExpedienteDoc Consolidation** para el estado detallado.

Convención oficial de `storageKey`:

```
{tenantId}/expediente/{empleadoId}/{categoria}/{id}_v{version}.{ext}
```

Para documentos generados desde el motor documental:

```
{tenantId}/expediente/{empleadoId}/{categoria}/gen_{generatedDocId}_v1.pdf
```

---

# <a name="fase-5-gestión-de-sedes"></a>FASE 5 — Gestión de Sedes

Estado:

✅ COMPLETADA

Objetivo alcanzado:

Completar la adopción funcional de la entidad Sede e integrar la arquitectura multisede con el módulo de empleados y generación documental.

---

## <a name="contexto"></a>Contexto

La entidad Sede fue introducida durante Employee Colombia Expansion.

FASE 5 completó su adopción funcional mediante:

- CRUD completo de sedes.
- Integración con municipios DANE.
- Integración con empleados.
- Integración con generación documental.
- Validación multiempresa.
- Arquitectura multisede operativa.

---

## <a name="fase-5a"></a>FASE 5A — Gestión Operativa de Sedes

Estado:

✅ COMPLETADA

Rama:

feat/phase-5-sede-management

Objetivo alcanzado:

Implementar la gestión funcional completa de sedes.

### Backend

Implementado:

- CRUD completo de sedes.
- Validación por tenant.
- Activación y desactivación lógica.
- Validación de municipios DANE.
- Regla de unicidad de sedes activas por tenant.

### Frontend

Implementado:

- Página de gestión de sedes.
- Tabla de sedes.
- Formulario de creación.
- Formulario de edición.
- React Query.
- Integración BFF.
- Selector de municipios DANE.
- Navegación integrada.

### Infraestructura

Implementado:

- Endpoint GET /dane/municipios.
- JwtAuthGuard.
- ActiveTenantGuard.

### Resultado de validación

Validación funcional end-to-end completada.

Resultado:

✅ 10 / 10 flujos PASS

Validado:

- Crear sede.
- Editar sede.
- Desactivar sede.
- Reactivar sede.
- Municipio obligatorio.
- Nombre obligatorio.
- Regla de duplicados.
- Endpoint de municipios.
- Navegación.
- Integración frontend/backend.

Sin errores de:

- React Query.
- Hidratación.
- Consola.
- Red.
- Runtime.

---

## <a name="fase-5c"></a>FASE 5C — Integración Employee ↔ Sede

Estado:

✅ COMPLETADA

Rama:

feat/phase-5c-sede-employee-integration

Objetivo alcanzado:

Integrar completamente la entidad Sede con el módulo de empleados y con la generación documental.

---

### <a name="fase-5c1"></a>FASE 5C.1 — Backend

Implementado:

- Employee.sedeId.
- Relación Employee → Sede.
- Validación cross-tenant.
- Validación de existencia de sede.
- Integración Prisma.
- Integración DTOs.
- Integración API.

Resultado:

- Arquitectura Employee → Sede operativa.
- Compatibilidad mantenida con datos existentes.
- Sin necesidad de backfill.

---

### <a name="fase-5c2"></a>FASE 5C.2 — Frontend

Implementado:

- Selector de sede en empleados.
- Visualización de sede en listado.
- Visualización de sede en detalle.
- Soporte para remover sede.
- Soporte para reasignar sede.

Resultado:

- Gestión completa de sede desde el módulo de empleados.

---

### <a name="fase-5c3"></a>FASE 5C.3 — Integración Documental

Implementado:

- Variable documental {{SEDE}}.
- Integración con Generated Documents.
- Integración con ReplacementContext.
- Integración con AVAILABLE_VARIABLES.
- Visualización de sede en generación documental.
- Visualización de sede en detalle documental.

Resultado:

Empleado → Sede → Documento

completamente integrado.

---

## <a name="decisiones-arquitectónicas-fase-5"></a>Decisiones arquitectónicas vigentes

### <a name="sede-es-la-fuente-de-verdad"></a>Sede es la fuente de verdad

Toda nueva funcionalidad debe utilizar:

sedeId

No deben crearse nuevas referencias textuales de sede.

---

### <a name="multisede-es-requisito-oficial"></a>Multisede es requisito oficial

La plataforma debe soportar:

- un operador educativo
- múltiples colegios
- múltiples sedes

desde el diseño.

---

### <a name="integracion-empleado-sede"></a>Integración Empleado ↔ Sede

La relación oficial aprobada es:

Empleado → Sede

mediante:

sedeId

No utilizar:

sede (texto libre)

para nuevas funcionalidades.

---

### <a name="integracion-documental-sede"></a>Integración documental

La variable oficial aprobada para plantillas es:

{{SEDE}}

Fuente de datos:

employee.sedeRef?.nombre

---

## <a name="resultado-final-fase-5"></a>Resultado final

Arquitectura alcanzada:

Tenant → Sede → Empleado → Documento

Capacidades disponibles:

- Gestión de sedes.
- Integración DANE.
- Integración con empleados.
- Integración documental.
- Validación multiempresa.
- Arquitectura multisede funcional.

Estado final:

✅ FASE 5 COMPLETADA

# FASE 5D — Importación Masiva de Empleados

Estado:

✅ COMPLETADA

Implementado:

- Descarga de plantilla Excel.
- Importación masiva de empleados.
- Validación atómica.
- Resolución de sedes por nombre.
- Auditoría de importaciones.

Objetivo:

Permitir carga masiva de empleados mediante archivos Excel (.xlsx).

Decisiones aprobadas:

- Excel (.xlsx) como formato oficial.
- Máximo 500 filas por archivo.
- Resolución de sede por nombre.
- Importación atómica.
- Sin Redis.
- Sin BullMQ.
- Sin procesamiento asíncrono.
- Validación completa antes de importar.

Alcance inicial:

- Descarga de plantilla.
- Carga de archivo.
- Validación.
- Importación masiva.
- Reporte de errores.

Resultado esperado:

Reducir significativamente el tiempo de onboarding de nuevos operadores educativos.

Resultado final:

- Backend y frontend implementados.
- Validación runtime completada.
- 7/7 flujos PASS.
- Integración completa con Employees y Sedes.
- Listo para uso operativo.

# FASE 6 — Módulo de Contratos

Estado:

🟡 En progreso

Objetivo:

Implementar la gestión contractual completa para operadores educativos colombianos.

---

## Contexto

El modelo Contrato ya existía en Prisma desde fases anteriores.

Durante FASE 6 se inició la construcción del módulo funcional completo de contratos.

La implementación se divide en Backend Core, Frontend Core y futuras capacidades documentales.

---

# FASE 6A — Contracts Backend Core

Estado:

✅ COMPLETADA

Objetivo:

Implementar la base operativa del módulo de contratos.

Implementado:

- Listado de contratos.
- Detalle de contrato.
- Creación de contratos.
- Cambio de estado.
- Historial contractual por empleado.
- Tenant isolation.
- AuditLog.
- Validaciones de negocio.

Endpoints:

- GET /contracts
- GET /contracts/:id
- POST /contracts
- PATCH /contracts/:id/status
- GET /contracts/employees/:id/contracts

Estados soportados:

- VIGENTE
- VENCIDO
- TERMINADO
- RENOVADO

Transiciones aprobadas:

- VIGENTE → VENCIDO
- VIGENTE → TERMINADO
- VIGENTE → RENOVADO
- VENCIDO → RENOVADO

---

# FASE 6B — Contracts Frontend Core

Estado:

✅ COMPLETADA

Objetivo:

Permitir gestión contractual completa desde la interfaz.

Implementado:

- Listado de contratos.
- Búsqueda.
- Filtro por estado.
- Paginación.
- Página de detalle.
- Creación de contratos.
- Cambio de estado desde UI.
- Navegación integrada en sidebar.

Resultado:

Flujo contractual operativo end-to-end.

Empleado
→ Crear contrato
→ Consultar contrato
→ Cambiar estado
→ Consultar historial

---

# FASE 6C — Contratos Documentales

Estado:

⏳ Pendiente

Objetivo:

Incorporar generación documental asociada a contratos.

Alcance previsto:

- PDF de contratos.
- Integración con plantillas.
- Asociación documental con expediente.

No incluye aún:

- DOCX.
- R2.
- Renovaciones automáticas.

---

## Decisiones arquitectónicas

### Contrato es la fuente de verdad contractual

Toda nueva funcionalidad laboral deberá construirse sobre:

Contrato

---

### Contrato conserva snapshots históricos

Los campos:

- cargo
- salario

se almacenan dentro del contrato para preservar el contexto histórico.

---

### Renovaciones serán una fase posterior

RENOVADO actualmente es un estado terminal.

La creación automática del contrato sucesor se implementará en una fase futura.

---

## Resultado esperado

Arquitectura objetivo:

Tenant
→ Empleado
→ Contrato
→ ExpedienteDoc
→ Gestión documental futura

---

# FASE 7A — Password Reset Backend

Estado:

✅ COMPLETADA

Objetivo:

Implementar restablecimiento seguro de contraseña sin exposición de información de usuarios o tenants.

Implementado:

- Tabla `password_reset_tokens` (migración `20260617000000_add_password_reset_tokens`).
- Modelo Prisma `PasswordResetToken` con relación `User → PasswordResetToken`.
- `PasswordResetService` con `requestReset()` y `consumeReset()`.
- Endpoints `POST /auth/forgot-password` y `POST /auth/reset-password`.
- Throttling independiente por endpoint (`forgotPassword`, `resetPassword`).
- Tokens de un solo uso con expiración de 1 hora.
- Patrón `base64(tokenId:secret)` — solo el hash bcrypt se almacena en DB.
- Respuestas genéricas anti-enumeración.
- Invalidación de tokens pendientes al solicitar nuevo reset.
- Revocación de todos los RefreshTokens al completar el reset.
- AuditLog: `PASSWORD_RESET_REQUESTED`, `PASSWORD_RESET_COMPLETED`.
- MVP: URL de reset emitida vía `console.log` (sin email service).

Decisiones aprobadas:

- Requiere `tenantNit` + `email` (no solo email) para alinearse con el login multiempresa.
- Respuesta genérica en todos los casos de error para evitar enumeración.
- Token multi-tenant safe: validado contra `tenantId` del usuario.
- No se implementa servicio de email en esta fase.

Rama:

feat/password-reset

---

# FASE 7B.1 — Email Infrastructure MVP

Estado:

✅ COMPLETADA

Rama:

feat/email-infrastructure (mergeada — PR #1, commit 4371da4)

Objetivo:

Infraestructura de email mínima y operativa sobre Resend, integrada con Password Reset.

Implementado:

- `EmailModule` global (`@Global()`).
- `EmailService` con Resend SDK.
- Modo degradado cuando `RESEND_API_KEY` no está definida (`Logger.error`, sin crash).
- Templates HTML simples: `base-layout`, `password-reset`.
- Integración con `PasswordResetService` — reemplaza `console.log`.
- Auditoría `EMAIL_FAILED` vía `AuditService`.
- Sección `email` en `configuration.ts`.

Decisiones aprobadas:

- Resend como proveedor único.
- Sin BullMQ — envío síncrono.
- Sin React Email — funciones TypeScript que retornan HTML.
- Sin dominios por tenant — `from` único de plataforma.
- Sin TenantBranding ni logos dinámicos en MVP.
- Auditar `EMAIL_FAILED`. No auditar `EMAIL_SENT`.
- Fallo de email no interrumpe el flujo de negocio.

Pendiente (fuera del alcance de 7B.1):

- Configuración `RESEND_API_KEY` y `EMAIL_FROM` en Railway.
- DNS del dominio: SPF, DKIM, DMARC.
- Verificación de dominio en Resend dashboard.
- Validación end-to-end con correo real.

Commits:

- b4647d5 (implementación)
- 4371da4 (merge a main)

---

# ExpedienteDoc Consolidation

Estado:

🟡 En progreso

Rama:

feat/expedientedoc-consolidation

Objetivo:

Migrar el expediente digital de empleados desde EmployeeFile (legado) hacia ExpedienteDoc (nuevo), preservando todos los datos existentes y manteniendo el sistema operativo durante la transición.

Estrategia:

Dual-write + lectura paralela + retiro gradual. La UI ya lee desde ExpedienteDoc (PR4 completado). El dual-write sigue activo; se retira en PR5.

---

## PR1 — Schema reconciliation

Estado:

✅ COMPLETADA

Commit:

f3e17ed

Implementado:

- Migración `20260617000001_drop_expedientedoc_unique`.
- Eliminado `@@unique([empleadoId, categoria, version])` — incompatible con múltiples documentos por categoría.
- Migraciones previas (000000–000002) reconciliadas via `migrate resolve` (SQL ya existía en BD).
- `migrate status`: limpio — 17 migraciones aplicadas, 0 pendientes.

---

## PR2 — Backfill employee_files → expediente_docs

Estado:

✅ COMPLETADA

Commit PR2B:

0674af6

### PR2A — Diagnóstico (read-only)

Resultado:

- 1 fila en `employee_files`.
- 0 blockers.
- `tamanoBytes = NULL` — resuelto con `COALESCE(..., 0)`.

### PR2B — Backfill

Script:

`apps/api/prisma/scripts/backfill_pr2b_employee_files.sql`

Características:

- Transaccional.
- Idempotente: guard `WHERE NOT EXISTS` + tombstone `subidoPorNombre = '[migracion legado]'`.
- Mapeo de categorías: `CONTRACT → CONTRATO`, `CERTIFICATION → CERTIFICADO`, `MEMO/LETTER/OTHER → OTRO`.
- `storageKey` derivado de `archivoUrl` (solo para datos legacy — nuevos documentos usan convención directa).

Resultado de validación:

- 1 fila migrada.
- 0 FK violations.
- Idempotencia verificada: segunda ejecución → `INSERT 0 0`.

---

## PR3 Fase 1 — ExpedienteDocsModule + dual-write

Estado:

✅ COMPLETADA

Commit:

00a80f8

### Archivos creados

- `apps/api/src/expediente-docs/expediente-docs.module.ts`
- `apps/api/src/expediente-docs/expediente-docs.service.ts`
- `apps/api/src/expediente-docs/expediente-docs.controller.ts`

### Archivos modificados

- `apps/api/src/app.module.ts` — registro de `ExpedienteDocsModule`.
- `apps/api/src/generated-documents/generated-documents.module.ts` — import de `ExpedienteDocsModule`.
- `apps/api/src/generated-documents/generated-documents.service.ts` — Logger + inyección + dual-write best-effort en `generatePdf()`.

### Endpoints expuestos

- `GET /employees/:id/expediente` — lista de documentos + stats por empleado.
- `GET /expediente-docs/:id` — detalle de documento.

Ambos protegidos con `JwtAuthGuard` + `ActiveTenantGuard`.

### Dual-write

Patrón: best-effort. La escritura a `ExpedienteDoc` está envuelta en `try/catch`. Si falla, se registra `logger.warn` con el `generatedDocumentId` y `generatePdf()` continúa normalmente. `EmployeeFile` sigue siendo fuente de verdad.

### Resultados verificados

- `GET /employees/:id/expediente` → 200, `total: 1`, `byCategory: {CERTIFICADO: 1}`.
- `GET /expediente-docs/:id` → 200, campos correctos.
- Sin token → 401.
- Empleado de otro tenant → 404.
- UUID inexistente → 404.
- `GET /employees/:id/files` (legacy) → 200, sin regresión.
- Dual-write: generar PDF → `employee_files` +1, `expediente_docs` +1.
- `storageKey` del nuevo doc: `{tenantId}/expediente/{empleadoId}/{categoria}/gen_{generatedDocId}_v1.pdf`.
- `generatedDocumentId` FK correcta en DB.
- `typecheck`: 0 errores.
- `build`: exit 0.

### Deuda técnica identificada (no bloqueante)

- `buildStats` hace una segunda query DB sobre los mismos datos que `findByEmployee` ya cargó — se puede eliminar pasando el array ya cargado.
- `private readonly logger` declarado en `ExpedienteDocsService` pero nunca usado.
- `RequestUser` interface duplicada en cada controller (patrón heredado de `EmployeeFilesController`).

### Riesgos documentados

- **R1** (pre-existente): Si `employeeFilesService.createFromGeneratedDoc` falla, el dual-write nunca corre y `pdfUrl` queda huérfano.
- **R2**: Retry de `generatePdf()` crea filas duplicadas en `expediente_docs` (sin guard de idempotencia). Relevante cuando haya R2 real.
- **R3** (cosmético): `(err as Error).message` puede ser `undefined` si el error no es un `Error` estándar.

---

## PR3 Fase 2 — AlertsService sobre Contrato y ExpedienteDoc

Estado:

✅ COMPLETADA

Commit:

b7f1e45

Rama:

feat/expedientedoc-consolidation

Objetivo:

Desacoplar `AlertsService` de `EmployeeFile`. Era el último consumidor de lectura activa que impedía avanzar al retiro.

### Archivos modificados

- `apps/api/prisma/schema.prisma` — `expedienteDocId String?` + relación + `@@index([tenantId, expedienteDocId])` en `Alert`; relación inversa `alerts Alert[]` en `ExpedienteDoc`.
- `apps/api/prisma/migrations/20260618000000_add_expediente_doc_to_alert/migration.sql` — ADD COLUMN + FK + índice sobre `alerts_new`.
- `apps/api/src/alerts/alerts.service.ts` — `generateContractAlerts()` y `generateMissingDocAlerts()` reescritos; `findAll`/`findOne` incluyen `expedienteDoc`.
- `apps/api/src/alerts/dto/create-alert.dto.ts` — `expedienteDocId?: string` opcional.
- `apps/web/src/features/alerts/services/alerts-api.ts` — `AlertItem` añade `expedienteDocId` y `expedienteDoc`.
- `apps/web/src/app/(app)/alertas/page.tsx` — fallback `expedienteDoc ?? employeeFile` en nombre de documento.

### Decisiones implementadas

- **Fuente de verdad para contratos**: `prisma.contrato.findMany({ where: { estado: { in: ['VIGENTE', 'RENOVADO'] }, fechaFin: { gte: now, lte: lookahead } } })` — elimina lectura de `EmployeeFile`.
- **Fuente de verdad para documentos faltantes**: `prisma.contrato.findFirst({ where: { empleadoId, estado: { in: ['VIGENTE', 'RENOVADO'] } } })` — elimina lectura de `EmployeeFile`.
- **expedienteDocId (no contratoId)**: El campo añadido a `Alert` enlaza al `ExpedienteDoc` de categoría CONTRATO más reciente del contrato (`orderBy: version desc, take: 1`). `employeeFileId` permanece como legado nullable.
- **Dedup dual**: Si `expedienteDocId` está disponible se deduplica por `(expedienteDocId, severity, OPEN)`; si no, por `(employeeId, severity, titulo, OPEN)`.
- **Bug `dueDate` corregido**: `dueDate` ahora toma `contrato.fechaFin` real — antes calculaba `now + threshold.days`.
- **Migración por `prisma db execute` + `migrate resolve`**: Shadow DB rota (`municipios_dane` ausente); patrón establecido para todas las migraciones futuras.

### Resultado de smoke tests

```
AUTH   PASS — tenantId obtenido
ST-1   PASS — GET /alerts 200
ST-2   PASS — generate-contract-alerts: 0 creadas (sin contratos VIGENTE/RENOVADO con fechaFin próxima)
ST-3   PASS — generate-missing-doc-alerts: 2 nuevas alertas creadas
ST-4   PASS — GET /alerts retorna 4 alertas tras generación
ST-5   PASS — campo expedienteDocId presente en respuesta (null para tipo faltante-doc, esperado)
ST-6   PASS — filtro ?severity=WARNING 200
OVERALL: ALL PASS
```

### Nota sobre `Alerta` (modelo schema)

`Alerta` (modelo nuevo vinculado a `Contrato`) no tiene service ni controller. No activar en PR3 — consolidar en PR4/PR5.

---

## PR3 Fase 3 / PR4 — Frontend cutover + DELETE ExpedienteDoc

Estado:

✅ COMPLETADA

Commit:

83819f3

### Archivos creados

- `apps/api/src/expediente-docs/expediente-docs.service.ts` — método `remove(tenantId, id)` (patrón `findOne → delete`).
- `apps/api/src/expediente-docs/expediente-docs.controller.ts` — endpoint `DELETE /expediente-docs/:id`.
- `apps/web/src/app/api/employees/[id]/expediente/route.ts` — BFF GET.
- `apps/web/src/app/api/expediente-docs/[id]/route.ts` — BFF DELETE.
- `apps/web/src/features/expediente-docs/services/expediente-docs-api.ts` — tipos `ExpedienteDoc`, `ExpedienteDocsResponse`; métodos `getByEmployee`, `delete`.
- `apps/web/src/features/expediente-docs/hooks/use-expediente-docs.ts` — `useExpedienteDocs`, `useDeleteExpedienteDoc`.

### Archivos modificados

- `apps/web/src/app/(app)/empleados/[id]/expediente/page.tsx` — migrado a `useExpedienteDocs`; `CATEGORY_LABELS` y `categoryBadge` actualizados a `ExpedienteCategoria`; stats con claves `CONTRATO`/`CERTIFICADO`.

### Invariantes mantenidos

- Endpoints legacy (`GET /employees/:id/files`, `DELETE /employee-files/:id`) intactos.
- Dual-write sin cambios — `GeneratedDocumentsService` sigue escribiendo a ambas tablas.
- `EmployeeFile` sin cambios de schema ni de tabla.
- `features/employee-files/` (hooks + service) huérfana — sin importadores desde este PR.

### Resultados verificados

- `prisma generate`: OK.
- `tsc --noEmit` API: 0 errores.
- `tsc --noEmit` Web: 0 errores.
- `nest build`: OK.
- `next build`: OK — 52 páginas, 0 errores (2 warnings pre-existentes de `<img>` en `/configuracion/identidad`, fuera de scope).
- Confirmado: `alertas/page.tsx` maneja `expedienteDocId = null` con `??` sin crash.

---

## PR5 — Retiro de consumidores activos de EmployeeFile

Estado:

⏳ Pendiente

Objetivo:

Eliminar todas las escrituras y lecturas activas a `EmployeeFile`. Dejar la tabla vacía e ignorada sin tocar el schema.

### Dependencias activas a eliminar

| Elemento                               | Acción                                                                                                                                   |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `GeneratedDocumentsService` dual-write | Eliminar llamada a `employeeFilesService.createFromGeneratedDoc()`. Eliminar inyección de `EmployeeFilesService` y su import del módulo. |
| `AlertsService.findAll/findOne`        | Eliminar `include: { employeeFile: ... }`. Alertas históricas con `employeeFileId` perderán el link visual — aceptable.                  |
| `CreateAlertDto.employeeFileId`        | Eliminar el campo — ningún servicio lo popula desde PR3 F2.                                                                              |
| `alertas/page.tsx`                     | Simplificar `(alert.expedienteDoc ?? alert.employeeFile)` → `alert.expedienteDoc`.                                                       |
| `alerts-api.ts` (web)                  | Eliminar `employeeFileId` y `employeeFile` del tipo `Alert`.                                                                             |
| `features/employee-files/` (web)       | Eliminar directorio completo — ya huérfano.                                                                                              |
| BFF routes legacy                      | Eliminar `app/api/employees/[id]/files/route.ts` y `app/api/employee-files/[id]/route.ts`.                                               |
| `EmployeeFilesController`              | Eliminar de su módulo (o vaciar el módulo para PR6).                                                                                     |

### No tocar en PR5

Schema de Prisma, tabla `employee_files`, `EmployeeFilesService`.

### Condición de entrada

Verificar 24–48h sin tráfico a `GET /api/employees/:id/files` y `DELETE /api/employee-files/:id` en logs.

---

## PR6 — Eliminación destructiva de EmployeeFile

Estado:

⏳ Pendiente

Condición de entrada:

PR5 en producción. `SELECT COUNT(*) FROM employee_files` confirma que no hay registros nuevos post-PR5 (dual-write apagado). Backup verificado.

### Alcance

- Schema: eliminar `model EmployeeFile`, `enum EmployeeFileCategory`.
- Schema: eliminar campo `Alert.employeeFileId` / relación `Alert.employeeFile`.
- Schema: eliminar relaciones `employeeFiles EmployeeFile[]` de `GeneratedDocument`, `Empleado`.
- Migración: `DROP TABLE employee_files` + `DROP TYPE "EmployeeFileCategory"` + `ALTER TABLE alerts_new DROP CONSTRAINT ... DROP COLUMN employeeFileId`.
- NestJS: eliminar `apps/api/src/employee-files/` completo.
- `app.module.ts`: eliminar `EmployeeFilesModule`.

### Criterio exacto de cierre

1. `SELECT COUNT(*) FROM employee_files` = mismo valor que fin de PR5 (sin inserts nuevos).
2. Decidir si alertas con `employeeFileId IS NOT NULL` son descartables o requieren migración de campo.
3. Sin tráfico en logs a rutas legacy (24–48h post-PR5).
4. `tsc --noEmit` y `next build` sin referencias a `EmployeeFile`.
5. `prisma migrate status` limpio antes de ejecutar la migración destructiva.

---

## Decisiones arquitectónicas — ExpedienteDoc Consolidation

### ExpedienteDoc es el modelo oficial

Toda nueva funcionalidad de expediente digital debe construirse sobre `ExpedienteDoc`.

No desarrollar nuevas funcionalidades sobre `EmployeeFile`.

### Dual-write es la estrategia de transición

Durante PR3–PR4, toda escritura nueva cae en ambas tablas. `ExpedienteDoc` es la fuente de verdad para lecturas desde PR4. `EmployeeFile` sigue recibiendo escrituras por dual-write hasta PR5. Si el write a `ExpedienteDoc` falla, no interrumpe el flujo.

### Sin feature flags

El volumen de datos (dev: 1 fila) no justifica flags de activación. La reversibilidad se garantiza a nivel de código.

### `tamanoBytes = 0` para PDFs generados

El tamaño real requiere leer el archivo desde el filesystem o R2. Diferido a PR4 cuando haya almacenamiento real.

### Retiro de EmployeeFile en dos fases

PR5 apaga lecturas y escrituras activas sin tocar el schema. PR6 ejecuta `DROP TABLE employee_files` solo después de confirmar ausencia de tráfico y datos nuevos post-PR5.

---

## Estado de rama relacionada — feat/phase-5c-sede-employee-integration

Estado:

⚠️ No mergeada — requiere atención

Problema:

- Añade `sedeId String?` y `sedeRef Sede?` a `Empleado` en `schema.prisma`.
- Falta migración (`prisma migrate dev --name add_sede_to_empleados`).
- Falta `prisma generate` — cliente Prisma no regenerado.
- Resultado: 7 errores de TypeScript (`sedeRef` doesn't exist in `EmpleadoInclude<DefaultArgs>`).

Impacto en `feat/expedientedoc-consolidation`:

Ninguno — ramas independientes.

Acción requerida (fuera del alcance de ExpedienteDoc Consolidation):

Crear migración, ejecutar `prisma generate`, verificar typecheck, decidir si mergear.

---

# <a name="roadmap-futuro"></a>Roadmap Futuro

Módulos planificados:

- Nómina electrónica.
- Facturación electrónica.
- Gestión financiera.
- Alertas avanzadas.
- Gestión documental avanzada.
- Multiempresa avanzado.
- Multisede avanzado.

Importante:

Las capacidades futuras NO deben introducir sobreingeniería temprana.

Se implementarán únicamente cuando exista una necesidad real de negocio.

---

# <a name="forma-de-trabajo"></a>Forma de Trabajo

ChatGPT:

- Arquitectura.
- Auditorías.
- Diseño.
- Priorización.
- Revisión técnica.
- Generación de prompts para Claude.

Claude:

- Implementación.
- Refactors.
- Migraciones.
- Walkthroughs técnicos.

Regla principal:

Primero arquitectura.

Luego planificación.

Luego implementación.

Nunca al revés.
