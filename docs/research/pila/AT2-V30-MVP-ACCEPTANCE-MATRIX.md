# Matriz de aceptación previa — PILA AT2 v30

**Estado:** preparación para revisión; no habilita el exportador ni afirma que
un archivo pueda cargarse en un operador.

**Corte de evidencia:** 2026-10-31.

**ADR relacionado:** [ADR-013 — Exportación estándar de nómina a PILA](../../adr/ADR-013-pila-standard-file-export.md).

## Alcance propuesto para el primer incremento

Validar primero una planilla E de un aportante empleador con trabajadores
dependientes estándar, tipo de cotizante `01`, subtipo explícito `00` (sin
subtipo especial), período mensual completo y snapshot de nómina aprobado.
Cada afiliación debe cubrir todo el período y los datos del aportante, trabajador,
centro ARL y actividad económica deben estar confirmados y congelados en el
snapshot. Casos con ingreso/retiro parcial, variaciones, ausentismos, varios
detalles por trabajador, salario o pagos no clasificados y tipos/subtipos
especiales quedan bloqueados hasta que Payroll conserve los resultados por
segmento y subsistema.

Esta acotación es una recomendación de preparación. La aceptación del archivo
por un operador requiere una prueba independiente en ese portal; la validación
local no se presentará como aceptación, liquidación o pago.

## Fuente normativa identificada

