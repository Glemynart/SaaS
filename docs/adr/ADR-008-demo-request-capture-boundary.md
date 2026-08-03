# ADR-008 — Frontera de plataforma para solicitudes públicas de demo

| Campo           | Valor                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------ |
| **Estado**      | Aceptado                                                                                   |
| **Fecha**       | 2026-08-03                                                                                 |
| **Decisores**   | Producto · Arquitectura · Seguridad                                                        |
| **Ámbito**      | Platform Evolution · E7.3 futura · landing pública · monolito NestJS/Next.js/Prisma        |
| **Relacionado** | [GOAL-01](../goals/GOAL-01-primer-cliente-operando.md), [ADR-SEC-001](ADR-SEC-001.md),     |
|                 | [ADR-SEC-002](ADR-SEC-002.md), [Platform Evolution](../architecture/PLATFORM-EVOLUTION.md) |
| **Reemplaza**   | —                                                                                          |

## Contexto

E7.3 requiere que la solicitud de demo de la landing deje de simular un envío.
El código actual valida el formulario en el navegador, espera 800 ms y muestra
éxito; no persiste la solicitud, no entrega una notificación y no existe una
bandeja operativa. Los datos actuales son nombre, organización, cargo, correo,
teléfono, tamaño de planta y necesidad principal.

La solicitud ocurre antes de que el interesado tenga una cuenta o un tenant.
El modelo actual, sin embargo, hace que `Tenant` sea la raíz de los datos del
SaaS, que `User` pertenezca a un tenant y que `AuditLog` requiera `tenantId` y
`userId`. Tampoco existe una identidad de plataforma, un rol de soporte o una
superficie para operar solicitudes fuera de un tenant.

La integración de correo existente solo conoce `password-reset`, requiere una
configuración externa para dejar el modo degradado y audita fallos con una
identidad de tenant. El rate limiting global permanece desactivado; solo
existen políticas nombradas para autenticación.

Por tanto, E7.3 no está bloqueada por DNS, Cloudflare, R2 o staging en su núcleo,
pero tampoco es una Epic implementable con una extensión trivial del modelo
tenant-aware. Persistir el registro en un tenant, crear un tenant ficticio o
prometer contacto sin una operación receptora produciría una frontera de
seguridad o una promesa de producto falsa.

## Decisión adoptada

Antes de implementar E7.3 se adopta una frontera de plataforma
explícita para la captura y operación de solicitudes públicas:

1. **Propiedad:** crear un agregado `DemoRequest` del plano de plataforma,
   separado de los datos de tenants. No recibirá un `tenantId` inventado ni será
   visible para ningún usuario de tenant.
2. **Operación:** crear una identidad de plataforma y una bandeja autenticada
   con permisos propios para que el equipo comercial opere las solicitudes. El
   correo o un CRM pueden ser notificaciones complementarias, pero no serán la
   única fuente de verdad.
3. **Ciclo de vida:** usar como mínimo `PENDIENTE`, `CONTACTADO` y
   `DESCARTADO`, registrando actor, fecha y motivo cuando cambie el estado.
4. **Privacidad:** definir finalidad, base de tratamiento, consentimiento,
   retención, borrado o anonimización antes de persistir PII. La política
   mínima es consentimiento explícito para contacto comercial, versión y fecha
   de la política, y no almacenar documentos ni datos no necesarios.
5. **Superficie pública:** exigir DTO estricto con allowlist, límites de tamaño,
   normalización, respuesta uniforme sin PII, deduplicación o idempotencia,
   protección anti-automatización y rate limit dedicado. No se activará el
   rate limiting global como efecto colateral de E7.3.

La frontera adoptada queda así:

```text
Landing pública
      │ DTO estricto + consentimiento + controles anti-abuso
      ▼
Puerto de captura de demo
      │ identidad de plataforma
      ▼
DemoRequest (plano plataforma, no tenant)
      ├── bandeja operativa con RBAC propio
      └── notificación opcional mediante EmailService o adaptador futuro
```

### Frontera de datos y proveedores

