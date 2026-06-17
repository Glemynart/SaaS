# <a name="project_state.md"></a>PROJECT_STATE.md

# <a name="la-oficina-nítida"></a>La Oficina Nítida

## Última actualización: FASE 7B.1 — Email Infrastructure MVP

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

EmployeeFile es considerado legado.

No desarrollar nuevas funcionalidades sobre EmployeeFile.

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

🟡 Implementada

Rama:

feat/email-infrastructure

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

Commit:

b4647d5

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
