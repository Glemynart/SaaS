# ADR-018 — Importación masiva de asignaciones de centro y actividad PILA

- **Estado:** aceptada para GOAL-02 como captura sobre el modelo existente de ADR-014.
- **Fecha:** 2026-11-02.
- **Decisor:** Producto; decisión de implementación tomada por Codex bajo autorización explícita del usuario para avanzar GOAL-02.
- **Ámbito:** asignaciones históricas de centro de trabajo ARL y actividad de riesgos por empleado existente.
- **Relaciona:** ADR-013, ADR-014, ADR-017, `PilaCentroTrabajo`, `PilaAsignacionCentroTrabajo` y `PayrollSnapshot.pilaPayload`.

## Contexto

ADR-014 conserva el centro asignado por la ARL y la actividad económica de
riesgos en una asignación tenant-scoped por empleado y vigencia. La pantalla
individual ya permite registrar esos datos y valida el código frente al
catálogo versionado del Decreto 768 de 2022. Para preparar varios empleados
existentes, capturar cada asignación desde su detalle repite la misma operación
y retrasa la revisión de los campos 62, 78 y 98 del registro tipo 2. ADR-017
ya establece el patrón de plantilla separada, confirmación expresa,
validación transaccional e idempotencia para ubicaciones laborales PILA.

La importación no confirma que la ARL haya asignado realmente el centro o la
actividad. El aportante debe copiar datos de una constancia o comunicación de
la ARL; la aplicación solo valida consistencia estructural y con el historial
afiliatorio disponible.

## Decisión

Agregar una plantilla XLSX independiente para asignar un centro ARL ya
registrado y una actividad de riesgo a cada empleado existente.

1. Cada fila identifica al empleado por tipo y número de documento y declara
   el código de ARL, código de centro, código de actividad y fechas de vigencia.
   El centro debe existir y estar activo en el tenant actual; la importación no
   crea, edita ni desactiva centros.
2. La UI exige confirmación expresa de que el centro y la actividad fueron
   confirmados con la ARL para ese empleado y período. La confirmación y actor
   quedan en la auditoría del lote.
3. Se admiten hasta 500 filas y una fila por empleado. Para cargar varias
   vigencias históricas del mismo empleado se usan operaciones separadas en
   orden cronológico o el detalle individual.
4. Antes de escribir se validan encabezados, identidad exacta dentro del
   tenant, centro y ARL existentes, código de actividad del catálogo
   versionado, fechas, duplicados y reglas de vigencia. La regla existente
   vuelve a comprobar dentro de la transacción que la actividad corresponda a
   la clase de riesgo y que ARL/centro sean compatibles con las afiliaciones
   vigentes.
5. El lote completo se guarda en una transacción tenant-scoped. Los empleados
   se bloquean en orden estable; un conflicto concurrente revierte el lote.
   Un reintento con el mismo empleado, centro, actividad y vigencia es un
   no-op; una nueva vigencia conserva el historial y la regla del servicio
   cierra la asignación abierta anterior cuando corresponde.
6. Cada asignación creada y el resumen del lote se auditan. Ninguna fila
   modifica empleado, sede, afiliación, centro ARL, ubicación laboral ni
   snapshot PILA existente.
7. Los errores indican fila, campo y causa. Una carga inválida no deja cambios
   parciales. La plantilla mantiene documento como texto para no perder ceros
   iniciales; los códigos de centro también se tratan como texto.

## Criterios de aceptación

- Un administrador puede descargar la plantilla, cargarla desde Empleados y
  ver conteos de asignaciones nuevas y filas idénticas sin cambios.
- La confirmación del aportante es obligatoria tanto en la UI como en la API.
- Documento desconocido, documento de otro tenant, centro ausente/inactivo o
  de otro tenant, ARL discordante, código no perteneciente al catálogo,
  actividad incompatible con clase ARL, fechas imposibles/invertidas,
  duplicado o vigencia cruzada rechazan el lote completo con fila y campo.
- Una sustitución abierta cierra la vigencia anterior al día previo; la
  asignación y sus auditorías se conservan. Las vigencias históricas ya
  cerradas no se sobrescriben.
- Un reintento exacto informa sin cambios, no duplica filas ni cambia
  snapshots. Una falla de persistencia o auditoría revierte todas las filas.
- El detalle del empleado muestra el historial nuevo después de recargar.
- No hay migración; las versiones antiguas siguen leyendo la asignación y no
  se rellena ningún snapshot aprobado.
- La importación no habilita descarga PILA ni declara aceptación/compatibilidad
  con operador.

## Pruebas

Las pruebas API deben cubrir plantilla y encabezados, confirmación obligatoria,
validación previa, documento y tenant, centro tenant-scoped, catálogo y clase
de riesgo, ARL efectiva, fechas y cruces, cierre de vigencia abierta,
idempotencia, bloqueo concurrente, rollback atómico y auditoría. Browser E2E
debe descargar la plantilla, completar una fila respaldada por el centro de
prueba, confirmar, importar, recargar el detalle y repetir la carga sin
duplicación.

## Límites

- No valida la verdad de los datos frente a la ARL ni reemplaza la revisión del
  aportante.
- No deduce actividad, centro, clase o ARL de sede, cargo, domicilio,
  afiliación en texto libre ni código general del empleador.
- No calcula aportes, segmenta novedades, modifica snapshots ni genera,
  transmite, liquida o paga una planilla.
- Los estados de archivo y compatibilidad de ADR-013 permanecen sin cambios.
