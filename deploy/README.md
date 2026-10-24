# Deployment de staging del API

Este directorio contiene el empaquetado reproducible y la operación de staging
del API NestJS. El despliegue objetivo usa Vercel para el frontend y el VPS
existente para `apps/api`.

## Aplicabilidad al VPS observado

El único VPS está clasificado como producción. La inspección SSH de solo lectura
del 2026-10-24 confirmó el proyecto Compose activo `la-oficina-nitida-staging`
en `/home/ubuntu/la-oficina-nitida/staging/docker-compose.yml`, con API y Caddy.
Caddy publica los puertos 80/443, monta
`/home/ubuntu/la-oficina-nitida/staging/Caddyfile` y actualmente enruta
`staging-api.dusema.com` a `api:4000`.

El Compose versionado usa ahora el proyecto independiente
`dusema-staging-isolated`, contiene solo la API y le asigna el alias de red
`dusema-staging-api`. Así puede convivir con el proyecto observado sin
reemplazar su contenedor API ni intentar publicar de nuevo 80/443. No se ha
desplegado. La API nueva debe validarse antes de cambiar la ruta del Caddy
existente; no inicies otro Caddy en este VPS ni ejecutes los comandos de este
runbook hasta que estén satisfechos los prerrequisitos y exista aprobación
operativa.

## Frontend de staging en Vercel

El propietario confirmó el 2026-10-24 que `staging.dusema.com` debe apuntar a
un deployment `Preview` y autorizó preparar, pero no ejecutar, la reasignación.
La observación más reciente sigue mostrando ese dominio asociado a un deployment
`Production`. Los deployments Preview de ramas de PR sirven para revisión, pero
no se deben tomar automáticamente como fuente estable del dominio de staging.
El 2026-10-24, el HEAD `2d71c1b7698f228f1cc72e98e3c1a3f99e1c17db` de PR #124 tuvo el deployment
`dpl_EVBmciWFFdwCNMokxjN5YpSQoW4T` (`saa-s-3lael1jxt-glemynarts-projects.vercel.app`) en estado
`READY`, target `preview`, sin el alias de staging. El registro de deployment de GitHub
`7299996953` vincula ese entorno Preview y esa URL al SHA indicado y reporta `success`; la
inspección JSON de Vercel no expuso `gitSource`. El GET público de la URL devolvió HTTP 200, lo que
solo confirma respuesta de la página y no la integración funcional con la API. Es un Preview de
rama y aún no está aprobado como destino estable. Tampoco se verificó que su configuración apunte a
una API aislada.

Revalidación del 2026-10-24 15:27 UTC: el HEAD `14dd130ce0cfd15854ebbf72ff55d2c6df75862b` de
PR #124 está asociado al deployment Vercel `dpl_3mdQChGgPfAQe8CpDNttQdiaEatX`
(`saa-s-cjomolfb6-glemynarts-projects.vercel.app`), `READY`, target `preview`; el registro de
deployment de GitHub `7300586669` enlaza ese SHA y URL y reporta `success`. Vercel muestra el alias
de rama generado, pero no `staging.dusema.com`. Una solicitud HEAD pública terminó en HTTP 200
después de dos redirecciones. La inspección simultánea del alias confirma que
`staging.dusema.com` sigue en `dpl_Bt5rJx8JEvYozAu83ojogVBJV3np`, target `production`. El estado
HTTP y `READY` no prueban integración funcional; no se verificó que el Preview use una API aislada.

Revalidación del 2026-10-24 16:46 UTC: para el HEAD `3c6c25306775011d2a8afdabd06ca6f4482e86fe`
de PR #124, Vercel reporta `dpl_CXe4T5adjgMbyjcv8Z3rEyKhHV4w`
(`saa-s-78j7dpa9c-glemynarts-projects.vercel.app`) en estado `READY`, target `preview`, sin el
alias `staging.dusema.com`. El alias continúa en `dpl_Bt5rJx8JEvYozAu83ojogVBJV3np`, target
`production`, estado `READY`. El listado de variables Preview del proyecto `saa-s-web` muestra
`API_URL` y `NEXT_PUBLIC_API_URL` dirigidas a Preview y Production, pero no devuelve sus valores;
por ello no confirma el hostname del backend ni su aislamiento. No reasignes el alias hasta verificar
el destino de ambas variables por un canal autorizado que no publique sus valores.

Revalidación del 2026-10-24 19:09 UTC: el HEAD `afd8aa4eef02b31550d4f1e49712aff1f92e7b1e`
de PR #124 tiene el deployment `dpl_4JisJHHvR3GfijTzNxsStLinPV6J`
(`saa-s-fhdrdqdrr-glemynarts-projects.vercel.app`), `READY`, target `preview`; el deployment
de GitHub `7302331717` reporta `success` para ese SHA y URL. Un GET sin autenticación devolvió
HTTP 302 a `vercel.com/sso-api` (se omitió la query), así que no se confirmó acceso de navegador
sin SSO. `API_URL` y `NEXT_PUBLIC_API_URL` aparecen en el entorno Preview, pero sus valores no
se consultaron y el host API sigue sin verificarse. Este es un Preview de la rama abierta de PR #124,
no una fuente estable aprobada. El alias sigue en `dpl_Bt5rJx8JEvYozAu83ojogVBJV3np`, target
`production`. No se reasignó; la API actual tampoco está aislada de `oficina_nitida`.

Revalidación del 2026-10-24 19:32 UTC: el HEAD `4079226dd439dd53505d3d1cd3b5c43cdb634098`
de PR #124 está asociado al deployment GitHub `7303372602` y al deployment Vercel
`dpl_4MKj1jsa7kovczxjft9x36bjTCZb`
(`saa-s-otkgzv3te-glemynarts-projects.vercel.app`), `READY`, target `preview`. El alias
generado pertenece a la rama; no es `staging.dusema.com`. Un GET público sin autenticación
devolvió HTTP 302 a `vercel.com/sso-api`. La inspección Vercel del dominio confirma que
`staging.dusema.com` permanece en `dpl_Bt5rJx8JEvYozAu83ojogVBJV3np`, `READY`, target
`production`. No se reasignó el alias.

