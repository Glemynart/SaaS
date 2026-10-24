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

### Límites y dependencias pendientes

- E2.1 ya entrega la gestión directa de usuarios; E2.2 y E2.3 siguen pendientes
  porque las invitaciones y la recuperación requieren correo real;
- E4.1 ya permite crear, resolver y confirmar campañas inteligentes desde la UI;
- E4.2 ya procesa planes confirmados; E4.3, E4.4, E4.6 y E5.1 están fusionadas;
- el flujo exitoso de campaña inteligente hasta la descarga del PDF desde el expediente se verifica en `e2e/contractual-profiles-smoke.spec.ts`; snapshots confirmados y exclusiones también se comprueban en pruebas del API;
- la generación documental individual está disponible desde el detalle del contrato; la prueba browser incorporada en PR #125 recorre la generación, publicación en el expediente y descarga del PDF con nombre Unicode;
- el expediente ya permite carga manual, clasificación, descarga e historial/versionado;
  la auditoría e integración consistente del expediente quedaron entregadas en E5.4.
- E6.1 ya genera diariamente alertas de vencimientos y documentos faltantes; E6.2
  ya permite ampliar la bandeja y resolver alertas con trazabilidad; E6.3 ya hace
  visibles fallos, reintentos y auditoría operativa;
- existen smoke tests browser para recorridos funcionales, pero todavía no una
  única suite que pruebe el recorrido comercial completo en producción;
- no se ha verificado un deployment aislado y reproducible de staging ni existe
  evidencia de Go Live.

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

