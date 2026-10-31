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

| Campos | Fuente congelada / regla explícita                                          | Estado o bloqueo actual                                                                                                                                                                                                            |
| ------ | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1      | `employer.razonSocial`.                                                     | Obligatorio; máximo 200 posiciones.                                                                                                                                                                                                |
| 2–3    | `employer.pila.tipoDocumentoAportante` y `employer.nit`.                    | Tipo y número se validan con caracteres y longitud propios de NI/CC/CE/TI/PA/CD/SC/PE/PT/PC; PE exige 15 dígitos.                                                                                                                  |
| 4      | `employer.digitoVerif`.                                                     | Para persona jurídica se exige un dígito y la validación DIAN queda al operador; para persona natural AT2 exige `0`.                                                                                                               |
| 5–6    | `employer.pila.formaPresentacion`, `codigoSucursal`, `nombreSucursal`.      | Para `U`, campo 5 va en blanco; para `S`, se exige código y el nombre puede ser el código si el aportante no suministra uno.                                                                                                       |
| 7–10   | `claseAportante`, `naturalezaJuridica`, `tipoPersona`, `formaPresentacion`. | Requieren declaraciones explícitas. El MVP solo acepta clase A/B validable; C/D permanecen bloqueadas por elegibilidad.                                                                                                            |
| 11–17  | Dirección, municipio, CIIU, teléfono, fax y correo del aportante.           | Municipio de cinco dígitos se divide en departamento (13) y municipio (12); teléfono es obligatorio; fax/correo son opcionales pero se validan si existen.                                                                         |
| 18–24  | Identificación, tipo y nombres del representante legal.                     | Para persona jurídica se exigen campos 18, 20, 21 y 23; CC/CE/PA/CD aplican límites específicos. El campo 19 es el cero definido por AT2. Persona natural puede omitir el bloque.                                                  |
| 25–27  | Fecha de inicio, acción y fecha fin de situación especial del aportante.    | El MVP exige confirmación explícita de “sin acción especial”; solo puede mapearse el código 0 y se dejan 25/27 vacíos. Acciones especiales bloquean.                                                                               |
| 28–29  | Código del operador y período de pago, asignados por el sistema según AT2.  | El código del operador no está en el snapshot; hay período y fecha prevista de pago, pero no un mapeo aprobado al campo 29. No inferir: falta confirmar qué suministra SOI y qué completa el portal; bloquea serialización tipo 1. |
| 30     | `employer.pila.tipoAportante`.                                              | Solo se admite la declaración explícita `1` (empleador).                                                                                                                                                                           |
| 31–32  | Fecha de matrícula y departamento del domicilio principal para Ley 1429.    | Solo aplican al beneficio; elegibilidad de clase D no está validada, por lo que el MVP la bloquea.                                                                                                                                 |
| 33–34  | Exoneración y beneficio CCF de Ley 1429.                                    | Exigen respuesta explícita del aportante; si son afirmativas, falta validar evidencia de elegibilidad y la exportación se bloquea.                                                                                                 |

### Mapa de fuentes para el encabezado tipo 2 (registro 01)

AT2 v30, pp. 26–30, define 22 campos y 359 posiciones. En el alcance actual,
la planilla es tipo `E`; el mapa separa los valores aportados por la aplicación
de los que AT2 asigna al operador.