Revalidación posterior del 2026-10-24: Vercel confirma que `staging.dusema.com` continúa en
`dpl_Bt5rJx8JEvYozAu83ojogVBJV3np` (`saa-s-nn9yf611j-glemynarts-projects.vercel.app`), `READY`,
target `production`. Para el HEAD `054203bf117d89c55dce8cb8da39e9dd1f59e5ab` de la rama abierta
`codex/reconcile-goal01-m1-runtime-evidence`, el deployment Preview candidato es
`dpl_AqG1T1LodrsMJoxq12oScZKV92GE`
(`saa-s-i28wtm98u-glemynarts-projects.vercel.app`), `READY`, creado a las 19:58:24 UTC y sin el
alias de staging. Los checks `verify`, `browser`, `Vercel` y `Vercel Preview Comments` de PR #124
terminaron correctamente antes de las 20:02:17 UTC. Un GET anónimo al deployment Preview devolvió
HTTP 302 hacia la protección SSO de Vercel; se omitieron parámetros de la redirección. El propietario
confirmó que el dominio debe usar `Preview` y autorizó preparar, pero no ejecutar, la reasignación.
Este deployment sigue ligado a una rama de PR, el acceso SSO no está resuelto para el operador del
cliente y no se verificó que la configuración Preview de API apunte a un backend aislado. Por tanto,
no es todavía un destino estable aprobado; el alias no se modificó y M1 sigue abierto.

Revalidación del 2026-10-24 20:40 UTC: el HEAD `e780941bdc9bc36fb11d222a0ea823f39dc159e4` de
esta PR tiene el Preview `dpl_9weqH1LJjAqawQG4HUy5TZFUnv2Z`
(`saa-s-e7i7skujc-glemynarts-projects.vercel.app`), `READY`, target `preview`, sin alias. El listado
Vercel vincula el deployment al SHA y a la rama `codex/reconcile-goal01-m1-runtime-evidence`; un GET
anónimo devolvió HTTP 302 y no se siguió la redirección. El dominio `staging.dusema.com` sigue en
`dpl_Bt5rJx8JEvYozAu83ojogVBJV3np`, `READY`, target `production`. Los valores de configuración API no
se consultaron; la rama de la PR y el deployment puntual no son una fuente estable aprobada. No se
reasignó el alias.

La inspección SSH de solo lectura del mismo momento confirmó que el contenedor
`la-oficina-nitida-staging-api-1` sigue ejecutando el digest
`sha256:c03c3f11f75ed1c4cd4fca2a54941956de645e34bd0465995b2a222acade2b19`, con revisión OCI
`14da89e6d3f8ab19b38b8696776651fc6da79466`, estado `running` y health `healthy`. GET públicos a
`/health` y `/readiness` devolvieron HTTP 200. Esto no demuestra aislamiento: el host sigue
clasificado como producción y la inspección de configuración anterior identificó la base
compartida `oficina_nitida` y almacenamiento local.

El workflow `Publish API image` (run `40122527410`) terminó correctamente para el merge SHA
`f426b5668b7f86be1c52ffcd36243ebc8f60f1fd`. La inspección de manifiesto desde el Docker client
del VPS, sin descargar capas, resolvió el tag SHA de ese commit al digest
`sha256:70c4aa819a5bd632aba02cd5600ad7a6eabff3453374df8ad6fb684bcc00b753`. El contenedor
existente continúa en el digest anterior `c03c3f…`; el artefacto nuevo no está desplegado.
Los valores de `API_URL` y `NEXT_PUBLIC_API_URL` de Vercel Preview siguen sin verificarse.

Antes de cambiar el alias:

1. Selecciona una revisión estable aprobada para Preview e identifica su SHA,
   URL, estado `READY` y target `preview` con Vercel.
2. Confirma en la configuración Preview que `API_URL` y `NEXT_PUBLIC_API_URL`,
   si están definidas, apuntan a la API aislada de staging. Las rutas server-side
   usan `API_URL ?? NEXT_PUBLIC_API_URL`, de modo que verificar solo la variable
   pública no confirma el destino del BFF. No publiques valores de variables en
   logs, tickets ni Git. La API no debe conectarse a `oficina_nitida` ni reutilizar
   su rol runtime.
3. Registra el deployment y alias actuales para poder volver atrás. Comprueba
   que el backend aislado esté listo antes de dirigir usuarios al nuevo frontend.
4. Después de la autorización operativa para ejecutar el cambio, asigna el
   alias al deployment Preview elegido y verifica el resultado:

   ```bash
   vercel alias set "<preview-deployment-url-aprobada>" staging.dusema.com --scope glemynarts-projects
   vercel inspect staging.dusema.com --json --scope glemynarts-projects
   ```

   La inspección debe mostrar el deployment esperado con estado `READY` y target
   `preview`. La respuesta HTTP y TLS por sí solas no prueban el aislamiento del
   backend ni la configuración de correo y storage.

El rollback del alias usa la URL del deployment que se registró justo antes del
cambio:

```bash
vercel alias set "<deployment-anterior-registrado>" staging.dusema.com --scope glemynarts-projects
```

No uses una URL anotada previamente como rollback si el alias cambió después;
captura el mapeo inmediatamente antes de cada reasignación.

## Alcance

- `deploy/Dockerfile.api` construye la imagen del API y deja Chromium
  disponible para el renderer PDF.
- `deploy/docker-compose.staging.yml` ejecuta únicamente `api`; reutiliza el
  Caddy existente tras una actualización de ruta aprobada.
- PostgreSQL y Redis son infraestructura existente y no forman parte del
  Compose de staging.
- La imagen se publica en GHCR para que el VPS no necesite Git ni un build
  local.
- El primer despliegue no ejecuta migraciones ni seed automáticamente.

La imagen API se construye desde la raíz del repositorio con
`pnpm install --frozen-lockfile`. El Dockerfile genera Prisma y compila el
entrypoint `apps/api/dist/src/main.js`. Los archivos `.env` no se incluyen en
el contexto ni en la imagen.

## Imagen GHCR

`.github/workflows/api-image.yml` publica una imagen multi-arquitectura para
`linux/amd64` y `linux/arm64`. Cada ejecución publica un tag inmutable basado
en el commit:

```text
ghcr.io/OWNER/REPOSITORY/api:sha-COMMIT_SHA
```

