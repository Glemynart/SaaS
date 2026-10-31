# ADR-013 — Exportación estándar de nómina a PILA

- **Estado:** Aprobado con cambios; PR #160 incorpora la primera etapa de historial de afiliaciones. No existe todavía exportador PILA.
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
  laborales y `sede`. PR #160 agrega captura manual del historial por empleado,
  pero no carga masiva ni validación de catálogo.
- No existe un exportador PILA funcional en la API ni en la web.

El Ministerio publica anexos técnicos para PILA y los operadores documentan
cargue de archivos planos. La página oficial de PILA publica actualmente el
Anexo Técnico 2 completo, versión 30, fechado el 24 de julio de 2026. Esa
versión contiene los archivos tipo 1 y tipo 2 y el capítulo 5 de plazos de
implementación. La Resolución 1529 del 24 de julio, publicada en el Diario
Oficial 53.566 del 27 de julio de 2026, es la actualización normativa que
corresponde a esa versión; por tanto, AT2 v29, fechado el 6 de enero de 2026,
se conserva solo como referencia histórica, no como layout vigente. Por
ejemplo, AT2 v30 dispone que los cambios para el cotizante 75 y la planilla E
aplican a pagos desde el 1 de noviembre de 2026 para el período de salud de
noviembre. La versión de reglas aplicable depende por eso del período de
cotización y de la fecha prevista de pago, no solo del día en que se genera el
archivo.

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

| Prueba                                                                                                     | Resultado esperado                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trabajador dependiente estándar (tipo de cotizante 1, planilla E), afiliaciones vigentes y nómina aprobada | Generar archivos tipo 1 y tipo 2 conforme al AT2 v30 (24-07-2026) y a sus hitos vigentes para el período cotizado/fecha prevista de pago; conservar IBC/aportes aprobados sin recalcular; mostrar versiones normativa y de formato, período, fecha prevista de pago, snapshots fuente y hash. |
| Afiliación con cambio de administradora                                                                    | Elegir la afiliación cuya vigencia cubre el período; conservar visible y auditable la anterior.                                                                                                                                                                                               |
| Campo heredado con EPS/AFP/ARL/caja como texto libre                                                       | No inferir código ni generar archivo; pedir mapeo y confirmación explícitos.                                                                                                                                                                                                                  |
| Afiliación ausente, vencida, futura, solapada o con hueco de vigencia                                      | Bloquear al trabajador afectado con campo, período y causa identificables.                                                                                                                                                                                                                    |
| Nómina no aprobada, snapshot ausente o snapshot de otro tenant                                             | Bloquear exportación; no recalcular Payroll ni permitir lectura cruzada de tenant.                                                                                                                                                                                                            |
| Tipo/subtipo/novedad no incluido en la matriz de versión                                                   | Bloquear con error trazable; no sustituir por código genérico.                                                                                                                                                                                                                                |
| Cotizante 75 / regla especial de régimen subsidiado                                                        | Rechazar como fuera de alcance del MVP y explicar que requiere una fase compatible con la Resolución 1529 y demás norma vigente; no producir un archivo parcial engañoso.                                                                                                                     |
| Resolución 1529, pagos desde 1 de octubre de 2026 para pensiones del período septiembre                    | Probar las validaciones/origen actualizados de los campos de identificación del aportante, representante, cotizante y cotizante principal definidos en 5.84; rechazar valores inválidos con el campo exacto.                                                                                  |
| Resolución 1529, pagos desde 1 de noviembre de 2026 para salud del período noviembre                       | Aplicar el hito normativo; bloquear tipo 75 por estar fuera del MVP y verificar que el caso estándar tipo 1/planilla E sigue usando únicamente sus reglas aprobadas.                                                                                                                          |
| Hito escalonado futuro o fecha de pago ausente                                                             | Seleccionar reglas por período de cotización y fecha prevista de pago; bloquear si falta la fecha y no se puede determinar una versión única.                                                                                                                                                 |
| Período/catálogo que cruza una vigencia de formato                                                         | Seleccionar la versión aplicable al período y fecha de pago o bloquear si se cruzan vigencias sin regla aprobada.                                                                                                                                                                             |
| Archivo de prueba                                                                                          | Verificar byte layout, posiciones, longitudes, catálogos, dígitos de control, codificación y validaciones cruzadas contra fixtures oficiales de cada versión vigente.                                                                                                                         |
| Reintento/corrección                                                                                       | Reintentar la misma exportación sin duplicar; una corrección crea una exportación nueva vinculada, conserva archivo/versiones/hash previos.                                                                                                                                                   |
| Diferencia de estados                                                                                      | La generación local solo presenta “generado” o “validado localmente”; aceptación, liquidación y pago requieren evidencia del operador/usuario y no se simulan.                                                                                                                                |
| Carga en operador                                                                                          | Mantener evidencia fechada y versionada. SOI, Enlace Operativo/SuAporte o Aportes en Línea solo se marcan compatibles si su carga real de prueba fue aceptada.                                                                                                                                |