| Campos | Fuente congelada / regla explícita                                           | Estado o bloqueo actual                                                                                                                       |
| ------ | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1      | Constante de formato `01`.                                                   | La aplicación genera el identificador del registro.                                                                                           |
| 2      | Modalidad de planilla (`1` electrónica o `2` asistida).                      | AT2 dice que la genera automáticamente el operador; falta confirmar cómo debe venir en el archivo de entrada de SOI.                          |
| 3      | Secuencia del aportante, ascendente desde `0001`.                            | Para un único encabezado de planilla puede iniciarse en `0001`; generación de varias planillas en un mismo archivo no está implementada.      |
| 4–7    | Campos 1–4 del archivo tipo 1.                                               | Reusar el snapshot aprobado; validar identidad y DV según el mapa tipo 1.                                                                     |
| 8–10   | Tipo de planilla `E`; número y fecha de planilla asociada.                   | Para `E`, los campos 9 y 10 se dejan en blanco por AT2.                                                                                       |
| 11–13  | Forma de presentación y sucursal, desde campos 10, 5 y 6 del archivo tipo 1. | Reusar reglas de `U`/`S`; no deducir sede laboral.                                                                                            |
| 14     | Código ARL del aportante, `employer.pila.codigoArlAportante`.                | Hay dato explícito en el snapshot; no sustituirlo por el centro ARL del empleado.                                                             |
| 15     | Período de pago para sistemas distintos a salud.                             | AT2 indica que lo calcula el operador; no hay regla local aprobada para asignarlo.                                                            |
| 16     | Período de pago del sistema de salud, formato `AAAA-MM`.                     | El período mensual completo del snapshot es fuente candidata; la selección final debe contrastarse por operador y vigencia normativa.         |
| 17     | Número de radicación/planilla.                                               | Asignado por el sistema del operador; no se inventa en el archivo de entrada.                                                                 |
| 18     | Fecha de pago efectiva.                                                      | Asignada por el operador desde el pago real. `fechaPrevistaPagoPila` no es pago realizado y nunca se copia aquí.                              |
| 19     | Conteo de cotizantes únicos del detalle.                                     | Calculable desde snapshots incluidos, una vez por persona y excluyendo tipo 40; el MVP solo incluye tipo 01.                                  |
| 20     | Suma del campo 45 (IBC CCF) de los detalles aplicables, no salario bruto.    | Candidato: sumar `ibcPorSubsistema.cajaCompensacion.valor` aprobado; revisar obligación CCF y el límite de 12 posiciones antes de serializar. |
| 21     | Tipo de aportante del campo 30 del archivo tipo 1.                           | Snapshot declara tipo `1` para empleador.                                                                                                     |
| 22     | Código del operador de información.                                          | Asignado por el operador; no existe un código en el snapshot ni una convención de entrada confirmada.                                         |