El VPS debe consumir ese tag o, preferiblemente, el digest asociado. No se
usa `latest` ni se depende de un tag mutable `staging`.

El paquete de GHCR debe permitir lectura desde el VPS. El login del VPS se
realiza con una credencial de solo lectura gestionada fuera del repositorio.

## Configuración del VPS

El VPS debe conservar estos contenedores y datos sin recrearlos:

- PostgreSQL: contenedor `postgres`. La base observada `oficina_nitida` está
  compartida con el entorno clasificado como producción; no debe usarse como
  base de staging.
- Redis: contenedor `redis`, sin uso por la versión actual del API.
- Red Docker existente: `la-oficina-nitida_laoficina`.

Antes de iniciar la aplicación, verifica manualmente en el VPS que la red
exista y que PostgreSQL esté conectado a ella. No crees una red alternativa.
Staging requiere una base propia y un rol runtime dedicado. No reutilices
`oficina_nitida` ni el rol existente `saas_api_runtime`: el segundo es una
identidad de runtime del entorno actual y el bootstrap de este directorio puede
cambiar la contraseña del rol indicado. El propietario y DBA deben definir y
verificar las identidades y la base antes de ejecutar los comandos de esta guía.
La URL runtime tendrá esta forma, con los marcadores sustituidos por valores
aprobados fuera de Git:

```text
postgresql://REPLACE_WITH_STAGING_RUNTIME_ROLE:<password>@postgres:5432/REPLACE_WITH_APPROVED_STAGING_DATABASE?schema=public
```

No hay una base de staging confirmada en el PostgreSQL compartido. Antes de
continuar, el DBA debe proporcionar una base separada y verificar que el rol
runtime de staging no puede leer ni modificar `oficina_nitida`. No ejecutes
migraciones, seed ni el bootstrap contra la base o el rol del entorno actual.
Crear una base y roles dentro de la instancia compartida requiere un
procedimiento aprobado. El bootstrap crea el rol runtime en su primera ejecución
y lo marca con un comentario no secreto; en ejecuciones posteriores solo
reconfigura un rol existente si conserva esa marca. También cambia privilegios
del esquema en la base seleccionada. No debe ejecutarse contra el PostgreSQL
compartido sin que el DBA revise y apruebe explícitamente sus efectos.

El Compose usa la red externa ya existente:

```yaml
networks:
  la-oficina-nitida:
    external: true
    name: la-oficina-nitida_laoficina
```

La API no publica el puerto `4000`. El servicio usa la red externa existente y
el alias `dusema-staging-api`; Caddy debe apuntar a ese alias solo después de
validar la API aislada. El Compose de staging no publica puertos del host.

Revalidación SSH de solo lectura del 2026-10-24 19:51 UTC: la red externa
`la-oficina-nitida_laoficina` existe y conecta `postgres`, `redis`, el contenedor API actual y
Caddy. El Compose nuevo también conectaría la API de staging a esa red; separar el proyecto
Compose no crea aislamiento de red y la API podría alcanzar el servicio PostgreSQL existente.
Una consulta de solo lectura al catálogo de PostgreSQL confirmó que `oficina_nitida` conserva la
ACL `{=Tc/oficina,oficina=CTc/oficina,saas_api_runtime=c/oficina}`: `PUBLIC` todavía tiene
`CONNECT` y `TEMPORARY`. Por eso un rol runtime nuevo en el mismo cluster heredaría `CONNECT` y el
bootstrap lo rechaza. Una consulta de catálogo adicional (19:57 UTC) mostró solo dos roles
`LOGIN`: `oficina` (superuser) y `saas_api_runtime` (sin `SUPERUSER`, `CREATEDB`, `CREATEROLE` ni
`BYPASSRLS`); ambos tienen grants explícitos de `CONNECT`. Esto acota el impacto observable actual
de una revocación, pero el DBA debe validar también los consumidores operativos antes de decidir.
No se modificó ninguna ACL. Antes de crear la base o el rol de
staging, el DBA debe aprobar y verificar una ACL por base que quite el acceso heredado de
`PUBLIC` conservando los grants operativos explícitos, o el propietario debe elegir un cluster
PostgreSQL separado.

## Archivos en el VPS

Una estructura sugerida, sin tocar los directorios de datos existentes, es:

```text
/home/ubuntu/la-oficina-nitida/
├── staging/                         # Compose/Caddy activos; preservar
│   └── Caddyfile
├── staging-isolated/                # destino propuesto; aún no creado/verificado
│   ├── .env
│   ├── docker-compose.staging.yml
│   └── postgres/bootstrap-runtime-role.sql
├── postgres/data/
└── redis/data/
```

`staging-isolated/` es una ubicación propuesta, no una ruta observada ni creada.
El archivo `.env` se creará allí, solo con autorización operativa, a partir de
`deploy/staging.env.example` y quedará fuera de Git. El Compose versionado fija
R2 como almacenamiento obligatorio y no monta directorios locales de uploads;
no conectes rutas locales compartidas con el servicio existente o producción.

Variables mínimas para staging:

```env
API_IMAGE=ghcr.io/OWNER/REPOSITORY/api:sha-COMMIT_SHA
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://REPLACE_WITH_STAGING_RUNTIME_ROLE:<password>@postgres:5432/REPLACE_WITH_APPROVED_STAGING_DATABASE?schema=public
JWT_SECRET=<secret-long-random>
FRONTEND_URL=https://staging.dusema.com
BACKEND_URL=https://staging-api.dusema.com
ALLOWED_ORIGINS=https://staging.dusema.com
STORAGE_PROVIDER=r2
R2_ENDPOINT=https://REPLACE_WITH_ACCOUNT_ID.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=<staging-access-key-id>
R2_SECRET_ACCESS_KEY=<staging-secret-access-key>
R2_BUCKET=<private-staging-bucket>
EMAIL_SMTP_HOST=smtp.email.sa-bogota-1.oci.oraclecloud.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USER=<smtp-username>
EMAIL_SMTP_PASSWORD=<smtp-password>
EMAIL_SMTP_SECURE=false
EMAIL_SMTP_REQUIRE_TLS=true
EMAIL_FROM=no-reply@dusema.com
EMAIL_FROM_NAME=<display-name>
REQUIRE_REAL_EMAIL=true
```

