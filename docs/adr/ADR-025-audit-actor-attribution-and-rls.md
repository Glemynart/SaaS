# ADR-025 — Atribución de actores y aislamiento de AuditLog

- **Estado:** Aceptada bajo la delegación explícita de Producto, 2026-11-16; seguridad del contexto firmada incorporada el 2026-11-17.
- **Goal:** GOAL-02 — Evolución Financiera y Cumplimiento Electrónico.
- **Responsables:** Producto / Ingeniería.
- **Implementación:** rama `codex/goal02-audit-actors-pr`; todavía no integrada en `main` ni aplicada a entornos desplegados.

## Contexto verificado

`AuditService` era el escritor central, pero el modelo llamaba `userId` a
cualquier actor. Esto confundía usuarios autenticados con trabajos de sistema.
El restablecimiento público de contraseña atribuía su solicitud al usuario
objetivo, y el worker de prima podía atribuir la publicación a quien aprobó el
lote. Los eventos de scheduler se originan en varios tenants y los flujos de
autenticación pública no tienen un contexto de request autenticado.

Además, una prueba con PostgreSQL 17.11 demostró que un rol de runtime sin
`SUPERUSER`, `BYPASSRLS` ni propiedad de tablas podía cambiar
`app.current_tenant_id` con `set_config`, leer otro tenant e insertar un evento
`HUMAN` con un actor inventado. Las políticas que confían solo en un GUC mutable
no son una frontera de seguridad frente a SQL arbitrario con credenciales de
runtime.

## Decisión

### Atribución de actores

1. Se conserva la columna PostgreSQL `audit_logs.userId` por compatibilidad
   física; Prisma la expone como `actorId`. `actorType` y una restricción `CHECK`
   distinguen `HUMAN` de `SYSTEM`. La migración clasifica los IDs históricos
   `system:*` y `service-premium-worker` como sistema.
2. Los flujos autenticados conservan el actor humano. Restablecimientos públicos
   y trabajos automáticos usan identidades de sistema estables y permitidas; el
   usuario objetivo permanece como sujeto, no como actor. La aceptación de una
   invitación mediante token se atribuye al usuario creado con
   `authenticationMethod=INVITATION_TOKEN`, sin afirmar que existiera una sesión.
3. No se agrega FK de actor a `User`: los actores de sistema no son usuarios y
   no se crean usuarios ficticios.

### Contexto de tenant firmado

4. La aplicación firma con HMAC-SHA256 un payload canónico que contiene versión,
   `keyId`, tenant, actor, tipo de actor y `pg_current_xact_id()`. Guarda el
   payload, su firma y el GUC heredado como valores locales a la transacción.
   PostgreSQL compara la firma, el tenant reflejado y el ID de la transacción;
   modificar el GUC o reproducir el payload en otra transacción invalida el
   contexto. Una conexión reutilizada comienza sin ese contexto local. El
   scheduler puede cambiar de tenant dentro de una transacción solo mediante un
   helper explícito que conserva el mismo actor SYSTEM allowlisted; la
   recuperación de ejecuciones obsoletas se separa de una solicitud manual para
   no atribuir trabajo de sistema al administrador que reintentó otra ejecución.
5. La clave es Base64 canónico, contiene al menos 32 bytes y es distinta por
   entorno. La API recibe `AUDIT_LOG_SIGNING_KEY`; la base mantiene el material
   en `audit_private.audit_log_signing_keys`. El rol runtime no puede leerlo ni
   ejecutar el verificador. El ID de clave no es secreto y facilita rotación.
6. Las funciones de lectura de scope son `SECURITY DEFINER`, fijan un
   `search_path` seguro y revelan únicamente la identidad firmada de la sesión;
   no pueden crear ni firmar contextos. Son ejecutables para que las políticas
   RLS funcionen. El verificador, el contexto completo y el append permanecen
   privados; solo los roles runtime autorizados pueden ejecutar el append.
7. `AuditService` escribe únicamente mediante
   `audit_private.append_audit_event(payload, signature, keyId)`. Esa función
   valida la firma del evento, que el evento coincida con el contexto de la
   transacción y que el actor humano sea un usuario activo del tenant. Los
   actores `SYSTEM` deben estar en una allowlist. Inserción y operación de
   negocio permanecen en la misma transacción; el ID hace el append idempotente
   ante reintentos.
8. `audit_logs` conserva RLS habilitado y forzado, con políticas tenant-scoped
   de `SELECT` e `INSERT`. Todas las políticas tenant existentes que consultaban
   directamente el GUC mutable se convierten a las funciones que verifican la
   firma. El rol runtime no tiene privilegios directos de tabla o columna en
   `audit_logs`, ni `UPDATE`, `DELETE` o `TRUNCATE`; tampoco puede asumir roles
   propietarios. El propietario de funciones es `NOLOGIN`, sin atributos
   administrativos, no es propietario de `audit_logs` y no tiene membresías.