MinSalud marca los campos 2, 15, 17, 18 y 22 como generados o asignados por el
operador/sistema. Las páginas públicas de SOI confirman carga de archivos
planos y que el portal devuelve número de planilla y total a pagar; su
Autocorrector revisa redondeos, topes, obligación de subsistemas y
proporcionalidad. Esta evidencia confirma el portal candidato, no la
convención de campos ni compatibilidad: la prueba de carga del archivo sigue
pendiente ([servicios de SOI](https://www.soi.com.co/persona-servicios-de-soi),
[Autocorrector SOI](https://www.soi.com.co/autocorrector)).

Para el detalle 02, el alcance de datos de mayor riesgo es:

| Campos        | Dato                                         | Evidencia y condición para aceptar                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3–4           | Documento y número de cotizante              | Para este MVP: CC numérico hasta 10 dígitos, CE hasta 7, TI hasta 11 y PA alfanumérico A–Z/0–9 hasta 16. No corregir ni truncar IDs. Otros tipos quedan fuera del MVP.                                                                                                                                                                                                                                                       |
| 5–6           | Tipo y subtipo de cotizante                  | Solo `01` / `00` en el alcance inicial. AT2 marca el subtipo obligatorio y define `0` cuando no aplica subtipo; en el campo numérico de dos posiciones se representa como `00`. Nulo o un subtipo especial bloquea.                                                                                                                                                                                                          |
| 11–14         | Nombres del cotizante                        | Campos 11/13 obligatorios; primer apellido/nombre hasta 20 posiciones y segundo apellido/nombre hasta 30. Bloquear exceso; no truncar.                                                                                                                                                                                                                                                                                       |
| 15–30 y 80–94 | Novedades y fechas                           | Solo códigos, intervalos y días explícitos. No convertir `PayrollNovelty` genérica en código PILA. Hasta tener segmentación aprobada, una novedad que afecte el detalle bloquea.                                                                                                                                                                                                                                             |
| 36–39         | Días por pensión, salud, riesgos y CCF       | Cuatro valores separados, cada uno de 0–30 y sujeto a obligación y novedad propias. AT2 expresa el total de 30 independientemente de si el mes tiene 28/30/31 días para 36–38; el campo 39 también exige un valor propio y una novedad correspondiente si es menor que 30. Para el caso estándar de mes completo y una sola línea, el expected value es 30 en cada campo. No copiar un contador general a los cuatro campos. |
| 40–41         | Salario básico y tipo de salario             | Campo 40: entero sin centavos, no negativo y con máximo 9 dígitos (hasta $999.999.999); puede ser inferior a un SMLMV. Campo 41: explícito para tipo 01 (`X`, `F` o `V`). No inferir “fijo” porque el valor no haya cambiado.                                                                                                                                                                                                |
| 42–45         | IBC de pensión, salud, riesgos y CCF         | Bases independientes, suministradas por el aportante. Cada campo admite hasta 9 dígitos; el preflight bloquea desbordamientos y no trunca. El exportador solo puede copiar importes aprobados por Payroll; no copiar `PayrollRun.ibc` a todos los subsistemas.                                                                                                                                                               |
| 46–75         | Tarifas, aportes y administradoras           | Exigen validar tarifa vigente, base, redondeo, subsistema y campos calculados por el operador. No afirmar aceptación ni recalcular desde el exportador.                                                                                                                                                                                                                                                                      |
| 62, 77–78, 98 | Centro ARL, ARL, clase y actividad económica | Usar asignación con vigencia del empleado, código asignado por ARL y catálogo de Decreto 768/2022 versionado. Una sede no reemplaza el centro ARL.                                                                                                                                                                                                                                                                           |
| 95            | IBC de otros parafiscales                    | Obligatorio para tipo 01 y limitado a 9 dígitos. Requiere origen salarial auditable, base propia en el snapshot y reglas aprobadas. El valor candidato actual no constituye por sí mismo aprobación normativa.                                                                                                                                                                                                               |

Para el tipo 1, los campos 16, 17 y 18 no se validan solo por longitud: el fax
es numérico, el correo debe respetar los caracteres y estructura de dominio de
AT2, y el documento del representante usa las reglas del tipo declarado (CC,
CE, PA o CD). AT2 v30, pp. 13–14.

La Resolución 1529/2026 y cualquier actualización posterior se deben evaluar
por período cotizado y fecha prevista/confirmada de pago PILA, conforme al
versionamiento explícito del ADR-013. La fecha del salario o la fecha en que se
genera el archivo no determina el hito.

## Criterios de aceptación y pruebas de contrato

Las pruebas `PILA-AT2-01` a `PILA-AT2-23` son criterios objetivo para la futura
validación local. **“Bloquear” significa no producir una descarga parcial.**
La fuente normativa da el requisito del formato; donde se marca “Payroll debe
aprobar”, AT2 no define por sí solo el cálculo laboral que alimenta el campo.

| ID          | Fixture o condición                                                                                                                                   | Resultado esperado                                                                                                                                                                                                       | Evidencia / estado                                                                                     |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| PILA-AT2-01 | Tipo 01/subtipo 00, planilla E, mes completo de 31 días, contrato, afiliación y centro ARL vigentes; snapshot aprobado y campos requeridos presentes. | Preflight sin errores de alcance; días 36–39 = 30 por subsistema. La futura serialización conserva cada base y aporte tal como aparece en el snapshot aprobado.                                                          | AT2 v30, pp. 85, 91–95, 102 y 146–147. Confirmado como escenario objetivo, no como prueba de operador. |
| PILA-AT2-02 | Mismo trabajador y reglas en febrero de 28 días.                                                                                                      | Días 36–39 = 30, no 28.                                                                                                                                                                                                  | AT2 v30, §2.1.2.3.11–13, pp. 146–147.                                                                  |
| PILA-AT2-03 | Febrero bisiesto de 29 días.                                                                                                                          | Días 36–39 = 30, no 29.                                                                                                                                                                                                  | AT2 v30, mismas secciones.                                                                             |
| PILA-AT2-04 | Afiliación con subtipo nulo o faltante.                                                                                                               | Bloqueo explícito en campo 6; no convertir el histórico a `00`.                                                                                                                                                          | AT2 v30, p. 85; formulario/DTO lo exigen en altas; snapshots null se bloquean sin backfill.            |
| PILA-AT2-05 | Afiliación explícita `01` / `00` con cobertura del mes.                                                                                               | Aceptar el código como el caso estándar y permitir construir los días completos; nunca tratar `00` como subtipo especial.                                                                                                | AT2 v30, p. 85; confirmado en código y prueba unitaria existente.                                      |
| PILA-AT2-06 | Ingreso o retiro durante el mes, con campos 80/81 y días inferiores a 30.                                                                             | AT2 permite menos de 30 días para los sistemas aplicables si existe ING/RET; hasta que Payroll apruebe días e IBC por subsistema, el preflight bloquea.                                                                  | AT2 v30, pp. 91–92, 146–147; cálculo esperado pendiente de fixtures laborales revisados.               |
| PILA-AT2-07 | ING y RET en el mismo período.                                                                                                                        | AT2 pide ambas novedades en el mismo registro 02; no se exporta mientras días/bases aprobados no estén disponibles.                                                                                                      | AT2 v30, pp. 102–103.                                                                                  |
| PILA-AT2-08 | Más de una ING/RET o una variación de IBC.                                                                                                            | Crear un registro 02 por novedad/variación conforme a la regla aplicable; conteo de encabezado cuenta al trabajador una sola vez. Hasta admitir segmentos, bloquear el lote.                                             | AT2 v30, pp. 102–104.                                                                                  |
| PILA-AT2-09 | IGE/LMA/SLN/IRL/VAC-LR concurrente con VSP/VST o retiro.                                                                                              | Separar los detalles que exige AT2 y conservar IBC aprobado de cada tramo; bloquear si solo existe un agregado mensual.                                                                                                  | AT2 v30, pp. 103–104.                                                                                  |
| PILA-AT2-10 | `PayrollNovelty` `SICKNESS`, `LICENSE`, `VACATION` o `BONUS` sin clasificación PILA y base salarial aprobadas.                                        | Bloquear campos afectados; no inferir código de evento ni base.                                                                                                                                                          | Restricción de dominio; Payroll debe aprobar casos y expected values antes de ampliar cobertura.       |
| PILA-AT2-11 | IBC faltante o único frente a campos 42–45; campo 95 ausente.                                                                                         | Bloquear por campo y empleado. Valores por subsistema distintos se conservan como distintos; el campo 95 tiene fuente propia.                                                                                            | AT2 v30, pp. 92 y 101; validación de detalle pendiente.                                                |
| PILA-AT2-12 | Cambiar salario, contrato, sede, afiliación, ARL o actividad después de aprobar Payroll.                                                              | La preparación/exportación usa únicamente los datos congelados en el snapshot aprobado; no consulta maestros actuales para completarlo.                                                                                  | Criterio de inmutabilidad del ADR-013/014.                                                             |
| PILA-AT2-13 | Snapshot antiguo/incompleto, de otro tenant, período no aprobado o versión de payload no soportada.                                                   | Bloquear toda la descarga y no revelar datos de otro tenant. No hacer backfill ni completar datos desde empleado actual.                                                                                                 | Política de aislamiento y snapshots inmutables.                                                        |
| PILA-AT2-14 | Empleado con subtipo especial, cotizante 75, afiliación incompleta/solapada, centro ARL sin vigencia o actividad fuera del catálogo/versionamiento.   | Bloquear con causa/campo; no sustituir por `OTHER`, `00` ni valor de sede.                                                                                                                                               | Límite explícito del MVP; AT2 v30 y ADR-013/014.                                                       |
| PILA-AT2-15 | Archivo válido localmente; carga, rechazo, liquidación o pago en un operador.                                                                         | La app solo afirma “generado” o “validado localmente”. “Aceptado”, “liquidado” y “pagado” requieren evidencia externa separada. La compatibilidad se registra por operador y versión solo tras carga de prueba aceptada. | Decisión aprobada en ADR-013.                                                                          |
| PILA-AT2-16 | Salario básico o IBC de campos 40, 42–45 o 95 mayor que 999.999.999.                                                                                  | Bloquear el campo por exceder sus 9 posiciones numéricas; no truncar. El límite 999.999.999 es representable.                                                                                                            | AT2 v30, pp. 91–93 y 101; cubierto en preflight unitario.                                              |
| PILA-AT2-17 | Documento CC/CE/TI/PA con caracteres no permitidos o longitud superior a la del tipo.                                                                 | Bloquear el campo 4; no normalizar ni truncar el identificador. Aceptar cada longitud máxima permitida.                                                                                                                  | AT2 v30, pp. 81–82; cubierto en preflight unitario.                                                    |
| PILA-AT2-18 | Algún nombre de los campos 11–14 excede 20/30 posiciones.                                                                                             | Bloquear el campo; no truncar nombres. Aceptar las longitudes máximas.                                                                                                                                                   | AT2 v30, p. 88; cubierto en preflight unitario.                                                        |
| PILA-AT2-19 | Datos de aportante o representante superan la longitud AT2 de su campo.                                                                               | Bloquear el registro y conservar el valor de origen sin truncar. Aceptar las longitudes máximas.                                                                                                                         | AT2 v30, pp. 9–15; cubierto en preflight unitario.                                                     |
| PILA-AT2-20 | Fax no numérico, correo fuera del formato AT2 o identificación del representante incompatible con el documento declarado.                             | Bloquear el campo correspondiente; no normalizar, sustituir ni truncar datos. Aceptar documentos CC/CE/PA/CD en sus límites oficiales; la identificación puede omitirse solo para persona natural si se omite completa.  | AT2 v30, pp. 13–14; cubierto en preflight unitario.                                                    |
| PILA-AT2-21 | Identificación del aportante incompatible con el documento declarado o DV distinto de `0` para persona natural.                                       | Bloquear campo 3/4; aplicar longitud y caracteres por tipo, exigir exactamente 15 dígitos a PE y no aplicar el DV jurídico a persona natural. El DV de persona jurídica sigue sujeto a validación DIAN/operador.         | AT2 v30, pp. 10–11; cubierto en preflight unitario.                                                    |
| PILA-AT2-22 | Presentación por sucursal sin nombre, con código de sucursal disponible, o presentación única con código.                                             | Para `S`, exigir código y si falta nombre usar el código en campo 6; para `U`, campo 5 debe quedar en blanco. No inventar una sede ni sustituir el código por la sede laboral.                                           | AT2 v30, p. 11; fallback cubierto en preflight unitario.                                               |
| PILA-AT2-23 | El encabezado 01 contiene modalidad, período de otros sistemas, radicación, fecha real de pago o código de operador asignados por el sistema.         | No sustituir campos 2/15/17/18/22 con valores inventados; verificar su convención de entrada en SOI antes de emitir un archivo candidato. Nunca usar la fecha prevista como fecha pagada.                                | AT2 v30, pp. 26–30; carga pública de SOI confirmada, convención de entrada no verificada.              |

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
