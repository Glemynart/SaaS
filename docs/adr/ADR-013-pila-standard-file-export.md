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
   La fecha prevista se maneja como día calendario YYYY-MM-DD, no como instante
   ni timestamp con zona horaria; se rechazan timestamps y fechas imposibles.
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

El empleador puede registrar o cambiar la fecha prevista después de crear el
período, mientras siga en BORRADOR, CALCULADA o EN_REVISION. La API la actualiza
con tenant activo y auditoría; la aprobación congela el valor en el snapshot y
ya no permite modificarlo.

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
| Snapshot PILA incompleto o de versión histórica                                                                  | Bloquear la exportación sin leer empleado, contrato, sede, tenant o afiliación actuales para completar campos y sin backfill de snapshots históricos. Admitir solo una versión aprobada que congele todos los insumos requeridos por la matriz AT2 seleccionada.                                                                                   |
| Cambios posteriores en empleado, contrato, sede o afiliación                                                     | La exportación conserva los datos congelados al aprobarse; cambios posteriores en registros maestros no alteran el archivo ni la evidencia de exportación.                                                                                                                                                                                         |
| Tipo/subtipo/novedad no incluido en la matriz de versión                                                         | Bloquear con error trazable; no sustituir por código genérico.                                                                                                                                                                                                                                                                                     |
| Cotizante 75 / regla especial de régimen subsidiado                                                              | Rechazar como fuera de alcance del MVP y explicar que requiere una fase compatible con la Resolución 1529 y demás norma vigente; no producir un archivo parcial engañoso.                                                                                                                                                                          |
| Resolución 1529, pagos PILA desde 1 de octubre de 2026 para pensiones del período septiembre                     | Probar las validaciones/origen actualizados de los campos de identificación del aportante, representante, cotizante y cotizante principal definidos en 5.84; rechazar valores inválidos con el campo exacto.                                                                                                                                       |
| Resolución 1529, pagos PILA desde 1 de noviembre de 2026 para salud del período noviembre                        | Aplicar el hito normativo; bloquear tipo 75 por estar fuera del MVP y verificar que el caso estándar tipo 1/planilla E sigue usando únicamente sus reglas aprobadas.                                                                                                                                                                               |
| Hito escalonado futuro o fecha prevista de pago PILA ausente                                                     | Seleccionar reglas por período cotizado y fecha prevista de pago de aportes para la planilla; bloquear si falta la fecha y no se puede determinar una versión única.                                                                                                                                                                               |
| Entrada de fecha prevista al crear el período                                                                    | Aceptar solo YYYY-MM-DD válido; rechazar timestamps con hora/zona y fechas imposibles; permitir nulo si se desconoce la previsión y conservar esa ausencia en snapshots nuevos.                                                                                                                                                                    |
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

### Auditoría campo por campo: archivo tipo 1 del AT2 v30

La siguiente matriz coteja §1.1 (pp. 9–16) del AT2 v30 descargado de MinSalud
con el modelo `Tenant` y el catálogo `MunicipioDane` actuales. Es una auditoría
de preparación, no una autorización para serializar. “Capturado” significa que
hay un campo candidato; antes de exportar se debe validar su origen, formato,
vigencia y si fue confirmado por el aportante. Los campos que AT2 asigna al
sistema no se rellenan con códigos inventados ni se afirman compatibles sin una
prueba de carga por operador.

