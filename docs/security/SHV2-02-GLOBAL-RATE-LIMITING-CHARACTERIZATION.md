# SHV2-02 — Caracterización operacional del Global Rate Limiting

## Estado

Caracterización completada. **SHV2-03 no es elegible para activación con la evidencia versionada actual.**

Esta unidad no instala un guard global, no incorpora un throttler global y no modifica el comportamiento HTTP.

## Evidencia de topología

### API

- El API es una aplicación NestJS sobre Express.
- `main.ts` no configura `trust proxy`.
- Express conserva por tanto su valor predeterminado `trust proxy = false`.
- El tracker predeterminado de `ThrottlerGuard` utiliza `req.ip`.
- Con la configuración actual, `req.ip` representa el peer TCP inmediato y una cabecera `X-Forwarded-For` enviada por el cliente es ignorada.

Esto es correcto para acceso directo al API, pero no demuestra la identidad del cliente cuando existe un reverse proxy.

### Frontend BFF

- El frontend utiliza Route Handlers de Next.js como BFF para la superficie funcional.
- `apps/web/src/lib/server-api.ts` realiza las solicitudes al API con `Content-Type` y, cuando corresponde, `Authorization`.
- El BFF no propaga una identidad de red del navegador hacia el API.

En ese camino, el peer observado por el API es el proceso BFF o el siguiente proxy, no necesariamente el navegador original. Un bucket por `req.ip` puede agrupar a múltiples usuarios legítimos.

### Despliegue

- La documentación histórica menciona Railway como destino.
- No existe en el repositorio un descriptor de despliegue de Railway, reverse proxy, balanceador o cadena de proxies.
- `docker-compose.yml` solo define PostgreSQL para desarrollo; no representa el camino HTTP del API.
- No existe evidencia versionada del número de instancias del API.

No puede establecerse de forma objetiva:

- cuántos proxies existen entre el cliente y Express;
- qué peer debe considerarse confiable;
- qué cabecera entrega la plataforma;
- si los contadores en memoria serían consistentes entre instancias.

## Identificación actual del cliente

| Camino                                      | Identidad observable por `req.ip`         | Resultado                                     |
| ------------------------------------------- | ----------------------------------------- | --------------------------------------------- |
| Cliente directo → API                       | Dirección del cliente directo             | Caracterizada                                 |
| Cliente con `X-Forwarded-For` → API directo | Dirección del peer; la cabecera se ignora | Caracterizada y resistente a spoofing directo |
| Navegador → BFF → API                       | Dirección del BFF o proxy inmediato       | No identifica individualmente al navegador    |
| Internet → Railway/proxy → API              | No demostrable con el repositorio         | Pendiente de evidencia externa                |

Activar confianza genérica en `X-Forwarded-For` no es una solución aceptable: permitiría spoofing si el API fuese alcanzable sin atravesar exclusivamente peers confiables.

## Configuración existente de Auth

`ThrottlerModule` contiene exactamente cinco políticas nombradas:

| Política         | Límite |     Ventana |
| ---------------- | -----: | ----------: |
| `login`          |      5 | 60 segundos |
| `register`       |      3 | 60 segundos |
| `refresh`        |     10 | 60 segundos |
| `forgotPassword` |      3 |  60 minutos |
| `resetPassword`  |      5 |  15 minutos |

No existe una política `default` y no existe un `APP_GUARD` global.

`ThrottlerGuard` evalúa todas las políticas nombradas salvo las excluidas explícitamente mediante `@SkipThrottle`:

- `register`, `login` y `refresh` no excluyen los otros buckets nombrados.
- `forgotPassword` excluye `login`, `register`, `refresh` y `resetPassword`.
- `resetPassword` excluye `login`, `register`, `refresh` y `forgotPassword`.

Esta es la semántica efectiva actual. SHV2-02 la registra y la protege contra cambios accidentales; no intenta corregirla. SHV2-03 no puede añadir silenciosamente un sexto bucket sobre Auth ni alterar los valores existentes.

## Límite global recomendado

**No existe todavía un valor numérico justificable con evidencia operacional.**

El ejemplo de `100 solicitudes/minuto por IP` en ADR-SEC-002 es una referencia de diseño, no una medición del tráfico legítimo. El repositorio no contiene telemetría de tasa, distribución por cliente, picos del BFF ni concurrencia por IP compartida. Adoptar ese valor ahora sería una suposición.

La configuración futura solo podrá fijarse cuando existan estas mediciones sobre el camino real:

1. máximo y percentiles de solicitudes por minuto para un cliente correctamente identificado;
2. ráfaga máxima de los flujos normales del frontend;
3. concentración de usuarios detrás de BFF, NAT o IP compartida;
4. número real de instancias del API y alcance de su almacenamiento de contadores.

El límite elegido deberá ser superior al pico legítimo demostrado y, al mismo tiempo, producir rechazo verificable ante abuso. Hasta entonces, la recomendación objetiva es **no activar un límite global numérico**.

## Configuración objetivo condicionada

Cuando los bloqueos anteriores estén resueltos, SHV2-03 deberá mantener este contrato:

- alcance transversal sobre operaciones no cubiertas por las políticas específicas de Auth;
- tracker basado únicamente en una identidad de cliente demostrada a través de peers confiables;
- ninguna confianza abierta en cabeceras aportadas directamente por Internet;
- políticas y valores actuales de Auth preservados;
- almacenamiento de contadores coherente con el número real de instancias;
- límite y ventana derivados de evidencia operacional, no del ejemplo del ADR.

Esto define la forma de la configuración sin introducir valores temporales ni configuración productiva sin uso.

## Criterios de elegibilidad para SHV2-03

La activación futura requiere evidencia conjunta de que:

1. la cadena cliente → borde → BFF/API está documentada y coincide con el despliegue real;
2. el API solo confía en proxies identificados y no en cabeceras arbitrarias;
3. dos clientes reales generan trackers diferentes a través del camino productivo;
4. una cabecera de IP falsificada no altera el tracker;
5. existe una muestra operacional suficiente para justificar límite y ventana;
6. la estrategia de almacenamiento coincide con la cantidad de instancias;
7. Auth conserva sus cinco políticas y no recibe accidentalmente el bucket global;
8. los flujos normales del frontend quedan por debajo del límite elegido;
9. la activación puede demostrar nuevos `429` solo al superar el límite aprobado.

Mientras cualquiera de estas condiciones falle, SHV2-03 no puede comenzar.

## Evidencia automatizada

`global-rate-limiting.characterization.spec.ts` verifica:

- las cinco políticas y valores actuales de Auth;
- sus metadatos y exclusiones actuales;
- la ausencia de política `default`;
- la ausencia de `APP_GUARD` global;
- `trust proxy = false` en Express;
- que `X-Forwarded-For` no modifica la IP observada en la configuración actual.
