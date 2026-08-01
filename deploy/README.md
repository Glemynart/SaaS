# Staging reproducible (E1.1)

E1.1 define el empaquetado reproducible de las dos aplicaciones que componen
el producto actual:

- `deploy/Dockerfile.api` construye el API NestJS y deja Chromium disponible
  para el renderer PDF.
- `deploy/Dockerfile.web` construye el frontend Next.js.

Ambas imágenes se construyen desde la raíz del repositorio y fijan la versión
de pnpm declarada en `package.json`. Las instalaciones usan
`pnpm install --frozen-lockfile`; ningún archivo `.env` ni dato local entra en
el contexto de Docker.

## Configuración en Railway

Crear dos servicios desde el mismo repositorio, ambos con la raíz del
repositorio como contexto de build:

| Servicio | Dockerfile              | Puerto | Variables mínimas                                                    |
| -------- | ----------------------- | -----: | -------------------------------------------------------------------- |
| API      | `deploy/Dockerfile.api` | `4000` | `NODE_ENV`, `DATABASE_URL`, `JWT_SECRET`, `ALLOWED_ORIGINS`          |
| Web      | `deploy/Dockerfile.web` | `3000` | `NODE_ENV`, `API_URL`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL` |

En Railway se debe configurar el puerto público a partir de la variable
`PORT` que entrega la plataforma. El API usa `PORT=4000` y el Web
`PORT=3000` como valores por defecto para ejecución local; el arranque no
codifica una URL ni un secreto de staging.

`API_URL` es una URL server-side del Web y puede apuntar al dominio interno
del servicio API. `NEXT_PUBLIC_API_URL` se entrega al navegador, por lo que
debe ser el dominio público del API y no puede contener credenciales.

Las variables sensibles se crean únicamente en el panel de variables del
entorno de staging: `DATABASE_URL`, `JWT_SECRET`, `R2_ACCESS_KEY_ID`,
`R2_SECRET_ACCESS_KEY`, `RESEND_API_KEY` y cualquier secreto futuro. No se
copian desde `.env`, no se escriben en el repositorio y no se incluyen en los
Dockerfiles.

## Verificación local del empaquetado

Con Docker Desktop ejecutándose:

Si la red local reemplaza certificados TLS públicos (por ejemplo, un antivirus
o un proxy corporativo), exporta su certificado raíz en formato PEM y pásalo
sólo durante el build:

```bash
docker build --secret id=build-ca,src=/path/to/network-root.pem \
  -f deploy/Dockerfile.api -t la-oficina-nitida-api:staging .
```

El certificado se monta únicamente mientras se inicializa pnpm y se instalan
dependencias; no se copia a la imagen runtime. Los builds de Railway no
necesitan esta opción salvo que su builder use la misma intercepción TLS.

```bash
docker build -f deploy/Dockerfile.api -t la-oficina-nitida-api:staging .
docker build -f deploy/Dockerfile.web -t la-oficina-nitida-web:staging .
```

El arranque contra un PostgreSQL de staging requiere las migraciones y el
seed definidos por E1.2; este PR no los ejecuta implícitamente ni eleva los
privilegios del usuario runtime. Las verificaciones de R2, correo real y
health/readiness se describen en E1.3; las pruebas browser pertenecen a E1.4.

## E1.2 - Migraciones, seed y rol runtime

La conexion privilegiada de migraciones y la conexion de la aplicacion son
distintas:

- `DATABASE_URL_MIGRATION`: solo para la operacion de release; puede crear o
  alterar el esquema y nunca se configura en el servicio API.
- `DATABASE_URL`: conexion runtime con un rol `LOGIN NOSUPERUSER NOBYPASSRLS`
  sin privilegio `CREATE` sobre `public`.

Ejecuta una vez el bootstrap del rol usando una conexion administrativa y el
mismo propietario que ejecutara las migraciones futuras:

```bash
export GOAL01_RUNTIME_DB_ROLE=saas_api_runtime
export GOAL01_RUNTIME_DB_PASSWORD='genera-un-secreto-largo-y-aleatorio'
psql "$DATABASE_URL_MIGRATION" \
  -v ON_ERROR_STOP=1 \
  -f deploy/postgres/bootstrap-runtime-role.sql
```

El script es idempotente, otorga unicamente `USAGE` de schema, DML sobre las
tablas existentes y uso de secuencias, y configura privilegios por defecto
para tablas futuras. No uses `postgres`, `rdsadmin` ni el mismo rol de la
sesion administrativa como rol runtime.

Aplica el schema de forma explicita con la conexion privilegiada:

```bash
DATABASE_URL="$DATABASE_URL_MIGRATION" \
  pnpm --filter @saas/api exec prisma migrate deploy
