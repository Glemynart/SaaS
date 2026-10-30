# Backlog de GOAL-02 — Evolución Financiera y Cumplimiento Electrónico

Actualizado: 2026-10-30. GOAL-02 es el único Goal activo; GOAL-01 está pausado,
no cerrado. Este backlog conserva el resultado completo de GOAL-02 y prioriza
primero flujos financieros internos que puedan mostrarse a futuros clientes.

## M0 — Flujos financieros internos demostrables

| Prioridad | Estado                    | Iniciativa                                                                                        | Criterios de aceptación                                                                                                                                                                                                                         | Dependencias y riesgo                                                                                                                                                                                                                                                             |
| --------- | ------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0        | EN CURSO                  | Validar que cada producto de una factura pertenezca al tenant activo y esté disponible.           | La API acepta productos activos del mismo tenant, rechaza IDs ajenos, inexistentes o inactivos sin crear la factura, conserva líneas manuales y tiene pruebas de regresión.                                                                     | Sin migración ni decisión de dominio; riesgo alto por aislamiento multiempresa.                                                                                                                                                                                                   |
| P1        | PENDIENTE                 | Conectar la emisión interna de facturas con el Ledger.                                            | Un acto interno genera un comprobante balanceado e idempotente con tercero, período y origen trazables; anular/corregir conserva evidencia y usa reversión del Ledger.                                                                          | ADR sobre cliente contable, impuestos, evento de emisión, cuentas y reversión; riesgo financiero alto.                                                                                                                                                                            |
| P1        | EN CURSO                  | Verificar de extremo a extremo la causación de nómina en el Ledger desde la UI.                   | Un período aprobado conserva su snapshot, crea una causación una sola vez, muestra el comprobante y soporta la corrección definida por el dominio. La rama apilada agrega formulario, transiciones RBAC y comprobante de ajuste en la pantalla. | Reutilizar Payroll y Ledger existentes; permisos, preflight, idempotencia y persistencia cuentan con pruebas de servicio; falta integrar las PR apiladas y verificar el recorrido completo con una nómina demostrable antes de cerrar P1.                                         |
| P1        | EN CURSO                  | Preparar un escenario financiero reproducible con datos sintéticos para demo.                     | Un tenant explícitamente de demostración carga clientes, productos, facturas internas, nómina, centro de costo, tercero y causación balanceada; la carga es idempotente, tenant-scoped y se verifica desde la UI.                               | El seed idempotente y su Browser E2E se fusionaron en #157 con CI, E2E y Preview verdes. No está verificado el recorrido con una ejecución del seed en el tenant demo. La factura interna todavía no causa en Ledger ni transmite a DIAN.                                         |
| P1        | EN CURSO                  | Liquidar prima semestral de empleados activos por lote y generar un comprobante PDF por empleado. | Preview muestra períodos y conceptos fuente, base, días y fórmula; aprobación congela snapshots y correcciones; PDF inmutable queda vinculado al Expediente e idempotente ante reintentos.                                                      | PR #159 draft; enero–junio recorrió E2E local con PostgreSQL desechable. Sus migraciones solo se aplicaron en esa base, no en demo/staging/producción. Casos ambiguos se bloquean. Revisión de Payroll/asesoría laboral antes del uso operativo; pagos, Tesorería y Ledger fuera. |
| P1        | LISTA PARA IMPLEMENTACIÓN | Estructurar afiliaciones/novedades y exportar aportes de nómina a PILA.                           | Afiliaciones con vigencia alimentan archivos tipo 1 y 2; validación local, aceptación del operador, liquidación y pago son estados separados; compatibilidad se prueba operador por operador.                                                   | ADR-013 aprobada con cambios y matriz presentada; base normativa AT2 v30 (24-07-2026) verificada hoy en MinSalud. Solo dependientes estándar; cotizante 75/especiales fuera; sin mapeo automático de texto libre, transmisión ni pago.                                            |

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

- `main` en `dd91c6fa` contiene Billing para clientes, productos y facturas
  internas; el schema distingue esas facturas de la cohorte electrónica
  heredada.
- Payroll ya depende del módulo Accounting; Billing no invoca el Ledger en el
  código revisado. Esta diferencia es una señal de integración pendiente, no
  prueba de que la causación de nómina esté lista para demo.
- `ProductService.impuesto` se configura y se muestra en el catálogo, pero
  `BillingService.createInvoice` calcula los impuestos con una tasa fija del
  19%; `InvoiceItem` tampoco conserva una tasa por línea. El smoke de facturación
  cubre por ahora el caso estándar del 19%. Antes de ofrecer otros tratamientos
  tributarios en una demo, hay que decidir y snapshotear la regla por línea.
- En `apps/api/prisma/schema.prisma`, `Empleado.eps`, `arl`, `fondoPension` y
  `cajaCompensacion` son campos `String?`; no guardan identificadores
  normalizados ni vigencias de afiliación. `PayrollSnapshot` sí congela IBC,
  conceptos y aportes de cada nómina aprobada, pero no contiene la afiliación
  estructurada ni todos los datos de cotizante y novedades requeridos para
  reconstruir un archivo PILA. No se encontró exportador PILA ejecutable en
  `apps/api` ni en la interfaz web.
