# ADR-011 — Frontera de contabilización de facturas internas

| Campo           | Valor                                                                                     |
| --------------- | ----------------------------------------------------------------------------------------- |
| **Estado**      | proposed — requiere aprobación de producto y contabilidad                                 |
| **Fecha**       | 2026-10-30                                                                                |
| **Decisores**   | Producto · Contabilidad funcional · Arquitectura                                          |
| **Ámbito**      | `Billing.Invoice` interno y su integración con `LedgerService`                            |
| **Relacionado** | GOAL-02 M0; ADR-001 (contrato implementado del Ledger); ADR-005 (facturación electrónica) |

## Contexto verificado

Este ADR se prepara sobre el código de la rama `codex/goal02-financial-first-increment`, HEAD `c07a9d7`.

- `Invoice` está documentada en Prisma como factura de venta interna, todavía no DIAN; tiene los estados `DRAFT`, `ISSUED` y `CANCELLED`.
- `BillingService.createInvoice` crea facturas y líneas; `updateInvoiceStatus` actualiza el estado sin invocar el Ledger.
- `InvoiceItem` conserva cantidad, precio unitario y subtotal, pero no una tasa, base ni valor de impuesto por línea. `ProductService.impuesto` existe; `createInvoice` no lo consulta y actualmente calcula 19% sobre el subtotal total.
- `Customer` guarda NIT y razón social, pero no tiene relación con el `Tercero` contable canónico.
- `LedgerService.registrarComprobante` valida período abierto, cuentas del tenant, partida doble e identidad de origen. `LedgerService.anular` anula en período abierto o crea un reverso si el período original está cerrado.
- `BillingController` recibe `CurrentUserPayload.userId`, pero actualmente solo pasa `tenantId` a `BillingService`; `BillingModule` tampoco importa `AccountingModule`. `RegistrarComprobanteInput.userId` es obligatorio y `LedgerService` acepta un cliente transaccional.
- El seed contable incluye los roles `CLIENTES_NACIONALES`, `INGRESOS_OPERACIONALES` e `IVA_GENERADO`. El Ledger exige un `periodoId` y no conoce Billing.
- ADR-005 mantiene un bounded context separado para facturación electrónica y fija `FACTURA_ACEPTADA` como evento contable de esa ruta. Este ADR no autoriza transmisión DIAN/UGPP ni reemplaza ese contexto.

Estos hechos describen el código inspeccionado; no convierten en aceptadas las decisiones del ADR-001, cuyo encabezado aún indica estado propuesto.

## Decisión propuesta

Para una **factura interna independiente de la emisión electrónica**, la transición `DRAFT → ISSUED` será el evento que solicita contabilizar la venta. El cambio de estado y el registro del comprobante ocurrirán dentro de una misma transacción PostgreSQL tenant-aware. La factura no se marcará `ISSUED` si el comprobante no puede contabilizarse.

El comprobante usará una clave de origen estable y única: `BILLING_INVOICE` + `Invoice.id` + `ISSUED`. Repetir la misma solicitud devolverá o reconocerá el comprobante ya asociado, sin numerar otro. La integración no escribirá cuentas PUC directamente en Billing: resolverá, por tenant, roles activos de `CuentaSistemaMap`.

Al cancelar una factura `ISSUED`, Billing actualizará su estado y llamará a `LedgerService.anular` en la misma transacción, con motivo y auditoría. Aplican las reglas existentes del Ledger para períodos abiertos/cerrados; no se borran factura, comprobante ni movimientos. Cancelar un borrador no produce asiento. No se permitirá devolver una factura contabilizada a `DRAFT`.

El período contable será el período abierto que corresponda a la fecha de emisión. Si no existe o está cerrado, la operación de emisión falla y no desplaza silenciosamente la contabilización a otro período. La anulación seguirá el comportamiento de corrección ya ofrecido por el Ledger.

El mapper propuesto separa CxC, ingreso e impuesto usando los roles contables del tenant, atribuye CxC al tercero del cliente y comprueba partida doble. No se contabilizará si falta un mapeo requerido o si la cuenta no satisface las validaciones del Ledger.

