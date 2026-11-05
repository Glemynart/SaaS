# ADR-020 — Contrato inicial de adaptadores regulatorios

| Campo           | Valor                                                                   |
| --------------- | ----------------------------------------------------------------------- |
| **Estado**      | accepted bajo la delegación de Producto al Lead Engineer                |
| **Fecha**       | 2026-11-05                                                              |
| **Decisores**   | Producto (delegación explícita) · Arquitectura · Seguridad              |
| **Ámbito**      | H1 de GOAL-02; primer caso: envío y conciliación de factura electrónica |
| **Relacionado** | GOAL-02 · ADR-001 · ADR-005 · ADR-SEC-001 · ADR-SEC-002                 |

## Contexto verificado

- `Billing.Invoice` y su causación contable interna existen, pero no son una
  factura electrónica ni tienen transmisión ante DIAN.
- ADR-005 y PR10 ya fijan el agregado fiscal, el snapshot canónico, la
  idempotencia, la conciliación antes de repetir resultados ambiguos, la
  evidencia privada y el puerto de MATIAS detrás de un adaptador.
- El segmento cliente y el flujo comercial están definidos a nivel de producto;
  aún no se confirmó un cliente operativo ni un sandbox/contrato real de
  proveedor para este caso.
- En `main` `adec87e` existe el agregado persistente `FacturaElectronica`
  y su fake de contrato (PR #284); PR #285 añade snapshots fiscales y líneas
  con tenant isolation y RLS. PR #291 añade almacenamiento durable de intentos,
  transiciones y referencias de evidencia privada con checksum y RLS; no hay
  adaptador DIAN ni transmisión. `MATIAS_API_URL` y `MATIAS_API_KEY` solo
  aparecen en la configuración; no se usan para transmitir documentos.
- PR #290 añadió a `main` la exportación CSV de reportes contables; PR #291
  completa una parte de persistencia de integración, sin cambiar el estado de
  transmisión fiscal.
- ADR-SEC-001 está marcado como propuesto. Se revisaron para H1 sus apartados
  de aislamiento, auditoría, secretos y observabilidad. Sus principios no se
  toman como prueba de que los controles ya estén implementados. El marco
  específico de facturación se concreta aquí sin declarar aprobada toda la
  arquitectura de seguridad de la plataforma.

## Decisión

1. El primer contrato ejecutable será específico para factura electrónica. No
   se crea una API pública, un bus de eventos genérico ni un motor de workflows.
2. La solicitud al puerto contiene tenant, factura, identidad estable del
   evento, clave idempotente, versión y hash del payload canónico. El adaptador
   expone un `providerId` y una `contractVersion` no secreta que se guardarán
   con cada intento. No recibe DTOs, códigos, URL ni credenciales del proveedor.
3. La misma combinación tenant/evento/hash puede reintentarse con la misma
   identidad. Reutilizar la clave con otro evento o hash falla. Una corrección
   es un evento nuevo, relacionado con el documento original; nunca altera la
   factura ni la evidencia anteriores.
4. El adaptador normaliza sus respuestas a `ACCEPTED`, `REJECTED`, `PENDING` o
   `UNKNOWN`. Ante `UNKNOWN`, el caso de uso concilia antes de permitir otro
   envío. Una respuesta no confirmada nunca causa el Ledger.
5. El adaptador no recibe material secreto desde el controlador ni lo devuelve
   en errores. La referencia tenant-scoped al secreto se resuelve dentro de la
   frontera de infraestructura. La implementación del almacén, cifrado y
   rotación queda pendiente hasta seleccionar y validar el proveedor real; no
   se usa una clave global para representar credenciales de emisores.
6. Los intentos y transiciones se persistirán como historial append-only; los
   archivos de respuesta se conservarán mediante `StorageProvider`, privados,
   con checksum y referencia tenant-scoped. Se reutilizan `TenantPrismaService`,
   `AuditService`, RBAC, scheduler y límites del backend donde apliquen.
7. Un fake de prueba implementa el mismo puerto y su contrato prueba
   idempotencia, aislamiento tenant, correcciones, conciliación y fallos
   cerrados. No simula aceptación normativa ni compatibilidad de MATIAS.

## Límites de esta decisión

Este ADR permite implementar y verificar el contrato interno con un proveedor
falso. PR #285 completa la base persistente del dominio fiscal: agregado,
líneas y snapshots tenant-scoped. PR #286 completa la configuración de emisor
y rangos autorizados, con numeración atómica preparada para consumirse dentro
de la transacción de emisión; no transmite ni expone un endpoint que consuma un
consecutivo aislado.

PR #291, fusionado en `main` como `6496dccc86cd2cd10c17d5c3dfcc20866b64606a`,
implementa la siguiente fundación: evento y payload idempotentes, secuencia
durable de intentos, resultados normalizados, transiciones append-only, RLS y
almacenamiento privado de evidencia con checksum. Su servicio interno no está
conectado a un controlador, worker, UI ni adaptador MATIAS; no realiza
solicitudes externas y no constituye un flujo utilizable por clientes. La
decisión no aprueba esos componentes ni su operación.

PR #303 añade la orquestación interna de un intento, todavía sin adaptador
registrado ni endpoint de ejecución. La interfaz actual ofrece una vista
tenant-scoped de solo lectura para las últimas transmisiones y resultados
normalizados. La respuesta omite el payload canónico, la clave idempotente, las
rutas de evidencia y su contenido. La pantalla permite observar registros
existentes, pero no enviar, conciliar ni afirmar aceptación DIAN.

Siguen pendientes la resolución segura de credenciales por tenant, el endpoint
de ejecución y worker conectados, observabilidad operativa del worker y
validación del contrato/sandbox del proveedor. PR13 de PR10 debe validar sandbox
antes de escribir un adaptador real. Ninguno de los incrementos actuales
acredita un documento válido ante DIAN, aceptación de operador, liquidación ni
pago.

La aceptación del fake solo demuestra el contrato del código local. No acredita
un documento válido ante DIAN, aceptación de operador, liquidación ni pago.

## Consecuencias

- El caso de uso y las pruebas pueden avanzar sin credenciales ni entorno
  externo.
- El límite de proveedor queda explícito antes de crear persistencia fiscal.
- H1 continúa en progreso: PR #291 dejó intentos y evidencia durables; PR #303
  orquesta un intento interno y esta continuación permite consultar un resumen
  tenant-scoped. Faltan credenciales por tenant, endpoint de ejecución/worker
  conectados, observabilidad operativa del worker y aceptación del sandbox del
  proveedor. La ruta de transmisión real sigue bloqueada hasta resolver esas
  dependencias.