La matriz de aceptación debe registrar casos incluidos, códigos oficiales,
archivos de entrada/salida esperados, regla normativa exacta, fecha de vigencia,
resultado esperado y revisor. No se anunciará “cargable en cualquier operador”
hasta completar pruebas independientes por operador.

## Contraste de preparación contra AT2 v30 — 2026-10-30

Se descargó el recurso enlazado por la [página oficial PILA de MinSalud](https://www.minsalud.gov.co/Proteccion-Social/Paginas/pila.aspx)
y se verificó directamente su portada técnica: 336 páginas, código AT2,
versión 30, fecha 24-07-2026. El archivo declara campos numéricos alineados a
la derecha y rellenados con ceros a la izquierda, y campos alfanuméricos
alineados a la izquierda y rellenados con espacios a la derecha. El layout
revisado fija 567 caracteres para el archivo tipo 1, 359 para el registro tipo
1 del archivo tipo 2 y 693 para cada registro tipo 2.

| Registro/campos relevantes                                                                                    | Fuente actual verificada                                                                                                                                                                                                                               | Brecha antes de serializar                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tipo 1: identidad y contacto del aportante, municipio, CIIU, representante legal, clasificación y exoneración | `Tenant` conserva razón social, NIT y dígito, dirección, municipio, teléfono, email, representante legal como texto y `aportesExonerados`.                                                                                                             | No hay tipo de persona/naturaleza/clase/formato de presentación PILA, CIIU DANE del aportante ni identificación y nombres estructurados del representante. No se deben inferir ni fabricar.                                                                                                                                                                                                                              |
| Tipo 2, registro 01: planilla E, períodos, número de cotizantes, bases totales y ARL del aportante            | `PayrollPeriod` conserva inicio/fin; `Tenant` contiene política de exoneración.                                                                                                                                                                        | No existe fecha prevista de pago, necesaria para elegir hitos; no se conserva el código ARL del aportante. Algunos campos los asigna el operador y su representación en un archivo plano debe verificarse por operador.                                                                                                                                                                                                  |
| Tipo 2, registro 02: identidad, tipo/subtipo, sede y administradoras                                          | `Empleado` conserva identificación, nombres y fechas laborales; `PayrollSnapshot` conserva `employeeId` y `sedeId`; `Sede` relaciona municipio DANE; `AfiliacionSeguridadSocial` conserva tipo/subtipo y códigos de EPS/pensión/ARL/CCF con vigencias. | Identidad, fechas laborales y municipio de sede no están congelados en el snapshot. La afiliación no comprueba pertenencia a catálogos oficiales. El exportador no debe leer valores maestros mutables como si fueran aprobados; debe congelar la fuente y su valor para cada dato, o incorporarlo al snapshot aprobado. Sede o municipio ausente debe bloquear el registro, no sustituirse por un valor predeterminado. |
| Tipo 2, registro 02: días por subsistema, salarios/IBC por subsistema, valores y novedades                    | `PayrollSnapshot` congela salario usado, un IBC, conceptos, totales, fechas del período y novedades trazadas; los conceptos incluyen códigos, bases, factores y valores.                                                                               | No congela días de cotización por sistema ni horas; conserva un IBC en vez de bases explícitas por subsistema; `PayrollNovelty` guarda una fecha, no intervalos de inicio/fin PILA. No se deben recalcular estos datos durante la exportación.                                                                                                                                                                           |
| Tipo 2, campos 61–63 y 78/98: tarifa, centro de trabajo, clase y actividad económica de riesgos               | El contrato congelado conserva clase de riesgo y la afiliación el código/clase ARL; hay sedes con municipio.                                                                                                                                           | No se encontró un código de actividad económica ARL ni código de centro de trabajo asociado al empleado/contrato/sede. Deben capturarse y validarse antes de producir esos campos.                                                                                                                                                                                                                                       |

La revisión confirma que el diseño aprobado es viable, pero el exportador todavía
no tiene datos suficientes para producir un archivo válido de manera general.
**GOAL ACTIVO:** GOAL-02. **IMPLEMENTACIÓN BLOQUEADA:** serializar tipo 1/2 hasta
capturar y validar los datos patronales, laborales y los días/IBC requeridos.
**ARQUITECTURA DISPONIBLE:** ADR-013 y el historial tenant-scoped de afiliaciones
del PR #160 permiten preparar esos insumos sin alterar PayrollSnapshot histórico
ni mapear automáticamente los campos heredados.

El siguiente incremento debe cerrar estas brechas como hechos explícitos de
empresa, sede/contrato y snapshot aprobado. La exportación solo empieza cuando
los valores y un fixture anonimizado tipo 1/2 tengan mapeo campo por campo,
regla de vigencia y salida esperada revisados contra AT2 v30.

## Primera etapa: historial de afiliaciones

PR #160 agrega el almacenamiento aditivo de
afiliaciones por empleado, tipo de cotizante dependiente estándar, entidades y
clase de riesgo capturadas manualmente, vigencias no solapadas, RLS por tenant,
auditoría y una pantalla de captura en el detalle del empleado. Cada registro
representa el conjunto completo de administradoras confirmado por el empleador
para un mismo período de vigencia. Si cambia una de ellas, se registra el
conjunto vigente completo como una nueva versión; una vigencia abierta anterior
se cierra el día previo. Las versiones históricas se conservan y no se
convierten los campos de texto heredados.

Esta etapa solo conserva lo declarado por el aportante. Aún no comprueba que el
código exista en un catálogo oficial, no genera archivos tipo 1/2 y no demuestra
aceptación de un operador. Esa validación sigue siendo una dependencia previa a
la exportación y a cualquier afirmación de compatibilidad.

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
- [Página oficial PILA de MinSalud](https://www.minsalud.gov.co/Proteccion-Social/Paginas/pila.aspx)
  enlaza el [Anexo Técnico 2 de cotizantes, AT2 versión 30](https://www.minsalud.gov.co/sites/rid/Lists/BibliotecaDigital/RIDE/DE/OT/anexo-tecnico2-cotizantes.pdf),
  fechado el 24 de julio de 2026. El PDF completo consultado tiene 336 páginas;
  sus páginas 9–16 definen el archivo tipo 1, las páginas 26–30 el encabezado
  del archivo tipo 2, las páginas 81–101 el registro de detalle y las
  páginas 332–335 los hitos 5.84–5.91 de implementación. AT2 v29, 6 de enero
  de 2026, queda como referencia histórica. La versión 30 se usa como línea
  base del MVP y se vuelve a verificar contra la página de MinSalud antes de
  cada release.
- [Resolución 1529 de 2026](https://normativa.colpensiones.gov.co/colpens/compilacion/docs/resolucion_minsaludps_1529_2026.htm),
  expedida el 24 y publicada el 27 de julio de 2026 en el Diario Oficial
  53.566; modifica los Anexos Técnicos 2 y 3. Sus fechas escalonadas aparecen
  consolidadas en AT2 v30; los numerales 5.87 y 5.91 fijan el 1 de noviembre
  de 2026 para pagos del período de salud noviembre en el caso del cotizante 75.
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
