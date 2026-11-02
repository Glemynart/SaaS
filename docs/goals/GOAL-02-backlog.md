# Backlog de GOAL-02 — Evolución Financiera y Cumplimiento Electrónico

Actualizado: 2026-11-02. GOAL-02 es el único Goal activo; GOAL-01 está pausado,
no cerrado. Este backlog conserva el resultado completo de GOAL-02 y prioriza
primero flujos financieros internos que puedan mostrarse a futuros clientes.

## M0 — Flujos financieros internos demostrables

| Prioridad | Estado                 | Iniciativa                                                                                        | Criterios de aceptación                                                                                                                                                                                                                                       | Dependencias y riesgo                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --------- | ---------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0        | COMPLETADO             | Validar que cada producto de una factura pertenezca al tenant activo y esté disponible.           | La API acepta productos activos del mismo tenant, rechaza IDs ajenos, inexistentes o inactivos sin crear la factura, conserva líneas manuales y tiene pruebas de regresión.                                                                                   | Implementado y probado en el PR #151 (`3a8e1c4`); CI y Browser E2E verdes antes del merge. Sin migración; el filtro tenant-aware reduce riesgo de aislamiento multiempresa.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| P1        | EN CURSO               | Conectar la emisión interna de facturas con el Ledger para demo.                                  | Emitir una factura interna válida crea factura y comprobante balanceado/idempotente en una transacción tenant-scoped, con tercero, período, origen y snapshots tributarios; cancelar conserva motivo y auditoría y revierte por Ledger cuando existe asiento. | PR #179 implementa el flujo interno, incluida asociación explícita Customer–Tercero por tenant/NIT, tasas/impuesto congelados y reversión auditable. No crea reverso para facturas históricas sin asiento. Migración no aplicada fuera de pruebas; no incluye DIAN, cartera ni pagos, y requiere revisión contable-fiscal antes de operación real.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| P1        | EN CURSO               | Verificar de extremo a extremo la causación de nómina en el Ledger desde la UI.                   | Un período aprobado conserva su snapshot, crea una causación una sola vez, muestra el comprobante y soporta la corrección definida por el dominio. La UI y el escenario E2E financiero están integrados.                                                      | #152, #153 y #156 están fusionadas; CI y Browser E2E pasaron. Falta demostrar el recorrido completo con una nómina representativa antes de cerrar P1.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| P1        | EN CURSO               | Preparar un escenario financiero reproducible con datos sintéticos para demo.                     | Un tenant explícitamente de demostración carga clientes, productos, facturas internas, nómina, centro de costo, tercero y causación balanceada; la carga es idempotente, tenant-scoped y se verifica desde la UI.                                             | El seed idempotente y su Browser E2E se fusionaron en #157 con CI, E2E y Preview verdes. No está verificado el recorrido con una ejecución del seed en el tenant demo. La factura interna todavía no causa en Ledger ni transmite a DIAN.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| P1        | PROTOTIPO              | Liquidar prima semestral de empleados activos por lote y generar un comprobante PDF por empleado. | Preview muestra períodos y conceptos fuente, base, días y fórmula; aprobación congela snapshots y correcciones; PDF inmutable queda vinculado al Expediente e idempotente ante reintentos.                                                                    | PR #159 se fusionó como `400c562`; CI, Browser E2E y Vercel pasaron. Migraciones probadas en PostgreSQL desechable, no en demo/staging/producción. Casos ambiguos se bloquean. Revisión laboral independiente antes del uso operativo; pagos, Tesorería y Ledger fuera.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| P1        | EN CURSO (EXPORTACIÓN) | Estructurar afiliaciones/novedades y exportar aportes de nómina a PILA.                           | Afiliaciones con vigencia alimentan archivos tipo 1 y 2; validación local, aceptación del operador, liquidación y pago son estados separados; compatibilidad se prueba operador por operador.                                                                 | ADR-013 aprobada con cambios. AT2 v30 oficial (24-07-2026; 336 páginas) define tipo 1 de 567 caracteres, encabezado 01 de 359 y detalle 02 de 693. PR #162 capturó fecha prevista de pago de aportes y se fusionó como a459683. La preparación congela empresa, empleado, contrato, sede, afiliaciones, novedades, salario, tipo salarial, IBC por subsistema cuando hay una fuente inequívoca y días de cotización solo en condiciones admitidas; valores no demostrables quedan bloqueados. PR #163 (beccd57e) agregó captura auditable de eventos y bloquea días sin segmentación aprobada. PR #164 (1460262) agregó un informe preliminar por snapshot del mismo tenant. PR #169 (7d30bdc) agregó centros ARL y asignaciones de actividad con vigencia, tenant-safe, historial auditado y snapshot PILA v2 sin backfill. PR #170 añade brechas por evento/campo y detecta listas de eventos ausentes, malformadas o divergentes; mantiene archivoGenerable=false, estadoArchivo=NO_IMPLEMENTADO y un estado normativo pendiente mientras no se complete la reconciliación. Sigue sin ser un preflight normativo completo ni generar archivos. Faltan segmentación de novedades; validación de catálogos, bases y vigencias; integrar la primitiva en la composición completa del archivo; fixtures normativos revisados y pruebas por operador. MVP: dependientes estándar; sin cotizante 75, transmisión ni pago. |

