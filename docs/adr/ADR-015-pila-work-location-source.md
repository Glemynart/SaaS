# ADR-015 — Fuente histórica de ubicación laboral para PILA

| Campo         | Valor                                                                                     |
| ------------- | ----------------------------------------------------------------------------------------- |
| **Estado**    | accepted — opción A aprobada para el MVP de captura y snapshot PILA histórico             |
| **Fecha**     | 2026-10-31                                                                                |
| **Decisores** | Producto · Nómina · Arquitectura                                                          |
| **Ámbito**    | AT2 v30, registro tipo 2, campos 9–10; fuente municipal laboral con vigencia por empleado |
| **Goal**      | GOAL-02 — Evolución Financiera y Cumplimiento Electrónico                                 |
| **Relaciona** | ADR-013 · ADR-014 · `PayrollSnapshot.pilaPayload` · `Empleado` · `Sede`                   |

## Hechos verificados

- El AT2 v30 del [Ministerio de Salud y Protección Social](https://www.minsalud.gov.co/sites/rid/Lists/BibliotecaDigital/RIDE/DE/OT/anexo-tecnico2-cotizantes.pdf)
  requiere departamento y municipio donde el cotizante ejecuta su actividad
  laboral, en los campos 9 y 10 del registro tipo 2.
- `Contrato.sedeId` apunta a una sede organizacional. `Sede` conserva un
  municipio DANE, pero no declara que allí se ejecute la actividad laboral para
  PILA.
- ADR-014 establece que `Sede` tampoco equivale al centro de trabajo asignado
  por la ARL. El centro ARL y su actividad económica tienen su propia historia
  por empleado.
- El payload PILA actual congela el municipio de la sede del contrato como
  `worksite.municipio`; el preflight de #182 ya bloquea los campos 9 y 10,
  incluso cuando ese código DIVIPOLA es válido.
- No existe hoy una fuente independiente, confirmada por el aportante y con
  vigencias para la ubicación laboral PILA de cada empleado.

## Problema

El sistema no puede acreditar que el municipio de la sede contractual sea el
lugar donde cada trabajador ejecuta su actividad laboral. Reutilizarlo podría
marcar como listo un dato PILA incorrecto. A su vez, reutilizar el centro ARL
mezclaría dos hechos distintos que AT2 y ADR-014 ya separan.

Mientras no exista una fuente histórica explícita, los campos 9 y 10 deben
seguir bloqueados. Los snapshots aprobados tampoco se pueden completar
retroactivamente consultando la sede o los datos actuales del empleado.

## Decisión

**Opción A: registrar por empleado una asignación histórica de ubicación
laboral PILA, separada de `Sede` y de `PilaAsignacionCentroTrabajo`.**

1. Crear un registro tenant-scoped asociado al empleado, con municipio del
   catálogo DANE, `vigenteDesde`, `vigenteHasta` y auditoría de quién registró
   o confirmó la declaración del aportante.
2. Capturarlo en una sección de ubicación laboral PILA del perfil del empleado.
   El formulario puede mostrar la sede contractual como contexto, pero no
   preseleccionarla ni convertirla en la declaración PILA. El empleador debe
   confirmar el municipio donde la persona trabaja efectivamente.
3. Conservar el historial: cerrar la vigencia anterior y añadir una nueva
   asignación; no reemplazar datos que ya alimenten snapshots aprobados.
4. Al aprobar Payroll, congelar en una nueva versión de `pilaPayload` el
   identificador, tenant, municipio DIVIPOLA y vigencia de la asignación
   efectiva. No hacer backfill de payloads históricos.
5. Para el MVP, exigir una sola asignación que cubra todo el período de
   nómina. Una ausencia, solapamiento, cambio o hueco durante el período
   bloquea los campos 9 y 10; la segmentación de varios registros 02 queda
   fuera del alcance de esta decisión.
6. La selección de ubicación PILA no modifica el contrato, la sede del
   empleado, el centro ARL ni su actividad económica.

Esta decisión autoriza capturar y congelar una fuente. No
habilita por sí sola el serializador, la descarga, la transmisión ni la
compatibilidad con un operador.

## Alternativas

### B. Derivar municipio desde la sede contractual

Se descarta: `Sede` es una clasificación administrativa. Una dirección o un
código DIVIPOLA válido no prueba dónde trabaja el empleado para los campos 9 y 10.

### C. Añadir municipio a centro/asignación ARL

Se descarta: la ubicación donde se realiza el trabajo puede cambiar
independientemente del centro asignado por la ARL. Los campos 9–10 no se
derivan de los campos 62 o 98.

### D. Pedir municipio por empleado en cada lote PILA

No se recomienda para el primer incremento: requiere conservar la declaración
y su origen en cada período; un valor transitorio de interfaz no es suficiente
para reconstruir snapshots ni auditar cambios históricos.

## Criterios de aceptación propuestos

- Un administrador puede registrar y consultar la ubicación laboral PILA del
  empleado y sus vigencias; el valor se distingue visualmente de sede y centro
  ARL.
- El municipio proviene del catálogo DANE. El formulario exige confirmación
  explícita del aportante y registra el usuario y el momento de captura.
- Las escrituras y lecturas filtran por tenant; una relación a empleado de
  otro tenant se rechaza sin revelar su existencia.
- El historial no admite vigencias solapadas para el mismo empleado. Un cierre
  o corrección produce auditoría y no altera snapshots existentes.
- Al aprobar una nómina, el payload congela la única asignación que cubre todo
  el período; si no existe, no cubre el período o cambia dentro de él, el
  preflight mantiene bloqueados los campos 9 y 10.
- Cambiar la sede, asignación ARL o ubicación actual después de aprobar no
  cambia un snapshot previo.
- Pruebas cubren tenant cruzado, municipio inválido, alta/cierre/corrección,
  huecos, solapamientos, cambios dentro del período, captura del snapshot y
  permanencia de datos históricos.
- La migración es aditiva y no asigna municipios a datos existentes. El plan
  de reversión deshabilita captura y conserva registros y snapshots; no borra
  evidencia.

## Riesgos y límites

- Un trabajador puede desempeñarse en más de un municipio durante un período.
  Sin una regla laboral y de archivo revisada para segmentar esos casos, el
  MVP los bloquea; no elige una ubicación predominante.
- La dirección residencial del empleado no demuestra su ubicación laboral.
- Que la aplicación valide el código DIVIPOLA no confirma por sí solo que el
  aportante haya informado el municipio correcto ni que un operador acepte el
  archivo.

## Aprobación

Producto aprobó la opción A y sus límites de MVP el 2026-11-02. La aprobación
autoriza implementar la captura y el congelamiento de la ubicación laboral PILA
conforme a esta ADR. No habilita el serializador, la descarga, la transmisión ni
la compatibilidad con operadores.