El Compose versionado fija `STORAGE_PROVIDER=r2`, requiere las cuatro variables
R2 anteriores y fija `REQUIRE_REAL_EMAIL=true`. El bucket debe ser privado y
dedicado a staging. Las claves de R2 y las credenciales SMTP de OCI deben
existir únicamente en el `.env` privado del VPS; no deben entrar en Git.

## Caddy existente

El Caddy activo pertenece al proyecto `la-oficina-nitida-staging`, publica
80/443 y monta `/home/ubuntu/la-oficina-nitida/staging/Caddyfile` en
`/etc/caddy/Caddyfile`. La inspección de solo lectura encontró que la ruta de
`staging-api.dusema.com` usa `reverse_proxy api:4000`. El archivo versionado
`deploy/caddy/Caddyfile` contiene la ruta deseada hacia
`dusema-staging-api:4000`; es una referencia para ese bloque, no autorización
para sobrescribir el Caddyfile activo completo.

Después de validar la API nueva en la red interna y obtener aprobación para el
cutover, el operador debe preservar el Caddyfile actual, modificar únicamente
el destino `reverse_proxy` del sitio de staging, validar la configuración y
recargar el Caddy existente. Si falla, debe restaurar el destino anterior
`api:4000` y recargarlo. No inicies un segundo Caddy ni vuelvas a publicar
80/443 desde el Compose de staging.

## Primer despliegue

El procedimiento debe ejecutarse manualmente en el VPS. No se debe ejecutar
`docker compose down` sobre el Compose que administra PostgreSQL o Redis.

1. Autentica Docker contra GHCR y descarga la imagen indicada por `API_IMAGE`.
2. Confirma la arquitectura ARM64, la red Docker existente, la base de staging
   separada y el rol runtime dedicado. Si la base o el rol aún no fueron
   aprobados y comprobados contra el acceso a `oficina_nitida`, detén el
   procedimiento.
3. Confirma que existe un backup utilizable antes de cambiar el esquema.
4. Confirma que el bucket R2 privado de staging y su identidad restringida estén
   provisionados y validados para lectura y escritura de objetos.
5. Copia el Compose y este SQL al directorio propuesto
   `/home/ubuntu/la-oficina-nitida/staging-isolated/`, junto con su `.env`
   privado. No sobrescribas el Compose, `.env` ni `Caddyfile` de `staging/`.
6. Valida la configuración sin iniciar servicios:

   ```bash
   docker compose \
     --project-name dusema-staging-isolated \
     --env-file /home/ubuntu/la-oficina-nitida/staging-isolated/.env \
     -f /home/ubuntu/la-oficina-nitida/staging-isolated/docker-compose.staging.yml \
     config >/dev/null
   ```

7. Levanta solamente la API aislada. Este comando no ejecuta migraciones ni
   seed y no cambia la ruta pública del Caddy existente:

   ```bash
   docker compose \
     --project-name dusema-staging-isolated \
     --env-file /home/ubuntu/la-oficina-nitida/staging-isolated/.env \
     -f /home/ubuntu/la-oficina-nitida/staging-isolated/docker-compose.staging.yml \
     up -d api
   ```

8. Verifica el estado de la API aislada y sus endpoints locales sin imprimir
   los cuerpos de respuesta. El hostname público sigue apuntando a la API
   anterior hasta un cutover posterior aprobado del Caddy existente:

   ```bash
   docker compose \
     --project-name dusema-staging-isolated \
     --env-file /home/ubuntu/la-oficina-nitida/staging-isolated/.env \
     -f /home/ubuntu/la-oficina-nitida/staging-isolated/docker-compose.staging.yml \
     ps

   docker compose \
     --project-name dusema-staging-isolated \
     --env-file /home/ubuntu/la-oficina-nitida/staging-isolated/.env \
     -f /home/ubuntu/la-oficina-nitida/staging-isolated/docker-compose.staging.yml \
     exec -T api node -e "Promise.all(['/health','/readiness'].map(async path => { const response = await fetch('http://127.0.0.1:4000' + path); console.log(path + ' ' + response.status); if (!response.ok) process.exitCode = 1; })).catch(() => { console.error('Local API check failed'); process.exitCode = 1; })"
   ```

El healthcheck de Compose consulta `/health`. `/readiness` valida PostgreSQL,
el proveedor de storage configurado y que exista un transporte SMTP cuando
`REQUIRE_REAL_EMAIL=true`. Esa respuesta no comprueba la entrega de un mensaje:
M1 aún requiere enviar y recibir un correo real y validar el acceso autorizado a
R2 desde el entorno publicado.

## Migraciones y seed: operación explícita

No se ejecutan durante `up`. Solo después de confirmar que la base es staging,
que existe un backup y que las credenciales son correctas, se ejecutan como
operaciones one-off.

Este procedimiento es una plantilla, no está autorizado para la instancia
compartida actual. El DBA debe definir el procedimiento y la identidad de
bootstrap/migración después de revisar los privilegios de ámbito de instancia
que requiere `CREATE ROLE`; no presupongas que ese privilegio se puede limitar a
una sola base. No asumas que `oficina` es adecuada ni reutilices
`saas_api_runtime`; el script crea o altera roles a nivel de instancia y aplica
privilegios del esquema en la base seleccionada. Sustituye la base y el rol de
staging por valores aprobados antes de ejecutar cualquier comando. El SQL es
idempotente y no recrea PostgreSQL:

