# Backlog de GOAL-02 — Evolución Financiera y Cumplimiento Electrónico

Actualizado: 2026-11-05. GOAL-02 es el único Goal activo; GOAL-01 está pausado,
no cerrado. Este backlog conserva el resultado completo de GOAL-02 y prioriza
primero flujos financieros internos que puedan mostrarse a futuros clientes.

## Estado vigente — 2026-11-05

- PR #278 se fusionó en main como 0aae82938fe430e258f35861eec944e59a5bde32 y PR #279 como 1b31782257313cc08f150e2f1024df88fe405562. Los checks post-merge de CI, Browser E2E y publicación de la imagen API pasaron en ambos.
- PR #278 compone localmente archivos AT2 v30 tipo 1 y tipo 2 desde snapshots aprobados; PR #279 añade generación autenticada tenant-scoped, historial append-only, almacenamiento privado, SHA-256, versionamiento, auditoría y descarga protegida. La nueva prueba de navegador de esta continuación cubre generación, persistencia, reintento idempotente y descarga de ambos archivos desde la interfaz.
- PR #283 se fusionó en `main` como `541e7306ffa573ff99bf26c953382d3bf60f1d7d`; CI, Browser E2E, Vercel Production y publicación de imagen API terminaron en verde. En el momento de la verificación, Secret Scanning y Dependabot no mostraban alertas abiertas ni alertas altas, respectivamente.
- PR #284 se fusionó en `main` como `65a85dc5d02e0bb7e05b91412ce3ed79cded114e`; CI, Browser E2E, Vercel Production y publicación de imagen API terminaron en verde. Añade el puerto interno de facturación electrónica y su fake de contrato; no transmite ni persiste documentos fiscales.
- PR #285 se fusionó en `main` como `adec87e993e27d56da117a5fb250082ff1e163bf`; CI, Browser E2E y publicación de imagen API posteriores quedaron en verde. Completa el dominio fiscal persistente y sus líneas snapshot con RLS; no agrega endpoints, emisión ni transmisión.
- PR #290 se fusionó en `main` como `7021af8902fb0a10fa2454bb7d1ffb35c6975aae`; CI y Browser E2E posteriores pasaron. Añade descarga CSV de los reportes contables según filtros: página visible en informes paginados y resultado completo en balances/estados financieros.
- PR #291 se fusionó en `main` como `6496dccc86cd2cd10c17d5c3dfcc20866b64606a`; los checks post-merge de CI, Browser E2E y publicación de imagen API pasaron.
- PR #291 añade persistencia tenant-scoped de eventos, intentos, resultados, transiciones y evidencia privada de factura electrónica, con historial append-only, checksum y RLS. El servicio aún no se conecta a endpoint, worker, interfaz ni adaptador real; no transmite ni declara aceptación DIAN.
- PR #293 se fusionó en `main` como `0193594ee45229652b987bebafbe277ca51dbc63`. `PRIMA_SEMESTRAL_V2` usa los importes de auxilio congelados en snapshots mensuales aprobados, bloquea valores sobre el máximo proporcional o que cruzan meses sin poder atribuirse, y persiste la versión de fórmula; V1 y sus PDFs históricos no se recalculan. Los checks del PR fueron verdes; CI y publicación de imagen post-merge pasaron, y Browser E2E seguía en ejecución al actualizar este registro.
- El resultado LOCAL_VALIDATED acredita layout, longitud y codificación comprobados localmente. No acredita revisión normativa completa, aceptación del operador, liquidación ni pago.
- Los escenarios dependientes estándar 01/00 se habilitan solo si el preflight no detecta brechas. Novedades que requieran segmentación, casos especiales y correcciones aprobadas continúan bloqueando la generación.

## Estado de main al iniciar esta iniciativa — 2026-11-04

- PR #251–#269 se fusionaron secuencialmente en `main`. El HEAD verificado es
  `e6fb110a69fe90dc148d5139cbb59b1a511c62ca`; CI, Browser E2E y publicación de
  imagen API post-merge pasaron.
- `main` conserva en snapshots PILA v7 el estado histórico S/N del campo 5 y el
  preflight muestra un resumen del estado histórico usando solo snapshots
  aprobados. El resumen no cambia los demás bloqueos ni habilita el archivo.
  Los candidatos 51/52 aplican la regla anterior hasta antes de 2027-04-01, bajo
  las guardas de fuente, cotizante, período y conciliación; no se compone ni
  descarga el archivo.
- PR #256 amplió el seed financiero local con un recaudo sintético aplicado a
  dos facturas emitidas del mismo cliente; Browser E2E verifica la distribución,
  los saldos derivados y el comprobante de ingreso. PR #257 añadió al dashboard
  total emitido, recaudo aplicado y cartera pendiente derivados de facturas y
  aplicaciones activas. Los checks pre y post-merge pasaron. El seed solo admite
  bases locales de desarrollo/test y conserva la idempotencia tenant-scoped.

## M0 — Flujos financieros internos demostrables

| Prioridad | Estado                                                                 | Iniciativa                                                                                        | Criterios de aceptación                                                                                                                                                                                                                                                                                                            | Dependencias y riesgo                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0        | COMPLETADO                                                             | Validar que cada producto de una factura pertenezca al tenant activo y esté disponible.           | La API acepta productos activos del mismo tenant, rechaza IDs ajenos, inexistentes o inactivos sin crear la factura, conserva líneas manuales y tiene pruebas de regresión.                                                                                                                                                        | Implementado y probado en el PR #151 (`3a8e1c4`); CI y Browser E2E verdes antes del merge. Sin migración; el filtro tenant-aware reduce riesgo de aislamiento multiempresa.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| P1        | IMPLEMENTADO PARA DEMO; VALIDACIÓN CONTABLE-FISCAL OPERATIVA PENDIENTE | Conectar la emisión interna de facturas con el Ledger para demo.                                  | Emitir una factura interna válida crea factura y comprobante balanceado/idempotente en una transacción tenant-scoped, con tercero, período, origen y snapshots tributarios; cancelar conserva motivo y auditoría y revierte por Ledger cuando existe asiento.                                                                      | PR #179 implementa el flujo interno, incluida asociación explícita Customer–Tercero por tenant/NIT, tasas/impuesto congelados y reversión auditable. No crea reverso para facturas históricas sin asiento. Migración no aplicada fuera de pruebas; no incluye DIAN, cartera ni pagos, y requiere revisión contable-fiscal antes de operación real.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| P1        | IMPLEMENTADO PARA DEMO; VALIDACIÓN OPERATIVA PENDIENTE                 | Verificar de extremo a extremo la causación de nómina en el Ledger desde la UI.                   | Un período aprobado conserva su snapshot, crea una causación una sola vez, muestra el comprobante y soporta la corrección definida por el dominio. La UI y el escenario E2E financiero están integrados.                                                                                                                           | #152, #153 y #156 están fusionadas; el E2E ahora crea un período, calcula la nómina del empleado sintético desde su contrato, la envía a revisión, la aprueba, verifica el snapshot y causa el Ledger desde la UI. El caso confirma asiento balanceado, comprobante visible e idempotencia del reintento; la corrección sigue cubierta por el escenario dedicado. Los parámetros y datos son fixtures controlados, no una nómina operativa ni validación laboral.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| P1        | EJECUTADO EN TENANT DEMO LOCAL — 2026-11-05                            | Preparar un escenario financiero reproducible con datos sintéticos para demo.                     | Un tenant explícitamente de demostración carga clientes, productos, facturas internas, nómina, centro de costo, tercero y causación balanceada; la carga es idempotente, tenant-scoped y se verifica desde la UI.                                                                                                                  | El seed idempotente y su Browser E2E se fusionaron en #157 con CI, E2E y Preview verdes. #179 integra emisión y contabilización de facturas nuevas mediante BillingService y #208 permite consultar comprobantes. #216 emite dos facturas mediante el mismo BillingService y mantiene una tercera en borrador: las emitidas crean comprobantes balanceados en Ledger dentro de la transacción; la borrador no crea asiento. El Browser E2E verifica ahora desde Contabilidad el comprobante de la factura emitida, sus cuentas de cartera/ingreso/IVA y el balance débito-crédito, además de la causación de nómina. El recorrido valida terceros tenant-scoped, idempotencia y resultado en UI. El seed crea ahora una tercera factura emitida para el primer cliente y un segundo recaudo distribuido entre dos facturas de ese cliente; el Browser E2E verifica ambos saldos y el comprobante CI balanceado. La ejecución local se completó tras aplicar las 26 migraciones pendientes: el tenant demo ya tenía 100 empleados y el seed añadió una persona financiera sintética con identidad DEMO-FIN-EMP-001, 2 clientes, 3 productos, 4 facturas internas (3 emitidas y 1 en borrador), 2 recaudos y un período de nómina causado con comprobante balanceado. La repetición creó cero registros duplicados. No transmite a DIAN ni representa pagos u operación laboral real. |
| P1        | FUNCIONAL PARA DEMO; REVISIÓN LABORAL OPERATIVA PENDIENTE              | Liquidar prima semestral de empleados activos por lote y generar un comprobante PDF por empleado. | Preview muestra fuentes, bases, días y fórmula; aprobación congela snapshots y correcciones; PDFs inmutables quedan vinculados al Expediente e idempotentes ante reintentos.                                                                                                                                                       | PR #159 y las pruebas Browser E2E actuales cubren el lote de 100 empleados, corrección aprobada, 100 PDFs publicados, hashes y descarga pese a perder conexión del navegador. El MVP sigue limitado a enero–junio; el segundo semestre está deshabilitado hasta resolver el corte de diciembre. La revisión laboral independiente sigue pendiente para uso operativo; pagos, Tesorería y Ledger están fuera.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| P1        | IMPLEMENTADA PARA ESCENARIOS SOPORTADOS; PRUEBA POR OPERADOR PENDIENTE | Estructurar afiliaciones/novedades y exportar aportes de nómina a PILA.                           | Generar y descargar archivos tipo 1/2 desde snapshots aprobados; conservar tenant, período, actor, snapshots fuente, reglas/versiones y hashes; exigir permisos, auditoría, idempotencia, verificación de integridad y bloqueo ante brechas. Distinguir generación, validación local, aceptación del operador, liquidación y pago. | ADR-013 aprobada con cambios. PR #278 implementa composición local y PR #279 persiste el historial append-only con archivos privados, hashes, versionamiento y descargas protegidas. Esta PR verifica el recorrido exitoso por interfaz, persistencia, idempotencia y bytes descargados. Solo casos dependientes 01/00 completos; correcciones aprobadas y brechas bloquean. Ningún operador ha sido probado; sin transmisión, planilla N, cotizante 75 ni pago.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

### Exportación CSV de reportes contables — PR #290 integrado

- Los reportes se consultan desde el Ledger con filtros tenant-scoped y son de
  solo lectura. Esta mejora descarga el resultado presentado en la interfaz:
  para informes paginados, únicamente la página actualmente cargada; para
  balances y estados financieros, el resultado completo de la consulta.
- El archivo usa punto y coma como separador y coma decimal para Excel en
  configuración regional colombiana. Los campos de texto se entrecomillan,
  se escapan comillas y se antepone un apóstrofo a valores que podrían
  interpretarse como fórmulas.
- No consulta movimientos adicionales ni modifica el Ledger. El Browser E2E
  verifica la descarga y sus datos; CI y Browser E2E post-merge pasaron.

### Persistencia de intentos de factura electrónica — PR #291 fusionado

- El servicio en `main` registra identidad de evento y payload antes de
  cualquier llamada externa, crea
  intentos numerados y conserva resultados y transiciones append-only.
- Las tablas tienen RLS y claves foráneas compuestas tenant-scoped. La evidencia
  normalizada se almacena mediante `StorageService` con key tenant-scoped,
  límite de tamaño, MIME permitido y SHA-256; aceptación o rechazo solo cambia
  el estado fiscal terminal cuando existe la evidencia requerida.
- El servicio permite reintentar un fallo técnico únicamente si el proveedor
  confirmó que no recibió el envío; un intento interrumpido o ambiguo exige
  conciliación. No hay endpoint, worker, interfaz ni adaptador MATIAS, y el
  servicio todavía no hace llamadas externas. Esta base no es una capacidad de
  facturación electrónica utilizable por clientes ni demuestra conformidad o
  aceptación de DIAN.
