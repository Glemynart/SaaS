# ADR-013 — Exportación estándar de nómina a PILA

- **Estado:** Aprobado con cambios; criterios de aceptación y pruebas normativas definidos para revisión previa a cualquier implementación. No se ha iniciado código PILA.
- **Fecha:** 2026-10-30.
- **Goal:** GOAL-02 — Evolución Financiera y Cumplimiento Electrónico.
- **Responsable:** Producto / Payroll.

## Contexto

El usuario necesita organizar los datos de seguridad social de sus trabajadores
y descargar un archivo que pueda cargar en un operador PILA. El código actual
no produce ese archivo ni conserva todos sus insumos de forma estructurada:

- `Empleado.eps`, `arl`, `fondoPension` y `cajaCompensacion` son campos de texto
  libre sin identificador ni historia de vigencias.
- `PayrollSnapshot` congela el IBC, los conceptos, los aportes y las novedades
  aprobados, pero no los datos afiliatorios estructurados, tipo/subtipo de
  cotizante ni el catálogo normativo de novedades.
- `PayrollPeriod` conserva fechas de inicio y fin, pero el modelo no tiene
  fecha prevista de pago. Como la Resolución 1529 tiene plazos de
  implementación que dependen del pago y del período cotizado, el exportador
  debe pedir/registrar la fecha prevista de pago o bloquear cuando no pueda
  resolver inequívocamente la regla aplicable.
- `PayrollNoveltyType` ofrece `VACATION`, `SICKNESS`, `LICENSE`, `OVERTIME`,
  `BONUS` y `OTHER`; no es el catálogo/código de reporte PILA.
- El formulario de alta/edición y sus DTOs no capturan afiliaciones ni datos
  PILA. La plantilla e importador XLSX solo incluyen datos personales,
  laborales y `sede`; además de la ausencia de códigos, hoy no hay un flujo para
  cargar estos datos en masa.
- No se encontró un exportador PILA funcional en la API ni en la web.

El Ministerio publica anexos técnicos para PILA y los operadores documentan
cargue de archivos planos. El PDF AT2 versión 29, fechado el 6 de enero de
2026, no es por sí solo la especificación efectiva: la Resolución 1529 del 24
de julio, publicada en el Diario Oficial 53.566 del 27 de julio de 2026,
reemplazó el Anexo Técnico 2 y fijó plazos de implementación escalonados por
cambios. Por ejemplo, las reglas adoptadas para el cotizante
75 y su planilla E aplican a pagos desde el 1 de noviembre de 2026 para el
período de salud de noviembre. La versión de reglas aplicable depende por eso
del período de cotización y de la fecha prevista de pago, no solo del día en
que se genera el archivo.

La Resolución 611 de 2026 establece condiciones para que ciertas personas
vinculadas laboralmente permanezcan hasta seis meses en el régimen subsidiado;
la Resolución 1529 adoptó el cotizante 75 y nuevas validaciones para ese caso,
con aplicación operativa desde el 1 de noviembre de 2026 para el período de
salud de noviembre. Un proyecto ministerial posterior propone modificar los
plazos 5.87 y 5.91, pero al 2026-10-30 no reemplaza los plazos de la Resolución 1529. El MVP excluye este caso y debe bloquearlo; no lo presenta como una
categoría inexistente o meramente proyectada.

## Decisión propuesta

1. Crear un exportador PILA como consumidor de nóminas aprobadas. No recalcula
   IBC ni aportes: toma valores de `PayrollSnapshot` y solo serializa hechos ya
   aprobados. No escribe de vuelta en Payroll ni altera snapshots históricos.
2. El MVP se limita a aportantes empleadores, trabajadores dependientes y
   escenarios estándar que estén expresamente soportados por la matriz
   normativa y la versión del formato seleccionadas. El cotizante 75,
   transición/permanencia especial en régimen subsidiado, independientes,
   pensionados y demás casos especiales quedan para otra fase. Cualquier tipo,
   subtipo, novedad, transición de régimen o subsistema fuera del alcance
   bloquea la exportación con un error por trabajador; nunca se convierte en
   `OTHER` ni se infiere.
3. Usar registros afiliatorios estructurados, codificados y con vigencias
   inicio/fin. Conservar el historial cuando cambie una afiliación; no
   sobrescribir ni convertir en lote los campos de texto heredados a códigos
   oficiales. El empleador debe confirmar cada administradora y código antes
   de exportar. Como mínimo, estructurar salud, pensión, riesgos laborales,
   caja, tipo/subtipo de cotizante, clase de riesgo y novedades reportables.