En PostgreSQL 17, las bases conceden `CONNECT` y `TEMPORARY` a `PUBLIC` por
defecto ([documentación oficial de privilegios](https://www.postgresql.org/docs/17/ddl-priv.html)).
Por eso una base y un rol separados no garantizan por sí solos que el runtime no
pueda conectarse a `oficina_nitida`. El bootstrap ahora se ejecuta en una
transacción y falla si el destino es `oficina_nitida`, si se intenta reutilizar
`saas_api_runtime` o si el rol de staging todavía tiene `CONNECT` a la base
protegida. En la base de staging revoca `CONNECT` de `PUBLIC`, otorga conexión
explícita al rol runtime y falla si `saas_api_runtime` conserva acceso directo.
También rechaza un rol runtime preexistente que sea miembro directo o indirecto
de otro rol: `NOINHERIT` por sí solo no retira la capacidad de `SET ROLE` que
permite una membresía ([documentación oficial](https://www.postgresql.org/docs/17/role-membership.html)).
El comentario `dusema:goal01-staging-runtime` identifica el rol creado por el
bootstrap: un rol preexistente sin esa marca se rechaza antes de cambiar su
contraseña o atributos. Una ejecución posterior puede rotar la contraseña y
restablecer los atributos que la identidad `CREATEROLE` puede cambiar. Si el rol
marcado adquiere `SUPERUSER`, `CREATEDB`, `REPLICATION` o `BYPASSRLS`, el bootstrap
falla sin mutarlo: un DBA debe revisar y retirar esos atributos con una identidad
superusuario antes de repetirlo. También reserva explícitamente el rol observado
`oficina`.
También falla si el runtime ya es propietario del esquema `public` o de sus
relaciones, y revoca `CREATE` directo de `PUBLIC` y del rol runtime. También
revoca `CREATE` del rol sobre la base staging y falla si el permiso efectivo
persiste; ese privilegio permitiría crear esquemas e instalar extensiones
confiables ([documentación oficial de privilegios](https://www.postgresql.org/docs/17/ddl-priv.html)).

El bootstrap comprueba esta condición dentro de la transacción antes de
confirmar los cambios. Después de que termine correctamente y antes de migrar o
desplegar, repítela desde una sesión de solo lectura en el clúster PostgreSQL:

```sql
SELECT has_database_privilege(
         'REPLACE_WITH_STAGING_RUNTIME_ROLE',
         'oficina_nitida',
         'CONNECT'
       ) AS can_connect_to_production;
```

El resultado requerido para `can_connect_to_production` es `false`. Si devuelve
`true`, detén el procedimiento. Para conservar el mismo clúster, el DBA debe
evaluar el efecto de revocar `CONNECT` a `PUBLIC` en `oficina_nitida` y otorgarlo
explícitamente a las identidades productivas autorizadas. No ejecutes esa
revocación sin ese inventario y aprobación; si el cambio no es seguro, la
separación requiere otro clúster PostgreSQL.

La inspección de solo lectura del VPS compartido del 2026-10-24 encontró en
`oficina_nitida` los grants `CONNECT,TEMPORARY` a `PUBLIC`, `CONNECT,TEMPORARY`
a `oficina` y `CONNECT` explícito a `saas_api_runtime`. En ese momento solo
existían esos dos roles con `LOGIN`: `oficina` (superusuario) y
`saas_api_runtime` (login habilitado, sin superusuario, `BYPASSRLS` ni
replicación). Ambos conservarían `CONNECT` si se revocara el grant de `PUBLIC`:
`oficina` por ser superusuario y `saas_api_runtime` por su grant explícito.
No se modificaron ACL. Repite este inventario inmediatamente antes de cualquier
cambio y confirma con el DBA que ningún servicio depende de otro rol o de los
privilegios heredados de `PUBLIC`; esta observación no autoriza la revocación.

```bash
export GOAL01_RUNTIME_DB_ROLE=REPLACE_WITH_DEDICATED_STAGING_RUNTIME_ROLE

(
  read -r -s -p 'Staging runtime DB password: ' GOAL01_RUNTIME_DB_PASSWORD
  printf '\n'
  export GOAL01_RUNTIME_DB_PASSWORD

  docker exec -i \
    -e GOAL01_RUNTIME_DB_ROLE \
    -e GOAL01_RUNTIME_DB_PASSWORD \
    postgres psql -U REPLACE_WITH_STAGING_MIGRATION_ROLE -d REPLACE_WITH_APPROVED_STAGING_DATABASE \
    -v ON_ERROR_STOP=1 < /home/ubuntu/la-oficina-nitida/staging-isolated/postgres/bootstrap-runtime-role.sql
)
```

Usa una identidad de migración aprobada para staging y con permisos distintos
del rol runtime. La identidad de bootstrap/migración debe poder crear o alterar
roles, ser propietaria de la base staging y de los objetos que migrará, y revocar
los permisos de base y esquema que el script normaliza. Prisma debe migrar como
esa misma identidad para que los privilegios por defecto coincidan con el
propietario de los objetos. Si esas condiciones no se cumplen, detén el
procedimiento y pide al DBA una identidad aprobada; no ejecutes el SQL como el
rol runtime. No uses las identidades del entorno clasificado como producción.

Después, obtiene `DATABASE_URL_MIGRATION` de la fuente aprobada de secretos; no
escribas su valor literal en un comando ni lo guardes en el `.env` permanente.
Define además los identificadores no secretos de la base y del rol de migración
aprobados por el DBA:

```bash
export GOAL01_STAGING_DATABASE='<approved-staging-database>'
export GOAL01_STAGING_MIGRATION_ROLE='<approved-staging-migration-role>'
```

El siguiente procedimiento pasa las conexiones como variables de entorno, no
como argumentos con la URL completa. Antes de migrar, un `SELECT` de solo lectura
comprueba la base y el usuario efectivos, los compara con los identificadores
aprobados y bloquea `oficina_nitida`, las identidades productivas conocidas, un
rol superusuario, membresías de otros roles y cualquier acceso `CONNECT` a la
base protegida. Prisma solo se ejecuta si pasa ese control:

La última observación registrada encontró `CONNECT` concedido a `PUBLIC` en
`oficina_nitida`; con ese estado el control debe detenerse hasta que DBA confirme
un aislamiento seguro. No omitas el fallo ni cambies ACL como atajo.

```bash
: "${DATABASE_URL_MIGRATION:?Load it from the approved secret source first}"
(
  set -euo pipefail
  export DATABASE_URL="$DATABASE_URL_MIGRATION"

  docker compose \
    --project-name dusema-staging-isolated \
    --env-file /home/ubuntu/la-oficina-nitida/staging-isolated/.env \
    -f /home/ubuntu/la-oficina-nitida/staging-isolated/docker-compose.staging.yml \
    run --rm --no-deps \
    -e DATABASE_URL \
    -e GOAL01_STAGING_DATABASE \
    -e GOAL01_STAGING_MIGRATION_ROLE \
    --entrypoint node api -e '
const { PrismaClient } = require("./apps/api/node_modules/@prisma/client");
const prisma = new PrismaClient();

(async () => {
  let target;
  try {
    [target] = await prisma.$queryRaw`
      SELECT current_database() AS database_name,
             current_user AS role_name,
             role_info.rolsuper AS is_superuser,
             CASE
               WHEN EXISTS (
                 SELECT 1 FROM pg_database WHERE datname = $$oficina_nitida$$
               )
               THEN has_database_privilege(
                 current_user, $$oficina_nitida$$, $$CONNECT$$
               )
               ELSE false
             END AS can_connect_to_protected,
             EXISTS (
               SELECT 1 FROM pg_roles AS candidate
               WHERE candidate.oid <> role_info.oid
                 AND candidate.rolname <> $$pg_database_owner$$
                 AND pg_has_role(role_info.oid, candidate.oid, $$MEMBER$$)
             ) AS has_role_memberships
      FROM pg_roles AS role_info
      WHERE role_info.rolname = current_user
    `;
  } finally {
    await prisma.$disconnect();
  }

  if (
    !target ||
    target.database_name !== process.env.GOAL01_STAGING_DATABASE ||
    target.role_name !== process.env.GOAL01_STAGING_MIGRATION_ROLE ||
    target.database_name === "oficina_nitida" ||
    ["oficina", "saas_api_runtime"].includes(target.role_name) ||
    target.is_superuser ||
    target.can_connect_to_protected ||
    target.has_role_memberships
  ) {
    throw new Error("Protected or unapproved migration target");
  }

  console.log("Staging migration target preflight passed.");
})().catch(() => {
  console.error("Migration target preflight failed; Prisma migrate was not started.");
  process.exitCode = 1;
});
'

  docker compose \
    --project-name dusema-staging-isolated \
    --env-file /home/ubuntu/la-oficina-nitida/staging-isolated/.env \
    -f /home/ubuntu/la-oficina-nitida/staging-isolated/docker-compose.staging.yml \
    run --rm --no-deps \
    -e DATABASE_URL \
    --entrypoint node api \
    apps/api/node_modules/prisma/build/index.js migrate deploy \
    --schema apps/api/prisma/schema.prisma
)
```

El seed es también explícito y usa la conexión runtime:

```bash
docker compose \
  --project-name dusema-staging-isolated \
  --env-file /home/ubuntu/la-oficina-nitida/staging-isolated/.env \
  -f /home/ubuntu/la-oficina-nitida/staging-isolated/docker-compose.staging.yml \
  run --rm --no-deps \
  --entrypoint sh api \
  -lc 'cd /app/apps/api && npm run prisma:seed'
```

No guardes `DATABASE_URL_MIGRATION` en el `.env` permanente de la API.

## Actualización de API y rollback

El contenedor arranca con el comando del Dockerfile y no ejecuta migraciones ni seed al iniciar. El rollback de la imagen no revierte una migración Prisma: las migraciones deben ser compatibles con la versión anterior o la restauración de esquema requiere un procedimiento aprobado.

### Precondiciones y registro del estado anterior

Usa una referencia objetivo fijada al digest OCI esperado. La referencia anterior debe seguir disponible localmente y resolver al mismo ID de imagen que ejecuta el contenedor. Si cualquiera de estas comprobaciones falla, detén el despliegue: no cuentes una futura descarga como rollback garantizado.

Ejecuta este bloque antes de editar el .env. No muestra el contenido del archivo:

```bash
set -euo pipefail
DEPLOY_DIR=/home/ubuntu/la-oficina-nitida/staging-isolated
ENV_FILE="$DEPLOY_DIR/.env"
COMPOSE_FILE="$DEPLOY_DIR/docker-compose.staging.yml"
API_IMAGE_TARGET='ghcr.io/OWNER/REPOSITORY/api@sha256:REPLACE_WITH_64_HEX_DIGEST'

test -f "$ENV_FILE"
test ! -L "$ENV_FILE"
test "$(stat -c '%a' "$ENV_FILE")" = 600
test "$(grep -c '^API_IMAGE=' "$ENV_FILE" || true)" = 1
PREVIOUS_API_IMAGE="$(awk -F= '$1 == "API_IMAGE" { sub(/^[^=]*=/, ""); print }' "$ENV_FILE")"
test -n "$PREVIOUS_API_IMAGE"

compose=(docker compose --project-name dusema-staging-isolated --env-file "$ENV_FILE" -f "$COMPOSE_FILE")
CONTAINER_ID="$("${compose[@]}" ps -q api)"
test -n "$CONTAINER_ID"
RUNNING_REF="$(docker inspect --format '{{.Config.Image}}' "$CONTAINER_ID")"
RUNNING_IMAGE_ID="$(docker inspect --format '{{.Image}}' "$CONTAINER_ID")"
PREVIOUS_LOCAL_ID="$(docker image inspect --format '{{.Id}}' "$PREVIOUS_API_IMAGE")"
PREVIOUS_REPO_DIGESTS="$(docker image inspect --format '{{json .RepoDigests}}' "$PREVIOUS_API_IMAGE")"
test "$RUNNING_REF" = "$PREVIOUS_API_IMAGE"
test "$RUNNING_IMAGE_ID" = "$PREVIOUS_LOCAL_ID"
test -n "$PREVIOUS_REPO_DIGESTS"
test "$PREVIOUS_REPO_DIGESTS" != "[]"
test "$PREVIOUS_REPO_DIGESTS" != "null"
[[ "$API_IMAGE_TARGET" =~ @sha256:[0-9a-f]{64}$ ]]
docker manifest inspect "$API_IMAGE_TARGET" >/dev/null

ROLLBACK_ENV="$DEPLOY_DIR/.env.rollback.$(date -u +%Y%m%dT%H%M%SZ)"
test ! -e "$ROLLBACK_ENV"
cp --archive -- "$ENV_FILE" "$ROLLBACK_ENV"
chmod 600 "$ROLLBACK_ENV"
cmp --silent "$ENV_FILE" "$ROLLBACK_ENV"
printf 'Rollback file: %s\nPrevious API_IMAGE: %s\nPrevious local image ID: %s\nPrevious RepoDigests: %s\n' \
  "$ROLLBACK_ENV" "$PREVIOUS_API_IMAGE" "$RUNNING_IMAGE_ID" "$PREVIOUS_REPO_DIGESTS"
```

Registra en el ticket operativo la ruta exacta del respaldo, la referencia anterior, el ID local y los RepoDigests; esos datos no son secretos. El respaldo contiene el .env completo, debe permanecer con modo 600 y no debe copiarse a logs ni Git. No borres el respaldo ni la imagen anterior hasta cerrar la ventana de rollback.

### Cambio exclusivo de API_IMAGE y recreación

El siguiente bloque copia el .env a un temporal del mismo directorio, cambia exactamente una línea conservando el resto de bytes y el formato de finales de línea, y reemplaza el archivo de forma atómica. La copia temporal hereda propietario, grupo y permisos mediante cp --archive; si falla cualquier comprobación, el .env original queda intacto.

```bash
set -euo pipefail
DEPLOY_DIR=/home/ubuntu/la-oficina-nitida/staging-isolated
ENV_FILE="$DEPLOY_DIR/.env"
COMPOSE_FILE="$DEPLOY_DIR/docker-compose.staging.yml"
API_IMAGE_TARGET='ghcr.io/OWNER/REPOSITORY/api@sha256:REPLACE_WITH_64_HEX_DIGEST'
ROLLBACK_ENV='/home/ubuntu/la-oficina-nitida/staging-isolated/.env.rollback.REPLACE_WITH_RECORDED_UTC_TIMESTAMP'

test -f "$ROLLBACK_ENV"
test ! -L "$ROLLBACK_ENV"
cmp --silent "$ROLLBACK_ENV" "$ENV_FILE"
UPDATE_TMP="$(mktemp "$DEPLOY_DIR/.env.update.XXXXXX")"
trap 'if [ -n "$UPDATE_TMP" ]; then rm -f -- "$UPDATE_TMP"; fi' EXIT
cp --archive --remove-destination -- "$ENV_FILE" "$UPDATE_TMP"

python3 - "$UPDATE_TMP" "$API_IMAGE_TARGET" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
image = sys.argv[2]
digest = image.rsplit("@sha256:", 1)
if not image.startswith("ghcr.io/") or len(digest) != 2 or len(digest[1]) != 64 or any(c not in "0123456789abcdef" for c in digest[1]):
    raise SystemExit("API_IMAGE must be pinned to a GHCR manifest digest")

lines = path.read_bytes().splitlines(keepends=True)
matches = [i for i, line in enumerate(lines) if line.partition(b"=")[0] == b"API_IMAGE"]
if len(matches) != 1:
    raise SystemExit("Expected exactly one API_IMAGE assignment")

index = matches[0]
line = lines[index]
ending = b""
if line.endswith(bytes((13, 10))):
    ending = bytes((13, 10))
elif line.endswith(bytes((10,))):
    ending = bytes((10,))
elif line.endswith(bytes((13,))):
    ending = bytes((13,))
lines[index] = b"API_IMAGE=" + image.encode("ascii") + ending
path.write_bytes(b"".join(lines))
PY

if cmp --silent "$ROLLBACK_ENV" "$UPDATE_TMP"; then
  echo "API_IMAGE update produced no change; stopping." >&2
  exit 1
fi
mv -f -- "$UPDATE_TMP" "$ENV_FILE"
UPDATE_TMP=''
trap - EXIT

compose=(docker compose --project-name dusema-staging-isolated --env-file "$ENV_FILE" -f "$COMPOSE_FILE")
"${compose[@]}" config >/dev/null
"${compose[@]}" pull api
"${compose[@]}" up -d --no-deps --force-recreate api

CONTAINER_ID="$("${compose[@]}" ps -q api)"
test -n "$CONTAINER_ID"
RUNNING_REF="$(docker inspect --format '{{.Config.Image}}' "$CONTAINER_ID")"
RUNNING_IMAGE_ID="$(docker inspect --format '{{.Image}}' "$CONTAINER_ID")"
TARGET_LOCAL_ID="$(docker image inspect --format '{{.Id}}' "$API_IMAGE_TARGET")"
test "$RUNNING_REF" = "$API_IMAGE_TARGET"
test "$RUNNING_IMAGE_ID" = "$TARGET_LOCAL_ID"
test "$(docker inspect --format '{{.State.Health.Status}}' "$CONTAINER_ID")" = "healthy"
echo "Container health: healthy"
docker image inspect --format '{{json .RepoDigests}}' "$API_IMAGE_TARGET"
"${compose[@]}" exec -T api node -e '
Promise.all(["/health", "/readiness"].map(async path => {
  const response = await fetch("http://127.0.0.1:4000" + path);
  console.log(path + " " + response.status);
  if (!response.ok) process.exitCode = 1;
})).catch(() => {
  console.error("Local API check failed");
  process.exitCode = 1;
});
'
```

En la verificación se distinguen tres valores: la referencia .Config.Image debe ser el digest objetivo; el ID .Image del contenedor debe coincidir con el ID local de la imagen resuelta; los RepoDigests son la asociación local con los manifiestos del registry. El ID local no es el digest del manifiesto. Registra los tres sin mostrar configuración del contenedor. El check local de /health y /readiness no certifica correo real, R2 ni el flujo funcional completo. Después del cutover aprobado, comprueba también las URLs públicas.

Después de que el operador haya cambiado y validado la ruta del Caddy existente, ejecuta desde una estación con acceso público para comprobar DNS, TLS y los estados HTTP sin imprimir los cuerpos de respuesta:

```bash
set -euo pipefail
for endpoint in /health /readiness; do
  status="$(curl --silent --show-error --output /dev/null \
    --write-out '%{http_code}' --connect-timeout 5 --max-time 20 \
    "https://staging-api.dusema.com${endpoint}")"
  printf 'https://staging-api.dusema.com%s -> HTTP %s\n' "$endpoint" "$status"
  test "$status" = 200
done
```

La respuesta pública 200 confirma que ese hostname responde por HTTPS, no que el tráfico llegó a la imagen esperada ni que el flujo completo funciona. Confirma la imagen mediante el digest y el ID local del contenedor; valida R2, correo real y el smoke autenticado por separado. Repite esta comprobación después de un rollback si el Caddy ya apunta al servicio aislado.

### Restauración independiente de la sesión SSH

Si falla la actualización, la recreación, health/readiness o se pierde la sesión, vuelve a conectarte y ejecuta este bloque usando la ruta exacta del respaldo registrada antes del cambio. No depende de variables ni funciones de una sesión anterior. La imagen antigua debe seguir localmente disponible como se verificó en el preflight.

```bash
set -euo pipefail
DEPLOY_DIR=/home/ubuntu/la-oficina-nitida/staging-isolated
ENV_FILE="$DEPLOY_DIR/.env"
COMPOSE_FILE="$DEPLOY_DIR/docker-compose.staging.yml"
ROLLBACK_ENV='/home/ubuntu/la-oficina-nitida/staging-isolated/.env.rollback.REPLACE_WITH_RECORDED_UTC_TIMESTAMP'
API_IMAGE_TARGET='ghcr.io/OWNER/REPOSITORY/api@sha256:REPLACE_WITH_64_HEX_DIGEST'
EXPECTED_PREVIOUS_LOCAL_ID='REPLACE_WITH_RECORDED_PREVIOUS_LOCAL_IMAGE_ID'

test -f "$ROLLBACK_ENV"
test ! -L "$ROLLBACK_ENV"
CURRENT_API_IMAGE="$(awk -F= '$1 == "API_IMAGE" { sub(/^[^=]*=/, ""); print }' "$ENV_FILE")"
PREVIOUS_API_IMAGE="$(awk -F= '$1 == "API_IMAGE" { sub(/^[^=]*=/, ""); print }' "$ROLLBACK_ENV")"
if [[ "$CURRENT_API_IMAGE" != "$PREVIOUS_API_IMAGE" && "$CURRENT_API_IMAGE" != "$API_IMAGE_TARGET" ]]; then
  echo "API_IMAGE changed again; stop and reconcile manually." >&2
  exit 1
fi
cmp --silent <(grep -v '^API_IMAGE=' "$ROLLBACK_ENV") <(grep -v '^API_IMAGE=' "$ENV_FILE")
RESTORED_API_IMAGE="$(awk -F= '$1 == "API_IMAGE" { sub(/^[^=]*=/, ""); print }' "$ROLLBACK_ENV")"
RESTORED_LOCAL_ID="$(docker image inspect --format '{{.Id}}' "$RESTORED_API_IMAGE")"
test "$RESTORED_LOCAL_ID" = "$EXPECTED_PREVIOUS_LOCAL_ID"
RESTORE_TMP="$(mktemp "$DEPLOY_DIR/.env.restore.XXXXXX")"
trap 'if [ -n "$RESTORE_TMP" ]; then rm -f -- "$RESTORE_TMP"; fi' EXIT
cp --archive --remove-destination -- "$ROLLBACK_ENV" "$RESTORE_TMP"
cmp --silent "$ROLLBACK_ENV" "$RESTORE_TMP"
mv -f -- "$RESTORE_TMP" "$ENV_FILE"
RESTORE_TMP=''
trap - EXIT

compose=(docker compose --project-name dusema-staging-isolated --env-file "$ENV_FILE" -f "$COMPOSE_FILE")
"${compose[@]}" config >/dev/null
"${compose[@]}" up -d --no-deps --force-recreate --pull never api

CONTAINER_ID="$("${compose[@]}" ps -q api)"
test -n "$CONTAINER_ID"
RUNNING_REF="$(docker inspect --format '{{.Config.Image}}' "$CONTAINER_ID")"
RUNNING_IMAGE_ID="$(docker inspect --format '{{.Image}}' "$CONTAINER_ID")"
RESTORED_API_IMAGE="$(awk -F= '$1 == "API_IMAGE" { sub(/^[^=]*=/, ""); print }' "$ROLLBACK_ENV")"
RESTORED_LOCAL_ID="$(docker image inspect --format '{{.Id}}' "$RESTORED_API_IMAGE")"
test "$RUNNING_REF" = "$RESTORED_API_IMAGE"
test "$RUNNING_IMAGE_ID" = "$RESTORED_LOCAL_ID"
test "$(docker inspect --format '{{.State.Health.Status}}' "$CONTAINER_ID")" = "healthy"
echo "Container health: healthy"
"${compose[@]}" exec -T api node -e '
Promise.all(["/health", "/readiness"].map(async path => {
  const response = await fetch("http://127.0.0.1:4000" + path);
  console.log(path + " " + response.status);
  if (!response.ok) process.exitCode = 1;
})).catch(() => {
  console.error("Local API check failed");
  process.exitCode = 1;
});
'
```

El reemplazo atómico deja el .env anterior intacto si se interrumpe antes de mv; si la sesión se pierde después de mv, el respaldo persistente permite repetir la restauración al reconectar. Si el archivo, la imagen local o la referencia no coinciden con el registro, detente y escala al operador responsable. No limpies temporales ni imágenes manualmente durante el incidente.

El rollback de imagen no revierte migraciones Prisma. Antes de migrar, verifica que los cambios de esquema sean compatibles con la imagen anterior; de lo contrario, solo un procedimiento de restauración aprobado puede recuperar el esquema. Si también se cambió Caddy, su rollback sigue siendo separado: restaura únicamente el destino anterior registrado de staging y valida/recarga el Caddy existente; nunca recrees el servicio Caddy ni reemplaces otras rutas.

## ARM64 y PDF

El Dockerfile usa imágenes oficiales multi-arquitectura de Node 22 sobre
Debian Bookworm. `PUPPETEER_SKIP_DOWNLOAD=true` evita descargar un navegador
durante el build e instala Chromium del sistema en la imagen runtime.
`bcrypt` 6.0.0 incluye prebuild `linux-arm64` y el renderer busca
`/usr/bin/chromium`, por lo que no se introduce una dependencia de Chromium
x86 exclusiva.

La verificación definitiva de la imagen ARM64 debe ocurrir en GHCR y en el VPS
con un smoke de `/health`, `/readiness` y una generación real de PDF. Si la
construcción multi-arquitectura falla en esos pasos, se debe corregir la
compatibilidad de la imagen antes de desplegar; no se deben añadir emulación o
flags arbitrarios al runtime.

## Logs y observabilidad

El Compose rota los logs `json-file` de API a un máximo de cinco archivos de
10 MB. La política de logs del Caddy existente queda fuera de este Compose. La
aplicación conserva `x-request-id` y logs sanitizados; no se agrega una
plataforma de observabilidad nueva para este staging.
