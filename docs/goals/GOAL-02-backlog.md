# Backlog de GOAL-02 — Evolución Financiera y Cumplimiento Electrónico

Actualizado: 2026-10-30. GOAL-02 es el único Goal activo; GOAL-01 está pausado,
no cerrado. Este backlog conserva el resultado completo de GOAL-02 y prioriza
primero flujos financieros internos que puedan mostrarse a futuros clientes.

## M0 — Flujos financieros internos demostrables

| Prioridad | Estado    | Iniciativa                                                                              | Criterios de aceptación                                                                                                                                                                                    | Dependencias y riesgo                                                                                                                                                                                                    |
| --------- | --------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P0        | EN CURSO  | Validar que cada producto de una factura pertenezca al tenant activo y esté disponible. | La API acepta productos activos del mismo tenant, rechaza IDs ajenos, inexistentes o inactivos sin crear la factura, conserva líneas manuales y tiene pruebas de regresión.                                | Sin migración ni decisión de dominio; riesgo alto por aislamiento multiempresa.                                                                                                                                           |
| P1        | PENDIENTE | Conectar la emisión interna de facturas con el Ledger.                                  | Un acto interno genera un comprobante balanceado e idempotente con tercero, período y origen trazables; anular/corregir conserva evidencia y usa reversión del Ledger.                                     | ADR-011 propuesto; aprobación pendiente. Antes de implementar deben definirse snapshots de impuesto por línea y la relación tenant-safe de Customer con Tercero; riesgo financiero alto.                                |
| P1        | EN CURSO  | Verificar de extremo a extremo la causación de nómina en el Ledger desde la UI.         | Un período aprobado conserva su snapshot, crea una causación una sola vez, muestra el comprobante y soporta la corrección definida por el dominio. La UI de causación y correcciones, y el escenario E2E financiero, ya están integrados. | Payroll y Ledger están conectados; #152, #153 y #156 están fusionadas. CI y Browser E2E pasaron; falta demostrar el recorrido con una nómina representativa antes de cerrar P1.                                                                 |
| P1        | EN CURSO  | Preparar un escenario financiero reproducible con datos sintéticos para demo.           | Un tenant explícitamente de demostración puede cargar clientes, productos, facturas, períodos y comprobantes coherentes; el seed es idempotente y tenant-scoped y tiene cobertura E2E.                         | El seed seguro de #157 está integrado y verificado por CI/E2E; aún no se ha ejecutado en el tenant demo del usuario. No ejecutarlo en tenants reales.                                                                                       |
## H1 — Fundación de integraciones regulatorias

| Prioridad | Estado    | Iniciativa                                                                 | Criterios de aceptación                                                                                                                        | Dependencias y riesgo                                                                   |
| --------- | --------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| P1        | PENDIENTE | Aprobar modelo de eventos, evidencia, secretos y adaptadores regulatorios. | ADRs cubren idempotencia, estados, correcciones, retención, permisos, auditoría y cambio de proveedor; proveedor fake con pruebas de contrato. | Caso de uso real y revisión de ADR-SEC-001; no requiere desplegar una integración real. |

## H2/H3 — Cumplimiento electrónico

| Prioridad | Estado    | Iniciativa                                                | Criterios de aceptación                                                                                                                      | Dependencias y riesgo                                                                       |
| --------- | --------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| P2        | PENDIENTE | Facturación electrónica DIAN por proveedor especializado. | Factura fiscal trazable desde Invoice, intentos idempotentes, estados normalizados, rechazo/contingencia y evidencia verificable en sandbox. | H1, ADR fiscal, proveedor, sandbox y custodia de certificados; riesgo normativo alto.       |
| P2        | PENDIENTE | Nómina electrónica derivada de PayrollSnapshot.           | Una nómina aprobada produce un evento inmutable, con rechazo/reintento/corrección y evidencia vinculada al período y al empleado.            | H1, reglas vigentes, proveedor, sandbox, seguridad y ADR de eventos; riesgo normativo alto. |

## H4 — Operación financiera ampliada

| Prioridad | Estado    | Iniciativa                        | Criterios de aceptación                                                                                                    | Dependencias y riesgo                                                 |
| --------- | --------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| P2        | PENDIENTE | Cartera y aplicación de recaudos. | Saldos, vencimientos, pagos parciales y aplicación contra facturas se derivan de hechos trazables y cuadran con el Ledger. | Facturación estable, tercero canónico y caso comercial verificable.   |
| P2        | PENDIENTE | Tesorería y conciliación.         | Obligaciones y pagos se concilian con extractos para un banco/flujo concreto con auditoría e idempotencia.                 | Necesidad real de cliente, Cartera/Payroll/Compras y datos bancarios. |
| P3        | PENDIENTE | Compras y cuentas por pagar.      | Proveedor, obligación, soporte, causación y pago se rastrean hasta el Ledger.                                              | Tercero canónico, aprobaciones y necesidades de proveedor.            |
| P3        | PENDIENTE | Reportes financieros integrados.  | Los reportes se calculan desde fuentes completas; cualquier cobertura parcial se identifica claramente.                    | H4.1–H4.3 o fuentes equivalentes ya verificadas.                      |

## Evidencia inicial y límites

- `main` en `dd91c6f` contiene Billing para clientes, productos y facturas
  internas; el schema distingue esas facturas de la cohorte electrónica
  heredada.
- Payroll ya depende del módulo Accounting; Billing no invoca el Ledger en el
  código revisado. Esta diferencia es una señal de integración pendiente, no
  prueba de que la causación de nómina esté lista para demo.
- El código base de ADR-011 (HEAD `c07a9d7`, integrado por #151) conserva el
  impuesto fijo del 19% en `BillingService.createInvoice`, no snapshottea tasa,
  base ni impuesto en cada línea y no relaciona `Customer` con el `Tercero`
  contable canónico. Son puertas previas para contabilizar facturas internas.
- La entrega local de causación añade a la pantalla de período la acción ADMIN,
  el preflight visible y el comprobante persistido con sus movimientos. #153
  agrega correcciones post aprobación y lectura del comprobante de ajuste; #156
  verifica el escenario financiero combinado en Browser E2E.
- #157 integra el seed financiero seguro y #158 hace idempotente la anulación de
  comprobantes del Ledger. Los cambios están integrados; no se cargaron datos
  financieros en el tenant demo del usuario.
- `Decisiones de Producto.md`, `ENGINEERING_PLAYBOOK.md` y
  `LA_OFICINA_NITIDA_CONTEXT.md` no existen en la raíz ni aparecen en el
  inventario de archivos del checkout consultado. El plan usa `PROJECT_STATE.md`,
  documentación de Goals y código real; la ausencia queda registrada hasta que
  esos documentos se recuperen o se confirme que fueron retirados.
- No se inspeccionaron ni modificaron bases de staging o producción. No se
  generaron datos financieros ni se transmitió información a DIAN/UGPP.

## Estado de integración — 2026-10-30

- **GOAL ACTIVO:** GOAL-02; GOAL-01 sigue pausado.
- **Integradas:** #151, #152, #153, #155, #156, #157 y #158. `main` está en
  `dd91c6f`; tras #158 pasaron CI, Browser E2E y publicación de la imagen API.
- **Abierta en draft:** #154 agrega ADR-011, todavía propuesto. La decisión de
  contabilizar una factura interna al emitirla requiere aprobación de Producto
  y Contabilidad; esa puerta bloquea únicamente la integración Billing-Ledger.
- No se ejecutó el seed financiero y no se accedió a staging, producción, VPS u
  OCI; no se transmitió información a DIAN/UGPP.