La decisión de [ADR-014](../adr/ADR-014-pila-work-center-and-activity-source.md)
fue aceptada. PR #169 (`7d30bdc`) se fusionó con captura de centros ARL y
actividades de riesgo por empleado, asociación opcional con sede, vigencias
auditadas, snapshot PILA v2 y sin backfill. Su Browser E2E cubre el alta,
persistencia y cierre de vigencia; las migraciones se aplicaron en PostgreSQL
16 desechable, sin usar tenants ni entornos reales.

PR #170 presenta en el detalle del período un informe preliminar construido
solo desde snapshots del tenant. Mapea cada evento conocido a sus campos AT2,
bloquea datos no segmentados y detecta listas de eventos ausentes, malformadas
o divergentes entre las copias del snapshot. No calcula Payroll/IBC, mantiene
`archivoGenerable: false` y `estadoArchivo: NO_IMPLEMENTADO`, y expone
`formatVersion: null` con `RECONCILIATION_PENDING` porque la reconciliación
completa de norma y campos sigue pendiente. La página presenta el resultado
como preparación preliminar, no como validación completa para exportar.

El formato de captura de afiliaciones queda versionado por separado de la
versión normativa. La migración de PR #170 actualiza solo los metadatos de
captura, sin renombrar la columna heredada ni reescribir snapshots históricos;
el CI/E2E sincronizado debe aplicar la migración en una base desechable antes
del merge. La captura de eventos
PILA sigue ligada al período indicado; un intervalo que cruce períodos no se
replica automáticamente y queda bloqueado hasta definir y probar cómo se
aprueba en cada planilla afectada. La migración de PR #169 se aplicó con las 73
anteriores en PostgreSQL 16 desechable. No se ejecutó rollback destructivo ni
se accedió a demo, staging o producción.

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
  La PR #167 se fusionó en `main` (`8a38006`) y amplió el Browser E2E a 100
  empleados: desconecta el navegador tras aprobar, confirma `PROCESANDO` sin
  conexión, espera los 100 PDFs en Expediente y valida una descarga al volver.
  La PR #168 muestra el avance acumulado, pendientes y errores y verifica la
  barra accesible 100/100 al reconectar. Los checks de #168 deben ejecutarse
  sobre esta rama sincronizada antes del merge.
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
  no cubre todos los campos obligatorios, no compone ni valida archivos tipo
  1/2 y aún no constituye una capacidad utilizable por clientes.
- La relectura del AT2 v30 (pp. 91–94 y 103–104) confirmó una brecha que debe
  guiar el siguiente incremento: tipo 2 exige cuatro conteos independientes
  de días (pensión, salud, riesgos, CCF) y cuatro bases (salario básico e IBC
  por subsistema); el Payroll actual conserva un solo IBC y las novedades no
  tienen intervalos PILA. AT2 permite más de un detalle 02 por persona en
  casos definidos de ingreso/retiro o cambio de IBC y asigna al aportante el
  cálculo de IBC ante novedades concurrentes. No iniciar la composición del archivo con
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
  La primitiva de formato existe, pero aún no hay un exportador PILA completo ni archivos utilizables por clientes.
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
- PR #167 (`8a38006`) se fusionó después de probar el procesamiento en segundo
  plano con 100 empleados y pérdida de conexión del navegador. PR #168
  (`5b17004`) se fusionó tras añadir y probar el avance de documentos
  publicados, pendientes y con error.
- La implementación de PR #169 agrega centros declarados a la ARL y
  asignaciones fechadas de actividad económica por empleado, con sede
  opcional, historial auditado, aislamiento por tenant y sin inferir datos de
  campos heredados. La migración no hace backfill; `pilaPayload` v2 congela
  centro, actividad, vigencias y versión normativa y mantiene lectura de
  snapshots v1. La captura valida solapamientos, afiliación ARL y clase de
  riesgo.
- El catálogo versionado incluye 1.018 códigos extraídos del anexo del Decreto
  768/2022; se registra el hash del PDF y se omiten descripciones no verificadas.
  El E2E cubre alta de centro, asignación, persistencia y cierre de vigencia.
  Siguen pendientes una revisión funcional de Nómina con constancias
  anonimizadas y confirmar el formato del campo 62 con AT2 y operadores. Esta
  capacidad aún no serializa ni transmite archivos PILA.
- PR #170 distingue códigos de evento conocidos, códigos fuera del MVP y
  payloads v2 sin lista válida o con copias divergentes. Cada bloqueo apunta al
  campo AT2 correspondiente. El informe de eventos no confirma la norma
  completa y conserva el archivo como no implementado; segmentación de días e
  IBC y fixtures normativos revisados siguen pendientes.