| Campo AT2 | Dato requerido                                             | Fuente actual comprobada                                                                                                                      | Estado previo a exportar                                                                                                                          |
| --------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1         | Nombre o razón social, 200 A                               | `Tenant.razonSocial`                                                                                                                          | Capturado; bloquear si está vacío y validar longitud/normalización del operador.                                                                  |
| 2         | Tipo de documento del aportante, 2 A                       | El registro de empresa captura NIT; `Tenant` no guarda un selector separado.                                                                  | Mapear a `NI` solo tras confirmar que el aportante se registró con NIT; no deducir otros tipos.                                                   |
| 3         | Identificación del aportante sin dígito, 16 A              | `Tenant.nit`                                                                                                                                  | Capturado; validar caracteres y longitud según el tipo de documento confirmado.                                                                   |
| 4         | Dígito de verificación, 1 N                                | `Tenant.digitoVerif`                                                                                                                          | Capturado; AT2 condiciona su uso al tipo de persona y exige cero en otros casos. No se puede cerrar mientras falte el tipo de persona.            |
| 5         | Código de sucursal/dependencia, 10 A                       | No existe dato de sucursal PILA en `Tenant`; `Sede` es una ubicación operacional.                                                             | Falta. No convertir automáticamente una sede del producto en sucursal PILA.                                                                       |
| 6         | Nombre de sucursal/dependencia, 40 A                       | No existe dato de sucursal PILA en `Tenant`.                                                                                                  | Falta cuando la presentación sea por sucursal; la representación única/sucursales debe confirmarse con el aportante y el operador.                |
| 7         | Clase de aportante, 1 A                                    | No existe campo de clase. El código depende del total de cotizantes de todas las sucursales y de categorías legales especiales.               | Calcular A/B solo desde el conjunto completo de cotizantes de la planilla. C/D requieren elegibilidad expresa y evidencia; no inferir beneficios. |
| 8         | Naturaleza jurídica, 1 N                                   | No existe campo equivalente en `Tenant`.                                                                                                      | Falta; requiere selección validada (pública, privada, mixta u otra categoría AT2).                                                                |
| 9         | Tipo de persona, 1 A                                       | No existe campo equivalente en `Tenant`. `razonSocial` no lo demuestra por sí sola.                                                           | Falta; requiere declarar natural/jurídica. Este dato condiciona los campos 4, 18 y 20.                                                            |
| 10        | Forma de presentación, 1 A                                 | No existe campo equivalente. `Sede` no representa sucursal PILA.                                                                              | Falta; definir presentación única o por sucursal desde una configuración explícita del aportante.                                                 |
| 11        | Dirección de correspondencia, 40 A                         | `Tenant.direccion`, nullable.                                                                                                                 | Capturado parcialmente; es obligatorio en AT2, por lo que la ausencia debe bloquear.                                                              |
| 12        | Código de ciudad/municipio, 3 A                            | `Tenant.municipioId → MunicipioDane.codigo`; el código maestro es el DIVIPOLA completo.                                                       | Candidato disponible si hay municipio; validar el formato y separar el código oficial de municipio según DIVIPOLA. Bloquear si falta o no valida. |
| 13        | Código de departamento, 2 A                                | El mismo `MunicipioDane.codigo`; `Tenant.departamento` es texto heredado.                                                                     | Derivable solo desde el código DIVIPOLA confirmado; no exportar el nombre de departamento ni inferirlo del texto legado.                          |
| 14        | Código DANE de actividad económica, 4 N                    | No existe CIIU/Código DANE del aportante en `Tenant`.                                                                                         | Falta; bloquear hasta capturar y validar el código vigente de actividad económica.                                                                |
| 15        | Teléfono, 10 N                                             | `Tenant.telefono`, nullable.                                                                                                                  | Capturado parcialmente; obligatorio y numérico en AT2. Bloquear si falta o si no satisface longitud/formato probado.                              |
| 16        | Fax, 10 N                                                  | No existe campo de fax.                                                                                                                       | No disponible; confirmar si el operador acepta valor vacío y su padding antes de serializar.                                                      |
| 17        | Correo electrónico, 60 A                                   | `Tenant.email`, nullable.                                                                                                                     | Candidato disponible; validar longitud y sintaxis AT2 cuando exista. No confundirlo con el correo de un usuario administrador.                    |
| 18        | Identificación del representante legal, 16 A               | `Tenant.representanteLegal` conserva solo un nombre libre.                                                                                    | Falta para persona jurídica; capturar tipo y número de documento por separado. AT2 lo marca opcional para persona natural.                        |
| 19        | Dígito de verificación del representante, 1 N              | AT2 indica reportar cero.                                                                                                                     | Constante `0` según v30; mantener la regla ligada a la versión del formato.                                                                       |
| 20        | Tipo de identificación del representante, 2 A              | No existe campo estructurado.                                                                                                                 | Falta para persona jurídica; no inferirlo del nombre ni del NIT del aportante.                                                                    |
| 21        | Primer apellido del representante, 20 A                    | Solo hay el texto libre `Tenant.representanteLegal`.                                                                                          | Falta; capturar partes del nombre estructuradas, no dividir el texto automáticamente.                                                             |
| 22        | Segundo apellido del representante, 30 A                   | Solo hay el texto libre `Tenant.representanteLegal`.                                                                                          | Falta; capturar explícitamente o aplicar la opcionalidad exacta que confirme el operador.                                                         |
| 23        | Primer nombre del representante, 20 A                      | Solo hay el texto libre `Tenant.representanteLegal`.                                                                                          | Falta para persona jurídica; capturar estructurado.                                                                                               |
| 24        | Segundo nombre del representante, 30 A                     | Solo hay el texto libre `Tenant.representanteLegal`.                                                                                          | Falta; capturar explícitamente o probar la regla de vacío del operador.                                                                           |
| 25        | Fecha de concordato/restructuración/liquidación/cese, 10 A | No existe dato equivalente en `Tenant`.                                                                                                       | Condicional; si se reporta la acción 26, capturar y validar la fecha. No fabricar una fecha para completar el archivo.                            |
| 26        | Tipo de acción, 1 N                                        | No existe dato equivalente en `Tenant`.                                                                                                       | Condicional; `0` significa “no aplica”, pero debe ser una decisión explícita, no un relleno genérico.                                             |
| 27        | Fecha de terminación de actividades, 10 A                  | No existe dato equivalente en `Tenant`.                                                                                                       | Condicional a la acción; capturar únicamente si aplica y validarla contra la fuente aportada.                                                     |
| 28        | Código del operador, 2 N                                   | AT2 lo asigna al sistema.                                                                                                                     | Dependencia del operador; no inventar. Solo incluir bajo una convención de carga probada y documentada para ese operador.                         |
| 29        | Período de pago, 7 N                                       | `PayrollPeriod` y el snapshot guardan fechas del período y fecha prevista de pago PILA; el AT2 marca este campo como asignado por el sistema. | No equivaler automáticamente al período de nómina. Resolver convención, formato y fuente con cada operador antes de exportar.                     |
| 30        | Tipo de aportante, 2 N                                     | `Tenant` no declara expresamente si corresponde al empleador estándar u otra categoría.                                                       | Para el MVP estándar se requiere confirmar categoría “1. Empleador”; bloquear otros tipos fuera de alcance.                                       |
| 31        | Fecha de matrícula mercantil, 10 A                         | No existe dato equivalente en `Tenant`.                                                                                                       | Condicional al beneficio de Ley 1429; si aplica, exigir fecha documental y validar el intervalo normativo.                                        |
| 32        | Código de departamento, 2 A                                | `MunicipioDane.codigo` permite derivarlo si está validado; no hay un campo dedicado de domicilio principal para esta regla.                   | Condicional al beneficio de Ley 1429; reutilizar solo el DIVIPOLA confirmado del domicilio principal.                                             |
| 33        | Exoneración de salud, SENA e ICBF, 1 A                     | `Tenant.aportesExonerados` existe con `@default(false)`.                                                                                      | Candidato, no prueba suficiente: requerir confirmación expresa; el valor por defecto no demuestra elegibilidad ni declaración del aportante.      |
| 34        | Beneficio CCF de Ley 1429, 1 A                             | No existe campo equivalente en `Tenant`.                                                                                                      | Falta; capturar declaración y sustento si aplica. No asumir “N” ni acogimiento por ausencia de datos.                                             |

