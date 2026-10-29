# GOAL-01 — Primer Cliente Operando

## Resultado de negocio

Un operador educativo real puede ser incorporado en producción, configurar su organización y usuarios, cargar su planta de personal y completar el ciclo contratación → documento → expediente → seguimiento con seguridad, trazabilidad y soporte operativo suficientes para usar La Oficina Nítida comercialmente.

La evidencia final será un primer cliente que complete y acepte el recorrido principal en producción.

## Estado

`ACTIVO`

### Estado operativo por dimensión

- **GOAL-01:** `ACTIVO`.
- **Implementación:** `BLOQUEADA SELECTIVAMENTE` por infraestructura externa
  en M1/M7 y correo real en M2.
- **Arquitectura y preparación:** `DISPONIBLE` en [Platform Evolution](../architecture/PLATFORM-EVOLUTION.md),
  sin crear GOAL-02 ni modificar el resultado de negocio vigente.

La ausencia de una Epic implementable no cambia el estado del Goal mientras
exista trabajo útil de arquitectura, planificación, investigación o
preparación que acerque el resultado del primer cliente.

E5.2 fue fusionada en el PR #102, E5.3 en el PR #103, E5.4 en el PR #104 y E6.1
en el PR #105. Los checks post-merge de CI/Browser E2E de las cuatro están
verdes. E5.3 dejó
las revisiones publicadas append-only, protegió las lecturas del expediente con
el RBAC operativo y retiró la acción destructiva de la UI. E5.4 añadió la
auditoría de las descargas directas del expediente y dejó M5 completado. E6.1
automatizó la generación diaria de alertas de vencimientos y documentos faltantes
para tenants activos, con aislamiento tenant-aware y lock transaccional.
E6.2 fue fusionada en el PR #106: el dashboard permite resolver alertas y la
resolución conserva el actor, la fecha y el evento de auditoría de forma atómica.
E6.3 fue fusionada en el PR #108: el scheduler registra ejecuciones, recupera
fallos, permite reintentos operativos y deja visibles los resultados y la
auditoría para la operación. Sus checks post-merge de CI y Browser E2E están
verdes; M6 queda completado.
E2.4 fue fusionada en el PR #110: las sedes y la identidad corporativa se
prueban desde la UI dentro del tenant autenticado, y la promesa pública describe
el aislamiento por organización sin prometer cambio de contexto entre empresas.

