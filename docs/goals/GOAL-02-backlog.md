# Backlog de GOAL-02 — Evolución Financiera y Cumplimiento Electrónico

Actualizado: 2026-10-30. GOAL-02 es el único Goal activo; GOAL-01 está pausado,
no cerrado. Este backlog conserva el resultado completo de GOAL-02 y prioriza
primero flujos financieros internos que puedan mostrarse a futuros clientes.

## M0 — Flujos financieros internos demostrables

| Prioridad | Estado                 | Iniciativa                                                                                        | Criterios de aceptación                                                                                                                                                                                           | Dependencias y riesgo                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --------- | ---------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0        | COMPLETADO             | Validar que cada producto de una factura pertenezca al tenant activo y esté disponible.           | La API acepta productos activos del mismo tenant, rechaza IDs ajenos, inexistentes o inactivos sin crear la factura, conserva líneas manuales y tiene pruebas de regresión.                                       | Implementado y probado en el PR #151 (`3a8e1c4`); CI y Browser E2E verdes antes del merge. Sin migración; el filtro tenant-aware reduce riesgo de aislamiento multiempresa.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| P1        | PENDIENTE              | Conectar la emisión interna de facturas con el Ledger.                                            | Un acto interno genera un comprobante balanceado e idempotente con tercero, período y origen trazables; anular/corregir conserva evidencia y usa reversión del Ledger.                                            | ADR-011 se fusionó como propuesta en #154; aprobación de Producto y Contabilidad sigue pendiente. Antes de implementar deben definirse snapshots tributarios por línea y vínculo tenant-safe Customer–Tercero; riesgo financiero alto.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| P1        | EN CURSO               | Verificar de extremo a extremo la causación de nómina en el Ledger desde la UI.                   | Un período aprobado conserva su snapshot, crea una causación una sola vez, muestra el comprobante y soporta la corrección definida por el dominio. La UI y el escenario E2E financiero están integrados.          | #152, #153 y #156 están fusionadas; CI y Browser E2E pasaron. Falta demostrar el recorrido completo con una nómina representativa antes de cerrar P1.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| P1        | EN CURSO               | Preparar un escenario financiero reproducible con datos sintéticos para demo.                     | Un tenant explícitamente de demostración carga clientes, productos, facturas internas, nómina, centro de costo, tercero y causación balanceada; la carga es idempotente, tenant-scoped y se verifica desde la UI. | El seed idempotente y su Browser E2E se fusionaron en #157 con CI, E2E y Preview verdes. No está verificado el recorrido con una ejecución del seed en el tenant demo. La factura interna todavía no causa en Ledger ni transmite a DIAN.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| P1        | PROTOTIPO              | Liquidar prima semestral de empleados activos por lote y generar un comprobante PDF por empleado. | Preview muestra períodos y conceptos fuente, base, días y fórmula; aprobación congela snapshots y correcciones; PDF inmutable queda vinculado al Expediente e idempotente ante reintentos.                        | PR #159 se fusionó como `400c562`; CI, Browser E2E y Vercel pasaron. Migraciones probadas en PostgreSQL desechable, no en demo/staging/producción. Casos ambiguos se bloquean. Revisión laboral independiente antes del uso operativo; pagos, Tesorería y Ledger fuera.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| P1        | EN CURSO (EXPORTACIÓN) | Estructurar afiliaciones/novedades y exportar aportes de nómina a PILA.                           | Afiliaciones con vigencia alimentan archivos tipo 1 y 2; validación local, aceptación del operador, liquidación y pago son estados separados; compatibilidad se prueba operador por operador.                     | ADR-013 aprobada con cambios; PR #160 conserva afiliaciones con auditoría e aislamiento tenant, pero aún no valida catálogos ni genera archivos. AT2 v30 oficial (24-07-2026; 336 páginas) define tipo 1 de 567 caracteres, encabezado 01 de 359 y detalle 02 de 693. La auditoría de esta rama mapea los 34 campos del tipo 1, 22 del encabezado 01 y 98 del detalle 02 a fuentes candidatas, datos faltantes y valores asignados al operador; no es fixture ni autoriza serializar. Aún faltan catálogos validados, eventos PILA con intervalos, períodos/días/IBC por subsistema, actividad y centro ARL, reglas de vigencia y pruebas de carga por operador. PayrollSnapshot v1 no congela identidad, DIVIPOLA ni afiliación efectiva; no completar desde maestros mutables ni inferirlas. Dependientes estándar solamente; sin cotizante 75, transmisión ni pago. |

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

