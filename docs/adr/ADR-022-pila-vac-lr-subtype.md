# ADR-022 — Clasificación explícita del evento PILA VAC-LR

- **Estado:** Aceptada bajo delegación explícita de Producto, 2026-11-08.
- **Goal:** GOAL-02 — Evolución Financiera y Cumplimiento Electrónico.
- **Responsables:** Producto / Nómina.

## Contexto

El código AT2 `VAC-LR` agrupa vacaciones y licencias remuneradas. La regla
verificada para vacaciones disfrutadas por trabajadores privados requiere una
fuente del último IBC reportado antes del descanso, remuneración trazable y
segmentos de días/bases por subsistema. Esa evidencia no existe hoy en los
datos ni en el snapshot. Las licencias remuneradas no heredan automáticamente
esa misma regla.

Conservar solo el código y las fechas oculta una diferencia material. Inferir
el subtipo durante la exportación desde fechas, conceptos genéricos o datos
actuales no es seguro.

## Decisión

1. Añadir el enum `PilaVacLrSubtype` con `VACACIONES_DISFRUTADAS` y
   `LICENCIA_REMUNERADA`, y una columna nullable `PayrollPilaEvent.subtipo`.
2. Exigir subtipo al crear nuevos eventos `VAC_LR`; rechazarlo para códigos de
   evento distintos. La UI presenta una opción vacía para que el usuario haga
   la clasificación explícita.
3. Congelar el subtipo en las dos copias del evento dentro del snapshot PILA y
   aumentar el payload a v12. Los payloads históricos no se reescriben ni se
   completan retrospectivamente; eventos anteriores sin subtipo permanecen
   identificables como no clasificados.
4. Mantener ambos subtipos fuera de la exportación. La captura tipada mejora la
   calidad de la fuente y el diagnóstico, pero no aprueba días, IBC, importes,
   aportes ni compatibilidad de operador.
5. La siguiente etapa podrá evaluar únicamente vacaciones disfrutadas cuando
   Payroll congele la fuente del último IBC realmente reportado, el pago
   trazable y días/bases por subsistema. Licencias, vacaciones compensadas,
   concurrencias, cambios salariales y fuentes ausentes o discordantes seguirán
   bloqueados hasta que tengan reglas y evidencia aprobadas.

## Compatibilidad, migración y reversión

La migración añade un enum y una columna nullable sin backfill. La reversión de
código puede dejar la columna y el enum sin uso; no se elimina información ni
se ejecuta una migración destructiva. Si se requiere corregir el esquema, se
entrega una migración hacia adelante. Los snapshots PILA v2–v11 conservan sus
reglas existentes y v12 conserva también sus validaciones anteriores.

## Criterios de aceptación

- Un `VAC_LR` nuevo sin subtipo es rechazado en API; con cualquiera de los dos
  subtipos válidos se persiste con tenant, período y empleado existentes.
- Un subtipo enviado con otro código es rechazado.
- La UI permite clasificar el evento y muestra la clasificación persistida.
- La aprobación congela el subtipo en ambas copias del payload v12; un evento
  histórico sin subtipo sigue siendo `null` y no se reinterpreta.
- Preflight y mapper reconocen v12, conservan validaciones existentes y
  bloquean ambos subtipos con una causa específica. Ningún archivo se habilita
  por la sola presencia del subtipo.
- La migración es aditiva y no actualiza filas históricas.
