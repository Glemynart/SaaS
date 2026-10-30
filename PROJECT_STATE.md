# <a name="project_state.md"></a>PROJECT_STATE.md

# <a name="la-oficina-nítida"></a>La Oficina Nítida

## Última actualización: GOAL-02 activo; GOAL-01 pausado; auditoría financiera iniciada (2026-10-30)

> Este documento registra contexto y evidencia histórica. No prueba que una capacidad exista o esté terminada. Toda afirmación debe contrastarse con el código y con el recorrido end-to-end. Ver [`docs/goals/README.md`](docs/goals/README.md).

> **Estado vigente desde 2026-10-30:** GOAL-02 es el único Goal activo por
> decisión explícita del usuario. GOAL-01 está pausado, no cerrado; sus ramas,
> PR, documentos y pendientes se conservan. Las menciones de GOAL-01 activo en
> los snapshots siguientes corresponden a evidencia hasta 2026-10-29.

# <a name="descripción-del-producto"></a>Descripción del producto

La Oficina Nítida es un SaaS orientado inicialmente a operadores educativos colombianos.

El objetivo es centralizar:

- Gestión de empleados.
- Contratación laboral.
- Expedientes digitales.
- Alertas.
- Generación documental.
- Certificaciones laborales.
- Gestión multisede.
- Operación interna de nómina.
- Facturación interna.
- Contabilidad y Ledger.
- Nómina electrónica y facturación electrónica DIAN (capacidades regulatorias futuras; aún no se transmiten).

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

La demostración financiera puede mostrar nómina operativa, facturación interna
y contabilidad integrada. Esto no equivale a transmitir nómina electrónica a
UGPP ni facturas electrónicas a DIAN; esas capacidades siguen pendientes de
integración y validación regulatoria conforme a GOAL-02.

La propuesta de valor en evolución es centralizar y conectar la gestión laboral,
documental y financiera de operadores educativos colombianos.

## Investigación de posicionamiento y branding

La investigación de branding quedó cerrada el 2026-08-03. `La Oficina Nítida`
continúa siendo un nombre de trabajo; no existe una marca comercial aprobada.
El posicionamiento y los territorios conceptuales conservados están documentados
en [`docs/branding/BRAND-POSITIONING-AND-TERRITORIES.md`](docs/branding/BRAND-POSITIONING-AND-TERRITORIES.md).

Esta decisión no redefine GOAL-01, no cambia el roadmap, no crea una Epic y no
autoriza nuevas generaciones de nombres.

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

- Renderizado PDF con Puppeteer.
- Almacenamiento local o Cloudflare R2 configurable mediante el proveedor de storage.
- Nodemailer hacia OCI SMTP para correo transaccional, con modo degradado cuando no está configurado.

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

# <a name="estado-operativo-goal-01"></a>Snapshot histórico de GOAL-01 al 2026-10-29

- **GOAL-01 en esa fecha:** `ACTIVO`; desde el 2026-10-30 está `PAUSADO`.
- **Implementación:** `BLOQUEADA SELECTIVAMENTE` por M1/M7 y correo real en
  M2; esto no equivale a bloquear el Goal.
- **Arquitectura y preparación:** `DISPONIBLE` mediante
  [`Platform Evolution`](docs/architecture/PLATFORM-EVOLUTION.md).

La metodología permite continuar con arquitectura, planificación,
investigación y preparación mientras una ruta de implementación espera una
dependencia externa. GOAL-01 solo podrá pasar a `BLOQUEADO` cuando una
auditoría demuestre que no existe ninguna actividad útil en esas categorías ni
en implementación.

La regla vigente distingue explícitamente el estado del Goal del estado de sus
rutas: `GOAL ACTIVO`, `IMPLEMENTACIÓN BLOQUEADA` y `ARQUITECTURA DISPONIBLE`.
Un Milestone bloqueado por infraestructura no bloquea el Goal completo. La
auditoría debe revisar todos los Milestones, Epics, ADRs y actividades de
arquitectura, planificación, investigación y preparación antes de declarar
`GOAL BLOQUEADO`.

La auditoría de negocio determinó que E7.3 no es necesaria para tener operando al
primer cliente: captura prospectos antes del tenant y no participa en el
onboarding ni en el recorrido laboral-documental. ADR-008 fue aceptado como
referencia de Platform Evolution; E7.3 queda fuera de GOAL-01 y no se implementó
código.

# <a name="estado-general-del-proyecto"></a>Estado General del Proyecto

## Estado de E2.4, E5.2, E5.3, E5.4, E6.1, E6.2 y E6.3

E5.2 fue fusionada en el PR #102, con familias documentales explícitas,
revisiones append-only, consulta tenant-scoped, descarga autenticada e
historial v1/v2. Sus checks post-merge de CI y Browser E2E están verdes.

E5.3 fue fusionada en el PR #103. Las publicaciones del expediente son
append-only: no se pueden eliminar documentos generados ni manuales; las rutas
de lectura, detalle e historial exigen `ADMIN`/`OPERADOR`, y la UI ya no ofrece
una acción destructiva. Sus checks post-merge de CI y Browser E2E están verdes.
E5.4 fue fusionada en el PR #104. Las descargas directas desde el expediente
registran el actor, tenant, familia, versión, categoría y origen documental
después de leer exitosamente el objeto. La integración de contratos y
certificaciones continúa usando la publicación documental común y sus eventos
de auditoría. Sus checks post-merge de CI y Browser E2E están verdes.

E6.1 fue fusionada en el PR #105. El API ejecuta diariamente, a las 02:00,
la generación de alertas de contratos por vencer y empleados sin contrato para
tenants activos. La ejecución usa el contexto tenant-aware, una transacción
PostgreSQL y un advisory lock para evitar concurrencia entre instancias. Sus
checks post-merge de CI y Browser E2E están verdes. E6.2 fue fusionada en el PR
#106: la resolución de alertas conserva actor, fecha y evento de auditoría en
una transacción y su Browser E2E está verde. ADR-007 fue aprobado y fusionado
en el PR #107; E6.3 fue fusionada en el PR #108 con checks post-merge de CI y
Browser E2E verdes, y M6 queda completado.
E2.4 fue fusionada en el PR #110 con checks post-merge de CI y Browser E2E
verdes; sus sedes, identidad corporativa y promesa multiempresa quedaron
alineadas con el aislamiento por tenant.

Estado actual:

🟡 Plataforma con capacidades base avanzadas, todavía sin operación comercial end-to-end verificada.

Goal activo desde el 2026-10-30:

- 🟡 GOAL-02 activo — evolución financiera y cumplimiento electrónico, con primer foco en flujos internos demostrables de nómina, facturación y contabilidad. El backlog vigente está en [`docs/goals/GOAL-02-backlog.md`](docs/goals/GOAL-02-backlog.md).

- GOAL-01 está pausado y conserva pendientes de aceptación operativa, correo y despliegue en [`GOAL-01 — Primer Cliente Operando`](docs/goals/GOAL-01-primer-cliente-operando.md).

La auditoría de código confirmó empleados, sedes, autenticación, documentos, certificaciones, seguridad y motores internos importantes. E2.4 quedó cerrada con sedes, identidad corporativa y promesa pública alineada con el aislamiento por tenant. Permanecen pendientes la aceptación operacional de invitaciones por correo, la recuperación real, el deployment reproducible y Go Live.

Hitos recientes fusionados a `main`:

- ✅ Security Hardening v3.
- ✅ Security Hardening v2 — PR #64.
- ✅ Accounting v1.
- ✅ Fase 6C — Contratos Documentales — PR #65.
- ✅ Fase 7 — Certificaciones Laborales — PR #67.
- ✅ Contratación Inteligente PR11.1/PR11.2 — PR #76; E4.2/PR11.3 fusionada en PR #90 y verificada.
- ✅ E1.2 — Migraciones, seed y rol PostgreSQL runtime no privilegiado — PR #79.
- 🟡 E1.3 — R2, correo real y health/readiness checks — PR #80 fusionada; validación real de staging pendiente.
- ✅ E1.4 — CI, observabilidad y base de pruebas browser end-to-end — PR #81 fusionada, checks verdes y auditoría `APROBADO PARA MERGE`; M1 sigue pendiente de la evidencia operativa de E1.1/E1.3.
- ✅ E3.1 — Empleados CRUD, búsqueda e importación XLSX — PR #83 fusionada y verificada browser; no depende de staging, R2, correo ni E3.2.
- ✅ E3.2 — Perfiles contractuales y vínculos laborales precontractuales — PR #84 fusionada y verificada por CI/Browser E2E; usa las bases backend existentes y no depende de staging, R2, correo ni E3.3.
- ✅ E3.3 — Configuración perfil → tipo documental → plantilla — PR #86 fusionada y verificada por CI/Browser E2E post-merge.
- ✅ E3.4 — Feedback accionable para errores, bloqueos y reintentos — PR #88 fusionada y verificada por CI/Browser E2E post-merge.
- ✅ E4.1 — Creación, preview y confirmación total/parcial desde frontend — PR #89 fusionada y verificada por CI/Browser E2E post-merge.
- ✅ E4.2 — Procesamiento de planes confirmados y exclusiones — PR #90 fusionada y verificada por CI/Browser E2E.

- ✅ E4.3 — Perfil y snapshots confirmados preservados en contrato y documento — PR #92 fusionada y verificada.
- ✅ E4.4 — PDF canónico vinculado al contrato y publicado en expediente — PR #93 fusionada y verificada por CI/Browser E2E post-merge.
- ✅ E4.6 — Contratación individual completa como flujo alternativo — PR #94 fusionada y verificada por CI/Browser E2E post-merge.
- ✅ E5.1 — Subida manual y validación de archivos — PR #95 fusionada y verificada por CI/Browser E2E; independiente de M1.
- ✅ E5.2 — Familias documentales, revisiones, consulta, descarga e historial — PR #102 fusionada y verificada por CI/Browser E2E.
- ✅ E5.3 — Inmutabilidad de documentos publicados y permisos por rol — PR #103 fusionada y verificada por CI/Browser E2E.
- ✅ E5.4 — Auditoría de descargas e integración documental — PR #104 fusionada y verificada por CI/Browser E2E; M5 queda completado.
- ✅ E6.1 — Scheduler de vencimientos y documentos faltantes — PR #105 fusionada y verificada por CI/Browser E2E.
- ✅ E6.2 — Dashboard accionable y resolución trazable — PR #106 fusionada y verificada por CI/Browser E2E.
- ✅ E6.3 — Fallos, reintentos y auditoría visibles para operación — PR #108 fusionada y verificada por CI/Browser E2E; M6 queda completado.
- ✅ E2.4 — Sedes, identidad y promesa multiempresa coherente con el producto real — PR #110 fusionada y verificada por CI/Browser E2E; no depende de staging ni correo real.
- ✅ E2.1 — Gestión directa de usuarios — PR #96 fusionada y verificada por CI/Browser E2E; las invitaciones quedan separadas por su dependencia de correo real.
- ✅ E4.5 — Reintentos selectivos, idempotencia y errores parciales — PR #97 fusionada y verificada por CI/Browser E2E; no dependía de staging, R2, DNS, correo ni una decisión nueva de dominio.
- ✅ E4.7 — Prueba browser del caso exitoso, parcial y reintentado — PR #99 fusionada y verificada por CI/Browser E2E; no depende de M1.
- ✅ E4.4 — Idempotencia de generación PDF LETTER/MEMO y reintentos — PR #134 fusionada; CI y Browser E2E post-merge verdes.
- ✅ E4.1 — Selección completa y paginada de empleados para lotes — PR #140 fusionada; CI y Browser E2E post-merge verdes.

La comprobación externa de solo lectura del 2026-10-29 obtuvo HTTP 200 en `https://staging.dusema.com` y en `/health` y `/readiness` de `staging-api.dusema.com`. Readiness reportó database, storage y email `up`; el check de email sólo acredita transporte configurado y el de storage no identifica el proveedor. No se verificaron entrega de correo, R2, despliegue reproducible ni rollback, así que E1.1/E1.3 seguían abiertas y M1 `BLOQUEADO POR INFRAESTRUCTURA EXTERNA`. En ese snapshot GOAL-01 permanecía activo; desde 2026-10-30 está pausado y GOAL-02 es el Goal activo. E2.1, E2.4, E4.2, E4.3, E4.4, E4.5, E4.6, E4.7, E5.1, E5.2, E5.3, E5.4, E6.1, E6.2 y E6.3 quedaron fusionadas por caminos independientes. El checklist operativo de M1 está en [`docs/goals/GOAL-01-M1-infrastructure-checklist.md`](docs/goals/GOAL-01-M1-infrastructure-checklist.md).
La inspección de solo lectura registrada en PR #124 encontró que la API llamada staging compartía la VPS y la base `oficina_nitida` clasificadas como producción y usaba storage local; el Compose activo no coincidía con el versionado. PR #124 prepara el proyecto Compose aislado, exige las cuatro variables R2 y `REQUIRE_REAL_EMAIL=true`, y valida el bootstrap PostgreSQL en un servicio efímero de CI. La base, el rol, las ACL, el alias DNS, R2, el correo y el despliegue activo no se modificaron; la revisión DBA y la validación operativa siguen pendientes.

E4.2 quedó fusionada y verificada en `main` mediante PR #90. M3 está completado y
M4 tiene E4.1, E4.2, E4.3, E4.4, E4.5, E4.6 y E4.7 entregadas; E4.7 cerró la evidencia browser separada con PR #99.
E5.1 quedó fusionada en PR #95. El procesamiento usa planes ya confirmados
desde PostgreSQL, respeta las exclusiones
persistidas y usa la abstracción de storage existente. Su validación local no
requiere staging ni un proveedor R2 concreto.

## <a name="goal-01-current-decision"></a>GOAL-01 — Decisión de prioridad vigente

Tras fusionar E4.3 en PR #92, E4.4 en PR #93, E5.1 en PR #95, E2.1 en PR #96,
E4.5 en PR #97, E4.7 en PR #99, ADR-006 en PR #101, E5.2 en PR #102, E5.3 en
PR #103, E5.4 en PR #104, E6.1 en PR #105, E6.2 en PR #106, ADR-007 en PR
#107 y E2.4 en PR #110, la revisión del código y del grafo de dependencias mantiene M1
`BLOQUEADO POR INFRAESTRUCTURA EXTERNA`; en este snapshot del 2026-10-29 GOAL-01 permanecía `ACTIVO`.
M5 queda completado con E5.1, E5.2, E5.3 y E5.4. M6 queda completado con E6.1,
E6.2 y E6.3 fusionadas; M2 queda parcial con E2.1 y E2.4 cerradas, mientras
E2.2 y E2.3 siguen dependiendo del correo real. ADR-007 está aprobado y gobierna
la operación del scheduler implementada en E6.3.

La revisión de dependencias de E4.2 concluyó:

- dominio: consume el modelo y las decisiones ya aprobadas de lote, perfil,
  configuración, contrato y snapshot; no introduce una decisión nueva;
- DNS, Cloudflare y OCI Email Delivery: no son usados por el motor de procesamiento;
- R2: no es una dependencia específica; el código depende de `StorageService`, cuyo
  proveedor local es el predeterminado y cuyo adaptador R2 es intercambiable;
- staging y variables de producción: no son necesarios para implementar ni probar
  la selección de planes confirmados y exclusiones.