- PR #173 agrega una prueba unitaria de recuperación del trabajador de prima
  después de que vence su lease: cuando ya existe el PDF, el worker publica el
  artefacto existente y completa el lote sin volver a renderizarlo. La prueba
  simula la interrupción y recuperación; no equivale a una prueba de reinicio
  real del proceso ni a aceptación end-to-end.
- PR #174 amplía el preflight PILA con límites de campos numéricos de nueve
  posiciones y longitudes/caracteres AT2 para identificaciones, nombres, datos
  del aportante y representante. Los excedentes bloquean sin truncarse y las
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

### Contabilización interna y fecha de factura — 2026-10-31

- PR #179 conecta la emisión interna con un comprobante Ledger balanceado dentro de la transacción, vincula Customer con un tercero NIT activo del tenant, congela datos de identidad e impuesto por línea y registra cancelaciones con motivo y auditoría. La reversión se realiza por Ledger cuando existe asiento; facturas históricas sin asiento no reciben reverso inventado. Esto es facturación interna para demo, no facturación electrónica DIAN ni validación fiscal.
- La auditoría corrigió la selección del período contable en el límite del mes: la fecha `DATE` se calcula con el calendario de `America/Bogota`, mientras Invoice conserva su instante de emisión. La prueba cubre 31 de octubre a las 21:30 de Bogotá, que ya corresponde al 1 de noviembre UTC.
- La migración no se aplicó a bases de usuario, demo, staging o producción.

### Primitiva de layout AT2 v30 — 2026-11-01

- PR #180 incorpora layouts de caracteres de ancho fijo para tipo 1 (34
  campos/567 posiciones), encabezado tipo 2 (22/359) y detalle tipo 2 (98/693),
  cotejados con AT2 v30 oficial (24-07-2026). La prueba mantiene las firmas por
  campo, conteos y longitudes.
- El formateador aplica relleno normativo y exige decisión explícita para valores vacíos. La auditoría agregó el rechazo de espacios para campos numéricos; los vacíos numéricos se rellenan con ceros y los alfanuméricos con espacios.
- Es solo una primitiva: no mapea PayrollSnapshot, valida reglas laborales, codifica bytes, compone o descarga archivos ni demuestra aceptación de un operador. `archivoGenerable` continúa en `false` hasta completar preflight, fixtures normativos y pruebas por operador.

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
  API, ESLint, Prettier y `git diff --check`. Tras sincronizar el PR con `main`
  en `553b90b`, CI, Browser E2E (24/24) y Vercel Preview pasaron. Las corridas
  del head anterior fallaron antes de iniciar los jobs por el límite de Actions,
  sin evaluar el código.

### Revalidación del PR #181 — 2026-11-02

- Después del plazo de 24 horas, un despliegue manual Preview del HEAD
  `a4f123f93cfda6e545f46f70159a7f39cb41f93e` terminó `READY`; no se desplegó a
  staging ni producción. El build de Next.js compiló correctamente.
- Ese despliegue manual no actualizó el estado Vercel asociado al commit en
  GitHub. El commit de documentación `1769198` disparó un nuevo despliegue por
  la integración GitHub–Vercel; `Vercel`, `verify` y `browser` pasaron. Tras la
  auditoría, PR #181 se fusionó en `main` como `e0dc459`.

### Disponibilidad e integridad del preflight PILA — 2026-10-31

- PR #182 expone en la pantalla de nómina la diferencia entre layout AT2 v30,
  generación de archivo (`NOT_IMPLEMENTED`), validación local (`PRELIMINARY`)
  y aceptación por operador (`NOT_VERIFIED`), con bloqueos y evidencia por
  campo. El informe no habilita descargas ni compatibilidad.
- El preflight ahora bloquea filas malformadas de afiliación, centro de trabajo
  y actividad económica en lugar de descartarlas antes de validar. Tampoco
  oculta la ausencia o inconsistencia de la fecha prevista de pago: usa solo la
  fecha congelada en snapshots aprobados y bloquea si falta o difiere.
- La sede operativa y su municipio DIVIPOLA no prueban la ubicación laboral
  PILA de los campos 9–10 del AT2. PR #182 los bloquea hasta contar con una
  fuente PILA explícita, confirmada y congelada; el archivo sigue sin generarse.

- ADR-015 fue aprobada el 2026-11-02: ubicación laboral PILA histórica por
  empleado, independiente de la sede y del centro ARL, con vigencias y auditoría,
  congelada en el snapshot de nómina. El MVP bloquea campos 9–10 si no hay una
  sola ubicación que cubra todo el período; no hay backfill ni exportación,
  transmisión o compatibilidad con operadores.

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
  PILA (CABECERA_TIPO_2 en el preflight). Ahora valida ese límite sin truncar ni inferir su
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
