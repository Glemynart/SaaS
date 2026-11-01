# Backlog de GOAL-02 — Evolución Financiera y Cumplimiento Electrónico

Actualizado: 2026-10-31. GOAL-02 es el único Goal activo; GOAL-01 está pausado,
no cerrado. Este backlog conserva el resultado completo de GOAL-02 y prioriza
primero flujos financieros internos que puedan mostrarse a futuros clientes.

## M0 — Flujos financieros internos demostrables

| Prioridad | Estado                 | Iniciativa                                                                                        | Criterios de aceptación                                                                                                                                                                                           | Dependencias y riesgo                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------- | ---------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P0        | COMPLETADO             | Validar que cada producto de una factura pertenezca al tenant activo y esté disponible.           | La API acepta productos activos del mismo tenant, rechaza IDs ajenos, inexistentes o inactivos sin crear la factura, conserva líneas manuales y tiene pruebas de regresión.                                       | Implementado y probado en el PR #151 (`3a8e1c4`); CI y Browser E2E verdes antes del merge. Sin migración; el filtro tenant-aware reduce riesgo de aislamiento multiempresa.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| P1        | PENDIENTE              | Conectar la emisión interna de facturas con el Ledger.                                            | Un acto interno genera un comprobante balanceado e idempotente con tercero, período y origen trazables; anular/corregir conserva evidencia y usa reversión del Ledger.                                            | ADR-011 se fusionó como propuesta en #154; aprobación de Producto y Contabilidad sigue pendiente. Antes de implementar deben definirse snapshots tributarios por línea y vínculo tenant-safe Customer–Tercero; riesgo financiero alto.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| P1        | EN CURSO               | Verificar de extremo a extremo la causación de nómina en el Ledger desde la UI.                   | Un período aprobado conserva su snapshot, crea una causación una sola vez, muestra el comprobante y soporta la corrección definida por el dominio. La UI y el escenario E2E financiero están integrados.          | #152, #153 y #156 están fusionadas; CI y Browser E2E pasaron. Falta demostrar el recorrido completo con una nómina representativa antes de cerrar P1.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| P1        | EN CURSO               | Preparar un escenario financiero reproducible con datos sintéticos para demo.                     | Un tenant explícitamente de demostración carga clientes, productos, facturas internas, nómina, centro de costo, tercero y causación balanceada; la carga es idempotente, tenant-scoped y se verifica desde la UI. | El seed idempotente y su Browser E2E se fusionaron en #157 con CI, E2E y Preview verdes. No está verificado el recorrido con una ejecución del seed en el tenant demo. La factura interna todavía no causa en Ledger ni transmite a DIAN.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| P1        | PROTOTIPO              | Liquidar prima semestral de empleados activos por lote y generar un comprobante PDF por empleado. | Preview muestra períodos y conceptos fuente, base, días y fórmula; aprobación congela snapshots y correcciones; PDF inmutable queda vinculado al Expediente e idempotente ante reintentos.                        | PR #159 se fusionó como `400c562`; CI, Browser E2E y Vercel pasaron. Migraciones probadas en PostgreSQL desechable, no en demo/staging/producción. Casos ambiguos se bloquean. Revisión laboral independiente antes del uso operativo; pagos, Tesorería y Ledger fuera.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| P1        | EN CURSO (EXPORTACIÓN) | Estructurar afiliaciones/novedades y exportar aportes de nómina a PILA.                           | Afiliaciones con vigencia alimentan archivos tipo 1 y 2; validación local, aceptación del operador, liquidación y pago son estados separados; compatibilidad se prueba operador por operador.                     | ADR-013 aprobada con cambios; PR #160 conserva afiliaciones con auditoría e aislamiento tenant, pero aún no valida catálogos ni genera archivos. AT2 v30 oficial (24-07-2026; 336 páginas) define tipo 1 de 567 caracteres, encabezado 01 de 359 y detalle 02 de 693. La auditoría de esta rama mapea sus campos a fuentes candidatas, datos faltantes y valores asignados al operador; no es fixture ni autoriza serializar. PR #162 capturó la fecha prevista de pago de aportes y se fusionó en main como a459683 tras superar CI, Browser E2E y Vercel Preview. La preparación del snapshot agrega un payload PILA separado con empresa, empleado, contrato, sede, afiliaciones históricas del período, novedades, salario básico, tipo salarial, IBC por subsistema cuando existe un concepto fuente inequívoco y días cotizados por subsistema solo para dependientes tipo 01 sin subtipo, con mes calendario completo y cobertura completa de empleado, contrato y afiliación; los demás días quedan nulos con códigos de bloqueo. PR #163 se fusionó en main como beccd57e; añade captura de eventos PILA desde el detalle del período (búsqueda de empleado, alta/baja tenant-scoped en BORRADOR y validación de fechas/días); al calcular, los congela en cada snapshot y bloquea días sin segmentación aprobada. Liquidación y edición bloquean la fila del período y vuelven a leer eventos dentro de la transacción para evitar snapshots incompletos por concurrencia. PR #164 se fusionó en main como 1460262; agrega un informe preliminar de brechas visible en el detalle de períodos aprobados/causados: lee únicamente snapshots del mismo tenant, agrupa campos pendientes conocidos y muestra empleados afectados. No completa datos desde maestros actuales; `archivoGenerable` permanece `false` y `estadoArchivo` `NO_IMPLEMENTADO`. El informe no es un preflight normativo completo: sin brechas detectadas no prueba que el período pueda exportarse. Aún faltan segmentación PILA de novedades, validar catálogos y bases conforme a normas, actividad y centro ARL, reglas completas de vigencia, preflight normativo, serializador, fixtures normativos revisados y pruebas de carga por operador. Dependientes estándar solamente; sin cotizante 75, transmisión ni pago. |

