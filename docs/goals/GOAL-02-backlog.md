# Backlog de GOAL-02 — Evolución Financiera y Cumplimiento Electrónico

Actualizado: 2026-10-31. GOAL-02 es el único Goal activo; GOAL-01 está pausado,
no cerrado. Este backlog conserva el resultado completo de GOAL-02 y prioriza
primero flujos financieros internos que puedan mostrarse a futuros clientes.

## M0 — Flujos financieros internos demostrables

| Prioridad | Estado                 | Iniciativa                                                                                        | Criterios de aceptación                                                                                                                                                                                           | Dependencias y riesgo                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------- | ---------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0        | COMPLETADO             | Validar que cada producto de una factura pertenezca al tenant activo y esté disponible.           | La API acepta productos activos del mismo tenant, rechaza IDs ajenos, inexistentes o inactivos sin crear la factura, conserva líneas manuales y tiene pruebas de regresión.                                       | Implementado y probado en el PR #151 (`3a8e1c4`); CI y Browser E2E verdes antes del merge. Sin migración; el filtro tenant-aware reduce riesgo de aislamiento multiempresa.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| P1        | PENDIENTE              | Conectar la emisión interna de facturas con el Ledger.                                            | Un acto interno genera un comprobante balanceado e idempotente con tercero, período y origen trazables; anular/corregir conserva evidencia y usa reversión del Ledger.                                            | ADR-011 se fusionó como propuesta en #154; aprobación de Producto y Contabilidad sigue pendiente. Antes de implementar deben definirse snapshots tributarios por línea y vínculo tenant-safe Customer–Tercero; riesgo financiero alto.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| P1        | EN CURSO               | Verificar de extremo a extremo la causación de nómina en el Ledger desde la UI.                   | Un período aprobado conserva su snapshot, crea una causación una sola vez, muestra el comprobante y soporta la corrección definida por el dominio. La UI y el escenario E2E financiero están integrados.          | #152, #153 y #156 están fusionadas; CI y Browser E2E pasaron. Falta demostrar el recorrido completo con una nómina representativa antes de cerrar P1.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| P1        | EN CURSO               | Preparar un escenario financiero reproducible con datos sintéticos para demo.                     | Un tenant explícitamente de demostración carga clientes, productos, facturas internas, nómina, centro de costo, tercero y causación balanceada; la carga es idempotente, tenant-scoped y se verifica desde la UI. | El seed idempotente y su Browser E2E se fusionaron en #157 con CI, E2E y Preview verdes. No está verificado el recorrido con una ejecución del seed en el tenant demo. La factura interna todavía no causa en Ledger ni transmite a DIAN.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| P1        | PROTOTIPO              | Liquidar prima semestral de empleados activos por lote y generar un comprobante PDF por empleado. | Preview muestra períodos y conceptos fuente, base, días y fórmula; aprobación congela snapshots y correcciones; PDF inmutable queda vinculado al Expediente e idempotente ante reintentos.                        | PR #159 se fusionó como `400c562`; CI, Browser E2E y Vercel pasaron. Migraciones probadas en PostgreSQL desechable, no en demo/staging/producción. Casos ambiguos se bloquean. Revisión laboral independiente antes del uso operativo; pagos, Tesorería y Ledger fuera.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| P1        | EN CURSO (EXPORTACIÓN) | Estructurar afiliaciones/novedades y exportar aportes de nómina a PILA.                           | Afiliaciones con vigencia alimentan archivos tipo 1 y 2; validación local, aceptación del operador, liquidación y pago son estados separados; compatibilidad se prueba operador por operador.                     | ADR-013 aprobada con cambios; PR #160 conserva afiliaciones con auditoría e aislamiento tenant, pero aún no valida catálogos ni genera archivos. MinSalud enlaza AT2 v30 (24-07-2026; 336 páginas; SHA-256 BBB3C2D0486FD7D3934BD640D8E68C60D33686B1604E8EFAA980139FB5686D33), que incluye la Resolución 1529/2026 entre los actos que lo incorporan; la extracción indexada que mostraba v29 estaba desactualizada; el mapeo de campos sigue provisional. La auditoría de esta rama mapea sus campos a fuentes candidatas, datos faltantes y valores asignados al operador; no es fixture ni autoriza serializar. PR #162 capturó la fecha prevista de pago de aportes y se fusionó en main como a459683 tras superar CI, Browser E2E y Vercel Preview. La preparación del snapshot agrega un payload PILA separado con empresa, empleado, contrato, sede, afiliaciones históricas del período, novedades, salario básico, tipo salarial, IBC por subsistema cuando existe un concepto fuente inequívoco y días cotizados por subsistema solo para dependientes 01/00, con mes calendario completo y cobertura completa de empleado, contrato y afiliación; los demás días quedan nulos con códigos de bloqueo. PR #163 (abierta, checks verdes al 2026-10-31) añade captura de eventos PILA desde el detalle del período (búsqueda de empleado, alta/baja tenant-scoped en BORRADOR y validación de fechas/días); al calcular, los congela en cada snapshot y bloquea días sin segmentación aprobada. Liquidación y edición bloquean la fila del período y vuelven a leer eventos dentro de la transacción para evitar snapshots incompletos por concurrencia. ADR-014 fue aceptada (opción B); PR #169 (abierta sobre #168, checks verdes al 2026-10-31) captura centro ARL y actividad de riesgos con vigencias por empleado y snapshots. PR #170 (abierta sobre #169) agrega un informe preliminar de brechas visible en el detalle de períodos aprobados/causados: lee únicamente snapshots del mismo tenant, agrupa campos pendientes conocidos y muestra empleados afectados. No completa datos desde maestros actuales; `archivoGenerable` permanece `false` y `estadoArchivo` `NO_IMPLEMENTADO`. El informe no es un preflight normativo completo: sin brechas detectadas no prueba que el período pueda exportarse. PR #180 añade layouts de registros AT2 v30. Las PR #181–#207 siguen abiertas; incluyen guardas de prima, preflight, propuesta ADR-015 para ubicación laboral, validación de anchos y mapeos candidatos de aportante, cabecera, detalle y aportes. La mayoría están apiladas; #183 propone una decisión paralela aún no aprobada. Los checks CI/Browser de #203–#207 fallaron en 2–6 segundos con jobs sin pasos; no ejecutaron validaciones de código. Vercel completó #203 y #206, y limitó por cuota #204, #205 y #207. Los PR quedan abiertos para sincronizar y auditar en orden de dependencia cuando se reponga Actions. Aún faltan segmentación PILA de novedades, validar catálogos y bases conforme a normas, actividad y centro ARL, reglas completas de vigencia, mapeo y composición completa de archivos, fixtures normativos revisados y pruebas de carga por operador. Dependientes estándar solamente; sin cotizante 75, transmisión ni pago. |