**Estado del Milestone:** `BLOQUEADO POR INFRAESTRUCTURA EXTERNA` porque el entorno
observado no es staging aislado ni reproducible. La inspección de solo lectura del
2026-10-24 confirmó que `staging-api.dusema.com` responde HTTP 200 en `/health` y
`/readiness`, pero la API corre en la única VPS clasificada como producción, comparte
la red Docker con PostgreSQL y usa `STORAGE_PROVIDER=local`. Inspecciones previas del
mismo entorno identificaron `oficina_nitida` como base compartida. Una consulta posterior a la
fusión de PR #123 reportó que el deployment Vercel
`dpl_xYJbtaq17GGjRqtSkGUQe1fib8Kz` (`saa-s-alde58gmf-glemynarts-projects.vercel.app`) tenía
target `Production` y el alias `staging.dusema.com`. La inspección más reciente, después de la
fusión de PR #125, confirma que el deployment actual es
`dpl_Bt5rJx8JEvYozAu83ojogVBJV3np`
(`saa-s-nn9yf611j-glemynarts-projects.vercel.app`), estado `READY`, target `Production`, y que
sus aliases incluyen `staging.dusema.com`. El deployment de GitHub `7299455677`, creado el
2026-10-24 13:47:37 UTC, vincula el SHA de merge
`53a6fb3eb5d6307fc255ddc8661e20ca2c7a6980` al entorno `Production`. Esta evidencia vincula el
deployment al merge de PR #125; no se ejecutó un comando manual de despliegue de Vercel. El
propietario confirmó que `staging.dusema.com` debe apuntar a un deployment `Preview` y autorizó
preparar, pero no ejecutar, la reasignación. El Preview observado para el commit
`c66e0f74adb2e51c3ac818db5ef4a7a6e9ffe95b` de PR #124 estaba `READY` en
`dpl_4mBn7eirb5fLTeFyisLS6WNrDAvJ`
(`saa-s-oudqxrvw0-glemynarts-projects.vercel.app`), target `preview`, sin el alias; corresponde a
un commit anterior a sincronizar la PR con `main`, así que debe revalidarse por SHA antes de usarlo.
En la revalidación del 2026-10-24, el HEAD observado entonces de PR #124 era
`bc111c930fa9116a74ebf9cabb80f0d40efc65c3`; su deployment era `dpl_9NzpXu3RofofqAer279ijnSScDBM`
(`saa-s-izym3kh5f-glemynarts-projects.vercel.app`), `READY`, target `preview`, sin el alias de
staging. El check Vercel asociado a ese HEAD enlaza al deployment; `vercel inspect --json` no
expuso `gitSource`. Sigue siendo un Preview de rama, no una fuente estable aprobada para el alias.
Una revalidación previa, el 2026-10-24 15:27 UTC, vincula el HEAD `14dd130ce0cfd15854ebbf72ff55d2c6df75862b`
de PR #124 con el deployment Vercel `dpl_3mdQChGgPfAQe8CpDNttQdiaEatX`
(`saa-s-cjomolfb6-glemynarts-projects.vercel.app`), `READY`, target `preview`; GitHub deployment
`7300586669` reporta `success` para ese SHA y URL. Vercel muestra un alias de rama generado, no
`staging.dusema.com`. Una solicitud HEAD pública terminó en HTTP 200 tras dos redirecciones. La
inspección del alias confirma que `staging.dusema.com` sigue asociado a
`dpl_Bt5rJx8JEvYozAu83ojogVBJV3np`, target `Production`. No se verificó que el Preview use una API
aislada; por ello no es todavía un destino aprobado para el alias.
Una revalidación posterior del 2026-10-24 19:09 UTC halló el Preview `dpl_4JisJHHvR3GfijTzNxsStLinPV6J`
`READY`, pero el acceso público redirigió a SSO y el host API no está verificado; sigue sin ser destino aprobado.
La revalidación del 2026-10-24 19:32 UTC confirma que el HEAD `4079226dd439dd53505d3d1cd3b5c43cdb634098`
de PR #124 tiene el Preview `dpl_4MKj1jsa7kovczxjft9x36bjTCZb`
(`saa-s-otkgzv3te-glemynarts-projects.vercel.app`), `READY`, pero un GET público sin
autenticación devuelve HTTP 302 a SSO; el alias `staging.dusema.com` sigue en el deployment
`Production` `dpl_Bt5rJx8JEvYozAu83ojogVBJV3np`. En el VPS, la API aún ejecuta el digest
`sha256:c03c3f11f75ed1c4cd4fca2a54941956de645e34bd0465995b2a222acade2b19`, revisión `14da89e…`,
healthy; health/readiness devuelven HTTP 200, pero el host no es staging aislado. El workflow de
imagen publicó con éxito el commit `f426b5668b7f86be1c52ffcd36243ebc8f60f1fd`; su manifiesto
`sha256:70c4aa819a5bd632aba02cd5600ad7a6eabff3453374df8ad6fb684bcc00b753` se pudo inspeccionar
desde el VPS, aunque no está desplegado. La configuración Preview del backend sigue sin verificar.
La revalidación Vercel del 2026-10-24 20:40 UTC asocia el HEAD actual
`e780941bdc9bc36fb11d222a0ea823f39dc159e4` de PR #124 al deployment
`dpl_9weqH1LJjAqawQG4HUy5TZFUnv2Z`, URL `saa-s-e7i7skujc-glemynarts-projects.vercel.app`,
estado `READY`, target `preview`, sin alias. La rama asociada es
`codex/reconcile-goal01-m1-runtime-evidence`; un GET anónimo devolvió HTTP 302. El alias
`staging.dusema.com` sigue en `dpl_Bt5rJx8JEvYozAu83ojogVBJV3np`, target `Production`. No se
consultaron valores de API ni se reasignó el alias; la Preview puntual no es destino estable, por lo
que M1 sigue abierto.