- La siguiente integración sigue pendiente de validar el contrato del proveedor
  en sandbox. Antes de transmisión real faltan resolución segura de credenciales
  por tenant, endpoint/worker conectados, operación observable y pruebas de
  sandbox.

### Antecedente FSP y checks del PR #250 — 2026-11-03

- La auditoría detectó que AT2 v30 diferencia el destino de los campos 51/52
  según estado de afiliación pensional S/N para períodos desde 2025-07-01,
  pero el snapshot v6 de `main` no conserva ese dato. Esta rama lo congela en
  v7 cuando una afiliación única cubre todo el período. El preflight y el
  mapper bloquean esos importes desde 2025-07-01, incluso con S/N capturado o
  cuando un snapshot previo los marca `READY`; no se
  infiere el estado desde el fondo ni desde la declaración de fuente única.
- CI y Browser E2E de #250 pasaron; Vercel Preview terminó en verde después de
  liberarse el límite de cuota.
  #250 ya está integrado en `main`; ese no es el bloqueo vigente.

### Captura histórica del estado pensional para FSP — 2026-11-03

> Esta sección registra la conclusión vigente al 2026-11-03. Su bloqueo general
> desde 2025-07-01 fue supersedido por la revisión normativa del 2026-11-04,
> documentada abajo; se conserva como historial de la decisión y del PR #254.

- La rama `codex/goal02-pila-fsp-affiliation-status`, basada en `main` con
  #250 fusionada, agrega el campo S/N nullable a la historia tenant-scoped de
  afiliaciones. El dato se captura en alta manual, afiliación inicial e
  importación Excel; no se deduce desde el nombre del fondo ni se completa en
  filas históricas. Las importaciones anteriores sin esa columna se aceptan;
  si una afiliación existente coincide en los demás datos, conserva el estado
  ya capturado en vez de borrarlo.
- Los snapshots PILA nuevos pasan a v7 y congelan el estado solo si una única
  afiliación cubre todo el período. La revisión de fuentes oficiales encontró
  que la Circular 028/2025 suspendió ajustes de la Resolución 467 relacionados
  con la Ley 2381 salvo excepciones, y que C-264/2026 fijó el 2027-04-01 para
  las disposiciones exequibles del sistema nuevo, condicionando otras a
  subsanación. La conclusión de esa revisión fue bloquear 51/52 desde
  2025-07-01 incluso con S/N capturado; esa conclusión quedó supersedida por la
  revisión oficial del 2026-11-04. Los snapshots v1–v6 no se reescriben.
- La migración es aditiva: agrega una columna nullable y una restricción S/N,
  sin backfill. Tras almacenar afiliaciones/snapshots financieros no se debe
  revertir borrando la columna; corregir hacia adelante conserva la evidencia.
  Esta captura no habilita serialización ni descarga: el preflight continúa con
  `archivoGenerable=false` y `estadoArchivo=NO_IMPLEMENTADO`.
