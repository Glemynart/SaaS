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
4. Mantener ambos subtipos fuera de la exportación. El preflight puede mostrar
   como candidatos parciales los campos AT2 27, 89 y 90 desde el evento tipado
   y congelado, y campo 30 en cero cuando no hay otra novedad. Los días 36–39
   por subsistema se mantienen sin candidato hasta contar con su segmentación
   aprobada. Esto no aprueba IBC, importes, aportes ni compatibilidad de
   operador, y no habilita la generación o descarga del archivo.
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
  muestran los candidatos parciales AT2 27 (`X` vacaciones / `L` licencia),
  89–90 (fechas) y 30 (`0` días IRL) solo cuando ambas copias del único evento
  coinciden, el período es un mes calendario completo y la persona dependiente
  01/00 mantiene su cobertura. Eventos históricos sin subtipo, fechas fuera del
  período, copias discordantes, concurrencias y otros escenarios no reciben
  esos candidatos.
- Ambos subtipos siguen bloqueando la exportación mientras falten reglas y
  evidencia aprobadas para días, IBC, importes y aportes por subsistema. Ningún
  archivo se habilita por la sola presencia del subtipo o de esos candidatos.
- La migración es aditiva y no actualiza filas históricas.
