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
  fecha prevista de pago de aportes PILA. Los hitos de la Resolución 1529
  dependen de cuándo el aportante paga la planilla y del período cotizado, no
  de cuándo paga el salario. El exportador debe pedir/registrar la fecha
  prevista de pago para esa planilla o bloquear cuando no pueda resolver
  inequívocamente la regla aplicable.
- `PayrollNoveltyType` ofrece `VACATION`, `SICKNESS`, `LICENSE`, `OVERTIME`,
  `BONUS` y `OTHER`; no es el catálogo/código de reporte PILA.
- El formulario de alta/edición y sus DTOs no capturan afiliaciones ni datos
  PILA. La plantilla e importador XLSX solo incluyen datos personales,
  laborales y `sede`. PR #160 agrega captura manual del historial por empleado,
  pero no carga masiva ni validación de catálogo.
- No existe un exportador PILA funcional en la API ni en la web.

El Ministerio publica anexos técnicos para PILA y los operadores documentan
cargue de archivos planos. Revalidado el 2026-10-30, la [página oficial PILA de
MinSalud](https://www.minsalud.gov.co/Proteccion-Social/Paginas/pila.aspx)
enlaza un PDF que identifica AT2 versión 30, fechado el 24 de julio de 2026
(336 páginas). La portada del contenido incluye la Resolución 1529 de 2026
entre los actos incorporados; por tanto, AT2 v30 es la base consolidada oficial
verificada para los archivos de activos. La [Resolución 1529 de
2026](https://www.minsalud.gov.co/sites/rid/Lists/BibliotecaDigital/RIDE/DE/DIJ/resolucion-1529-de-2026.pdf)
continúa como fuente de interpretación para sus cambios y plazos, y modifica
también el Anexo Técnico 3. La matriz debe contrastarse campo por campo con
AT2 v30 y con cualquier norma posterior antes de implementar el serializador.
Para algunos hitos la regla seleccionada depende del período cotizado y de la
fecha prevista de pago de los aportes PILA; no se puede inferirla de la fecha
de pago del salario ni de la fecha de generación del archivo.

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
   toma en cuenta el período cotizado y la fecha prevista de pago de aportes
   PILA para esa planilla, no la fecha de pago del salario. La fecha capturada
   en el período solo es una previsión; la exportación deberá confirmar y
   conservar la fecha elegida junto con sus versiones, sin tratarla como prueba
   de pago ni reescribir el snapshot de nómina si la fecha cambia. La línea
   base es AT2 v30 y toda norma posterior vigente a la fecha de pago. La
   Resolución 1529 no se vuelve a aplicar por separado sobre v30 para evitar
   duplicar sus cambios consolidados.
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

| Prueba                                                                                                           | Resultado esperado                                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trabajador dependiente estándar (tipo de cotizante 1, planilla E), afiliaciones vigentes y nómina aprobada       | Generar archivos tipo 1 y tipo 2 solo después de mapear y probar el layout de AT2 v30 y sus reglas de vigencia; conservar IBC/aportes aprobados sin recalcular; mostrar versiones normativa y de formato, período, fecha prevista de pago de aportes PILA, snapshots fuente y hash.                                                                |
| Afiliación con cambio de administradora                                                                          | Elegir la afiliación cuya vigencia cubre el período; conservar visible y auditable la anterior.                                                                                                                                                                                                                                                    |
| Campo heredado con EPS/AFP/ARL/caja como texto libre                                                             | No inferir código ni generar archivo; pedir mapeo y confirmación explícitos.                                                                                                                                                                                                                                                                       |
| Afiliación ausente, vencida, futura, solapada o con hueco de vigencia                                            | Bloquear al trabajador afectado con campo, período y causa identificables.                                                                                                                                                                                                                                                                         |
| Nómina no aprobada, snapshot ausente o snapshot de otro tenant                                                   | Bloquear exportación; no recalcular Payroll ni permitir lectura cruzada de tenant.                                                                                                                                                                                                                                                                 |
| Tipo/subtipo/novedad no incluido en la matriz de versión                                                         | Bloquear con error trazable; no sustituir por código genérico.                                                                                                                                                                                                                                                                                     |
| Cotizante 75 / regla especial de régimen subsidiado                                                              | Rechazar como fuera de alcance del MVP y explicar que requiere una fase compatible con la Resolución 1529 y demás norma vigente; no producir un archivo parcial engañoso.                                                                                                                                                                          |
| Resolución 1529, pagos PILA desde 1 de octubre de 2026 para pensiones del período septiembre                     | Probar las validaciones/origen actualizados de los campos de identificación del aportante, representante, cotizante y cotizante principal definidos en 5.84; rechazar valores inválidos con el campo exacto.                                                                                                                                       |
| Resolución 1529, pagos PILA desde 1 de noviembre de 2026 para salud del período noviembre                        | Aplicar el hito normativo; bloquear tipo 75 por estar fuera del MVP y verificar que el caso estándar tipo 1/planilla E sigue usando únicamente sus reglas aprobadas.                                                                                                                                                                               |
| Hito escalonado futuro o fecha prevista de pago PILA ausente                                                     | Seleccionar reglas por período cotizado y fecha prevista de pago de aportes para la planilla; bloquear si falta la fecha y no se puede determinar una versión única.                                                                                                                                                                               |
| Período/catálogo que cruza una vigencia de formato                                                               | Seleccionar la versión aplicable al período y fecha prevista de pago de aportes PILA o bloquear si se cruzan vigencias sin regla aprobada.                                                                                                                                                                                                         |
| Estructura física AT2 v30 (§0, §1.1, §2.1.1.1 y §2.1.2.1)                                                        | Con un fixture revisado, producir tipo 1 de 567 caracteres, un encabezado tipo 2 de 359 caracteres y un detalle tipo 2 de 693 caracteres por cotizante; respetar orden de registros, posiciones y padding numérico/alfa-numérico. La codificación, terminadores de línea y empaquetado se confirman por operador antes de declarar compatibilidad. |
| Integridad del encabezado frente a detalles (AT2 v30 campos 19–20 del registro 01 y campo 45 del registro 02)    | Para un fixture estándar de dependientes tipo 1, el campo 19 coincide con los cotizantes únicos; el campo 20 suma los IBC CCF (campo 45) de quienes deben aportar a CCF y es cero para quienes no están obligados. Bloquear si fuente/snapshot y archivo difieren; no recalcular IBC durante la exportación.                                       |
| Campos atribuidos al operador (por ejemplo, modalidad, radicación, fecha efectiva de pago y código del operador) | No inventar ni presentar como confirmado un dato generado/asignado por el operador; aplicar solo la convención de carga que haya superado prueba documentada para ese operador y formato.                                                                                                                                                          |
| Reintento/corrección                                                                                             | Reintentar la misma exportación sin duplicar; una corrección crea una exportación nueva vinculada, conserva archivo/versiones/hash previos.                                                                                                                                                                                                        |
| Diferencia de estados                                                                                            | La generación local solo presenta “generado” o “validado localmente”; aceptación, liquidación y pago requieren evidencia del operador/usuario y no se simulan.                                                                                                                                                                                     |
| Carga en operador                                                                                                | Mantener evidencia fechada y versionada. SOI, Enlace Operativo/SuAporte o Aportes en Línea solo se marcan compatibles si su carga real de prueba fue aceptada.                                                                                                                                                                                     |

La matriz de aceptación debe registrar casos incluidos, códigos oficiales,
archivos de entrada/salida esperados, regla normativa exacta, fecha de vigencia,
resultado esperado y revisor. No se anunciará “cargable en cualquier operador”
hasta completar pruebas independientes por operador.

## Revalidación de fuentes PILA — 2026-10-30

El enlace publicado actualmente por la [página oficial PILA de MinSalud](https://www.minsalud.gov.co/Proteccion-Social/Paginas/pila.aspx)
resuelve al PDF `anexo-tecnico2-cotizantes.pdf`. En la descarga directa
revalidada el 2026-10-30, su portada identifica código AT2, versión 30, fecha
24-07-2026 (336 páginas) y enumera la Resolución 1529 de 2026 entre los actos
incorporados. La [Resolución 1529 de
2026](https://www.minsalud.gov.co/sites/rid/Lists/BibliotecaDigital/RIDE/DE/DIJ/resolucion-1529-de-2026.pdf)
también se conserva como fuente oficial para interpretar sus disposiciones y
plazos, y modifica el Anexo Técnico 3. Su texto está disponible además en la
[compilación jurídica de
Colpensiones](https://normativa.colpensiones.gov.co/colpens/compilacion/docs/resolucion_minsaludps_1529_2026.htm).
La [Resolución 1641 de 2026](https://www.minsalud.gov.co/sites/rid/Lists/BibliotecaDigital/RIDE/DE/DIJ/resolucion-1641-de-2026.pdf)
confirma que la 1529 modifica los anexos y que el formulario de afiliación y
novedades de riesgos laborales es un artefacto normativo separado.

La comprobación directa encontró que el AT2 enlazado tiene 336 páginas y que
la Resolución 1529 tiene 58. La base documental de layout es AT2 v30; la matriz
debe contrastar sus reglas consolidadas, los hitos de aplicación descritos en
la resolución y cualquier norma posterior, evitando duplicar modificaciones
que ya estén incorporadas en v30.
Entre los hitos comprobados, las validaciones/orígenes de los campos de
identificación del aportante y representante legal (tipo 1, campos 3 y 18) y
del cotizante y cotizante principal (tipo 2, campos 4 y 75) rigen para pagos
desde el 1 de octubre de 2026 del período pensional septiembre de 2026. Las
aclaraciones de planilla E y el cambio del cotizante 75 tienen un hito distinto:
pagos desde el 1 de noviembre de 2026 para salud del período noviembre de 2026;
el cotizante 75 sigue excluido del MVP.

La lectura directa del PDF oficial reconcilió la estructura física de los
registros, sin cerrar todavía el mapeo funcional. AT2 v30 define dos archivos
de entrada y fija relleno con ceros a la izquierda para campos numéricos y con
espacios a la derecha para alfanuméricos (§0, p. 9). El archivo tipo 1 tiene 34
campos y 567 caracteres (§1.1, pp. 9–16); el archivo tipo 2 tiene un registro
01 de encabezado, con 22 campos y 359 caracteres (§2.1.1.1, pp. 26–30), y
registros 02 de detalle, uno por cotizante, con 98 campos y 693 caracteres
(§§2.1.2–2.1.2.1, pp. 80–102). Estos tamaños y límites son evidencia de
estructura, no una especificación suficiente para generar archivos: siguen
pendientes el origen y validación de cada dato, su vigencia normativa,
catálogos, los valores asignados/calculados por el operador y las convenciones
de carga de cada operador. La matriz siguiente registra esta distinción; no se
debe usar aún como fixture ejecutable.

| Registro/campos relevantes                                                                                                                                                                                                                                                                                                                                   | Fuente actual verificada                                                                                                                                                                                                                               | Brecha antes de serializar                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Archivo tipo 1 (§1.1, pp. 9–16): campos 1–34, 567 caracteres. Incluye identidad del aportante (1–4), clasificación/naturaleza/persona/presentación (7–10), dirección y DIVIPOLA/CIIU (11–14), representante legal (18–24), tipo de aportante (30) y exoneración/beneficio CCF (33–34).                                                                       | `Tenant` conserva razón social, NIT y dígito, dirección, municipio, teléfono, email, representante legal como texto y `aportesExonerados`.                                                                                                             | No hay tipo de persona/naturaleza/clase/formato de presentación PILA, CIIU DANE del aportante ni identificación y nombres estructurados del representante. No se deben inferir ni fabricar.                                                                                                                                                                                                                              |
| Archivo tipo 2, registro 01 (§2.1.1.1, pp. 26–30): campos 1–22, 359 caracteres; un encabezado por planilla. Para este alcance, campo 8 = planilla E. Campos 14–16 incluyen ARL y períodos de cotización; 19–20 contienen cantidad de cotizantes y valor total de nómina según IBC CCF.                                                                       | `PayrollPeriod` captura una fecha prevista de pago de aportes PILA opcional y los snapshots nuevos la conservan en `period.fechaPrevistaPagoPila`. `Tenant` contiene política de exoneración.                                                          | La fecha prevista no es la fecha de pago del salario ni prueba el pago de PILA. No se conserva el código ARL del aportante. Los campos que el AT2 atribuye al operador (por ejemplo, modalidad, radicación, pago efectivo y código del operador) no pueden fabricarse; su representación en carga debe verificarse por operador.                                                                                         |
| Archivo tipo 2, registro 02 (§§2.1.2–2.1.2.1, pp. 80–102): campos 1–98, 693 caracteres; un registro por cotizante. Comprende identidad/tipo/subtipo/ubicación (3–14), novedades (15–30 y fechas 80–94), administradoras (31–35 y 77), días/salario/IBC (36–45), tarifas/aportes (46–75) y datos de riesgos, incluidas clase (78) y actividad económica (98). | `Empleado` conserva identificación, nombres y fechas laborales; `PayrollSnapshot` conserva `employeeId` y `sedeId`; `Sede` relaciona municipio DANE; `AfiliacionSeguridadSocial` conserva tipo/subtipo y códigos de EPS/pensión/ARL/CCF con vigencias. | Identidad, fechas laborales y municipio de sede no están congelados en el snapshot. La afiliación no comprueba pertenencia a catálogos oficiales. El exportador no debe leer valores maestros mutables como si fueran aprobados; debe congelar la fuente y su valor para cada dato, o incorporarlo al snapshot aprobado. Sede o municipio ausente debe bloquear el registro, no sustituirse por un valor predeterminado. |
| Archivo tipo 2, registro 02: días y bases de cotización por subsistema (campos 36–45), aportes por entidad (46–75), exoneración (76), ARL/clase de riesgo (77–78), novedades fechadas (80–94), horas (96) y actividad económica de riesgos (98).                                                                                                             | `PayrollSnapshot` congela salario usado, un IBC, conceptos, totales, fechas del período y novedades trazadas; los conceptos incluyen códigos, bases, factores y valores. El contrato conserva clase de riesgo y la afiliación el código/clase ARL.     | No congela días de cotización por sistema ni horas; conserva un IBC en vez de bases explícitas por subsistema; `PayrollNovelty` guarda una fecha, no intervalos de inicio/fin PILA. No se encontró código de actividad económica ARL ni código de centro de trabajo asociado al empleado/contrato/sede. No recalcular ni inferir estos datos durante la exportación.                                                     |

La revisión confirma que el diseño aprobado es viable, pero el exportador todavía
no tiene datos suficientes para producir un archivo válido de manera general.
**GOAL ACTIVO:** GOAL-02. **IMPLEMENTACIÓN BLOQUEADA:** serializar tipo 1/2 hasta
capturar y validar los datos patronales, laborales y los días/IBC requeridos.
**ARQUITECTURA DISPONIBLE:** ADR-013 y el historial tenant-scoped de afiliaciones
del PR #160 permiten preparar esos insumos sin alterar PayrollSnapshot histórico
ni mapear automáticamente los campos heredados.

El incremento en curso captura en el período la fecha prevista de pago de
aportes PILA (distinta del pago del salario) y la añade al payload de snapshots
nuevos; no reescribe snapshots históricos. La previsión no demuestra que los
aportes se pagaron. La futura exportación deberá confirmar y conservar su fecha
prevista y versión normativa propias; si la fecha falta y no puede resolverse
el hito normativo, bloqueará la generación.

El siguiente incremento debe cerrar estas brechas como hechos explícitos de
empresa, sede/contrato y snapshot aprobado. La exportación solo empieza cuando
los valores y un fixture anonimizado tipo 1/2 tengan mapeo campo por campo,
regla de vigencia y salida esperada revisados contra el AT2 publicado y cada
modificación normativa aplicable; si no puede reconstruirse una especificación
única y verificable, se bloquea el serializador.

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
- `apps/api/prisma/schema.prisma` — `PayrollPeriod` conserva `fechaInicio`,
  `fechaFin` y `fechaPrevistaPagoPila` nullable; el servicio congela esta última
  previsión PILA en el payload del snapshot aprobado. No representa el pago del
  salario ni el pago efectivo de aportes.
- [Página oficial PILA de MinSalud](https://www.minsalud.gov.co/Proteccion-Social/Paginas/pila.aspx)
  enlaza el PDF `anexo-tecnico2-cotizantes.pdf`. La descarga directa revisada
  el 2026-10-30 identifica AT2 v30, 24-07-2026 (336 páginas) e incluye la
  Resolución 1529 de 2026 entre los actos incorporados.
- [Resolución 1529 de 2026](https://www.minsalud.gov.co/sites/rid/Lists/BibliotecaDigital/RIDE/DE/DIJ/resolucion-1529-de-2026.pdf),
  expedida el 24 de julio de 2026 (PDF oficial de 58 páginas), modifica los
  Anexos Técnicos 2 y 3 y fija fechas escalonadas. Su artículo 1 incorpora
  cambios específicos al AT2; los numerales 5.84–5.93 indican vigencias, entre
  ellas pagos desde octubre para identificación y pagos desde noviembre para
  aclaraciones de planilla E y cotizante 75. La Resolución 1641 de 2026 del
  propio MinSalud también la identifica como modificatoria de esos anexos. La
  matriz debe cotejar el texto consolidado de AT2 v30, sus hitos de aplicación
  y normas posteriores sin duplicar modificaciones ya incorporadas.
- [Resolución 611 de 2026](https://www.minsalud.gov.co/Normatividad_Nuevo/Resolucion%20No%20611%20de%202026.pdf),
  permanencia temporal en régimen subsidiado de ciertas personas vinculadas
  laboralmente; establece un plazo de seis meses para ajustes operativos PILA.
- [Publicaciones regulatorias de MinSalud](https://www.minsalud.gov.co/Normativa/Paginas/Resoluciones.aspx)
  — revisado el 2026-10-30, publica el proyecto de ajuste de los numerales
  5.87 y 5.91 del Anexo Técnico 2 para el cotizante con permanencia en régimen
  subsidiado. Sigue identificado como proyecto/consulta pública; no sustituye
  la Resolución 1529 mientras no se expida una norma definitiva.
- [SOI](https://www.soi.com.co/empresa-servicios-de-soi),
  [Enlace Operativo/SuAporte](https://www.enlace.com.co/hubfs/Manuales/C%C3%B3mo%20cargar%20un%20archivo%20plano%20en%20SuAporte.pdf?hsLang=es-co)
  y [Aportes en Línea](https://www.aportesenlinea.com/Documents/Instructivo%20Corrector%20por%20Pantalla%20v.1.3.pdf)
  documentan el cargue de archivos planos.
