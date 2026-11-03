# ADR-017 — Importación masiva de ubicaciones laborales PILA

- **Estado:** aceptada para GOAL-02 como continuación de ADR-015.
- **Fecha:** 2026-11-02.
- **Decisor:** Producto; decisión operativa tomada por Codex bajo autorización explícita del usuario para avanzar GOAL-02.
- **Ámbito:** captura tenant-scoped de ubicaciones laborales históricas para empleados ya registrados.
- **Relaciona:** ADR-015, ADR-016, `PilaUbicacionLaboral`, `MunicipioDane` y `PayrollSnapshot.pilaPayload`.

## Contexto

ADR-015 separa la ubicación laboral PILA de la sede contractual y del centro
de trabajo ARL, exige confirmación del aportante y conserva municipio y
vigencias para congelarlos en snapshots futuros. El detalle del empleado ya
permite registrar esas ubicaciones manualmente. La importación masiva de
afiliaciones de ADR-016 reduce la carga de datos PILA para una plantilla
existente, pero no registra la ubicación laboral necesaria para los campos
9–10 del AT2.

## Decisión

Agregar una plantilla XLSX separada para registrar una ubicación laboral PILA
por empleado existente, identificado por tipo y número de documento dentro
del tenant activo.

1. El archivo contiene municipio DANE de cinco dígitos y un intervalo de
   vigencia por fila. Si Excel entrega el código como número, el importador
   completa ceros a la izquierda hasta cinco posiciones antes de consultar el
   catálogo. No contiene sede, residencia, ARL ni datos de afiliación.
2. La UI exige que el usuario confirme explícitamente que los municipios
   reportados son los lugares donde los empleados ejecutan su actividad
   laboral para PILA. La API solo acepta la carga con esa confirmación. La
   auditoría identifica al usuario que confirmó y cargó el archivo.
3. Se admiten hasta 500 filas y una fila por empleado. Varias versiones
   históricas de un mismo empleado se cargan en operaciones separadas o desde
   el detalle individual, según el orden cronológico.
4. Se validan encabezados, duplicados, identidad, código DANE, fechas y
   vigencias antes de escribir. Cada ubicación se valida de nuevo contra el
   catálogo al guardar. Cualquier conflicto revierte el lote completo.
5. Todas las filas se guardan en una transacción tenant-scoped ordenada por
   empleado para reducir carreras y deadlocks. Un reintento exactamente
   idéntico no crea otra fila ni altera el historial.
6. Se reutilizan las reglas y el servicio existentes de ADR-015 para cerrar
   la ubicación abierta previa al día anterior cuando se registra una nueva
   ubicación abierta. Las vigencias superpuestas se rechazan.
7. La importación no completa ni cambia snapshots existentes, empleados,
   contratos, sedes, afiliaciones, asignaciones ARL ni actividades
   económicas. No habilita ni genera un archivo PILA.

## Consecuencias y límites

- La carga por lote confirma que cada fila se basa en una declaración del
  aportante; no demuestra que el dato sea verdadero ni que un operador lo
  acepte.
- El MVP conserva la misma restricción de ADR-015: una ubicación debe cubrir
  todo el período PILA para alimentar los campos 9–10; los períodos con huecos,
  cambios o varias ubicaciones permanecen bloqueados.
- Los códigos se validan contra el catálogo DANE local, no contra operadores.
- La migración de datos no cambia; el rollback operativo consiste en ocultar
  la acción de importación y conservar historial y snapshots.

## Criterios de aceptación

- Un administrador puede descargar la plantilla e importarla desde Empleados.
- La UI deja explícita la confirmación del aportante y el alcance limitado de
  la captura; el resultado distingue registros nuevos de filas sin cambios.
- Empleados inexistentes, documentos discordantes, duplicados, códigos DANE
  no reconocidos y fechas inválidas informan fila y campo y no escriben parte
  del archivo.
- Empleados de otro tenant no se pueden buscar ni alterar mediante la carga.
- La escritura conserva auditoría, vigencias y cierre automático del registro
  abierto previo. Un reintento idéntico es idempotente.
- El detalle muestra el historial tras recargar y los snapshots históricos no
  se modifican.
- Pruebas cubren rollback atómico, conflictos de vigencia, tenant cruzado,
  catálogo DANE, confirmación obligatoria, reintento y recorrido UI.
