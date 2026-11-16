# ADR-025 — Atribución de actores y aislamiento de AuditLog

- **Estado:** Aceptada bajo la delegación explícita de Producto, 2026-11-16.
- **Goal:** GOAL-02 — Evolución Financiera y Cumplimiento Electrónico.
- **Responsables:** Producto / Ingeniería.
- **Implementación:** validada localmente en la rama `codex/goal02-auditlog-actor-attribution`; todavía no integrada en `main` ni aplicada a entornos desplegados.

## Contexto verificado

`AuditService` era el escritor central de `AuditLog`, pero el modelo llamaba
`userId` a cualquier actor. Esto confundía usuarios autenticados con trabajos
de sistema. El restablecimiento público de contraseña atribuía su solicitud al
usuario objetivo, y el worker de prima podía atribuir la publicación al usuario
que aprobó el lote. Los eventos de scheduler se originan en varios tenants y
los flujos de autenticación pública no tienen un contexto de request autenticado.

El servicio central permite resolver estas rutas sin asignar RLS genérico a
modelos que no comparten un patrón tenant-scoped compatible.

## Decisión

1. Mantener la columna PostgreSQL `audit_logs.userId` por compatibilidad física.
   Prisma la expone como `actorId`; una columna `actorType` y una restricción
   `CHECK` distinguen `HUMAN` de `SYSTEM`. La migración clasifica los IDs
   históricos `system:*` y `service-premium-worker` como sistema.
2. Los flujos autenticados conservan el actor humano. Cuando hay contexto de
   tenant, `AuditService` exige que coincidan tenant y actor con ese contexto.
   En flujos públicos sin contexto, la transacción comprueba que el usuario
   exista dentro del tenant indicado antes de aceptar una atribución humana.
3. Los procesos de sistema usan identidades estables, tipadas y permitidas por
   una lista central. El scheduler registra `system:alerts-scheduler`; el
   worker de prima registra `system:service-premium-worker`; una solicitud
   anónima de restablecimiento registra `system:password-reset` y conserva el
   usuario objetivo como sujeto, no como actor. El reintento manual del
   scheduler sigue atribuido al administrador autenticado.
4. Para una transacción existente, el servicio comprueba que el GUC de tenant
   coincida con el evento. Cuando falta contexto en una ruta pública, instala
   el GUC con alcance local a la transacción y aplica RLS antes de insertar.
5. Activar y forzar RLS únicamente en `audit_logs`, con políticas tenant-scoped
   de lectura e inserción. No se crean políticas `UPDATE` o `DELETE`; se revocan
   esos privilegios y `TRUNCATE` de `PUBLIC`. Los roles de aplicación deben ser
   no propietarios, `NOSUPERUSER`, `NOBYPASSRLS` y no recibir `TRUNCATE`.
6. No añadir FK de `actorId` a `User`: los actores de sistema no son usuarios.
   La historia permanece append-only a través del servicio y las políticas de
   fila; no se añade una API de lectura en esta entrega.

## Alternativas consideradas

- **No habilitar RLS en AuditLog:** descartada porque las lecturas por tenant
  quedarían protegidas solo por filtros de aplicación y no existiría una
  frontera de inserción en PostgreSQL.
- **Aplicar una política RLS genérica a todo modelo tenant-scoped:** descartada;
  los flujos públicos y de sistema requieren contextos distintos y no justifican
  extender automáticamente la política a otras tablas.
- **Crear una tabla nueva para eventos de sistema:** descartada porque duplicaría
  el historial y fragmentaría las consultas de auditoría.
- **Atribuir tareas automáticas a quien aprobó o creó el lote:** descartada;
  esa persona no ejecutó el trabajo automático.
- **Agregar una FK directa a `User`:** descartada porque impediría persistir los
  actores de sistema sin crear usuarios ficticios.

## Validación y límites

La migración y el comportamiento se probaron contra PostgreSQL desechable
16.15, con todas las 121 migraciones. La integración RLS crea un rol
`NOSUPERUSER NOBYPASSRLS` que no es propietario: sin contexto no lee filas; con
un tenant ve solo sus eventos; el tenant incorrecto no puede insertar; no puede
actualizar ni borrar y no tiene `TRUNCATE`. Las suites completas de API pasan.

La identidad y los privilegios del usuario de base de datos realmente usado
por producción no se comprobaron y esta migración todavía no se aplicó allí.
Antes de desplegar, hay que verificar que ese rol no tenga `BYPASSRLS`, no sea
propietario y no reciba `TRUNCATE`. El permiso de `TRUNCATE` es de tabla y no
queda bloqueado por políticas RLS. El servicio de lectura de auditoría y la
retención/archivo permanecen fuera de alcance.

## Compatibilidad y reversión

La migración conserva la columna física `userId`, agrega una etiqueta de actor
con valor por defecto `HUMAN` y agrega las políticas RLS. La aplicación debe
desplegarse con el cliente Prisma generado a partir del schema actualizado.
La migración es de avance: no se recomienda retirar la etiqueta ni quitar RLS
como rollback porque perdería atribución o el aislamiento. Ante un fallo de
despliegue, detener el rollout, conservar evidencia y corregir con una nueva
migración compatible; no alterar ni borrar eventos históricos.
