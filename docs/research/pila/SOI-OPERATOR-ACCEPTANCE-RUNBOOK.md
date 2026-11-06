# Prueba de aceptación PILA por operador — SOI

| Campo    | Valor                                                            |
| -------- | ---------------------------------------------------------------- |
| Estado   | PREPARADA; NO EJECUTADA                                          |
| Revisada | 2026-11-06                                                       |
| Alcance  | Prueba manual y autorizada de archivos tipo 1/2 para planilla E. |
| Regla    | No afirmar compatibilidad universal, liquidación ni pago.        |

## Propósito

Registrar una prueba reproducible de aceptación de la exportación local de
PILA en SOI. Esta prueba complementa el preflight y la validación local de
La Oficina Nítida. No modifica el archivo que la aplicación generó, no
transmite desde el SaaS y no autoriza crear ni pagar una planilla.

El estado del producto `LOCAL_VALIDATED` confirma únicamente el layout,
longitud y codificación comprobados localmente. Hasta superar una carga
documentada, SOI permanece `NOT_VERIFIED`; otros operadores requieren pruebas
propias.

## Evidencia pública consultada

- La página de [Servicios SOI](https://www.soi.com.co/persona-servicios-de-soi)
  indica que el aportante registrado y autenticado puede cargar un archivo
  plano, y que después de la carga el portal entrega un número de planilla y
  el valor total a pagar. El pago se realiza después por PSE u otro canal.
- La guía [Cómo hacer y pagar tu planilla con SOI](https://www.soi.com.co/persona-como-hacer-y-pagar-la-planilla)
  describe la selección del período y la validación de afiliaciones y aportes.
- La página del [Autocorrector SOI](https://www.soi.com.co/autocorrector)
  informa que puede detectar y corregir problemas de redondeo, topes,
  obligatoriedad de subsistemas y proporcionalidad. Una corrección hecha por
  el operador no modifica el snapshot ni el archivo inmutable de la aplicación
  y no se debe presentar como aceptación del archivo original sin cambios.
- La estructura normativa se coteja con el AT2 vigente y las fuentes
  versionadas en [ADR-013](../../adr/ADR-013-pila-standard-file-export.md) y
  la [matriz de aceptación](AT2-V30-MVP-ACCEPTANCE-MATRIX.md).

## Puertas previas

1. Seleccionar SOI explícitamente como operador de esta prueba. No extrapolar
   sus resultados a otros operadores.
2. Usar una cuenta de prueba emitida o autorizada por SOI. Si solo existe un
   portal operativo, el titular del empleador debe autorizar la carga y saber
   qué acción puede dejar una planilla pendiente con valor por pagar. Si no hay
   una ruta de validación que evite ese efecto, detenerse antes de cargar hasta
   acordar el uso de una cuenta de empleador.
3. No subir empleados sintéticos con identidades ficticias a una cuenta real:
   SOI puede validar sus afiliaciones y datos contra sus fuentes. Para probar
   estructura con datos sintéticos se necesita un entorno de prueba reconocido
   por el operador. En una cuenta real, usar solo datos de un empleador que
   autorizó expresamente la prueba.
4. Generar desde snapshots aprobados un archivo `LOCAL_VALIDATED`, con
   `archivoGenerable=true`, una única empresa/período y los casos cubiertos por
   el preflight. Guardar el identificador de exportación, hash SHA-256,
   versiones normativa y de formato y el conteo de registros. No reconstruir
   ni editar el archivo fuera del flujo de corrección de la aplicación.
5. Acordar quién puede avanzar en el portal y en qué punto detenerse. No
   confirmar ni guardar una planilla para pago, ni iniciar el pago, sin
   autorización expresa del titular. Una carga ambigua por desconexión se
   reconcilia en el portal antes de reintentar.

## Procedimiento

1. Registrar operador, portal, fecha/hora y zona horaria, período, tipo de
   planilla, versión AT2/formato, identificador de exportación y hash del
   archivo. No incluir cédulas, NIT, cookies, credenciales ni reportes con PII
   en GitHub o en evidencia pública.
2. Iniciar sesión con la cuenta autorizada y elegir la ruta de carga de archivo
   plano para empleados (`planilla E`) y el mismo período que contiene el
   snapshot. No iniciar por la opción en línea ni convertir el archivo a otro
   formato.
3. Cargar el archivo original sin autocorrección automática. Registrar si el
   operador rechaza el archivo, produce un informe, permite revisar el resumen
   de cotizantes y aportes, o muestra otro resultado.
4. Si el operador reporta errores, conservar el resultado original en un
   repositorio privado y con acceso restringido. Clasificar cada observación
   como estructura/encoding, catálogo o afiliación, regla de negocio, valor
   numérico, dato del empleador u operador. No modificar el archivo descargado
   manualmente ni aceptar la autocorrección como nueva fuente de Payroll.
5. Si no hay errores bloqueantes, comparar el número de cotizantes y los
   valores por subsistema del resumen con el archivo y los snapshots. Registrar
   discrepancias antes de afirmar aceptación. Si continuar requiere guardar una
   planilla pendiente, detenerse en ese punto salvo autorización previa.
6. No pagar. La aceptación de una carga, la creación de un número de planilla,
   la liquidación calculada por SOI y el pago son hechos distintos. Solo el
   soporte de pago permite afirmar el pago.
7. Para corregir un rechazo, corregir la fuente de negocio mediante el flujo
   autorizado, aprobar un snapshot nuevo y generar otra exportación. Mantener
   ambos artefactos e historiales con sus hashes para que la corrección sea
   auditable.

## Resultado que permite declarar

Los valores de la columna `Registro` son etiquetas de esta prueba manual; no
son estados implementados por la aplicación.

| Resultado observado                                                                | Registro                                  | Lo que demuestra                                                                                                    |
| ---------------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Ninguna carga ejecutada                                                            | `NOT_TESTED`                              | No existe evidencia del operador.                                                                                   |
| SOI rechaza o devuelve errores                                                     | `REJECTED` + informe privado              | La versión y caso probados no superaron las validaciones indicadas.                                                 |
| SOI valida el archivo original sin cambios y permite continuar sin inconsistencias | `ACCEPTED_FOR_REVIEW`                     | Aceptación limitada a SOI, versión, período y escenario registrados. No demuestra pago ni compatibilidad universal. |
| SOI crea número de planilla y total a pagar                                        | Registrar `PLANILLA_CREATED` por separado | El operador creó la planilla. No demuestra que se pagó.                                                             |
| El titular confirma el pago con soporte                                            | Registrar `PAID` fuera de esta prueba     | Solo el soporte de pago permite afirmar el pago.                                                                    |

No promover `SOI` a compatible por un éxito de descarga local, un test de
serializador, una aceptación corregida por Autocorrector o una captura sin el
hash del archivo original. La compatibilidad queda limitada al formato,
escenario y versión probados; repetir la prueba cuando cambien reglas, formato o
las validaciones del operador.

## Evidencia de cierre de la prueba

El registro privado debe incluir el hash del archivo original y del informe,
si existe; el operador y portal; fecha; tipo de planilla y período; versiones;
conteo de cotizantes; resultado exacto del portal; diferencias por subsistema;
si se usó alguna corrección; y el nombre/rol de quien autorizó la operación.
La matriz pública del repositorio conserva solo datos no personales y el
resultado resumido.

## Estado actual

**SOI: `NOT_TESTED`.** La revisión pública confirma que el portal ofrece carga
de archivos planos, pero no prueba que acepte el archivo de esta aplicación.
No se ha iniciado sesión, cargado archivo, creado una planilla ni efectuado un
pago. Para ejecutar la prueba se necesita una cuenta de prueba aprobada por SOI
o autorización explícita del titular de una cuenta de empleador y sus datos.