El archivo tipo 1 todavía no puede generarse de forma general: hay datos
obligatorios ausentes, otros solo existen en campos opcionales o libres, y los
campos 28–29 dependen del operador. Para el primer fixture de dependiente
estándar se deben incluir únicamente valores confirmados; cualquier dato
obligatorio faltante bloquea el lote. La matriz siguiente completa el inventario
de campos tipo 2, pero no cierra las reglas de novedades, catálogos ni hitos
normativos y tampoco autoriza serializar.

### Auditoría campo por campo: archivos tipo 2 del AT2 v30

La auditoría usa la copia oficial de AT2 v30 descargada el 2026-10-30 y coteja
§2.1.1.1 (pp. 26–30) y §2.1.2.1 (pp. 81–102) con el schema Prisma, los
servicios de afiliación y el payload de nómina aprobado de esta rama. El
registro 01 tiene 22 campos y 359 caracteres; cada registro 02 tiene 98 campos
y 693 caracteres. Las etiquetas resumidas identifican la variable del anexo,
no fijan padding o codificación.

“Candidato” indica que existe un campo fuente, pero falta congelarlo en el
snapshot, validar su semántica o comprobar el catálogo. “Falta” indica que no
existe un dato suficiente. “Operador” identifica valores que el AT2 atribuye
al operador o cuyo tratamiento en una carga plana debe probarse por operador.
“Constante / regla AT2” solo aplica a la planilla E dependiente estándar y
debe mantenerse atada a AT2 v30.

#### Registro 01 — Encabezado