ADR-014 fue aceptada (opción B): conservar el centro asignado por la ARL y la
actividad económica de riesgos con vigencias por empleado, sin inferirlos de la
sede ni de datos actuales. PR #169 implementa esta captura y permanece abierto
con CI, Browser E2E y Vercel Preview verdes al 2026-10-31. La captura de eventos
PILA queda ligada al período indicado; un intervalo que se extienda a otro
período no se replica automáticamente. La UI lo advierte y los casos entre
períodos siguen bloqueados para exportación hasta definir cómo conservarlos y
aprobarlos en cada planilla afectada.
Se añadió y ejecutó localmente un Browser E2E con PostgreSQL 16 desechable y
puertos aislados; pasó el registro, la creación de sede y empleado, captura de
una incapacidad, persistencia tras recarga y eliminación. La aplicación de 73
migraciones descubrió un nombre de tabla incorrecto en el FK de eventos; se
corrigió a `empleados` y la migración completa pasó en limpio. El contenedor de
prueba se detuvo y no se usaron datos de demo/staging/producción. Esta prueba
local se incluyó en PR #163, abierta con CI, Browser E2E y Vercel Preview
verdes al 2026-10-31.

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
  se revalidó el 2026-10-31. Una descarga fresca de su enlace a
  `anexo-tecnico2-cotizantes.pdf` tiene 336 páginas y SHA-256
  `BBB3C2D0486FD7D3934BD640D8E68C60D33686B1604E8EFAA980139FB5686D33`; la
  página 2 identifica AT2 v30, fechado 2026-07-24, e incluye la Resolución
  1529/2026 entre los actos que lo incorporan. El índice web aún mostraba v29,
  pero su extracción estaba desactualizada respecto a la descarga directa. Se
  corrige la conclusión anterior que reportaba v29 y desconocía el v30/hash.
  La versión y el PDF están verificados; el mapeo de campos, valores esperados,
  condiciones de vigencia y fixtures siguen siendo provisionales hasta cotejar
  AT2 v30 y las normas posteriores. Se verificó que los cambios de
  identificación de los campos tipo 1 (3 y 18) y tipo 2 (4 y 75) aplican a
  pagos desde 2026-10-01 para pensiones del período 2026-09. Las aclaraciones
  de planilla E tienen otro hito: pago desde 2026-11-01 para salud del período
  2026-11; el cotizante 75 también tiene un hito en esa fecha, pero queda fuera
  del MVP. La matriz completa aún debe reconciliar cada regla de AT2 v30 y
  normas posteriores. La propuesta de modificar 5.87/5.91 continúa en consulta
  pública, no como norma expedida. La selección de reglas por período/fecha
  prevista de pago PILA se aplica solo a hitos cuya vigencia dependa de ambos
  datos; esa previsión es distinta del pago del salario y no confirma que se
  pagaron los aportes.