4. Generar los archivos planos tipo 1 y tipo 2 que exige el Anexo Técnico PILA
   vigente para activos, con campos, posiciones, registros y catálogos
   oficiales. Registrar su versión normativa y período de aplicación. El
   archivo debe respetar identificación del aportante/cotizante, tipo y
   subtipo, IBC y aportes por subsistema, ARL/clase de riesgo, fechas y
   novedades derivados de datos laborales estructurados y nóminas aprobadas.
   Aplicar también las validaciones cruzadas del anexo antes de la descarga.
   Versionar explícitamente y por separado las reglas normativas y el esquema
   del archivo (identificador de versión, vigencia desde/hasta y referencias a
   la norma/anexo que las soporta), fuera del cálculo de Payroll. La selección
   toma en cuenta tanto el período cotizado como la fecha prevista de pago y
   sus hitos de implementación. La línea base para el trabajo es la Resolución
   2388/2016 con el Anexo Técnico 2 reemplazado por la Resolución 1529/2026,
   más cualquier norma posterior vigente a la fecha de implementación; no se
   codifica AT2 v29 como norma consolidada.
5. Antes de descargar, mostrar resumen y errores bloqueantes por trabajador,
   con origen y valor que debe corregirse. Solo un archivo válido se hace
   descargable. Cada exportación registra tenant, período, snapshots fuente,
   versión normativa, versión del formato, usuario y hash del archivo; una
   corrección genera una nueva exportación relacionada, no sobrescribe la
   evidencia previa.
6. La primera versión únicamente genera y descarga el archivo. El ciclo debe
   distinguir estados y mensajes: archivo generado; validación local superada;
   aceptación/rechazo informado por el operador; planilla liquidada por el
   operador; pago realizado. Solo los dos primeros estados los puede afirmar
   este SaaS. No inicia sesión en operadores, transmite/carga el archivo,
   liquida la planilla ni paga aportes.
7. Mantener una matriz de interoperabilidad por operador, portal, fecha,
   versión normativa, versión de formato y resultado de carga. Un operador
   solo aparece como compatible después de que el archivo de prueba supere sus
   validaciones de carga. La generación o validación local no prueba aceptación
   del operador. No declarar compatibilidad universal; extensiones para
   plantillas propias requieren decisión aparte.
8. Toda lectura, generación y descarga conserva el tenant activo y RBAC. El
   artefacto contiene datos personales y de seguridad social; se almacena y
   entrega bajo los controles de acceso y retención de `ADR-SEC-001`.

## Alcance fuera de esta decisión

- Transmisión mediante API/web service del operador o Ministerio.
- Pago PSE, débito, selección de medio de pago o conciliación de pago.
- Planillas distintas a la planilla ordinaria de empleadores y escenarios de
  independientes, pensionados, correcciones o pagos retroactivos hasta validar
  sus respectivas reglas y casos.
- Sustituir la validación final del operador o asumir que el archivo descarga
  una obligación correctamente pagada.

## Criterios de aceptación y pruebas normativas previas al código

No se inicia implementación hasta revisar estos criterios y cerrar la matriz
normativa contra el anexo consolidado vigente y su fecha de aplicación. La
prueba debe usar un fixture anonimizado con resultados revisados por Payroll y
conformidad normativa; cuando el operador lo requiera, una cuenta de prueba del
aportante.