| Campo | Variable AT2                                   | Fuente y estado verificados                                                                                                                                        |
| ----- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1     | Tipo de registro                               | Constante / regla AT2: 01.                                                                                                                                         |
| 2     | Modalidad                                      | Operador: AT2 indica que la asigna automáticamente el operador. No inventarla en el archivo subido.                                                                |
| 3     | Secuencia                                      | La aplicación tendría que numerar desde 0001 por aportante. No hay generador hoy; el operador la genera al digitar en web.                                         |
| 4     | Nombre del aportante                           | Tenant.razonSocial, equivalente al campo 1 del tipo 1; capturado, sujeto a validación de longitud.                                                                 |
| 5     | Tipo de documento del aportante                | Campo 2 del tipo 1; el tenant registra NIT pero no un selector formal de tipo de persona/documento. Confirmar NI antes de emitir.                                  |
| 6     | Identificación del aportante                   | Tenant.nit, equivalente al campo 3 del tipo 1; validar dígito por separado y caracteres/longitud.                                                                  |
| 7     | Dígito de verificación                         | Tenant.digitoVerif, equivalente al campo 4 del tipo 1; capturado, falta verificar las reglas de tipo de persona.                                                   |
| 8     | Tipo de planilla                               | El MVP restringe a planilla E; bloquear cualquier otro tipo.                                                                                                       |
| 9     | Número de planilla asociada                    | Debe ir vacío para E; no aplica a la planilla ordinaria del MVP.                                                                                                   |
| 10    | Fecha de pago de planilla asociada             | Debe ir vacía para E; no confundir con la fecha prevista para pagar PILA.                                                                                          |
| 11    | Forma de presentación                          | Remite al campo 10 del tipo 1; no existe en Tenant.                                                                                                                |
| 12    | Código de sucursal                             | Remite al campo 5 del tipo 1; no existe código PILA de sucursal. Sede es operativa y no se convierte automáticamente.                                              |
| 13    | Nombre de sucursal                             | Remite al campo 6 del tipo 1; no existe dato de sucursal PILA.                                                                                                     |
| 14    | Código ARL del aportante                       | Falta: no hay ARL a nivel de empresa en Tenant; la ARL de un empleado no sustituye la ARL del aportante.                                                           |
| 15    | Período de pago de sistemas diferentes a salud | AT2 lo asigna al operador. PayrollPeriod guarda fechas generales, no períodos cotizados separados por subsistema; no derivar a ciegas.                             |
| 16    | Período de pago de salud                       | Requerido, formato AAAA-MM; las fechas de nómina son un candidato, pero no existe una regla confirmada para períodos que crucen meses o difieran por subsistema.   |
| 17    | Radicación / número de planilla                | Operador: asignación única por operador; no fabricar. La carga plana debe confirmar si se envía vacío.                                                             |
| 18    | Fecha efectiva de pago                         | Operador: la fija el sistema con el pago real. fechaPrevistaPagoPila es una previsión y no la sustituye.                                                           |
| 19    | Total de cotizantes                            | Se cuenta desde el detalle por cotizante único, excluyendo tipo 40. Un cotizante puede requerir más de una línea 02 por novedades; no contar líneas como personas. |
| 20    | Valor total de nómina                          | Debe sumar el campo 45 (IBC CCF) de los cotizantes obligados; para los no obligados es cero. El snapshot actual no separa IBC CCF.                                 |
| 21    | Tipo de aportante                              | Remite al campo 30 del tipo 1; Tenant no conserva ese tipo explícitamente.                                                                                         |
| 22    | Código de operador                             | Operador: asignado por el operador; solo probar bajo una convención de carga documentada para ese operador.                                                        |

#### Registro 02 — Liquidación detallada por cotizante