- Fuentes normativas: [Resolución 0467 de 2025](https://www.minsalud.gov.co/sites/rid/Lists/BibliotecaDigital/RIDE/DE/DIJ/resolucion-0467-de-2025.pdf), [Circular Externa 028 de 2025](https://www.minsalud.gov.co/Normatividad_Nuevo/Circular%20Externa%20No%20028%20de%202025.pdf) y [Sentencia C-264 de 2026](https://www.corteconstitucional.gov.co/relatoria/2026/C-264-26.htm). La interpretación del estado operativo post-suspensión sigue pendiente; no se infiere a partir del estado S/N.

### Continuación PILA: serialización segura y revisión normativa — 2026-11-04

> La decisión de bloqueo descrita en esta captura quedó supersedida por la
> corrección del 2026-11-04 más abajo; se mantiene aquí como registro histórico.

- Los PR #264–#267 están integrados en `main` (`511f4e8`). #264 permite el
  blanco de diez posiciones del campo 9 únicamente para encabezados de planilla
  E; #265 rechaza serializar candidatos con campos no resueltos o incompletos;
  #266 y #267 corrigen la guía de snapshots aceptados y el rango de versiones
  mostrado en errores de ubicación laboral. CI, Browser E2E y publicación de
  imagen API post-merge pasaron. No se compone ni descarga un archivo.
- Revisión normativa hecha el 2026-11-04: la Circular Externa 028/2025 enumera
  los ajustes de la Resolución 467 que continúan implementándose; los campos
  FSP 51/52 no aparecen en esa lista. La Sentencia C-264/2026 fija el
  2027-04-01 para las disposiciones de la Ley 2381 declaradas exequibles y
  condiciona otras al trámite de subsanación, pero no dicta una regla PILA
  específica para esos campos. La Resolución 1529/2026 modifica los anexos
  PILA por otros cambios; su referencia al “cotizante 51” es un código de tipo
  de cotizante y no resuelve los campos 51/52 de subcuentas FSP. A la fecha de
  revisión no se encontró una instrucción oficial posterior que reconcilie el
  tratamiento ni la fecha de aplicación de esos campos.
- Se mantiene el bloqueo conservador desde 2025-07-01, incluso con estado S/N
  capturado: esa captura ya no es la brecha pendiente; sigue faltando una regla
  operativa oficialmente reconciliada y versionada para el período. La
  conclusión es una protección del producto ante evidencia incompleta, no una
  determinación de que los aportes estén prohibidos. Para levantarla se requiere
  evidencia oficial específica para las fechas/campos afectados; cualquier
  declaración de compatibilidad seguirá requiriendo pruebas del operador.
- Fuentes revisadas: [Circular Externa 028/2025](https://www.minsalud.gov.co/Normatividad_Nuevo/Circular%20Externa%20No%20028%20de%202025.pdf), [Sentencia C-264/2026](https://www.corteconstitucional.gov.co/relatoria/2026/C-264-26.htm), [Resolución 1529/2026](https://normativa.colpensiones.gov.co/colpensiones/compilacion/docs/resolucion_minsaludps_1529_2026.htm) y [página oficial PILA de MinSalud](https://www.minsalud.gov.co/Proteccion-Social/Paginas/pila.aspx).

### Corrección normativa de los candidatos FSP 51/52 — 2026-11-04

- **Hechos oficiales actualizados:** la Circular 028/2025 suspendió los
  ajustes de Resolución 467 vinculados a Ley 2381 salvo una lista explícita
  que no incluye 51/52. La compilación vigente de Resolución 2388 marca
  suspendidas las modificaciones 467/2025 a esos campos y remite al texto
  anterior. C-264/2026 dispone vigencia desde 2027-04-01 para los artículos
  exequibles y condiciona otros al trámite de subsanación.
- **Interpretación delimitada:** conservar la regla anterior FSP para
  períodos y pagos anteriores a 2027-04-01. El snapshot S/N queda como
  evidencia histórica; no se usa para enrutar la regla anterior. La fecha de
  corte se deriva de la vigencia diferida del sistema, no de una instrucción
  PILA específica de C-264. Desde el corte se bloquea hasta versionar la regla
  aplicable.
- **Corrección local en la rama aislada:** se retiró el bloqueo general desde
  2025-07-01 de la evaluación FSP y el mapper 51/52. Persisten las guardas de
  alcance de fuente única, dependiente 01/00, mes completo, días aprobados,
  ausencia de novedades/eventos sin segmentar, fecha de pago previa al corte,
  redondeo y conciliación exacta con FSP. Los históricos no se completan ni se
  reescriben.
- **Estado general:** el preflight puede presentar estos dos candidatos para
  los casos soportados; `archivoGenerable=false`, no hay composición/descarga,
  y no se declara aceptación, liquidación o pago por operador. Siguen
  pendientes campos con fuente ausente, segmentación de novedades, fixtures
  integrales y carga de prueba por cada operador.
- Ver [ADR-013](../adr/ADR-013-pila-standard-file-export.md) y la [matriz de
  aceptación](../research/pila/AT2-V30-MVP-ACCEPTANCE-MATRIX.md) para fuentes,
  reglas y casos. La revisión oficial consultó además la [compilación vigente
  de Resolución 2388](https://normativa.colpensiones.gov.co/compilacion/docs/resolucion_minsaludps_2388_2016.htm).

### Prima de servicios: revisión oficial del segundo semestre — 2026-11-04

- El artículo 306 CST vigente fija el pago hasta el 30 de junio y dentro de
  los primeros veinte días de diciembre, y reconoce el semestre trabajado o el
  tiempo proporcional. La jurisprudencia constitucional previa describe los
  semestres de calendario. La LegalApp de MinJusticia, consultada nuevamente
  el 2026-11-04 (artículo fechado en 2018), describe la fórmula proporcional
  `días trabajados en el semestre × medio salario / 180` y aclara que
  incapacidad y licencia de maternidad no reducen días porque el contrato no
  se suspende.
- Esa fórmula general no define cómo fijar antes del día 20 de diciembre la
  base variable y los días 21–31 de un semestre que termina el 31 de diciembre,
  ni cómo ajustar después del pago. No se extrapola el corte de un acuerdo
  colectivo particular.
- **Decisión:** mantener julio–diciembre bloqueado para no emitir una
  liquidación operativa con proyección no validada. No cambia la demo aprobada
  de enero–junio; no crea pagos ni asientos. Fuentes: [CST compilado, art.
  306](https://normativa.colpensiones.gov.co/colpens/compilacion/docs/codigo_sustantivo_trabajo.htm),
  [Sentencia C-871/2014](https://www.corteconstitucional.gov.co/relatoria/2014/C-871-14.htm)
  y [LegalApp de MinJusticia](https://www.minjusticia.gov.co/programas-co/LegalApp/Paginas/Que-es-la-prima-de-servicios-y-que-hacer-si-no-se-reconoce-o-paga.aspx).

### Bloqueo de integración — PR #251

- Verificado el 2026-11-03: CI (`verify`) y Browser E2E están verdes; el check
  Vercel falla con `upgradeToPro=build-rate-limit` y GitHub informa
  `mergeStateStatus=UNSTABLE`. Es un límite externo de builds, no una falla
  atribuible al código. Hasta que se resuelva no se fusiona ni se actualiza otro
  PR fuera de orden; GOAL-02 puede avanzar en trabajo local independiente.

### Rechazo de snapshot PILA v3 en candidatos de aportante y encabezado — 2026-11-03

- El generador actual `buildPilaSourceSnapshot` conserva `schemaVersion: 3` al
  congelar ubicación laboral. El preflight y el mapper de detalle ya aceptaban
  v3, pero los mappers del aportante tipo 1 y encabezado tipo 2 solo aceptaban
  v2; por eso esos candidatos quedaban sin soporte para los snapshots actuales.
- PR #243 se fusionó en `main` como `e5d760b`. Admite v2/v3 únicamente cuando
  `payloadVersion` coincide con `schemaVersion`, y agrega pruebas del candidato
  unitario, agregado y el informe de preparación con ubicación laboral v3.
  También corrige en la matriz el estado real de la cobertura de mes completo
  y las versiones aceptadas por los mappers.
- Verificación local: 187 pruebas focalizadas de API pasaron (3 suites). El
  cambio solo restaura candidatos desde fuentes ya congeladas; no habilita
  serialización, descarga, aceptación de operadores ni compatibilidad. El
  preflight permanece `archivoGenerable=false` y `estadoArchivo=NO_IMPLEMENTADO`.
- CI, Browser E2E y Vercel Preview del PR pasaron antes del merge; los checks
  post-merge de CI, Browser E2E y publicación de la imagen API también pasaron.

### Snapshot PILA v4 con parámetros de cálculo Payroll congelados — 2026-11-03

- La rama `codex/goal02-pila-export-readiness-20261103` incrementa el payload
  independiente PILA a v4. Los snapshots nuevos copian el ID del parámetro
  legal, SMMLV y tramos FSP desde el trace de cálculo de la nómina aprobada;
  no vuelven a calcular ni presentan esos tramos como reglas normativas PILA.
- Preflight y mappers aceptan snapshots v2/v3/v4 solo si `payloadVersion` y
  `schemaVersion` coinciden. Los históricos no se reescriben. El cambio no
  habilita campos 51/52, composición ni descarga.
- Verificación local: typecheck API y 445 pruebas en 6 suites de snapshot,
  servicio, preparación y mappers pasaron. Pendiente: auditoría del diff, PR y
  checks remotos.

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

### Consulta del Ledger en el recorrido financiero de demo — 2026-10-31

- En `main`, la pantalla Contabilidad → Comprobantes informaba que no tenía
  consulta ni detalle, aunque `ReportingService` ya exponía el Libro Diario
  tenant-scoped con movimientos y nombres de cuentas.
- La rama `codex/goal02-accounting-voucher-query` agrega una lista paginada de
  comprobantes contabilizados y el detalle de sus líneas a esa pantalla,
  reutilizando el endpoint de reportes existente; no agrega escrituras,
  migraciones ni modifica el Ledger.
- El escenario Browser E2E financiero extiende la prueba de nómina para abrir
  el comprobante causado, revisar sus cuentas y confirmar que débitos y créditos
  se conservan junto al snapshot aprobado. Desde #179, la factura interna nueva
  también se contabiliza al emitirla, según ADR-011 aceptada para demo; #208
  permite consultar comprobantes de nómina y facturación. La revisión
  contable-fiscal operativa y la integración DIAN continúan fuera de alcance.

## H1 — Fundación de integraciones regulatorias

| Prioridad | Estado      | Iniciativa                                                                 | Criterios de aceptación                                                                                                                        | Dependencias y riesgo                                                                                                                                                           |
| --------- | ----------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1        | EN PROGRESO | Aprobar modelo de eventos, evidencia, secretos y adaptadores regulatorios. | ADRs cubren idempotencia, estados, correcciones, retención, permisos, auditoría y cambio de proveedor; proveedor fake con pruebas de contrato. | PR #291 completa la persistencia de intentos/evidencia; faltan cliente/proveedor sandbox confirmado, secretos por tenant, endpoint/worker conectado y observabilidad operativa. |

### Contrato inicial de adaptadores regulatorios — 2026-11-05

- ADR-020 acepta un contrato interno específico para facturación electrónica,
  derivado de ADR-005. El puerto usa tenant, factura, evento estable, clave
  idempotente, hash y versión de payload; normaliza resultados a `ACCEPTED`,
  `REJECTED`, `PENDING` o `UNKNOWN`. Una corrección usa evento nuevo y un
  resultado ambiguo requiere conciliación antes de retransmitir.
- El test fake verifica reintento idempotente, conflicto por reutilizar una
  clave con otro contenido/evento, aislamiento entre tenants, identidad distinta
  para correcciones, conciliación y fallo cerrado. La prueba no acredita
  aceptación DIAN ni compatibilidad de proveedor.
- Revisión de ADR-SEC-001 acotada a H1: sus reglas de aislamiento, auditoría,
  secretos y observabilidad son requisitos de diseño, pero el documento sigue
  propuesto y no demuestra que esos controles estén implementados. No se
  acepta la arquitectura general ni se atribuye una garantía de producción.
- En el `main` base `65a85dc`, H1 seguía incompleto: el agregado fiscal y los
  intentos aún no se persistían, y las credenciales no se resolvían por tenant.
  La variable `MATIAS_API_KEY` permanece sin consumidor; no se usa como
  credencial de emisor ni se realiza una llamada externa. PR13 de PR10 requiere
  validar sandbox antes de un adaptador MATIAS real.

### Dominio fiscal base — PR #285 fusionado en `main`

- El siguiente incremento implementa el primer modelo fiscal persistente,
  separado de `Billing.Invoice`, con líneas snapshot, moneda COP, índices por
  tenant y políticas PostgreSQL RLS. No migra ni reinterpreta facturas internas.
- El snapshot canónico v1 valida identidad básica, fecha, cantidades, importes
  exactos y conciliación aritmética. No calcula ni declara reglas tributarias
  DIAN: esas reglas requieren su propia revisión normativa.
- La migración exige moneda COP, consistencia de totales y numeración antes de
  entrar en procesamiento; triggers congelan cambios y borrado directo del
  documento/líneas después de numerar. La FK compuesta evita adjuntar una línea
  de otro tenant; las pruebas RLS cubren lecturas anidadas, inserciones
  cruzadas y operaciones sin contexto.
- El borrado administrativo de un tenant aún usa la cascada existente; su
  retención y borrado fiscal requieren decisión legal antes de producción, como
  ya establece ADR-005.
- La máquina de estados expresa las transiciones admitidas por ADR-005 y solo
  acepta/rechaza si el caso de uso declara que la evidencia ya se persistió;
  los resultados ambiguos siguen en conciliación. El caso de uso todavía no
  está conectado a endpoints, UI, transmisiones ni proveedor externo.
- Las 89 migraciones se aplicaron en una base PostgreSQL temporal vacía; las
  13 pruebas focalizadas, el typecheck, ESLint y build API pasaron. La base
  temporal se eliminó al terminar.
- PR11 completó el agregado persistente, PR12 quedó integrado en PR #286 y
  PR #291 añadió intentos/evidencia durables. H1 sigue abierto: faltan validar
  el contrato del proveedor en sandbox, credenciales tenant-scoped,
  endpoint/worker conectado y operación observable.

### Emisor y numeración — PR12 completado en PR #286

- El perfil deriva razón social, NIT, dirección, municipio y contacto de
  `Tenant`, evitando duplicar la identidad fiscal. Solo conserva por separado
  las responsabilidades tributarias declaradas por el ADMIN y el ambiente.
- El rango registra la autorización, fecha, vigencia, prefijo de hasta cuatro
  caracteres alfanuméricos y límites numéricos. La validación local no declara
  habilitación DIAN ni aceptación de operador.
- El consecutivo se avanza de forma atómica, tenant-scoped y dentro de una
  transacción ya abierta; la futura emisión debe guardar en esa misma
  transacción la factura snapshot y la transmisión. No hay endpoint para
  consumir números de forma aislada.
- Los rangos conservan historial: sus términos no se editan ni se borran; solo
  pueden inactivarse con motivo auditado. La configuración está disponible
  únicamente para ADMIN y no transmite documentos.
- La migración es aditiva y no reinterpreta facturas internas. Una vez que un
  tenant registre autorizaciones o consuma consecutivos, no se deben borrar las
  tablas ni retroceder numeradores en una reversión; los ajustes posteriores
  deben ser migraciones correctivas hacia adelante.
- La rama candidata validó las 90 migraciones en PostgreSQL temporal; pasan las
  143 suites API (1.833 pruebas), typecheck y build de API/web, ESLint de los
  archivos del cambio, `prisma validate` y el E2E de navegador de configuración
  (1/1). Las bases temporales se eliminaron después de cada ejecución. Esta
  validación local no equivale a los checks de GitHub ni a aceptación DIAN.
- Tras el merge de PR #286, CI, Browser E2E, publicación de imagen API y Vercel
  terminaron en verde sobre `2983eb54a3566645f2d9d83b347c2b3d46b5ff9e`.
- La pantalla y el dominio configuran emisor y rangos; no generan ni transmiten
  documentos. El siguiente hito de la secuencia es validar el contrato real de
  MATIAS en sandbox (PR13), antes del adaptador.

### Preparación de validación MATIAS sandbox — 2026-11-05

- La [guía oficial de Quickstart sandbox](https://docs.matias-api.com/docs/sandbox/quickstart/)
  indica que el entorno es gratuito y no requiere contrato, pero exige una
  cuenta independiente, verificación del correo, inicio de sesión y creación de
  un PAT. La URL publicada es `https://sandbox-api.matias-api.com/api/ubl2.1`;
  las credenciales de producción y sandbox son independientes.
- La guía documenta `POST /invoice`, consultas de estado y simulación de
  rechazos/timeout mediante `X-Sandbox-Force-Status`; todas las respuestas
  sandbox declaran `X-MATIAS-Environment: sandbox`. La [referencia oficial de
  respuestas](https://docs.matias-api.com/docs/response-json/) distingue el
  HTTP del resultado DIAN (`response.IsValid`/`StatusCode`) y advierte consultar
  el estado antes de retransmitir ante timeout o `DOCUMENT_POSSIBLY_SENT`. El
  proveedor describe la respuesta sandbox como simulada; no es aceptación de
  DIAN ni prueba de carga de un operador.
- **Corrección de evidencia al 2026-11-05:** la documentación oficial actual
  recomienda un `uuid` estable para el documento y dice que el mismo número con
  el mismo `uuid` puede reintentarse sin crear otro documento; reutilizarlo para
  otro documento causa conflicto. Por tanto, la afirmación anterior de que las
  páginas revisadas no describían idempotencia quedó desactualizada. Esto es un
  hecho publicado por MATIAS, aún no una conducta verificada mediante llamada
  de sandbox ni una garantía suficiente para omitir la conciliación interna.
- La respuesta de emisión puede ser HTTP 200 con rechazo DIAN; la clasificación
  debe leer `response.IsValid` y `StatusCode`. Para `DOCUMENT_POSSIBLY_SENT`, la
  guía indica consultar estado antes de retransmitir. `StatusCode 98` es
  procesamiento transitorio. No se debe tratar `success: true` como aceptación
  DIAN.
- Se incorporó
  [`MATIAS-SANDBOX-ACCEPTANCE-CHECKLIST.md`](../research/electronic-invoicing/MATIAS-SANDBOX-ACCEPTANCE-CHECKLIST.md)
  con casos de aceptación para host, PAT, respuesta aceptada/rechazada,
  timeout, conciliación, UUID repetido/colisionado y evidencia privada.
- No se registró una cuenta ni se hicieron llamadas al sandbox en esta tarea.
  PR13 necesita una cuenta sandbox con correo verificado y un PAT guardado
  fuera del repositorio para ejecutar la matriz contractual con datos
  sintéticos: autenticación, emisión aceptada, rechazo, timeout ambiguo,
  consulta de estado, descarga de evidencia y comportamiento ante número
  repetido. Se debe registrar request/response sin credenciales y verificar
  que ninguna llamada use el host de producción.
- **GOAL ACTIVO:** GOAL-02. **IMPLEMENTACIÓN BLOQUEADA:** el adaptador MATIAS
  real sigue condicionado a la cuenta verificada, el PAT y la ejecución de la
  matriz sandbox; no hay prueba de aceptación de proveedor. **ARQUITECTURA
  DISPONIBLE:** ADR-020 y la matriz documentada permiten avanzar en el diseño y
  en otros flujos internos; el sandbox no transmite a DIAN y no acredita
  operación productiva.

## H2/H3 — Cumplimiento electrónico

| Prioridad | Estado    | Iniciativa                                                | Criterios de aceptación                                                                                                                      | Dependencias y riesgo                                                                       |
| --------- | --------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| P2        | PENDIENTE | Facturación electrónica DIAN por proveedor especializado. | Factura fiscal trazable desde Invoice, intentos idempotentes, estados normalizados, rechazo/contingencia y evidencia verificable en sandbox. | H1, ADR fiscal, proveedor, sandbox y custodia de certificados; riesgo normativo alto.       |
| P2        | PENDIENTE | Nómina electrónica derivada de PayrollSnapshot.           | Una nómina aprobada produce un evento inmutable, con rechazo/reintento/corrección y evidencia vinculada al período y al empleado.            | H1, reglas vigentes, proveedor, sandbox, seguridad y ADR de eventos; riesgo normativo alto. |

## H4 — Operación financiera ampliada

| Prioridad | Estado                                                 | Iniciativa                        | Criterios de aceptación                                                                                                    | Dependencias y riesgo                                                 |
| --------- | ------------------------------------------------------ | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| P2        | IMPLEMENTADA PARA DEMO; VALIDACIÓN OPERATIVA PENDIENTE | Cartera y aplicación de recaudos. | Saldos, vencimientos, pagos parciales y aplicación contra facturas se derivan de hechos trazables y cuadran con el Ledger. | Facturación estable, tercero canónico y caso comercial verificable.   |
| P2        | PENDIENTE                                              | Tesorería y conciliación.         | Obligaciones y pagos se concilian con extractos para un banco/flujo concreto con auditoría e idempotencia.                 | Necesidad real de cliente, Cartera/Payroll/Compras y datos bancarios. |
| P3        | PENDIENTE                                              | Compras y cuentas por pagar.      | Proveedor, obligación, soporte, causación y pago se rastrean hasta el Ledger.                                              | Tercero canónico, aprobaciones y necesidades de proveedor.            |
| P3        | PENDIENTE                                              | Reportes financieros integrados.  | Los reportes se calculan desde fuentes completas; cualquier cobertura parcial se identifica claramente.                    | H4.1–H4.3 o fuentes equivalentes ya verificadas.                      |

### Cartera y aplicación de recaudos — 2026-11-03

- ADR-019 fue aceptada por delegación explícita de Producto. Define recaudos
  recibidos en COP aplicados a facturas internas emitidas, vencimiento explícito
  para facturas nuevas, saldo derivado desde aplicaciones activas y reversión
  append-only con comprobante de Ledger.
- La implementación candidata agrega el formulario de recaudo al detalle de la
  factura y la consulta de vencido/al día al listado. El Browser E2E en
  PostgreSQL 16 desechable verificó emisión y asiento, abono parcial, repetición
  idempotente, bloqueo de cancelación, reversión y dos solicitudes concurrentes
  donde solo una pudo aplicar al saldo disponible. No acredita aceptación
  operativa de un cliente ni revisión contable-fiscal.
- La migración habilita y fuerza RLS para recaudos, aplicaciones y reversos. La
  suite PostgreSQL verifica con un rol `NOSUPERUSER NOBYPASSRLS` que cada tenant
  vea únicamente sus filas y que las consultas sin contexto de tenant no
  devuelvan registros. El cálculo de saldo ejecuta bajo `TenantPrismaService`.
- Quedan fuera: recaudos no aplicados, anticipos, devoluciones, conciliación
  bancaria, transmisión DIAN, manejo de intereses y operación de tesorería. La
  versión inicial de la captura aplica el recaudo a una factura por vez; la API
  admite varias facturas del mismo cliente en una solicitud. La ampliación de
  interfaz descrita abajo está en una rama candidata y aún no acredita uso en
  `main`.
- La migración es aditiva y conserva las facturas históricas sin vencimiento.
  Una vez existan recaudos reales no debe revertirse eliminando esas tablas; se
  debe corregir hacia adelante para preservar evidencia financiera.
- El `prisma migrate diff` posterior a aplicar las 82 migraciones en PostgreSQL
  16 no reporta diferencias en las tablas nuevas de recaudos. Sí muestra
  diferencias heredadas en nombres de índices/restricciones de Expediente,
  prima y generación de documentos, además de la FK de plantilla del lote de
  contratos. No se modifican en esta entrega; se deben auditar por separado
  antes de diseñar una migración que dependa de esos objetos.
- Validación local actual: 30 pruebas de Billing/autorización, 11 pruebas RLS,
  typechecks API/web, builds API/web y Browser E2E financiero (1/1) pasan.

### Reparto de recaudos y cartera en demo — estado actualizado 2026-11-04

- PR #251 fusionó en `main` la captura multi-factura desde una factura: consulta
  facturas pendientes del mismo cliente y tenant, limita la selección a facturas
  emitidas con comprobante activo de Ledger, y deriva el saldo desde aplicaciones
  de recaudos vigentes.
- El operador distribuye el valor recibido entre una o más facturas; el total
  se deriva de los importes en centavos, se limita a 100 facturas y debe coincidir
  con la suma de aplicaciones que valida el servicio existente. La UI rechaza
  valores que no pueda representar exactamente en centavos.
- El historial identifica todas las facturas afectadas. Como el servicio solo
  soporta reversar el recaudo completo, la UI lo confirma explícitamente y
  presenta el total y las facturas antes de pedir el motivo.
- PR #256 amplió el seed local y su Browser E2E para mostrar un recaudo aplicado
  a dos facturas, saldos resultantes y comprobante CI balanceado. La extensión
  no agregó migraciones y mantiene el seed restringido a bases locales de
  desarrollo/test. Sus checks pre-merge y post-merge pasaron.
- La aceptación operativa de un cliente sigue pendiente. Esta capacidad no añade
  anticipos, pagos sin aplicar, reversos parciales ni conciliación bancaria.

### Resumen de cartera en el dashboard de Facturación — 2026-11-04

- El dashboard presenta total emitido, recaudo aplicado y cartera pendiente,
  calculados en una consulta tenant-scoped desde facturas emitidas y aplicaciones
  activas. Las aplicaciones reversadas quedan excluidas; la cartera se deriva
  como emitido menos aplicado, sin persistir un saldo mutable.
- El Browser E2E del seed financiero verifica los totales desde la UI con la
  demo multi-factura. El recaudo refleja aplicaciones internas y no representa
  conciliación bancaria.

## Evidencia inicial (corte 2026-10-29) y límites vigentes

- El corte inicial de `main` en `be14542b` contenía Billing sin posteo al
  Ledger. Esa evidencia es histórica: los PR #179, #216 y #217 integraron la
  emisión interna, su causación/reversión y el escenario sintético de demo;
  #208 añadió consulta de comprobantes. La tabla superior registra el estado
  actual y la aceptación operativa del tenant demo sigue pendiente.
- La afirmación inicial de una tasa fija del 19% dejó de ser vigente antes del
  corte actual. En `BillingService.createInvoice`, las líneas nuevas congelan
  `porcentajeImpuesto` y `valorImpuesto`; el MVP acepta tasas explícitas de
  0%, 5% y 19%, con redondeo por línea. Las pruebas de `billing.service.spec.ts`
  cubren tasas configuradas por producto y líneas manuales. Esto no acredita
  clasificación tributaria ni factura electrónica DIAN.
- En `apps/api/prisma/schema.prisma`, `Empleado.eps`, `arl`, `fondoPension` y
  `cajaCompensacion` son campos `String?`; no guardan identificadores
  normalizados ni vigencias de afiliación y permanecen como campos heredados.
  Los modelos de historial agregados por #223–#227 capturan fuentes nuevas y
  las copian a snapshots posteriores sin backfill. No se encontró un
  exportador PILA completo: hay serializer de registro, mappers candidatos y
  preflight, pero no composición ni descarga de archivos tipo 1 y tipo 2.
- La [página oficial de PILA de MinSalud](https://www.minsalud.gov.co/Proteccion-Social/Paginas/pila.aspx)
  se revalidó el 2026-11-02: la descarga directa del enlace a
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
  2026-11; el AT2 v30 también conserva inicialmente esa fecha técnica para el
  cotizante 75, que queda fuera del MVP. La Resolución 2483 posterior movió el
  inicio de operación del mecanismo al 2027-03-01, pero la propuesta para
  modificar 5.87/5.91 seguía en consulta pública al 2026-11-04 y no se trata
  como norma expedida. La matriz completa aún debe reconciliar cada regla de
  AT2 v30, sus hitos de vigencia y normas posteriores. La selección de reglas
  por período/fecha prevista de pago de aportes PILA se aplicará solo a hitos
  cuya vigencia dependa de ambos datos; esa previsión es distinta de la fecha
  de pago del salario y no confirma que se pagaron los aportes.
- La [Sentencia C-264 de 2026 de la Corte Constitucional](https://www.corteconstitucional.gov.co/relatoria/2026/C-264-26.htm)
  fija el 2027-04-01 para la entrada en vigencia de las disposiciones
  exequibles del nuevo sistema pensional; los apartes devueltos para
  subsanación no tienen fecha cierta. El código mantiene los campos 46–47
  bloqueados cuando el período o la fecha prevista de pago alcanza ese corte,
  y no deduce la nueva regla desde la tarifa anterior.
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
  comprobante del Ledger y el snapshot sobreviven una recarga. El E2E de
  facturación también verifica el asiento y su anulación; #208 añade la consulta
  paginada del detalle de comprobantes a la pantalla de Contabilidad.
- La primera corrida del recorrido detectó que el precio Decimal de un producto
  llegaba como texto a `CreateInvoiceDto` y la API respondía 400. El formulario
  convierte ahora ese precio a número al seleccionar el producto; el recorrido
  E2E cubre selección, emisión y persistencia de la factura.
- La entrega local de causación añade a la pantalla de período la acción ADMIN,
  el preflight visible y el comprobante persistido con sus movimientos. La rama
  apilada agrega el ciclo de correcciones post aprobación y la lectura del
  comprobante de ajuste. #151, #155, #156, #157 y #158 ya están fusionadas en
  `main`; el flujo de nómina conserva su snapshot y causación. La emisión de
  facturas internas al Ledger se implementó en #179 tras la aceptación de
  ADR-011 para demo; su revisión contable-fiscal operativa sigue pendiente.
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
- **ADR-011:** aceptada para facturación interna de demo. #179 implementa el
  asiento al emitir facturas nuevas y su reversión auditable al cancelarlas;
  revisión contable-fiscal operativa sigue pendiente. No habilita DIAN ni
  contabilización retroactiva de facturas históricas.
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
- Los campos 28–29 asignados al operador permanecen sin valor. Si el fax
  opcional está vacío, el mapper propone el campo 16 como cero numérico según
  la regla general de relleno AT2 v30; esa representación candidata aún
  requiere aceptación por un operador antes de declarar compatibilidad.
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
  v2 del mismo tenant, período y ejecución de nómina: planilla E, campos
  compartidos del aportante, período de salud mensual, conteo único y suma de
  IBC CCF congelados. Exige que el consumidor aporte el conteo esperado de
  snapshots aprobadas; si no coincide con el conjunto, los totales quedan
  bloqueados.
- Rechaza conjuntos mezclados de tenant/período/ejecución; no escoge entre
  snapshots repetidos de un empleado. Solo agrega dependientes `01`/`00` con
  afiliación vigente para todo el mes. Los operadores conservan los campos que
  AT2 les asigna (2, 15, 17, 18 y 22). No se serializa ni se compone el archivo.
- Las pruebas cubren set estándar, totales con varios empleados, campos del
  operador, tenant cruzado, snapshot repetido, afiliación fuera de alcance,
  período incompleto, conteo no coincidente y mezcla de ejecuciones. El mapper
  no demuestra por sí mismo que el conteo esperado venga de la ejecución
  aprobada completa; ese origen debe verificarse al integrarlo. La validación
  del detalle 02 y compatibilidad con operadores siguen pendientes.

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
- Payroll conserva el FSP como concepto agregado. El snapshot PILA v4 copia
  SMMLV y tramos usados por el cálculo de Payroll, pero no los trata como reglas
  PILA ni separa subcuentas. Siguen faltando régimen confirmado y suma pensional
  de todas las fuentes del cotizante; no se distribuye ni calcula el importe.
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

### Candidatos del encabezado tipo 2 en el preflight PILA — 2026-10-31

- La rama `codex/goal02-pila-header-preflight-report` continúa la cadena sobre
  #207. El informe API ahora incluye los candidatos AT2 v30 para los 22 campos
  de cabecera; la pantalla de Nómina muestra el valor o el motivo pendiente de
  cada campo. La ruta solo acepta períodos aprobados/causados, consulta los
  snapshots del tenant y período solicitados, y conserva `archivoGenerable =
false`.
- La suma del campo 20 usa el mismo mapper que presenta la cabecera. Solo
  acepta snapshots PILA v2 únicos con afiliación dependiente 01/00 vigente para
  el mes; un duplicado o un campo N12 desbordado no produce un total candidato.
- El Browser E2E del recorrido financiero pasó con PostgreSQL desechable y
  verificó el snapshot persistido, el total de campo 20, los campos pendientes
  del operador y que la descarga sigue sin implementar. API/Web typecheck,
  ESLint y 117 pruebas API también pasaron localmente.
- **GOAL ACTIVO:** GOAL-02; GOAL-01 permanece pausado. **IMPLEMENTACIÓN
  BLOQUEADA:** solo la sincronización y merge ordenado de PR remotos que esperan
  checks de GitHub/Vercel; #207 y #208 siguen abiertos. Sus jobs `verify` y
  `browser` terminaron en 2 segundos sin ejecutar pasos; Vercel limitó #207
  por 24 horas y el preview de #208 terminó correctamente. Por instrucción del
  usuario, estos estados no detienen el trabajo local ni se mergean todavía;
  las ramas se sincronizarán con `main` y se revisarán en orden cuando vuelva
  la cuota.
- **ARQUITECTURA DISPONIBLE:** ADR-013 aprobada con cambios, matriz de campos
  AT2 v30 y el mapper versionado permiten continuar cubriendo fuentes y
  validaciones sin afirmar compatibilidad universal. Sigue pendiente la prueba
  de carga por operador antes de declarar compatibilidad.

### Candidatos del aportante tipo 1 en el preflight PILA — 2026-10-31

- La PR #210, apilada sobre la PR #209, agrega un informe agregado de los
  34 campos del archivo tipo 1 desde snapshots aprobados. Solo muestra valores
  comunes cuando cada snapshot PILA v2 identifica el tenant autenticado y
  coincide exactamente con el período aprobado; cada empleado debe aparecer una sola
  vez. No completa datos desde el perfil actual del tenant.
- Valores del aportante diferentes entre snapshots, períodos o tenants
  inconsistentes y snapshots duplicados bloquean los candidatos afectados; un
  problema de alcance bloquea el registro completo. Los campos 28/29 y demás
  fuentes ausentes conservan el motivo de pendiente, sin inferir información
  asignada por el operador.
- La pantalla muestra los 34 candidatos y causas pendientes. Esto no valida ni
  serializa el registro tipo 1, no habilita descargas y no demuestra aceptación
  de un operador.
- La verificación local pasó: 133 pruebas API de PILA/preparación/servicio,
  typecheck y lint de API/web, build de API/web y Browser E2E financiero
  (1/1) contra PostgreSQL desechable con las 77 migraciones aplicadas. El build
  web conserva dos advertencias existentes de `<img>` en identidad.
- **GOAL ACTIVO:** GOAL-02; GOAL-01 permanece pausado. **IMPLEMENTACIÓN
  BLOQUEADA:** la sincronización y merge ordenado de PR espera recuperación de
  cuota de GitHub Actions y límites de Vercel. Por instrucción del usuario, los
  fallos remotos no detienen trabajo local ni la preparación de PRs apiladas;
  no se fusionan hasta retomar la revisión en orden.

### Validación de alcance en cabecera tipo 2 PILA — 2026-10-31

- La siguiente rama, apilada sobre #210, valida la cabecera tipo 2 contra el
  tenant autenticado y el ID/rango de fechas del período aprobado. Que todos
  los snapshots coincidan entre sí no basta si corresponden a otro período o
  tenant.
- Si el tenant o el período congelado no coincide, la API deja los 22 campos
  sin candidatos y no devuelve el tenant ni período de los snapshots ajenos.
- La verificación local pasó: 121 pruebas API de mapper, preparación y
  servicio; typecheck y lint API; build API; Browser E2E financiero (1/1) con
  PostgreSQL desechable y las 77 migraciones. Sin cambios de schema ni descarga
  PILA habilitada.
- En GitHub, `verify` y `browser` fallaron en 1–3 segundos sin ejecutar pasos;
  Vercel rechazó el preview por límite de despliegues de 24 horas. La PR queda
  abierta para sincronización y revisión ordenada cuando vuelva la cuota, sin
  detener la continuación local de GOAL-02.

### Validación de alcance en detalle tipo 2 PILA — continuación — 2026-10-31

- La revisión del mapper de detalle encontró que aceptaba un snapshot PILA v2
  estructuralmente válido aunque su tenant o período congelado no coincidiera
  con el contexto autenticado y el período aprobado solicitado. El endpoint
  consultaba las filas por tenant/período, pero no validaba ese vínculo dentro
  del payload histórico.
- El mapper de detalle ahora exige el tenant autenticado, el ID y el rango de
  fechas del período aprobado antes de proponer candidatos. Si no coinciden,
  mantiene los 98 campos sin candidatos y no retorna identificadores de tenant
  o período ajenos. El informe tampoco utiliza el nombre del snapshot fuera de
  alcance para mostrar empleados con brechas. Los demás mapeos conservan las
  fuentes congeladas y no completan valores desde datos maestros actuales.
- Se agregaron casos negativos para tenant, ID y fechas del período en el
  mapper y en el agregado del informe. La matriz registra el criterio
  `PILA-AT2-52`. La
  descarga sigue deshabilitada y este cambio no afirma compatibilidad con un
  operador.
- **Estado de consolidación (2026-11-02):** #212 reúne el preflight de #209–#212
  sobre #207; #213 añade el soporte de identidad PEP-TUTOR sobre #212; #218 se
  mantiene como corrección posterior sobre #213. Las ramas previas se conservan
  y los heads consolidados deben superar sus propios checks antes de merge.

### Documento PEP-TUTOR en empleados y preflight PILA — PR #213 — 2026-10-31

- La Resolución 1319 de 2026 reconoce el código documental `PC` para
  PEP-TUTOR y exige un número numérico de 7–8 dígitos. La Resolución 1529 de
  2026 incorpora el tipo documental a las validaciones PILA. El código `PC`
  queda disponible en alta, importación Excel, terceros y snapshots nuevos;
  no se convierte información histórica desde PEP o PPT.
- Formularios, DTOs y Excel rechazan números `PC` fuera del rango. PILA
  propone únicamente los campos 3–4; 7–8 y 46–47 siguen pendientes por falta
  de reglas aprobadas de clasificación pensional. La descarga del archivo no
  se habilita. La matriz añade `PILA-AT2-53`.
- Verificación local de la cadena consolidada #212–#213: 7 suites API
  (301 pruebas) y 2 suites web (10 pruebas), typecheck API/web, ESLint API/web,
  validación de Prisma y formato. La validación de Prisma usó una URL ficticia
  sin conectarse a una base de datos.
- El head previo `1f9815f` superó CI, Browser E2E y Vercel Preview. Tras
  sincronizar la rama con `main` (`0083cd9`), el nuevo head debe superar de
  nuevo los tres checks antes del merge.
- **GOAL ACTIVO:** GOAL-02; GOAL-01 permanece pausado. **IMPLEMENTACIÓN
  BLOQUEADA:** ninguna; el merge espera checks remotos de cada head consolidado.
  **ARQUITECTURA DISPONIBLE:** ADR-013, mapper AT2 v30 y matriz versionada; no
  hay exportación PILA ni compatibilidad con operadores habilitadas.

### Validación de identidad PEP-TUTOR y días PILA — PR #218 — 2026-10-31

- Se amplió `pila-source-snapshot.spec.ts` para probar meses calendario de 28,
  29, 30 y 31 días con empleo, contrato y afiliación vigentes durante todo el
  período. Los cuatro subsistemas deben conservar 30 días; un período parcial
  no recibe un candidato.
- La revisión del alta PEP-TUTOR encontró que `PATCH /employees/:id` podía
  cambiar el tipo a `PC` conservando un número incompatible o modificar el
  número sin enviar el tipo. `UpdateEmployeeDto` y `EmployeesService` validan
  ahora el par efectivo al cambiar cualquiera de los dos campos y rechazan el
  update antes de escribir.
- La matriz añade `PILA-AT2-54` y precisa `PILA-AT2-53`: la Resolución 1319
  define el documento PEP-TUTOR numérico de 7–8 dígitos; el campo 4 del
  registro tipo 2 de AT2 v30 admite hasta 16. La validación del documento
  existente permanece en 7–8; no se truncan ni se transforman IDs.
- El Browser E2E de empleados ahora cambia desde la UI el documento a un `PC`
  válido, guarda y confirma el valor después de recargar. Ese recorrido detectó
  que una recarga de sedes podía dejar vacía la sede asignada en el formulario;
  `EmployeeForm` ahora restaura la sede activa después de cargar las opciones y
  respeta una selección que el usuario ya haya cambiado. El E2E dirigido había
  pasado (1/1) sobre PostgreSQL 16 descartable en una revisión anterior.
- Verificación local del árbol #218 sincronizado: 4 suites API (64 pruebas),
  1 suite web (5 pruebas), typecheck y ESLint API/web, `prisma validate`,
  Prettier y `git diff --check`. Los checks remotos deben validar el head
  actualizado; no se habilita descarga PILA ni se declara compatibilidad.
- La información empresarial pública de [SOI](https://www.soi.com.co/contactenos)
  ofrece liquidación y soporte por archivo plano a empresas de 50–200 empleados;
  su [guía de liquidación](https://www.soi.com.co/empresa-como-hacer-y-pagar-la-planilla)
  confirma el cargue de un archivo plano para crear la planilla de pago. El
  escenario demo de 100 empleados cae en ese rango, por lo que SOI sigue siendo
  candidato para la primera prueba (inferencia). Esto no aporta una muestra
  aceptada ni demuestra compatibilidad; hace falta cargar el archivo en una
  cuenta de prueba y conservar el resultado.
- Las correcciones originadas en #218 se incorporaron por fast-forward a la
  rama de #213; #218 se cerró como consolidada allí, sin integrarse en `main` de
  forma independiente. La rama de #213 ya se sincronizó directamente con
  `main` (`0083cd9`) y sus checks deben correr sobre el nuevo head.
- **GOAL ACTIVO:** GOAL-02; GOAL-01 permanece pausado. **ARQUITECTURA
  DISPONIBLE:** preflight y matriz AT2 v30 versionados; el exportador PILA y
  las pruebas de carga en operadores siguen pendientes.

### Planilla E, campo 22 — 2026-11-02

- PR #219 se fusionó en `main` como `884ae55`. Agrega la ubicación laboral
  PILA con vigencias, separada de sede y ARL, y la congela en nuevos snapshots
  PILA v3. Los campos 9–10 solo reciben candidatos cuando una ubicación y una
  afiliación CCF con departamento coincidente cubren todo el período; los
  snapshots históricos v1/v2 no se completan. Esto no genera archivos ni
  prueba carga de operador.
- La cabecera candidata del MVP fija planilla E. AT2 v30 limita el campo 22 a
  planillas N de corrección y exige blanco para otros tipos; el detalle propone
  blanco versionado para E. Planilla N y sus grupos A/C siguen fuera del MVP;
  el campo 28, eventos y otras brechas continúan pendientes.
- `archivoGenerable` permanece falso y `estadoArchivo` en
  `NO_IMPLEMENTADO`. No se habilita descarga ni se afirma compatibilidad con
  operadores.

### Reconciliación pendiente de aportes voluntarios PILA — 2026-11-03

> Estado del 2026-11-03, supersedido por la revisión oficial y corrección de
> candidatos anotadas a continuación.

- AT2 v30 y la Resolución 467 de 2025 incluyen para 48–49 el corte de julio de 2025. La Circular 028 de 2025 suspende ajustes PILA de la Resolución 467 salvo
  una lista explícita que no menciona estos campos. C-264/2026 restablece
  parcialmente la Ley 2381, fija el 1 de abril de 2027 para disposiciones
  declaradas exequibles y deja otras sujetas a subsanación; no aclara
  específicamente 48–49. No se encontró una instrucción oficial posterior que
  resuelva esta interacción.
- El mapper anterior marcaba 28/53 en blanco y 48/49 en cero para planilla E
  desde 2025-07-01. Esa salida asumía aplicable el corte sin resolver la
  Circular, la decisión constitucional posterior ni la falta de fuentes Payroll.
- En esta rama, el mapper mantiene 28, 48, 49 y 53 pendientes para cualquier
  período de planilla E hasta reconciliar la regla y congelar afiliación,
  declaración AVP, importes y retención; el campo 50 sigue pendiente mientras
  48/49 no se resuelven. Es una protección del producto, no una conclusión de que los
  aportes estén prohibidos.
- Las pruebas cubren períodos posterior, histórico y cruzado, intervalo
  invertido, tipo de planilla no soportado y dependencia del campo 50. La carga
  en un operador continúa pendiente.

### Revisión oficial y declaración auditable para campos AVP — 2026-11-04

- **Hechos oficiales:** la Circular Externa 028/2025 suspende los ajustes de la
  Resolución 467 asociados a la Ley 2381, salvo una lista que no incluye los
  campos 48/49. La compilación vigente de Resolución 2388 marca suspendidas las
  modificaciones 467 a dichos campos y remite al texto anterior; el texto
  anterior permite campo 28 blanco o X, usa 48/49 cuando existen aportes
  voluntarios, asigna cero en prima media y condiciona el campo 53 a campo 28
  en X. La Resolución 1529/2026 también fue cotejada y no modifica los campos
  AVP 28, 48, 49 o 53. C-264/2026 fija el 2027-04-01 para las disposiciones
  aprobadas del nuevo sistema y deja otras sujetas a subsanación.
- **Inferencia normativa acotada:** antes del 2027-04-01, la regla anterior se
  aplica a candidatos PILA estándar. No se atribuye a la Corte una decisión
  específica sobre los campos 28/48/49/53; se revisará ante una nueva norma y
  antes de que el período o fecha de pago alcance el corte.
- **Implementación fusionada:** PR #271 quedó en `main` como `aea7d9a`; CI,
  Browser E2E y publicación de imagen API post-merge pasaron. PayrollRun conserva una declaración
  `UNCONFIRMED`, `NONE_CONFIRMED` o `PRESENT` por empleado/período, con actor,
  fecha y auditoría tenant-scoped. Al aprobar, la declaración se congela en
  snapshot PILA v8. Solo `NONE_CONFIRMED`, antes del corte y con dependiente
  01/00 de mes completo, afiliación vigente y sin novedades/eventos permite
  mapear 28 en blanco, 48/49 a cero y 53 en blanco. Falta de confirmación,
  AVP presente, snapshots v1–v7 o período/pago desde el corte mantienen los
  cuatro campos bloqueados. Campo 50 se deriva solo cuando 47–49 están listos.
- Esta corrección habilita candidatos de preflight, no compone ni descarga
  archivos, no calcula aportes AVP y no acredita aceptación de operador. La
  compatibilidad de carga sigue pendiente.
- Fuentes revisadas: [Circular 028/2025](https://www.minsalud.gov.co/Normatividad_Nuevo/Circular%20Externa%20No%20028%20de%202025.pdf),
  [compilación de Resolución 2388/2016](https://normativa.colpensiones.gov.co/compilacion/docs/resolucion_minsaludps_2388_2016.htm),
  [Resolución 1529/2026](https://normativa.colpensiones.gov.co/colpens/compilacion/docs/resolucion_minsaludps_1529_2026.htm),
  [C-264/2026](https://www.corteconstitucional.gov.co/relatoria/2026/C-264-26.htm)
  y [AT2 oficial de MinSalud](https://www.minsalud.gov.co/Proteccion-Social/Paginas/pila.aspx).

### Captura inicial de afiliación PILA — Excel y alta individual — 2026-11-02

- PR #223 se fusionó en `main` como `636aa85`. La importación Excel admite un
  bloque opcional de afiliación inicial por empleado nuevo; omitirlo conserva
  el formato anterior. La afiliación V3 se persiste con el empleado en una
  transacción tenant-scoped y deja auditoría en esa misma transacción. CI,
  Browser E2E y Vercel Preview pasaron antes del merge.
- PR #224 se fusionó en `main` como `dbe5edd`. El formulario de alta individual
  permite la misma captura opcional; formulario, importador y servicio aceptan
  cotizante 01/00 únicamente para contratos laborales estándar
  (`TERMINO_FIJO`, `TERMINO_INDEFINIDO`, `OBRA_LABOR`) y bloquean prestación de
  servicios y aprendizaje. Empleado, afiliación V3 y auditoría se escriben en
  la misma transacción tenant-scoped. CI (1.533 pruebas API), Browser E2E
  (24/24) y Preview pasaron antes del merge.
- Ambos flujos validan longitudes, clase ARL, departamento CCF DIVIPOLA,
  vigencias y declaraciones según tipo de documento. No modifican empleados
  existentes, convierten texto heredado, validan catálogos oficiales de
  administradoras ni habilitan la descarga del archivo PILA.

### Importación masiva de afiliaciones para empleados existentes — 2026-11-02

- ADR-016 acota una plantilla XLSX separada: documento exacto dentro del tenant,
  una versión completa por empleado y lote de hasta 500 filas. Solo agrega o
  deja sin cambios el historial de afiliación; no altera datos del empleado ni
  cambia la importación de empleados nuevos.
- PR #225 se fusionó en `main` como `d52d799`. La implementación valida antes
  de escribir, aplica todo en una transacción tenant-scoped, registra
  auditoría, serializa por empleado para evitar carreras y omite versiones
  idénticas en reintentos. El servicio de afiliaciones conserva el cierre de la
  vigencia anterior y rechaza cruces. CI, Browser E2E y Vercel Preview pasaron
  antes del merge.
- La plantilla y UI explican que el MVP es 01/00, no valida códigos de EPS/AFP/
  ARL/CCF con operadores y no genera ni transmite PILA. Matriz PILA-AT2-59
  incorpora los criterios. La carga no modifica empleados ni snapshots PILA
  aprobados.

### Importación masiva de ubicaciones laborales PILA — 2026-11-02

- ADR-017 continúa ADR-015 con una plantilla independiente para empleados
  existentes: identificación por documento tenant-scoped, municipio DANE y
  vigencia; la interfaz exige confirmación explícita del aportante.
- La rama `codex/goal02-pila-locations-bulk-import` agrega plantilla y API
  Admin-only, validación de filas, escritura transaccional ordenada y auditable,
  y reintento idempotente. Reutiliza el servicio histórico existente para
  cerrar vigencias y rechazar cruces; no modifica sede, afiliación, centro ARL,
  documentos ni snapshots anteriores. No requiere migración.
- PR #226 se fusionó en `main` como `c460fc8`; CI, Browser E2E y Vercel Preview
  pasaron. El recorrido verifica descarga, confirmación, importación,
  persistencia en el detalle y reintento idempotente. El flujo aún no genera ni
  transmite archivos PILA.

### Importación masiva de centro ARL y actividad de riesgos — 2026-11-02

- PR #227 se fusionó en `main` como `00c15b6`. La plantilla de ADR-018 importa
  asignaciones respaldadas por centros ARL del mismo tenant. Valida documento,
  centro, actividad del catálogo vigente, ARL/clase contra afiliaciones y
  fechas; no crea ni modifica centros. La captura exige confirmación del
  aportante, conserva historial, audita, es idempotente y revierte el lote
  ante conflicto. El Browser E2E verifica descarga, importación, persistencia
  tras recargar y reintento sin duplicados.
- Quedaron implementadas las tres importaciones PILA por lote: afiliaciones
  (#225), ubicaciones laborales (#226) y centro ARL/actividad (#227). Ninguna
  rellena snapshots aprobados ni habilita o genera archivos PILA.

### Total de cotización pensional en detalle PILA — 2026-11-03

- AT2 v30 define el campo 50 del detalle tipo 2 como la suma de los campos
  47–49. La regla de formato no modifica los importes ni vuelve a calcular
  contribuciones Payroll.
- En esta rama, el mapper solo propone el campo 50 cuando 47, 48 y 49 tienen
  valores candidatos explícitos y la suma cabe en N9. Como 48–49 carecen de
  fuente Payroll y la vigencia del corte no está reconciliada, el total también
  permanece pendiente. No se infieren ceros.
- La matriz mantiene PILA-AT2-60 como criterio de aceptación. No se habilitan
  serialización, descarga, aceptación de operador, liquidación ni pago.

### Cobertura completa de campos del detalle AT2 — 2026-11-03

- PR #229 se fusionó en `main` como `4eedd84` y PR #230 como `b9ac011`. El
  primero compone el candidato del campo 50 desde 47–49; el segundo explica
  esa relación en la interfaz y la verifica en Browser E2E. CI y Browser E2E
  post-merge de #230 terminaron exitosamente.
- La matriz agrega `PILA-AT2-61`: cada uno de los 98 campos del registro de
  detalle debe estar representado como candidato o pendiente explícito. La
  prueba automatizada compara esa cobertura con el layout AT2 v30 y verifica
  que un snapshot no soportado bloquee los 98 campos. Esto protege el
  preflight ante campos omitidos; no constituye validación normativa completa
  ni habilita composición, descarga o compatibilidad con operadores.

### Regla de aplicabilidad del campo UPC adicional — 2026-11-03

- PR #231 se fusionó en `main` como `89820be`; su prueba de cobertura conserva
  los 98 campos del detalle como candidatos explícitos o bloqueos.
- AT2 v30 §2.1.2.3.23 limita el campo 56 al cotizante 40 y requiere el dato de
  la fuente BDUA del operador. Para el MVP 01/00 queda en blanco; los tipos 40 y
  69 siguen fuera de alcance y sin candidato. El preflight mantiene la descarga
  deshabilitada y no afirma compatibilidad con operadores.

### Guardrail del segundo semestre de prima — 2026-11-03

- La decisión aprobada en ADR-012 limita el MVP a enero–junio. La interfaz
  deshabilita julio–diciembre y la API lo rechaza antes de acceder a datos o
  guardar un lote, evitando borradores no aprobables llenos de líneas
  bloqueadas. El cálculo y publicación del segundo semestre siguen fuera del
  alcance hasta la revisión laboral del corte.

### RET PILA para empleado que ya está inactivo — dependencia pendiente — 2026-11-03

- **Hechos confirmados en código:** `generatePayroll` y
  `recalculatePayroll` solo seleccionan empleados `ACTIVO`;
  `calculate()` recibe salario mensual, sin días trabajados del período; el
  evento RET solo forma parte del payload de empleados que sí tienen un run.
  Capturar RET para un inactivo permitiría guardar un evento que no aparecería
  en un snapshot aprobado y podría ocultar la liquidación salarial pendiente.
- Por ese motivo la pantalla explica que los inactivos no aparecen y la API
  rechaza el alta con un error explícito. Si un empleado se inactiva después de
  registrar una novedad, generación y reliquidación bloquean el período antes
  de crear o borrar runs, en lugar de excluirlo silenciosamente del snapshot.
  Las guardas de cálculo se verifican en el servicio y el rechazo de alta en
  Browser E2E. La consulta y escritura del evento se realizan en la transacción
  tenant-scoped que instala el contexto RLS de `empleados`.
- **GOAL ACTIVO:** GOAL-02. **IMPLEMENTACIÓN BLOQUEADA:** solo esta capacidad de
  retiro PILA para empleado inactivo; no bloquea el resto del Goal. Antes de
  habilitarla se deben definir y probar el período laboral parcial, días e IBC
  en nómina y su inclusión inmutable en `PayrollSnapshot`, sin derivar valores
  PILA por inferencia. **ARQUITECTURA DISPONIBLE:** ADR-013 consume snapshots
  aprobados y exige segmentación normativa validada; no se añade una nueva
  arquitectura ni se habilita exportación.
- Las condiciones internas de ADR-012 para la demostración enero–junio están
  cubiertas: matriz exhaustiva de códigos `ConceptCodigo` con tipos esperados;
  conceptos o tipos desconocidos bloqueados; fixtures revisados para importes,
  días 30/360 y novedades; y julio–diciembre rechazado antes de persistir.
  `service-premium-calculator.spec.ts` verifica la cobertura y los bloqueos.
  **GOAL ACTIVO:** GOAL-02. **IMPLEMENTACIÓN DISPONIBLE:** prima demostrable
  únicamente para enero–junio con fuentes aprobadas; sin pagos ni Ledger.
  **VALIDACIÓN OPERATIVA PENDIENTE:** revisión laboral independiente y regla
  para el segundo semestre; no bloquean la demo controlada ni el resto del Goal.

### Campos PILA que asigna el operador — 2026-11-03

- **Fuente oficial comprobada:** la descarga directa del Anexo Técnico 2 que
  enlaza MinSalud tiene SHA-256
  `BBB3C2D0486FD7D3934BD640D8E68C60D33686B1604E8EFAA980139FB5686D33`; al
  renderizar la página impresa 15 se confirma AT2 v30, fechado 2026-07-24, y
  que el aportante tipo 1, campos 28 y 29, son asignados por el sistema. La
  página pública actual de SOI solicita tipo de planilla y período (mes/año)
  antes de liquidar o cargar el archivo.
- **Inferencia delimitada:** los mapas candidatos de tipo 1 y cabecera tipo 2
  dejan vacías, manteniendo sus posiciones, las celdas cuyo valor final asigna
  el operador. El serializer solo permite esa representación vacía en campos
  marcados como asignados por el operador. Una carga real todavía debe confirmar
  que SOI acepta la convención; no se declara compatibilidad ni se habilita la
  descarga.
- Se conserva fuera de alcance cualquier dato no congelado en el snapshot; en
  particular la fecha prevista de pago no se convierte en fecha efectiva ni en
  número de radicación. La composición del archivo, la validación local
  completa y los campos laborales/FSP aún pendientes siguen bloqueando la
  exportación.
- Fuentes: [Anexo Técnico 2 de MinSalud](https://www.minsalud.gov.co/sites/rid/Lists/BibliotecaDigital/RIDE/DE/OT/anexo-tecnico2-cotizantes.pdf);
  [pasos de liquidación y carga de SOI](https://www.soi.com.co/empresa-como-hacer-y-pagar-la-planilla).

### Corrección aprobada en lote de prima masiva — 2026-11-03

- El Browser E2E de 100 empleados incluye una corrección aprobada de horas
  extra (+$60.000) congelada en el snapshot de enero. El preview calcula
  $1.105.000 para esa persona y $1.100.000 para las otras 99, con 180 días
  computables para cada una.
- Tras aprobar, la prueba desconecta el navegador, confirma la finalización del
  lote, verifica las 100 publicaciones inmutables con SHA-256 y descarga el PDF
  del empleado corregido. La prueba valida la firma PDF, Content-Type y compara
  el SHA-256 de los bytes descargados con el hash inmutable de su línea.
  También comprueba que la línea conserva la identidad y evidencia de la
  corrección aplicada.
- La prueba unitaria del worker verifica que el HTML enviado al renderizador
  contiene identidad, componentes de la base, días, importe aprobado y versión
  de fórmula. El E2E demuestra que se descargó el artefacto publicado sin
  cambios; no extrae texto del PDF.
- Evidencia local actual: Browser E2E (1/1, 39,0 s) sobre PostgreSQL 16
  desechable con las 82 migraciones. Esta ejecución no usó la base de desarrollo.
  Las pruebas de cálculo, servicio y worker (52/52), typecheck API/web y builds
  API/web se verificaron en el corte anterior de esta misma rama funcional. La
  prima sigue limitada a enero–junio para demo; revisión laboral independiente
  y regla del segundo semestre siguen pendientes antes de uso operativo.

### Recaudo parcial en el seed de demo financiera — 2026-11-03

- El escenario sintético crea un recaudo por transferencia de $100.000 y lo
  aplica a la factura demo emitida por $285.600 usando `CustomerReceiptsService`.
  La operación es tenant-scoped e idempotente; no borra ni reemplaza recaudos
  existentes y genera el comprobante CI balanceado con débito a Banco y crédito
  a Cartera.
- El Browser E2E verifica la aplicación, los movimientos asociados al tercero,
  el saldo pendiente de $185.600, la repetición idempotente del seed y la vista
  desde Facturación. Los datos siguen marcados como sintéticos; no representan
  recaudos reales ni una validación operativa contable.
- Verificación local en PostgreSQL 16 desechable con 82 migraciones: primera
  ejecución creó un recaudo; la segunda reportó cero recaudos nuevos. La
  consulta confirmó factura $285.600, aplicación $100.000, saldo $185.600 y
  comprobante CI balanceado con Banco 111005 y Cartera 130505.
- Browser E2E local pasó (1/1, 23,7 s) sobre la misma clase de base temporal;
  el test ejecuta el seed con `ts-node` y el `tsconfig` de API para no importar
  directamente servicios Nest decorados desde el transformador Playwright.

### Secuencia global de detalle PILA AT2 v30 — 2026-11-04

- **Bug confirmado en código:** `mapPilaAt2V30DetailCandidate` ponía el valor
  `1` en el campo 2 de cada trabajador. La norma exige un consecutivo por línea
  de detalle; repetir `00001` hace inválido el archivo plano.
- **Fuente normativa:** la compilación vigente de la Resolución 2388, modificada
  por la Resolución 1529 de 2026, define el campo 2 como N5; inicia en `00001`,
  avanza secuencialmente y el aportante informa el campo para archivos planos.
  Ordenar por ID de empleado es una elección determinística local, no un
  requisito atribuido al Ministerio.
- **Corrección local:** el mapper individual deja el campo pendiente. El
  preflight consulta los `PayrollRun` aprobados del tenant/período y solo
  propone la secuencia cuando sus IDs coinciden exactamente con los snapshots,
  cada uno produce una línea mensual estándar, no hay empleados duplicados y
  caben hasta 99.999 registros. La secuencia se asigna en orden estable por ID
  y es todo-o-nada; no expone ni persiste una secuencia parcial. La generación
  y descarga del archivo siguen deshabilitadas.
- **GOAL ACTIVO:** GOAL-02. **IMPLEMENTACIÓN DISPONIBLE:** secuencia candidata
  del campo 2 en el preflight. No queda un bloqueo de cuota de Vercel o GitHub
  Actions: los PR #251 y #252 se fusionaron con sus checks en verde. La
  composición y descarga completas siguen pendientes hasta resolver los campos
  sin fuentes aprobadas y demostrar aceptación por operador. **ARQUITECTURA
  DISPONIBLE:** ADR-013 y la matriz AT2 v30 describen snapshots aprobados,
  alcance 01/00 y los requisitos previos para habilitar la descarga.

### Validación de identidad en detalle PILA — 2026-11-04

- **Bug confirmado en código:** el mapper aceptaba como candidatos los campos
  3–4 sin validar el tipo documental admitido por el MVP ni el formato de su
  número, aunque la matriz PILA-AT2-53 limita los candidatos a CC, CE, TI, PA
  y PC.
- **Corrección:** los tipos fuera de alcance y los números que exceden o no
  cumplen el formato por tipo quedan pendientes con motivo; no se normalizan ni
  se truncan. Se conserva el número aprobado literalmente, incluidos ceros
  iniciales. PC conserva el alcance explícito de PEP-TUTOR (7–8 dígitos).
- La validación solo mejora candidatos del preflight; no persiste datos ni
  habilita serialización, descarga o compatibilidad con operadores. Se basa en
  la matriz AT2 v30 y en la [Resolución 1319 de 2026 sobre PEP-TUTOR](https://www.minsalud.gov.co/sites/rid/Lists/BibliotecaDigital/RIDE/DE/DIJ/resolucion-1319-de-2026.pdf).
- Verificación local: pruebas del mapper 153/153, ESLint, typecheck API y
  Prettier pasan.

### Corrección de límites FSP y protección de ejecuciones pendientes — 2026-11-03

- La tabla vigente del Decreto 1833 de 2016 asigna exactamente 17, 18, 19 y 20 SMMLV al tramo anterior. El cálculo y los parámetros de esta rama representan ambos extremos explícitamente; la migración corrige solo las vigencias anteriores al 1 de abril de 2027 y no toca snapshots.
- Antes de aprobar, la nómina compara la tasa FSP guardada en cada PayrollRun pendiente con la tasa vigente para su IBC. Si difiere, crea un bloqueo tenant-scoped y exige reliquidar; la interfaz no ofrece excluirlo, y la API tampoco permite esa acción. No reescribe cálculos ni snapshots aprobados.
- PR #249 se fusionó en `main` como `8685c36`. La verificación anterior registró 480 pruebas en 7 suites y typecheck API; los checks post-merge se consultan en GitHub. La rama de trabajo actual `codex/goal02-pila-fsp-scope-snapshot` agrega fuente PILA confirmada, snapshot v6 y subcuentas 51/52; aún requiere completar la auditoría, pruebas de navegador y PR.
- PR #249 aporta los tramos inclusivos FSP a snapshots v5. La rama actual implementa en snapshot v6 una declaración auditada de fuente única antes de aprobar y conserva los importes separados solo cuando concilian con `FSP` congelado. Fuentes múltiples/desconocidas, snapshots v1–v5, fechas de transición, novedades sin segmentar y discrepancias siguen bloqueados. Esta capacidad solo genera candidatos de preflight; no serializa ni descarga archivos.

### Validación de identidad en candidatos del aportante PILA — PR #260

- **Bug confirmado en código:** el preflight bloqueaba identificaciones de aportante o representante con tipos incompatibles o formatos no admitidos, mientras el mapa candidato del archivo tipo 1 aún podía mostrar varios de esos valores.
- **Corrección integrada:** PR #260 comparte las reglas de identidad entre el preflight y los mappers de detalle y aportante. El mapa de tipo 1 deja pendiente el número del aportante si no cumple el formato del tipo declarado; bloquea el tipo NI para persona natural, exige el dígito explícito `0` en persona natural y un único dígito declarado en persona jurídica, y valida el tipo/número del representante. No normaliza ni trunca identificaciones.
- La validación del dígito de la persona jurídica solo comprueba que tenga una posición numérica; no verifica su cálculo DIAN. Este cambio solo alinea los candidatos del preflight con las reglas de preparación y el MVP aceptado: no modifica snapshots, no serializa ni descarga archivos y no declara compatibilidad con operadores.
- Verificación: 348 pruebas de preparación y mappers, ESLint y typecheck API locales; checks CI y Browser E2E pre-merge y post-merge, Vercel Preview y publicación de imagen API post-merge pasaron. La aceptación de archivos por un operador sigue pendiente.

### Formato de candidatos del aportante tipo 1 — 2026-11-04

- **Brecha confirmada en código:** algunos valores podían aparecer como candidatos aun cuando excedían el ancho AT2, no cumplían el tipo de campo numérico/alfanumérico, una declaración estaba fuera del MVP, o el correo no pasaba la validación que ya aplica el preflight.
- **Corrección integrada en PR #261 (`d2646b7`):** el mapper comprueba los valores contra el layout AT2 v30, limita declaraciones a las opciones aprobadas, exige CIIU de cuatro dígitos y teléfono numérico, valida el fax y el correo opcionales y conserva pendientes los datos inválidos; no trunca ni modifica el snapshot.
- Este cambio alinea el mapa parcial con ADR-013 y la matriz `PILA-AT2-70`. CI, Browser E2E y publicación de imagen API post-merge pasaron. Sigue sin generar/descargar archivos ni declarar compatibilidad con operadores.

### Validación del layout en candidatos del detalle tipo 2 — 2026-11-04

- **Bug confirmado en código:** el preflight comprobaba longitudes como la de
  apellidos y códigos de administradoras, pero el mapa de detalle podía seguir
  devolviendo el dato fuera de ancho como candidato junto al bloqueo.
- **Corrección integrada en PR #262 (`1909447`):** cada candidato del detalle
  pasa por el validador de tipo y ancho del layout AT2 v30. Un valor inválido
  queda pendiente con el error del campo, sin truncar ni modificar el snapshot;
  los demás candidatos válidos se conservan.
- La matriz añade `PILA-AT2-71`. Los checks post-merge de CI, Browser E2E y
  publicación de imagen API pasaron. No compone ni descarga archivos ni declara
  compatibilidad con operadores.

### Validación del layout en candidatos de la cabecera tipo 2 — 2026-11-04

- **Bug confirmado en código:** la cabecera tipo 2 copiaba directamente los
  valores compartidos del aportante y proponía el código ARL congelado en el
  campo 14 sin comprobar el ancho A6 del layout.
- **Corrección integrada en PR #263 (`0cbcf1e`):** validar valores concretos de cabecera
  con el layout AT2 v30. Un valor inválido queda pendiente con el motivo de
  serialización, sin truncar ni modificar el snapshot; los demás candidatos y
  blancos explícitos se conservan.
- La matriz añade `PILA-AT2-72`. Los checks post-merge de CI, Browser E2E y
  publicación de imagen API pasaron. No compone ni descarga archivos ni declara
  compatibilidad con operadores.

### Blanco contextual del campo 9 del encabezado PILA — 2026-11-04

- **Bug confirmado en código:** para el alcance de planilla E, el mapper
  propone correctamente en blanco el campo 9 numérico N10, pero el serializador
  genérico rechazaba espacios en todos los campos numéricos.
- **Corrección en esta rama:** permitir diez espacios para el campo 9 solo
  cuando el registro sea encabezado tipo 2 y el campo 8 declare planilla E;
  el candidato contextual aplica la misma regla y tipos distintos siguen
  rechazados. La matriz añade `PILA-AT2-73` según la Resolución 2388/2016,
  Anexo Técnico 2, capítulo 1, campo 9 ([texto compilado](https://normativa.colpensiones.gov.co/compilacion/docs/resolucion_minsaludps_2388_2016.htm)).
- El alcance sigue limitado a planilla E del MVP. Este serializador no genera ni
  descarga archivos y no acredita compatibilidad con operadores.

### Puerta segura de serialización de candidatos PILA — 2026-11-04

- **Brecha confirmada en código:** los mappers entregan valores parciales y
  campos pendientes, pero el serializador de registro recibía solo un mapa de
  valores completos; no existía un paso común que negara candidatos no
  soportados o incompletos.
- **Corrección en esta rama:** `serializePilaAt2V30RecordCandidate` exige
  fuentes soportadas, cero campos sin resolver y una decisión explícita para
  cada posición antes de producir la cadena fija. La prueba integrada convierte
  la cabecera de la fixture de nómina y conserva el blanco N10 de planilla E.
- La matriz añade `PILA-AT2-74`. Aún no hay ensamblado de registros tipo 1/2,
  endpoint de descarga ni declaración de compatibilidad con operadores.

### Trazabilidad de empleados en el preflight PILA — 2026-11-04

- **Brecha confirmada en código:** los hallazgos del preflight agrupaban
  empleados por ID, pero la respuesta API descartaba ese ID y la interfaz solo
  mostraba el nombre. Nombres iguales eran indistinguibles y no permitían abrir
  directamente el perfil para corregir los datos fuente.
- **Corrección en esta PR:** las listas de afectados conservan `{id, name}`;
  cada nombre enlaza al perfil del empleado y los nombres repetidos reciben un
  ordinal visible. La consulta que alimenta el reporte ya filtra ejecuciones y
  snapshots por tenant; el enlace usa el ID de esa fila tenant-scoped y la ruta
  de perfil aplica sus propios controles de autorización.
- La matriz y el contrato PILA no cambian. El reporte sigue consumiendo
  snapshots aprobados; generación y descarga del archivo y compatibilidad con
  operadores permanecen fuera de alcance.

### Cotizante PILA 75 — plazo de implementación actualizado — 2026-11-04

- **Hecho normativo:** la Resolución 1529 de 2026 y AT2 v30 fijaron las
  validaciones del tipo 75 para pagos desde el 2026-11-01, período de salud de
  noviembre. La Resolución 2483 de 2026 sí fue publicada en el Diario Oficial
  53.676 el 2026-10-31: modificó el artículo 13 de la Resolución 611 para dar
  hasta el 2027-02-28 a los ajustes de operadores y ADRES e iniciar el mecanismo
  el 2027-03-01; también derogó el artículo 14, que condicionaba el inicio a
  una verificación posterior.
- **Corrección de fuente:** el borrador anterior afirmaba que la Resolución
  002492 de 2026 se publicó en la edición 53.677. Esa edición oficial tiene
  una página institucional y no contiene la resolución; las ediciones oficiales
  listadas hasta la 53.679 (2026-11-03) tampoco acreditan su publicación. El
  [PDF de MinSalud](https://www.minsalud.gov.co/Normativa/Resoluciones/PR%20Modificacion%20Res%202388%20PILA%20Implementacion%20permanencia%20en%20el%20RS%20V2.pdf)
  conserva en blanco el número y la fecha, y la página de [consulta normativa
  de MinSalud](https://www.minsalud.gov.co/Normativa/Paginas/Resoluciones.aspx)
  sigue identificándolo como proyecto. El proyecto propone mover 5.87/5.91 a
  pagos desde el 2027-03-01, pero no se trata como norma vigente hasta hallar
  el acto definitivo publicado.
- **Fechas que no deben confundirse:** la operación del mecanismo está fijada
  para 2027-03-01 por la Resolución 2483; la fecha técnica de los numerales
  5.87/5.91 requiere verificar una modificación definitiva del AT2. Antes de
  habilitar el tipo 75, reconciliar ambos hitos con fuentes oficiales vigentes.
- **Conclusión de alcance:** el MVP aprobado sigue limitado a trabajadores
  dependientes estándar 01/00 y rechaza el tipo 75 porque es una exclusión de
  alcance. Este caso no bloquea el avance ni la validación de 01/00. Si se
  prioriza una fase de soporte al tipo 75, deberá versionar las reglas y validar
  elegibilidad, fuentes, campos, calendario definitivo del AT2 y reglas del
  mecanismo.
- **GOAL ACTIVO:** GOAL-02. **IMPLEMENTACIÓN BLOQUEADA:** el soporte futuro del
  tipo 75 necesita la publicación oficial de la modificación propuesta a 5.87/
  5.91 o una aclaración normativa que reconcilie esos numerales con la fecha de
  operación de la Resolución 2483. **ARQUITECTURA DISPONIBLE:** no hay
  dependencia del tipo 75 para avanzar con el MVP 01/00; el exportador PILA
  completo aún tiene bloqueos propios de campos, composición, fixtures y
  aceptación por operador.

### Dependencias de producción después de PR #275 — 2026-11-04

- Tras retirar las alertas críticas en #275, la auditoría `pnpm audit --prod`
  encontró 12 avisos de severidad alta. Esta rama actualiza Tiptap a 3.32.2,
  Playwright a 1.55.1 y Nodemailer a 10.3.1; fija PostCSS 8.5.23,
  ProseMirror View 1.42.3, body-parser 2.4.0 y qs 6.16.1. La auditoría de
  producción posterior deja 4 avisos altos: `xlsx` (dos avisos),
  `deepmerge-ts` y `zod`.
- El cambio no altera reglas de nómina, facturación ni Ledger. Se mantiene como
  trabajo de seguridad prioritario del Goal. Las dependencias restantes no se
  fuerzan a una versión mayor sin revisar su compatibilidad: `deepmerge-ts` es
  transitiva de Prisma y el aviso de `zod` llega por Puppeteer/Chromium BiDi;
  `xlsx` sigue en 0.18.5 y requiere revisar una sustitución segura de su lector
  antes de cambiar los flujos de importación.
- Los avisos altos de desarrollo y severidad moderada/baja no quedan declarados
  resueltos por esta actualización; volver a auditar al integrar.

### Sustitución de SheetJS vulnerable — 2026-11-04

- PR #276 redujo los avisos altos de producción a cuatro, incluyendo dos de
  `xlsx@0.18.5`, usada para leer los archivos XLSX de empleados y afiliaciones.
  SheetJS publica la versión corregida 0.20.3 en su CDN oficial; npm conserva
  0.18.5. Esta rama incorpora el tarball oficial en `vendor/` y fija su SHA-256
  para que CI y las instalaciones reproducibles no dependan de la CDN.
- Las pruebas de los tres importadores Excel pasan (37 pruebas); también pasan
  `pnpm install --frozen-lockfile`, typecheck y build de API. Se construyó la
  imagen Docker `linux/amd64` y se confirmó que resuelve `xlsx` 0.20.3 en
  runtime. `pnpm audit --prod` deja dos avisos altos: `deepmerge-ts` transitivo
  de Prisma y `zod` en Puppeteer/Chromium BiDi y el workspace web. Los checks de
  GitHub y el E2E pre-merge se verificarán antes del merge.

### Composición local de archivos PILA tipo 1/2 — 2026-11-05

- **Brecha confirmada en el preflight:** los mappers y el serializador podían
  producir registros candidatos, pero no había una composición común de los
  dos archivos fijos a partir de snapshots aprobados.
- **Composición integrada en main (PR #278):** el campo 79 queda capturado por afiliación
  histórica V5 y congelado en snapshot PILA v9, sin completar valores antiguos.
  Solo el indicador normal confirmado permite los candidatos de pensión
  estándar; las tarifas especiales y los históricos desconocidos quedan
  bloqueados. La composición reúne aportante tipo 1, cabecera y detalles tipo 2
  y falla el conjunto completo si hay campos pendientes, duplicados, mezcla de
  tenant/período, texto no representable o longitud inválida.
- **Generación integrada en main (PR #279):** una exportación autenticada,
  tenant-scoped y ligada a nómina aprobada conserva historial append-only,
  versiones de regla/formato, hashes, archivos privados y auditoría; la UI
  permite descargar cada tipo con verificación de integridad.
- **Verificación end-to-end:** PR #280 comprueba preflight, generación,
  persistencia, reintento idempotente y descarga de ambos archivos con nombres,
  codificación, bytes y SHA-256 esperados. PR #281 comprueba desde un segundo
  tenant que la descarga ajena responde 404 sin revelar el hash del archivo.
- El estado `LOCAL_VALIDATED` confirma solo las validaciones locales del
  serializador y el formato/codificación guardados. La aceptación por operador
  sigue `NOT_VERIFIED`: aún requiere pruebas de carga por operador. No se
  transmite, liquida ni paga la planilla, y no se declara compatibilidad
  universal. El MVP de generación queda limitado a dependientes estándar 01/00
  sin bloqueos de preflight; los casos excluidos o con datos faltantes siguen
  sin generar.
- **Siguiente incremento:** validar con evidencia de carga real el archivo en
  cada operador que se pretenda anunciar como compatible. Mantener separadas la
  generación local, aceptación del operador, liquidación y pago.

### Alertas altas de dependencias antes de seguir ampliando GOAL-02 — 2026-11-05

- La auditoría inicial de este checkout encontró dos avisos altos de producción:
  `deepmerge-ts@7.1.5` a través de Prisma y Zod 3 en la web y Puppeteer/Chromium
  BiDi. La rama actualiza Zod a 4.6.7 y el resolver compatible a 5.9.2,
  Puppeteer a 25.16.0 y fija `deepmerge-ts` en 8.0.2. Se ajusta el mensaje de
  validación del formulario demo al API de Zod 4.
- El resolver añade dependencias opcionales de Ajv. Para no introducir alertas
  altas por ese camino ni conservar versiones vulnerables del tooling, el
  lockfile fija versiones parcheadas de `fast-uri`, `browserslist`,
  `baseline-browser-mapping`, `brace-expansion`, `js-yaml` y `source-map-js`,
  conservando las ramas mayores de sus consumidores.
- Verificación local de esta rama: `pnpm audit --prod` no encuentra
  vulnerabilidades; la auditoría completa no informa altas ni críticas y deja
  dos moderadas (`glob`, `minimatch`) y una baja (`deepmerge`), todas en
  dependencias de desarrollo. No se fuerzan sus actualizaciones mayores en este
  cambio.
- Pasan typecheck y build de API y web, validación del schema Prisma, 14 pruebas
  de `PdfRenderService` y 43 pruebas web. El descubrimiento web en Windows
  requirió pasar a Jest una ruta raíz con separadores normalizados porque este
  worktree vive dentro del directorio oculto `.codex`.
- Antes de declarar la seguridad de publicación completa, revisar también los
  checks remotos y volver a consultar Dependabot después de integrar el lockfile.

### Protocolo de aceptación de archivos PILA en SOI — 2026-11-05

- **Preparación realizada:** las páginas oficiales de SOI describen la carga
  autenticada de archivos planos, la creación posterior de un número y valor de
  planilla y la separación del pago. El Autocorrector de SOI puede identificar
  y modificar redondeos, topes, subsistemas obligatorios y proporcionalidad por
  novedades. Por ello, la validación local no debe confundirse con aceptación
  del operador ni con una liquidación que concilie con PayrollSnapshot.
- **Artefacto:** `docs/research/pila/SOI-OPERATOR-ACCEPTANCE-CHECKLIST.md`
  define precondiciones, evidencia saneada y los estados que se deben registrar
  por separado. Si el operador cambia valores, deben conciliarse antes de
  aceptar o pagar; el producto aún no implementa esa reconciliación.
- **Estado:** no se ha cargado ningún archivo ni se ha probado una cuenta de
  SOI. La aceptación permanece `NOT_VERIFIED`; no se declara compatibilidad.
  El protocolo no transmite datos, no paga planillas y no altera snapshots.
- **GOAL ACTIVO:** GOAL-02. **IMPLEMENTACIÓN BLOQUEADA:** la prueba específica
  de SOI requiere un canal de prueba o una cuenta autorizada y un escenario
  controlado sin pago. **ARQUITECTURA DISPONIBLE:** los archivos locales,
  hashes e historial están disponibles para ejecutar esa validación; mientras
  tanto, se puede avanzar en otros escenarios internos de nómina y finanzas.

### Prima semestral: promedio del auxilio desde snapshots — 2026-11-05

- **Brecha confirmada en `main`:** `PRIMA_SEMESTRAL_V1` usaba el total
  congelado de auxilio solo como indicador de sí/no y reemplazaba el monto por
  el parámetro mensual legal. Así, un snapshot con un auxilio causado
  prorrateado podía producir un promedio mayor al valor que Payroll registró.
- **Implementado y fusionado en PR #293:** `PRIMA_SEMESTRAL_V2` promedia los
  importes reales de `totals.auxilioTransporte` en snapshots aprobados por mes.
  Bloquea si el importe supera el parámetro legal proporcional a los días de
  servicio o si un snapshot con auxilio cruza meses civiles y no puede
  asignarse con certeza. Los lotes V1 aprobados y sus PDFs no se recalculan;
  el nuevo PDF presenta la versión almacenada.
- La prueba incorpora un mes con $140.000 causados frente a $200.000 en los
  otros cinco meses. La base promedio esperada de auxilio es $190.000 y la prima
  $1.095.000. Se mantienen también los resultados de snapshots mensuales
  completos.
- **Limitación confirmada:** Payroll actualmente genera el auxilio completo o
  cero; no registra días de asistencia ni lo prorratea por ausencias. V2
  conserva el monto de origen y bloquea excesos proporcionales, pero el soporte
  end-to-end de ausencias requiere primero modelar y validar su impacto en
  Payroll. La revisión laboral independiente continúa pendiente para el uso
  operativo de primas.