- **Exactitud de parámetros de nómina demo:** la auditoría detectó que
  `apps/api/prisma/seed.ts` fechaba en 2026 y citaba normas de 2024, pero
  cargaba cifras de 2025. La preparación local corrigió los valores a SMMLV
  $1.750.905, auxilio $249.095 y UVT $52.374, y actualizó las referencias en
  el seed y los documentos de Payroll. A 2026-10-30 el Consejo de Estado había
  revocado la suspensión provisional del Decreto 1469/2025 y este seguía
  vigente, pendiente el fallo de fondo. La prueba aislada aplicó las
  migraciones y ejecutó el seed dos veces en PostgreSQL desechable; los tres
  valores quedaron persistidos y la repetición fue idempotente. No se ejecutó
  contra ninguna base de usuario. Falta validar las demás reglas antes de usar
  Payroll 2026 con clientes.
  Fuentes: [Consejo de Estado, 17-07-2026](https://www.consejodeestado.gov.co/ordenesdeldia/prensa/fina.php),
  [Decreto 1469 de 2025](https://cancilleria.gov.co/normograma/compilacion/docs/decreto_1469_2025.htm),
  [Función Pública, Decreto 1470 de 2025](https://www1.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=274217),
  [DIAN, Resolución 000238 de 2025](https://www.dian.gov.co/normatividad/Normatividad/Resoluci%C3%B3n%20000238%20de%2015-12-2025.Pdf).
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

## Estado de Goal y dependencias de entrega — 2026-10-31 (actualizado tras #207)

- **GOAL ACTIVO:** GOAL-02; GOAL-01 continúa pausado y conservado.
- **IMPLEMENTACIÓN BLOQUEADA (solo sincronización y merge):** la cadena PILA
  #203–#207 sigue abierta. Los checks CI/Browser fallaron antes de ejecutar
  pasos por la cuota de Actions y algunas vistas Vercel quedaron limitadas.
  Esto no bloquea el trabajo local ni los incrementos que puedan prepararse en
  ramas dependientes; por instrucción del usuario, se actualizarán y revisarán
  en orden cuando se reponga la cuota.
- **ARQUITECTURA DISPONIBLE:** ADR-012 y ADR-013 están aprobadas con sus
  condiciones; AT2 v30 se contrastó con fuente oficial y la matriz PILA
  identifica candidatos, bloqueos y versiones. #183 propone ADR-015 y sigue
  pendiente de aprobación. La descarga PILA continúa deshabilitada.
- **Prima masiva:** #166, #167 y #168 están abiertas sobre la cadena PILA y sus
  checks CI, Browser E2E y Vercel están verdes. Se conservarán abiertas hasta
  la sincronización y revisión ordenada solicitada por el usuario.
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
  La PR #167 amplía el Browser E2E a 100 empleados: tras aprobar el lote, corta
  la conexión del navegador y verifica que el worker termine, publique los 100
  PDFs en Expediente y permita descargarlos después de reconectar (39,5 s en
  PostgreSQL 16 desechable). La PR #168 muestra el avance acumulado, pendientes
  y errores y verifica la barra accesible 100/100 al volver. Ambas siguen
  abiertas a continuación de la cadena PILA.
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
  El PR #162 se fusionó en `main` el 2026-10-31 como `a459683` después de que
  CI, Browser E2E y Vercel Preview terminaron exitosamente. El bloqueo temporal
  de facturación de Actions quedó resuelto. Aún se requiere
  reconciliar reglas AT2/Resolución 1529, comprobar catálogos, completar datos
  patronales y laborales y calcular días/IBC por subsistema antes de generar
  tipo 1/2.
- **Captura fuente PILA en preparación:** una rama basada en el merge de #162
  agrega una captura por tenant de
  empresa, empleado, contrato, sede y afiliaciones vigentes al generar o
  recalcular nómina, y la copia a un payload PILA separado cuando se aprueba.
  También agrega una ficha de aportante PILA editable solo por ADMIN, con
  auditoría de campos cambiados (sin copiar sus valores a la metadata) y
  captura inmutable en el payload aprobado. La ficha no asigna valores por
  defecto ni convierte datos heredados, y todavía no valida todos los códigos
  contra catálogos oficiales.
  Los snapshots históricos permanecen en `NULL`, no se consulta el maestro al
  exportar para rellenarlos y `pilaSource` se excluye de la lectura del período.
  Las pruebas unitarias dirigidas verifican que se conserve el historial
  de afiliación que cambia dentro del período, que afiliaciones y sedes se
  consulten con tenant/fechas explícitos y que el endpoint ordinario no incluya
  el payload PILA. También cubren salario básico y tipo salarial PILA 40–41;
  registra novedades fuente e IBC independiente por subsistema solo desde un
  concepto único identificado; fuentes ausentes o ambiguas quedan sin valor.
  El tipo de salario PILA X/F/V se declara en Empleado y se copia en el payload
  al calcular/recalcular; X debe coincidir con el indicador integral vigente.
  Los registros históricos sin clasificación siguen en null y no se
  completan automáticamente. La ausencia de conceptos variables no se toma
  como salario fijo. La clasificación todavía no tiene vigencia laboral; un
  cambio dentro del período no es segmentable y debe bloquearse. La preparación
  actual captura 30 días independientes para los cuatro subsistemas
  solo en un mes calendario completo, con empleado, contrato y afiliación que
  cubren todo el período, cotizante 01 con subtipo explícito 00 y sin novedades;
  si falta una condición, conserva null y códigos de bloqueo. Esto es
  preparación de
  snapshot y no valida ni genera el archivo PILA.
  El tipo queda sin resolver cuando hay devengos que el modelo no permite
  clasificar con seguridad. El salario original se conserva sin redondeo; la
  proyección del campo 40 solo admite enteros seguros no negativos y bloquea
  valores ausentes o con centavos. Todavía falta validar su aplicabilidad por
  tipo de cotizante. El typecheck y el lint del código de
  producción pasan. Las
  73 migraciones aplicaron correctamente en PostgreSQL desechable, se
  confirmaron las tres columnas nuevas y la integración de `PayrollService.aprobar`
  persistió el payload PILA aprobado en una base PostgreSQL efímera. La prueba
  no accede a bases de usuario. La captura es un prerrequisito del exportador;
  no cubre todos los campos obligatorios, no serializa ni valida archivos tipo
  1/2 y aún no constituye una capacidad utilizable por clientes.
- AT2 v30 confirma cuatro conteos independientes de días (pensión, salud,
  riesgos, CCF), cuatro IBC por subsistema (campos 42–45) y el campo 95
  adicional cuando aplica. Permite múltiples registros 02 para una persona en
  casos normativos definidos, incluidos cambios de ingreso/retiro o IBC. Esta
  estructura está confirmada en el PDF oficial; el mapeo desde los snapshots y
  las reglas laborales todavía no. Payroll conserva un solo IBC y sus novedades
  no tienen intervalos PILA aprobados. No iniciar el serializador con un IBC o
  contador general repetido: primero congelar segmentos, bases y días permitidos
  por subsistema, con fixtures y resultados esperados revisados.
- AT2 v30 establece que el campo 95 (IBC de otros parafiscales) es obligatorio
  para cotizante 01. La [Ley 21 de 1982, artículo 17](https://www.funcionpublica.gov.co/eva/gestornormativo/norma_pdf.php?i=4827)
  define su base con factores salariales y descansos remunerados; el
  [artículo 49 de la Ley 789 de 2002](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=6778)
  aplica el 70% al salario integral. `PayrollCalculator` conserva un IBC común
  para cotizaciones; el campo 95 no puede reutilizarlo porque Payroll todavía
  no modela el importe pagado por vacaciones ni la naturaleza salarial de
  `BONUS`.
- La preparación local agrega la regla versionada candidata
  `CO_PARAFISCAL_BASE_V1` al payload PILA: para dependientes estándar de mes
  completo, deriva el campo 95 de `SALARIO_BASE` y horas extra solo cuando su
  valor coincide con novedades aprobadas; excluye `AUX_TRANSP` y no toma como
  fuente deducciones, aportes patronales ni provisiones. La matriz del ADR
  enumera el catálogo actual. El caso de salario integral usa 70%. Se probaron
  los fixtures de salario fijo, exoneración sin conceptos ICBF/SENA, salario
  integral, horas extra, bonificación ambigua y vacaciones sin concepto de
  descanso pagado. Las últimas dos, los meses parciales, valores fuente
  inválidos y conceptos nuevos quedan bloqueados. La prueba dirigida del
  snapshot pasó localmente (21 casos) y `PayrollService` conservó la regla al
  aprobar (93 pruebas del servicio pasaron); también pasaron typecheck y lint de
  los dos archivos de snapshot. Aún falta revisión laboral de los resultados y el
  fixture de vacaciones con un concepto salarial de descanso que Payroll
  todavía no puede producir.
  La rama de PR #180 incorpora formato fijo de registros AT2 v30, pero no un
  mapeo completo de snapshots ni archivos utilizables por clientes.
- **Primer operador candidato para pruebas PILA:** SOI, planilla E, por su
  documentación de cargue de archivos planos de empresa y autocorrector para
  errores del archivo. Es una decisión de planificación, no compatibilidad
  verificada: no hay carga real ni evidencia de aceptación; eso requiere
  acceso de prueba al aportante y resultado del portal.
- No se ejecutó el seed financiero ni se accedió a staging, producción, VPS u
  OCI; no se transmitió información a DIAN/UGPP.

### Continuación de PILA — 2026-10-31

- PR #163, #164 y #165 siguen abiertas y en secuencia; no se fusionaron. Sus
  checks visibles están verdes al momento de esta revisión, y se actualizarán
  contra `main` y se integrarán en orden cuando el usuario reponga la cuota de
  GitHub Actions.
- En el preflight local de #164, el perfil del aportante ya conserva la
  respuesta sobre acciones especiales y la clase de aportante. Se detectó que
  el informe no bloqueaba una acción declarada ni una respuesta sin confirmar,
  y aceptaba clases A/B sin contrastar el total de cotizantes o C/D sin validar
  evidencia de elegibilidad. La continuación en preparación añade bloqueos
  para los campos 26, 7, 33, 34 y 76, incluidos conteos A/B y consistencia con
  Ley 1429, sin declarar el archivo generable ni ampliar el MVP.
- ADR-014 adopta la opción B por la delegación general de decisiones del
  usuario: centro ARL reutilizable, asociación opcional con Sede y asignación
  fechada de actividad por empleado. La pantalla de empleado captura y
  conserva esos datos sin inferirlos desde cargo, sede ni afiliación heredada.
- La migración agrega tablas tenant-safe sin backfill. El snapshot PILA sube a
  v2 y congela centro, actividad, vigencias, tenant y versión normativa; el
  lector mantiene compatibilidad con snapshots v1 y los bloquea para campos 62
  y 98 cuando no tienen datos. Alta y cierre usan historial auditado, bloqueo
  concurrente por empleado, validación de solapamientos, catálogo y
  consistencia ARL/clase de riesgo.
- El catálogo contiene 1.018 códigos extraídos del anexo oficial de Función
  Pública para Decreto 768/2022, con hash del PDF registrado en código. No se
  incluyeron descripciones para evitar atribuir texto que la extracción no
  verificó. Requiere revisión de Nómina con constancias anonimizadas; el campo
  62 aún necesita comprobar formato AT2/operador. El formateador de registros
  de PR #180 no es un serializador de archivos ni prueba compatibilidad.
- El Browser E2E de empleados pasó en Chromium con PostgreSQL 16 desechable:
  registra centro ARL, sede opcional y actividad vigente desde el perfil,
  verifica persistencia al recargar y cierra la vigencia. La API declara las
  lecturas como autenticadas y las escrituras con roles ADMIN/OPERADOR; esto
  corrige el bloqueo de activación Deny by Default detectado al arrancar la
  prueba. No se usó el tenant demo ni el servidor local del usuario.
- La continuación local del informe de preparación PILA enumera cada código
  de evento congelado como bloqueo en su campo AT2 y detecta snapshots v2 con
  lista ausente o desincronizada entre sus copias. No calcula segmentos, no
  valida por completo la norma y mantiene `archivoGenerable: false`; la
  segmentación de eventos, días e IBC
  sigue pendiente. La revisión de `PayrollService` confirma que el cálculo
  usa el salario mensual completo y no prorratea por ingreso/retiro; los IBC
  del snapshot no son una fuente segura para esos períodos parciales. Payroll
  prorrateado y sus fixtures laborales revisados son prerrequisito de esa ruta.
  AT2 v30 permite menos de 30 días de pensión y salud cuando existe novedad
  ING o RET para cotizantes obligados; los días y los IBC se reportan por
  subsistema. Esto no determina por sí solo el prorrateo interno de Payroll, los
  pisos de IBC, las bases de CCF/parafiscales, días normalizados ni concurrencia
  de novedades. El Decreto 780 establece la base mensual devengada
  para dependientes privados; Decreto 1072 regula aparte ciertos trabajos por
  períodos inferiores a un mes. El Concepto 298251/2022 explica 30 días en un
  caso de trabajador oficial y no valida por sí solo la fórmula de nómina
  privada. Faltan expected values revisados por subsistema.

- PR #173 agrega una prueba unitaria de recuperación del trabajador de prima
  después de que vence su lease: cuando ya existe el PDF, el worker publica el
  artefacto existente y completa el lote sin volver a renderizarlo. La prueba
  simula la interrupción y recuperación; no equivale a una prueba de reinicio
  real del proceso ni a aceptación end-to-end.
- PR #174 amplía el preflight PILA con límites de campos numéricos de nueve
  posiciones y longitudes textuales AT2 para identificación, nombres, datos del
  aportante y representante. Los excedentes bloquean sin truncarse y las
  pruebas cubren máximos y desbordamientos. Esto sigue siendo validación
  preparatoria: no serializa registros, no hace `archivoGenerable` verdadero y
  no acredita carga o compatibilidad de operador.
- La continuación del preflight del archivo tipo 1 valida fax numérico,
  caracteres y dominio del correo, y la identificación del representante
  contra CC/CE/PA/CD. La identificación puede omitirse para persona natural
  solo si no se diligencia parcialmente. También limita el documento del
  aportante por tipo (incluida longitud exacta para PE), exige DV cero para
  persona natural y aplica la regla AT2 de usar el código como nombre de
  sucursal cuando no existe nombre. El preflight sigue sin serializar ni
  habilitar la descarga PILA.
- El mapa del encabezado tipo 2 (22 campos) encuentra que AT2 asigna al
  operador modalidad, período de otros sistemas, radicación, fecha efectiva de
  pago y código de operador; el snapshot no autoriza inventarlos. El campo 16
  de salud tiene período cotizado como fuente candidata y el 20 suma IBC CCF,
  no salario bruto. SOI confirma públicamente cargue de archivo plano y un
  autocorrector, pero no publica en esas páginas la convención de entrada de
  esos campos; una prueba de carga sigue pendiente. La fecha prevista PILA no
  se tratará como pago efectivo.

### Estado de la continuación PILA — 2026-10-31

- PR #173–#178 permanecen abiertos y apilados; no se han actualizado contra `main` ni fusionado. #175 valida campos del tipo 1, #176 documenta el encabezado tipo 2, #177 corrige el estado de subtipo `00` y #178 reconcilia el mapa de fuentes con snapshots actuales.
- En la última consulta, `browser` y `verify` de #177 y #178 fallaron a los 2–3 segundos. No se investigó la causa en esta continuación. Los PR quedan abiertos mientras se sigue con trabajo independiente; cuando se reponga la cuota, se sincronizarán con `main` en orden, se esperarán los checks de cada uno y se fusionarán solo después de auditarlo.
- El Preview de #177 pasó; el de #178 seguía desplegándose al consultar. Ninguno de esos estados convierte el informe preliminar en un preflight completo. `archivoGenerable` sigue en `false`; #180 aporta únicamente formato de registros y no genera un archivo PILA utilizable por clientes.
- En los commits de documentación de #177 y #178 pasaron Prettier y
  `git diff --check`; no se ejecutaron pruebas porque esos cambios no tocaban
  código. Los cambios posteriores de código y sus verificaciones se registran
  en las secciones que siguen.

### Primitiva de layout AT2 v30 — 2026-10-31

- La nueva rama `codex/goal02-pila-at2-fixed-width-layout`, apilada sobre
  #178, define una primitiva de formato fijo para los tres registros de entrada
  AT2 v30: tipo 1 (567 caracteres), encabezado tipo 2 (359) y detalle tipo 2
  (693). Los anchos y tipos `N`/`A` se cotejaron con el PDF oficial de 336
  páginas, versión 30 de 24-07-2026, SHA-256
  `BBB3C2D0486FD7D3934BD640D8E68C60D33686B1604E8EFAA980139FB5686D33`.
- La utilidad exige decisión explícita para cada campo, aplica solo el relleno
  normativo `N`/`A`, y rechaza exceso de longitud o controles; una prueba
  unitaria cubre conteo y longitud de los tres layouts. Todavía no consume
  `PayrollSnapshot`, elige vacíos, codifica bytes, agrega separadores, produce
  descargas ni comprueba operadores. No cambia `archivoGenerable`, que sigue
  siendo `false` hasta completar reglas, fixtures, mapeo/composición del
  archivo y validación normativa.

### Visibilidad de disponibilidad PILA — 2026-10-31

- El informe preliminar separa las brechas de datos por empleado del estado
  general de exportación. Indica que el layout AT2 v30 y el formateador de
  registros existen en la rama, pero el mapeo desde snapshots, composición y
  descarga de archivos no están implementados; la validación sigue siendo
  parcial y la aceptación por operador no está verificada.
- Expone como dependencia los campos que AT2 asigna al sistema del operador:
  tipo 1, campos 28–29; encabezado tipo 2, campos 2, 15, 17, 18 y 22. La
  documentación pública de SOI confirma cargue de archivos planos, pero la
  búsqueda realizada no encontró cómo debe representar esos campos el archivo
  de entrada. Se mantiene esa convención pendiente, sin inventar valores ni
  declarar compatibilidad.

### Corrección de prima — 2026-10-31

- La calculadora de prima ignoraba silenciosamente cualquier tipo de novedad de
  snapshot que no estuviera entre `LICENSE`, `OTHER` y `BONUS`; una novedad
  desconocida podía producir una línea `LISTA`. La matriz de ADR-012 exige
  bloquear novedades sin tratamiento aprobado.
- El PR #181 mantiene el cálculo solo para novedades aceptadas explícitamente
  (`VACATION`, `SICKNESS`, `OVERTIME`) y bloquea las ambiguas o desconocidas.
  Regresiones cubren `LICENSE`, `OTHER` y el tipo histórico/desconocido
  `SUSPENSION`; se conserva el caso de bonificación como bloqueo específico.
  El parser también rechaza snapshots cuyo array de conceptos o novedades
  contiene filas que no son objetos; antes las descartaba y podía calcular con
  fuente incompleta. Rechaza además importes fraccionarios, coherente con los
  pesos enteros congelados por nómina; hay regresiones para salario, auxilio y
  trabajo suplementario.
- Las pruebas de calculadora y servicio pasan (32/32), al igual que typecheck de
  API, ESLint, Prettier y `git diff --check`. El PR #181 está apilado sobre
  #180; CI y Browser E2E fallaron en 1–2 segundos al abrirse. El usuario indicó
  que la cuota mensual de Actions está agotada; ambos PR quedan abiertos para
  continuar trabajo local y sincronizarlos en orden cuando se reponga.

### Integridad de snapshots en el preflight PILA — 2026-10-31

- La revisión del informe preliminar encontró que afiliaciones y asignaciones
  ARL se filtraban a objetos antes de validar su forma. Un snapshot con una fila
  válida más otra malformada podía aparecer como una sola asignación completa.
  El preflight ahora reporta bloqueos explícitos para las filas inválidas de
  afiliación, centro de trabajo y actividad económica; no activa generación de
  archivos ni cambia el estado global `NO_IMPLEMENTADO`.

### Fecha de pago PILA en el preflight — 2026-10-31

- La implementación inicial consultaba la fecha del período en el informe,
  aunque ADR-013 establece que se consume la fecha congelada en snapshots
  aprobados. El preflight ya deriva la fecha mostrada exclusivamente de esos
  snapshots, exige una fecha calendario válida en cada uno y bloquea si difieren.
  Así una ausencia o inconsistencia no se oculta por separado en el dato del
  período ni se intenta corregir reescribiendo el snapshot.
- El archivo sigue `NO_IMPLEMENTADO`; la validación normativa es preliminar y
  la aceptación por operador no verificada.

### Fuente de ubicación laboral PILA — 2026-10-31

- El snapshot congela el municipio de la sede asociada al contrato, pero esa
  sede es una referencia operativa y no confirma el lugar laboral para los
  campos 9–10 de AT2. La matriz y ADR-013 ya delimitaban esta diferencia; el
  preflight no la aplicaba y podía dar por resueltos esos campos.
- PR #182 ahora bloquea ambos campos incluso cuando el municipio de la sede
  tiene un código DIVIPOLA válido. Falta una fuente PILA explícita, confirmada
  y congelada; hasta que se defina y capture, esos campos no pueden figurar como
  listos para exportación.

### Formato del centro ARL en el preflight PILA — 2026-10-31

- Al cotejar el informe con AT2 v30 oficial se encontró que el campo 62 ocupa
  nueve posiciones numéricas (página 95), mientras el preflight solo exigía un
  valor no vacío. El perfil del centro conserva el código declarado por la ARL
  como texto de hasta 40 caracteres, por lo que un valor alfanumérico o mayor
  de nueve dígitos podía pasar sin advertencia aunque el archivo no pudiera
  representarlo.
- El preflight ahora bloquea códigos incompatibles con N9 y no los recorta ni
  transforma; valores de 1–9 dígitos conservan sus ceros iniciales para el
  formateador fijo. La regla se cotejó con la página 95 del AT2 v30 descargado
  del enlace oficial de MinSalud (SHA-256
  `BBB3C2D0486FD7D3934BD640D8E68C60D33686B1604E8EFAA980139FB5686D33`). Esto
  solo mejora un insumo del informe preliminar: el archivo continúa sin
  implementarse y la compatibilidad con operadores no está verificada.

- El mismo cotejo encontró que el código ARL del aportante se exigía, pero no
  se bloqueaba por exceder las seis posiciones A6 del campo 14 del encabezado
  tipo 2. El preflight ahora valida ese límite sin truncar ni inferir su
  catálogo; las pruebas cubren seis posiciones y el exceso. La compatibilidad
  y convención de carga siguen pendientes de pruebas por operador.
- La revisión del detalle encontró que los códigos de pensión, EPS, CCF y ARL
  se exigían parcialmente, pero no se controlaba A6; el campo 77 tampoco
  bloqueaba la ausencia del código ARL congelado. El preflight ahora exige el
  código ARL afiliado y bloquea códigos de administradoras con más de seis
  posiciones sin truncarlos. La validación de catálogos oficiales y del
  operador sigue pendiente.
- El encabezado de planilla contaba cotizantes únicos pero el preflight no
  detectaba el desbordamiento del campo 19 (5 N). Ahora bloquea más de 99.999
  cotizantes sin truncar ni contar dos veces a quien tenga varias líneas 02;
  el límite superior tiene prueba de borde.
- El campo 20 del encabezado suma el IBC CCF de los campos 45 del detalle y
  ocupa N12. El informe ahora suma los valores congelados solo cuando todos
  están presentes y caben individualmente en N9; bloquea el exceso sobre
  999.999.999.999 y acepta el límite exacto. Esto no aprueba la obligación ni
  la aplicabilidad de CCF, no estima bases ausentes y no habilita generar un
  archivo.

### Fuentes de conceptos y reglas de aportes PILA — 2026-10-31

- AT2 v30 valida aportes con IBC de subsistema × tarifa y remite a las reglas
  normativas de redondeo. El campo 61 usa la tarifa inicial de riesgos según la
  clase ARL; los campos 51–52 separan subcuentas del FSP; salud tiene reglas de
  exoneración cruzadas; SENA/ICBF y ESAP/MEN tienen obligaciones y alcance
  distintos. La matriz `AT2-V30-MVP-ACCEPTANCE-MATRIX.md` registra esas reglas
  y sus páginas, separando lo verificado de las fuentes candidatas.
- El preflight de snapshots v2 requiere conceptos únicos de pensión, salud
  empleado, ARL y caja con tipos y bases consistentes con sus IBC congelados;
  valida además los datos numéricos candidatos. Revisa fuentes patronales,
  parafiscales y FSP si existen, sin asumir que una fuente opcional ausente
  representa un aporte cero. La generación, el mapeo final, el cálculo de
  aportes y la compatibilidad de operadores siguen sin habilitarse.
- La Sentencia C-264/2026 fijó el 1 de abril de 2027 para la entrada en vigor
  de las disposiciones exequibles que conforman el nuevo sistema pensional.
  Aunque AT2 v30 describe la distribución de pensión por componentes y el
  umbral de 2,3 SMLMV, esas reglas no se activan para planillas de 2026 por el
  solo hecho de aparecer en el formato. El mapeo debe versionar el corte,
  revisar las disposiciones exceptuadas y revalidar el marco vigente antes de
  soportar períodos que alcancen abril de 2027.
- El informe PILA marca ese corte con un bloqueo de exportación si el período
  o la fecha prevista de pago alcanza 2027-04-01, y señala los campos 46–47.
  Una planilla de marzo pagada en abril también queda bloqueada. Para períodos
  anteriores se agregaron candidatos estándar 46–47 a partir de PENSION_EMP
  (4 %) y PENSION_PAT (12 %) congelados, con obligación explícita, bases y
  redondeo reconciliados. No implementa la distribución del nuevo sistema,
  no permite generar archivos y requiere prueba de carga por operador.

### Mapeo candidato de aportante AT2 v30 — 2026-10-31

- `pila-at2-v30-employer-mapper.ts` mapea fuentes explícitas del snapshot PILA
  v2 a campos candidatos del archivo tipo 1. No valida ni serializa el registro
  y no consulta maestros actuales; un snapshot sin versión o `tenantId` válido
  no produce valores candidatos.
- Los campos 28–29 asignados al operador permanecen sin valor. También queda
  sin resolver el campo 16 cuando el fax opcional está vacío, porque falta
  confirmar la representación vacía de ese campo numérico.
- Se incorporó `pilaClaseAportante` al perfil PILA nullable y al snapshot v2,
  para que la declaración viaje congelada con la nómina aprobada. Los snapshots
  históricos anteriores a la migración siguen sin ese dato y permanecen
  bloqueados; no se hace backfill ni se infiere desde la razón social. El
  departamento Ley 1429 se deriva del DIVIPOLA del domicilio del aportante ya
  congelado en `employer.municipio`, según ADR-013. Ningún valor se completa
  desde sede laboral ni desde maestros actuales.
- Las pruebas unitarias cubren presentación única y por sucursal, DIVIPOLA,
  omisión de representante para persona natural, fuentes faltantes y el bloqueo
  de campos asignados al operador. La matriz de aceptación PILA documenta el
  alcance y las limitaciones del mapa candidato.

### Mapeo candidato del encabezado PILA AT2 v30 — 2026-10-31

- `pila-at2-v30-header-mapper.ts` arma valores candidatos desde snapshots PILA
  v2 del mismo tenant y período: planilla E, campos compartidos del aportante,
  período de salud mensual, conteo único y suma de IBC CCF congelados.
- Rechaza conjuntos mezclados de tenant/período; no escoge entre snapshots
  repetidos de un empleado. Solo agrega dependientes `01`/`00` con afiliación
  vigente para todo el mes. Los operadores conservan los campos que AT2 les
  asigna (2, 15, 17, 18 y 22). No se serializa ni se compone el archivo.
- Las pruebas cubren set estándar, totales con varios empleados, campos del
  operador, tenant cruzado, snapshot repetido, afiliación fuera de alcance y
  período incompleto. La validación del detalle 02 y compatibilidad con
  operadores siguen pendientes.

### Mapeo candidato de detalle PILA AT2 v30 — 2026-10-31

- `pila-at2-v30-detail-mapper.ts` agrega fuentes directas de identidad,
  afiliación, días completos, salario, IBC por subsistema y asignación ARL desde
  un snapshot PILA v2 del mismo empleado/tenant/período. No vuelve a consultar
  maestros ni transforma novedades y no altera importes aprobados.
- El alcance del mapa cubre campos 1–8, 11–21, 23–27, 29–47, 54–55, 57–69,
  74–78, 80–94, 95 y 98. Los importes 63/65/67/69 son solo candidatos
  copiados de un concepto patronal único, con tipo esperado, factor positivo y
  base coincidente. Cada importe requiere además que el valor congelado ya
  coincida con el redondeo PILA versionado al múltiplo de 100 superior; una
  discrepancia lo deja sin resolver. Para ARL, el factor también debe coincidir con la tarifa
  inicial versionada de la clase y actividad congeladas. El campo 61 conserva
  esa misma regla y usa el decimal AT2 aprobado; no se deriva desde datos
  maestros ni se recalculan importes.
  Requieren además días aprobados de mes completo y ausencia de novedades y
  eventos PILA; SENA e ICBF requieren declaración explícita de no exoneración,
  coherente con la bandera de exoneración del mismo snapshot del empleador.
  AT2 v30 pp. 86–87 permite dejar 7 en blanco para CC/TI y 8 para CE/PA, pero
  mantiene sin resolver la exención pensional CE/PA y la residencia exterior
  CC/TI porque todavía no se capturan como declaraciones explícitas.
  Para el caso de mes completo sin eventos ni novedades Payroll, la continuación
  apilada sobre #202 propone los blancos/cero normativos en campos 15–21,
  23–27, 29–30 y 80–94. Los campos 22 (corrección de planilla) y 28 (aporte
  voluntario a pensión) siguen pendientes porque no hay una fuente congelada
  para esos valores. Nunca se calcula un aporte ni se infiere cero cuando falta
  fuente. El registro completo no es serializable ni descargable.
- Las pruebas verifican snapshot v2, dependiente 01/00, cobertura del período,
  códigos afiliados, días/base salarial e IBC congelados, ceros iniciales del
  documento/centro, fuentes de concepto únicas y aislamiento del centro ARL.
- El informe del período muestra por campo cuántos empleados tienen candidato
  para 46/47, 54/55, 61/63/64/65/66/67/68/69 y las razones y nombres asociados a los pendientes. Si un
  empleado tiene snapshots duplicados no escoge uno; los candidatos parciales
  no habilitan archivo ni aceptación de operador.

### Campos IGE/LMA sin eventos candidatos AT2 — 2026-10-31

- `AT2_V30_NO_IGE_LMA_FIXED_FIELDS_V1` representa los campos 57 y 59 en
  blanco y los campos 58 y 60 en cero solo para un snapshot v2 de mes completo,
  con días aprobados, arrays de eventos presentes y vacíos, y sin novedades
  Payroll. AT2 v30 asigna esos valores cuando no hay incapacidad general ni
  licencia de maternidad/paternidad.
- Si existe cualquier evento o novedad, faltan arrays de origen, o no se
  demuestra el mes completo, los cuatro campos quedan pendientes. El código no
  crea números de autorización ni calcula valores de incapacidad/licencia.
- El informe API/web muestra conteos y razones por campo 57–60, incluidos los
  empleados pendientes. El panel mantiene visible que no existe un flujo para
  capturar importes y autorizaciones de eventos IGE/LMA.
- El candidato no hace exportable el registro ni verifica aceptación de un
  operador. El flujo IGE/LMA con datos de prestación permanece pendiente.

### Campos de detalle sin novedades PILA — 2026-10-31

- La continuación de #202 mapea los indicadores sin evento en campos 15–21,
  23–27 y 29–30, y las fechas vacías 80–94. Exige snapshot PILA v2 de mes
  calendario completo, afiliación `01`/`00`, empleado y contrato vigentes,
  días aprobados de los cuatro subsistemas y arrays presentes/vacíos de eventos
  junto con novedades Payroll vacías.
- El campo 30 queda en cero cuando no se capturó IRL. Los campos 22 (corrección)
  y 28 (aporte voluntario) permanecen sin candidato: no existe fuente congelada
  que permita confirmar su valor.
- La regla `AT2_V30_NO_EVENT_NOVELTY_FIELDS_V1` es versionada. El informe API/web
  expone candidatos y pendientes por campo y empleados afectados. Un evento,
  novedad, lista ausente o período incompleto mantiene los campos dependientes
  sin candidato.
- AT2 v30 pp. 88–89 y 98–102 define los valores vacíos; la descarga continúa
  deshabilitada, la validación local sigue siendo parcial y no se afirma
  compatibilidad con operador. El trabajo está en la rama
  `codex/goal02-pila-empty-novelty-fields`, apilada sobre #202.

### Campos vacíos fijos para dependientes estándar — 2026-10-31

- Para una afiliación dependiente `01`/`00`, el mapper deja en blanco los
  destinos de traslado 32 y 34, que AT2 v30 asigna vacíos, y los campos 74/75
  de cotizante principal, que solo se reportan para tipo 40.
- La ausencia de eventos no es requisito para estos candidatos: el valor vacío
  proviene de la regla de aplicabilidad de AT2 y del tipo de cotizante congelado.
  Una afiliación ausente o fuera del MVP deja los cuatro campos pendientes.
- Las reglas `AT2_V30_NO_TRANSFER_DESTINATION_FIELDS_V1` y
  `AT2_V30_NON_COTIZANTE40_PRINCIPAL_FIELDS_V1` quedan versionadas. El informe
  API/web expone estados por campo; las pruebas del serializador verifican sus
  espacios de longitud fija. No se habilita descarga ni se declara aceptación
  de operador.
- Fuente: AT2 v30 pp. 90 y 95–96. El trabajo continúa en la rama
  `codex/goal02-pila-dependent-empty-fields`, apilada sobre la rama de #203.

### Campo 76 de exoneración explícita — 2026-10-31

- Para la afiliación dependiente `01`/`00`, se propone `N` solo si los dos
  valores del empleador congelado (`aportesExonerados` y
  `aportesExoneradosConfirmado`) son explícitamente `false`.
- Si falta la confirmación, existe contradicción o ambos valores son `true`, el
  campo queda pendiente. No se infiere elegibilidad individual para la
  exoneración positiva.
- La regla `AT2_V30_CONFIRMED_NON_EXEMPT_COTIZANTE_V1` queda versionada y el
  panel API/web informa candidatos y pendientes por empleado. El cambio no
  habilita descarga.
- Fuente: AT2 v30 p. 97; ADR-013 mantiene el uso exclusivo de snapshots
  aprobados y limita el MVP a dependientes estándar. Trabajo apilado sobre #204
  en `codex/goal02-pila-non-exempt-cotizante-field`.

### Campos ESAP/MEN 70–73 para empleador privado — 2026-10-31

- AT2 v30 pp. 163–164 establece que el campo 70 aplica a aportantes de
  naturaleza pública reportados por ESAP y permite tarifa cero cuando el
  cotizante no está obligado. El campo 72 aplica solo a aportantes de naturaleza
  pública y permite cero cuando el cotizante no está obligado. Los valores 71 y
  73 se validan contra el IBC 95 multiplicado por su tarifa.
- La regla `AT2_V30_PRIVATE_EMPLOYER_NO_ESAP_MEN_V1` propone 70/72 como
  `0.00000` para empleadores privados tipo 1 con dependiente `01`/`00`. Propone
  71/73 en cero solo cuando el snapshot incluye un IBC 95 válido. Empleadores
  públicos, naturaleza desconocida y otros tipos permanecen pendientes.
- El informe API/web muestra candidatos y pendientes por campo. No se habilita
  descarga ni se declara compatibilidad de operador.
- Fuentes primarias: [AT2 v30, Ministerio de Salud](https://www.minsalud.gov.co/sites/rid/Lists/BibliotecaDigital/RIDE/DE/OT/anexo-tecnico2-cotizantes.pdf), pp. 163–164; [Ley 21 de 1982, Gestor Normativo de Función Pública](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=4827), arts. 8, 11 y 12. Trabajo apilado sobre #205 en `codex/goal02-pila-private-esap-men-fields`.

### Aportes voluntarios de pensión y subcuentas FSP pendientes — 2026-10-31

- El preflight ahora muestra los campos 48, 49, 51, 52 y 53 como pendientes
  por empleado con la causa correspondiente. Los campos voluntarios requieren
  afiliación pensional y una declaración enlazada al campo 28; el campo 53
  también requiere una fuente aprobada para validar la diferencia de retención.
- Payroll conserva el FSP como concepto agregado. AT2 exige distinguir las
  subcuentas y validar la base pensional acumulada por cotizante y su régimen;
  no se distribuye ni calcula un importe desde la nómina actual.
- No se infiere cero ni se habilita la descarga. Las reglas de producto y las
  fuentes de entrada quedan pendientes antes de implementar el mapeo.
- Fuente: AT2 v30 pp. 155–159 y ADR-013. Trabajo apilado sobre #206 en
  `codex/goal02-pila-pension-fields-pending-report`.

### Salud estándar candidata AT2 — 2026-10-31

- La regla versionada `CO_HEALTH_STANDARD_RATE_L1122_ART10_V1` conserva la
  tarifa estándar de 12,5 %: 4 % del trabajador (`SALUD_EMP`) y 8,5 % del
  empleador (`SALUD_PAT`), conforme a la Ley 1122 de 2007, art. 10.
- El mapper solo expone campos 54/55 para empleador privado tipo 1, dependiente
  01/00 de mes completo, ubicación nacional expresamente confirmada,
  no exoneración expresa y coherente y snapshot completo sin novedades ni
  eventos PILA. Ambos conceptos deben ser únicos, tener su factor esperado y
  una base igual al IBC 43 congelado. Los importes se copian del snapshot; cada
  uno y su suma deben cumplir el redondeo PILA para el 12,5 %. No se calcula ni
  se sustituye ningún valor.
- Sin confirmación de no exoneración, con exoneración, trabajador en el
  exterior, empleador público, período parcial o fuentes discrepantes, ambos
  campos permanecen pendientes. El candidato decimal `0.12500` ocupa N7, pero
  el formato vigente y la aceptación siguen pendientes de prueba por operador.
  El archivo continúa deshabilitado.

### Tarifa inicial ARL candidata AT2 — 2026-10-31

- La tabla versionada `CO_ARL_INITIAL_RATE_DEC1772_ART13_V1` aplica desde
  1994-08-05 y conserva las tarifas iniciales oficiales de clases I–V. El
  mapeo exige que la asignación ARL tenant-safe vigente corresponda a la clase
  afiliada y que el factor ARL del snapshot aprobado coincida exactamente con
  esa tabla.
- El campo 61 se representa como fracción decimal de nueve caracteres, con
  ceros a la derecha; por ejemplo, clase I es `0.0052200`. AT2 v30, pp. 94 y
  160; Resolución 2634 de 2014, art. 7.
- Los campos 63/65/67/69 conservan el importe aprobado de Payroll solo como
  candidato si ya coincide con la regla versionada
  `CO_PILA_CONTRIBUTION_ROUND_UP_100_DEC1990_ART3_2_1_5_V1`, vigente desde
  2016-12-06. La comparación usa aritmética entera exacta; no redondea ni
  reemplaza snapshots. Para 65/67/69, el factor decimal debe poder expresarse
  como razón entera sin pérdida. Si no coincide, el campo queda sin resolver.
  La regla sigue sin habilitar el archivo; otros aportes aún requieren validar
  su normativa.

### Tarifa CCF estándar candidata AT2 — 2026-10-31

- El campo 64 usa `CO_CCF_STANDARD_RATE_L21_ART11_12_V1` (4 %, Ley 21 de
  1982, arts. 11–12) solo para dependientes 01/00 de mes completo, aportante
  empleador tipo 1, clase A/B y declaración explícita de que no aplica el
  beneficio CCF de Ley 1429. Exige un concepto único `CAJA` congelado con
  factor 4 % y base igual al IBC CCF del mismo snapshot.
- La cadena candidata `0.04000` ocupa las siete posiciones del campo 64. AT2
  v30 p. 95 confirma longitud N7 y p. 161 exige la tarifa legal vigente. Esa
  página no documenta la convención decimal; `0.04000` sigue la convención de
  Resolución 1747/2008, art. 19, hoy derogada, por lo que el formato actual y
  su aceptación requieren carga de prueba por operador. No se habilita descarga.
- Campo 65 conserva solo el valor aprobado de `CAJA` cuando su factor/base
  coinciden y el importe ya satisface el redondeo PILA versionado. Clases C/D,
  beneficio verdadero o sin declarar, ausencia de concepto y discrepancias
  dejan ambos campos bloqueados; la ausencia no se convierte en tarifa cero.
- Las pruebas cubren clases A/B, declaraciones ausentes o positivas, tarifa y
  base no coincidentes, encoding de siete posiciones y candidatos no
  habilitantes. No se afirma compatibilidad con ningún operador.
- Fuentes: [Ley 21 de 1982](https://www1.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=4827),
  arts. 11–12; [Resolución 1747 de 2008](https://www.minsalud.gov.co/sites/rid/Lists/BibliotecaDigital/RIDE/DE/DIJ/Resolucion-1747-de-2008.pdf),
  art. 19 (ejemplo histórico `0.04000`); y [Resolución 2388 de
  2016](https://www.minsalud.gov.co/sites/rid/Lists/BibliotecaDigital/RIDE/DE/DIJ/resolucion-2388-2016.pdf),
  que derogó la Resolución 1747.

### Tarifas estándar SENA e ICBF candidatas AT2 — 2026-10-31

- Los campos 66/68 usan las reglas versionadas `CO_SENA_STANDARD_RATE_L21_ART12_V1`
  (2 %) y `CO_ICBF_STANDARD_RATE_L89_ART1_V1` (3 %). El alcance candidato se
  limita a empleador privado tipo 1, clase A/B, dependiente 01/00 de mes
  completo, declaración negativa explícita de Ley 1429 y declaración coherente
  de no exoneración entre política y perfil PILA.
- La fuente única `SENA`/`ICBF` del snapshot debe conservar el factor legal y
  una base igual al campo 95. Los campos 67/69 mantienen el importe aprobado
  solo si ya satisface el redondeo PILA versionado; nunca se calcula ni
  reemplaza el valor.
- `0.02000` y `0.03000` son las convenciones decimales históricas de campo de
  la Resolución 1747/2008, art. 19, hoy derogada. El AT2 v30 confirma el ancho
  N7 y las reglas de campo, pero se requiere carga de prueba para validar el
  formato vigente en cada operador.
- Si el empleador declara exoneración, estos candidatos permanecen bloqueados
  incluso para un empleado de salario alto: el mapper todavía no valida el
  umbral individual del artículo 114-1 del Estatuto Tributario. Tampoco admite
  clases C/D, empleadores no privados, beneficios especiales o ceros por
  ausencia. No se habilita la descarga.
- Las pruebas cubren tarifa/factor/base, empleador, naturaleza, clase,
  beneficio, exoneración, ancho decimal y redondeo; no acreditan compatibilidad
  con operador.
- Fuentes: [Ley 21 de 1982, art. 12](https://www1.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=4827),
  [Ley 89 de 1988, art. 1](https://www.icbf.gov.co/sites/default/files/ley_89_de_1988.pdf),
  y el ejemplo histórico de campos decimales en el art. 19 de la
  [Resolución 1747 de 2008](https://www.minsalud.gov.co/sites/rid/Lists/BibliotecaDigital/RIDE/DE/DIJ/Resolucion-1747-de-2008.pdf),
  derogada por la [Resolución 2388 de 2016](https://www.minsalud.gov.co/sites/rid/Lists/BibliotecaDigital/RIDE/DE/DIJ/resolucion-2388-2016.pdf).

### Declaraciones PILA por tipo de documento — 2026-10-31

- La continuación sobre la cadena #191 agrega a la afiliación con vigencia las
  declaraciones booleanas de AT2 v30: exención pensional extranjera para CE/PA
  y residencia exterior para CC/TI. La captura web y la API exigen el dato
  aplicable en nuevas afiliaciones y rechazan declaraciones incompatibles con
  el tipo de documento.
- La migración es aditiva: no convierte datos heredados ni modifica
  afiliaciones existentes; las declaraciones históricas permanecen nulas y
  bloquean el campo hasta que exista evidencia nueva versionada. Payroll las
  copia al snapshot aprobado y el mapeo candidato traduce `true` a `X` y
  `false` a campo en blanco. Un valor contradictorio también bloquea.
- Este paso no habilita el archivo PILA ni declara compatibilidad con
  operadores. Se mantienen las reglas y exclusiones vigentes del MVP.

### Prima de diciembre — decisión de alcance del MVP — 2026-10-31

- Artículo 306 CST confirma pago de la segunda mitad dentro de los primeros
  veinte días de diciembre y reconocimiento por semestre trabajado o tiempo
  proporcional. La Corte Suprema describe las primas de junio y diciembre como
  semestres de calendario. Las fuentes oficiales consultadas no resuelven una
  regla general para fijar, antes del pago, el corte de servicio y la base
  variable hasta el 31 de diciembre. La sentencia SL4089-2022 cita un acuerdo
  particular que usa el 30 de noviembre; no se extrapola como regla general.
- **Decisión actual:** el MVP de prima solo habilita enero–junio. El segundo
  semestre permanece excluido hasta revisión laboral que apruebe corte, base
  y eventual ajuste. El código ya bloquea ese semestre y no genera proyección
  ni PDF definitivo.
- La revisión laboral independiente continúa pendiente antes de liquidaciones
  operativas o pagos reales; excluir el semestre no elimina el derecho ni la
  obligación legal. Ver ADR-012 y sus fuentes oficiales para el alcance y los
  límites de esta decisión.