| Campo | Variable AT2                                   | Fuente y estado verificados                                                                                                                                                                                                                   |
| ----- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Tipo de registro                               | Constante / regla AT2: 02.                                                                                                                                                                                                                    |
| 2     | Secuencia                                      | La aplicación tendría que numerar desde 00001; no hay generador hoy.                                                                                                                                                                          |
| 3     | Tipo de documento                              | Empleado.tipoDocumento es candidato, pero su enum no cubre SC, RC, CD ni PC; PEP/PPT tampoco coinciden directamente con PE/PT del AT2 y PE tiene vigencia restringida. Mapear explícitamente por versión y bloquear documentos no soportados. |
| 4     | Número de identificación                       | Empleado.cedula existe, pero no está congelado en el snapshot ni su validez se comprueba por tipo de documento.                                                                                                                               |
| 5     | Tipo de cotizante                              | AfiliacionSeguridadSocial.tipoCotizanteCodigo conserva un código con vigencia; admitir solo el código 1 en el MVP y validar catálogo/vigencia.                                                                                                |
| 6     | Subtipo de cotizante                           | El campo es nullable en afiliación. Exigir confirmación explícita; no convertir null automáticamente en subtipo 0.                                                                                                                            |
| 7     | Extranjero no obligado a cotizar pensión       | Falta: no existe declaración estructurada.                                                                                                                                                                                                    |
| 8     | Colombiano en el exterior                      | Falta: no existe indicador ni fecha vinculada.                                                                                                                                                                                                |
| 9     | Departamento de ubicación laboral              | Empleado.sedeId → Sede.municipioId → MunicipioDane.codigo es solo Candidato; no está congelado y la sede operativa no prueba por sí sola la ubicación laboral PILA.                                                                           |
| 10    | Municipio de ubicación laboral                 | Mismo candidato del campo 9; separar DIVIPOLA (2+3) solo desde código oficial confirmado y bloquear municipio ausente.                                                                                                                        |
| 11    | Primer apellido                                | Empleado.primerApellido existe, pero no está congelado en el snapshot.                                                                                                                                                                        |
| 12    | Segundo apellido                               | Empleado.segundoApellido es opcional y mutable; confirmar opcionalidad/padding para el operador.                                                                                                                                              |
| 13    | Primer nombre                                  | Empleado.primerNombre existe, pero no está congelado.                                                                                                                                                                                         |
| 14    | Segundo nombre                                 | Empleado.segundoNombre es opcional y mutable; confirmar opcionalidad/padding.                                                                                                                                                                 |
| 15    | Novedad ING                                    | Falta: fechaIngreso y fecha de contrato son candidatos, no una novedad PILA inmutable del período.                                                                                                                                            |
| 16    | Novedad RET                                    | Empleado.fechaRetiro existe, pero no está congelada ni representa un evento PILA aprobado. No inferir desde estado.                                                                                                                           |
| 17    | TDE                                            | AT2 exige blanco.                                                                                                                                                                                                                             |
| 18    | TAE                                            | AT2 exige blanco.                                                                                                                                                                                                                             |
| 19    | TDP                                            | AT2 exige blanco.                                                                                                                                                                                                                             |
| 20    | TAP                                            | AT2 exige blanco.                                                                                                                                                                                                                             |
| 21    | VSP                                            | Falta: no hay evento PILA ni vigencia de cambio salarial. Una diferencia entre snapshots no prueba la novedad.                                                                                                                                |
| 22    | Correcciones                                   | PayrollCorrection no identifica correcciones de PILA A/C; no mapear un ajuste de nómina a esta novedad.                                                                                                                                       |
| 23    | VST                                            | Falta: no existe novedad PILA transitoria con período/intervalo.                                                                                                                                                                              |
| 24    | SLN                                            | PayrollNovelty.LICENSE solo guarda tipo, fecha y valor opcional; no distingue licencia no remunerada/comisión ni conserva inicio y fin.                                                                                                       |
| 25    | IGE                                            | PayrollNovelty.SICKNESS solo aporta una fecha genérica; faltan tipo PILA, intervalo y datos requeridos para liquidar.                                                                                                                         |
| 26    | LMA                                            | Falta: no existe novedad PILA de maternidad/paternidad con intervalo.                                                                                                                                                                         |
| 27    | VAC-LR                                         | PayrollNovelty.VACATION no distingue vacaciones de licencia remunerada ni conserva intervalo.                                                                                                                                                 |
| 28    | AVP                                            | Falta: no hay autorización ni monto de aporte voluntario a pensión.                                                                                                                                                                           |
| 29    | VCT                                            | Falta: no hay novedad con código y vigencia de centro de trabajo.                                                                                                                                                                             |
| 30    | Días IRL                                       | Falta: no existe número de días PILA por accidente/enfermedad laboral ni su intervalo.                                                                                                                                                        |
| 31    | Administradora pensional / ACCAI               | AfiliacionSeguridadSocial.fondoPensionCodigo es Candidato histórico; falta catálogo validado, distinción tipada y copia de la afiliación efectiva en el snapshot.                                                                             |
| 32    | Administradora pensional de traslado           | AT2 exige blanco.                                                                                                                                                                                                                             |
| 33    | EPS/EOC                                        | AfiliacionSeguridadSocial.epsCodigo es Candidato con vigencia; falta validar catálogo y congelar el valor efectivo en el snapshot.                                                                                                            |
| 34    | EPS/EOC de traslado                            | AT2 exige blanco.                                                                                                                                                                                                                             |
| 35    | Caja de compensación                           | AfiliacionSeguridadSocial.cajaCompensacionCodigo es Candidato; falta catálogo/vigencia congelada y evaluar si el cotizante está obligado.                                                                                                     |
| 36    | Días cotizados a pensión                       | Falta: el snapshot no conserva días por subsistema.                                                                                                                                                                                           |
| 37    | Días cotizados a salud                         | Falta: el snapshot no conserva días de salud ni la novedad que justificaría un valor menor a 30.                                                                                                                                              |
| 38    | Días cotizados a riesgos laborales             | Falta: no hay días PILA por riesgos; no se pueden copiar los días generales de nómina.                                                                                                                                                        |
| 39    | Días cotizados a CCF                           | Falta: no hay días PILA por CCF ni base para decidir la obligación.                                                                                                                                                                           |
| 40    | Salario básico                                 | PayrollSnapshot.employee.salarioBaseUsado es Candidato; validar moneda, redondeo a pesos y regla del salario integral antes de serializar.                                                                                                    |
| 41    | Tipo de salario                                | salarioIntegralUsado permite identificar un candidato para X, pero no existe clasificación explícita fijo/variable; no deducir F/V de cambios salariales.                                                                                     |
| 42    | IBC pensión                                    | Falta: totals.ibc conserva un IBC general, no el IBC pensional separado.                                                                                                                                                                      |
| 43    | IBC salud                                      | Falta: no se congela un IBC de salud por subsistema.                                                                                                                                                                                          |
| 44    | IBC riesgos laborales                          | Falta: no se congela un IBC de riesgos por subsistema.                                                                                                                                                                                        |
| 45    | IBC CCF                                        | Falta: no se congela un IBC CCF; tampoco se puede sustituir por el IBC general para el total del encabezado campo 20.                                                                                                                         |
| 46    | Tarifa de pensiones                            | ParametroLegalNomina y factores de conceptos conservan tarifas candidatas; no hay mapeo PILA aprobado para tarifa, régimen/ACCAI y reglas normativas aplicables.                                                                              |
| 47    | Cotización obligatoria a pensiones             | Los importes PENSION_EMP/PENSION_PAT del snapshot son candidatos, no una base autorizada para recomputar o distribuir componentes. Falta resolver reglas AT2 vigentes y correspondencia del operador.                                         |
| 48    | Aporte voluntario del afiliado a pensión       | Falta: no existe dato ni concepto voluntario estructurado.                                                                                                                                                                                    |
| 49    | Aporte voluntario del aportante a pensión      | Falta: no existe dato ni concepto voluntario estructurado.                                                                                                                                                                                    |
| 50    | Total de cotización pensional                  | AT2 lo calcula como 47+48+49; no recalcular en el exportador ni asumir que el archivo plano del operador espera recibirlo.                                                                                                                    |
| 51    | Fondo de solidaridad — solidaridad             | El concepto FSP puede conservar un importe agregado, pero AT2 atribuye la liquidación al operador; no hay separación de subcuentas. Confirmar formato del operador.                                                                           |
| 52    | Fondo de solidaridad — subsistencia            | Mismo hallazgo del campo 51; no se conserva importe separado ni se debe repartir el concepto agregado.                                                                                                                                        |
| 53    | Valor no retenido por aportes voluntarios      | Falta: no se registran aportes voluntarios ni el valor no retenido correspondiente.                                                                                                                                                           |
| 54    | Tarifa de salud                                | Parámetros legales y factores de SALUD_EMP/SALUD_PAT son candidatos; no existe asignación PILA congelada por subsistema ni prueba del tratamiento de exoneración.                                                                             |
| 55    | Cotización obligatoria a salud                 | Importes de SALUD_EMP/SALUD_PAT son candidatos de snapshot, pero falta su contrato de agregación PILA y las reglas de exoneración aplicables.                                                                                                 |
| 56    | UPC adicional / contribución solidaria         | No existe dato; tipos 40 y 69 están fuera del MVP. Para tipo 1 no inventar valor: confirmar valor vacío/cero con el operador.                                                                                                                 |
| 57    | Autorización de incapacidad                    | AT2 exige blanco.                                                                                                                                                                                                                             |
| 58    | Valor de incapacidad                           | AT2 exige cero.                                                                                                                                                                                                                               |
| 59    | Autorización de licencia maternidad/paternidad | AT2 exige blanco.                                                                                                                                                                                                                             |
| 60    | Valor de licencia maternidad                   | AT2 exige cero.                                                                                                                                                                                                                               |
| 61    | Tarifa de riesgos laborales                    | ParametroLegalNomina, clase de riesgo y factor del concepto ARL son candidatos; falta mapear por vigencia y congelar el cálculo que originó la nómina.                                                                                        |
| 62    | Código de centro de trabajo                    | Falta: no existe código PILA CT asociado a la sede/contrato. Sede.id no es ese código.                                                                                                                                                        |
| 63    | Cotización obligatoria a riesgos laborales     | PayrollConcept.ARL.valor es candidato snapshot; confirmar que coincide con el importe PILA del período sin recalcularlo.                                                                                                                      |
| 64    | Tarifa CCF                                     | ParametroLegalNomina.pctCaja y factor del concepto CAJA son candidatos; falta especificación PILA versionada.                                                                                                                                 |
| 65    | Aporte CCF                                     | PayrollConcept.CAJA.valor es candidato snapshot; requiere corroborar días, IBC y obligación CCF.                                                                                                                                              |
| 66    | Tarifa SENA                                    | ParametroLegalNomina.pctSena y factor de concepto son candidatos; la exoneración no acredita por sí sola elegibilidad.                                                                                                                        |
| 67    | Aporte SENA                                    | PayrollConcept.SENA.valor es candidato snapshot; falta establecer la salida permitida cuando no se causa el concepto.                                                                                                                         |
| 68    | Tarifa ICBF                                    | ParametroLegalNomina.pctIcbf y factor de concepto son candidatos; falta elegibilidad/versionado aplicable.                                                                                                                                    |
| 69    | Aporte ICBF                                    | PayrollConcept.ICBF.valor es candidato snapshot; falta establecer la salida permitida cuando no se causa el concepto.                                                                                                                         |
| 70    | Tarifa ESAP                                    | Falta: no hay parámetro ni clasificación de entidad pública/aplicable.                                                                                                                                                                        |
| 71    | Aporte ESAP                                    | Falta: no hay concepto ni clasificación que soporte el campo.                                                                                                                                                                                 |
| 72    | Tarifa MEN                                     | Falta: no hay parámetro ni regla de aplicabilidad.                                                                                                                                                                                            |
| 73    | Aporte MEN                                     | Falta: no hay concepto ni regla de aplicabilidad.                                                                                                                                                                                             |
| 74    | Tipo de documento del cotizante principal      | Solo se usa para tipo 40, fuera del MVP; no incluir ese tipo. Confirmar valor vacío para el resto en cada operador.                                                                                                                           |
| 75    | Identificación del cotizante principal         | Solo se usa para tipo 40, fuera del MVP; no incluir ese tipo. Confirmar valor vacío para el resto en cada operador.                                                                                                                           |
| 76    | Exoneración salud/SENA/ICBF                    | Tenant.aportesExonerados y companyPolicy del snapshot son candidatos, pero el default false no es declaración ni prueba de elegibilidad. Hace falta evidencia expresa y validación de umbrales/reglas.                                        |
| 77    | Administradora ARL del cotizante               | AfiliacionSeguridadSocial.arlCodigo es candidato, pero AT2 usa para dependientes la ARL indicada en el encabezado campo 14, que falta a nivel de empresa; validar catálogo/vigencia.                                                          |
| 78    | Clase de riesgo                                | AfiliacionSeguridadSocial.arlClaseRiesgo y contract.claseRiesgoArlUsada son candidatos congelables; reconciliar que ambos corresponden al lugar y actividad laborales del período.                                                            |
| 79    | Indicador tarifa especial de pensiones         | Falta: no existe indicador ni catálogo de tarifa especial. Blanco solo tras confirmar que el empleado estándar no está en una categoría especial.                                                                                             |
| 80    | Fecha de ingreso                               | Empleado.fechaIngreso/inicio de contrato son candidatos, pero falta evento de novedad ING aprobado y congelado.                                                                                                                               |
| 81    | Fecha de retiro                                | Empleado.fechaRetiro es mutable y no está en el snapshot; tipo 75 está excluido. Requiere evento RET confirmado para el período.                                                                                                              |
| 82    | Inicio VSP                                     | Falta: no existe fecha de vigencia de novedad salarial PILA.                                                                                                                                                                                  |
| 83    | Inicio SLN                                     | Falta: la novedad genérica no conserva intervalo PILA.                                                                                                                                                                                        |
| 84    | Fin SLN                                        | Falta: la novedad genérica no conserva intervalo PILA.                                                                                                                                                                                        |
| 85    | Inicio IGE                                     | Falta: PayrollNovelty.SICKNESS.fecha no conserva duración ni evidencia suficiente.                                                                                                                                                            |
| 86    | Fin IGE                                        | Falta: no existe fecha final de incapacidad PILA.                                                                                                                                                                                             |
| 87    | Inicio LMA                                     | Falta: no existe evento LMA estructurado.                                                                                                                                                                                                     |
| 88    | Fin LMA                                        | Falta: no existe intervalo LMA estructurado.                                                                                                                                                                                                  |
| 89    | Inicio VAC-LR                                  | PayrollNovelty.VACATION.fecha es un candidato aislado; falta intervalo y clase de licencia.                                                                                                                                                   |
| 90    | Fin VAC-LR                                     | Falta: no se conserva fecha final VAC-LR.                                                                                                                                                                                                     |
| 91    | Inicio VCT                                     | Falta: no existe evento de cambio de centro de trabajo.                                                                                                                                                                                       |
| 92    | Fin VCT                                        | Falta: no existe vigencia final del cambio de centro.                                                                                                                                                                                         |
| 93    | Inicio IRL                                     | Falta: no existe evento/intervalo de riesgo laboral.                                                                                                                                                                                          |
| 94    | Fin IRL                                        | Falta: no existe fecha final IRL.                                                                                                                                                                                                             |
| 95    | IBC otros parafiscales                         | Falta: el snapshot conserva un IBC general, no la base separada para otros parafiscales.                                                                                                                                                      |
| 96    | Horas laboradas                                | Falta: Empleado.jornadaLaboral solo clasifica jornada, no horas realmente trabajadas en el período.                                                                                                                                           |
| 97    | Fecha de radicación en el exterior             | Falta: no hay dato; solo aplica con declaración de colombiano en el exterior.                                                                                                                                                                 |
| 98    | Actividad económica ARL                        | Falta: no existe código del Decreto 768/2022 por empleado, contrato o centro de trabajo ni vigencia congelada.                                                                                                                                |