La inconsistencia encontrada en `main` era que una campaña inteligente se crea sin
`documentTemplateId`, pero `LoteEngineService` la rechazaba antes de consultar sus
planes. Además, recorría todos los empleados seleccionados y podía crear contratos
para empleados guardados como exclusiones. E4.2 corrige únicamente esas dos
rupturas: usa los planes `CONFIRMADO`/`CONSUMIDO` como objetivos efectivos y deja
fuera las exclusiones; el flujo manual permanece sin cambios.

E4.7 quedó fusionada en PR #99. La revisión del código confirma que su alcance fue
evidencia browser de los casos exitoso, parcial y reintentado sobre el flujo de
lotes ya fusionado. No requirió dominio, DNS, Cloudflare, R2, OCI Email Delivery,
variables de producción ni staging. La semántica de versionado e inmutabilidad
quedó aprobada en ADR-006; E5.2, E5.3 y E5.4 ya están fusionadas. M7 queda
reservado para el cierre final de despliegue y Go Live.

La auditoría end-to-end del flujo de contratación encontró que los lotes
aplicaban una sede común y no permitían distinguir contratos de años distintos.
La PR #149 quedó fusionada en `main` con el commit `9594d321`. Corrige el flujo
con sede activa por empleado e integridad de un contrato por empleado y año.
Las 132 pruebas API dirigidas y el Browser E2E con rol PostgreSQL runtime sin
`SUPERUSER` ni `BYPASSRLS` pasaron localmente; CI, Browser E2E y la publicación
de la imagen API pasaron tanto en el PR como post-merge en `main`. Esta corrección
resuelve el bug de E4.1, pero no cierra M4 ni GOAL-01 por sí sola.

## <a name="landing-saas"></a>Landing SaaS

Estado:

✅ Superficie informativa completada; captura real de prospectos pendiente fuera
de GOAL-01.

Objetivo de la superficie actual:

- Presentación del producto.
- Solicitud de demo simulada.
- SEO.

La landing y el formulario de demo pertenecen al canal de adquisición comercial,
no al resultado mínimo de GOAL-01. La captura real de prospectos queda en
Platform Evolution bajo ADR-008; el formulario actual continúa siendo una
superficie demostrativa hasta que esa iniciativa sea priorizada.

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

`EmployeeFile` fue eliminado definitivamente en PR6B (2026-06-18). `ExpedienteDoc` es el modelo oficial y único. No existen referencias residuales al modelo legado.

Convención oficial de `storageKey`:

```
{tenantId}/expediente/{empleadoId}/{categoria}/{id}_v{version}.{ext}
```

Esta convención aplica a archivos subidos manualmente. Para PDFs generados,
`GeneratedDocument.pdfStorageKey` es la clave canónica
`pdfs/{tenantId}-{generatedDocumentId}.pdf`; `ExpedienteDoc.storageKey` debe
referenciar exactamente el mismo objeto.

El PR #123 también propaga a `ExpedienteDoc.tamanoBytes` el tamaño devuelto por
el proveedor de almacenamiento junto con esa clave.

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

✅ COMPLETADA (FASES 6A, 6B y 6C)

Objetivo:

Implementar la gestión contractual completa para operadores educativos colombianos.

---

## Contexto

El modelo Contrato ya existía en Prisma desde fases anteriores.

Durante FASE 6 se completó la construcción del módulo funcional de contratos y su pipeline documental.

La implementación se completó en Backend Core, Frontend Core y capacidades documentales.

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

✅ Completada

Auditoría final:

APPROVE

Objetivo:

Incorporar generación documental asociada a contratos.

Implementado:

- Pipeline único CONTRACT.
- Snapshot contractual.
- Publicación idempotente.
- Materialización PDF canónica.
- `ExpedienteDoc` como índice.
- Protección de concurrencia.
- Inmutabilidad CONTRACT.
- Renderer endurecido.

Fuera de alcance:

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

# FASE 7 — Certificaciones Laborales

Estado:

✅ COMPLETADA

Referencia:

- PR #67 — merge commit `e745c19` (2026-07-28).
- Rama de implementación: `initiative/labor-certificates` (eliminada tras el merge).

## Objetivo

Permitir la emisión, publicación, consulta y descarga de certificaciones laborales sin crear un agregado de dominio adicional ni un pipeline documental paralelo.

## Arquitectura aprobada

Flujo único:

Empleado → DocumentTemplate (`CERTIFICATION`) → GeneratedDocument → PDF canónico → ExpedienteDoc

- `GeneratedDocument` es la identidad de cada emisión.
- `contenidoFinal` es el único snapshot canónico; no existe snapshot estructurado paralelo.
- Cada solicitud explícita crea un nuevo `GeneratedDocument`.
- Un reintento técnico reutiliza el mismo documento y el mismo PDF lógico.
- `ExpedienteDoc` actúa exclusivamente como índice del PDF publicado, con categoría `CERTIFICADO`.

## Resultado

Implementado:

- Infraestructura `CERTIFICATION` compatible con `CONTRACT`.
- Emisión auditada con resolución completa de variables antes de persistir.
- Materialización PDF canónica e idempotente desde `contenidoFinal`.
- Publicación transaccional e idempotente en `ExpedienteDoc`.
- Inmutabilidad de certificaciones ya publicadas.
- UI integrada en la ficha del empleado, documentos generados y expediente digital.
- Consulta y descarga mediante las superficies documentales existentes.

Validación de cierre:

- API: 62 suites y 712 pruebas PASS.
- Typecheck API y frontend PASS.
- Prisma validate PASS.
- Auditoría de aceptación Fase 7: APPROVE.

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

✅ COMPLETED (2026-06-18)

Rama:

feat/expedientedoc-consolidation

Objetivo:

Migrar el expediente digital de empleados desde EmployeeFile (legado) hacia ExpedienteDoc (nuevo), preservando todos los datos existentes y manteniendo el sistema operativo durante la transición.

Estrategia aplicada:

Dual-write + lectura paralela + retiro gradual. Completado en 6 PRs: backfill, dual-write, cutover frontend, retiro de consumidores, atomicidad de `generatePdf()`, y DROP destructivo final.

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

# FASE 7C — Password Reset Frontend (F3 · AUTH-EXPERIENCE M2)

Estado:

✅ COMPLETADA

Rama:

feat/f3-password-recovery (mergeada — PR #51, merge commit e700e0c)

Objetivo:

Implementar la experiencia de recuperación (`/recuperar`) y restablecimiento (`/restablecer`) de contraseña sobre el backend 7A existente, cerrando el vacío de frontend (no había ruta ni enlace desde el login). Alcance limitado a `apps/web`; cero endpoints backend nuevos.

Implementado:

- Ruta `/recuperar` (`RecoverForm`): estados por defecto · enviando · confirmación (AX-D7) · error de red. Confirmación genérica idéntica exista o no la cuenta (anti-enumeración §9.3), anunciada con `role=status`.
- Ruta `/restablecer` (`ResetForm`): estados por defecto · enviando · éxito → `/login?reset=1` · enlace vencido (§7.3) · error de red. Aviso permanente de revocación de sesiones (§7.0b, token `--info`).
- Alias `/reset-password` → `/restablecer` preservando el token (el correo de 7A enlaza a `/reset-password`; ruta canónica del documento es `/restablecer`). Sin tocar el backend.
- Proxies BFF `/api/auth/forgot-password` y `/api/auth/reset-password` (patrón de `register/route.ts`).
- `auth-client` (`forgotPassword`/`resetPassword`), hooks (`useForgotPassword`/`useResetPassword`), esquemas zod, tipos y microcopy §10 centralizado.
- Login (aditivo, sin cambio de comportamiento): enlace «¿Olvidaste tu contraseña?» (AX-D4) + aviso de éxito `?reset=1` (§5.3).
- Reutilización total de primitivas existentes; cero componentes nuevos de Design System.

Decisiones aprobadas:

- Rutas canónicas del documento (`/recuperar`, `/restablecer`) + alias `/reset-password` para compatibilidad con el enlace que emite el correo del backend.
- Enlace AX-D4 y aviso `?reset=1` en login incluidos (aditivos) para cumplir el criterio de aceptación #1 de AUTH-EXPERIENCE.

Limitación conocida:

- El backend actual no expone un endpoint para validar el token antes de mostrar el formulario. Un token ausente muestra el estado terminal de inmediato; un token vencido/usado/corrupto se detecta al enviar la nueva contraseña, momento en que la pantalla conmuta al estado de enlace no válido (§7.3). No se implementó workaround.

Verificación:

- `tsc --noEmit` Web: 0 errores.
- `next build`: OK — rutas `/recuperar`, `/restablecer`, `/reset-password` compilan y renderizan.
- Lint DS §5 verde vía lint-staged en cada commit; `code-quality-review` sin hallazgos críticos/altos.

---

## PR5 — Retiro de consumidores activos de EmployeeFile

Estado:

✅ COMPLETADA

Commit:

91af667

### Implementado

- `GeneratedDocumentsService`: dual-write eliminado. `ExpedienteDoc` es el único destino. `EmployeeFilesService` desacoplado del módulo.
- `AlertsService.findAll/findOne`: `include: { employeeFile }` eliminado. Alertas históricas con `employeeFileId` no rompen — campo existe en BD pero no se lee.
- `CreateAlertDto.employeeFileId`: campo eliminado.
- `alertas/page.tsx`: fallback simplificado → solo `alert.expedienteDoc`.
- `alerts-api.ts` (web): `employeeFileId` y `employeeFile` eliminados del tipo `AlertItem`.
- `features/employee-files/` (web): directorio eliminado (era huérfano desde PR4).
- BFF routes legacy eliminados: `app/api/employees/[id]/files/route.ts` y `app/api/employee-files/[id]/route.ts`.

### No tocado (para PR6)

Schema Prisma, tabla `employee_files`, `EmployeeFilesModule`, `EmployeeFilesController`, `EmployeeFilesService`.

### Resultados de validación (2026-06-18)

- `prisma generate`: OK.
- `tsc --noEmit` API: 0 errores.
- `tsc --noEmit` Web: 0 errores.
- `nest build`: OK.
- `next build`: OK — 52+ páginas. `/api/employees/[id]/files` y `/api/employee-files/[id]` AUSENTES del route map. `/api/employees/[id]/expediente` y `/api/expediente-docs/[id]` PRESENTES.
- `employee_files` count: 2 (backfill PR2, sin nuevas inserciones).
- `expediente_docs` count: 2 (espejo exacto).
- Referencias web a `EmployeeFile`: cero en `.ts` y `.tsx`.
- Referencias API a `EmployeeFile`: solo dentro de `apps/api/src/employee-files/` (código muerto para PR6) y `app.module.ts`.

### Incidente documentado

`Remove-Item` de PowerShell interpretó `[id]` como wildcard — la ruta `/api/employees/[id]/files` fue eliminada con `rm` de Bash.

### Deuda técnica identificada (para PR6)

- `generatePdf()` sin transacción: `pdfUrl` se persiste antes de `expedienteDoc.create()`. Si el insert falla, estado semi-comprometido (PDF en disco + pdfUrl en DB, sin fila en `expediente_docs`). Fix: envolver ambas operaciones en `prisma.$transaction`.
- Decisión pendiente: alertas históricas con `employeeFileId IS NOT NULL` — ¿migrar a `expedienteDocId` o descartar?

### Veredicto de validación

**PR5 APROBADO CON OBSERVACIONES** — observaciones son deuda pre-existente, no regresiones introducidas en PR5.

---

## PR6A — Atomicidad de generatePdf()

Estado:

✅ COMPLETADA

Objetivo:

Eliminar la ventana de half-commit en `generatePdf()`: actualmente `generatedDocument.pdfUrl` puede persistirse sin que `expedienteDoc` se cree, dejando estado inconsistente visible al usuario como HTTP 500.

### Diagnóstico

Flujo actual en [generated-documents.service.ts:204](apps/api/src/generated-documents/generated-documents.service.ts):

1. #1–#8: Lecturas DB, generación HTML, puppeteer, escritura PDF a disco — **fuera del alcance transaccional** (procesos externos + filesystem).
2. #9: `generatedDocument.update({ pdfUrl })` — **write DB #1**.
3. #10: `expedienteDoc.create()` via `createFromGeneratedDoc()` — **write DB #2**.
4. #11: `auditService.log()` — fire-and-forget, fuera por diseño.

**Ventana de fallo**: si #10 lanza tras completar #9, `pdfUrl` queda persistida sin `expedienteDoc`. El PDF existe en disco pero nunca aparece en el expediente del empleado.

### Decisión arquitectónica

Envolver únicamente #9 y #10 en `prisma.$transaction`. El PDF (puppeteer/fs) permanece **antes** de la transacción — no es transaccionable por Prisma.

Peor caso residual post-fix: PDF escrito en disco + transacción fallida → DB consistente (sin `pdfUrl`, sin `expedienteDoc`) + archivo huérfano en disco. Archivo inofensivo: filename determinista (`${tenantId}-${id}.pdf`), retry sobreescribe.

### Archivos a modificar

| Archivo                                                           | Cambio                                                                                                         |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/generated-documents/generated-documents.service.ts` | Envolver #9–#10 en `$transaction(async (tx) => {...})`. Audit log fuera.                                       |
| `apps/api/src/expediente-docs/expediente-docs.service.ts`         | `createFromGeneratedDoc` acepta `tx: Prisma.TransactionClient = this.prisma`. Usa `tx.expedienteDoc.create()`. |

Sin cambios de schema. Sin migración. **PR6A es 100% code-only.**

### Riesgos

- **R1** (baja): Archivo huérfano en disco si la transacción falla. Aceptado — filename determinista, retry sobreescribe.
- **R2** (alta si se comete en implementación): `createFromGeneratedDoc` usa `this.prisma` en vez de `tx` — el insert escapa de la transacción y el half-commit reaparece. Punto #1 de code review.
- **R3** (fuera de scope): Duplicado de `expedienteDoc` si `generatePdf` se re-ejecuta sobre un doc que ya tuvo éxito — requiere `@@unique` sobre `generatedDocumentId`, colisiona con PR6. Documentado, no resuelto en PR6A.

### Smoke tests requeridos

| ID    | Test                                                             | Resultado esperado                                                     |
| ----- | ---------------------------------------------------------------- | ---------------------------------------------------------------------- |
| ST-1  | Happy path: generar PDF real                                     | 200; `pdfUrl` poblado; `expediente_docs` +1                            |
| ST-2  | Fault injection: throw dentro de la transacción tras el `update` | `pdfUrl` **NO** persiste; `expediente_docs` sin cambio; DB consistente |
| ST-3  | Retry tras ST-2                                                  | Éxito; un solo `expedienteDoc`; sin duplicado                          |
| ST-4  | Code review                                                      | Puppeteer/fs antes del `$transaction`                                  |
| Gates | `tsc --noEmit` API + `nest build`                                | Verde                                                                  |

### Criterio de cierre

1. `update(pdfUrl)` y `expedienteDoc.create()` dentro del mismo `$transaction`.
2. `createFromGeneratedDoc` usa `tx`, no `this.prisma`.
3. ST-1, ST-2, ST-3 PASS — especialmente ST-2 demostrando rollback de `pdfUrl`.
4. `tsc --noEmit` API + `nest build` verdes.
5. Sin schema changes ni migración.

### Rollback

`git revert` del commit. Sin datos que restaurar ni schema que revertir.

---

## PR6B — Eliminación destructiva de EmployeeFile

Estado:

✅ COMPLETADA (2026-06-18) — Commit: 97e9a1c

### Implementado

- Migración `20260618000001_drop_employee_files`: DROP FK, DROP COLUMN `employeeFileId` de `alerts_new`, DROP índices, DROP FKs, DROP TABLE `employee_files`, DROP TYPE `EmployeeFileCategory`.
- Schema Prisma: eliminados `model EmployeeFile`, `enum EmployeeFileCategory`, relaciones en Tenant/Empleado/GeneratedDocument/Alert, campos `employeeFileId`/`employeeFile` de Alert.
- NestJS: eliminado directorio `apps/api/src/employee-files/` completo (module, service, controller, DTO).
- `app.module.ts`: eliminados import y registro de `EmployeeFilesModule`.
- `prisma generate`: cliente regenerado sin referencias a `EmployeeFile`.

### Verificaciones de cierre

- `employee_files` table: **no existe**.
- `employeeFileId` en `alerts_new`: **no existe**.
- `EmployeeFileCategory` enum: **no existe**.
- `apps/api/src/employee-files/`: **no existe**.
- Referencias `EmployeeFile` en src/: **cero**.
- `tsc --noEmit`: 0 errores.
- `nest build`: OK.
- `prisma migrate status`: Database schema is up to date (19 migraciones).

---

## Decisiones arquitectónicas — ExpedienteDoc Consolidation

### ExpedienteDoc es el modelo oficial

Toda nueva funcionalidad de expediente digital debe construirse sobre `ExpedienteDoc`.

No desarrollar nuevas funcionalidades sobre `EmployeeFile`.

### ExpedienteDoc es el único destino activo

`EmployeeFile` fue eliminado definitivamente en PR6B. La tabla `employee_files`, el enum `EmployeeFileCategory`, el módulo NestJS y todas las relaciones de schema fueron removidos. No existen referencias residuales.

### Sin feature flags

El volumen de datos no justificó flags de activación. La reversibilidad se garantizó a nivel de código en cada fase.

### Metadata de PDFs generados

Al generar un PDF nuevo, `GeneratedDocument` y `ExpedienteDoc` persisten la
misma clave canónica y el tamaño devueltos por el proveedor de almacenamiento;
no se guarda `tamanoBytes = 0`. La ruta que materializa un PDF cuyo objeto ya
existe puede medirlo mediante una lectura del objeto.

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

# Accounting Module

Objetivo:

Motor contable de partida doble, en causación, append-only, multiempresa. Infraestructura habilitante para Nómina, Facturación Electrónica, Cartera y Tesorería.

Estado:

✅ **Accounting v1 completada y fusionada a `main`** (PR #63, 2026-07-26).

Resumen de cierre:

- Catálogos, Ledger append-only, reporting y cierre contable mensual/anual operativos.
- Causación explícita de nómina y ajustes de corrección integrados mediante el puerto del Ledger.
- Idempotencia, trazabilidad y sincronización transaccional cubiertas, incluidos locks localizados para posting, reversos y cierre de períodos.

## ADR-001 — Accounting Core

Estado:

✅ Aprobado

Documento:

`docs/adr/ADR-001-accounting-core.md`

Decisiones clave:

- Único libro mayor de partida doble en causación.
- Append-only: sin UPDATE/DELETE tras contabilizar.
- Puerto único de entrada (`registrarComprobante`).
- Transacción PostgreSQL síncrona (sin broker, sin outbox, sin consistencia eventual).
- Multimoneda reservada, solo COP en v1.
- Centros de costo planos, sin jerarquía ni prorrateo.

## C0 — Accounting Catalogs

Estado:

✅ COMPLETADA

Rama:

`feat/accounting-c0-catalogs` (mergeada)

Implementado:

- `CuentaContable` (árbol PUC, seed de plantilla global).
- `Tercero` (identidad documental canónica).
- `PeriodoContable` (control de cierre).
- `CentroCosto` (catálogo plano, mapeado 1:1 con Sede).
- `TipoComprobante` (catálogo global).
- `CuentaSistemaMap` (rol → cuenta, desacopla integraciones).
- `AccountingProvisioningService` (clonado de PUC por tenant).
- CRUD completo de catálogos con controllers y DTOs.

## C1.1 — Ledger Core

Estado:

✅ COMPLETADA

Rama:

`feat/accounting-c1-ledger-core` (mergeada — PR #28)

Implementado:

- Schema: `ComprobanteContable`, `MovimientoContable`, `SecuenciaComprobante` + enum `EstadoComprobante`.
- Migración: 4 ajustes manuales (CHECK origen I8, CHECK débito/crédito I4, UNIQUE parcial consecutivo I7, UNIQUE parcial idempotencia I8).
- `LedgerService.registrarComprobante()` — valida I1–I8, asigna consecutivo, persiste en transacción única.
- `LedgerService.anular()` — anulación con período abierto, reverso append-only en período abierto actual con período cerrado.
- 26 unit tests + 13 e2e DB constraint tests.
- Build, typecheck y 343 tests en verde.

## C2 — Reporting

Estado:

✅ COMPLETADA

Implementado:

- `ReportingService` — capa de solo-lectura sobre `movimientos_contables`, sin escrituras.
- Libro diario, libro mayor, balance de prueba, auxiliares (libro subsidiario) vía la primitiva `saldos()`.
- Commits: `0777576` (balance de prueba), `35c1111` (diario), `3869472` (mayor), `7fbf177` (auxiliares), `8839454` (orden determinístico), `b2e39ae` (type safety).

## C3 — Accounting Closure (Cierre Contable)

Estado:

✅ COMPLETADA

Documento:

`docs/adr/C3-accounting-closure.md` — Estado: Propuesto. Reasigna Balance General y Estado de Resultados a C2 (proyecciones de `saldos()`); C3 queda como cierre puro (no hace reporting, no calcula saldos — C3-I10).

Casos de uso (§5 del ADR): U1 `ValidarCierrePeriodo`, U2 `CerrarPeriodo`, U3 `ReabrirPeriodo`, U4 `CerrarAnioFiscal`.

### Fase 1 — Cierre mensual (U1 + U2)

Estado:

✅ COMPLETADA

Commits:

- `6d6a5cb` — U1 `ValidarCierrePeriodo` (sin borradores, cierre cronológico, cuadre leído de C2).
- `876d154` — U2 `CerrarPeriodo` (transición `ABIERTO → CERRADO`, idempotente, auditada).

### Fase 2 — Reapertura (U3)

Estado:

✅ COMPLETADA (2026-07-02) — Rama `feat/accounting-c3-reopen-period` (mergeada — PR #35, commit `64552b8`)

Implementado:

- `ClosureService.reabrirPeriodo(tenantId, periodoId, userId, motivo)` — transición `CERRADO → ABIERTO`.
- Reapertura **LIFO** (C3-I4): solo procede sobre el período `CERRADO` más reciente del tenant.
- Bloqueo por **cierre anual posteado** (C3-I12): si existe comprobante `origenTipo='CIERRE_ANUAL'` no anulado en el período, exige reverso previo por `LedgerService.anular`; C3 nunca borra el asiento.
- Limpieza de `cerradoAt`/`cerradoPorId` a `null` al reabrir; evidencia del cierre permanece en `AuditLog`.
- Idempotencia y concurrencia: advisory locks transaccionales localizados coordinan la reapertura con el cierre de períodos posteriores y preservan el orden cronológico.
- Auditoría `PERIODO_CONTABLE_REABIERTO` (`{ motivo }`), fire-and-forget, solo cuando la reapertura ocurre realmente.
- Sin `rol` en el contrato del servicio — la autorización ADMIN queda delegada al borde (controller/guard), pendiente de transporte.
- Contrato de bloqueos centralizado: `ClosureBloqueo` (constantes) + `ORIGEN_CIERRE_ANUAL`, fuente única reutilizable por U1–U4. Los literales previos de U1/U2 se migraron a las constantes (refactor de comportamiento neutro, verificado).
- 26 unit tests en `closure.service.spec.ts`; suite completa 400/400.

Sin cambios de schema, sin migración, sin transporte HTTP (controller/DTO), sin tocar C1/C2.

### Fase 3 — Cierre anual (U4)

Estado:

✅ COMPLETADA (commit `ee95484`)

Implementado:

- `CerrarAnioFiscal`: cancela las cuentas de resultado (4/5/6/7) contra patrimonio mediante `LedgerService.registrarComprobante` y luego cierra diciembre.
- Reutiliza `ORIGEN_CIERRE_ANUAL` (definida en `closure.service.ts`) como `origenTipo`, sin redefinir el literal.
- El provisioning por defecto incluye el rol `RESULTADO_EJERCICIO` en `CuentaSistemaMap`.
- ACC-01 valida contra PostgreSQL el provisioning, el libro perpetuo, la continuidad de consecutivos y la ausencia de comprobante anual de apertura.

---

# Payroll Module

Objetivo:

Liquidar la nómina mensual ordinaria de operadores educativos colombianos de forma correcta, auditable y reproducible. Payroll es dueño de la corrección laboral; Accounting contabiliza el resultado; Tesorería lo paga.

## Research

Estado:

✅ COMPLETADA

Documentos:

- `docs/research/payroll/01-excel-analysis.md` — Ingeniería inversa del Excel real de nómina.
- `docs/research/payroll/02-domain-model.md` — Modelo de dominio, bounded contexts, agregados.
- `docs/research/payroll/03-payroll-mvp.md` — Alcance v1, flujo funcional, riesgos de sobreingeniería.
- `docs/research/payroll/04-business-rules.md` — Catálogo completo de reglas de negocio (16 categorías).

## ADR-002 — Payroll Core

Estado:

✅ Aprobado

Documento:

`docs/adr/ADR-002-payroll-core.md`

Decisiones clave:

- Payroll como core domain dentro del monolito.
- Catálogo de conceptos cerrado y curado (no motor de reglas del usuario).
- Parámetros legales versionados por vigencia.
- Separación Proceso / Liquidación en agregados distintos.
- Resultado de negocio como frontera Payroll ↔ Accounting.
- Ciclo de estados: Borrador → Calculada → Revisión → Aprobada → Causada → Pagada → Cerrada.
- v1 = nómina mensual ordinaria completa.
- U4: Fail Secure con `PayrollBlock`, pipeline único, `blocks` como fuente funcional y `PayrollRun` solo para resultados válidos.
- `PayrollSnapshot` representa únicamente evidencia histórica aprobada.
- Explícitamente fuera de v1: retención en la fuente, salario integral, PILA, nómina electrónica, motor de reglas configurable.

## Implementación

Estado:

✅ CERRADO — P0 ✅; **P1 Core U1–U4 completado**. Contrato público frontend/BFF alineado. **Payroll P1.5 completado** como capacidad de corrección post-aprobación sin efectos materiales.

Roadmap aprobado:

```
P0 — Payroll Catalogs       ✅ COMPLETADO (parámetros legales, conceptos, escalas, calendarios)
P1 — Payroll Core           ✅ COMPLETADO (ProcesoNómina: estados, liquidación válida, snapshot, fail-secure, PayrollBlock, contrato público)
P1.5 — Corrección post-aprobación ✅ COMPLETADO (acto explícito, ciclo propio, invariantes sobre aprobación original)
Futuro — Materialización de correcciones (fuera de P1.5)
P2 — Accounting Integration ✅ COMPLETADO (causación explícita, correcciones materializadas y ajustes contables)
P3 — Treasury Integration   (resultado de dispersión, hitos de pago)
P4 — PILA                   (Planilla Integrada de Liquidación de Aportes)
P5 — Nómina Electrónica     (Documento soporte DIAN)
```

### P1 — descomposición en unidades (auditoría aprobada 2026-07-11)

```
U1 — Máquina de estados del ProcesoNómina   ✅ COMPLETADO (PR #57)
U2 — Centro de costo                         ✅ COMPLETADO (PR #58)
U3 — Snapshot inmutable                      ✅ COMPLETADO (PR #59)
U4 — Fail-secure                             ✅ COMPLETADO (PR #60)
U5 — Reliquidación no destructiva            ↪️ FUERA DE P1; pasa a Payroll P1.5
```

Fuera de P1 (iniciativas independientes diferidas): rename + feature-flag del módulo Finiquito (`Liquidation`); deduplicación de `generatePayroll`/`recalculatePayroll`.

### Decisión de arquitectura — causación contable de nómina (2026-07-12)

La causación **no** ocurre automáticamente al aprobar. Es un **caso de uso explícito ("Contabilizar nómina")** que transiciona `APROBADA → CAUSADA` (modelo tipo Siigo). La transición a `CAUSADA` y el `registrarComprobante` en el Ledger se ejecutan en **una única `$transaction`** (ADR-001 principio 6, origen síncrono). Se aborda en **P2** (integración Payroll ↔ Accounting), no antes. Preserva la separación aprobación administrativa / causación contable / pago / nómina electrónica. ADR-002 rev. 3 ya aclara que la transacción conjunta pertenece a la causación explícita, no a la aprobación administrativa.

### P1 · U4 — Fail Secure

Estado:

✅ COMPLETADO (2026-07-13, PR #60, merge commit `2ebdb75`).

- Clasificación funcional de evaluación: resultado válido, warning informativo y bloqueo funcional.
- `PayrollRun` queda reservado para resultados válidos; un empleado bloqueado no produce resultado de liquidación válido para el período.
- `blocks` es la única fuente funcional para decidir fail-secure. `serviceWarnings` permanece solo como compatibilidad temporal, no como fuente de decisión de dominio.
- Cálculo y aprobación reutilizan el mismo pipeline de evaluación; no existe una segunda implementación de reglas de bloqueo.
- Aprobación bloqueada cuando existan bloqueos `ACTIVE` no resueltos o no excluidos explícitamente.
- `PayrollBlock` persistente con ciclo de vida `ACTIVE | RESOLVED | EXCLUDED`.
- Correlación estable por PayrollPeriod + empleado + código funcional del bloqueo; no depende del texto del mensaje.
- Gestión manual de bloqueos persistidos: consulta por período, exclusión explícita y trazabilidad de exclusión.
- Política aprobada: un bloqueo `EXCLUDED` no se reactiva automáticamente si la misma causa vuelve a aparecer durante el mismo PayrollPeriod.

### Contrato público Payroll P1

Estado:

✅ ALINEADO (2026-07-13, rama `feat/payroll-p1-u4-fail-secure`; pendiente de commit/merge).

- Servicios, BFF y tipos públicos reflejan el flujo oficial: generar, recalcular, enviar a revisión, aprobar, rechazar, reabrir, consultar bloqueos y excluir bloqueos.
- Respuestas públicas exponen `blocks` cuando corresponde y mantienen `serviceWarnings` solo cuando es necesario para compatibilidad temporal.
- La UI deja de depender del alias legado `closePeriod`; el backend conserva el alias únicamente como compatibilidad transitoria.
- El contrato público refleja estados oficiales de Payroll P1 y visualización de bloqueos sin cambiar reglas de negocio.

### Commits importantes registrados

- P0 — Payroll Catalogs: PR #56, merge commit `9b75bd2`.
- U1 — Máquina de estados: PR #57, merge commit `3113e78`.
- U2 — Centro de costo: PR #58, merge commit `2cb3b36`.
- U3 — Snapshot inmutable: PR #59, merge commit `62fcbc9`.
- U4 — Fail Secure: PR #60, merge commit `2ebdb75`.
- Contrato público Payroll P1: PR #60, merge commit `2ebdb75`.

### Decisión de alcance — Payroll P1.5

Decisión:

Payroll P1 comprende el flujo completo de generación, revisión y aprobación segura de una nómina ordinaria. Las capacidades de corrección posteriores a la aprobación dejan de formar parte de P1 y pasan a **Payroll P1.5 — Corrección post-aprobación**.

Justificación:

- ADR-002 y el estado actual ya cubren el objetivo funcional de P1 Core: liquidar, revisar y aprobar una nómina ordinaria con snapshots aprobados, centro de costo y fail-secure.
- ADR-001 no exige reliquidación no destructiva para que Accounting P2 pueda construir la causación inicial de un período aprobado; exige origen estable, trazabilidad, idempotencia y no escribir directamente desde Payroll al Ledger.
- Payroll P1.5 sí es necesaria antes de habilitar correcciones post-aprobación, reversión controlada y ajustes contables sobre nóminas ya causadas.
- La separación reduce riesgo: P2 puede iniciar sobre el contrato de resultado aprobado, mientras P1.5 queda como prerequisito explícito para flujos de ajuste/reliquidación.
- Esta separación no cambia U1, U2, U3 ni U4; solo clasifica el alcance pendiente.

### Payroll P1.5 — cierre de alcance

Estado:

✅ COMPLETADO (2026-07-13)

- Unidad A: acto explícito de Corrección de Nómina sobre `PayrollPeriod` aprobado.
- Unidad B: ciclo de vida propio de la corrección (`BORRADOR → EN_REVISION → APROBADA`, con ramas terminales `RECHAZADA` y `CANCELADA`).
- Unidad C: invariantes entre la aprobación original y la corrección; la corrección no modifica `PayrollPeriod`, `PayrollRun`, `PayrollSnapshot` ni el historial de aprobación.
- La corrección aprobada agrega una decisión posterior auditada, pero **no produce todavía efectos materiales**.
- La **materialización de correcciones** queda como iniciativa futura separada y no forma parte de Payroll P1.5.

### P1 · U1 — Máquina de estados del ProcesoNómina

Estado:

✅ COMPLETADO (2026-07-12)

Rama `feat/payroll-p1-payroll-process` (mergeada — PR #57, merge commit `3113e78`).

- `PayrollPeriodStatus` pasa de `{DRAFT, CLOSED}` a la máquina de estados de ADR-002 §6: `BORRADOR → CALCULADA → EN_REVISION → APROBADA` (+ `CERRADA` terminal). `DRAFT/CLOSED` quedan legados e inertes; backfill migró todas las filas (`DRAFT→BORRADOR`, `CLOSED→CERRADA`). `CAUSADA` (P2) y `PAGADA` (P3) se añadirán de forma aditiva, sin rename.
- Transiciones (`enviarARevision`/`aprobar`/`rechazar`/`reabrir`) con `updateMany` optimista + auditoría **transaccional fail-secure** (§6): si el audit falla, la transición revierte. `AuditService.log(params, tx?)` extendido de forma mínima y aditiva.
- `generatePayroll`/`recalculatePayroll` transicionan a `CALCULADA` al cierre de su transacción. `closePeriod` reescrito como **alias legado `@deprecated`** (`CALCULADA→APROBADA` directo) para no romper la UI viva; auditado con acción propia.
- Migración de enum en dos archivos (restricción Postgres `ADD VALUE`). Verificada con `prisma migrate deploy` sobre DB nueva (44/44 migraciones).
- Verificación acotada a Payroll: `tsc --noEmit` 0 errores; `jest src/payroll` 205/205.

**Deuda a clasificar antes del cierre final de P1/P1.5:** M2 (TOCTOU: la transición a `CALCULADA` no lleva guarda optimista de origen) y M3 (los eventos `PAYROLL_GENERATED/RECALCULATED` siguen fire-and-forget, a diferencia de las transiciones formales). No se consideran bloqueantes por defecto: si afectan solo mantenibilidad, observabilidad o robustez interna, quedan como deuda planificada; si comprometen garantías funcionales esenciales, deben resolverse antes del cierre definitivo.

**Seguimiento de frontend:** contrato público y BFF ya alineados al flujo oficial de Payroll P1 en la rama `feat/payroll-p1-u4-fail-secure`.

### P1 · U2 — Centro de costo

Estado:

✅ COMPLETADO (2026-07-12)

Rama `feat/payroll-p1-u2-cost-center` (mergeada — PR #58, merge commit `2cb3b36`).

- `PayrollRun` conserva `centroCostoId` nullable con FK hacia `CentroCosto`.
- La generación y el recálculo de nómina resuelven el centro de costo exclusivamente desde `Contrato.sedeId → CentroCosto.sedeId → PayrollRun.centroCostoId`.
- La lectura de períodos de nómina expone `centroCosto` en los runs sin cambiar contratos de escritura.
- Sin backfill, sin índices nuevos, sin cambios en Accounting, sin mapper contable y sin adelantar U3/U4/U5.

### P1 · U3 — Snapshot inmutable

Estado:

✅ COMPLETADO (2026-07-12)

Rama `feat/payroll-p1-u3-immutable-snapshot` (mergeada — PR #59, merge commit `62fcbc9`).

- `PayrollSnapshot` queda como entidad independiente 1:1 por `PayrollRun`, con metadatos relacionales mínimos y payload inmutable.
- `PayrollRun` conserva `calculationTrace` como huella técnica de los insumos normalizados usados durante el cálculo.
- La aprobación a `APROBADA` genera snapshots dentro de la misma transacción y `closePeriod()` reutiliza el mismo flujo legado.
- El payload del Snapshot se construye exclusivamente desde `PayrollRun`, `PayrollConcept` y `calculationTrace`; la evaluación fail-secure de U4 puede ejecutarse antes de aprobar, pero el snapshot no consulta entidades mutables para reproducir el resultado.
- Migración aditiva, sin backfill, sin cambios en Accounting, sin fail-secure y sin adelantar U5.

### P0 — Payroll Catalogs

Estado:

✅ COMPLETADO (2026-07-11)

Cierre del remanente de P0: **externalización de los factores de provisión** (prima, cesantías, intereses, vacaciones) desde constantes hardcoded del `PayrollCalculator` hacia `ParametroLegalNomina`, versionados por vigencia (ADR-002 §9, D3). Rama `feat/payroll-p0-legal-parameters` (mergeada — PR #56, merge commit `9b75bd2`).

- Migración aditiva `add → backfill → NOT NULL` (`20260711000000_payroll_p0_provision_factors`); backfill con los valores legales previos → comportamiento del motor idéntico. Sin `@default` (parámetros legales versionados, no constantes del esquema).
- Cero constantes de provisión en el motor; resolución por la ruta existente `resolveLegalParams → toSnapshot → LegalParamsSnapshot`.
- Verificación acotada a Payroll: `tsc --noEmit` 0 errores; `jest src/payroll` 175/175.

**Deuda documentada para P1 (no corregida en P0):** el comentario de `ParametroLegalNomina.parametroLegalId` (schema) atribuye la reproducibilidad al FK; ADR-002 rev2 §8/D15 establece que el FK es solo trazabilidad y la reproducibilidad real la da la copia inmutable de P1 (snapshot §8).

Ramas antiguas de Payroll (pre-ADR-002):

Las 12 ramas `feat/payroll-*` existentes fueron creadas antes de la investigación completa y del ADR-002. **No reflejan la arquitectura actualmente aprobada.** Se conservan únicamente como referencia histórica. La utilidad pura `dias-causados.ts` (rama `feat/payroll-n2c-novelties`, PR #7 cerrada) se reutilizará en P1.

---

# Security Hardening v1

Estado:

✅ SEC-02 completada (2026-07-14)

Implementado en la rama `initiative/security-hardening-v1`:

- `SEC-02.1` — inventario y clasificación completa de la superficie HTTP.
- `SEC-02.2` — migración total de la superficie a políticas explícitas.
- `SEC-02.3.1` — elegibilidad objetiva de activación (`assertEligible()`).
- `SEC-02.3.2` — activación runtime de `Deny by Default`.

Resultado actual:

- 125 operaciones HTTP clasificadas.
- 0 operaciones `LEGACY_INFERRED`.
- 0 operaciones ambiguas.
- 0 operaciones sin política.
- Toda operación nueva sin política válida queda denegada por runtime.
- Las operaciones existentes conservan el comportamiento observable previo.

Alcance cerrado en SEC-02:

- No se introdujeron permisos granulares.
- No se modificó RBAC.
- No se implementó RLS.
- No se modificaron reglas de negocio de Payroll ni Accounting.

Siguiente frente de hardening:

- Continuar con las Epics posteriores del roadmap aprobado de `Security Hardening v1` sobre la base ya endurecida de autorización.

---

# Security Hardening v2 — Security Headers, Rate Limiting y RLS

Estado de la Epic:

✅ **COMPLETADA y fusionada a `main`** (PR #64, 2026-07-26).

- ✅ `SHV2-01` — Security Headers completada (2026-07-15).
- ✅ `SHV2-02` — Caracterización Operacional del Global Rate Limiting completada (2026-07-15).
- ⛔ `SHV2-03` — Activación del Global Rate Limiting bloqueada por prerrequisitos operativos de infraestructura.
- ✅ `RLS-07` — Contexto tenant-aware, frontera transaccional Prisma y cohorte piloto completados (2026-07-16).
- ✅ `RLS-07.5` — Puente `TenantPrismaService` ↔ PostgreSQL validado con configuración local transaccional (2026-07-16).
- ✅ `RLS-08` — RLS activada únicamente sobre `empleados`, con políticas mínimas de `SELECT`, `INSERT`, `UPDATE` y `DELETE` (2026-07-18).

Decisión de cierre:

- La Epic quedó completada y fusionada a `main`; el Global Rate Limiting permanece deliberadamente sin activar hasta contar con evidencia operacional suficiente.
- `SHV2-03` no puede iniciar hasta que Operaciones documente y demuestre la cadena de proxies confiables, la identificación no falsificable del cliente, el alcance coherente de los contadores según las instancias reales y las métricas que justifiquen límite y ventana.
- La evidencia y checklist de desbloqueo se conservan en `docs/security/SHV2-02-GLOBAL-RATE-LIMITING-CHARACTERIZATION.md`.
- RLS queda activa sólo en `empleados`; los filtros `tenantId` de aplicación se preservan como defensa en profundidad.

Expansión futura de RLS:

- La incorporación de RLS a `sedes`, `document_templates` u otras tablas tenant-scoped se hará mediante unidades, migraciones y pruebas independientes; no forma parte de esta epic cerrada.
- El rol de base de datos de la API deberá ser no-superusuario y no tener `BYPASSRLS` antes de desplegar RLS en producción. Ver `docs/security/RLS-DEPLOYMENT-REQUIREMENTS.md`.

Alcance preservado:

- Auth mantiene sus cinco políticas estrictas existentes.
- No existe guard global, throttler global ni respuestas HTTP `429` nuevas.
- No se modificaron JWT, Authorization, RBAC, Frontend ni reglas de dominio.

Resumen de cierre:

- Headers de seguridad y caracterización operativa de rate limiting incorporados sin activar un límite global prematuro.
- `TenantPrismaService` establece la frontera transaccional tenant-aware y RLS protege la cohorte piloto `empleados`.
- Las rutas auditadas que acceden a `empleados` operan mediante la frontera tenant-aware con RLS activa.

---

# Security Hardening v3 — Documentos privados, XSS persistente y autenticación

Estado de la iniciativa:

✅ **COMPLETADA** (2026-07-29).

Implementación:

- ✅ PR1 — Preparación de entrega autenticada de documentos privados (`98f86cb`).
- ✅ PR2 — Eliminación del acceso público al almacenamiento documental privado (`b219797`).
- ✅ PR3 — Sanitización centralizada en render del HTML documental persistido (`8524861`).
- ✅ PR4 — Respuestas homogéneas ante fallos de autenticación (`355e353`).

Resultado:

- Los documentos privados se entregan exclusivamente mediante superficies autenticadas.
- Los tres sinks documentales renderizan mediante `SafeDocumentHtml`, DOMPurify y una política allowlist centralizada.
- El contenido persistido, `GeneratedDocument`, `contenidoFinal`, plantillas, PDFs y Storage permanecen sin modificaciones.
- Tenant inexistente o inactivo, usuario inexistente o inactivo y contraseña incorrecta exponen una respuesta homogénea al cliente.
- El login exitoso, JWT, refresh token, logout, permisos, autorización, multiempresa y throttling conservan su comportamiento.
- Logging interno y trazabilidad de auditoría se mantienen.

Validación de cierre:

- Pruebas de entrega documental privada y autenticación aprobadas.
- Sanitización documental: 19/19 pruebas aprobadas.
- Lint y typecheck aprobados.
- El build web no depende de una descarga externa de fuentes; usa una pila de fuentes del sistema.

---

# <a name="roadmap-futuro"></a>Roadmap Futuro

La referencia arquitectónica vigente para la evolución del producto es
[`Platform Evolution`](docs/architecture/PLATFORM-EVOLUTION.md). Organiza las
capacidades por dominio y dependencia. Desde el 2026-10-30, GOAL-02 es el único
Goal activo y usa esta referencia junto con su backlog específico.

## Goal activo

- [`GOAL-02 — Evolución Financiera y Cumplimiento Electrónico`](docs/goals/GOAL-02-base-financial-regulatory-evolution.md): demostrar e integrar los flujos internos de nómina, facturación y contabilidad, y avanzar hacia cumplimiento electrónico verificable.
- [`GOAL-02 backlog`](docs/goals/GOAL-02-backlog.md): primer incremento, dependencias, riesgos y criterios de aceptación.
- GOAL-01 — Primer Cliente Operando está pausado, no cerrado; sus pendientes y evidencia permanecen preservados en [`su ficha`](docs/goals/GOAL-01-primer-cliente-operando.md).

Los Milestones de GOAL-01 quedan en pausa; GOAL-02 prioriza los flujos financieros demostrables y conserva las puertas regulatorias de dominio, proveedor, seguridad y operación.

Hitos cerrados recientemente:

- ✅ Security Hardening v3 — documentos privados, XSS persistente y autenticación homogénea.
- ✅ Security Hardening v2 — headers, frontera tenant-aware y RLS piloto.
- ✅ Accounting v1 — Ledger, reporting, cierre contable e integración explícita con Payroll.

Candidatos futuros fuera del Goal activo:

- Alertas avanzadas.
- Gestión documental avanzada.
- Multiempresa avanzado.
- Multisede avanzado.
- Inteligencia artificial.
- Otros candidatos conservados en Platform Evolution y el Backlog.

Importante:

Las capacidades futuras NO deben introducir sobreingeniería temprana.

Las iniciativas financieras de GOAL-02 se implementan de acuerdo con su backlog
y las necesidades de demostración/negocio verificadas. Los candidatos restantes
se priorizan después del Goal activo. Un Goal solo puede redefinirse cuando
cambie la estrategia del producto, no por nuevas ideas, módulos o mejoras.

---

# <a name="forma-de-trabajo"></a>Forma de Trabajo

El desarrollo sigue la metodología definida en [`docs/goals/README.md`](docs/goals/README.md):

- un solo Goal activo;
- capacidades funcionales por Milestones y Epics end-to-end;
- PRs como unidades de entrega, no como objetivos;
- código y comportamiento verificable como fuente de verdad;
- documentación tratada como hipótesis;
- estado del Goal separado del estado de implementación: `GOAL ACTIVO`,
  `IMPLEMENTACIÓN BLOQUEADA` y `ARQUITECTURA DISPONIBLE`;
- auditoría basada en la pregunta “¿un cliente podría utilizar esta capacidad hoy?”;
- Codex como Lead Engineer responsable de investigar, implementar, verificar y preparar el PR; con checks verdes y auditoría `APROBADO PARA MERGE`, puede realizar el merge y volver a `main` para sincronizar el estado.

Regla principal: primero evidencia, luego arquitectura y dependencias, después el siguiente paso mínimo y finalmente verificación completa.