El detalle operativo está en [`deploy/README.md`](../../deploy/README.md#frontend-de-staging-en-vercel).
La lista de Preview incluye `API_URL` y
`NEXT_PUBLIC_API_URL`, pero sus valores no se leyeron. PR #123 y PR #125 no modificaron archivos de
`apps/web`. El
workflow API existente publica imágenes a GHCR, pero no despliega el stack de staging. El run
`40083400008` de `Publish API image`, para el SHA `0aa157e4f3593795d43568eabfbd3d80f778aea8`,
terminó correctamente; su log de build/push reportó el tag
`ghcr.io/glemynart/saas/api:sha-0aa157e4f3593795d43568eabfbd3d80f778aea8` con digest
`sha256:91d984da4559f95bc109e731b09caa06efb87da672b5ce62f2c8202f7cb941ee`. El run
`40099584454` de `Publish API image`, para el merge SHA
`53a6fb3eb5d6307fc255ddc8661e20ca2c7a6980`, terminó correctamente; el log del push reportó el
manifiesto del tag
`ghcr.io/glemynart/saas/api:sha-53a6fb3eb5d6307fc255ddc8661e20ca2c7a6980` con digest
`sha256:fcdca7a8496be040db458eb8e9905bb66bdd8ebea5d831d43f0f8a6546ae4651`. La inspección SSH de
solo lectura del 2026-10-24 confirmó que el Compose activo está en
`/home/ubuntu/la-oficina-nitida/staging/docker-compose.yml`; el contenedor
`la-oficina-nitida-staging-api-1` está `healthy` y usa el RepoDigest
`sha256:c03c3f11f75ed1c4cd4fca2a54941956de645e34bd0465995b2a222acade2b19`, con revisión OCI
`14da89e6d3f8ab19b38b8696776651fc6da79466`. GET a `/health` y `/readiness` respondieron HTTP 200.
Una inspección SSH filtrada adicional (2026-10-24 14:57 UTC) reconfirmó ese digest/revisión,
`DATABASE_URL` hacia `oficina_nitida` con el rol `saas_api_runtime`, `STORAGE_PROVIDER=local` y el
bind mount de uploads `/home/ubuntu/la-oficina-nitida/staging/uploads:/app/uploads`. Las cuatro
variables requeridas de R2 no estaban presentes con valor. Los nombres de configuración SMTP y
`REQUIRE_REAL_EMAIL` sí estaban presentes, pero no se leyeron valores ni se envió correo; esto no
verifica entrega SMTP. En ese momento `/health` devolvió HTTP 200 y `/readiness` devolvió HTTP 200
con estado `ready`. La inspección SSH del mismo día confirmó que el proyecto Compose activo
`la-oficina-nitida-staging` contiene API y Caddy; Caddy publica 80/443, monta
`/home/ubuntu/la-oficina-nitida/staging/Caddyfile` y enruta `staging-api.dusema.com` a `api:4000`.
La configuración versionada de PR #124 se ajustó para usar el proyecto distinto
`dusema-staging-isolated`, solo el servicio API y el alias `dusema-staging-api`; aún no está
desplegada.
El Docker client del VPS leyó el manifiesto del digest nuevo (`linux/amd64` y `linux/arm64`) sin
descargar capas; esto confirma acceso al artefacto, no su despliegue. La identidad concreta usada
por Docker no se inspeccionó. Estos artefactos y respuestas HTTP no certifican el entorno. Este
estado pertenece a M1; no convierte al
Goal en bloqueado. GOAL-01 permanece `ACTIVO`.

La revalidación SSH de solo lectura del 2026-10-24 19:51 UTC confirmó que la red externa
`la-oficina-nitida_laoficina` conecta PostgreSQL, Redis, la API actual y Caddy; una API nueva que
use el Compose preparado compartiría esa red. El catálogo de PostgreSQL mostró que `PUBLIC`
conserva `CONNECT` sobre `oficina_nitida`, por lo que un nuevo rol runtime en el mismo cluster
heredaría ese permiso y el bootstrap lo rechaza. No se modificaron ACLs. El propietario confirmó
mantener bloqueada la creación de base/rol hasta revisión DBA, que deberá aprobar el mecanismo de
aislamiento antes de cualquier escritura. El detalle está en [`deploy/README.md`](../../deploy/README.md).

La revalidación Vercel posterior del 2026-10-24 confirma que `staging.dusema.com` aún apunta al
deployment `Production` `dpl_Bt5rJx8JEvYozAu83ojogVBJV3np`. El HEAD `054203bf117d89c55dce8cb8da39e9dd1f59e5ab`
de PR #124 sí tiene un deployment `Preview` `READY` (`dpl_AqG1T1LodrsMJoxq12oScZKV92GE`), pero un
GET anónimo redirige a SSO y no se verificó su backend. El propietario indicó que el alias debe usar
`Preview` y autorizó preparar, no ejecutar, su reasignación. No se cambió el alias; el Preview de la
rama abierta no se considera fuente estable ni evidencia de smoke funcional. M1 continúa bloqueado.

- [ ] E1.1 — Staging reproducible, configuración y secretos.
- [x] E1.2 — Migraciones, seed y rol PostgreSQL runtime no privilegiado.
- [ ] E1.3 — R2, correo real y health/readiness checks.
- [x] E1.4 — CI, observabilidad y base de pruebas browser end-to-end.

E1.4 se fusionó en `main` como PR #81, con los checks de CI y Browser E2E
verdes y auditoría `APROBADO PARA MERGE`. E1.3 también está fusionada y sus
rutas `/health` y `/readiness` son la base de los smoke tests; ambas respondieron
HTTP 200 durante la inspección indicada arriba. La verificación real de R2 y correo
de E1.3, junto con el aislamiento, despliegue reproducible, rollback y smoke
autenticado de E1.1, sigue pendiente. El HTTP 200 solo confirma la respuesta de esos
endpoints en ese momento. M1 no desbloquea el camino de M2 que requiere deployment
y correo, pero esta dependencia no bloquea los caminos independientes del Goal.

La evidencia de 2026-10-24 reemplaza el diagnóstico histórico que decía que no
existían una URL de staging ni un workflow API: la API pública y el workflow de
publicación GHCR sí existen, pero no proporcionan staging aislado ni un despliegue
reproducible del stack. No se verificó que las credenciales estén separadas entre
entornos. Esta sigue siendo una dependencia operativa externa pendiente, no una
decisión de arquitectura. La prioridad se reevalúa como un grafo de dependencias:
M3 puede avanzar sin staging, R2, correo ni una decisión de dominio pendiente.

### M2 — Gestión de Organizaciones y Usuarios

**Resultado verificable:** un cliente opera con varias personas sin compartir credenciales.

- [x] E2.1 — Gestión directa de usuarios: creación administrada, listado,
      edición de datos, roles ADMIN/OPERADOR y activación/desactivación (PR #96
      fusionada y verificada por CI/Browser E2E).
- [ ] E2.2 — Invitaciones y alta por correo (depende de correo real).
- [ ] E2.3 — Recuperación de acceso real por correo (depende de correo real).
- [x] E2.4 — Sedes, identidad y promesa multiempresa coherente con el producto real (PR #110
      fusionada; checks post-merge de CI/Browser E2E verdes).

E2.1 no envía correo: un ADMIN crea y administra directamente las cuentas con
credenciales entregadas por el canal operativo acordado. E2.2 queda separado
porque el flujo de invitación y activación por enlace requiere correo real.

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

- [ ] E7.1 — Backup y restauración probados.
- [ ] E7.2 — Monitoreo, alertamiento técnico y soporte operativo.
- [ ] E7.4 — Onboarding y aceptación del cliente piloto con datos representativos.
- [ ] E7.5 — Primer tenant productivo listo para operación comercial sostenida.

La consulta SSH de solo lectura del 2026-10-24 confirmó que el timer
`dusema-postgres-backup.timer` sigue activo y disparó el servicio el 2026-10-24
07:00:04 UTC. El servicio terminó con `Result=success` y estado de salida 0; el
journal registra el objeto cifrado `postgres/dusema-oficina_nitida-20261024T020004-0500-yGA63y.dump.gpg`,
su SHA-256 `844e36ff4d8a1979a4fbd507214d069e82a610fa36bd449b41f9668c7627f067`, aceptación de OCI
y verificación de checksum por el script. El objeto no se descargó y su acceso actual no se
verificó: el cliente OCI no está instalado en la VPS ni en el equipo de revisión. No se halló
evidencia independiente revisable de la restauración manual reportada. La ruta de uploads se
midió en 0 bytes en esa observación y está en `/dev/sda1` bajo `/`; esto no prueba cobertura ni
recuperación desde las copias OCI del volumen. E7.1 permanece abierta hasta verificar objeto,
restauración aislada y protección recuperable de uploads.

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

| PR      | Epic  | Propósito                                                                 | Estado     | ¿Cierra capacidad?                                         |
| ------- | ----- | ------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------- |
| #78     | E1.1  | Imágenes reproducibles de staging para API y Web.                         | FUSIONADO  | No; E1.1 requiere verificación de staging.                 |
| #79     | E1.2  | Migraciones, seed y rol runtime PostgreSQL no privilegiado.               | FUSIONADO  | Sí; E1.2 verificada localmente y en DB limpia.             |
| #80     | E1.3  | R2, correo real y health/readiness checks.                                | FUSIONADO  | No; requiere verificación real en staging.                 |
| #81     | E1.4  | CI, observabilidad y base de pruebas browser end-to-end.                  | FUSIONADO  | Sí; CI y Browser E2E verificados; M1 aún requiere staging. |
| #83     | E3.1  | Verificación browser del CRUD, búsqueda e importación XLSX de empleados.  | FUSIONADO  | Sí; recorrido verificado browser.                          |
| #84     | E3.2  | Perfiles contractuales y vínculos laborales precontractuales desde la UI. | FUSIONADO  | Sí; recorrido verificado por CI y Browser E2E.             |
| #86     | E3.3  | Configuración perfil → tipo documental → plantilla desde UI.              | FUSIONADO  | Sí; CI/Browser E2E y checks post-merge verdes.             |
| #88     | E3.4  | Feedback accionable para errores, bloqueos y reintentos operativos.       | FUSIONADO  | Sí; CI/Browser E2E post-merge verdes.                      |
| #89     | E4.1  | Creación, preview y confirmación total/parcial desde frontend.            | FUSIONADO  | Sí; CI/Browser E2E post-merge verdes.                      |
| #90     | E4.2  | Procesamiento de planes confirmados y exclusiones desde la campaña.       | FUSIONADO  | Sí; CI/Browser E2E verdes.                                 |
| #92     | E4.3  | Perfil y snapshots confirmados preservados en contrato y documento.       | FUSIONADO  | Sí; CI y Browser E2E verdes.                               |
| #93     | E4.4  | PDF canónico vinculado al contrato y publicado en expediente.             | FUSIONADO  | Sí; CI y Browser E2E post-merge verdes.                    |
| #94     | E4.6  | Contratación individual completa desde la UI.                             | FUSIONADO  | Sí; CI y Browser E2E post-merge verdes.                    |
| #95     | E5.1  | Subida manual y validación de archivos en expediente.                     | FUSIONADO  | Sí; CI y Browser E2E verdes post-merge.                    |
| #96     | E2.1  | Gestión directa de usuarios sin invitaciones por correo.                  | FUSIONADO  | Sí; CI y Browser E2E post-merge verdes.                    |
| #97     | E4.5  | Reintentos selectivos, idempotencia y errores parciales.                  | FUSIONADO  | Sí; CI y Browser E2E post-merge verdes.                    |
| #99     | E4.7  | Prueba browser del caso exitoso, parcial y reintentado.                   | FUSIONADO  | Sí; CI y Browser E2E post-merge verdes; no depende de M1.  |
| #102    | E5.2  | Familias documentales, revisiones, consulta, descarga e historial.        | FUSIONADO  | Sí; CI y Browser E2E post-merge verdes.                    |
| #103    | E5.3  | Inmutabilidad de publicaciones y permisos por rol en expediente.          | FUSIONADO  | Sí; CI y Browser E2E post-merge verdes.                    |
| #104    | E5.4  | Auditoría de descargas e integración documental consistente.              | FUSIONADO  | Sí; CI y Browser E2E post-merge verdes.                    |
| #105    | E6.1  | Scheduler diario de vencimientos y documentos faltantes.                  | FUSIONADO  | Sí; CI y Browser E2E post-merge verdes.                    |
| #106    | E6.2  | Dashboard accionable y resolución trazable.                               | FUSIONADO  | Sí; CI y Browser E2E post-merge verdes.                    |
| #108    | E6.3  | Fallos, reintentos y auditoría visibles para operación.                   | FUSIONADO  | Sí; CI y Browser E2E post-merge verdes.                    |
| #110    | E2.4  | Sedes, identidad y promesa multiempresa coherente con el producto real.   | FUSIONADO  | Sí; CI y Browser E2E post-merge verdes.                    |
| #69–#76 | E3/E4 | Fundaciones de resolución, planes, generación y dominio inteligente.      | FUSIONADOS | No; el recorrido inteligente sigue abierto.                |

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
Browser E2E verdes. Las invitaciones quedan pendientes porque su recorrido completo
requiere correo real. E4.1 ya fue implementada, auditada y fusionada en PR
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