| Prueba                                                                                                     | Resultado esperado                                                                                                                                                                                                                                                                                      |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trabajador dependiente estándar (tipo de cotizante 1, planilla E), afiliaciones vigentes y nómina aprobada | Generar archivos tipo 1 y tipo 2 conforme al AT2 de la Resolución 1529/2026 y a los hitos vigentes para el período cotizado/fecha prevista de pago; conservar IBC/aportes aprobados sin recalcular; mostrar versiones normativa y de formato, período, fecha prevista de pago, snapshots fuente y hash. |
| Afiliación con cambio de administradora                                                                    | Elegir la afiliación cuya vigencia cubre el período; conservar visible y auditable la anterior.                                                                                                                                                                                                         |
| Campo heredado con EPS/AFP/ARL/caja como texto libre                                                       | No inferir código ni generar archivo; pedir mapeo y confirmación explícitos.                                                                                                                                                                                                                            |
| Afiliación ausente, vencida, futura, solapada o con hueco de vigencia                                      | Bloquear al trabajador afectado con campo, período y causa identificables.                                                                                                                                                                                                                              |
| Nómina no aprobada, snapshot ausente o snapshot de otro tenant                                             | Bloquear exportación; no recalcular Payroll ni permitir lectura cruzada de tenant.                                                                                                                                                                                                                      |
| Tipo/subtipo/novedad no incluido en la matriz de versión                                                   | Bloquear con error trazable; no sustituir por código genérico.                                                                                                                                                                                                                                          |
| Cotizante 75 / regla especial de régimen subsidiado                                                        | Rechazar como fuera de alcance del MVP y explicar que requiere una fase compatible con la Resolución 1529 y demás norma vigente; no producir un archivo parcial engañoso.                                                                                                                               |
| Resolución 1529, pagos desde 1 de octubre de 2026 para pensiones del período septiembre                    | Probar las validaciones/origen actualizados de los campos de identificación del aportante, representante, cotizante y cotizante principal definidos en 5.84; rechazar valores inválidos con el campo exacto.                                                                                            |
| Resolución 1529, pagos desde 1 de noviembre de 2026 para salud del período noviembre                       | Aplicar el hito normativo; bloquear tipo 75 por estar fuera del MVP y verificar que el caso estándar tipo 1/planilla E sigue usando únicamente sus reglas aprobadas.                                                                                                                                    |
| Hito escalonado futuro o fecha de pago ausente                                                             | Seleccionar reglas por período de cotización y fecha prevista de pago; bloquear si falta la fecha y no se puede determinar una versión única.                                                                                                                                                           |
| Período/catálogo que cruza una vigencia de formato                                                         | Seleccionar la versión aplicable al período y fecha de pago o bloquear si se cruzan vigencias sin regla aprobada.                                                                                                                                                                                       |
| Archivo de prueba                                                                                          | Verificar byte layout, posiciones, longitudes, catálogos, dígitos de control, codificación y validaciones cruzadas contra fixtures oficiales de cada versión vigente.                                                                                                                                   |
| Reintento/corrección                                                                                       | Reintentar la misma exportación sin duplicar; una corrección crea una exportación nueva vinculada, conserva archivo/versiones/hash previos.                                                                                                                                                             |
| Diferencia de estados                                                                                      | La generación local solo presenta “generado” o “validado localmente”; aceptación, liquidación y pago requieren evidencia del operador/usuario y no se simulan.                                                                                                                                          |
| Carga en operador                                                                                          | Mantener evidencia fechada y versionada. SOI, Enlace Operativo/SuAporte o Aportes en Línea solo se marcan compatibles si su carga real de prueba fue aceptada.                                                                                                                                          |

La matriz de aceptación debe registrar casos incluidos, códigos oficiales,
archivos de entrada/salida esperados, regla normativa exacta, fecha de vigencia,
resultado esperado y revisor. No se anunciará “cargable en cualquier operador”
hasta completar pruebas independientes por operador.

## Alternativas descartadas

| Alternativa                                                                                 | Motivo para descartarla                                                                                                                               |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Crear un formato distinto por operador desde el inicio                                      | Duplica mantenimiento normativo y acopla Payroll a cada portal antes de comprobar que el formato oficial no sea interoperable.                        |
| Recalcular aportes dentro del exportador                                                    | Crearía una segunda fuente de IBC y valores, con riesgo de descuadrar Payroll y contabilidad.                                                         |
| Exportar los nombres actuales de EPS/AFP/ARL/caja como texto                                | El Anexo requiere códigos y validaciones; texto libre no asegura un archivo aceptable.                                                                |
| Marcar todos los operadores como compatibles tras generar un archivo sintácticamente válido | La aceptación del archivo depende de catálogos, fechas de implementación y validaciones de cada portal; debe demostrarse con cargas reales de prueba. |
| Integrar el pago a través del portal en esta entrega                                        | Credenciales, autorización de pago y confirmación de transacción no pertenecen a la generación del archivo y elevan el riesgo financiero.             |

## Migración, reversión y riesgos

- La migración será aditiva. No se borran afiliaciones en texto libre ni se
  altera PayrollSnapshot; el tenant debe mapear y confirmar administradoras y
  códigos antes de exportar.
- Ante rollback, se deshabilita el exportador y se conserva el registro y hash
  de archivos ya generados según retención aprobada. No se modifica el archivo
  de una planilla generada previamente.
- El Ministerio modifica anexos por resoluciones con fechas de implementación
  distintas. Cada versión requiere revisión de norma vigente, fixtures de
  formato, casos de novedad y pruebas de regresión antes de habilitarse.
- Un archivo que supera la validación local puede ser rechazado por el operador
  por catálogos, calendario, afiliación o reglas adicionales. El sistema debe
  decir “archivo generado y validado localmente”, nunca “planilla liquidada” o
  “pago realizado”.
- La calidad de la exportación depende de datos afiliatorios vigentes y de una
  nómina aprobada con cobertura completa. La carga no corrige un error de
  afiliación ni reemplaza la obligación del aportante de suministrar datos
  precisos.