La [página oficial PILA de MinSalud](https://www.minsalud.gov.co/Proteccion-Social/Paginas/pila.aspx)
publica el enlace **Anexo Técnico 2 - Cotizantes**. Una descarga directa del
enlace `anexo-tecnico2-cotizantes.pdf`, verificada el 2026-10-31, identifica en
su página 2 **AT2 versión 30, fecha 24-07-2026**, tiene 336 páginas y SHA-256
`BBB3C2D0486FD7D3934BD640D8E68C60D33686B1604E8EFAA980139FB5686D33`.
La copia se usa como evidencia de esta matriz, no como una dependencia binaria
del repositorio.

Referencias revisadas en esa copia:

- Archivo tipo 1, estructura de campos 1–34: páginas impresas 9–16.
- Archivo tipo 2, encabezado de registro 01: páginas impresas 26–30.
- Archivo tipo 2, detalle de registro 02: páginas impresas 80–102.
- Uso de varios detalles 02 para un cotizante: páginas impresas 102–104.
- Reglas de días de los campos 36–38: páginas impresas 146–147; validaciones
  de estructura de los campos 36–39: páginas impresas 91–92.
- Tipo 01 dependiente y base proporcional en escenarios parciales: página impresa 104.
- Tipo 01 y subtipo 00: estructura de tipo/subtipo en página impresa 85.
- Reglas de distribución del aporte pensional entre componentes: páginas
  impresas 147–154.

## Mapa de registros y valores

El AT2 distingue el **archivo tipo 1** (datos generales del aportante) del
**archivo tipo 2** (planilla integrada). El segundo contiene un registro 01 de
encabezado y registros 02 de detalle; por tanto, “tipo 1/2” no significa que el
registro 01 de planilla sea el archivo tipo 1 del aportante.

| Artefacto AT2                | Estructura verificada        | Regla de aceptación local                                                                                                                                                                                                                                                                                                                                                               |
| ---------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Archivo tipo 1 del aportante | Campos 1–34; 567 caracteres. | No generarlo si falta un dato obligatorio o una declaración expresa del aportante. Validar el documento del aportante por tipo, DV `0` para persona natural, y longitudes de campos 1, 5–6, 11, 16–18 y 21–24; el fax numérico y correo respetan su formato AT2. El representante se valida por tipo de documento. No truncar ni derivar declaraciones desde `Sede` o nombres de texto. |
| Archivo tipo 2, registro 01  | 22 campos; 359 caracteres.   | Un encabezado por planilla. Mantener los campos que AT2 asigna al operador como tales; solo usar una convención de archivo plano que tenga evidencia de carga por operador.                                                                                                                                                                                                             |
| Archivo tipo 2, registro 02  | 98 campos; 693 caracteres.   | Una o varias líneas por trabajador según AT2. El total de líneas no sustituye el conteo de cotizantes únicos del encabezado. Cada línea procede de resultados y afiliaciones congelados.                                                                                                                                                                                                |

### Mapa de fuentes para el archivo tipo 1

El mapeo siguiente contrasta los 34 campos de AT2 con `buildPilaSourceContext`
y `inspectPilaSnapshotPreparation`. Es un mapa de fuentes candidatas, no una
autorización para descargar un registro. Los campos numéricos se rellenan con
ceros a la izquierda y los alfanuméricos con espacios a la derecha (AT2 v30,
p. 9).

| Campos | Fuente congelada / regla explícita                                                        | Estado o bloqueo actual                                                                                                                                                                                                                                           |
| ------ | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1      | `employer.razonSocial`.                                                                   | Obligatorio; máximo 200 posiciones.                                                                                                                                                                                                                               |
| 2–3    | `employer.pila.tipoDocumentoAportante` y `employer.nit`.                                  | Tipo y número se validan con caracteres y longitud propios de NI/CC/CE/TI/PA/CD/SC/PE/PT/PC; PE exige 15 dígitos.                                                                                                                                                 |
| 4      | `employer.digitoVerif`.                                                                   | Para persona jurídica se exige un dígito y la validación DIAN queda al operador; para persona natural AT2 exige `0`.                                                                                                                                              |
| 5–6    | `employer.pila.formaPresentacion`, `codigoSucursal`, `nombreSucursal`.                    | Para `U`, campo 5 va en blanco; para `S`, se exige código y el nombre puede ser el código si el aportante no suministra uno.                                                                                                                                      |
| 7–10   | `employer.pila.claseAportante`, `naturalezaJuridica`, `tipoPersona`, `formaPresentacion`. | Requieren declaraciones explícitas. La clase se captura ahora en el perfil PILA y se congela en snapshots nuevos; los snapshots históricos que no la traen quedan bloqueados. El MVP solo acepta clase A/B validable; C/D permanecen bloqueadas por elegibilidad. |
| 11–17  | Dirección, municipio, CIIU, teléfono, fax y correo del aportante.                         | Municipio de cinco dígitos se divide en departamento (13) y municipio (12); teléfono es obligatorio; fax/correo son opcionales pero se validan si existen.                                                                                                        |
| 18–24  | Identificación, tipo y nombres del representante legal.                                   | Para persona jurídica se exigen campos 18, 20, 21 y 23; CC/CE/PA/CD aplican límites específicos. El campo 19 es el cero definido por AT2. Persona natural puede omitir el bloque.                                                                                 |
| 25–27  | Fecha de inicio, acción y fecha fin de situación especial del aportante.                  | El MVP exige confirmación explícita de “sin acción especial”; solo puede mapearse el código 0 y se dejan 25/27 vacíos. Acciones especiales bloquean.                                                                                                              |
| 28–29  | Código del operador y período de pago, asignados por el sistema según AT2.                | El código del operador no está en el snapshot; hay período y fecha prevista de pago, pero no un mapeo aprobado al campo 29. No inferir: falta confirmar qué suministra SOI y qué completa el portal; bloquea serialización tipo 1.                                |
| 30     | `employer.pila.tipoAportante`.                                                            | Solo se admite la declaración explícita `1` (empleador).                                                                                                                                                                                                          |
| 31–32  | Fecha de matrícula y departamento del domicilio principal para Ley 1429.                  | La fecha de matrícula se congela; el departamento se toma del DIVIPOLA del domicilio del aportante en `employer.municipio`, como define ADR-013. Solo aplican al beneficio; elegibilidad de clase D no está validada, por lo que el MVP la bloquea.               |
| 33–34  | Exoneración y beneficio CCF de Ley 1429.                                                  | Exigen respuesta explícita del aportante; si son afirmativas, falta validar evidencia de elegibilidad y la exportación se bloquea.                                                                                                                                |

`pila-at2-v30-employer-mapper.ts` produce ahora un mapa candidato parcial de
campos a valores congelados. No valida el registro ni lo serializa. Conserva sin
resolver los campos 28–29 asignados al operador, deja explícitos los datos
obligatorios ausentes (incluida la clase 7 en snapshots anteriores a su captura)
y no convierte la proyección en un archivo descargable. El campo 16 sin fax
permanece pendiente porque todavía no está aprobada su representación vacía
numérica.

### Mapa de fuentes para el encabezado tipo 2 (registro 01)

AT2 v30, pp. 26–30, define 22 campos y 359 posiciones. En el alcance actual,
la planilla es tipo `E`; el mapa separa los valores aportados por la aplicación
de los que AT2 asigna al operador.

| Campos | Fuente congelada / regla explícita                                           | Estado o bloqueo actual                                                                                                                                                                                                |
| ------ | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1      | Constante de formato `01`.                                                   | La aplicación genera el identificador del registro.                                                                                                                                                                    |
| 2      | Modalidad de planilla (`1` electrónica o `2` asistida).                      | AT2 dice que la genera automáticamente el operador; falta confirmar cómo debe venir en el archivo de entrada de SOI.                                                                                                   |
| 3      | Secuencia del aportante, ascendente desde `0001`.                            | Para un único encabezado de planilla puede iniciarse en `0001`; generación de varias planillas en un mismo archivo no está implementada.                                                                               |
| 4–7    | Campos 1–4 del archivo tipo 1.                                               | Reusar el snapshot aprobado; validar identidad y DV según el mapa tipo 1.                                                                                                                                              |
| 8–10   | Tipo de planilla `E`; número y fecha de planilla asociada.                   | Para `E`, los campos 9 y 10 se dejan en blanco por AT2.                                                                                                                                                                |
| 11–13  | Forma de presentación y sucursal, desde campos 10, 5 y 6 del archivo tipo 1. | Reusar reglas de `U`/`S`; no deducir sede laboral.                                                                                                                                                                     |
| 14     | Código ARL del aportante, `employer.pila.codigoArlAportante` (A6).           | Hay dato explícito en el snapshot; el preflight bloquea más de seis posiciones sin truncar. No sustituirlo por el centro ARL del empleado; catálogo y convención de carga se validan por operador.                     |
| 15     | Período de pago para sistemas distintos a salud.                             | AT2 indica que lo calcula el operador; no hay regla local aprobada para asignarlo.                                                                                                                                     |
| 16     | Período de pago del sistema de salud, formato `AAAA-MM`.                     | El período mensual completo del snapshot es fuente candidata; la selección final debe contrastarse por operador y vigencia normativa.                                                                                  |
| 17     | Número de radicación/planilla.                                               | Asignado por el sistema del operador; no se inventa en el archivo de entrada.                                                                                                                                          |
| 18     | Fecha de pago efectiva.                                                      | Asignada por el operador desde el pago real. `fechaPrevistaPagoPila` no es pago realizado y nunca se copia aquí.                                                                                                       |
| 19     | Conteo de cotizantes únicos del detalle (5 N).                               | Calculable desde snapshots incluidos, una vez por persona y excluyendo tipo 40; el preflight bloquea más de 99.999 y no cuenta líneas repetidas de un cotizante.                                                       |
| 20     | Suma del campo 45 (IBC CCF) de los detalles aplicables, no salario bruto.    | El informe preliminar suma los IBC CCF congelados cuando todos están presentes y caben individualmente en N9; bloquea un total mayor que N12. Esto no valida obligación ni aplicabilidad CCF y no autoriza serializar. |
| 21     | Tipo de aportante del campo 30 del archivo tipo 1.                           | Snapshot declara tipo `1` para empleador.                                                                                                                                                                              |
| 22     | Código del operador de información.                                          | Asignado por el operador; no existe un código en el snapshot ni una convención de entrada confirmada.                                                                                                                  |

`pila-at2-v30-header-mapper.ts` mapea candidatos del encabezado desde snapshots
v2 de un mismo tenant y período. Solo calcula el conteo y la suma CCF si cada
empleado aparece una vez con afiliación dependiente `01`/`00` que cubre el mes;
si hay duplicados o casos fuera del MVP, ambos totales quedan sin resolver. Los
campos asignados al operador siguen pendientes, y este mapa no valida ni
serializa el encabezado.

MinSalud marca los campos 2, 15, 17, 18 y 22 como generados o asignados por el
operador/sistema. Las páginas públicas de SOI confirman carga de archivos
planos y que el portal devuelve número de planilla y total a pagar; su
Autocorrector revisa redondeos, topes, obligación de subsistemas y
proporcionalidad. Esta evidencia confirma el portal candidato, no la
convención de campos ni compatibilidad: la prueba de carga del archivo sigue
pendiente ([servicios de SOI](https://www.soi.com.co/persona-servicios-de-soi),
[Autocorrector SOI](https://www.soi.com.co/autocorrector)).

Para el detalle 02, el alcance de datos de mayor riesgo es:

| Campos         | Dato                                         | Evidencia y condición para aceptar                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 3–4            | Documento y número de cotizante              | Para este MVP: CC numérico hasta 10 dígitos, CE hasta 7, TI hasta 11 y PA alfanumérico A–Z/0–9 hasta 16. No corregir ni truncar IDs. Otros tipos quedan fuera del MVP.                                                                                                                                                                                                                                                               |
| 5–6            | Tipo y subtipo de cotizante                  | Solo `01` / `00` en el alcance inicial. AT2 marca el subtipo obligatorio y define `0` cuando no aplica subtipo; en el campo numérico de dos posiciones se representa como `00`. Nulo o un subtipo especial bloquea.                                                                                                                                                                                                                  |
| 7–8            | Exención pensional y residencia              | AT2 v30, pp. 86–87: campo 7 es blanco para CC/TI; CE/PA requiere declarar sí/no si el extranjero está exento de cotizar a pensión. Campo 8 es blanco para CE/PA; CC/TI requiere declarar sí/no si es colombiano en el exterior. Las declaraciones se conservan con vigencia y viajan congeladas en snapshots; afiliaciones históricas sin respuesta siguen bloqueadas. No se infieren flags desde sede, nacionalidad ni texto libre. |
| 11–14          | Nombres del cotizante                        | Campos 11/13 obligatorios; primer apellido/nombre hasta 20 posiciones y segundo apellido/nombre hasta 30. Bloquear exceso; no truncar.                                                                                                                                                                                                                                                                                               |
| 15–30 y 80–94  | Novedades y fechas                           | Solo códigos, intervalos y días explícitos. No convertir `PayrollNovelty` genérica en código PILA. Hasta tener segmentación aprobada, una novedad que afecte el detalle bloquea.                                                                                                                                                                                                                                                     |
| 31, 33, 35, 77 | Códigos de administradoras                   | Los códigos de pensión, EPS, CCF y ARL son A6: el preflight exige valor y bloquea más de seis posiciones sin truncar; el catálogo y la aceptación del operador siguen pendientes.                                                                                                                                                                                                                                                    |
| 36–39          | Días por pensión, salud, riesgos y CCF       | Cuatro valores separados, cada uno de 0–30 y sujeto a obligación y novedad propias. AT2 expresa el total de 30 independientemente de si el mes tiene 28/30/31 días para 36–38; el campo 39 también exige un valor propio y una novedad correspondiente si es menor que 30. Para el caso estándar de mes completo y una sola línea, el expected value es 30 en cada campo. No copiar un contador general a los cuatro campos.         |
| 40–41          | Salario básico y tipo de salario             | Campo 40: entero sin centavos, no negativo y con máximo 9 dígitos (hasta $999.999.999); puede ser inferior a un SMLMV. Campo 41: explícito para tipo 01 (`X`, `F` o `V`). No inferir “fijo” porque el valor no haya cambiado.                                                                                                                                                                                                        |
| 42–45          | IBC de pensión, salud, riesgos y CCF         | Bases independientes, suministradas por el aportante. Cada campo admite hasta 9 dígitos; el preflight bloquea desbordamientos y no trunca. El exportador solo puede copiar importes aprobados por Payroll; no copiar `PayrollRun.ibc` a todos los subsistemas.                                                                                                                                                                       |
| 46–75          | Tarifas, aportes, fondos y campos especiales | La matriz campo por campo sigue pendiente. AT2 v30 define fórmulas de validación para varios aportes; el resumen verificable y las fuentes candidatas del snapshot aparecen abajo. No se habilita serialización ni compatibilidad por operador.                                                                                                                                                                                      |
| 62, 78, 98     | Centro ARL, clase y actividad económica      | Usar asignación con vigencia del empleado, código asignado por ARL y catálogo de Decreto 768/2022 versionado. El campo 62 es N9 (AT2 v30, p. 95): aceptar solo 1–9 dígitos, conservar ceros iniciales y bloquear sin truncar ni convertir valores incompatibles. Una sede no reemplaza el centro ARL.                                                                                                                                |
| 95             | IBC de otros parafiscales                    | Obligatorio para tipo 01 y limitado a 9 dígitos. Requiere origen salarial auditable, base propia en el snapshot y reglas aprobadas. El valor candidato actual no constituye por sí mismo aprobación normativa.                                                                                                                                                                                                                       |

`pila-at2-v30-detail-mapper.ts` mapea candidatos desde un snapshot v2 para los
campos 1–8, 11–14, 31, 33, 35, 36–45, 62–63, 65, 67, 69, 77–78, 95 y 98. Exige
el escenario dependiente `01`/`00`, cobertura mensual de empleado/contrato/
afiliación y, para el centro ARL, tenant, vigencia, ARL y catálogo versionado
coincidentes. Los importes 63/65/67/69 solo se copian desde un concepto patronal
único, con tipo esperado, factor positivo y base coincidente; exige mes completo,
días aprobados y ningún evento o novedad PILA. El Los campos 66/68 comparan contra tarifas versionadas de 2 %/3 % solo para empleadores privados estándar, clase A/B, sin beneficio Ley 1429 y con no exoneración explícita coherente entre perfil y snapshot. Los importes 67/69 también exigen factor exacto, IBC campo 95 y redondeo aprobado; no se calcula ni infiere cero. Si el tenant declara exoneración, el candidato sigue bloqueado incluso para un salario alto hasta validar la regla por empleado. La
ausencia del aporte no se convierte en cero.
Conserva identificadores y códigos de centro con ceros iniciales. Ninguna tarifa
ni aporte se calcula: los candidatos no son validación normativa ni se
serializan como registro.

### Reglas de aportes verificadas en AT2 v30

La revisión de los campos de aportes confirma fórmulas de validación, pero no
aprueba automáticamente el mapeo de conceptos ni el cálculo almacenado por
Payroll. Los valores de salida deben proceder del snapshot aprobado; la
validación local puede contrastarlos con estas reglas sin sustituir tarifas,
redondeos o decisiones laborales. Las páginas son las impresas en el anexo.

| Campos                     | Regla AT2 v30                                                                                                                                                                                                                                                  | Fuente candidata en el snapshot y brecha actual                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 46–47 pensión              | El campo 46 usa la tarifa legal vigente; 0 solo se permite para quien no esté obligado. El campo 47 valida `IBC 42 × tarifa 46`, con redondeo normativo (pp. 147–148).                                                                                         | Para empleador privado tipo 1, dependiente 01/00 de mes completo con obligación explícita y período/pago anteriores a 2027-04-01, se muestra 46=`0.16000` y 47 como suma de los valores congelados PENSION_EMP 4 % y PENSION_PAT 12 %. Ambos deben tener base igual a campo 42, cumplir redondeo individual y suma redondeada igual a IBC × 16 %. No se calcula ni sustituye ningún importe; todo caso incompleto, especial o desde el corte permanece bloqueado. La codificación decimal requiere prueba por operador.                                                                                                                                                                                                                               |
| 48–49, 53                  | Aportes voluntarios y valor no retenido dependen del régimen y de declaraciones relacionadas (p. 155 y p. 159).                                                                                                                                                | No hay un origen explícito aprobado para estos valores en la captura estructurada actual. No derivarlos del texto libre ni escribir cero sin confirmar aplicabilidad.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 51–52 FSP                  | Se exigen según la suma de IBC pensional del cotizante y los umbrales/reglas aplicables; AT2 separa subcuenta de solidaridad (0,5 %) y subsistencia (pp. 156–158).                                                                                             | Payroll conserva un concepto `FSP` agregado; no separa las subcuentas ni congela la base sumada por cotizante requerida por AT2. El mapeo permanece bloqueado cuando aplique.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 54–55 salud                | La tarifa 54 debe ser vigente y considera la exoneración declarada tanto por aportante como por cotizante. El campo 55 valida `IBC 43 × tarifa 54`, con redondeo normativo (p. 159).                                                                           | El preflight v2 valida `SALUD_EMP` y, cuando existe, `SALUD_PAT` como fuentes únicas, de tipo esperado y con base coincidente. La exoneración positiva actualmente queda bloqueada por falta de validación de elegibilidad.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 61–63 riesgos              | La tarifa 61 corresponde a la tarifa inicial vigente para la clase de riesgo; el campo 63 valida IBC 44 × tarifa 61 y aplica el redondeo normativo (p. 160). Resolución 2634/2014, art. 7, conserva el campo 61 como decimal: 0,522 % se representa 0.0052200. | El campo 61 usa la tabla candidata versionada CO_ARL_INITIAL_RATE_DEC1772_ART13_V1. El campo 63 solo se agrega si el importe congelado coincide con la regla versionada CO_PILA_CONTRIBUTION_ROUND_UP_100_DEC1990_ART3_2_1_5_V1; si no, queda sin resolver. El validador no reemplaza Payroll ni habilita exportación.                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 64–65 CCF                  | La tarifa 64 debe ser la vigente; 0 solo cuando el cotizante no esté obligado. El campo 65 valida `IBC 45 × tarifa 64`, con redondeo normativo (p. 161).                                                                                                       | El candidato 64 usa `CO_CCF_STANDARD_RATE_L21_ART11_12_V1` (4 %) para dependientes 01/00 de mes completo, aportante empleador tipo 1, clase A/B y declaración explícita sin beneficio Ley 1429; exige concepto único `CAJA` con factor y base coincidentes. `0.04000` es codificación candidata basada en la convención histórica de Resolución 1747/2008, art. 19, derogada; AT2 v30 p. 95 confirma N7 pero la aceptación del formato vigente requiere carga por operador. El campo 65 conserva solo el importe aprobado si coincide con esa tarifa/base y el redondeo PILA; clases C/D, beneficio verdadero/desconocido y ausencia/no coincidencia de fuentes se bloquean, sin inferir cero.                                                        |
| 66–69 SENA e ICBF          | Las tarifas 66/68 deben estar vigentes; 0 solo si no hay obligación. Los campos 67/69 validan `IBC 95 × tarifa`, con redondeo normativo (p. 162).                                                                                                              | Candidatos versionados `CO_SENA_STANDARD_RATE_L21_ART12_V1` (2 %, `0.02000`) y `CO_ICBF_STANDARD_RATE_L89_ART1_V1` (3 %, `0.03000`) para empleador privado tipo 1, clase A/B, dependiente 01/00 de mes completo, sin beneficio Ley 1429 y con no exoneración confirmada. Las tarifas y conceptos exigen fuente única `SENA`/`ICBF`, factor exacto y base campo 95; importes 67/69 deben ya cumplir redondeo. Clases C/D, otras naturalezas, beneficios o exoneración ausente/positiva se bloquean; no se infiere cero. Si el tenant declara exoneración, también se bloquea al empleado de salario alto hasta validar el umbral por empleado. La codificación decimal viene de Resolución 1747/2008, derogada, y requiere prueba actual por operador. |
| 70–73 ESAP y MEN           | ESAP aplica solo a aportantes públicos incluidos en el reporte ministerial; MEN solo a aportantes públicos. Los campos 71 y 73 validan `IBC 95 × tarifa`, con redondeo normativo (pp. 163–164).                                                                | La captura actual no acredita pertenencia al reporte ESAP ni toda la elegibilidad pública. No mapear estas contribuciones hasta validar esos datos y sus tarifas.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Otros campos del intervalo | Campos voluntarios, UPC adicional, campos sin regla revisada y demás aplicabilidad deben contrastarse individualmente con la estructura completa del registro y el alcance del MVP.                                                                            | No inferir valores ni disponibilidad por continuidad numérica. En particular, el tipo 40 requerido para UPC adicional está fuera del alcance aprobado.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

Las fórmulas anteriores están descritas en AT2 v30, §§ 2.1.2.3.14–38. En todas
las que indican cálculo, el anexo remite a las reglas legales de redondeo o
aproximación vigentes. Los campos candidatos 63, 65, 67 y 69 comprueban la
aproximación al múltiplo de 100 superior del artículo 3.2.1.5 del Decreto 780
de 2016, modificado por el Decreto 1990 de 2016; aplica desde 2016-12-06. La
comprobación usa enteros exactos y solo acepta el valor que ya está congelado
en Payroll; no calcula ni reemplaza el importe. Los demás aportes aún requieren
versionar y comprobar su regla aplicable antes de mapearlos.

La regla candidata versionada `CO_ARL_INITIAL_RATE_DEC1772_ART13_V1` aplica
desde 1994-08-05 y usa las tarifas iniciales I–V 0,522 %, 1,044 %, 2,436 %,
4,350 % y 6,960 %. El factor del concepto ARL del snapshot se compara con la
clase de riesgo y la actividad vigentes. El campo 61 se representa como
fracción decimal de nueve posiciones, por ejemplo `0.0052200`, conforme a
Resolución 2634 de 2014, art. 7. El campo 63 queda como candidato solo cuando
el concepto ARL congelado ya coincide con el redondeo legal al múltiplo de 100
superior. Para los campos 65, 67 y 69, el factor decimal del concepto
congelado se convierte a una razón entera exacta antes de la comprobación; un
factor no representable sin pérdida mantiene el campo bloqueado. Una
discrepancia deja el campo sin resolver y no se corrige dentro del exportador;
la regla no habilita descarga.

La vista de preparación presenta conteos por empleado para los candidatos
parciales 61/63/64/65/66/67/68/69 y detalla motivos pendientes; un snapshot duplicado
bloquea la selección del empleado. Esta observabilidad local no equivale a una
validación completa de los registros tipo 2.

Para el tipo 1, los campos 16, 17 y 18 no se validan solo por longitud: el fax
es numérico, el correo debe respetar los caracteres y estructura de dominio de
AT2, y el documento del representante usa las reglas del tipo declarado (CC,
CE, PA o CD). AT2 v30, pp. 13–14.

La Resolución 1529/2026 y cualquier actualización posterior se deben evaluar
por período cotizado y fecha prevista/confirmada de pago PILA, conforme al
versionamiento explícito del ADR-013. La fecha del salario o la fecha en que se
genera el archivo no determina el hito.

La [Sentencia C-264 de 2026 de la Corte Constitucional](https://www.corteconstitucional.gov.co/relatoria/2026/C-264-26.htm)
dispuso que las disposiciones exequibles de la Ley 2381 que componen el nuevo
sistema pensional entran en vigor el **1 de abril de 2027**. El AT2 v30 incluye
reglas de distribución pensional entre componentes y un umbral de 2,3 SMLMV
(pp. 149–154), pero la sola presencia de estas reglas en el formato no permite
activarlas para planillas anteriores al hito. La selección debe considerar el
período cotizado, la fecha prevista/confirmada de pago, las disposiciones que
la sentencia exceptúa y cualquier norma posterior. La vigencia efectiva debe
verificarse de nuevo antes de habilitar planillas que alcancen el corte de
2027; este incremento no implementa esa distribución.

## Criterios de aceptación y pruebas de contrato

Las pruebas `PILA-AT2-01` a `PILA-AT2-36` son criterios objetivo para la futura
validación local. **“Bloquear” significa no producir una descarga parcial.**
La fuente normativa da el requisito del formato; donde se marca “Payroll debe
aprobar”, AT2 no define por sí solo el cálculo laboral que alimenta el campo.

| ID          | Fixture o condición                                                                                                                                                                                     | Resultado esperado                                                                                                                                                                                                                  | Evidencia / estado                                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| PILA-AT2-01 | Tipo 01/subtipo 00, planilla E, mes completo de 31 días, contrato, afiliación y centro ARL vigentes; snapshot aprobado y campos requeridos presentes.                                                   | Preflight sin errores de alcance; días 36–39 = 30 por subsistema. La futura serialización conserva cada base y aporte tal como aparece en el snapshot aprobado.                                                                     | AT2 v30, pp. 85, 91–95, 102 y 146–147. Confirmado como escenario objetivo, no como prueba de operador.               |
| PILA-AT2-02 | Mismo trabajador y reglas en febrero de 28 días.                                                                                                                                                        | Días 36–39 = 30, no 28.                                                                                                                                                                                                             | AT2 v30, §2.1.2.3.11–13, pp. 146–147.                                                                                |
| PILA-AT2-03 | Febrero bisiesto de 29 días.                                                                                                                                                                            | Días 36–39 = 30, no 29.                                                                                                                                                                                                             | AT2 v30, mismas secciones.                                                                                           |
| PILA-AT2-04 | Afiliación con subtipo nulo o faltante.                                                                                                                                                                 | Bloqueo explícito en campo 6; no convertir el histórico a `00`.                                                                                                                                                                     | AT2 v30, p. 85; formulario/DTO lo exigen en altas; snapshots null se bloquean sin backfill.                          |
| PILA-AT2-05 | Afiliación explícita `01` / `00` con cobertura del mes.                                                                                                                                                 | Aceptar el código como el caso estándar y permitir construir los días completos; nunca tratar `00` como subtipo especial.                                                                                                           | AT2 v30, p. 85; confirmado en código y prueba unitaria existente.                                                    |
| PILA-AT2-06 | Ingreso o retiro durante el mes, con campos 80/81 y días inferiores a 30.                                                                                                                               | AT2 permite menos de 30 días para los sistemas aplicables si existe ING/RET; hasta que Payroll apruebe días e IBC por subsistema, el preflight bloquea.                                                                             | AT2 v30, pp. 91–92, 146–147; cálculo esperado pendiente de fixtures laborales revisados.                             |
| PILA-AT2-07 | ING y RET en el mismo período.                                                                                                                                                                          | AT2 pide ambas novedades en el mismo registro 02; no se exporta mientras días/bases aprobados no estén disponibles.                                                                                                                 | AT2 v30, pp. 102–103.                                                                                                |
| PILA-AT2-08 | Más de una ING/RET o una variación de IBC.                                                                                                                                                              | Crear un registro 02 por novedad/variación conforme a la regla aplicable; conteo de encabezado cuenta al trabajador una sola vez. Hasta admitir segmentos, bloquear el lote.                                                        | AT2 v30, pp. 102–104.                                                                                                |
| PILA-AT2-09 | IGE/LMA/SLN/IRL/VAC-LR concurrente con VSP/VST o retiro.                                                                                                                                                | Separar los detalles que exige AT2 y conservar IBC aprobado de cada tramo; bloquear si solo existe un agregado mensual.                                                                                                             | AT2 v30, pp. 103–104.                                                                                                |
| PILA-AT2-10 | `PayrollNovelty` `SICKNESS`, `LICENSE`, `VACATION` o `BONUS` sin clasificación PILA y base salarial aprobadas.                                                                                          | Bloquear campos afectados; no inferir código de evento ni base.                                                                                                                                                                     | Restricción de dominio; Payroll debe aprobar casos y expected values antes de ampliar cobertura.                     |
| PILA-AT2-11 | IBC faltante o único frente a campos 42–45; campo 95 ausente.                                                                                                                                           | Bloquear por campo y empleado. Valores por subsistema distintos se conservan como distintos; el campo 95 tiene fuente propia.                                                                                                       | AT2 v30, pp. 92 y 101; validación de detalle pendiente.                                                              |
| PILA-AT2-12 | Cambiar salario, contrato, sede, afiliación, ARL o actividad después de aprobar Payroll.                                                                                                                | La preparación/exportación usa únicamente los datos congelados en el snapshot aprobado; no consulta maestros actuales para completarlo.                                                                                             | Criterio de inmutabilidad del ADR-013/014.                                                                           |
| PILA-AT2-13 | Snapshot antiguo/incompleto, de otro tenant, período no aprobado o versión de payload no soportada.                                                                                                     | Bloquear toda la descarga y no revelar datos de otro tenant. No hacer backfill ni completar datos desde empleado actual.                                                                                                            | Política de aislamiento y snapshots inmutables.                                                                      |
| PILA-AT2-14 | Empleado con subtipo especial, cotizante 75, afiliación incompleta/solapada, centro ARL sin vigencia o actividad fuera del catálogo/versionamiento.                                                     | Bloquear con causa/campo; no sustituir por `OTHER`, `00` ni valor de sede.                                                                                                                                                          | Límite explícito del MVP; AT2 v30 y ADR-013/014.                                                                     |
| PILA-AT2-15 | Archivo válido localmente; carga, rechazo, liquidación o pago en un operador.                                                                                                                           | La app solo afirma “generado” o “validado localmente”. “Aceptado”, “liquidado” y “pagado” requieren evidencia externa separada. La compatibilidad se registra por operador y versión solo tras carga de prueba aceptada.            | Decisión aprobada en ADR-013.                                                                                        |
| PILA-AT2-16 | Salario básico o IBC de campos 40, 42–45 o 95 mayor que 999.999.999.                                                                                                                                    | Bloquear el campo por exceder sus 9 posiciones numéricas; no truncar. El límite 999.999.999 es representable.                                                                                                                       | AT2 v30, pp. 91–93 y 101; cubierto en preflight unitario.                                                            |
| PILA-AT2-17 | Documento CC/CE/TI/PA con caracteres no permitidos o longitud superior a la del tipo.                                                                                                                   | Bloquear el campo 4; no normalizar ni truncar el identificador. Aceptar cada longitud máxima permitida.                                                                                                                             | AT2 v30, pp. 81–82; cubierto en preflight unitario.                                                                  |
| PILA-AT2-18 | Algún nombre de los campos 11–14 excede 20/30 posiciones.                                                                                                                                               | Bloquear el campo; no truncar nombres. Aceptar las longitudes máximas.                                                                                                                                                              | AT2 v30, p. 88; cubierto en preflight unitario.                                                                      |
| PILA-AT2-19 | Datos de aportante o representante superan la longitud AT2 de su campo.                                                                                                                                 | Bloquear el registro y conservar el valor de origen sin truncar. Aceptar las longitudes máximas.                                                                                                                                    | AT2 v30, pp. 9–15; cubierto en preflight unitario.                                                                   |
| PILA-AT2-20 | Fax no numérico, correo fuera del formato AT2 o identificación del representante incompatible con el documento declarado.                                                                               | Bloquear el campo correspondiente; no normalizar, sustituir ni truncar datos. Aceptar documentos CC/CE/PA/CD en sus límites oficiales; la identificación puede omitirse solo para persona natural si se omite completa.             | AT2 v30, pp. 13–14; cubierto en preflight unitario.                                                                  |
| PILA-AT2-21 | Identificación del aportante incompatible con el documento declarado o DV distinto de `0` para persona natural.                                                                                         | Bloquear campo 3/4; aplicar longitud y caracteres por tipo, exigir exactamente 15 dígitos a PE y no aplicar el DV jurídico a persona natural. El DV de persona jurídica sigue sujeto a validación DIAN/operador.                    | AT2 v30, pp. 10–11; cubierto en preflight unitario.                                                                  |
| PILA-AT2-22 | Presentación por sucursal sin nombre, con código de sucursal disponible, o presentación única con código.                                                                                               | Para `S`, exigir código y si falta nombre usar el código en campo 6; para `U`, campo 5 debe quedar en blanco. No inventar una sede ni sustituir el código por la sede laboral.                                                      | AT2 v30, p. 11; fallback cubierto en preflight unitario.                                                             |
| PILA-AT2-23 | El encabezado 01 contiene modalidad, período de otros sistemas, radicación, fecha real de pago o código de operador asignados por el sistema.                                                           | No sustituir campos 2/15/17/18/22 con valores inventados; verificar su convención de entrada en SOI antes de emitir un archivo candidato. Nunca usar la fecha prevista como fecha pagada.                                           | AT2 v30, pp. 26–30; carga pública de SOI confirmada, convención de entrada no verificada.                            |
| PILA-AT2-24 | El snapshot contiene un municipio DIVIPOLA válido derivado de la sede operativa del contrato.                                                                                                           | Bloquear los campos 9/10: ni la sede operativa ni el centro ARL prueban por sí solos la ubicación laboral PILA. No serializar ni marcar listo hasta que exista una fuente PILA explícita, confirmada y congelada.                   | El ADR-013 exige no inferir la ubicación PILA desde `Sede`; cubierto por el preflight local.                         |
| PILA-AT2-25 | Los IBC CCF individuales caben en N9 pero su suma para el campo 20 supera 999.999.999.999.                                                                                                              | Bloquear el campo 20 del encabezado sin truncar ni emitir una suma parcial; aceptar exactamente 999.999.999.999.                                                                                                                    | AT2 v30, registro 01 del tipo 2, campo 20 N12; prueba de borde del informe preliminar.                               |
| PILA-AT2-26 | Dependiente 01/00 de mes completo, aportante empleador tipo 1, clase A/B, beneficio Ley 1429 declarado falso y concepto único `CAJA` con factor 4 % y base igual al IBC CCF.                            | Exponer campo 64 como candidato `0.04000` bajo regla versionada; el campo 65 conserva el importe de Payroll solo si ya cumple el redondeo. Ningún candidato habilita el archivo ni afirma aceptación de operador.                   | Ley 21/1982, arts. 11–12; AT2 v30, pp. 95 y 161; el formato decimal queda pendiente de prueba de carga por operador. |
| PILA-AT2-27 | Clase C/D, beneficio Ley 1429 verdadero o desconocido, falta de aportante/IBC/concepto, base diferente o factor `CAJA` diferente de 4 %.                                                                | Dejar 64 y 65 sin resolver con causa por campo; no inferir tarifa cero, elegibilidad ni corregir el factor o el importe del snapshot.                                                                                               | AT2 v30, p. 161; límite explícito del MVP dependiente estándar y Ley 1429.                                           |
| PILA-AT2-28 | El candidato `0.04000` se serializa en las siete posiciones de campo 64.                                                                                                                                | Aceptar el ancho y formato local; mantener pendiente el formato actual y la compatibilidad hasta una carga aceptada por cada operador.                                                                                              | Serializer unitario; convención decimal de Resolución 1747/2008, art. 19, referencia histórica derogada.             |
| PILA-AT2-29 | Empleador privado, tipo 1, clase A/B, dependiente 01/00 de mes completo, sin beneficio Ley 1429 y con no exoneración confirmada; fuentes SENA/ICBF únicas con tarifa y base de campo 95 coincidentes.   | Mostrar 66=`0.02000` y 68=`0.03000`; los campos 67/69 conservan importes del snapshot solo si cumplen redondeo. Los candidatos no habilitan archivo.                                                                                | Ley 21/1982 art. 12; Ley 89/1988 art. 1; AT2 v30 p. 162.                                                             |
| PILA-AT2-30 | Exoneración verdadera, ausente o contradictoria entre política y perfil; incluye empleado con salario alto en un tenant marcado exonerado.                                                              | Mantener 66–69 sin resolver mientras falte validación de elegibilidad individual; no derivar cero ni incluir aporte.                                                                                                                | E.T. art. 114-1; el MVP no valida aún el umbral por empleado.                                                        |
| PILA-AT2-31 | Aportante C/D, naturaleza pública/mixta u otra no privada, beneficio Ley 1429 verdadero/desconocido, o tipo distinto de empleador 1.                                                                    | Bloquear 66–69 con motivo por campo; no extrapolar las tarifas estándar a reglas especiales.                                                                                                                                        | AT2 v30 p. 162; Ley 21/1982 y alcance limitado del MVP.                                                              |
| PILA-AT2-32 | Factor SENA/ICBF congelado distinto de 2 %/3 %, base no igual a campo 95, importe no redondeado o tarifas serializadas en ancho N7.                                                                     | Bloquear factor/base/importe incompatible; aceptar localmente `0.02000`/`0.03000` en siete posiciones, con compatibilidad actual pendiente de carga por operador.                                                                   | Resolución 1747/2008 art. 19 (convención histórica, derogada); pruebas unitarias de mapper y serializer.             |
| PILA-AT2-33 | Empleador privado tipo 1; dependiente 01/00 de mes completo; obligación pensional explícita; fecha prevista de pago y período anteriores a 2027-04-01; PENSION_EMP 4 % y PENSION_PAT 12 % sobre IBC 42. | Mostrar campo 46 como `0.16000`; campo 47 solo como suma de los dos importes congelados, tras validar sus redondeos individuales y que la suma coincide con IBC × 16 %. No habilitar el archivo ni afirmar aceptación del operador. | Decreto 1833/2016 art. 2.2.3.1.13; Ley 797/2003 art. 7; AT2 v30 pp. 147–148; pendiente carga por operador.           |
| PILA-AT2-34 | Factor, tipo, unicidad, IBC, obligación declarada o redondeo de cualquier concepto pensional falta o no coincide; empleado CE/PA exento o CC/TI en el exterior; aportante público.                      | Mantener 46–47 sin resolver por motivo; no inferir tarifa o aporte cero ni reconstruir valores faltantes.                                                                                                                           | AT2 v30 pp. 147–148 y ADR-013; cubierto por pruebas del mapper.                                                      |
| PILA-AT2-35 | El período o la fecha prevista de pago alcanza 2027-04-01, o falta la fecha prevista congelada.                                                                                                         | Mantener 46–47 sin resolver hasta seleccionar/versionar las reglas aplicables; el nuevo sistema no se deriva de la tarifa anterior.                                                                                                 | Sentencia C-264/2026; AT2 v30 pp. 147–154; catálogo local versionado y guard de corte.                               |
| PILA-AT2-36 | Campo 46 decimal con ancho N7.                                                                                                                                                                          | Formatear candidato local `0.16000`; conservar pendiente la compatibilidad vigente hasta prueba de carga por operador.                                                                                                              | AT2 v30 p. 95; formato decimal candidato de Resolución 1747/2008 art. 19, derogada.                                  |

Confirmación del comportamiento local: `buildPilaDaysBySubsystem` acepta el
subtipo explícito `00`, deja sin candidato el valor nulo y bloquea subtipos
fuera del alcance. `pila-source-snapshot.spec.ts` cubre los 30 días por
subsistema para `01`/`00` y los bloqueos de nulo y subtipo especial.

### Fixture numérico candidato para campo 95

El snapshot fuente actual produce una proyección versionada `CO_PARAFISCAL_BASE_V1`
para escenarios limitados; no es una aprobación normativa ni permite descargar
un archivo. La tabla conserva resultados verificables para revisar la frontera
antes de habilitar el campo:

| Entradas aprobadas en el fixture                                                                                  | Valor candidato 95 | Estado                                                                                    |
| ----------------------------------------------------------------------------------------------------------------- | -----------------: | ----------------------------------------------------------------------------------------- |
| Salario básico fijo $2.000.000; sin otros devengos/descansos.                                                     |         $2.000.000 | Caso simple candidato.                                                                    |
| Salario básico $2.000.000 y auxilio de transporte $100.000.                                                       |         $2.000.000 | Excluir transporte de la base; verificar con art. 17 Ley 21/1982 y Ley 344/1996.          |
| Salario integral $15.000.000; sin otros devengos/descansos.                                                       |        $10.500.000 | 70% según regla de salario integral; confirmar articulación normativa antes de habilitar. |
| Salario básico $2.000.000 más horas extra salariales trazables por $200.000.                                      |         $2.200.000 | Solo si el concepto aprobado y el total de novedades coinciden.                           |
| `BONUS` sin clasificación, vacaciones sin valor de descanso remunerado, período parcial u otro devengo sin clase. |   Bloqueo (`null`) | No completar ni estimar la base.                                                          |

La plataforma solo promoverá estos casos a pruebas ejecutables cuando el
resultado de nómina y su tratamiento de descansos remunerados, límites,
redondeo y conceptos estén documentados y aprobados para Payroll. El campo 95
no se deduce del monto aportado a SENA/ICBF, que podría no existir por una
exoneración.

## Hallazgos confirmados en el código y brechas

- Para snapshots v2, el preflight exige conceptos fuente únicos y con el tipo
  esperado para pensión empleado/patrono, salud empleado, ARL y CCF; contrasta
  sus bases con los IBC de subsistema congelados y valida los datos numéricos
  candidatos. Salud patronal y los conceptos SENA, ICBF y FSP, cuando están
  presentes, también se revisan sin asumir que su ausencia equivale a cero.
  Los candidatos de pensión, ARL y parafiscales exigen reglas y reconciliación independientes; no recalculan ni sustituyen importes de Payroll.
- El informe conserva un bloqueo global de exportación si el período o la fecha
  prevista de pago alcanza el 2027-04-01, hasta versionar las reglas pensionales
  del nuevo sistema para los campos 46–47. Esto también bloquea una planilla de
  marzo pagada desde abril. Antes del corte, los campos 46–47 solo se exponen
  como candidatos estándar cuando los componentes congelados y su redondeo
  coinciden; el guard no autoriza descargar archivos.
- `buildPilaSourceSnapshot` congela la fuente PILA y propone 30 días solo si
  empleado, contrato y única afiliación cubren el mes completo; cualquier
  evento PILA o novedad sin segmentación bloquea la proyección. Esto coincide
  con la regla AT2 para el alcance acotado, pero todavía no valida un archivo.
- La línea base del PR #171 mostraba un subtipo opcional en la captura, aunque
  `inspectPilaSnapshotPreparation` bloqueaba los valores faltantes. Esta rama
  requiere ahora un código de dos dígitos en API y formulario, muestra `00` si
  no aplica un subtipo especial, y mantiene los históricos nulos bloqueados sin
  backfill.
- La línea base del PR #171 aceptaba solo subtipo `null` al construir días del
  tipo 01; una afiliación válida y explícita `00` quedaba fuera del MVP. Esta
  rama ahora permite el candidato de 30 días solo para tipo 01 / subtipo 00 y
  bloquea tanto nulo como otros subtipos. Las regresiones cubren los tres casos.
- Payroll conserva un `ibc` común y los campos 42–45 necesitan bases
  independientes. El snapshot PILA toma bases de conceptos aprobados, pero las
  fórmulas, tarifas, redondeos y los supuestos de contribución deben cotejarse
  con Payroll y normativa antes de serializar.
- En las ramas apiladas #163–#170 existen capturas de afiliaciones, eventos y
  asignaciones ARL; esto no demuestra generación del archivo, aceptación de un
  operador ni cierre de la capacidad de extremo a extremo.

## Pruebas que faltan antes de una primera exportación

1. Casos de Payroll con resultados de entrada y salida aprobados para enero,
   febrero de 28 y 29 días, meses de 30/31 días, ING, RET, ING+RET y eventos
   concurrentes. No implementar prorrata desde calendario sin resolver sus
   expected values.
2. Matriz de devengos y descansos para campos 40–45 y 95: salario fijo,
   integral, variable, horas extra, bonificaciones salariales/no salariales,
   auxilio, vacaciones remuneradas, incapacidad/licencia, tope y redondeo.
3. Pruebas de contrato del ancho, orden, caracteres, padding, terminadores y
   campos atribuidos al operador para cada archivo. La documentación AT2 no
   acredita por sí sola que SOI u otro operador acepte la convención de carga.
4. Pruebas tenant/RBAC, snapshots inmutables, lote con un cotizante bloqueado,
   hash/historial de corrección e idempotencia.
5. Prueba de carga por operador antes de mostrar compatibilidad; registrar
   portal, fecha, AT2, versión de reglas/formato y evidencia del resultado.

## Límites de la investigación

La matriz confirma la estructura y reglas citadas en el AT2 v30 descargado y
contrasta el código local. No verifica una carga en SOI u otro operador, no
certifica el tratamiento individual de una empresa, no reemplaza el concepto
laboral/contable del cliente y no confirma que no haya una revisión normativa
posterior al corte indicado. Los documentos `PROJECT_STATE.md`, Goals y ADRs se
trataron como contexto; el estado de código se verificó en la rama local. En la
raíz del checkout no están `Decisiones de Producto.md`,
`ENGINEERING_PLAYBOOK.md` ni `LA_OFICINA_NITIDA_CONTEXT.md`.