El dominio interno será dueño de la solicitud, su ciclo de vida, consentimiento,
retención, deduplicación, auditoría y estados normalizados. Un proveedor de
correo o CRM solo podrá recibir una proyección mínima mediante un adaptador; sus
identificadores externos, respuestas técnicas y detalles de entrega no podrán
contaminar el agregado interno. El navegador nunca recibirá secretos ni se
conectará directamente a un proveedor.

La excepción al patrón tenant-scoped debe quedar inventariada como una
excepción de plataforma, con identidad, permisos, rutas y auditoría propios.
No autoriza accesos cross-tenant genéricos ni convierte a un prospecto en un
cliente.

## Alternativas consideradas

### Guardar la solicitud en un tenant existente o ficticio

- **Ventaja:** reutiliza tablas, roles y auditoría actuales.
- **Desventaja:** no existe una relación de pertenencia legítima antes del alta.
- **Por qué no:** confunde un prospecto con un cliente y puede exponer PII a un
  tenant incorrecto.

### Exponer las solicitudes a cualquier `ADMIN` de tenant

- **Ventaja:** evita crear una identidad de plataforma.
- **Desventaja:** mezcla permisos de cliente y plataforma.
- **Por qué no:** contradice el aislamiento y la separación de permisos de
  ADR-SEC-001.

### Enviar directamente desde el navegador a correo o CRM

- **Ventaja:** reduce el código inicial del backend.
- **Desventaja:** expone secretos o acopla la landing al proveedor y no deja una
  fuente de verdad propia.
- **Por qué no:** cruza la frontera Z2 → tercero sin una capa de aplicación ni
  operación auditable.

### Mantener el éxito simulado hasta tener staging

- **Ventaja:** no requiere nueva infraestructura.
- **Desventaja:** conserva una promesa falsa y no acerca la captura real.
- **Por qué no:** E7.3 debe resolver la operación de plataforma; staging no
  sustituye esa decisión.

## Consecuencias

### Positivas

- La landing podrá capturar PII sin inventar tenants ni debilitar el aislamiento.
- La operación comercial quedará separada de los permisos de clientes.
- El proveedor de correo o CRM podrá sustituirse detrás de un adaptador.
- La promesa pública podrá alinearse con una capacidad operativa verificable.

### Negativas

- Se necesita una identidad y una superficie de plataforma que hoy no existen.
- La captura pública requiere controles anti-abuso y una política de privacidad
  operable.
- La retención de prospectos tendrá un ciclo de vida distinto al de los datos
  laborales de un tenant.

## Decisión de alcance de GOAL-01

E7.3 no forma parte del resultado mínimo de GOAL-01. El Goal se cierra cuando un
primer cliente ya identificado puede ser incorporado y operar su tenant en
producción; la captura pública de prospectos ocurre antes de que exista esa
relación y pertenece al canal de adquisición comercial.

El código actual permite iniciar la operación por un canal directo: el registro
crea la organización y la cuenta administradora, y un `ADMIN` puede crear
usuarios adicionales desde la aplicación. La landing y su formulario de demo no
participan en ese recorrido. Por tanto, retirar E7.3 de GOAL-01 reduce alcance
sin eliminar una capacidad necesaria para el primer cliente ni introducir deuda
en los módulos laborales y documentales.

E7.3 queda en el backlog de Platform Evolution. Se priorizará cuando exista una
necesidad comercial verificable de capturar y operar prospectos desde la landing.
Esta decisión no modifica la frontera arquitectónica aprobada en este ADR; solo
define cuándo esa frontera se convierte en implementación prioritaria.

## Criterio para priorizar E7.3 en Platform Evolution

La implementación de E7.3 deberá iniciarse únicamente cuando la adquisición
comercial sea prioritaria y se confirmen explícitamente los cinco puntos de la
decisión adoptada. La Epic posterior deberá ser end-to-end e incluir
persistencia, operación autenticada, autorización, retención, controles
anti-abuso, pruebas browser y copy público alineado con el canal real.
