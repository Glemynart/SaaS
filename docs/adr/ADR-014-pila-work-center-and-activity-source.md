# ADR-014 — Fuente histórica de centro de trabajo y actividad económica PILA

| Campo           | Valor                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------ |
| **Estado**      | accepted — opción B seleccionada para el MVP de captura y snapshot                                     |
| **Fecha**       | 2026-10-31                                                                                             |
| **Decisores**   | Producto · Nómina · Arquitectura                                                                       |
| **Ámbito**      | Insumos PILA AT2 v30 para trabajadores dependientes estándar, campos 62 y 98                           |
| **Relacionado** | GOAL-02 M0 · ADR-013 · `PayrollSnapshot.pilaPayload` · `Empleado.sedeId` · `AfiliacionSeguridadSocial` |

## Problema

El campo 62 del registro 02 necesita el código del centro de trabajo asignado
por la ARL. El campo 98 necesita la actividad económica del Sistema General de
Riesgos Laborales que suministra el aportante y debe corresponder a la tabla
del Decreto 768 de 2022. Ambos datos deben representar al trabajador y al
período reportado.

El código actual contiene una `Sede` con municipio y empleados asociados, un
`Contrato` con sede y una clase de riesgo opcional, y una afiliación de
seguridad social con ARL y clase de riesgo con vigencia. Ninguno conserva el
código de centro de trabajo definido por la ARL ni la actividad económica de
riesgos asignada al trabajador. El snapshot PILA conserva la sede y el
contrato, pero no estos dos valores ni su vigencia. La relación geográfica con
una `Sede` no prueba que esta sea el centro codificado por la ARL.

La matriz normativa del ADR-013 identifica ambos campos como bloqueos del
serializador. El informe preliminar de preparación de datos también los
mantiene bloqueados. No hay autorización para inferirlos del nombre de la
sede, el cargo, el CIIU general del aportante, la clase de riesgo contractual
ni una afiliación vigente.

## Hechos verificados

- AT2 v30, registro tipo 2, campo 62: usa el código de centro de trabajo que
  suministra el aportante con base en los códigos definidos por la ARL.
- AT2 v30, registro tipo 2, campo 98: requiere un código de actividad
  económica de riesgos laborales conforme a la tabla del Decreto 768 de 2022
  para los dependientes cubiertos por el MVP.
- `AfiliacionSeguridadSocial` registra `arlCodigo`, `arlClaseRiesgo` y una
  vigencia, pero no el centro ni el código de actividad.
- `Sede` y `Contrato.sedeId` describen una ubicación organizacional; no
  almacenan identificadores de centro asignados por una ARL.
- Los snapshots históricos PILA no se rellenan desde datos maestros actuales.