## Condiciones previas para implementar

Esta propuesta **no aprueba tasas ni tratamientos tributarios** y no habilita aún el posteo. Antes de implementar la Epic:

1. Producto y contabilidad aprobarán cómo se determina el impuesto de cada línea, su redondeo y el tratamiento de líneas manuales. Las tasas usadas deben provenir de datos explícitos, no del 19% fijo actual ni de una lectura posterior del catálogo vivo.
2. Se almacenará en cada línea el snapshot suficiente de base, tratamiento/tasa e impuesto calculado para reconstruir el comprobante; se verificará que los totales de línea concilien con los del encabezado. No se recalcularán facturas históricas desde `ProductService`.
3. `Customer` tendrá un vínculo explícito y tenant-safe con un `Tercero` activo con rol de cliente. No se inferirá ni creará silenciosamente el tercero normalizando el NIT. Clientes históricos sin vínculo podrán permanecer en borrador hasta resolver su correspondencia.
4. La emisión requerirá período abierto, mapeos de cuenta completos, una identidad canónica del tercero y el actor autenticado. La API debe propagar `userId` desde `CurrentUserPayload` al caso de uso contable —no recibirlo del body—, conservar el permiso ADMIN actual para cambiar el estado y ejecutar los cambios de Billing y Ledger en la misma transacción y contexto de tenant.
5. Los caminos de UI/API permitirán al usuario ver el comprobante y el motivo de rechazo; los reintentos serán idempotentes. Cancelación y auditoría se probarán en período abierto y cerrado.
6. La migración será aditiva y reversible: columnas y vínculo inicialmente opcionales, backfill verificable y sin modificar comprobantes ni facturas históricas. El despliegue no debe hacer backfill financiero automático.

Si el documento electrónico representa una factura interna ya contabilizada, la ruta electrónica deberá enlazar la evidencia con ese mismo hecho y no contabilizar de nuevo la venta. Facturas electrónicas independientes seguirán la regla de ADR-005. La relación entre ambos agregados debe verificarse antes de implementar H2; este ADR no define la emisión fiscal.

## Alternativas consideradas

### A. Esperar a `FACTURA_ACEPTADA`

Conserva literalmente el disparador de ADR-005, pero deja las facturas internas del demo sin efecto contable hasta que exista el flujo electrónico. No entrega la integración interna priorizada por M0.

### B. Contabilizar al emitir la factura interna — recomendada

Conecta el flujo que hoy usa Billing con el Ledger y da un resultado visible al cliente sin depender de la transmisión DIAN. Requiere resolver snapshots tributarios, vínculo de tercero, período y correcciones antes de postear.

### C. Crear un acto de venta independiente de `Invoice.status`

Separaría la emisión comercial del registro contable, pero agrega estados y una acción que hoy no existen ni están solicitados para M0. Se descarta para el primer incremento, salvo que Producto y Contabilidad indiquen que `ISSUED` no representa el hecho interno que desean mostrar.

## Consecuencias

### Positivas

- Una factura interna emitida puede producir un comprobante trazable en el Ledger sin crear otro libro.
- El usuario recibe resultado atómico: factura emitida y contabilizada, o ningún cambio parcial.
- La idempotencia, los roles de cuenta y las correcciones reutilizan contratos ya implementados.

### Negativas y riesgos

- La decisión cambia el significado financiero de `ISSUED` y necesita validación de Producto y Contabilidad.
- No es implementable con seguridad hasta resolver el impuesto por línea y el mapeo explícito de `Customer` a `Tercero`.
- Una relación futura con `FacturaElectronica` puede duplicar el asiento si H2 no reutiliza el hecho interno ya contabilizado.
- El código contable y la UI actuales no prueban que el recorrido de facturación integrada esté listo para clientes.

## Pregunta de aprobación

¿Se aprueba la opción B para **facturas internas independientes**, con las seis condiciones previas como puertas obligatorias y manteniendo ADR-005 para la emisión electrónica? La aprobación de este ADR no aprueba tasas tributarias, reglas de reconocimiento legal, ni transmisión fiscal; esas decisiones requieren validación separada.