#### Hallazgos que bloquean el serializador

1. Los datos identificatorios, lugar laboral, afiliación efectiva y eventos
   PILA no están congelados en el snapshot actual. Consultar Empleado, Sede o
   AfiliacionSeguridadSocial al exportar podría cambiar un archivo histórico.
2. Para una planilla E estándar aún faltan datos obligatorios o su prueba de
   origen: períodos de cotización, ubicación laboral, días e IBC por
   subsistema, salario fijo/variable, centro/actividad ARL, CCF y reglas
   explícitas de exoneración.
3. Las novedades genéricas de nómina no tienen la semántica, los intervalos y
   los códigos de los campos 15–30 y 80–94 del AT2. No se pueden mapear por
   similitud de nombre.
4. Los valores asignados o liquidados por el operador (incluidos campos de
   encabezado y subcuentas del FSP) necesitan pruebas con el operador elegido;
   no se deben rellenar con ceros o códigos supuestos para obtener la longitud.
5. El conteo del encabezado se hace por cotizante único, mientras que AT2
   permite múltiples registros de detalle 02 para un cotizante en casos
   definidos. El serializador necesita fixtures que cubran esa diferencia.

La matriz no define cálculos nuevos, no cambia la fuente de verdad de Payroll y
no valida compatibilidad con un operador. Las salidas candidatas de conceptos
son solo referencias a importes ya presentes en el snapshot; no autorizan
recalcularlos ni agregar campos del maestro mutable al histórico. Se requiere
revisar reglas de AT2 v30 y sus hitos normativos con casos laborales
representativos antes de aprobar cualquier fixture ejecutable.