La siguiente decisión preparatoria queda en [ADR-014](../adr/ADR-014-pila-work-center-and-activity-source.md): conservar el centro asignado por la ARL y la actividad económica de riesgos con vigencias por empleado, sin inferirlos de la sede ni de datos actuales. La propuesta está pendiente de aprobación antes de implementar ese modelo. La captura de eventos PILA queda ligada al período indicado en el formulario; un
intervalo que se extienda a otro período no se replica automáticamente. La UI
lo advierte y los casos entre períodos siguen bloqueados para exportación hasta
definir y probar cómo se conservan y aprueban en cada planilla afectada.
Se añadió y ejecutó localmente un Browser E2E con PostgreSQL 16 desechable y
puertos aislados; pasó el registro, la creación de sede y empleado, captura de
una incapacidad, persistencia tras recarga y eliminación. La aplicación de 73
migraciones descubrió un nombre de tabla incorrecto en el FK de eventos; se
corrigió a `empleados` y la migración completa pasó en limpio. El contenedor de
prueba se detuvo y no se usaron datos de demo/staging/producción. Esta preparación aún no tiene PR ni checks remotos.

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
  se revalidó el 2026-10-31: la descarga directa del enlace a
  `anexo-tecnico2-cotizantes.pdf` identifica AT2 v30, fechado 2026-07-24
  (336 páginas; SHA-256
  `BBB3C2D0486FD7D3934BD640D8E68C60D33686B1604E8EFAA980139FB5686D33`), e
  incluye la Resolución 1529 de 2026 entre los actos incorporados. La
  [Resolución 1529 de
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

## Estado de Goal y dependencias de entrega — 2026-10-31 (actualizado tras #162)

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
  La PR #167 amplía el Browser E2E a 100 empleados: tras aprobar el
  lote, cortó la conexión del navegador, confirmó el estado `PROCESANDO` sin
  conexión y verificó que el worker terminara, publicara los 100 PDFs en
  Expediente y permitiera descargarlos después de reconectar. La versión
  previa duró 39,5 s en PostgreSQL 16 desechable; esta PR añade la aserción de
  estado mientras el navegador está desconectado.
  #167 continúa a continuación de la cadena PILA abierta.
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
  cambio dentro del período no es segmentable y debe bloquearse. Con AT2 v30,
  captura 30 días
  independientes para los cuatro subsistemas
  solo en un mes calendario completo, con empleado, contrato y afiliación que
  cubren todo el período, cotizante 01 sin subtipo y sin novedades; si falta
  una condición, conserva null y códigos de bloqueo. Esto es preparación de
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
- La relectura del AT2 v30 (pp. 91–94 y 103–104) confirmó una brecha que debe
  guiar el siguiente incremento: tipo 2 exige cuatro conteos independientes
  de días (pensión, salud, riesgos, CCF) y cuatro bases (salario básico e IBC
  por subsistema); el Payroll actual conserva un solo IBC y las novedades no
  tienen intervalos PILA. AT2 permite más de un detalle 02 por persona en
  casos definidos de ingreso/retiro o cambio de IBC y asigna al aportante el
  cálculo de IBC ante novedades concurrentes. No iniciar el serializador con
  un IBC/días generales repetidos: primero congelar segmentos, bases y días
  autorizados por Payroll, con fixtures y valores esperados revisados.
- AT2 v30 también exige el campo 95 (IBC de otros parafiscales) para cotizante 01. La [Ley 21 de 1982, artículo 17](https://www.funcionpublica.gov.co/eva/gestornormativo/norma_pdf.php?i=4827)
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
  No hay serializador ni archivo utilizable por clientes.
- **Primer operador candidato para pruebas PILA:** SOI, planilla E, por su
  documentación de cargue de archivos planos de empresa y autocorrector para
  errores del archivo. Es una decisión de planificación, no compatibilidad
  verificada: no hay carga real ni evidencia de aceptación; eso requiere
  acceso de prueba al aportante y resultado del portal.
- No se ejecutó el seed financiero ni se accedió a staging, producción, VPS u
  OCI; no se transmitió información a DIAN/UGPP.

### Continuación de PILA — 2026-11-01

- PR #163 (`beccd57e`), #164 (`1460262`) y #165 (`907f727`) se auditaron y
  fusionaron en ese orden después de pasar CI, Browser E2E y Vercel.
- En el informe preliminar de PR #164, el perfil del aportante ya conservaba
  la respuesta sobre acciones especiales y su clase. La auditoría detectó que
  no se bloqueaban acciones declaradas o sin confirmar, clases A/B sin
  contrastar el total de cotizantes, ni clases C/D sin evidencia de elegibilidad.
  PR #166 incorpora bloqueos para los campos 26, 7, 33, 34 y 76, conteos A/B y
  consistencia con Ley 1429, sin declarar el archivo generable ni ampliar el MVP.
- ADR-014 permanece propuesta y pendiente de decisión. La implementación de
  los campos 62 y 98 espera esa aprobación; la preparación independiente del
  resto de AT2 continúa.
