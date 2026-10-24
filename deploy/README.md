# Deployment de staging del API

Este directorio contiene el empaquetado reproducible y la operación de staging
del API NestJS. El despliegue objetivo usa Vercel para el frontend y el VPS
existente para `apps/api`.

## Aplicabilidad al VPS observado

El único VPS está clasificado como producción. Su Compose activo fue observado
en `/home/ubuntu/la-oficina-nitida/staging/docker-compose.yml`; el archivo
versionado de esta guía es `deploy/docker-compose.staging.yml`. No se ha
verificado que ambos archivos sean equivalentes. La estructura y los comandos
de esta guía describen el despliegue versionado y no deben ejecutarse contra el
Compose activo hasta que se revise su configuración completa y el propietario
apruebe el aislamiento de staging.

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
- `deploy/docker-compose.staging.yml` ejecuta únicamente `api` y Caddy.
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
procedimiento aprobado. El script de bootstrap crea o altera roles de ámbito
de instancia y también cambia privilegios del esquema en la base seleccionada;
no debe ejecutarse contra el PostgreSQL compartido sin que el DBA revise y
apruebe explícitamente sus efectos.

El Compose usa la red externa ya existente:

```yaml
networks:
  la-oficina-nitida:
    external: true
    name: la-oficina-nitida_laoficina
```

La API no publica el puerto `4000`. Caddy es el único servicio que publica
`80` y `443`.

## Archivos en el VPS

Una estructura sugerida, sin tocar los directorios de datos existentes, es:

```text
/home/ubuntu/la-oficina-nitida/
├── app/
│   ├── .env
│   ├── deploy/
│   │   ├── caddy/Caddyfile
│   │   └── docker-compose.staging.yml
│   └── deploy/postgres/bootstrap-runtime-role.sql
├── uploads/
├── backups/
├── caddy/config/Caddyfile
├── caddy/data/
├── postgres/data/
└── redis/data/
```

El archivo `.env` real se crea en el VPS a partir de
`deploy/staging.env.example` y queda fuera de Git. El Compose versionado fija
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

## Caddy

Instala `deploy/caddy/Caddyfile` en:

```text
/home/ubuntu/la-oficina-nitida/caddy/config/Caddyfile
```

El Compose monta esa ruta en `/etc/caddy` y conserva los certificados en:

```text
/home/ubuntu/la-oficina-nitida/caddy/data
```

Caddy atiende `staging-api.dusema.com`, termina HTTPS y hace
`reverse_proxy api:4000`. La emisión automática de certificados requiere que
DNS y los puertos públicos `80/443` estén preparados; esa configuración queda
fuera de este repositorio y de esta tarea.

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
5. Copia el Compose, el Caddyfile, este SQL y el `.env` al directorio de
   aplicación.
6. Valida la configuración sin iniciar servicios:

   ```bash
   docker compose \
     --env-file /home/ubuntu/la-oficina-nitida/app/.env \
     -f /home/ubuntu/la-oficina-nitida/app/deploy/docker-compose.staging.yml \
     config
   ```

7. Levanta solamente la API y Caddy. Este comando no ejecuta migraciones ni
   seed:

   ```bash
   docker compose \
     --env-file /home/ubuntu/la-oficina-nitida/app/.env \
     -f /home/ubuntu/la-oficina-nitida/app/deploy/docker-compose.staging.yml \
     up -d api caddy
   ```

8. Verifica los endpoints:

   ```bash
   curl --fail https://staging-api.dusema.com/health
   curl --fail https://staging-api.dusema.com/readiness
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
protegida. También rechaza un rol runtime preexistente que sea miembro directo o
indirecto de otro rol: `NOINHERIT` por sí solo no retira la capacidad de `SET ROLE`
que permite una membresía ([documentación oficial](https://www.postgresql.org/docs/17/role-membership.html)).
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
export GOAL01_RUNTIME_DB_PASSWORD='<runtime-password>'

docker exec -i \
  -e GOAL01_RUNTIME_DB_ROLE \
  -e GOAL01_RUNTIME_DB_PASSWORD \
  postgres psql -U REPLACE_WITH_STAGING_MIGRATION_ROLE -d REPLACE_WITH_APPROVED_STAGING_DATABASE \
  -v ON_ERROR_STOP=1 < deploy/postgres/bootstrap-runtime-role.sql
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
    --env-file /home/ubuntu/la-oficina-nitida/app/.env \
    -f /home/ubuntu/la-oficina-nitida/app/deploy/docker-compose.staging.yml \
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
    --env-file /home/ubuntu/la-oficina-nitida/app/.env \
    -f /home/ubuntu/la-oficina-nitida/app/deploy/docker-compose.staging.yml \
    run --rm --no-deps \
    -e DATABASE_URL \
    --entrypoint node api \
    apps/api/node_modules/prisma/build/index.js migrate deploy
)
```

El seed es también explícito y usa la conexión runtime:

```bash
docker compose \
  --env-file /home/ubuntu/la-oficina-nitida/app/.env \
  -f /home/ubuntu/la-oficina-nitida/app/deploy/docker-compose.staging.yml \
  run --rm --no-deps \
  --entrypoint sh api \
  -lc 'cd /app/apps/api && npm run prisma:seed'
```

No guardes `DATABASE_URL_MIGRATION` en el `.env` permanente de la API.

## Rollback

El rollback de aplicación consiste en cambiar `API_IMAGE` al tag SHA o digest
anterior y recrear solamente `api`:

```bash
docker compose \
  --env-file /home/ubuntu/la-oficina-nitida/app/.env \
  -f /home/ubuntu/la-oficina-nitida/app/deploy/docker-compose.staging.yml \
  up -d api
```

Caddy, PostgreSQL, Redis y sus datos no se modifican durante este rollback.

Un rollback de la imagen no revierte migraciones Prisma. Las migraciones deben
ser compatibles con la versión anterior; si una migración no lo permite, la
recuperación del esquema requiere restaurar un backup mediante un procedimiento
operativo aprobado. No uses `latest` ni elimines imágenes anteriores antes de
validar el despliegue nuevo.

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

El Compose rota los logs `json-file` de API y Caddy a un máximo de cinco
archivos de 10 MB. La aplicación conserva `x-request-id` y logs sanitizados;
no se agrega una plataforma de observabilidad nueva para este staging.
