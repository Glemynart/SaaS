# ADR-011 — Frontera de contabilización de facturas internas

| Campo           | Valor                                                                                     |
| --------------- | ----------------------------------------------------------------------------------------- |
| **Estado**      | accepted with changes                                                                     |
| **Fecha**       | 2026-10-31                                                                                |
| **Decisores**   | Producto · Contabilidad funcional · Arquitectura                                          |
| **Ámbito**      | `Billing.Invoice` interno y su integración con `LedgerService`                            |
| **Relacionado** | GOAL-02 M0; ADR-001 (contrato implementado del Ledger); ADR-005 (facturación electrónica) |

## Contexto verificado

Este ADR se contrastó contra el código de `codex/goal02-accounting-voucher-query`, HEAD `d654653`, y el estado del Goal documentado en `docs/goals/README.md`.

- `Invoice` está documentada en Prisma como factura de venta interna, todavía no DIAN; tiene los estados `DRAFT`, `ISSUED` y `CANCELLED`.
- `BillingService.createInvoice` crea facturas y líneas; `updateInvoiceStatus` actualiza el estado sin invocar el Ledger.
- `InvoiceItem` conserva cantidad, precio unitario y subtotal, pero no una tasa ni valor de impuesto por línea. `ProductService.impuesto` es un Decimal con valor predeterminado 19; `createInvoice` no lo consulta y actualmente calcula 19% sobre el subtotal total.
- `Customer` guarda NIT y razón social, pero no tiene relación con el `Tercero` contable canónico.
- `LedgerService.registrarComprobante` valida período abierto, cuentas del tenant, partida doble e identidad de origen. `LedgerService.anular` anula en período abierto o crea un reverso si el período original está cerrado.
- `BillingController` recibe `CurrentUserPayload.userId`, pero actualmente solo pasa `tenantId` a `BillingService`; `BillingModule` tampoco importa `AccountingModule`. `RegistrarComprobanteInput.userId` es obligatorio y `LedgerService` acepta un cliente transaccional.
- El seed contable incluye los roles `CLIENTES_NACIONALES`, `INGRESOS_OPERACIONALES` e `IVA_GENERADO`. El Ledger exige un `periodoId` y no conoce Billing.
- ADR-005 mantiene un bounded context separado para facturación electrónica y fija `FACTURA_ACEPTADA` como evento contable de esa ruta. Este ADR no autoriza transmisión DIAN/UGPP ni reemplaza ese contexto.

Estos hechos describen el código inspeccionado; no convierten en aceptadas las decisiones del ADR-001, cuyo encabezado aún indica estado propuesto.

## Decisión aceptada con cambios

El 2026-10-31 se acepta la opción B bajo la delegación explícita del usuario
para que Codex tome las decisiones de producto necesarias y continúe GOAL-02.
La aprobación cubre únicamente facturación interna y causación contable; no
aprueba emisión electrónica, tratamientos tributarios legales ni transmisión.

Para una **factura interna independiente de la emisión electrónica**, la transición `DRAFT → ISSUED` será el evento que solicita contabilizar la venta. El cambio de estado y el registro del comprobante ocurrirán dentro de una misma transacción PostgreSQL tenant-aware. La factura no se marcará `ISSUED` si el comprobante no puede contabilizarse.

El comprobante usará una clave de origen estable y única: `BILLING_INVOICE` + `Invoice.id` + `ISSUED`. Repetir la misma solicitud devolverá o reconocerá el comprobante ya asociado, sin numerar otro. La integración no escribirá cuentas PUC directamente en Billing: resolverá, por tenant, roles activos de `CuentaSistemaMap`.

Al cancelar una factura `ISSUED`, Billing actualizará su estado y llamará a `LedgerService.anular` en la misma transacción, con motivo y auditoría. Aplican las reglas existentes del Ledger para períodos abiertos/cerrados; no se borran factura, comprobante ni movimientos. Cancelar un borrador no produce asiento. No se permitirá devolver una factura contabilizada a `DRAFT`.

El período contable será el período abierto que corresponda a la fecha de emisión. Si no existe o está cerrado, la operación de emisión falla y no desplaza silenciosamente la contabilización a otro período. La anulación seguirá el comportamiento de corrección ya ofrecido por el Ledger.

El mapper propuesto separa CxC, ingreso e impuesto usando los roles contables del tenant, atribuye CxC al tercero del cliente y comprueba partida doble. No se contabilizará si falta un mapeo requerido o si la cuenta no satisface las validaciones del Ledger.

## Reglas y puertas de implementación

La decisión fija las reglas internas siguientes, sin declarar una
clasificación fiscal ni sustituir la revisión de un contador:

1. `ProductService.impuesto` es la tasa porcentual explícita configurada para el producto. Se elimina el valor predeterminado silencioso para nuevos productos; las tasas existentes se conservan. Las líneas manuales deben recibir su tasa explícita. El rango admitido es 0–100 con máximo dos decimales; `0` solo expresa tasa cero en el cálculo interno y no declara exención ni exclusión legal. Cantidades admiten hasta tres decimales y precios unitarios hasta dos, según la precisión persistida.
2. La API calcula cada línea con aritmética decimal, redondea el impuesto de cada línea a dos decimales COP con regla mitad hacia arriba y suma bases e impuestos ya redondeados para formar el encabezado. Cada línea congela base, tasa e impuesto; modificar el producto después no recalcula la factura. No se reconstruyen tasas de facturas históricas.
3. El alcance tributario de este incremento es solo una tasa numérica elegida por tenant. Clasificaciones IVA, exclusiones, exenciones, retenciones, ICA y responsabilidades fiscales requieren definición contable/normativa separada. No se presenta la factura interna como documento DIAN.
4. `Customer` tendrá un vínculo explícito y tenant-safe con un `Tercero` activo y marcado como cliente. No se inferirá ni creará silenciosamente el tercero normalizando el NIT. Facturas históricas sin vínculo ni snapshots fiscales no se contabilizan automáticamente.
5. La emisión requiere período contable abierto, mapeos activos y completos, identidad canónica del tercero y actor autenticado. `userId` proviene de `CurrentUserPayload`, nunca del body. El permiso ADMIN actual para emitir/cancelar se conserva. Billing y Ledger se escriben en la misma transacción y contexto tenant-aware.
6. La clave de origen `BILLING_INVOICE` + `Invoice.id` + `ISSUED` evita duplicados. La UI muestra el comprobante o el motivo por el cual la emisión no se completó. Cancelar una factura emitida revierte el comprobante con motivo y auditoría; una factura histórica emitida sin comprobante requiere revisión y no recibe un asiento ni un reverso automático.
7. Las columnas de snapshot y la relación con `Tercero` se agregan inicialmente opcionales, sin backfill financiero. Las operaciones nuevas validan y escriben los datos requeridos antes de emitir. La reversión de código no elimina registros ni comprobantes; el rollback de esquema deja datos existentes intactos.

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

## Aprobación y alcance

La opción B se acepta para **facturas internas independientes**: `DRAFT →
ISSUED` solicita el posteo atómico descrito arriba. La emisión electrónica
permanece gobernada por ADR-005 y no reutiliza este hecho hasta demostrar que
no duplicará su asiento. La tasa numérica del MVP es una configuración
operativa; no es una conclusión sobre obligaciones tributarias colombianas.