E2.2 tiene una implementación en la [PR #144](https://github.com/Glemynart/SaaS/pull/144): el ADMIN
gestiona invitaciones por tenant, el correo lleva un enlace de un solo uso y la
persona define su contraseña antes de iniciar sesión. La suite API valida
expiración y reglas de negocio. Dos integraciones PostgreSQL cubren la
persistencia del hash, aislamiento tenant, auditoría, consumo concurrente de un
solo uso y autorización de los endpoints HTTP por rol y tenant. El Browser E2E
recorre la UI, el BFF, la API Nest y PostgreSQL; un SMTP local de prueba captura
el mensaje, el test extrae el enlace real, acepta la invitación y verifica el
inicio de sesión de la cuenta creada. También cubre reenvío con rotación de
token y revocación desde la UI. El SMTP local no demuestra entrega a un buzón
externo: recibir y aceptar el correo real en staging sigue pendiente, por lo que
E2.2 permanece sin cerrar.

**Pausa selectiva:** GOAL-01 permanece `ACTIVO` y M1 continúa `BLOQUEADO POR
INFRAESTRUCTURA EXTERNA`. Las Epics que requieran dominio, DNS, Cloudflare, R2,
OCI Email Delivery, variables de producción o staging permanecen detenidas. E4.2
quedó fusionada por un camino independiente sin esas dependencias. El
desbloqueo operativo de M1 se controla con el [checklist de infraestructura](GOAL-01-M1-infrastructure-checklist.md).

## Estrategia que lo justifica

- **Cliente objetivo:** operadores educativos colombianos con alta carga laboral y documental.
- **Problema:** operación fragmentada entre Excel, Word, carpetas y herramientas desconectadas.
- **Resultado esperado:** operación laboral y documental centralizada, verificable y recuperable.
- **Razón para priorizarlo:** el código está más cerca de entregar esta promesa que facturación electrónica, nómina electrónica o una suite financiera completa.

Este Goal solo puede redefinirse si cambia la estrategia del producto. Nuevas ideas, módulos o mejoras se clasifican y van al Backlog cuando no son necesarias para incorporar al primer cliente.

## Evidencia inicial verificada en `main`

### Capacidades base existentes

- autenticación, recuperación de contraseña y aislamiento tenant en las superficies principales;
- empleados, importación XLSX, sedes e identidad corporativa con backend y frontend;
- plantillas HTML, documentos generados, PDF, storage y certificaciones laborales;
- contratos y lotes manuales con infraestructura documental;
- perfiles contractuales, vínculos precontractuales, resolución y confirmación inteligente en backend;
- expediente para documentos publicados y alertas generadas automáticamente;
- motores avanzados de nómina y contabilidad que no definen el alcance comercial activo.

### Rupturas comprobadas

- E2.1 ya entrega la gestión directa de usuarios; E2.2 ya tiene un recorrido
  E2E local completo con SMTP de prueba, pero la entrega y aceptación con correo
  real siguen pendientes; E2.3 aún requiere validar recuperación por correo real;
- E4.1 ya permite crear, resolver y confirmar campañas inteligentes desde la UI;
- E4.2 ya procesa planes confirmados; E4.3, E4.4, E4.6 y E5.1 están fusionadas;
- la ruta de campaña inteligente tiene un recorrido browser desde resolución y
  confirmación hasta contrato, expediente y descarga; los valores legales de
  empresa del PDF provienen del snapshot contractual, no de una lectura en vivo.
  La validación en staging/producción sigue pendiente de M1;
- la generación documental individual está disponible desde el detalle del contrato; la prueba browser incorporada en PR #125 recorre la generación, publicación en el expediente y descarga del PDF con nombre Unicode;
- el expediente ya permite carga manual, clasificación, descarga e historial/versionado;
  la auditoría e integración consistente del expediente quedaron entregadas en E5.4.
- E6.1 ya genera diariamente alertas de vencimientos y documentos faltantes; E6.2
  ya permite ampliar la bandeja y resolver alertas con trazabilidad; E6.3 ya hace
  visibles fallos, reintentos y auditoría operativa;
- existen smoke tests browser para recorridos funcionales, pero todavía no una
  única suite que pruebe el recorrido comercial completo en producción;
- no existe deployment productivo reproducible ni evidencia de Go Live;
- el formulario público de demo simula el envío sin persistir ni notificar el lead;
- la base local auditada estaba doce migraciones detrás de `main`.

### Divergencias documentales

- documentación histórica presenta facturación electrónica como MVP, mientras el código solo ofrece facturación interna sin DIAN;
- documentación histórica afirma capacidades completas por PR o fase que no siempre son utilizables end-to-end;
- “multiempresa” implementa aislamiento por tenant, no acceso de un mismo usuario a varias organizaciones.

## Alcance

- deployment verificable y operación productiva;
- onboarding de organización y gestión de usuarios;
- preparación de información laboral necesaria para contratar;
- contratación individual e inteligente end-to-end;
- expediente digital operativo;
- alertas y seguimiento automático;
- seguridad, auditoría, recuperación y soporte necesarios para el primer cliente;
- alineación documental de las capacidades incluidas.

## Exclusiones y Backlog

- facturación electrónica DIAN y Matías API;
- nómina electrónica, PILA y transmisión regulatoria;
- definición comercial de la suite financiera/contable;
- firma electrónica;
- portal de empleados o clientes;
- inteligencia artificial;
- integraciones bancarias;
- captura pública de solicitudes de demo y operación de prospectos (E7.3);
- escalabilidad anticipada sin evidencia de carga;
- mejoras cosméticas que no bloqueen la operación del primer cliente.

Estas exclusiones son limitaciones temporales del roadmap. No se numerarán como Goals futuros hasta ser priorizadas.

## Dependencias y decisiones

| Dependencia o decisión                                                           | Tipo                     | Estado         | Acción                                                                                                           |
| -------------------------------------------------------------------------------- | ------------------------ | -------------- | ---------------------------------------------------------------------------------------------------------------- |
| Alcance laboral-documental del primer cliente                                    | Estrategia de producto   | APROBADO       | Gobierna GOAL-01.                                                                                                |
| Perfil contractual como evidencia histórica                                      | Arquitectura             | APROBADO       | Respetar ADR-004.                                                                                                |
| E4.2 — Procesamiento de planes confirmados                                       | Trabajo entregado        | CERRADO        | PR #90 fusionada y verificada.                                                                                   |
| E4.3 — Perfil y snapshots históricos                                             | Trabajo entregado        | CERRADO        | PR #92 fusionada y verificada.                                                                                   |
| E4.4 — PDF canónico y expediente                                                 | Trabajo entregado        | CERRADO        | PR #93 fusionada y verificada.                                                                                   |
| E4.6 — Contratación individual desde la UI                                       | Trabajo entregado        | CERRADO        | PR #94 fusionada y verificada.                                                                                   |
| E5.1 — Subida manual y validación de archivos                                    | Trabajo entregado        | CERRADO        | PR #95 fusionada y verificada.                                                                                   |
| E2.1 — Gestión directa de usuarios                                               | Trabajo entregado        | CERRADO        | PR #96 fusionada y verificada por CI/Browser E2E.                                                                |
| E4.5 — Reintentos e idempotencia de lotes                                        | Trabajo entregado        | CERRADO        | PR #97 fusionada y verificada por CI/Browser E2E post-merge.                                                     |
| ADR-006 — Modelo de versionado e inmutabilidad del Expediente Digital            | Decisión de dominio      | APROBADO       | Gobierna E5.2, E5.3 y E5.4.                                                                                      |
| ADR-007 — Ejecución, reintentos y visibilidad operativa del scheduler de alertas | Decisión de arquitectura | APROBADO       | PR #107 fusionada; gobierna E6.3.                                                                                |
| E5.2 — Familias, revisiones, consulta e historial                                | Trabajo entregado        | CERRADO        | PR #102 fusionada y verificada.                                                                                  |
| E5.3 — Inmutabilidad y permisos del expediente                                   | Trabajo entregado        | CERRADO        | PR #103 fusionada; checks post-merge verdes.                                                                     |
| E5.4 — Auditoría e integración consistente del expediente                        | Trabajo entregado        | CERRADO        | PR #104 fusionada; checks post-merge verdes.                                                                     |
| E6.1 — Scheduler de vencimientos y documentos faltantes                          | Trabajo entregado        | CERRADO        | PR #105 fusionada; checks post-merge verdes.                                                                     |
| E6.2 — Dashboard accionable y resolución trazable                                | Trabajo entregado        | CERRADO        | PR #106 fusionada; checks post-merge verdes.                                                                     |
| E2.4 — Sedes, identidad y promesa multiempresa coherente con el producto real    | Trabajo entregado        | CERRADO        | PR #110 fusionada; CI y Browser E2E post-merge verdes.                                                           |
| E7.3 — Captura real de solicitudes de demo                                       | Alcance comercial        | FUERA DEL GOAL | Mantener ADR-008 como referencia de Platform Evolution; priorizar ante una necesidad de adquisición verificable. |
| Superficie comercial de contabilidad                                             | Decisión de producto     | FUERA DEL GOAL | Resolver antes de priorizar un Goal futuro.                                                                      |
| Infraestructura productiva                                                       | Dependencia técnica      | ABIERTO        | Resolver en M1.                                                                                                  |

## Milestones y Epics

### M1 — Deployment verificable

**Resultado verificable:** la aplicación se despliega desde cero en un ambiente representativo y completa un smoke test autenticado.

**Estado del Milestone:** `BLOQUEADO POR INFRAESTRUCTURA EXTERNA` porque aún no
hay evidencia de despliegue reproducible, rollback, R2 y entrega de correo real.
La URL de staging ya existe y responde; esa evidencia no completa E1.1 ni E1.3.
Este estado pertenece a M1; no convierte al Goal en bloqueado. GOAL-01 permanece
`ACTIVO`.

- [ ] E1.1 — Staging reproducible, configuración y secretos.
- [x] E1.2 — Migraciones, seed y rol PostgreSQL runtime no privilegiado.
- [ ] E1.3 — R2, correo real y health/readiness checks.
- [x] E1.4 — CI, observabilidad y base de pruebas browser end-to-end.

E1.4 se fusionó en `main` como PR #81, con los checks de CI y Browser E2E
verdes y auditoría `APROBADO PARA MERGE`. E1.3 también está fusionada y sus
rutas `/health` y `/readiness` son la base de los smoke tests. La verificación
real de R2 y correo de E1.3, junto con la validación de staging reproducible de
E1.1, sigue siendo evidencia operativa pendiente y no se declara cerrada por
la sola existencia del código. La comprobación externa de solo lectura del
2026-10-29 obtuvo HTTP 200 en `https://staging.dusema.com`, `/health` y
`/readiness` de `staging-api.dusema.com`. Readiness reportó database, storage y
email `up`; el check de email sólo acredita que el transporte está configurado,
no entrega efectiva, y el check de storage no identifica el proveedor. No se
probaron R2, recepción de correo, rollback ni despliegue desde cero. La
aceptación operacional de E2.2 aún requiere recibir y aceptar un correo real;
readiness no acredita esa entrega. Estas dependencias no bloquean los caminos
independientes del Goal.

La verificación previa que afirmaba que no existía URL de staging quedó
superada por la respuesta actual del entorno. Sigue sin evidencia verificable
de un procedimiento repetible de despliegue/rollback ni de la configuración
segura de sus secretos. Esta es una dependencia operativa externa pendiente,
no una decisión de arquitectura. La prioridad se reevalúa como un grafo de
dependencias: M3 puede avanzar sin
staging, R2, correo ni una decisión de dominio pendiente.

La inspección de solo lectura registrada en PR #124 encontró que la API llamada staging compartía la VPS y la base `oficina_nitida` clasificadas como producción y usaba storage local; el Compose activo no coincidía con el versionado. PR #124 prepara un proyecto Compose/API aislado, exige R2 y correo real, y valida el bootstrap PostgreSQL en CI con una base efímera. No se modificaron la VPS, el DNS, la base, el rol, las ACL ni los servicios activos. M1 permanece bloqueado hasta la revisión DBA y la validación operativa de aislamiento, R2 y correo.

### M2 — Gestión de Organizaciones y Usuarios

**Resultado verificable:** un cliente opera con varias personas sin compartir credenciales.

- [x] E2.1 — Gestión directa de usuarios: creación administrada, listado,
      edición de datos, roles ADMIN/OPERADOR y activación/desactivación (PR #96
      fusionada y verificada por CI/Browser E2E).
- [ ] E2.2 — Invitaciones y alta por correo: implementación con gestión
      ADMIN, aceptación de un solo uso, expiración y aislamiento tenant; UI/API/DB
      pasan el E2E local con SMTP de prueba. Falta validar entrega real y
      aceptación desde el entorno operativo.
- [ ] E2.3 — Recuperación de acceso real por correo. La implementación de prevalidación aprobada en ADR-010 y tokens en fragmento URL está en PR #148; falta validar entrega de correo real y aceptar el recorrido en staging.
- [x] E2.4 — Sedes, identidad y promesa multiempresa coherente con el producto real (PR #110
      fusionada; checks post-merge de CI/Browser E2E verdes).

E2.1 no envía correo: un ADMIN crea y administra directamente las cuentas con
credenciales entregadas por el canal operativo acordado. E2.2 agrega el flujo de
invitación y activación por enlace; el código falla de forma explícita si SMTP
no está disponible. Su implementación no acredita recepción real ni cierra la
Epic hasta verificar el enlace recibido en el entorno operativo.

### M3 — Preparación de la Operación Laboral

**Resultado verificable:** el operador prepara desde la interfaz todos los datos necesarios para contratar.

**Estado del Milestone:** `COMPLETADO`.

M3 fue el Milestone desbloqueado mientras M1 esperaba evidencia externa. La
decisión evitó bloquear el Goal completo por un único camino operativo. E3.1,
E3.2, E3.3 y E3.4 están fusionadas; sus recorridos preparan el siguiente flujo
sin requerir staging, R2, correo ni una nueva decisión de dominio.

- [x] E3.1 — Empleados CRUD, búsqueda e importación XLSX verificadas (PR #83 fusionada).
- [x] E3.2 — Perfiles contractuales y vínculos laborales precontractuales (PR #84 fusionada).
- [x] E3.3 — Configuración perfil → tipo documental → plantilla (PR #86 fusionada y verificada por CI/Browser E2E).
- [x] E3.4 — Errores y bloqueos comprensibles para el operador (feedback accionable,
      reintentos de dependencias y enlaces a prerrequisitos existentes; PR #88 fusionada
      y verificada por CI/Browser E2E post-merge).

### Estado post-merge — E2.4 y E6.3 fusionadas; M2 parcial; M6 completado

Tras fusionar E4.3 en PR #92, E4.4 en PR #93, E4.6 en PR #94, E5.1 en PR #95,
E2.1 en PR #96, E4.5 en PR #97, E4.7 en PR #99, ADR-006 en PR #101, E5.2 en
PR #102, E5.3 en PR #103, E5.4 en PR #104, E6.1 en PR #105, E6.2 en PR #106,
ADR-007 en PR #107, E6.3 en PR #108 y E2.4 en PR #110, `main` contiene
esas capacidades con checks post-merge verdes.
La revisión del estado real del repositorio confirma que no existe evidencia
operativa suficiente para cerrar M1, pero también confirma que E4.5 no depende de
ese entorno.

El backend tenant-aware y la superficie frontend/BFF de E4.1 conservan los contratos
de preview y confirmación, planes, exclusiones y snapshots históricos sin cambiar el
contrato de dominio. E4.2 procesa esos planes confirmados y deja fuera las
exclusiones, usando PostgreSQL, Puppeteer y la abstracción de storage existente. E4.5
repara el retry selectivo del lote: conserva los resultados previos y reprocesa
únicamente empleados con error, incluyendo la ruta de planes documentales. La
decisión de prioridad no desbloquea M1: permite avanzar por este camino
independiente sin introducir retrabajo en invitaciones ni en los flujos laborales y
documentales ya fusionados.
La migración de las acciones de GitHub a Node 24 fue una tarea de mantenimiento
independiente ya fusionada y no cambia el estado del Goal.

E2.1 quedó fusionada en PR #96 y verificada en `main`; sus invitaciones siguen
separadas en E2.2 por la dependencia de correo real. E4.5 quedó fusionada en PR
#97 y E4.7 en PR #99, ambas con checks post-merge verdes. ADR-006 quedó aprobada
en PR #101; E5.2 quedó implementada conforme a esa decisión en PR #102 y E5.3
completó la inmutabilidad de las publicaciones y el RBAC operativo del expediente
en PR #103. E5.4 quedó fusionada en PR #104 y añade la auditoría de descargas
directas del expediente sobre la integración documental ya existente para
contratos y certificaciones. E6.1 automatiza diariamente la generación de
alertas de contratos por vencer y empleados sin contrato dentro de una
transacción con lock advisory, sin introducir correo, R2 ni staging. M5 queda
completado y M6 queda completado con E6.2 y E6.3 fusionadas. ADR-007 fue
aprobado en PR #107 y gobierna la operación del scheduler implementada en E6.3.
E2.4 quedó fusionada en PR #110: la UI y el API permiten operar sedes e identidad
corporativa dentro del tenant autenticado, y la landing ya no promete cambiar de
organización desde una misma sesión.

### M4 — Contratación Inteligente End-to-End

**Resultado verificable:** campaña → resolución → confirmación → procesamiento → contrato → PDF → expediente se completa desde la UI.

- [x] E4.1 — Creación, preview y confirmación total/parcial desde frontend (PR #89 fusionada y verificada por CI/Browser E2E).
- [x] E4.2 — PR11.3 procesa únicamente planes confirmados y respeta exclusiones (PR #90 fusionada y verificada por CI/Browser E2E).
- [x] E4.3 — Perfil y snapshots preservados en contrato y documento (PR #92 fusionada y verificada por CI/Browser E2E del PR).
- [x] E4.4 — PDF canónico vinculado al contrato y publicado en expediente (PR #93 fusionada y verificada por CI/Browser E2E post-merge).
- [x] E4.5 — Reintentos, idempotencia y errores parciales verificables (PR #97
      fusionada y verificada por CI/Browser E2E post-merge).
- [x] E4.6 — Contratación individual completa como flujo alternativo (PR #94 fusionada y verificada por CI/Browser E2E post-merge).
- [x] E4.7 — Prueba browser del caso exitoso, parcial y reintentado (PR #99 fusionada y verificada por CI/Browser E2E).

#### Corrección funcional de E4.1 — sede por empleado y contrato anual

La auditoría posterior encontró un bug en la generación por lotes: el formulario
aplicaba una sola sede a todos los empleados y la persistencia no identificaba
el año contractual. El empleado debe tener sede activa al registrarse o
importarse; cada lote usa la sede de la ficha y toma el año de `fechaInicio`.
La regla aprobada es un contrato por empleado y año, para permitir renovaciones
en años distintos sin duplicar contratos del mismo año.

### M5 — Expediente Digital Operativo

**Resultado verificable:** el expediente sustituye la carpeta operativa básica del empleado.

- [x] E5.1 — Subida manual y validación de archivos (PR #95 fusionada y verificada por CI/Browser E2E).
- [x] E5.2 — Clasificación, consulta, descarga e historial/versionado definido
      (PR #102 fusionada; checks post-merge de CI/Browser E2E verdes).
- [x] E5.3 — Inmutabilidad de documentos publicados y permisos por rol
      (PR #103 fusionada; checks post-merge de CI/Browser E2E verdes).
- [x] E5.4 — Auditoría e integración consistente con contratos y certificaciones
      (PR #104 fusionada; checks post-merge de CI/Browser E2E verdes).

### M6 — Seguimiento Operativo

**Resultado verificable:** el sistema detecta y presenta trabajo pendiente sin generación manual del usuario.

- [x] E6.1 — Scheduler de vencimientos y documentos faltantes (PR #105
      fusionada; checks post-merge de CI/Browser E2E verdes).
- [x] E6.2 — Dashboard accionable y resolución trazable (PR #106 fusionada;
      checks post-merge de CI/Browser E2E verdes).
- [x] E6.3 — Fallos, reintentos y auditoría visibles para operación (PR #108
      fusionada; checks post-merge de CI/Browser E2E verdes).

### M7 — Go Live Comercial

**Resultado verificable:** el primer cliente completa y acepta el recorrido principal en producción.

M7 es el cierre final del Goal. Sus tareas de despliegue productivo, operación,
aceptación y Go Live no se intercalan con el desarrollo de las capacidades
funcionales anteriores; se ejecutan cuando el producto y la infraestructura
externa estén listos.

La auditoría de negocio determinó que E7.3 no es necesaria para tener operando
al primer cliente: captura prospectos antes del tenant y no participa en el
onboarding ni en el recorrido laboral-documental. La frontera de plataforma
queda definida y aceptada en [ADR-008](../adr/ADR-008-demo-request-capture-boundary.md),
pero su implementación se traslada a Platform Evolution hasta que exista una
necesidad comercial verificable de adquisición desde la landing.

- [ ] E7.1 — Backup y restauración probados. [ADR-009](../adr/ADR-009-coordinated-backup-sets.md) acepta el coordinador sintético DB+uploads fusionado en PR #130; PR #147 se integró en su rama para validar compartimento y privacidad del bucket. La lectura de objetos OCI, el aislamiento operativo, la retención y la restauración real siguen pendientes.
- [ ] E7.2 — Monitoreo, alertamiento técnico y soporte operativo. La preparación y evidencia se registran con la [guía operativa de monitoreo y soporte](GOAL-01-monitoring-support-runbook.md).
- [ ] E7.4 — Onboarding y aceptación del cliente piloto con datos representativos. La sesión y sus evidencias se registran con la [guía operativa de piloto](GOAL-01-pilot-acceptance-runbook.md).
- [ ] E7.5 — Primer tenant productivo listo para operación comercial sostenida.

## Criterios de aceptación del Goal

- [ ] existe un primer cliente identificado y autorizado para el piloto;
- [ ] usuarios ADMIN y OPERADOR acceden sin compartir credenciales;
- [ ] la planta de personal se registra o importa con manejo verificable de errores;
- [ ] se completa una contratación individual y una campaña inteligente;
- [ ] cada contrato conserva snapshots y produce un PDF canónico;
- [ ] el documento llega al expediente correcto y puede descargarse con autorización;
- [ ] el expediente admite los documentos operativos básicos definidos para el piloto;
- [ ] las alertas se generan automáticamente y conducen a una acción;
- [ ] aislamiento tenant, auditoría y accesos privados están verificados;
- [ ] deployment, migraciones, backup, restauración, monitoreo y soporte están probados;
- [ ] existe evidencia browser end-to-end del recorrido principal en producción;
- [ ] el cliente piloto acepta el resultado para operación real;
- [ ] documentación y código describen la misma capacidad;
- [ ] todos los PRs requeridos están fusionados en `main`.

## PRs asociados

| PR      | Epic  | Propósito                                                                 | Estado            | ¿Cierra capacidad?                                                              |
| ------- | ----- | ------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------- |
| #78     | E1.1  | Imágenes reproducibles de staging para API y Web.                         | FUSIONADO         | No; E1.1 requiere verificación de staging.                                      |
| #79     | E1.2  | Migraciones, seed y rol runtime PostgreSQL no privilegiado.               | FUSIONADO         | Sí; E1.2 verificada localmente y en DB limpia.                                  |
| #80     | E1.3  | R2, correo real y health/readiness checks.                                | FUSIONADO         | No; requiere verificación real en staging.                                      |
| #81     | E1.4  | CI, observabilidad y base de pruebas browser end-to-end.                  | FUSIONADO         | Sí; CI y Browser E2E verificados; M1 aún requiere staging.                      |
| #83     | E3.1  | Verificación browser del CRUD, búsqueda e importación XLSX de empleados.  | FUSIONADO         | Sí; recorrido verificado browser.                                               |
| #84     | E3.2  | Perfiles contractuales y vínculos laborales precontractuales desde la UI. | FUSIONADO         | Sí; recorrido verificado por CI y Browser E2E.                                  |
| #86     | E3.3  | Configuración perfil → tipo documental → plantilla desde UI.              | FUSIONADO         | Sí; CI/Browser E2E y checks post-merge verdes.                                  |
| #88     | E3.4  | Feedback accionable para errores, bloqueos y reintentos operativos.       | FUSIONADO         | Sí; CI/Browser E2E post-merge verdes.                                           |
| #89     | E4.1  | Creación, preview y confirmación total/parcial desde frontend.            | FUSIONADO         | Sí; CI/Browser E2E post-merge verdes.                                           |
| #90     | E4.2  | Procesamiento de planes confirmados y exclusiones desde la campaña.       | FUSIONADO         | Sí; CI/Browser E2E verdes.                                                      |
| #92     | E4.3  | Perfil y snapshots confirmados preservados en contrato y documento.       | FUSIONADO         | Sí; CI y Browser E2E verdes.                                                    |
| #93     | E4.4  | PDF canónico vinculado al contrato y publicado en expediente.             | FUSIONADO         | Sí; CI y Browser E2E post-merge verdes.                                         |
| #94     | E4.6  | Contratación individual completa desde la UI.                             | FUSIONADO         | Sí; CI y Browser E2E post-merge verdes.                                         |
| #95     | E5.1  | Subida manual y validación de archivos en expediente.                     | FUSIONADO         | Sí; CI y Browser E2E verdes post-merge.                                         |
| #96     | E2.1  | Gestión directa de usuarios sin invitaciones por correo.                  | FUSIONADO         | Sí; CI y Browser E2E post-merge verdes.                                         |
| #97     | E4.5  | Reintentos selectivos, idempotencia y errores parciales.                  | FUSIONADO         | Sí; CI y Browser E2E post-merge verdes.                                         |
| #99     | E4.7  | Prueba browser del caso exitoso, parcial y reintentado.                   | FUSIONADO         | Sí; CI y Browser E2E post-merge verdes; no depende de M1.                       |
| #102    | E5.2  | Familias documentales, revisiones, consulta, descarga e historial.        | FUSIONADO         | Sí; CI y Browser E2E post-merge verdes.                                         |
| #103    | E5.3  | Inmutabilidad de publicaciones y permisos por rol en expediente.          | FUSIONADO         | Sí; CI y Browser E2E post-merge verdes.                                         |
| #104    | E5.4  | Auditoría de descargas e integración documental consistente.              | FUSIONADO         | Sí; CI y Browser E2E post-merge verdes.                                         |
| #105    | E6.1  | Scheduler diario de vencimientos y documentos faltantes.                  | FUSIONADO         | Sí; CI y Browser E2E post-merge verdes.                                         |
| #106    | E6.2  | Dashboard accionable y resolución trazable.                               | FUSIONADO         | Sí; CI y Browser E2E post-merge verdes.                                         |
| #124    | E1.1  | Preparar integraciones de staging aisladas y bootstrap PostgreSQL seguro. | FUSIONADO         | No; faltan aislamiento y validación operativa.                                  |
| #130    | E7.1  | Backup/restauración PostgreSQL+uploads y marcador coordinado cifrado.     | FUSIONADO         | No; round-trip sintético verificado; faltan OCI y recuperación operativa.       |
| #108    | E6.3  | Fallos, reintentos y auditoría visibles para operación.                   | FUSIONADO         | Sí; CI y Browser E2E post-merge verdes.                                         |
| #110    | E2.4  | Sedes, identidad y promesa multiempresa coherente con el producto real.   | FUSIONADO         | Sí; CI y Browser E2E post-merge verdes.                                         |
| #134    | E4.4  | Bug: idempotencia de generación concurrente LETTER/MEMO y reintentos.     | FUSIONADO         | No; corrige una carrera de la capacidad ya entregada.                           |
| #140    | E4.1  | Selección de todos los empleados cargados por páginas en lotes manuales.  | FUSIONADO         | No; mejora el flujo existente para plantas grandes.                             |
| #142    | E7.1  | Restauración PostgreSQL aislada con verificación de contenido.            | INTEGRADO EN #130 | No; verificado como componente del round-trip sintético; falta OCI real.        |
| #143    | E7.1  | Backup y restauración aislada de artefactos locales de uploads.           | INTEGRADO EN #130 | No; referencias DB+uploads conciliadas en round-trip sintético; falta OCI real. |
| #144    | E2.2  | Invitaciones por tenant y activación segura de cuentas.                   | PENDIENTE         | No; recepción y aceptación del correo real siguen pendientes.                   |
| #148    | E2.3  | Prevalidación de tokens antes del formulario de recuperación.             | PENDIENTE         | No; faltan correo real y aceptación en staging.                                 |
| #69–#76 | E3/E4 | Fundaciones de resolución, planes, generación y dominio inteligente.      | FUSIONADOS        | No; el recorrido inteligente sigue abierto.                                     |

Los siguientes PRs se incorporarán por Epic conforme se descubra el siguiente paso mínimo. El Goal no se organiza como una lista anticipada de implementaciones.

## Auditoría actual

**Pregunta:** ¿un cliente podría utilizar hoy la capacidad completa definida por GOAL-01?

**Estado de cierre:** `GOAL ACTIVO — NO COMPLETADO`

Motivo: existen slices funcionales importantes, pero permanecen abiertas las
invitaciones de usuarios, el deployment y la aceptación productiva.

Las PR #78, #79, #80, #81, #83, #84, #85, #86, #88, #89, #90, #92, #93, #94,
#95, #96, #97, #99, #101, #102, #103, #104, #105, #106, #107, #108 y #110 fueron fusionadas. #78 entregó el empaquetado de E1.1,
pero E1.1 aún requiere verificación de staging. #79 entregó y verificó E1.2
con migraciones, seed idempotente y rol runtime no privilegiado. #80 entregó las
comprobaciones de R2, correo real y readiness; su cierre requiere verificación
real en staging. #81 entregó E1.4, está fusionada y sus checks de CI y Browser
E2E están verdes. E3.4 fue fusionada en PR #88 y sus checks post-merge de `main`
están verdes. E4.1 fue fusionada en PR #89 y sus checks post-merge de `main` están
verdes. GOAL-01 permanece `ACTIVO`; M1 está `BLOQUEADO POR
INFRAESTRUCTURA EXTERNA` a la espera de la validación operativa de dominio, DNS,
Cloudflare, R2, correo, secretos, certificados y staging para E1.1 y E1.3. E3.1 entregó el recorrido
browser de empleados y quedó fusionada en PR #83; su recorrido usó únicamente
la autenticación, persistencia y frontera tenant ya existentes, sin requerir
staging, R2, correo ni una nueva decisión de dominio. E3.2 expuso el catálogo
y vínculo laboral del backend desde la interfaz, sin requerir staging, R2,
correo ni una nueva decisión de dominio, y quedó fusionada en PR #84 con CI y
Browser E2E verdes. Las invitaciones ya tienen un recorrido completo verificado
localmente con SMTP de prueba; la recepción y aceptación desde un buzón real
siguen pendientes. E4.1 ya fue implementada, auditada y fusionada en PR
#89; su recorrido de creación, preview y confirmación total/parcial quedó verificado
por CI y Browser E2E. E4.2 fue implementada, auditada y fusionada en PR #90:
el código de `main` rechazaba campañas inteligentes sin `documentTemplateId` y no
filtraba los empleados excluidos antes de crear contratos. La corrección usa sólo
los planes `CONFIRMADO`/`CONSUMIDO`, no requiere DNS, Cloudflare, R2 específico,

OCI Email Delivery ni staging. E4.3 quedó implementada y
fusionada en PR #92; el fallo post-merge del Browser E2E fue un selector estricto
en `employees-smoke`, no una regresión funcional del producto. E4.4 quedó fusionada
en PR #93, E4.6 en PR #94 y E5.1 en PR #95, todas con checks post-merge verdes.
E2.1 quedó fusionada en PR #96; las invitaciones permanecen separadas por su
dependencia de correo real. E4.5 quedó fusionada en PR #97 con checks
post-merge verdes. E4.7 quedó fusionada en PR #99 con checks post-merge verdes.
E5.2 quedó fusionada en PR #102, E5.3 en PR #103, E5.4 en PR #104, E6.1 en
PR #105, E6.2 en PR #106 y E6.3 en PR #108; E2.4 quedó fusionada en PR #110. Todas tienen checks post-merge de CI/Browser E2E verdes. E5.3 bloquea la eliminación
de documentos publicados, incluidos los manuales, y exige ADMIN/OPERADOR para
lectura, detalle, historial, descarga y carga; VIEWER sigue diferido conforme a
ADR-SEC-002. E5.4 audita las descargas directas del expediente, M5 queda
completado y E6.1 automatiza la generación diaria de alertas sin dependencia de
infraestructura externa.

> La determinación vigente, actualizada después de E2.4 y E6.3, queda documentada en
> la sección post-merge: E2.1, E2.4, E4.3, E4.4, E4.5, E4.6, E5.1, E5.2, E5.3, E5.4
> y E6.1/E6.2/E6.3 están fusionadas en PR #96, #92, #93, #97, #94, #95, #102,
> #103, #104, #105, #106, #108, #110 y ADR-007 en PR #107.
> GOAL-01 permanece `ACTIVO`; M1 sigue `BLOQUEADO POR INFRAESTRUCTURA EXTERNA` y
> E4.7 quedó fusionada en PR #99. La semántica de versionado e inmutabilidad fue
> aprobada en ADR-006 y ya gobierna E5.2/E5.3/E5.4. ADR-007 fue aprobado y ya
> gobierna E6.3. E2.4 quedó cerrada; M5 y M6 quedan completados; M7 queda reservado para el cierre final de
> despliegue y Go Live.