```

Despues ejecuta el seed con la conexion runtime para verificar que el rol de
la aplicacion puede operar los catalogos necesarios:

```bash
DATABASE_URL="$DATABASE_URL" \
  pnpm --filter @saas/api exec prisma db seed
```

El seed es idempotente y debe ejecutarse dos veces en una instalacion de
staging. La segunda ejecucion no debe crear duplicados. Verifica ademas el
guardrail del rol:

```sql
SELECT rolname, rolsuper, rolbypassrls
FROM pg_roles
WHERE rolname = 'saas_api_runtime';
```

El resultado esperado es `rolsuper = false` y `rolbypassrls = false`. Cuando
RLS esta activa, el API debe conservar el contexto tenant-aware existente; no
se debe sustituir por una conexion superusuario.

Para ejecutar estas operaciones contra la imagen API de E1.1, usa la misma
imagen con un comando one-off y no agregues `DATABASE_URL_MIGRATION` al
servicio runtime:

```bash
docker run --rm \
  -e DATABASE_URL="$DATABASE_URL_MIGRATION" \
  --entrypoint node la-oficina-nitida-api:staging \
  apps/api/node_modules/prisma/build/index.js migrate deploy

docker run --rm \
  -e DATABASE_URL="$DATABASE_URL" \
  --entrypoint sh la-oficina-nitida-api:staging \
  -lc 'cd /app/apps/api && npm run prisma:seed'
```

## E1.3 - R2, correo real y health/readiness

El servicio API de staging debe usar los proveedores reales, manteniendo
`DATABASE_URL` con el rol runtime no privilegiado de E1.2:

```text
STORAGE_PROVIDER=r2
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=<access-key>
R2_SECRET_ACCESS_KEY=<secret-key>
R2_BUCKET=<bucket>
RESEND_API_KEY=<resend-api-key>
EMAIL_FROM=<dominio-verificado>
EMAIL_FROM_NAME=La Oficina Nítida
REQUIRE_REAL_EMAIL=true
```

`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `RESEND_API_KEY` y cualquier
contraseña se configuran únicamente como secretos del entorno. `R2_ENDPOINT`,
`R2_BUCKET` y `EMAIL_FROM` también deben pertenecer al entorno de staging y no
se deben copiar desde un `.env` local.

### Comprobación del proceso y dependencias

El API expone dos rutas públicas sin datos de tenant:

- `GET /health` devuelve `200` cuando el proceso está vivo. No consulta
  dependencias y es adecuada como healthcheck básico de la plataforma.
- `GET /readiness` devuelve `200` sólo cuando PostgreSQL y el storage activo
  responden. Con `REQUIRE_REAL_EMAIL=true`, también exige que Resend y
  `EMAIL_FROM` estén configurados; si no, devuelve `503` sin exponer secretos
  ni detalles internos.

Después de desplegar la imagen y aplicar E1.2, verifica:

```bash
curl --fail "$API_URL/health"
curl --fail "$API_URL/readiness"
```

Una respuesta `503` en `/readiness` debe corregirse en la configuración del
entorno o en la dependencia indicada antes de considerar staging operativo.

### Comprobación R2

Con `/readiness` en `200`, ejecuta desde la UI una operación que escriba y lea
un objeto, por ejemplo cargar el logo de una organización y consultarlo desde
la configuración de identidad. Para una migración de archivos locales
existentes, ejecuta el migrador explícito sobre la misma imagen y conserva su
reporte de diferencias:

```bash
STORAGE_PROVIDER=r2 \
R2_ENDPOINT="$R2_ENDPOINT" \
R2_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
R2_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
R2_BUCKET="$R2_BUCKET" \
pnpm --filter @saas/api storage:migrate-local-to-r2
```

No uses `r2-migration` como estado final: ese proveedor sólo sirve para la
transición porque escribe en R2 y permite fallback controlado de lectura.

### Comprobación de correo real

Usa una cuenta de prueba del tenant de staging y solicita recuperación de
contraseña desde `/recuperar`. Verifica en el buzón que:

1. llega el correo desde el dominio verificado en Resend;
2. el enlace abre `/reset-password` y permite completar el flujo;
3. el token expira o se invalida después de su uso.

No uses datos ni buzones de clientes reales para esta prueba. El modo
degradado se conserva para desarrollo local, pero `REQUIRE_REAL_EMAIL=true`
impide declarar readiness de staging cuando el correo real no está listo.
