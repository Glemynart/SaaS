# ADR-013 — Exportación estándar de nómina a PILA

> **Fuente normativa verificada (2026-10-31):** la página oficial PILA de
> MinSalud enlaza el [PDF `anexo-tecnico2-cotizantes.pdf`](https://www.minsalud.gov.co/sites/rid/Lists/BibliotecaDigital/RIDE/DE/OT/anexo-tecnico2-cotizantes.pdf).
> Una descarga fresca desde ese enlace tiene SHA-256
> `BBB3C2D0486FD7D3934BD640D8E68C60D33686B1604E8EFAA980139FB5686D33`, 336
> páginas, y en la página 2 identifica **AT2 versión 30, fecha 24-07-2026**;
> allí también enumera la Resolución 1529 de 2026. El mismo hash citado antes
> como no verificado corresponde a este PDF oficial. La extracción indexada que
> aún muestra v29 está desactualizada frente al archivo descargado. Se corrige
> la conclusión previa de que la versión oficial era v29 y se corrigen las
> afirmaciones sobre la falta de verificación de v30 y del hash.
>
> El informe preliminar conserva `formatVersion: null` porque no genera ni fija
> una versión de archivo. La rama de PR #180 añade una primitiva para formatear
> registros AT2 v30, pero aún no mapea snapshots ni compone archivos completos.
> `normativeSourceStatus` sigue
> `RECONCILIATION_PENDING` porque faltan cotejar campos, reglas aplicables,
> catálogos y fixtures laborales contra AT2 v30; no significa que la versión
> oficial vigente sea desconocida. No habilitar el mapeo y la serialización de
> archivos completos, su descarga ni compatibilidad hasta completar ese cotejo
> y las pruebas por operador.

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
- En `main` después de PR #162, `PayrollSnapshot` conserva los datos de nómina
  aprobados y una fecha prevista de pago PILA, pero aún no trae un payload
  completo para archivos tipo 1/2. Las PR apiladas #163–#170 agregan al snapshot
  una fuente PILA separada con historia afiliatoria, eventos, centro ARL,
  actividad de riesgos y candidatos de días/IBC; permanecen abiertas y no
  equivalen a una exportación validada.
- PR #162 agregó `PayrollPeriod.fechaPrevistaPagoPila` y congela esa previsión
  en snapshots nuevos. Es una fecha estimada, no prueba de pago. El período
  cotizado y la fecha prevista deben determinar los hitos aplicables; el archivo
  final aún deberá confirmar y conservar la fecha elegida para la exportación.
- `PayrollNoveltyType` ofrece `VACATION`, `SICKNESS`, `LICENSE`, `OVERTIME`,
  `BONUS` y `OTHER`; no es el catálogo/código de reporte PILA.
- PR #160 agregó captura manual y con vigencia del historial de afiliaciones;
  el formulario e importador XLSX aún no hacen carga PILA masiva ni validan
  completamente los catálogos. En las PR abiertas #163–#170 también se capturan
  eventos y asignaciones ARL fechadas y se congelan en el payload PILA, sin
  segmentación normativa ni validación completa del archivo.
- No existe un exportador PILA funcional en la API ni en la web.

El Ministerio publica anexos técnicos para PILA y los operadores documentan
cargue de archivos planos. La [página oficial PILA de
MinSalud](https://www.minsalud.gov.co/Proteccion-Social/Paginas/pila.aspx)
enlaza un PDF que la descarga directa identifica como AT2 versión 30, fechado
el 24 de julio de 2026, e incluye la Resolución 1529 de 2026 entre los actos
que lo incorporan. La [Resolución 1529 de
2026](https://www.minsalud.gov.co/sites/rid/Lists/BibliotecaDigital/RIDE/DE/DIJ/resolucion-1529-de-2026.pdf)
se conserva como fuente para verificar sus disposiciones e hitos y modifica
también el AT3. La matriz campo por campo debe cotejarse con AT2 v30, la norma
que este incorpora y cualquier norma posterior antes de implementar el
serializador. Para algunos hitos,
la regla depende del período cotizado y de la fecha prevista de pago de aportes
PILA; no se infiere de la fecha de pago del salario ni de generación del archivo.
La Resolución 611 de 2026 establece condiciones para que ciertas personas
vinculadas laboralmente permanezcan hasta seis meses en el régimen subsidiado;
la Resolución 1529 adoptó el cotizante 75 y nuevas validaciones para ese caso,
con aplicación operativa desde el 1 de noviembre de 2026 para el período de
salud de noviembre. Un proyecto ministerial posterior propone modificar los
plazos 5.87 y 5.91, pero al 2026-10-31 no reemplaza los plazos de la Resolución 1529. El MVP excluye este caso y debe bloquearlo; no lo presenta como una
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
   de pago ni reescribir el snapshot de nómina si la fecha cambia. El enlace de
   MinSalud identifica AT2 v30, fechado el 24-07-2026, que enumera la Resolución
   1529 entre los actos incorporados. La selección de reglas deberá considerar
   esa versión, el período, la fecha prevista de pago y normas posteriores; no
   se vuelve a aplicar como delta una modificación ya incorporada.
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

### Captura explícita de eventos PILA

Los eventos reportables se capturan en un modelo propio asociado al tenant,
período y empleado, separado de `PayrollNovelty`: la novedad genérica sigue
siendo insumo del cálculo de nómina y no se convierte por similitud de nombre
en un código AT2. El MVP captura explícitamente ING, RET, VSP, VST, SLN, IGE,
LMA, VAC-LR, IRL y VCT; no ofrece TDE/TAE/TDP/TAP, AVP ni cotizantes/casos
especiales fuera del alcance. Los eventos con intervalo conservan inicio y fin
reales cuando existen; VCT requiere fecha de inicio y admite fecha final
opcional, conforme a los campos 91–92 del AT2 vigente. IRL conserva además
los días informados por el aportante; no se deducen días ni IBC de la duración
del evento.

Los eventos solo se crean o eliminan cuando `PayrollPeriod` está en BORRADOR.
La generación/reliquidación copia los eventos tenant-scoped al `pilaSource` de
cada ejecución y la aprobación los congela en `PayrollSnapshot.pilaPayload`.
Después de calcular, el período debe reabrirse y reliquidarse antes de cambiar
eventos; los snapshots aprobados no se editan ni completan retroactivamente.
Esta captura no calcula segmentos ni vuelve exportable un período: cualquier
evento que exija varias líneas o tenga días/IBC no aprobados mantiene el
preflight bloqueado.

El registro actual está asociado a un único período de nómina. Si el intervalo
del evento atraviesa períodos, solo se copia al snapshot del período al que se
registró; no se propaga a los demás períodos que se solapen. La interfaz lo
indica y el futuro preflight debe exigir evidencia aprobada en cada planilla
afectada. La captura y aprobación automática del mismo evento entre períodos
queda pendiente antes de habilitar la exportación de esos casos.

La preparación local implementa esta captura mediante `PayrollPilaEvent`, con
lectura, creación y eliminación tenant-scoped; creación/eliminación solo en
BORRADOR; validación de fechas y días IRL; búsqueda y captura desde el detalle
del período; y copia de los eventos al snapshot fuente al liquidar. La
liquidación bloquea el período bajo la misma fila que serializa la edición de
eventos, y vuelve a leerlos dentro de la transacción para no omitir una novedad
concurrente. Se rechaza un duplicado idéntico. La captura no altera
`PayrollNovelty`, no calcula segmentos, días cotizados ni IBC por evento, y no
habilita una exportación.

El informe preliminar de preparación lee también la lista de eventos congelada
en el snapshot. Cada código reconocido se presenta como bloqueo explícito en
su campo AT2 (15, 16, 21, 23–27 o 29–30) mientras Payroll no conserve sus
segmentos y días/IBC aprobados; un código fuera de la matriz o una lista de
eventos ausente o incompleta en cualquiera de las dos copias de un payload v2
también bloquea la revisión. Esto mejora la trazabilidad de brechas, pero no
calcula segmentos, no constituye un preflight normativo completo y no habilita
la generación de archivos.

El historial de afiliaciones no presenta una versión de formato PILA como si
fuera evidencia normativa. El campo Prisma se llama `versionCaptura` y se mapea
temporalmente a la columna física heredada `formatoNormativoVersion`, para que
la migración sea compatible con la imagen anterior y un rollback operativo. El
servicio registra `PILA_AFFILIATION_CAPTURE_V1`; la migración corrige la etiqueta
`AT2_V30` en filas existentes y el valor predeterminado, sin renombrar la
columna física ni alterar otros datos afiliatorios. No modifica eventos ni
snapshots aprobados. Los snapshots históricos conservan su contenido original
y el informe no fija una versión de archivo hasta terminar la reconciliación
campo por campo. Algunos payloads históricos pueden conservar la clave
`formatoNormativoVersion: AT2_V30`; se mantiene por inmutabilidad, pero no
demuestra que el snapshot se haya preparado y validado usando esa versión ni
habilita la exportación.

La revisión de `PayrollService.calculateAndCollectWarnings` y
`buildCalculationInput` confirma que el cálculo elige contrato usando solo la
fecha inicial del período y entrega `Empleado.salario` completo a
`PayrollCalculator`; no usa fechas de ingreso/retiro ni fechas de eventos para
prorratear el salario. Por ello, las bases de un snapshot de nómina parcial no
se pueden asumir correctas para segmentar ING/RET. Esa ruta seguirá bloqueada
hasta que Payroll calcule y congele importes prorrateados bajo reglas laborales
revisadas y fixtures aprobados.

La revisión de la fuente primaria precisa parte del alcance de esa condición.
AT2 v30, campos 36 y 37, permite menos de 30 días de pensión y salud cuando
existe una novedad de ingreso o retiro para los cotizantes obligados. También
define conteos separados por subsistema. Esto confirma que los eventos deben
segmentarse, pero no autoriza a copiar días generales ni basta para derivar
importes salariales: la fórmula y los pisos de IBC por subsistema requieren
cotejo completo con las reglas aplicables y casos laborales revisados. El
anexo tampoco sustituye la validación de conceptos salariales de Payroll ni
define por sí solo todas las bases de CCF y otros parafiscales.
El [artículo 2.2.1.1.2.1 del
Decreto 780 de 2016](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=77813)
establece para trabajadores privados dependientes la base de cotización como
el salario mensual devengado, contempla salario integral al 70% y fija un
mínimo para salud. La fórmula y los pisos de IBC aplicables a períodos parciales,
incluidas las bases distintas por subsistema en AT2 v30, aún deben reconciliarse
con las normas vigentes y fixtures laborales antes de ajustar Payroll.

El [artículo 2.2.1.6.4 del Decreto 1072 de
2015](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=72173)
regula un esquema especial para ciertos trabajadores dependientes que laboran
por períodos inferiores a un mes. No se debe trasladar ese esquema a cualquier
ingreso o retiro parcial sin comprobar sus condiciones de aplicación. El
[Concepto 298251 de 2022 de Función
Pública](https://www.funcionpublica.gov.co/eva/gestornormativo/norma_pdf.php?i=197588)
describe la convención de 30 días y cita el ejemplo de 19 al 28 de febrero como
12/30, pero responde un caso de trabajador oficial; se conserva como evidencia
orientativa, no como validación suficiente del cálculo para un empleador
privado.

Antes de implementar el cálculo deben revisarse expected values para ingreso y
retiro en febrero de 28/29 días y en meses de 30/31 días, ingreso y retiro en
el mismo período, fechas contradictorias entre empleado/contrato/evento,
cambios salariales dentro del período y el mínimo/topes de IBC y redondeo de
cada subsistema. Hasta entonces se mantiene el bloqueo de exportación para
períodos parciales y no se aprueba una fórmula de prorrata genérica.

La auditoría de altas y bajas se confirma en la misma transacción que modifica
el evento; si el registro de auditoría falla, la operación revierte y el evento
conserva su estado anterior.

## Criterios de aceptación y pruebas normativas de exportación

La matriz detallada del primer MVP, sus casos negativos, sus referencias AT2
v30 y los hallazgos de código se mantiene en
[`docs/research/pila/AT2-V30-MVP-ACCEPTANCE-MATRIX.md`](../research/pila/AT2-V30-MVP-ACCEPTANCE-MATRIX.md).
Ese documento es preparación y criterio de revisión: no declara exportación,
no aprueba los resultados laborales candidatos ni acredita compatibilidad con
un operador.

La captura y conservación inmutable de fuentes puede prepararse sin generar un
archivo. No se implementará el serializador ni se afirmará que un archivo es
exportable hasta cerrar la matriz contra el anexo consolidado y su vigencia.
Los casos ejecutables deben usar fixtures anonimizados con resultados
revisados por Payroll y conformidad normativa; cuando el operador lo requiera,
una cuenta de prueba del aportante.

| Prueba                                                                                                           | Resultado esperado                                                                                                                                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trabajador dependiente estándar (tipo de cotizante 1, planilla E), afiliaciones vigentes y nómina aprobada       | Generar archivos tipo 1 y tipo 2 solo después de reconciliar y probar el layout oficial vigente; conservar IBC/aportes aprobados sin recalcular; mostrar versiones normativa y de formato, período, fecha prevista de pago de aportes PILA, snapshots fuente y hash. |
| Afiliación con cambio de administradora                                                                          | Elegir la afiliación cuya vigencia cubre el período; conservar visible y auditable la anterior.                                                                                                                                                                      |
| Campo heredado con EPS/AFP/ARL/caja como texto libre                                                             | No inferir código ni generar archivo; pedir mapeo y confirmación explícitos.                                                                                                                                                                                         |
| Afiliación ausente, vencida, futura, solapada o con hueco de vigencia                                            | Bloquear al trabajador afectado con campo, período y causa identificables.                                                                                                                                                                                           |
| Nómina no aprobada, snapshot ausente o snapshot de otro tenant                                                   | Bloquear exportación; no recalcular Payroll ni permitir lectura cruzada de tenant.                                                                                                                                                                                   |
| Snapshot PILA incompleto o de versión histórica                                                                  | Bloquear la exportación sin leer empleado, contrato, sede, tenant o afiliación actuales para completar campos y sin backfill de snapshots históricos. Admitir solo una versión aprobada que congele todos los insumos requeridos por la matriz AT2 seleccionada.     |
| Cambios posteriores en empleado, contrato, sede o afiliación                                                     | La exportación conserva los datos congelados al aprobarse; cambios posteriores en registros maestros no alteran el archivo ni la evidencia de exportación.                                                                                                           |
| Tipo/subtipo/novedad no incluido en la matriz de versión                                                         | Bloquear con error trazable; no sustituir por código genérico.                                                                                                                                                                                                       |
| Cotizante 75 / regla especial de régimen subsidiado                                                              | Rechazar como fuera de alcance del MVP y explicar que requiere una fase compatible con la Resolución 1529 y demás norma vigente; no producir un archivo parcial engañoso.                                                                                            |
| Resolución 1529, pagos PILA desde 1 de octubre de 2026 para pensiones del período septiembre                     | Probar las validaciones/origen actualizados de los campos de identificación del aportante, representante, cotizante y cotizante principal definidos en 5.84; rechazar valores inválidos con el campo exacto.                                                         |
| Resolución 1529, pagos PILA desde 1 de noviembre de 2026 para salud del período noviembre                        | Aplicar el hito normativo; bloquear tipo 75 por estar fuera del MVP y verificar que el caso estándar tipo 1/planilla E sigue usando únicamente sus reglas aprobadas.                                                                                                 |
| Hito escalonado futuro o fecha prevista de pago PILA ausente                                                     | Seleccionar reglas por período cotizado y fecha prevista de pago de aportes para la planilla; bloquear si falta la fecha y no se puede determinar una versión única.                                                                                                 |
| Entrada de fecha prevista al crear el período                                                                    | Aceptar solo YYYY-MM-DD válido; rechazar timestamps con hora/zona y fechas imposibles; permitir nulo si se desconoce la previsión y conservar esa ausencia en snapshots nuevos.                                                                                      |
| Período/catálogo que cruza una vigencia de formato                                                               | Seleccionar la versión aplicable al período y fecha prevista de pago de aportes PILA o bloquear si se cruzan vigencias sin regla aprobada.                                                                                                                           |
| Estructura física del layout PILA vigente                                                                        | Con un fixture revisado, producir los registros y longitudes que establezca la fuente oficial consolidada; respetar orden, posiciones y padding. La codificación, terminadores de línea y empaquetado se confirman por operador antes de declarar compatibilidad.    |
| Integridad del encabezado frente a detalles                                                                      | Para un fixture estándar de dependientes tipo 1, contar cotizantes únicos y sumar las bases requeridas según la versión normativa confirmada. Bloquear si fuente/snapshot y archivo difieren; no recalcular IBC durante la exportación.                              |
| Días cotizados, detalle tipo 2                                                                                   | Confirmar las reglas del AT2 vigente por subsistema, novedades, afiliación y obligación de aportar; cada campo de días se aprueba y congela por separado. No copiar un contador general ni habilitar meses parciales sin segmentación aprobada.                      |
| Bases de cotización, detalle tipo 2                                                                              | Congelar salario e IBC por subsistema según reglas vigentes; no derivar campos de un IBC único ni completar valores faltantes durante la exportación.                                                                                                                |
| Tipo de salario, detalle tipo 2                                                                                  | Validar tipo de salario expresamente declarado por el aportante conforme a las reglas vigentes; no deducirlo de que el valor salarial no cambie ni de la ausencia de conceptos variables.                                                                            |
| Variación de IBC y varios detalles para el mismo cotizante                                                       | Aplicar el número y contenido de líneas definido por el anexo vigente; cada segmento, novedad, días e IBC debe venir aprobado desde Payroll. Contar cotizantes únicos en el encabezado y no calcular IBC en el exportador.                                           |
| Campos atribuidos al operador (por ejemplo, modalidad, radicación, fecha efectiva de pago y código del operador) | No inventar ni presentar como confirmado un dato generado/asignado por el operador; aplicar solo la convención de carga que haya superado prueba documentada para ese operador y formato.                                                                            |
| Reintento/corrección                                                                                             | Reintentar la misma exportación sin duplicar; una corrección crea una exportación nueva vinculada, conserva archivo/versiones/hash previos.                                                                                                                          |
| Diferencia de estados                                                                                            | La generación local solo presenta “generado” o “validado localmente”; aceptación, liquidación y pago requieren evidencia del operador/usuario y no se simulan.                                                                                                       |
| Carga en operador                                                                                                | Mantener evidencia fechada y versionada. SOI, Enlace Operativo/SuAporte o Aportes en Línea solo se marcan compatibles si su carga real de prueba fue aceptada.                                                                                                       |

La matriz de aceptación debe registrar casos incluidos, códigos oficiales,
archivos de entrada/salida esperados, regla normativa exacta, fecha de vigencia,
resultado esperado y revisor. No se anunciará “cargable en cualquier operador”
hasta completar pruebas independientes por operador.

El preflight preliminar debe revisar también el campo 26 del archivo tipo 1:
solo considera cubierto el caso en que el aportante confirmó que no aplica una
acción especial y, por tanto, corresponde el código 0 de la matriz candidata,
pendiente de reconciliar con la fuente normativa vigente. Una acción
declarada o una respuesta ausente bloquea la preparación; los datos actuales no
capturan ni validan los campos condicionales 25 y 27 ni permiten exportar una
acción especial.

Para el campo 7, la clase A requiere al menos 200 cotizantes únicos y la clase
B menos de 200, contando todas las sucursales incluidas. Las clases C y D
requieren evidencia de elegibilidad; mientras el preflight no la valide, debe
bloquearlas aunque estén seleccionadas en el perfil. Una selección del beneficio
de Ley 1429 también requiere clase D; un dato contradictorio bloquea el campo.

Una declaración positiva de exoneración de salud/SENA/ICBF o del beneficio CCF
de Ley 1429 tampoco demuestra elegibilidad por sí sola. El preflight mantiene
bloqueados los campos 33, 34 y 76 hasta que valide el sustento aplicable; una
declaración negativa explícita sí puede satisfacer esta comprobación.

### Casos candidatos para revisión normativa; fixture aún no aprobado

La matriz previa se elaboró contra el PDF cuyo hash ahora coincide con la
descarga del enlace oficial y que se identifica como AT2 v30. Los resultados de
esta tabla son expectativas de preflight aún sujetas a cotejo campo por campo
con AT2 v30 y sus normas incorporadas o aplicables. No son
expected values laborales aprobados ni una especificación ejecutable.

| Caso anonimizado                                                                                      | Resultado esperado antes de generar archivo                                                                                                                                                                                                      |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cotizante 01, afiliación y contrato cubren el mes calendario completo, sin novedades                  | El snapshot puede proponer 30 días por separado para 36–39. El preflight todavía bloquea si falta cualquier IBC obligatorio (42–45 o 95), campo 98 o dato requerido por el tipo 1/encabezado.                                                    |
| ING dentro del período                                                                                | Exigir la novedad ING y su fecha en campo 80. Los días parciales 36/37 solo se aceptan con valores aprobados por Payroll; si faltan, bloquear.                                                                                                   |
| RET dentro del período                                                                                | Exigir la novedad RET y su fecha en campo 81. Los días parciales y bases solo se aceptan desde Payroll; si faltan, bloquear.                                                                                                                     |
| ING y RET en el mismo período                                                                         | Una línea 02 puede contener ambas novedades y fechas; el número de cotizantes del encabezado sigue siendo uno. Bloquear si falta el resultado aprobado de días/IBC.                                                                              |
| Varias ING/RET o cambios de IBC en el período                                                         | Emitir una línea por el evento que AT2 requiere; no contar líneas como personas. Cada línea debe tener sus días, novedades e IBC aprobados; si el snapshot solo tiene totales mensuales, bloquear.                                               |
| Ausentismo concurrente con VSP/VST o RET durante ausentismo                                           | Separar las líneas exigidas por AT2 y conservar el IBC de cada evento calculado y aprobado por Payroll. Si el origen contiene solo una fecha genérica o un IBC agregado, bloquear.                                                               |
| Novedad genérica SICKNESS, LICENSE o VACATION sin clasificación PILA explícita                        | No mapear automáticamente a IGE, LMA, SLN o VAC-LR; exigir código, fechas y datos estructurados compatibles, o bloquear.                                                                                                                         |
| Campo 30 IRL mayor que cero                                                                           | Exigir que el campo 38 reporte los mismos días y que el intervalo/segmento laboral esté aprobado. Si no se puede probar esa igualdad, bloquear.                                                                                                  |
| Salario integral, pagos variables, vacaciones remuneradas o salario superior al tope actual de nómina | La regla candidata `CO_PARAFISCAL_BASE_V1` solo soporta salario fijo/integral y horas extra trazables en mes completo. Bloquear los demás casos y toda descarga hasta revisar los fixtures laborales y validar límites; no heredar el IBC común. |

**Primer objetivo de validación (decisión de planificación): SOI, planilla E.**
SOI documenta el cargue de archivos planos para empleadores y un autocorrector
de la planilla E que identifica errores de malla normativa. Esto lo hace un
candidato práctico para el primer ciclo de prueba; no prueba que acepte el
archivo de La Oficina Nítida ni que el sistema sea compatible. Para elevarlo a
“compatible con SOI” se requiere acceso de prueba, carga del archivo tipo 1/2,
resultado aceptado por el portal y evidencia fechada del caso probado. Si ese
acceso no está disponible, se termina la validación normativa/local y el
estado de compatibilidad permanece sin confirmar.

## Revalidación de fuentes PILA — 2026-10-31

El enlace publicado por la [página oficial PILA de MinSalud](https://www.minsalud.gov.co/Proteccion-Social/Paginas/pila.aspx)
resuelve al [PDF `anexo-tecnico2-cotizantes.pdf`](https://www.minsalud.gov.co/sites/rid/Lists/BibliotecaDigital/RIDE/DE/OT/anexo-tecnico2-cotizantes.pdf). Una descarga directa fresca
realizada el 2026-10-31 tiene SHA-256
`BBB3C2D0486FD7D3934BD640D8E68C60D33686B1604E8EFAA980139FB5686D33`, tamaño
2.738.690 bytes y 336 páginas. La página 2 identifica código AT2, versión 30,
fecha 24-07-2026 y enumera la Resolución 1529 entre los actos administrativos
que lo incorporan. La búsqueda indexada del PDF todavía devolvía v29, pero no
coincide con la descarga directa actual. La
[Resolución 1529 de
2026](https://www.minsalud.gov.co/sites/rid/Lists/BibliotecaDigital/RIDE/DE/DIJ/resolucion-1529-de-2026.pdf)
se conserva además como fuente oficial para interpretar las disposiciones y
plazos citados en el AT2 v30 y las modificaciones al Anexo Técnico 3. Su texto está disponible además en la
[compilación jurídica de
Colpensiones](https://normativa.colpensiones.gov.co/colpens/compilacion/docs/resolucion_minsaludps_1529_2026.htm).
La [Resolución 1641 de 2026](https://www.minsalud.gov.co/sites/rid/Lists/BibliotecaDigital/RIDE/DE/DIJ/resolucion-1641-de-2026.pdf)
confirma que la 1529 modifica los anexos y que el formulario de afiliación y
novedades de riesgos laborales es un artefacto normativo separado.

La comprobación directa confirma que el AT2 enlazado es versión 30 y que la
copia candidata registrada históricamente tiene exactamente el mismo hash. La
versión y el archivo son hechos verificados; no se presume por ello que cada
campo del producto, regla de negocio o fecha de aplicación esté implementado o
validado. Se conserva la Resolución 1529 como fuente para interpretar y
confirmar los hitos de aplicación cuando el AT2 v30 la cite; no se vuelve a
aplicar una modificación como delta sin verificar si ya está incorporada.
Entre los hitos comprobados, las validaciones/orígenes de los campos de
identificación del aportante y representante legal (tipo 1, campos 3 y 18) y
del cotizante y cotizante principal (tipo 2, campos 4 y 75) rigen para pagos
desde el 1 de octubre de 2026 del período pensional septiembre de 2026. Las
aclaraciones de planilla E y el cambio del cotizante 75 tienen un hito distinto:
pagos desde el 1 de noviembre de 2026 para salud del período noviembre de 2026;
el cotizante 75 sigue excluido del MVP.

La lectura directa del PDF oficial AT2 v30 permitió confirmar una estructura
física para el formato fechado 24-07-2026. La matriz describe los archivos,
posiciones, relleno numérico y alfanumérico y longitudes de esa versión. El
mapeo entre los campos y las fuentes de La Oficina Nítida, las reglas de
vigencia y cualquier convención del operador siguen pendientes de revisión; no
se habilita el serializador hasta validar esos puntos.
Según AT2 v30, el archivo tipo 2 comienza con un registro 01 de
encabezado, de 22 campos y 359 caracteres (§2.1.1.1, pp. 26–30), seguido por
registros 02 de detalle, uno por cotizante, de 98 campos y 693 caracteres
(§§2.1.2–2.1.2.1, pp. 80–102). Estos tamaños y límites son evidencia de esa
copia, no una especificación suficiente para generar archivos: siguen
pendientes el origen y validación de cada dato, su vigencia normativa,
catálogos, los valores asignados/calculados por el operador y las convenciones
de carga de cada operador. La matriz siguiente registra esta distinción; no se
debe usar aún como fixture ejecutable.

La relectura de las páginas 91–94 precisa que los campos 36–39 son cuatro
contadores obligatorios separados (días a pensión, salud, riesgos y CCF), cada
uno con rango 0–30 y condiciones de obligatoriedad/novedades propias. Los
campos 42–45 también son cuatro bases separadas; el código actual conserva un
solo `ibc`, así que no existe evidencia para copiarlo a los cuatro campos. El
campo 40 exige salario básico sin centavos y el 41 clasifica salario integral,
fijo o variable para los tipos aplicables. En §§2.1.2.3.1 (pp. 103–104), AT2
permite varios registros 02 para un cotizante en escenarios definidos de
ingreso/retiro o variación del IBC, y asigna al aportante el cálculo del IBC
afectado por novedades concurrentes. Por ello un snapshot PILA futuro debe
conservar segmentos/novedades y resultados aprobados por subsistema; el
serializador no puede reconstruirlos desde una novedad genérica de nómina.

El campo 95 (IBC de otros parafiscales) también es obligatorio para el tipo de
cotizante 01. El artículo 17 de la [Ley 21 de 1982](https://www.funcionpublica.gov.co/eva/gestornormativo/norma_pdf.php?i=4827)
define la base parafiscal con los elementos salariales y los descansos
remunerados; el artículo 49 de la [Ley 789 de 2002](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=6778),
interpretado junto con la Ley 50 de 1990, aplica el 70% al salario integral.
El [Concepto 171591 de 2022 de Función Pública](https://www1.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=193672)
precisa que las vacaciones disfrutadas y las reconocidas en dinero integran
los descansos remunerados de la base para SENA, ICBF y CCF.
El `PayrollCalculator` actual arma un único IBC desde salario base,
bonificaciones y horas extra, aplica mínimo/tope y reutiliza el mismo valor
para salud, pensión, ARL, CCF, ICBF y SENA. `sumNovelties` solo agrega
`BONUS` y `OVERTIME`; por tanto, la novedad genérica `VACATION` no aporta al
cálculo actual. Esos son límites comprobados del código, no prueba de que todos
los campos PILA deban compartir la base ni de que la base parafiscal herede el
tope actual. El payload local ya contiene una regla candidata y versionada para
salario fijo/integral y horas extra en mes completo, definida en los criterios
que siguen. El campo continúa bloqueado para otros devengos, vacaciones,
períodos parciales, novedades o límites no resueltos; no se copiará de
`PayrollRun.ibc`. La composición de nómina mensual sigue la [interpretación
oficial de Función Pública del artículo 17 de la Ley 21](https://www1.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=274458).

#### Criterios previos al cálculo del campo 95 en Payroll

El campo 95 es obligatorio para cotizante 01 y se congela como una base propia
en el snapshot aprobado; no se toma de `PayrollRun.ibc` ni de los valores de
los conceptos ICBF/SENA, que pueden no existir por exoneración. Para la primera
regla versionada `CO_PARAFISCAL_BASE_V1`, el origen aceptado es `SALARIO_BASE`
y el concepto explícito `OVERTIME`, ambos como devengos de Payroll. Se excluye
`AUX_TRANSP` y se bloquea cualquier devengo no clasificado, `BONUS` sin
naturaleza laboral confirmada, vacaciones sin importe de descanso remunerado
trazable, o período incompleto/afectado por novedades que Payroll no haya
resuelto. Para salario integral se aplica el 70% al total salarial admitido y
se redondea al peso con la regla ya usada por Payroll. Los históricos sin esta
fuente permanecen bloqueados; no se rellenan desde el maestro actual.

La matriz cubre todos los códigos del catálogo vigente `ConceptCodigo` de
Payroll. Cualquier código nuevo o devengo sin clasificación bloquea el campo
hasta que se revise y se versiona su tratamiento.

| Código de Payroll                                                       | Tipo            | Tratamiento candidato para campo 95 | Condición                                                                                 |
| ----------------------------------------------------------------------- | --------------- | ----------------------------------- | ----------------------------------------------------------------------------------------- |
| `SALARIO_BASE`                                                          | Devengo         | Incluir una vez                     | Valor entero no negativo e igual al salario básico del snapshot.                          |
| `OVERTIME`                                                              | Devengo         | Incluir                             | Debe coincidir exactamente con el total de novedades de horas extra aprobadas.            |
| `AUX_TRANSP`                                                            | Devengo         | Excluir                             | No se suma a la base.                                                                     |
| `BONUS`                                                                 | Devengo         | Bloquear                            | Payroll no distingue bonificación salarial de no salarial.                                |
| Otro código de tipo `EARNING`                                           | Devengo         | Bloquear                            | Requiere clasificación laboral y normativa explícita.                                     |
| `SALUD_EMP`, `PENSION_EMP`, `FSP`                                       | Deducción       | Excluir                             | No son pagos salariales fuente de la base.                                                |
| `SALUD_PAT`, `PENSION_PAT`, `ARL`, `CAJA`, `ICBF`, `SENA`               | Aporte patronal | Excluir como fuente                 | Sus importes o bases no sustituyen la nómina salarial; pueden no existir por exoneración. |
| `PROV_PRIMA`, `PROV_CESANTIAS`, `PROV_INT_CESANTIAS`, `PROV_VACACIONES` | Provisión       | Excluir                             | Una provisión no es un pago salarial del período.                                         |
| Novedad `VACATION` u otra novedad sin concepto de pago trazable         | Novedad         | Bloquear                            | El modelo conserva la novedad, no el valor y clasificación del descanso pagado.           |

La matriz se apoya en el campo 95 de AT2 v30 (campo obligatorio para tipo 01),
el artículo 17 de la
[Ley 21 de 1982](https://www.funcionpublica.gov.co/eva/gestornormativo/norma_pdf.php?i=4827),
el artículo 17 de la
[Ley 344 de 1996](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=345),
el artículo 49 de la
[Ley 789 de 2002](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=6778)
y el criterio oficial sobre vacaciones remuneradas del
[Concepto 171591 de 2022](https://www1.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=193672).
La Ley 21 incluye elementos salariales y descansos remunerados; la Ley 344
excluye los pagos pactados como no salariales y el auxilio de transporte; la
Ley 789 aplica el 70% al salario integral, también en vacaciones según la
jurisprudencia citada. El tipo `BONUS` del código no acredita por sí solo si
la bonificación es salarial o no.

| Fixture anonimizado                                                                                                         | Resultado esperado para campo 95                                                                                                             |
| --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Cotizante 01, mes completo, salario fijo de $2.000.000 y auxilio de transporte de $249.095; sin otros devengos ni novedades | $2.000.000; el auxilio se excluye.                                                                                                           |
| Mismo salario fijo con exoneración que omite conceptos de aporte ICBF/SENA del cálculo actual                               | $2.000.000; la base no depende de que existan esos conceptos de aporte.                                                                      |
| Cotizante 01 con salario integral fijo de $15.000.000, mes completo y sin pagos/descansos adicionales                       | $10.500.000 (70%); se deriva de los conceptos salariales y no se copia del IBC común.                                                        |
| Salario fijo de $2.000.000 y concepto `OVERTIME` aprobado por $200.000, sin otra novedad que altere días/IBC                | $2.200.000; el trabajo suplementario se trata como elemento salarial y se conserva el origen del concepto.                                   |
| `BONUS` sin clasificación, novedad genérica de vacaciones/licencia/enfermedad, o cualquier devengo no clasificado           | `valor: null`, bloqueo por campo y trabajador; no producir registro tipo 2 parcial.                                                          |
| Vacaciones pagadas con importe y clasificación de descanso remunerado explícitos                                            | Deben integrar la base; permanece bloqueado hasta que Payroll conserve ese concepto y el fixture salarial/integral tenga resultado revisado. |

Los fixtures de salario integral, horas extra, exoneración y vacaciones son
obligatorios antes de habilitar este campo para descarga. Las reglas sobre
períodos parciales, novedades con intervalos, topes y correcciones requieren
fuentes de Payroll explícitas y casos propios; la regla anterior no los
resuelve por inferencia.

| Registro/campos relevantes                                                                                                                                                                                                                                                                                                                                   | Fuente actual verificada                                                                                                                                                                                                                                                                                                                                       | Brecha antes de serializar                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Archivo tipo 1 (§1.1, pp. 9–16): campos 1–34, 567 caracteres. Incluye identidad del aportante (1–4), clasificación/naturaleza/persona/presentación (7–10), dirección y DIVIPOLA/CIIU (11–14), representante legal (18–24), tipo de aportante (30) y exoneración/beneficio CCF (33–34).                                                                       | `Tenant` conserva razón social, NIT y dígito, dirección, municipio, teléfono, email, representante legal como texto y `aportesExonerados`.                                                                                                                                                                                                                     | No hay tipo de persona/naturaleza/clase/formato de presentación PILA, CIIU DANE del aportante ni identificación y nombres estructurados del representante. No se deben inferir ni fabricar.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Archivo tipo 2, registro 01 (§2.1.1.1, pp. 26–30): campos 1–22, 359 caracteres; un encabezado por planilla. Para este alcance, campo 8 = planilla E. Campos 14–16 incluyen ARL y períodos de cotización; 19–20 contienen cantidad de cotizantes y valor total de nómina según IBC CCF.                                                                       | `PayrollPeriod` captura una fecha prevista de pago de aportes PILA opcional y los snapshots nuevos la conservan en `period.fechaPrevistaPagoPila`. `Tenant` contiene política de exoneración.                                                                                                                                                                  | La fecha prevista no es la fecha de pago del salario ni prueba el pago de PILA. No se conserva el código ARL del aportante. Los campos que el AT2 atribuye al operador (por ejemplo, modalidad, radicación, pago efectivo y código del operador) no pueden fabricarse; su representación en carga debe verificarse por operador.                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Archivo tipo 2, registro 02 (§§2.1.2–2.1.2.1, pp. 80–102): campos 1–98, 693 caracteres; un registro por cotizante. Comprende identidad/tipo/subtipo/ubicación (3–14), novedades (15–30 y fechas 80–94), administradoras (31–35 y 77), días/salario/IBC (36–45), tarifas/aportes (46–75) y datos de riesgos, incluidas clase (78) y actividad económica (98). | `Empleado` conserva identificación, nombres y fechas laborales; `PayrollSnapshot` conserva `employeeId` y `sedeId`; `Sede` relaciona municipio DANE; `AfiliacionSeguridadSocial` conserva tipo/subtipo y códigos de EPS/pensión/ARL/CCF con vigencias. La preparación local agrega un `pilaPayload` separado al aprobar, con los datos capturados al liquidar. | En la preparación local, identidad, fechas, empresa, contrato, sede/municipio y afiliaciones con vigencias se congelan en el payload PILA aprobado; los snapshots históricos no se completan retroactivamente. No se valida todavía la pertenencia a catálogos oficiales ni se genera archivo. Los datos ausentes deben bloquear la exportación, no sustituirse por valores maestros actuales.                                                                                                                                                                                                                                                                                                                                                                                   |
| Archivo tipo 2, registro 02: días y bases de cotización por subsistema (campos 36–45), aportes por entidad (46–75), exoneración (76), ARL/clase de riesgo (77–78), novedades fechadas (80–94), horas (96) y actividad económica de riesgos (98).                                                                                                             | `PayrollSnapshot` congela salario usado, un IBC, conceptos, totales, fechas del período y novedades trazadas. El payload PILA local agrega salario básico, tipo salarial, novedades fuente e IBC de pensión/salud/riesgos/CCF referenciados a los conceptos de Payroll que suministraron cada base; una fuente ausente o duplicada queda sin valor.            | Los días separados se congelan solo para un mes completo cubierto sin novedades; faltan días parciales y novedades segmentadas, y no se congelan horas. Las bases capturadas requieren validación normativa por escenario. El salario original se conserva y campo 40 bloquea ausencia/centavos, pero aún falta validar aplicabilidad por cotizante. El tipo salarial queda sin resolver ante devengos variables que el modelo no clasifica con certeza. `PayrollNovelty` guarda una fecha, no intervalos PILA. Falta actividad económica ARL y código de centro de trabajo. La rama de preparación agrega un informe preliminar de brechas sobre snapshots aprobados, pero no un preflight normativo completo: no valida exhaustivamente catálogos y reglas ni genera archivos. |

### Auditoría provisional campo por campo: archivo tipo 1

La siguiente matriz coteja AT2 v30 con el modelo
`Tenant` y el catálogo `MunicipioDane` actuales. Es una auditoría
de preparación, no una autorización para serializar. “Capturado” significa que
hay un campo candidato; antes de exportar se debe validar su origen, formato,
vigencia y si fue confirmado por el aportante. Los campos que AT2 asigna al
sistema no se rellenan con códigos inventados ni se afirman compatibles sin una
prueba de carga por operador.

| Campo AT2 | Dato requerido                                             | Fuente actual comprobada                                                                                                                      | Estado previo a exportar                                                                                                                          |
| --------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1         | Nombre o razón social, 200 A                               | `Tenant.razonSocial`                                                                                                                          | Capturado; bloquear si está vacío y validar longitud/normalización del operador.                                                                  |
| 2         | Tipo de documento del aportante, 2 A                       | `employer.pila.tipoDocumentoAportante`, declarado y congelado con el snapshot PILA.                                                           | Validar tipo, longitud y caracteres según el mapa AT2; no inferir tipos distintos de los declarados.                                              |
| 3         | Identificación del aportante sin dígito, 16 A              | `Tenant.nit`                                                                                                                                  | Capturado; validar caracteres y longitud según el tipo de documento confirmado.                                                                   |
| 4         | Dígito de verificación, 1 N                                | `Tenant.digitoVerif`                                                                                                                          | Capturado; AT2 condiciona su uso al tipo de persona y exige cero en otros casos. No se puede cerrar mientras falte el tipo de persona.            |
| 5         | Código de sucursal/dependencia, 10 A                       | `employer.pila.codigoSucursal`, declarado y congelado en el snapshot PILA.                                                                    | Para `U` va vacío; para `S` se exige un código. No derivar sucursal desde `Sede`.                                                                 |
| 6         | Nombre de sucursal/dependencia, 40 A                       | `employer.pila.nombreSucursal`, declarado y congelado en el snapshot PILA.                                                                    | Para `S`, si no hay nombre se admite el código como fallback; confirmar padding con operador.                                                     |
| 7         | Clase de aportante, 1 A                                    | `employer.pila.claseAportante`, respuesta declarada y congelada.                                                                              | A/B se contrastan con el total de cotizantes; C/D requieren elegibilidad y evidencia, y permanecen bloqueadas.                                    |
| 8         | Naturaleza jurídica, 1 N                                   | `employer.pila.naturalezaJuridica`, declarada y congelada en el perfil PILA.                                                                  | Requiere un código permitido por AT2; no inferirlo desde la razón social.                                                                         |
| 9         | Tipo de persona, 1 A                                       | `employer.pila.tipoPersona`, declaración congelada en el perfil PILA.                                                                         | Requiere valor explícito; condiciona reglas de DV e identificación del representante.                                                             |
| 10        | Forma de presentación, 1 A                                 | `employer.pila.formaPresentacion`, declarada y congelada en el perfil PILA.                                                                   | Exigir `U` o `S`; no deducir presentación por sucursales operativas.                                                                              |
| 11        | Dirección de correspondencia, 40 A                         | `Tenant.direccion`, nullable.                                                                                                                 | Capturado parcialmente; es obligatorio en AT2, por lo que la ausencia debe bloquear.                                                              |
| 12        | Código de ciudad/municipio, 3 A                            | `Tenant.municipioId → MunicipioDane.codigo`; el código maestro es el DIVIPOLA completo.                                                       | Candidato disponible si hay municipio; validar el formato y separar el código oficial de municipio según DIVIPOLA. Bloquear si falta o no valida. |
| 13        | Código de departamento, 2 A                                | El mismo `MunicipioDane.codigo`; `Tenant.departamento` es texto heredado.                                                                     | Derivable solo desde el código DIVIPOLA confirmado; no exportar el nombre de departamento ni inferirlo del texto legado.                          |
| 14        | Código DANE de actividad económica, 4 N                    | `employer.pila.codigoActividadEconomica`, declarado y congelado en el perfil PILA.                                                            | Validar longitud, catálogo y vigencia; no inferirlo del cargo ni de la actividad ARL individual.                                                  |
| 15        | Teléfono, 10 N                                             | `Tenant.telefono`, nullable.                                                                                                                  | Capturado parcialmente; obligatorio y numérico en AT2. Bloquear si falta o si no satisface longitud/formato probado.                              |
| 16        | Fax, 10 N                                                  | `employer.pila.fax`, declarado y congelado en el perfil PILA.                                                                                 | Opcional; si existe, validar que sea numérico y no exceda el ancho AT2.                                                                           |
| 17        | Correo electrónico, 60 A                                   | `employer.email`, capturado y congelado en el snapshot PILA.                                                                                  | Opcional; validar longitud y sintaxis AT2 si se declara.                                                                                          |
| 18        | Identificación del representante legal, 16 A               | Tipo y número separados en `employer.pila`, congelados en el snapshot PILA.                                                                   | Exigir y validar para persona jurídica; persona natural puede omitir completamente el bloque.                                                     |
| 19        | Dígito de verificación del representante, 1 N              | AT2 v30 indica reportar cero en este campo.                                                                                                   | Confirmar la aplicabilidad por tipo de aportante y conservarla ligada a la versión de formato.                                                    |
| 20        | Tipo de identificación del representante, 2 A              | `employer.pila.representanteTipoDocumento`, capturado y congelado.                                                                            | Validar documentos admitidos y longitud del número de identificación.                                                                             |
| 21        | Primer apellido del representante, 20 A                    | `employer.pila.representantePrimerApellido`, capturado y congelado.                                                                           | Obligatorio para persona jurídica; bloquear faltante o exceso de longitud, sin dividir nombres libres.                                            |
| 22        | Segundo apellido del representante, 30 A                   | `employer.pila.representanteSegundoApellido`, capturado y congelado.                                                                          | Opcional si no se declara; bloquear exceso de longitud, sin inferir desde otro campo.                                                             |
| 23        | Primer nombre del representante, 20 A                      | `employer.pila.representantePrimerNombre`, capturado y congelado.                                                                             | Obligatorio para persona jurídica; bloquear faltante o exceso de longitud.                                                                        |
| 24        | Segundo nombre del representante, 30 A                     | `employer.pila.representanteSegundoNombre`, capturado y congelado.                                                                            | Opcional si no se declara; bloquear exceso de longitud.                                                                                           |
| 25        | Fecha de concordato/restructuración/liquidación/cese, 10 A | `employer.pila.sinAccionEspecial`, declaración congelada; no contiene fechas de una acción.                                                   | El MVP exige confirmar que no hay acción especial; si existe, faltan datos estructurados y se bloquea.                                            |
| 26        | Tipo de acción, 1 N                                        | `employer.pila.sinAccionEspecial`, declaración congelada.                                                                                     | Solo puede mapearse “sin acción” tras confirmación explícita; acciones afirmativas bloquean.                                                      |
| 27        | Fecha de terminación de actividades, 10 A                  | `employer.pila.sinAccionEspecial`, declaración congelada; no contiene fecha de terminación.                                                   | El MVP exige confirmar que no hay acción especial; si existe, faltan datos estructurados y se bloquea.                                            |
| 28        | Código del operador, 2 N                                   | AT2 lo asigna al sistema.                                                                                                                     | Dependencia del operador; no inventar. Solo incluir bajo una convención de carga probada y documentada para ese operador.                         |
| 29        | Período de pago, 7 N                                       | `PayrollPeriod` y el snapshot guardan fechas del período y fecha prevista de pago PILA; el AT2 marca este campo como asignado por el sistema. | No equivaler automáticamente al período de nómina. Resolver convención, formato y fuente con cada operador antes de exportar.                     |
| 30        | Tipo de aportante, 2 N                                     | `employer.pila.tipoAportante`, declarado y congelado en el perfil PILA.                                                                       | Solo se admite el valor `1` (empleador) para este MVP.                                                                                            |
| 31        | Fecha de matrícula mercantil, 10 A                         | `employer.pila.fechaMatriculaMercantil`, declarada y congelada en el perfil PILA.                                                             | Condicional a Ley 1429; requiere evidencia y vigencia normativa antes de aceptar el beneficio.                                                    |
| 32        | Código de departamento, 2 A                                | Se deriva del DIVIPOLA de `employer.municipio`, congelado en el snapshot PILA.                                                                | Condicional a Ley 1429; usar solo el código del domicilio principal confirmado.                                                                   |
| 33        | Exoneración de salud, SENA e ICBF, 1 A                     | `employer.pila.aportesExoneradosConfirmado` y la política declarada se congelan en el snapshot.                                               | Exige declaración explícita; si es afirmativa, validar elegibilidad y evidencia antes de exportar.                                                |
| 34        | Beneficio CCF de Ley 1429, 1 A                             | `employer.pila.beneficioCcfLey1429`, declarado y congelado en el perfil PILA.                                                                 | Exige declaración explícita; una respuesta afirmativa queda bloqueada hasta validar elegibilidad.                                                 |

El archivo tipo 1 todavía no puede generarse de forma general: hay datos
obligatorios ausentes, otros solo existen en campos opcionales o libres, y los
campos 28–29 dependen del operador. Para el primer fixture de dependiente
estándar se deben incluir únicamente valores confirmados; cualquier dato
obligatorio faltante bloquea el lote. La matriz siguiente completa el inventario
de campos tipo 2, pero no cierra las reglas de novedades, catálogos ni hitos
normativos y tampoco autoriza serializar.

### Auditoría provisional campo por campo: archivos tipo 2

La auditoría usa AT2 v30 y coteja su estructura con el schema Prisma, los
servicios de afiliación y el payload de nómina aprobado de esta rama. El
registro 01 tiene 22 campos y 359 caracteres; cada registro 02 tiene 98 campos
y 693 caracteres. Las etiquetas resumidas identifican la variable del anexo,
no fijan padding o codificación.

“Candidato” indica que el dato ya puede estar congelado en el snapshot, pero
su semántica PILA, vigencia, catálogo, regla de cálculo o aceptación del
operador aún no está confirmada. “Falta” indica que no existe un dato suficiente.
“Operador” identifica valores que el AT2 atribuye al operador o cuyo tratamiento
en una carga plana debe probarse por operador.
“Constante / regla AT2” solo aplica a la planilla E dependiente estándar y
debe mantenerse atada a la versión de formato que resulte aplicable tras la
reconciliación normativa.

#### Registro 01 — Encabezado

| Campo | Variable AT2                                   | Fuente candidata y estado de preparación                                                                                                                           |
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

| Campo | Variable AT2                                   | Fuente candidata y estado de preparación                                                                                                                                                                                                                                                                      |
| ----- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1     | Tipo de registro                               | Constante / regla AT2: 02.                                                                                                                                                                                                                                                                                    |
| 2     | Secuencia                                      | La aplicación tendría que numerar desde 00001; no hay generador hoy.                                                                                                                                                                                                                                          |
| 3     | Tipo de documento                              | `employee.tipoDocumento`, congelado con el cotizante en `pilaPayload`.                                                                                                                                                                                                                                        | La preparación admite CC/CE/TI/PA y valida el número según el tipo; los demás documentos quedan fuera del MVP.               |
| 4     | Número de identificación                       | `employee.cedula`, congelada en `pilaPayload`.                                                                                                                                                                                                                                                                | La preparación valida caracteres y longitud por tipo; no normaliza ni trunca identificadores.                                |
| 5     | Tipo de cotizante                              | `affiliations.tipoCotizanteCodigo`, congelado con su vigencia.                                                                                                                                                                                                                                                | Solo se admite el dependiente estándar `01`; exige afiliación única que cubra el período.                                    |
| 6     | Subtipo de cotizante                           | `affiliations.subtipoCotizanteCodigo`, congelado con su vigencia.                                                                                                                                                                                                                                             | Exige el valor explícito `00`; `null` y otros subtipos bloquean sin backfill.                                                |
| 7     | Extranjero no obligado a cotizar pensión       | Falta: no existe declaración estructurada.                                                                                                                                                                                                                                                                    |
| 8     | Colombiano en el exterior                      | Falta: no existe indicador ni fecha vinculada.                                                                                                                                                                                                                                                                |
| 9     | Departamento de ubicación laboral              | `worksite.municipio`, congelado desde la sede del contrato en `pilaPayload`.                                                                                                                                                                                                                                  | Se usa el DIVIPOLA confirmado, pero la sede operativa por sí sola no acredita el lugar laboral PILA.                         |
| 10    | Municipio de ubicación laboral                 | El mismo DIVIPOLA municipal congelado en `worksite.municipio`.                                                                                                                                                                                                                                                | Separar departamento y municipio solo desde código confirmado; bloquear si falta o no valida.                                |
| 11    | Primer apellido                                | `employee.primerApellido`, congelado en `pilaPayload`.                                                                                                                                                                                                                                                        | Obligatorio y limitado a 20 posiciones; la preparación bloquea ausencia o exceso.                                            |
| 12    | Segundo apellido                               | `employee.segundoApellido`, congelado en `pilaPayload`.                                                                                                                                                                                                                                                       | Dato opcional; la preparación bloquea exceso de 30 posiciones, sin truncar.                                                  |
| 13    | Primer nombre                                  | `employee.primerNombre`, congelado en `pilaPayload`.                                                                                                                                                                                                                                                          | Obligatorio y limitado a 20 posiciones; la preparación bloquea ausencia o exceso.                                            |
| 14    | Segundo nombre                                 | `employee.segundoNombre`, congelado en `pilaPayload`.                                                                                                                                                                                                                                                         | Dato opcional; la preparación bloquea exceso de 30 posiciones, sin truncar.                                                  |
| 15    | Novedad ING                                    | PayrollPilaEvent captura la fecha ING informada para el período y la copia al payload aprobado; no se infiere de fechaIngreso/contrato. Aún falta segmentación y serialización.                                                                                                                               |
| 16    | Novedad RET                                    | PayrollPilaEvent captura la fecha RET informada para el período y la copia al payload aprobado; no se infiere desde estado o Empleado.fechaRetiro. Aún falta segmentación y serialización.                                                                                                                    |
| 17    | TDE                                            | AT2 exige blanco.                                                                                                                                                                                                                                                                                             |
| 18    | TAE                                            | AT2 exige blanco.                                                                                                                                                                                                                                                                                             |
| 19    | TDP                                            | AT2 exige blanco.                                                                                                                                                                                                                                                                                             |
| 20    | TAP                                            | AT2 exige blanco.                                                                                                                                                                                                                                                                                             |
| 21    | VSP                                            | PayrollPilaEvent captura código y fecha VSP explícitos; no registra el nuevo salario ni su vigencia salarial, por lo que el evento no puede segmentarse ni exportarse todavía.                                                                                                                                |
| 22    | Correcciones                                   | PayrollCorrection no identifica correcciones de PILA A/C; no mapear un ajuste de nómina a esta novedad.                                                                                                                                                                                                       |
| 23    | VST                                            | PayrollPilaEvent captura código y fecha VST explícitos; no registra valor ni vigencia de salario transitorio, por lo que no puede segmentarse ni exportarse todavía.                                                                                                                                          |
| 24    | SLN                                            | PayrollPilaEvent conserva inicio y fin explícitos; aún no distingue suspensión, licencia no remunerada y comisión, ni calcula segmentos aprobados.                                                                                                                                                            |
| 25    | IGE                                            | PayrollPilaEvent conserva el intervalo IGE informado; aún no hay evidencia clínica vinculada ni segmentación de días/IBC aprobada para exportar.                                                                                                                                                              |
| 26    | LMA                                            | PayrollPilaEvent conserva el intervalo LMA informado; aún no hay segmentación de días/IBC aprobada para exportar.                                                                                                                                                                                             |
| 27    | VAC-LR                                         | PayrollPilaEvent conserva el intervalo VAC-LR informado, pero no distingue vacaciones de licencia remunerada ni calcula segmentos aprobados.                                                                                                                                                                  |
| 28    | AVP                                            | Falta: no hay autorización ni monto de aporte voluntario a pensión.                                                                                                                                                                                                                                           |
| 29    | VCT                                            | PayrollPilaEvent conserva código, inicio y fin opcional; no registra centro de trabajo destino ni su vigencia contractual/laboral para segmentar la tarifa ARL.                                                                                                                                               |
| 30    | Días IRL                                       | PayrollPilaEvent conserva intervalo y días declarados por el aportante; todavía no los reconcilia con días ARL ni con segmentos aprobados.                                                                                                                                                                    |
| 31    | Administradora pensional / ACCAI               | `affiliations.fondoPensionCodigo`, congelado con la afiliación histórica.                                                                                                                                                                                                                                     | Requiere afiliación única vigente; catálogo y distinción tipada AFP/ACCAI siguen pendientes.                                 |
| 32    | Administradora pensional de traslado           | AT2 exige blanco.                                                                                                                                                                                                                                                                                             |
| 33    | EPS/EOC                                        | `affiliations.epsCodigo`, congelado con la afiliación histórica.                                                                                                                                                                                                                                              | Requiere afiliación única vigente; falta validar pertenencia al catálogo oficial.                                            |
| 34    | EPS/EOC de traslado                            | AT2 exige blanco.                                                                                                                                                                                                                                                                                             |
| 35    | Caja de compensación                           | `affiliations.cajaCompensacionCodigo`, congelado con la afiliación histórica.                                                                                                                                                                                                                                 | Requiere afiliación única vigente y validar obligación CCF y catálogo oficial.                                               |
| 36    | Días cotizados a pensión                       | Preparación local no fusionada: congela el candidato 30 para un mes calendario completo con cobertura integral, cotizante 01 con subtipo explícito 00 y sin novedades; otros casos quedan null con bloqueos. No cubre días parciales ni valida el archivo.                                                    |
| 37    | Días cotizados a salud                         | `payroll.diasCotizadosPorSubsistema.salud` en `pilaPayload`.                                                                                                                                                                                                                                                  | El candidato es 30 solo para el escenario mensual completo 01/00 sin novedades; los demás casos quedan bloqueados.           |
| 38    | Días cotizados a riesgos laborales             | `payroll.diasCotizadosPorSubsistema.riesgos` en `pilaPayload`.                                                                                                                                                                                                                                                | El candidato es 30 solo para el escenario mensual completo 01/00 sin novedades; los demás casos quedan bloqueados.           |
| 39    | Días cotizados a CCF                           | `payroll.diasCotizadosPorSubsistema.cajaCompensacion` en `pilaPayload`.                                                                                                                                                                                                                                       | El candidato es 30 solo para el escenario mensual completo 01/00 sin novedades; los demás casos quedan bloqueados.           |
| 40    | Salario básico                                 | La preparación local conserva el importe original y expone `salarioBasicoCampo40.valor` solo si es un entero seguro no negativo; si falta o tiene centavos, queda null con bloqueo. No redondea ni cambia Payroll. Aún debe validarse su aplicabilidad por tipo de cotizante y relación con salario integral. |
| 41    | Tipo de salario                                | Preparación local captura X/F/V declarado en Empleado; X se contrasta con salarioIntegral usado por Payroll y una contradicción queda bloqueada. Filas históricas sin clasificación siguen en null, sin backfill ni inferencia.                                                                               |
| 42    | IBC pensión                                    | Preparación local conserva como candidato la base de un único concepto PENSION_EMP de tipo DEDUCTION; si falta o se repite, queda null. Falta validar semántica normativa y reglas por subsistema.                                                                                                            |
| 43    | IBC salud                                      | Preparación local conserva como candidato la base de un único concepto SALUD_EMP de tipo DEDUCTION; si falta o se repite, queda null. Falta validar semántica normativa y reglas por subsistema.                                                                                                              |
| 44    | IBC riesgos laborales                          | Preparación local conserva como candidato la base de un único concepto ARL de tipo EMPLOYER_CONTRIBUTION; si falta o se repite, queda null. Falta validar semántica normativa y reglas por subsistema.                                                                                                        |
| 45    | IBC CCF                                        | Preparación local conserva como candidato la base de un único concepto CAJA de tipo EMPLOYER_CONTRIBUTION; si falta o se repite, queda null. No reemplaza el IBC general del encabezado; falta validar semántica y obligación CCF.                                                                            |
| 46    | Tarifa de pensiones                            | `PENSION_EMP`/`PENSION_PAT` conservan `base` y `factor` en `payroll.concepts` del `pilaPayload`.                                                                                                                                                                                                              | Fuente congelada candidata; falta confirmar qué tarifa exige AT2 y su formato por régimen antes de mapear.                   |
| 47    | Cotización obligatoria a pensiones             | Los importes PENSION_EMP/PENSION_PAT del snapshot son candidatos, no una base autorizada para recomputar o distribuir componentes. Falta resolver reglas AT2 vigentes y correspondencia del operador.                                                                                                         |
| 48    | Aporte voluntario del afiliado a pensión       | Falta: no existe dato ni concepto voluntario estructurado.                                                                                                                                                                                                                                                    |
| 49    | Aporte voluntario del aportante a pensión      | Falta: no existe dato ni concepto voluntario estructurado.                                                                                                                                                                                                                                                    |
| 50    | Total de cotización pensional                  | AT2 lo calcula como 47+48+49; no recalcular en el exportador ni asumir que el archivo plano del operador espera recibirlo.                                                                                                                                                                                    |
| 51    | Fondo de solidaridad — solidaridad             | El concepto FSP puede conservar un importe agregado, pero AT2 atribuye la liquidación al operador; no hay separación de subcuentas. Confirmar formato del operador.                                                                                                                                           |
| 52    | Fondo de solidaridad — subsistencia            | Mismo hallazgo del campo 51; no se conserva importe separado ni se debe repartir el concepto agregado.                                                                                                                                                                                                        |
| 53    | Valor no retenido por aportes voluntarios      | Falta: no se registran aportes voluntarios ni el valor no retenido correspondiente.                                                                                                                                                                                                                           |
| 54    | Tarifa de salud                                | `SALUD_EMP`/`SALUD_PAT` conservan `base` y `factor` en `payroll.concepts` del `pilaPayload`.                                                                                                                                                                                                                  | Fuente congelada candidata; falta aprobar agregación, exoneración aplicable y formato por operador.                          |
| 55    | Cotización obligatoria a salud                 | Importes de SALUD_EMP/SALUD_PAT son candidatos de snapshot, pero falta su contrato de agregación PILA y las reglas de exoneración aplicables.                                                                                                                                                                 |
| 56    | UPC adicional / contribución solidaria         | No existe dato; tipos 40 y 69 están fuera del MVP. Para tipo 1 no inventar valor: confirmar valor vacío/cero con el operador.                                                                                                                                                                                 |
| 57    | Autorización de incapacidad                    | AT2 exige blanco.                                                                                                                                                                                                                                                                                             |
| 58    | Valor de incapacidad                           | AT2 exige cero.                                                                                                                                                                                                                                                                                               |
| 59    | Autorización de licencia maternidad/paternidad | AT2 exige blanco.                                                                                                                                                                                                                                                                                             |
| 60    | Valor de licencia maternidad                   | AT2 exige cero.                                                                                                                                                                                                                                                                                               |
| 61    | Tarifa de riesgos laborales                    | El concepto `ARL` conserva base y factor en `payroll.concepts`; también se congela clase de riesgo.                                                                                                                                                                                                           | No recalcular: falta confirmar vigencia, tarifa de entrada y correspondencia con actividad/centro laboral.                   |
| 62    | Código de centro de trabajo                    | `pilaRiskAssignments` congela centro, código, tenant y vigencia en schema v2.                                                                                                                                                                                                                                 | Se valida vigencia y coincidencia ARL; el formato final del campo aún requiere verificación por operador.                    |
| 63    | Cotización obligatoria a riesgos laborales     | PayrollConcept.ARL.valor es candidato snapshot; confirmar que coincide con el importe PILA del período sin recalcularlo.                                                                                                                                                                                      |
| 64    | Tarifa CCF                                     | El concepto `CAJA` conserva base y factor en `payroll.concepts` del `pilaPayload`.                                                                                                                                                                                                                            | Fuente candidata congelada; falta validar el subsistema, obligación, vigencia y formato AT2.                                 |
| 65    | Aporte CCF                                     | PayrollConcept.CAJA.valor es candidato snapshot; requiere corroborar días, IBC y obligación CCF.                                                                                                                                                                                                              |
| 66    | Tarifa SENA                                    | El concepto `SENA` conserva base y factor cuando Payroll lo causa.                                                                                                                                                                                                                                            | Fuente candidata congelada; exoneración y ausencia del concepto requieren regla normativa y de archivo confirmada.           |
| 67    | Aporte SENA                                    | PayrollConcept.SENA.valor es candidato snapshot; falta establecer la salida permitida cuando no se causa el concepto.                                                                                                                                                                                         |
| 68    | Tarifa ICBF                                    | El concepto `ICBF` conserva base y factor cuando Payroll lo causa.                                                                                                                                                                                                                                            | Fuente candidata congelada; exoneración y ausencia del concepto requieren regla normativa y de archivo confirmada.           |
| 69    | Aporte ICBF                                    | PayrollConcept.ICBF.valor es candidato snapshot; falta establecer la salida permitida cuando no se causa el concepto.                                                                                                                                                                                         |
| 70    | Tarifa ESAP                                    | Falta: no hay parámetro ni clasificación de entidad pública/aplicable.                                                                                                                                                                                                                                        |
| 71    | Aporte ESAP                                    | Falta: no hay concepto ni clasificación que soporte el campo.                                                                                                                                                                                                                                                 |
| 72    | Tarifa MEN                                     | Falta: no hay parámetro ni regla de aplicabilidad.                                                                                                                                                                                                                                                            |
| 73    | Aporte MEN                                     | Falta: no hay concepto ni regla de aplicabilidad.                                                                                                                                                                                                                                                             |
| 74    | Tipo de documento del cotizante principal      | Solo se usa para tipo 40, fuera del MVP; no incluir ese tipo. Confirmar valor vacío para el resto en cada operador.                                                                                                                                                                                           |
| 75    | Identificación del cotizante principal         | Solo se usa para tipo 40, fuera del MVP; no incluir ese tipo. Confirmar valor vacío para el resto en cada operador.                                                                                                                                                                                           |
| 76    | Exoneración salud/SENA/ICBF                    | Tenant.aportesExonerados y companyPolicy del snapshot son candidatos, pero el default false no es declaración ni prueba de elegibilidad. Hace falta evidencia expresa y validación de umbrales/reglas.                                                                                                        |
| 77    | Administradora ARL del cotizante               | La afiliación ARL del cotizante se congela; el código del aportante para dependientes está en `employer.pila.codigoArlAportante`.                                                                                                                                                                             | AT2 relaciona el dato con el encabezado; falta validar catálogo y convención de carga por operador.                          |
| 78    | Clase de riesgo                                | `affiliations.arlClaseRiesgo` y la clase del contrato se congelan en el snapshot.                                                                                                                                                                                                                             | La actividad ARL v2 verifica coincidencia con la clase de afiliación; falta validar vigencia laboral y aceptación del campo. |
| 79    | Indicador tarifa especial de pensiones         | Falta: no existe indicador ni catálogo de tarifa especial. Blanco solo tras confirmar que el empleado estándar no está en una categoría especial.                                                                                                                                                             |
| 80    | Fecha de ingreso                               | PayrollPilaEvent congela la fecha ING informada; no deriva la novedad de Empleado.fechaIngreso ni del contrato. Falta segmentación y serialización.                                                                                                                                                           |
| 81    | Fecha de retiro                                | PayrollPilaEvent congela la fecha RET informada; no deriva la novedad de Empleado.fechaRetiro ni del estado. Falta segmentación y serialización.                                                                                                                                                              |
| 82    | Inicio VSP                                     | PayrollPilaEvent captura fecha VSP; falta el valor salarial correspondiente y su aplicación aprobada.                                                                                                                                                                                                         |
| 83    | Inicio SLN                                     | PayrollPilaEvent conserva la fecha de inicio; falta clasificar el motivo PILA y calcular los segmentos aprobados.                                                                                                                                                                                             |
| 84    | Fin SLN                                        | PayrollPilaEvent conserva la fecha final; falta clasificar el motivo PILA y calcular los segmentos aprobados.                                                                                                                                                                                                 |
| 85    | Inicio IGE                                     | PayrollPilaEvent conserva la fecha de inicio informada; falta calcular los segmentos aprobados.                                                                                                                                                                                                               |
| 86    | Fin IGE                                        | PayrollPilaEvent conserva la fecha final informada; falta calcular los segmentos aprobados.                                                                                                                                                                                                                   |
| 87    | Inicio LMA                                     | PayrollPilaEvent conserva la fecha de inicio informada; falta calcular los segmentos aprobados.                                                                                                                                                                                                               |
| 88    | Fin LMA                                        | PayrollPilaEvent conserva la fecha final informada; falta calcular los segmentos aprobados.                                                                                                                                                                                                                   |
| 89    | Inicio VAC-LR                                  | PayrollPilaEvent conserva la fecha de inicio; falta distinguir vacaciones/licencia remunerada y calcular los segmentos aprobados.                                                                                                                                                                             |
| 90    | Fin VAC-LR                                     | PayrollPilaEvent conserva la fecha final; falta distinguir vacaciones/licencia remunerada y calcular los segmentos aprobados.                                                                                                                                                                                 |
| 91    | Inicio VCT                                     | Evento PILA explícito captura la fecha informada por el aportante; aún falta mapearla a segmentos por subsistema y probar el archivo.                                                                                                                                                                         |
| 92    | Fin VCT                                        | Evento PILA explícito conserva la fecha final opcional informada por el aportante; no se deriva automáticamente; aún falta mapearla a segmentos y probar el archivo.                                                                                                                                          |
| 93    | Inicio IRL                                     | PayrollPilaEvent conserva la fecha inicial informada; falta calcular el efecto aprobado en días e IBC del subsistema de riesgos.                                                                                                                                                                              |
| 94    | Fin IRL                                        | PayrollPilaEvent conserva la fecha final informada; falta calcular el efecto aprobado en días e IBC del subsistema de riesgos.                                                                                                                                                                                |
| 95    | IBC otros parafiscales                         | El payload local congela una base candidata `CO_PARAFISCAL_BASE_V1` desde conceptos salariales aprobados para el subconjunto soportado; bloquea vacaciones, otros devengos y escenarios sin regla revisada.                                                                                                   |
| 96    | Horas laboradas                                | Falta: Empleado.jornadaLaboral solo clasifica jornada, no horas realmente trabajadas en el período.                                                                                                                                                                                                           |
| 97    | Fecha de radicación en el exterior             | Falta: no hay dato; solo aplica con declaración de colombiano en el exterior.                                                                                                                                                                                                                                 |
| 98    | Actividad económica ARL                        | `PilaAsignacionCentroTrabajo` conserva el código y vigencia por empleado; el snapshot v2 lo valida contra el catálogo versionado de 1.018 códigos del Decreto 768/2022 y la clase de riesgo de afiliación. No es todavía un campo serializado ni aceptado por un operador.                                    |

#### Hallazgos que bloquean el serializador

1. Las PR apiladas #163–#170 congelan en el payload PILA los datos de aportante,
   empleado, ubicación, afiliaciones, eventos y asignaciones ARL necesarios para
   empezar la preparación. Aún están abiertas y no forman parte de `main`.
   Los snapshots históricos no se rellenan; el informe detecta algunos faltantes
   leyendo solo el snapshot, pero no comprueba todos los datos obligatorios.
2. Para una planilla E estándar aún faltan fuentes o validaciones de períodos,
   días e IBC por subsistema, CCF, exoneraciones y datos del aportante. La
   clasificación salarial declarada es nullable; snapshots sin dato siguen
   bloqueados. El informe preliminar no es un preflight normativo completo.
3. Las novedades genéricas de nómina no tienen la semántica ni los intervalos
   aprobados para todos los campos 15–30 y 80–94 de AT2. Los eventos PILA
   explícitos ya se congelan en la rama abierta, pero todavía no se segmentan ni
   se mapean a un archivo. No se pueden inferir por similitud de nombre.
4. Los valores asignados o liquidados por el operador (incluidos campos de
   encabezado y subcuentas del FSP) necesitan pruebas con el operador elegido;
   no se deben rellenar con ceros o códigos supuestos para obtener la longitud.
5. El conteo del encabezado se hace por cotizante único, mientras que AT2
   permite múltiples registros de detalle 02 para un cotizante en casos
   definidos. El serializador necesita fixtures que cubran esa diferencia.

La matriz AT2 no cambia la fuente de verdad de Payroll ni valida compatibilidad
con un operador. Las salidas candidatas de conceptos
son solo referencias a importes ya presentes en el snapshot; no autorizan
recalcularlos ni agregar campos del maestro mutable al histórico. Se requiere
revisar reglas de AT2 v30, la Resolución 1529 y sus hitos normativos con casos laborales
representativos antes de aprobar cualquier fixture ejecutable.

La revisión confirma que el diseño aprobado es viable, pero el exportador todavía
no tiene reglas y cobertura suficientes para producir un archivo válido de
manera general. **GOAL ACTIVO:** GOAL-02. **IMPLEMENTACIÓN BLOQUEADA:** no
serializar ni descargar registros tipo 1/2 hasta completar la matriz normativa,
los cálculos y segmentos laborales soportados, la validación de todos los campos
y sus fixtures esperados. **ARQUITECTURA DISPONIBLE:** ADR-013, el historial
tenant-scoped de afiliaciones del PR #160 y los payloads de preparación
congelados por las PR abiertas #163–#170 permiten avanzar sin reescribir
PayrollSnapshot históricos ni completar desde maestros actuales.

El módulo `pila-at2-v30-record-serializer.ts` aporta el formato de caracteres de
longitud fija descrito en AT2 v30: archivo tipo 1 (34 campos/567 posiciones),
encabezado tipo 2 (22/359) y detalle tipo 2 (98/693). Rellena `N` con ceros a
la izquierda y `A` con espacios a la derecha; obliga a que el llamador decida
cómo representar cada campo vacío y rechaza desbordamientos, campos omitidos y
caracteres de control. Es una primitiva de formato, no el serializador de PILA:
no mapea snapshots, calcula reglas laborales, decide si un vacío es normativo,
codifica bytes, agrega separadores ni genera una descarga. La compatibilidad de
carga por operador sigue pendiente.

El contrato de snapshot de nómina `PayrollSnapshot.payloadVersion` permanece en
versión 1. Los datos regulatorios se capturan por separado en
`PayrollSnapshot.pilaPayload` con `pilaPayloadVersion`; el código de la pila
abierta usa versión 2 para este payload. Esa captura separada incluye fuentes
confirmadas del aportante, empleado, período, contrato/sede, afiliaciones,
novedades PILA y asignaciones de riesgo, con datos no disponibles preservados
como nulos y reportados por el preflight. La existencia de esos orígenes no
significa que todos los campos AT2 estén calculados, validados o listos para
serialización. Los snapshots históricos sin un payload PILA compatible no se
rellenan desde registros mutables ni se reescriben.

`ServicePremiumCalculator` y el seed financiero siguen consumiendo el payload
de nómina v1; el versionamiento PILA separado evita cambiar ese contrato para
capturar fuentes regulatorias. Todo cambio futuro al `pilaPayload` debe
incrementar su versión cuando cambie su esquema y comprobar consumidores,
compatibilidad de snapshots aprobados e integridad del escenario demo. Esto no
autoriza backfill ni reescritura de históricos.

PR #162 ya fue fusionada en `main` como `a459683`: la fecha prevista de pago de
aportes PILA se conserva en períodos y snapshots nuevos y sigue siendo distinta
del pago del salario o de la evidencia de pago de aportes.

Las PR abiertas #163–#170 agregan preparación explícita para el subconjunto
dependiente estándar: fuentes empresariales y laborales congeladas, afiliación
efectiva, eventos, riesgo y bloqueos de eventos que requieren segmentación.
El payload calcula 30 días por subsistema solo para el caso de mes calendario
completo, cobertura completa, tipo 01/subtipo 00 y sin eventos que requieran
segmentar. La proyección del salario básico para el campo 40 debe ser un entero
no negativo; no modifica el cálculo de Payroll. Para el campo 95 existe la regla
candidata versionada `CO_PARAFISCAL_BASE_V1`, que bloquea fuentes ambiguas y no
usa el IBC común ni los valores de aportes ICBF/SENA como base. Estas reglas son
insumos de preparación, no una aprobación laboral de la liquidación PILA.

Siguen pendientes reglas y pruebas para períodos, días/IBC por subsistema,
obligación CCF, exoneraciones, campos atribuidos al operador, novedades con
segmentación y múltiples detalles tipo 02 por cotizante. El tipo salarial
declarado `X`, `F` o `V` es nullable y se congela para capturas nuevas; una
contradicción con el cálculo o un cambio salarial dentro del período bloquea la
exportación. La revisión laboral independiente sigue siendo necesaria antes de
habilitar descarga.

El siguiente incremento debe resolver un subconjunto explícito de esas reglas y
completar fixtures anonimizados tipo 1/2 con fuente por campo, versión y fecha
normativa, salida esperada y revisor. La matriz de aceptación documenta el
escenario objetivo, pero no es por sí sola un fixture aprobado. La generación
solo comienza cuando el conjunto soportado sea reconstruible y verificable; los
demás escenarios permanecen bloqueados.

Detalle de las reglas de preparación capturadas en la pila abierta:
captura 30 días separados para pensión, salud, riesgos y CCF únicamente si el
período es un mes calendario completo, empleado/contrato/una afiliación cubren
todo el mes, el cotizante es 01 con subtipo explícito 00 y no hay novedades
que requieran segmentación PILA. En los demás casos guarda null y los códigos
de bloqueo; no infiere días desde Payroll ni afirma que el snapshot sea
exportable. La regla interna `PILA_FULL_MONTH_DAYS_V1` tiene prueba unitaria
para el caso completo y el bloqueo por novedad. Esta captura sigue sin incluir
los casos de
ingreso/retiro, novedades, cambios de IBC o múltiples detalles 02.
Para el campo 40 conserva el salario básico original y publica una proyección
separada para PILA únicamente si es un entero seguro no negativo. Si falta o
contiene centavos, deja esa proyección en null con un bloqueo; no redondea ni
modifica el cálculo de nómina. Esta validación de forma no reemplaza la revisión
de aplicabilidad del campo 40 por tipo de cotizante.
El campo 95 queda representado en el payload con la regla candidata
`CO_PARAFISCAL_BASE_V1`: deriva salario fijo/integral y horas extra únicamente
si los importes fuente son inequívocos y cubren el mes completo. Los casos no
soportados conservan `valor: null` y códigos de bloqueo. Nunca se copia el IBC
común ni se toman como base los valores de aporte ICBF/SENA. La revisión
laboral independiente sigue pendiente antes de habilitar descarga.
Para el campo 41, el tipo salarial declarado `X`, `F` o `V` se captura en la
ficha del empleado y se congela en el payload PILA de Payroll al generar o
recalcular la nómina. `X` debe coincidir con el indicador de salario integral
usado por el cálculo; una contradicción queda sin tipo y con bloqueo. Los
registros históricos con clasificación nula permanecen así y no se convierten
automáticamente; la ausencia de conceptos variables no se toma como evidencia
suficiente de salario fijo. La ficha no tiene vigencias salariales; un cambio
dentro de un período no se puede segmentar todavía y queda fuera de la
exportación hasta modelar el evento laboral correspondiente.

El serializador solo puede habilitar el subconjunto que tenga todos sus campos,
fuentes congeladas, reglas y vigencias revisadas, fixture anonimizado con salida
esperada y validación del operador acordado. Los escenarios que no cumplan esa
evidencia permanecen bloqueados.

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
- `apps/api/src/payroll/pila-event-validation.ts`, `apps/api/src/payroll/payroll.service.ts`,
  `apps/api/src/payroll/payroll.controller.ts` y la interfaz de captura en
  `apps/web/src/features/payroll/components/payroll-pila-events-panel.tsx` —
  eventos PILA explícitos tenant-scoped, validados y copiados al snapshot fuente.
- `apps/api/prisma/schema.prisma` — `PayrollPeriod` conserva `fechaInicio`,
  `fechaFin` y `fechaPrevistaPagoPila` nullable; el servicio congela esta última
  previsión PILA en el payload del snapshot aprobado. No representa el pago del
  salario ni el pago efectivo de aportes.
- `apps/api/src/payroll/dto/create-payroll.dto.ts` y su prueba — la fecha
  prevista de PILA se valida como día calendario estricto y no acepta
  timestamps ni fechas inválidas.
- [Página oficial PILA de MinSalud](https://www.minsalud.gov.co/Proteccion-Social/Paginas/pila.aspx)
  enlaza el PDF `anexo-tecnico2-cotizantes.pdf`. La descarga directa fresca del
  2026-10-31 identifica AT2 v30, 24-07-2026 (336 páginas; SHA-256
  `BBB3C2D0486FD7D3934BD640D8E68C60D33686B1604E8EFAA980139FB5686D33`).
- [Resolución 1529 de 2026](https://www.minsalud.gov.co/sites/rid/Lists/BibliotecaDigital/RIDE/DE/DIJ/resolucion-1529-de-2026.pdf),
  expedida el 24 de julio de 2026 (PDF oficial de 58 páginas), modifica los
  Anexos Técnicos 2 y 3 y fija fechas escalonadas. Su artículo 1 incorpora
  cambios específicos al AT2; los numerales 5.84–5.93 indican vigencias, entre
  ellas pagos desde octubre para identificación y pagos desde noviembre para
  aclaraciones de planilla E y cotizante 75. La Resolución 1641 de 2026 adopta
  el formulario de afiliación y novedades de riesgos laborales; su referencia
  a la Resolución 1529 en los considerandos no se trata como una modificación
  adicional del AT2. El cotejo debe verificar los campos y plazos de AT2 v30,
  la Resolución 1529 citada por el anexo y normas posteriores, sin aplicar como
  delta un cambio ya incorporado.
- [Resolución 611 de 2026](https://www.minsalud.gov.co/Normatividad_Nuevo/Resolucion%20No%20611%20de%202026.pdf),
  permanencia temporal en régimen subsidiado de ciertas personas vinculadas
  laboralmente; establece un plazo de seis meses para ajustes operativos PILA.
- [Publicaciones regulatorias de MinSalud](https://www.minsalud.gov.co/Normativa/Paginas/Resoluciones.aspx)
  — revisado el 2026-10-31, publica el proyecto de ajuste de los numerales
  5.87 y 5.91 del Anexo Técnico 2 para el cotizante con permanencia en régimen
  subsidiado. Sigue identificado como proyecto/consulta pública; no sustituye
  la Resolución 1529 mientras no se expida una norma definitiva.
- [SOI](https://www.soi.com.co/empresa-servicios-de-soi),
  [Enlace Operativo/SuAporte](https://www.enlace.com.co/hubfs/Manuales/C%C3%B3mo%20cargar%20un%20archivo%20plano%20en%20SuAporte.pdf?hsLang=es-co)
  y [Aportes en Línea](https://www.aportesenlinea.com/Documents/Instructivo%20Corrector%20por%20Pantalla%20v.1.3.pdf)
  documentan el cargue de archivos planos.