9. Una identidad de migración separada crea el esquema y ejecuta Prisma. Para
   despliegues no superusuario, un DBA aprovisiona temporalmente una membresía
   `SET` sin `ADMIN` ni herencia para el propietario de funciones; el DBA la
   revoca después de migrar y provisionar la clave. La API recibe únicamente
   las credenciales runtime. CI usa una base efímera y su clave pública de
   prueba; esa clave no se reutiliza fuera de CI.

## Modelo de amenazas y límites

La solución evita que quien solo obtiene las credenciales SQL de runtime pueda
forjar un tenant o actor firmado, leer o modificar directamente AuditLog,
alterar eventos históricos, truncar la tabla o hacerse pasar por un actor de
sistema. Alterar cualquier GUC sin la firma válida deja RLS sin scope; el append
no está disponible como inserción arbitraria porque exige otra firma HMAC que
solo genera la aplicación.

Esto **no** protege frente a un compromiso completo del proceso de API, de su
memoria o de `AUDIT_LOG_SIGNING_KEY`: quien obtiene esa clave puede crear firmas
válidas. Tampoco protege frente a `SUPERUSER`, un administrador de base de datos
o una identidad de migración comprometida mientras tenga el acceso temporal
`SET`. Por ello la clave se guarda en un gestor de secretos fuera de Git, el
permiso temporal se revoca antes de iniciar API y el runtime se verifica con el
procedimiento de solo lectura de `deploy/postgres/verify-audit-runtime-readonly.sql`.

El scope humano general acredita que la API emitió una identidad después de la
validación de autenticación; no vuelve a consultar `User` en cada predicado RLS,
para no invalidar una petición si el usuario se desactiva durante su ejecución.
En cambio, el append exige que el actor humano esté activo y pertenezca al
tenant al momento de escribir el evento.

## Alternativas consideradas

- **Seguir confiando en el GUC mutable:** descartada; la prueba PostgreSQL
  reprodujo lectura cruzada e inserción HUMAN falsificada.
- **Hacer `SET ROLE` a un rol privilegiado desde runtime:** descartada; daría al
  runtime acceso directo al historial y anularía la separación de privilegios.
- **Separar AuditLog por base o usuario de aplicación:** ofrece aislamiento,
  pero implica una segunda conexión/transacción y rompe atomicidad con la
  operación auditada. Se reserva para una arquitectura futura si se necesita
  una frontera de compromiso más fuerte.
- **Dar `INSERT` directo y confiar solo en `WITH CHECK`:** descartada porque el
  GUC mutable permitiría fabricar el actor.
- **No habilitar RLS o extender una política genérica a todos los modelos:**
  descartada; no resuelve la falsificación y los flujos públicos/sistema no
  comparten un único contexto aplicable a todas las tablas.
- **Crear una tabla de eventos de sistema o una FK a `User`:** descartado,
  porque fragmentaría el historial o impediría actores de sistema reales.

## Validación

La implementación se probó en PostgreSQL desechable 17.11. La suite RLS prueba
lectura cruzada y escritura tras manipular el GUC, firmas/contextos inválidos,
actor HUMAN y SYSTEM, ausencia y reutilización de contexto, rollback,
idempotencia concurrente, RLS forzado, permisos directos de tabla/columna y
membresías de roles. También verifica el cambio multi-tenant del scheduler bajo
el mismo actor SYSTEM y rechaza ese cambio desde un contexto HUMAN.

Las 122 migraciones se aplicaron en una base nueva con un migrador sin
`SUPERUSER`, `CREATEDB`, `CREATEROLE`, `REPLICATION` ni `BYPASSRLS`, propietario
de la base y con una membresía temporal `SET` sin `ADMIN` ni herencia. Se
provisionó la clave de prueba, se revocó esa membresía y se ejecutó la
verificación runtime de solo lectura. El runtime quedó sin acceso directo a
`audit_logs`, a sus columnas y a `_prisma_migrations`, sin membresías ni
`BYPASSRLS`, y con permiso únicamente para invocar el append firmado. La suite
API completa pasó con PostgreSQL descartable.

La identidad y los privilegios reales de producción **no se comprobaron**; esta
migración no se ha aplicado allí. Antes de cualquier despliegue se deben
verificar el rol runtime, sus membresías, propiedad, privilegios, políticas RLS
y metadata de la clave con acceso autorizado de solo lectura. No compartir
URLs, contraseñas, IP internas ni el material de clave. La lectura de AuditLog y
su política de retención/archivo siguen fuera de alcance.

## Compatibilidad y reversión

La migración conserva `userId`, añade `actorType`, instala el contexto firmado y
actualiza las expresiones de políticas RLS en una transacción. La API necesita
la misma clave e ID configurados en la base antes de iniciar. No se recomienda
retirar el contexto firmado, los permisos restringidos o RLS como rollback:
ante un fallo, detener el rollout y corregir con una nueva migración compatible;
no alterar ni borrar eventos históricos.