La revisión confirma que el diseño aprobado es viable, pero el exportador todavía
no tiene datos suficientes para producir un archivo válido de manera general.
**GOAL ACTIVO:** GOAL-02. **IMPLEMENTACIÓN BLOQUEADA:** serializar tipo 1/2 hasta
capturar y validar los datos patronales, laborales y los días/IBC requeridos.
**ARQUITECTURA DISPONIBLE:** ADR-013 y el historial tenant-scoped de afiliaciones
del PR #160 permiten preparar esos insumos sin alterar PayrollSnapshot histórico
ni mapear automáticamente los campos heredados.

La comprobación del código actual concreta esta brecha: `SNAPSHOT_PAYLOAD_VERSION` sigue en `1`; el payload aprobado conserva el período, `employeeId` y salario, contrato/sede/clase de riesgo cuando existen, novedades, conceptos, totales y política de exoneración. No congela identificación y nombres del empleado, códigos DIVIPOLA/CIIU, la versión de afiliación efectiva, días ni IBC por subsistema. La futura exportación debe admitir solo una versión de snapshot que incluya todos los orígenes requeridos por el layout seleccionado; los snapshots v1 incompletos se bloquean y no se rellenan consultando datos maestros actuales.

El versionado de este payload tiene consumidores existentes: `ServicePremiumCalculator` rechaza versiones distintas de `1`, y el seed financiero conserva y valida un snapshot sintético marcado como versión `1`. Cualquier cambio incompatible para agregar insumos PILA debe verificar explícitamente la compatibilidad del cálculo de prima y la integridad del escenario demo. La exportación PILA seguirá rechazando los snapshots v1 incompletos; este cambio no autoriza backfill ni reescritura de históricos.

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
- `apps/api/src/payroll/dto/create-payroll.dto.ts` y su prueba — la fecha
  prevista de PILA se valida como día calendario estricto y no acepta
  timestamps ni fechas inválidas.
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