- `main` en `be14542b` contiene Billing para clientes, productos y facturas
  internas; el schema distingue esas facturas de la cohorte electrónica
  heredada. El PR #151 valida que cada producto de una factura esté activo y
  pertenezca al tenant; la emisión continúa sin posteo al Ledger.
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
  se revalidó el 2026-10-30: la descarga directa del enlace a
  `anexo-tecnico2-cotizantes.pdf` identifica AT2 v30, fechado 2026-07-24
  (336 páginas), e incluye la Resolución 1529 de 2026 entre los actos
  incorporados. La [Resolución 1529 de
  2026](https://www.minsalud.gov.co/sites/rid/Lists/BibliotecaDigital/RIDE/DE/DIJ/resolucion-1529-de-2026.pdf)
  (58 páginas, 24 de julio) modifica partes del AT2 y el AT3 con plazos
  escalonados. La matriz debe cotejar las reglas consolidadas de v30, sus hitos
  de vigencia y normas posteriores, sin duplicar cambios incorporados. Se
  verificó que los cambios de identificación de los campos tipo 1 (3 y 18) y
  tipo 2 (4 y 75) aplican a
  pagos desde 2026-10-01 para pensiones del período 2026-09. Las aclaraciones
  de planilla E tienen otro hito: pago desde 2026-11-01 para salud del período
  2026-11; el cotizante 75 también tiene un hito en esa fecha, pero queda fuera
  del MVP. La matriz completa aún debe reconciliar cada regla de AT2 v30, sus
  hitos de vigencia y normas posteriores. La propuesta de modificar 5.87/5.91
  continúa en consulta pública, no como norma expedida. La selección de reglas
  por período/fecha prevista de pago de aportes PILA se aplicará solo a hitos
  cuya vigencia dependa de ambos datos; esa previsión es distinta de la fecha
  de pago del salario y no confirma que se pagaron los aportes.
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

## Estado de Goal y dependencias de entrega — 2026-10-30 (actualizado tras #154 y #159)

- **GOAL ACTIVO:** GOAL-02; GOAL-01 continúa pausado y conservado.
- **Integración:** #151, #152, #153, #155, #156, #157, #158 y #159 están
  fusionadas en `main`; #159 se fusionó como `400c562` y #154 como `76956b0`.
  Los checks CI, Browser E2E y Vercel de ambas PR terminaron exitosamente.
- **ADR-011:** #154 publicó la decisión como `proposed`; aprobar la propuesta
  no implementa la contabilización. Producto y Contabilidad aún deben validar
  esa ruta antes de desarrollar el posteo de facturas internas.
- **Prima:** ADR-012 está aprobada con condiciones. #159 añadió el flujo
  enero–junio y un Browser E2E que generó y descargó el PDF desde Expediente en
  PostgreSQL desechable. El flujo es prototipo para demo; revisión laboral
  independiente sigue pendiente antes del uso operativo. Las migraciones no se
  aplicaron a demo/staging/producción; pagos, Tesorería y Ledger quedan fuera.
- **PILA:** ADR-013 está aprobada con cambios y la matriz normativa fue
  presentada. Se comprobó directamente AT2 v30 y las disposiciones de la
  Resolución 1529/2026 sobre campos de identificación y plazos; falta
  reconciliar el layout y todas las reglas. El MVP cubre solo dependientes
  estándar, conserva afiliaciones con vigencia y no mapea automáticamente
  texto libre.
  Aún no se genera ni transmite un archivo, no se declara compatibilidad de
  operadores sin pruebas reales, y no se realizan liquidación o pago.
- **Estado de preparación:** PR #160 incorpora la etapa de afiliaciones manuales;
  CI, Browser E2E y Vercel Preview pasaron. PR #162 captura una fecha prevista
  de pago de aportes PILA en el período y la conserva en snapshots nuevos; no es
  el pago del salario ni evidencia de que se pagaron los aportes. La fecha
  seleccionada para cada exportación y las versiones aplicadas deberán quedar
  registradas sin reescribir el snapshot laboral. El Browser E2E dirigido pasó
  localmente contra PostgreSQL efímero; encontró y permitió corregir la
  expectativa del BFF (200) y el desfase de un día al mostrar fechas calendario.
  CI y Browser E2E de GitHub para el HEAD actual fueron rechazados antes de
  iniciar sus pasos porque GitHub indica un límite de facturación; no son
  fallos de pruebas de código. Vercel Preview pasó. Aún se requiere
  reconciliar reglas AT2/Resolución 1529, comprobar catálogos, completar datos
  patronales y laborales y calcular días/IBC por subsistema antes de generar
  tipo 1/2.
- No se ejecutó el seed financiero ni se accedió a staging, producción, VPS u
  OCI; no se transmitió información a DIAN/UGPP.
