# ADR-019 — Cartera y aplicación de recaudos a facturas internas

| Campo         | Valor                                                                 |
| ------------- | --------------------------------------------------------------------- |
| **Estado**    | Aceptada por delegación explícita de Producto al Lead Engineer        |
| **Fecha**     | 2026-11-03                                                            |
| **Decisores** | Producto (delegación explícita) · Ingeniería · Contabilidad pendiente |
| **Ámbito**    | Recaudos COP aplicados a facturas internas emitidas                   |
| **Goal**      | GOAL-02 — demo financiera integrada                                   |
| **Relaciona** | `Invoice` · `Customer` · `Tercero` · `ComprobanteContable` · Ledger   |

## Contexto

La emisión interna de una factura crea en el Ledger la cuenta por cobrar a
clientes y congela la identidad del tercero. El sistema no registra hoy el
dinero recibido ni deriva el saldo pendiente de cada factura. Mostrar el total
facturado como si fuera dinero recaudado confundiría dos hechos financieros.

El backlog de GOAL-02 prioriza mostrar saldos, pagos parciales y aplicación a
facturas a partir de hechos trazables que concilien con el Ledger.

## Decisión

1. El MVP registra un **recaudo recibido**, en pesos colombianos, con fecha
   calendario, medio `EFECTIVO` o `TRANSFERENCIA`, referencia opcional, usuario,
   clave de idempotencia y hash del contenido normalizado.
2. Las facturas nuevas requieren una fecha de vencimiento calendario indicada
   por el usuario; no se infiere un plazo comercial por defecto. Los registros
   históricos pueden no tener fecha y se muestran como «sin vencimiento».
   Las facturas históricas en borrador sin fecha pueden emitirse sin vencimiento;
   si una fecha se registra, al emitir se rechaza cuando antecede a la emisión.
3. Cada recaudo se aplica a una o más facturas **emitidas**, contabilizadas y
   del mismo tenant y cliente. La suma de las aplicaciones debe ser exactamente
   igual al recaudo. Se permiten abonos parciales mediante recaudos sucesivos;
   no se permiten sobreaplicaciones, saldos sin aplicar ni anticipos en este
   MVP.
4. El saldo de cartera se deriva como el total congelado de la factura menos
   sus aplicaciones pertenecientes a recaudos no reversados. No se persiste un
   saldo mutable. El estado vencida/al día se deriva del vencimiento, fecha
   actual y saldo pendiente; no se guardan intereses ni mora.
5. El registro es transaccional: bloquea las facturas en orden estable, valida
   el saldo vigente, guarda el recaudo y sus aplicaciones, contabiliza el
   comprobante de ingreso `CI` y registra auditoría en la misma transacción.
   Efectivo usa el rol `CAJA_GENERAL`; transferencia usa `BANCO_PRINCIPAL`.
   El crédito a `CLIENTES_NACIONALES` conserva el tercero congelado por cada
   factura aplicada. La fecha debe pertenecer a un período contable abierto.
6. Un recaudo no se edita ni se elimina. Su reversión exige motivo y usuario,
   crea un evento de reversión y anula el comprobante mediante el Ledger. Las
   aplicaciones de un recaudo reversado dejan de reducir cartera. Una factura
   con recaudos activos no se puede cancelar hasta reversar esos recaudos.
7. La API valida tenant, cliente, factura emitida, tercero congelado, cuenta,
   período, montos e idempotencia. Las relaciones entre recaudos, aplicaciones,
   clientes y facturas conservan la clave compuesta tenant-scoped. Las tres
   tablas tenant-scoped aplican RLS forzado; sus lecturas pasan por la frontera
   `TenantPrismaService` que instala el tenant de la transacción.

## Consecuencias y límites

- Se puede demostrar el ciclo factura emitida → recaudo parcial/final → saldo
  pendiente → comprobante de ingreso en Ledger.
- El dato representa que un usuario informó haber recibido dinero; no confirma
  la conciliación con un extracto ni el movimiento real de una cuenta bancaria.
- El MVP no automatiza conciliación bancaria, no procesa pagos, no registra
  anticipos no aplicados ni devoluciones, no admite moneda distinta de COP y no
  emite facturas electrónicas DIAN.
- La migración agrega una columna nullable y tablas vacías, por lo que preserva
  las facturas históricas. Después de registrar recaudos reales, no se deben
  borrar tablas o hechos financieros con una reversión de esquema; las
  correcciones se publican hacia adelante.
- La revisión contable-fiscal operativa de la facturación interna continúa
  pendiente; esta entrega no la sustituye.

## Criterios de aceptación

- Un recaudo parcial disminuye el saldo derivado y crea un comprobante de
  ingreso balanceado con tercero y cuenta de caja/banco correctos.
- Repetir exactamente una solicitud con la misma clave devuelve el mismo hecho
  sin crear un segundo recaudo o comprobante; reutilizar la clave con otro
  contenido produce conflicto.
- Se rechazan facturas ajenas al tenant/cliente, en borrador/canceladas, sin
  comprobante de emisión, con saldo insuficiente o con tercero no congelado.
- Dos solicitudes concurrentes no pueden aplicar más que el saldo pendiente.
- La reversión conserva el original, genera el reverso contable y restablece el
  saldo de cartera; no se permite reversar dos veces ni cancelar la factura
  mientras tenga una aplicación activa.
- El cierre o ausencia del período de la fecha del recaudo impide guardar tanto
  el recaudo como su asiento.
- La UI captura vencimiento, muestra facturado, abonado, pendiente y estado de
  vencimiento desde hechos persistidos y permite registrar/consultar recaudos
  sin exponer datos de otro tenant.
- El aislamiento de las tres tablas de recaudos se verifica con RLS activado y
  forzado: un rol sin `app.current_tenant_id` no obtiene filas, y cada tenant
  solo lee sus registros.

## Evidencia de aceptación

La decisión se registra por la autorización del usuario de que el Lead
Engineer tome las decisiones necesarias y continúe GOAL-02. En una base
PostgreSQL 16 desechable se aplicaron las 82 migraciones. Pasaron 30 pruebas
dirigidas de Billing y autorización, y 11 pruebas PostgreSQL de RLS; esta última
suite verifica que un rol `NOSUPERUSER NOBYPASSRLS` vea solo sus recaudos,
aplicaciones y reversos, y no vea filas sin contexto de tenant. También pasaron
los typechecks y builds de API/web y el Browser E2E financiero. Este E2E
verificó el recorrido desde la factura hasta el Ledger, replay idempotente,
reversión, bloqueo de cancelación y dos solicitudes simultáneas que no
sobreaplicaron el saldo. Esta evidencia no sustituye la revisión contable-fiscal
ni la aceptación de un cliente antes del uso operativo.