La matriz del ADR-013 coteja el AT2 v30 oficial publicado por [MinSalud en su
página de PILA](https://www.minsalud.gov.co/Proteccion-Social/Paginas/pila.aspx).
La tabla de actividad económica proviene del [Decreto 768 de 2022, publicado
en SUIN-Juriscol](https://www.suin-juriscol.gov.co/archivo/DECRETO_768_DE_2022.pdf).
Los códigos y las reglas de vigencia se deben volver a comprobar contra la
versión normativa aplicable antes de habilitar la exportación.

## Decisión

Se adopta la opción B por delegación general de decisiones de producto e
ingeniería descrita en el GOAL MASTER y confirmada por el usuario el
2026-10-31. Esta decisión autoriza el modelo de captura y su snapshot; no
autoriza generar, transmitir, liquidar ni pagar una planilla.

Separar el centro de trabajo declarado a la ARL de la sede física y conservar
una asignación efectiva por empleado:

1. Crear `PilaCentroTrabajo`, tenant-scoped, con ARL, código y nombre del
   centro suministrados por el aportante y una asociación opcional a `Sede`.
   La asociación con sede ayuda a administrarlo; no deriva ni reemplaza el
   código de ARL.
2. Crear una asignación tenant-scoped de empleado a centro de trabajo con
   vigencia y código de actividad económica de riesgos según Decreto 768 de 2022. La clasificación se selecciona de un catálogo identificado por su
   versión normativa; no se obtiene del cargo ni del CIIU del aportante.
3. Capturar los valores desde evidencia/datos confirmados por el aportante.
   No convertir automáticamente `Empleado.sede`, `Contrato.claseRiesgoArl`,
   `Tenant.pilaCodigoActividadEconomica` ni la clase de afiliación a estos
   códigos.
4. En la aprobación de nómina, congelar en `pilaPayload` la asignación
   efectiva, los códigos fuente, sus vigencias, el identificador de versión
   normativa y el vínculo de tenant. Incrementar la versión del payload sin
   reescribir snapshots existentes.
5. Para el MVP, aceptar únicamente una asignación que cubra todo el período y
   cuya ARL coincida con la afiliación efectiva. Si falta, se solapa, cambia
   durante el período o no coincide, bloquear la revisión/exportación. Los
   cambios de centro dentro del período esperan a la segmentación de detalles
   tipo 2 prevista en ADR-013.
6. Conservar las asignaciones anteriores. Una corrección cierra la vigencia
   anterior y añade un registro auditado; no altera snapshots aprobados.

El modelo no asume una relación uno a uno entre `Sede` y centro de trabajo:
una sede puede tener varios centros, y cada centro puede ser compartido por
varios trabajadores. El primer alcance permite asignar la actividad por
empleado para que una ubicación no obligue a todos los trabajadores a tener
una clasificación de riesgos idéntica.

## Alternativas

### A. Añadir código PILA y actividad directamente a `Sede`

Es el cambio inicial más pequeño, pero supone que cada sede equivale a un
centro ARL y a una sola actividad de riesgos. No representa varias actividades
ni permite confirmar la asignación distinta de un empleado. Se descarta para
el historial de nómina.

### B. Centro ARL reutilizable y asignación con vigencia por empleado — recomendada

Mantiene el código de ARL en una entidad compartida, la actividad en la
asignación laboral del empleado y ambas fuentes congeladas en cada snapshot.
Soporta varias ubicaciones/actividades y permite bloquear cambios no
segmentables. Requiere dos relaciones tenant-safe y una migración aditiva.

### C. Añadir valores directamente a `Empleado` o `AfiliacionSeguridadSocial`

No conserva cambios de centro/actividad independientes de la afiliación y
mezcla ubicación laboral con administradoras. También puede alterar la
interpretación de períodos históricos. Se descarta.

## Criterios de aceptación y validación restante

- Antes de habilitar una exportación para clientes, una persona de Nómina
  revisa ejemplos reales anonimizados de constancias de centros ARL y confirma
  cómo identifica la empresa el centro asignado y la actividad del empleado.
- La lista de códigos se versiona y se valida contra el anexo oficial del
  Decreto 768; valores desconocidos o con otra versión bloquean. La captura
  actual contiene los 1.018 códigos extraídos del anexo publicado por Función
  Pública, sin descripciones, y conserva la huella SHA-256 del PDF fuente.
- Alta, cierre de vigencia y corrección conservan auditoría y rechazan
  solapamientos para el mismo empleado; referencias de otros tenants se
  ocultan o rechazan.
- La asignación debe coincidir con la ARL efectiva del empleado. La relación
  con `Sede` no cambia el código ni la vigencia por sí sola.
- Al aprobar un período estándar, el `pilaPayload` v2 congela centro,
  actividad, tenant, sede opcional, vigencias y versión normativa. Los
  snapshots históricos v1 siguen leyéndose sin backfill; al faltar la
  asignación, el preflight conserva los bloqueos 62 y 98. Cambiar datos
  maestros después no modifica un snapshot aprobado.
- Hueco, solapamiento, cambio de centro dentro del período, código no
  reconocido, actividad no vigente o discrepancia de ARL/riesgo producen un
  bloqueo identificable; no generan un archivo parcial.
- Datos históricos sin asignación permanecen pendientes; la migración no
  completa ni convierte campos heredados.
- La pantalla de empleado captura el centro ARL reutilizable, la asociación
  opcional con sede y la actividad por empleado. Alta, cierre y reemplazo de
  vigencia quedan auditados; la API rechaza cruces de tenant, solapamientos,
  códigos fuera del catálogo y discrepancias de ARL/clase.
- El preflight del snapshot valida que una sola asignación cubra todo el
  período, que el código de centro no esté vacío, que la ARL coincida con la
  afiliación y que el código de actividad pertenezca al catálogo y su primer
  dígito coincida con la clase de riesgo. Esto solo resuelve insumos 62 y 98;
  no confirma el formato completo ni compatibilidad de un operador.
- Pruebas de migración y rollback se ejecutan en una base PostgreSQL
  desechable. Las pruebas cubren varios empleados en un centro, varios centros
  en una sede, dos actividades en una sede, cambio antes/durante/después del
  período, tenant cruzado, snapshot histórico y cambio posterior a aprobación.

## Migración y rollback propuestos

La migración añade tablas tenant-scoped, restricciones, índices y claves
compuestas necesarias para impedir referencias cruzadas. No rellena filas ni
actualiza snapshots existentes. El payload pasa a una versión explícita nueva;
el lector conserva el bloqueo para versiones históricas incompletas.

El rollback operativo primero deshabilita la captura y el uso del modelo nuevo.
No elimina centros, asignaciones ni snapshots que ya tengan datos; una
migración inversa destructiva requiere una exportación verificable y aprobación
independiente. El esquema aditivo permite que una versión anterior de la
aplicación ignore los datos nuevos mientras no intente producir archivos.

## Fuera de alcance

- Exportar, transmitir, aceptar, liquidar o pagar una planilla.
- Declarar compatibilidad de un operador.
- Corregir o rellenar períodos históricos.
- Cotizantes especiales, temporales, independientes o tipo 75.
- Segmentar múltiples detalles 02 en un mismo período.

## Implementación inicial y límites

La migración añade las tablas `pila_centros_trabajo` y
`pila_asignaciones_centro_trabajo`, además de la clave compuesta tenant-safe de
`Sede`. No realiza backfill. El catálogo versionado actual contiene 1.018
códigos y registra como fuente el anexo oficial de Función Pública con SHA-256
`b1280c5a07be085cf7bba6eef5c988ae1b83151460184d20d7e22830bfd47883`.

La migración se aplicó junto con las 73 anteriores en PostgreSQL 16 desechable.
La comparación de esquema no reportó diferencias en las tablas PILA nuevas;
sí dejó diferencias heredadas en contratos, documentos y prima de servicios.
Esta prueba no ejercitó el rollback operativo de versión de aplicación ni una
migración inversa; el plan conserva las tablas y deshabilita la captura, y una
eliminación destructiva requiere un plan y aprobación independientes.

Quedan pendientes la revisión funcional por Nómina con evidencia real
anonimizada, la revisión del formato completo del campo 62 en el AT2 aplicable
y pruebas de carga con operadores. Hasta entonces no se afirma que el
exportador o los códigos de centro hayan sido aceptados por ningún operador.
