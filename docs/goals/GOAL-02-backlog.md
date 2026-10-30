# Backlog de GOAL-02 — Evolución Financiera y Cumplimiento Electrónico

Actualizado: 2026-10-30. GOAL-02 es el único Goal activo; GOAL-01 está pausado,
no cerrado. Este backlog conserva el resultado completo de GOAL-02 y prioriza
primero flujos financieros internos que puedan mostrarse a futuros clientes.

## M0 — Flujos financieros internos demostrables

| Prioridad | Estado                         | Iniciativa                                                                                        | Criterios de aceptación                                                                                                                                                                                                                         | Dependencias y riesgo                                                                                                                                                                                                                                                |
| --------- | ------------------------------ | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0        | EN CURSO                       | Validar que cada producto de una factura pertenezca al tenant activo y esté disponible.           | La API acepta productos activos del mismo tenant, rechaza IDs ajenos, inexistentes o inactivos sin crear la factura, conserva líneas manuales y tiene pruebas de regresión.                                                                     | Sin migración ni decisión de dominio; riesgo alto por aislamiento multiempresa.                                                                                                                                                                                      |
| P1        | PENDIENTE                      | Conectar la emisión interna de facturas con el Ledger.                                            | Un acto interno genera un comprobante balanceado e idempotente con tercero, período y origen trazables; anular/corregir conserva evidencia y usa reversión del Ledger.                                                                          | ADR sobre cliente contable, impuestos, evento de emisión, cuentas y reversión; riesgo financiero alto.                                                                                                                                                               |
| P1        | EN CURSO                       | Verificar de extremo a extremo la causación de nómina en el Ledger desde la UI.                   | Un período aprobado conserva su snapshot, crea una causación una sola vez, muestra el comprobante y soporta la corrección definida por el dominio. La rama apilada agrega formulario, transiciones RBAC y comprobante de ajuste en la pantalla. | Reutilizar Payroll y Ledger existentes; permisos, preflight, idempotencia y persistencia cuentan con pruebas de servicio; falta integrar las PR apiladas y verificar el recorrido completo con una nómina demostrable antes de cerrar P1.                            |
| P1        | EN CURSO                       | Preparar un escenario financiero reproducible con datos sintéticos para demo.                     | Un tenant explícitamente de demostración carga clientes, productos, facturas internas, nómina, centro de costo, tercero y causación balanceada; la carga es idempotente, tenant-scoped y se verifica desde la UI.                               | El seed idempotente y su Browser E2E se fusionaron en #157 con CI, E2E y Preview verdes. No está verificado el recorrido con una ejecución del seed en el tenant demo. La factura interna todavía no causa en Ledger ni transmite a DIAN.                            |
| P1        | EN CURSO                       | Liquidar prima semestral de empleados activos por lote y generar un comprobante PDF por empleado. | Preview muestra períodos y conceptos fuente, base, días y fórmula; aprobación congela snapshots y correcciones; PDF inmutable queda vinculado al Expediente e idempotente ante reintentos.                                                      | Prototipo enero–junio en worktree con migraciones no aplicadas; casos ambiguos se bloquean. Antes del uso operativo/comercial de resultados: revisión de Payroll/asesoría laboral. Pago, Tesorería y Ledger fuera.                                                   |
| P1        | CRITERIOS LISTOS PARA REVISIÓN | Estructurar afiliaciones/novedades y exportar aportes de nómina a PILA.                           | Afiliaciones con vigencia alimentan archivos tipo 1 y 2; validación local, aceptación del operador, liquidación y pago son estados separados; compatibilidad se prueba operador por operador.                                                   | ADR-013 aprobada con cambios. Los criterios y pruebas normativas están en ADR-013; revisar anexo consolidado efectivo antes de escribir código. Solo dependientes estándar; cotizante 75/especiales fuera; sin mapeo automático de texto libre, transmisión ni pago. |

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
- La página oficial de [PILA del Ministerio de Salud](https://www2.minsalud.gov.co/proteccionsocial/Paginas/pila.aspx)
  enlaza los anexos técnicos, incluido el Anexo Técnico 2 de cotizantes. El PDF
  publicado aparece como versión 29 del 6 de enero de 2026; la [Resolución 1529
  de 2026](https://www.minsalud.gov.co/Normatividad_Nuevo/Resoluci%C3%B3n%20No%201529%20de%202026.pdf)
  reemplazó el Anexo Técnico 2 y fijó implementación escalonada. La resolución
  se expidió el 24 y se publicó el 27 de julio en el Diario Oficial 53.566.
  Adoptó el
  cotizante 75; sus cambios operativos empiezan el 1 de noviembre de 2026 para
  pagos del período de salud de noviembre. El proyecto posterior que propone
  cambiar esos plazos no reemplaza la regla vigente al 2026-10-30. El MVP lo
  excluye, pero la versión normativa debe seleccionarse por período cotizado y
  fecha prevista de pago. La primera entrega limita su promesa a operadores
  cuya carga haya sido probada.
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
- **Prima y PILA:** ADR-012 está aprobada con condiciones y tiene un prototipo
  de enero–junio en este worktree. El preview expone períodos/conceptos fuente,
  cálculo y correcciones congeladas; tests aritméticos y de permisos pasan.
  Migraciones aún no se aplican y falta la revisión laboral independiente antes
  de uso operativo. ADR-013 está aprobada con cambios; su matriz de aceptación y
  pruebas normativas está escrita, pero no se ha iniciado implementación PILA.
- **Estado de preparación:** GOAL-02 sigue activo. La prima avanza como
  prototipo revisable con límites explícitos; los resultados requieren
  verificación por Payroll antes de usarse para pago. La ruta PILA queda lista
  para revisar sus criterios antes de crear el primer cambio de dominio. La
  integración financiera interna restante de facturas tiene su propia decisión
  pendiente ADR-011.
- No se ejecutó el seed financiero ni se accedió a staging, producción, VPS u
  OCI; no se transmitió información a DIAN/UGPP.