- La [página oficial de PILA de MinSalud](https://www.minsalud.gov.co/Proteccion-Social/Paginas/pila.aspx)
  enlaza el Anexo Técnico 2 de cotizantes. Verificado el 2026-10-30, el enlace
  oficial devuelve AT2 versión 30, fechado el 24 de julio de 2026 y de 336
  páginas; sus páginas 9–16 definen el archivo tipo 1, 26–30 el encabezado del
  archivo tipo 2, 81–101 el registro de detalle y 332–335 los hitos 5.84–5.91.
  AT2 v29 del 6 de enero de 2026 es histórico, no el layout vigente. La
  [Resolución 1529 de 2026](https://normativa.colpensiones.gov.co/colpens/compilacion/docs/resolucion_minsaludps_1529_2026.htm)
  modificó el Anexo 2 y fijó implementación escalonada; por ejemplo, 5.87 y
  5.91 aplican desde pagos del 1 de noviembre de 2026 para salud del período
  noviembre en el caso especial del cotizante 75. Las reglas se seleccionan
  por período cotizado y fecha prevista de pago. Ese caso queda fuera del MVP;
  la primera entrega limita su compatibilidad a operadores cuya carga haya
  superado una prueba real.
- Hay evidencia de carga por archivo plano en varios operadores: [SOI](https://www.soi.com.co/empresa-servicios-de-soi),
  [Enlace Operativo/SuAporte](https://www.enlace.com.co/hubfs/Manuales/C%C3%B3mo%20cargar%20un%20archivo%20plano%20en%20SuAporte.pdf?hsLang=es-co)
  y [Aportes en Línea](https://www.aportesenlinea.com/Documents/Instructivo%20Corrector%20por%20Pantalla%20v.1.3.pdf)
  documentan ese flujo. Esto respalda investigar un archivo estándar común,
  pero no demuestra que cualquier operador acepte un archivo idéntico ni que
  aplique las mismas validaciones.
- Los recorridos Browser E2E incluyen un escenario financiero combinado en un
  tenant descartable: crea cliente, producto y factura interna, y luego prepara
  una nómina sintética aprobada, la contabiliza desde la UI y verifica que el
  comprobante del Ledger y el snapshot sobreviven una recarga. Es cobertura de
  regresión; no conecta facturas con el Ledger.
- La primera corrida del recorrido detectó que el precio Decimal de un producto
  llegaba como texto a `CreateInvoiceDto` y la API respondía 400. El formulario
  convierte ahora ese precio a número al seleccionar el producto; el recorrido
  E2E cubre selección, emisión y persistencia de la factura.
- La entrega local de causación añade a la pantalla de período la acción ADMIN,
  el preflight visible y el comprobante persistido con sus movimientos. La rama
  apilada agrega el ciclo de correcciones post aprobación y la lectura del
  comprobante de ajuste. #151, #155, #156, #157 y #158 ya están fusionadas en
  `main`; el flujo de nómina conserva su snapshot y causación, mientras que la
  emisión de facturas internas al Ledger continúa pendiente de decisión ADR-011.
- La rama `codex/goal02-financial-demo-data` implementó un seed local idempotente
  para dos clientes, tres productos, tres facturas internas, un empleado y su
  tercero contable, un centro de costo y una nómina sintética con causación en
  Ledger. La prueba Browser E2E valida aislamiento frente a otro tenant,
  persistencia, reejecución sin duplicados y lectura desde Facturación y Nómina.
  La rama también conecta cada obligación de salarios con el tercero canónico
  por tipo y número de documento, exigido por la cuenta PUC 250505, y conserva el
  centro de costo requerido por las cuentas de gasto. La entrega se fusionó en
  el PR #157 (`c04d029`), cuyos checks CI, Browser E2E y Vercel Preview
  terminaron exitosamente. El seed no se ha ejecutado sobre el tenant del
  usuario.
- `Decisiones de Producto.md`, `ENGINEERING_PLAYBOOK.md` y
  `LA_OFICINA_NITIDA_CONTEXT.md` no existen en la raíz ni aparecen en el
  inventario de archivos del checkout consultado. El plan usa `PROJECT_STATE.md`,
  documentación de Goals y código real; la ausencia queda registrada hasta que
  esos documentos se recuperen o se confirme que fueron retirados.
- No se inspeccionaron ni modificaron bases de staging o producción. No se
  generaron datos financieros ni se transmitió información a DIAN/UGPP.

## Estado de Goal y dependencias de entrega — 2026-10-30 (actualizado)

- **GOAL ACTIVO:** GOAL-02; GOAL-01 continúa pausado y conservado.
- **Integración:** #151, #155, #156, #157 y #158 están fusionadas en `main`.
  #157 se fusionó como `c04d029` y #158 como `dd91c6f`; para ambas, GitHub
  reporta CI, Browser E2E y Vercel Preview exitosos.
- **Decisión pendiente:** #154 conserva ADR-011 en estado propuesto. La aprobación
  contable para emisión interna de facturas a Ledger sigue pendiente y bloquea
  únicamente esa ruta.
- **Prima y PILA:** ADR-012 está aprobada con condiciones. PR #159 agrega el
  flujo enero–junio y un Browser E2E local completo; la prueba generó y descargó
  el PDF desde el Expediente usando PostgreSQL desechable. Las migraciones no
  se han aplicado a demo/staging/producción; los casos ambiguos se bloquean y
  la revisión laboral sigue pendiente antes de uso operativo. Vercel Preview
  está verde; GitHub Actions no inició `browser` ni `verify` por la restricción
  de facturación de la cuenta, por lo que PR #159 permanece draft y sin merge.
  ADR-013 está aprobada con cambios y la matriz se presentó; no se transmite ni
  se paga desde el exportador PILA.
- **Estado de preparación:** GOAL-02 sigue activo. La prima avanza como
  prototipo revisable; los resultados requieren verificación de Payroll antes
  de usarse para pago. La ruta PILA puede iniciar un primer incremento en una
  rama/PR independiente, con AT2 v30 como línea base y límites de ADR-013. La
  integración financiera interna restante de facturas conserva su decisión
  pendiente ADR-011.
- No se ejecutó el seed financiero ni se accedió a staging, producción, VPS u
  OCI; no se transmitió información a DIAN/UGPP.