- La condición especial de permanencia en el régimen subsidiado requiere
  comprobar la manifestación del trabajador, elegibilidad y vigencia, además
  de coordinar el formulario de afiliación/novedades de salud con el archivo
  PILA. No se debe recoger ni conservar información socioeconómica o de Sisbén
  sin determinar su base legal, finalidad, minimización, permisos y retención.

## Consecuencias

- Los clientes obtienen un formato normativo reutilizable en los operadores
  que aceptan el archivo plano estándar, sin credenciales del operador dentro
  del SaaS.
- La información hoy libre se vuelve verificable y con vigencia, útil también
  para Payroll y reportes, pero requiere corrección explícita de valores
  heredados antes de exportar.
- La compatibilidad universal pasa a ser un conjunto verificable de operadores
  admitidos y no una afirmación sin evidencia.
- Payroll permanece como fuente del cálculo y Ledger como fuente contable; el
  archivo exportado no crea por sí mismo pagos ni nuevos asientos.

## Fuentes verificadas

- `apps/api/prisma/schema.prisma` — campos afiliatorios de `Empleado`, tipos de
  novedades, `PayrollRun` y `PayrollSnapshot`.
- `apps/api/src/employees/dto/create-employee.dto.ts`,
  `apps/api/src/employees/dto/update-employee.dto.ts`,
  `apps/web/src/features/employees/schemas/employee-schemas.ts` y
  `apps/api/src/employee-import/employee-import.service.ts` — DTOs y formulario
  no reciben afiliaciones; la plantilla/importación XLSX valida sede y datos
  laborales, sin columnas de administradora, cotizante, subtipo ni novedades.
- `apps/api/src/payroll/payroll.service.ts` — snapshots aprobados conservan
  IBC, aportes, conceptos, novedades y evidencia de cálculo.
- `apps/api/prisma/schema.prisma` — `PayrollPeriod` tiene `fechaInicio` y
  `fechaFin`, pero no una fecha prevista de pago.
- [Página oficial PILA de MinSalud](https://www2.minsalud.gov.co/proteccionsocial/Paginas/pila.aspx)
  y [Anexo Técnico 2 de cotizantes](https://www.minsalud.gov.co/sites/rid/Lists/BibliotecaDigital/RIDE/DE/OT/anexo-tecnico2-cotizantes.pdf),
  versión 29, 6 de enero de 2026; define archivos técnicos tipo 1 y 2,
  posiciones de campos y validaciones. Se conserva como evidencia histórica,
  no como la versión consolidada vigente después de la Resolución 1529.
- [Resolución 1529 de 2026](https://www.minsalud.gov.co/Normatividad_Nuevo/Resoluci%C3%B3n%20No%201529%20de%202026.pdf),
  expedida el 24 y publicada el 27 de julio de 2026 en el Diario Oficial
  53.566; reemplaza AT2 y establece fechas escalonadas
  de implementación; para el cotizante 75 los numerales 5.87 y 5.91 fijan el
  1 de noviembre de 2026 para pagos del período de salud noviembre.
- [Texto de la Resolución 1529 en el normograma de Colpensiones](https://normativa.colpensiones.gov.co/colpens/compilacion/docs/resolucion_minsaludps_1529_2026.htm),
  artículos 1 y 3 y numerales 5.81–5.93; permite contrastar las fechas de
  implementación escalonada con las tablas del AT2.
- [Resolución 611 de 2026](https://www.minsalud.gov.co/Normatividad_Nuevo/Resolucion%20No%20611%20de%202026.pdf),
  permanencia temporal en régimen subsidiado de ciertas personas vinculadas
  laboralmente; establece un plazo de seis meses para ajustes operativos PILA.
- [Publicaciones regulatorias de MinSalud](https://www.minsalud.gov.co/Normativa/Paginas/Resoluciones.aspx)
  — al 2026-10-30 incluye un proyecto de ajuste de los numerales 5.87 y 5.91
  del Anexo Técnico 2 para el cotizante con permanencia en régimen subsidiado;
  su inclusión como proyecto no demuestra que haya sido expedido.
- [SOI](https://www.soi.com.co/empresa-servicios-de-soi),
  [Enlace Operativo/SuAporte](https://www.enlace.com.co/hubfs/Manuales/C%C3%B3mo%20cargar%20un%20archivo%20plano%20en%20SuAporte.pdf?hsLang=es-co)
  y [Aportes en Línea](https://www.aportesenlinea.com/Documents/Instructivo%20Corrector%20por%20Pantalla%20v.1.3.pdf)
  documentan el cargue de archivos planos.
