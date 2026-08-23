# Deployment de staging del API

Este directorio contiene el empaquetado reproducible y la operación de staging
del API NestJS. El despliegue objetivo usa Vercel para el frontend y el VPS
existente para `apps/api`.

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

- PostgreSQL: contenedor `postgres`, base inicial `oficina_nitida`.
- Redis: contenedor `redis`, sin uso por la versión actual del API.
- Red Docker existente: `la-oficina-nitida_laoficina`.

Antes de iniciar la aplicación, verifica manualmente en el VPS que la red
exista y que PostgreSQL esté conectado a ella. No crees una red alternativa.
La URL runtime debe usar el DNS Docker del contenedor existente:

```text
postgresql://saas_api_runtime:<password>@postgres:5432/oficina_nitida?schema=public
```

La base `oficina_nitida` no se considera staging automáticamente. Antes de
ejecutar cualquier migración o seed, confirma explícitamente que esa base es
la base de staging que se utilizará. Si no lo es, debe seleccionarse una base
de staging separada dentro del PostgreSQL existente mediante un procedimiento
operativo aprobado.

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
`deploy/staging.env.example` y queda fuera de Git. El directorio `uploads`
debe ser escribible por el usuario `node` de la imagen.

Variables mínimas para staging:

```env
API_IMAGE=ghcr.io/OWNER/REPOSITORY/api:sha-COMMIT_SHA
UPLOADS_PATH=/home/ubuntu/la-oficina-nitida/uploads
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://saas_api_runtime:<password>@postgres:5432/oficina_nitida?schema=public
JWT_SECRET=<secret-long-random>
FRONTEND_URL=https://staging.dusema.com
BACKEND_URL=https://staging-api.dusema.com
ALLOWED_ORIGINS=https://staging.dusema.com
STORAGE_PROVIDER=local
STORAGE_LOCAL_ROOT=/app/uploads
REQUIRE_REAL_EMAIL=false
```

No se agregan `REDIS_URL`, variables `R2_*`, Resend ni OCI Email Delivery en
este despliegue inicial.

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
2. Confirma la arquitectura ARM64, la red Docker existente y el nombre de la
   base de staging.
3. Confirma que existe un backup utilizable antes de cambiar el esquema.
4. Crea el directorio persistente de uploads y verifica sus permisos.
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

El healthcheck de Compose consulta `/health`. `/readiness` valida PostgreSQL y
el storage local; con `REQUIRE_REAL_EMAIL=false` no exige un proveedor de
correo real.

## Migraciones y seed: operación explícita

No se ejecutan durante `up`. Solo después de confirmar que la base es staging,
que existe un backup y que las credenciales son correctas, se ejecutan como
operaciones one-off.

Primero aplica el rol runtime usando una conexión administrativa. El SQL es
idempotente y no recrea PostgreSQL:

```bash
export GOAL01_RUNTIME_DB_ROLE=saas_api_runtime
export GOAL01_RUNTIME_DB_PASSWORD='<runtime-password>'

docker exec -i \
  -e GOAL01_RUNTIME_DB_ROLE \
  -e GOAL01_RUNTIME_DB_PASSWORD \
  postgres psql -U oficina -d oficina_nitida \
  -v ON_ERROR_STOP=1 < deploy/postgres/bootstrap-runtime-role.sql
```

Usa `oficina` como usuario administrativo solo si su privilegio administrativo
ha sido confirmado en el VPS. No uses el rol runtime para migrar.

Después, define temporalmente la conexión privilegiada en la sesión del
operador y ejecuta Prisma dentro de la misma imagen:

```bash
export DATABASE_URL_MIGRATION='postgresql://oficina:<password>@postgres:5432/oficina_nitida?schema=public'

docker compose \
  --env-file /home/ubuntu/la-oficina-nitida/app/.env \
  -f /home/ubuntu/la-oficina-nitida/app/deploy/docker-compose.staging.yml \
  run --rm --no-deps \
  -e DATABASE_URL="$DATABASE_URL_MIGRATION" \
  --entrypoint node api \
  apps/api/node_modules/prisma/build/index.js migrate deploy
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
