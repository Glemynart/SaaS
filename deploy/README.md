# Staging reproducible

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

```bash
docker build -f deploy/Dockerfile.api -t la-oficina-nitida-api:staging .
docker build -f deploy/Dockerfile.web -t la-oficina-nitida-web:staging .
```

El arranque contra un PostgreSQL de staging requiere las migraciones y el
seed definidos por E1.2; este PR no los ejecuta implícitamente ni eleva los
privilegios del usuario runtime. R2, correo real, health/readiness y pruebas
browser pertenecen a E1.3/E1.4.
