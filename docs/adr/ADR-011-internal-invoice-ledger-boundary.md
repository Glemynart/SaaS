# ADR-011 — Frontera de contabilización de facturas internas

| Campo           | Valor                                                                                     |
| --------------- | ----------------------------------------------------------------------------------------- |
| **Estado**      | accepted para demo interna; revisión contable-fiscal operativa pendiente                  |
| **Fecha**       | 2026-10-30                                                                                |
| **Decisores**   | Producto · Contabilidad funcional · Arquitectura                                          |
| **Ámbito**      | `Billing.Invoice` interno y su integración con `LedgerService`                            |
| **Relacionado** | GOAL-02 M0; ADR-001 (contrato implementado del Ledger); ADR-005 (facturación electrónica) |

## Contexto verificado antes de este incremento

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

## Decisión

Para una **factura interna independiente de la emisión electrónica**, la transición `DRAFT → ISSUED` será el evento que solicita contabilizar la venta. El cambio de estado y el registro del comprobante ocurrirán dentro de una misma transacción PostgreSQL tenant-aware. La factura no se marcará `ISSUED` si el comprobante no puede contabilizarse.

El comprobante usará una clave de origen estable y única: `BILLING_INVOICE` + `Invoice.id` + `ISSUED`. Repetir la misma solicitud devolverá o reconocerá el comprobante ya asociado, sin numerar otro. La integración no escribirá cuentas PUC directamente en Billing: resolverá, por tenant, roles activos de `CuentaSistemaMap`.

Al cancelar una factura `ISSUED` contabilizada por esta integración, Billing actualizará su estado y llamará a `LedgerService.anular` en la misma transacción, con motivo y auditoría. Aplican las reglas existentes del Ledger para períodos abiertos/cerrados; no se borran factura, comprobante ni movimientos. Una factura histórica `ISSUED` sin comprobante puede cancelarse con motivo y auditoría, sin contabilizarla ni fabricar un reverso. Cancelar un borrador no produce asiento. No se permitirá devolver una factura contabilizada a `DRAFT`.

El período contable será el período abierto que corresponda a la fecha de emisión. Si no existe o está cerrado, la operación de emisión falla y no desplaza silenciosamente la contabilización a otro período. La anulación seguirá el comportamiento de corrección ya ofrecido por el Ledger.

Como `PeriodoContable.fechaInicio` y `fechaFin` son fechas (`DATE`), el período se selecciona con el día calendario de `America/Bogota`, convertido a medianoche UTC para la consulta Prisma. El instante exacto de emisión se conserva sin cambios en la factura y en el comprobante. Así, una emisión durante las últimas horas de un día en Colombia no se asigna al día siguiente por estar ya en UTC.

El mapper separa CxC, ingreso e impuesto usando los roles contables del tenant, atribuye los movimientos al tercero del cliente y comprueba partida doble. No se contabilizará si falta un mapeo requerido o si la cuenta no satisface las validaciones del Ledger.

### Decisión registrada para la demo

El usuario delegó las decisiones necesarias para continuar GOAL-02 y priorizó
mostrar facturación y contabilidad integradas a futuros clientes. En ese alcance
se acepta la opción B para **facturas internas de demostración**. `ISSUED`
significa emitida y contabilizada en el Ledger interno; nunca significa factura
electrónica aceptada por DIAN.

La tasa de IVA se elige explícitamente por producto o línea manual y se congela
con el valor de impuesto de cada línea. El MVP de demo soporta 0 %, 5 % y 19 %.
0 % solo omite la línea de IVA en este asiento: el sistema no determina si una
operación es exenta, excluida o tiene otro tratamiento. La tasa y su tratamiento
deben ser revisados por el responsable contable antes de uso operativo. Esta
limitación evita atribuir a una línea manual o al catálogo una clasificación
fiscal que el código no puede demostrar. Como referencia vigente para la
distinción entre tarifa general, tarifa diferencial y bienes exentos se
consultó el [Concepto 12810 de 2026 de DIAN](https://normograma.dian.gov.co/dian/compilacion/docs/oficio_dian_12810_2026.htm).

El vínculo `Customer`–`Tercero` es explícito, por tenant, exige rol activo de
cliente y coincidencia de NIT. No hay búsqueda automática ni backfill. En la
emisión se congelan la identidad del cliente y del tercero, las tasas e impuestos
por línea, la fecha, el actor y el comprobante. Facturas históricas o borradores
sin esos snapshots no se recalculan ni se contabilizan retroactivamente; el
usuario debe crear una factura nueva.

## Condiciones de implementación y uso

La implementación de demo mantiene estas fronteras:

1. Las tasas internas explícitas se limitan a 0 %, 5 % y 19 %, con redondeo por línea a dos decimales. La clasificación tributaria y cualquier tratamiento especial requieren revisión contable-fiscal antes de operación real; nunca se usa una tasa fija común para todas las líneas.
2. Cada factura nueva congela el cliente, el tercero, la tasa y el impuesto por línea, fecha, actor y comprobante. El total de líneas se concilia con el encabezado. No se recalculan facturas históricas desde `ProductService`.
3. `Customer` se vincula explícitamente a un `Tercero` NIT activo, con rol de cliente, del mismo tenant y con NIT coincidente. No se infiere ni crea silenciosamente el tercero por NIT.
4. Emitir requiere período abierto, mapeos contables completos y actor autenticado. Billing propaga `userId` desde `CurrentUserPayload` —no del body— y actualiza estado y Ledger en la misma transacción tenant-aware.
5. La UI muestra comprobante y rechazos; repetir la emisión es idempotente. Cancelar requiere motivo y usa `LedgerService.anular` para un comprobante existente. Las facturas históricas emitidas sin asiento se pueden cancelar con auditoría, sin contabilizarlas ni fabricar un reverso.
6. El API permite crear facturas a `ADMIN` y `OPERADOR`, pero reserva los cambios de estado a `ADMIN`. La UI oculta emisión y cancelación/reversión a `OPERADOR` y explica que requieren un administrador; el control del API sigue siendo la autoridad.
7. La migración es aditiva, usa columnas opcionales para históricos y no hace backfill financiero. Un borrador histórico sin snapshots no se puede emitir: el usuario debe crear una factura nueva.
8. La migración funciona como expansión de schema: revertir el código puede conservar las columnas añadidas. No se debe ejecutar una migración descendente que borre snapshots o claves de comprobantes después de registrar facturas en Ledger; esas operaciones se corrigen mediante el flujo de cancelación y reverso.

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

- `ISSUED` ahora representa una operación interna completa; la UI debe distinguirla de una aceptación DIAN.
- La demo no valida la clasificación tributaria de los servicios ni cubre bases especiales, retenciones u otros impuestos.
- El uso operativo requiere revisión contable-fiscal y escenarios representativos del cliente.
- Una relación futura con `FacturaElectronica` puede duplicar el asiento si H2 no reutiliza el hecho interno ya contabilizado.
- El código contable y la UI actuales no prueban que el recorrido de facturación integrada esté listo para clientes.

## Límite de aprobación

La opción B queda aprobada únicamente para el alcance de facturación interna de
demo y con las condiciones previas de este ADR. No aprueba tarifas legales,
reconocimiento fiscal, emisión DIAN, numeración fiscal, aceptación externa,
recaudos o pagos.
