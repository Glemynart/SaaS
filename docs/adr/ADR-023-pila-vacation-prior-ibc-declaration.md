# ADR-023 — Captura declarada del último IBC reportado antes de vacaciones

- **Estado:** Aceptada bajo delegación explícita de Producto / Nómina, 2026-11-08.
- **Goal:** GOAL-02 — Evolución Financiera y Cumplimiento Electrónico.
- **Responsables:** Producto / Nómina.

## Contexto

El evento PILA `VAC_LR` ya distingue vacaciones disfrutadas y licencia
remunerada en snapshots v12. La ruta de vacaciones necesita conservar la fuente
del último IBC reportado antes del descanso. La aplicación no consulta al
operador ni recibe actualmente ese dato; que un usuario lo capture no demuestra
que el operador lo haya aceptado ni que sea correcto.

La exportación permanece bloqueada hasta contar además con remuneración trazable
y días/bases aprobados por subsistema. Registrar el dato de origen es una etapa
de preparación y trazabilidad, no una aprobación normativa ni una regla de
cálculo.

ADR-024 añade la captura separada de una remuneración declarada para vacaciones
disfrutadas. Ambas declaraciones permanecen sin verificar; ninguna se usa para
calcular aportes, completar campos AT2 ni habilitar la exportación.

## Decisión

1. Agregar a `PayrollPilaEvent` campos nullable para valor del IBC, período
   reportado, operador y referencia de planilla, más una confirmación explícita
   del usuario. Los campos solo pueden acompañar `VAC_LR` con subtipo
   `VACACIONES_DISFRUTADAS`.
2. Aceptar el conjunto completo o ninguno. El valor debe ser positivo y tener
   hasta dos decimales; el período debe ser un mes válido anterior al mes de
   inicio de las vacaciones; operador y referencia deben ser no vacíos; el
   usuario debe confirmar que transcribió la fuente indicada.
3. Mostrar y guardar el dato como **declarado por el usuario, no verificado con
   el operador**. No se sube ni se infiere un soporte documental. La auditoría
   conserva el actor y si hubo declaración, sin duplicar el monto ni la
   referencia en sus metadatos. La lectura y escritura quedan restringidas a
   `ADMIN` y `OPERADOR` dentro del tenant autenticado.
4. Aumentar el payload PILA a v13 y congelar el objeto declarado en ambas copias
   del evento en el snapshot aprobado. Los eventos históricos y snapshots v2–v12
   no se reescriben ni reciben datos retrospectivos.
5. No usar esta declaración para mapear campos AT2, calcular cotizaciones ni
   desbloquear generación/descarga. El preflight indica que el valor sigue sin
   verificación; pago trazable y segmentación aprobada de días/IBC siguen siendo
   dependencias separadas.

## Alternativas consideradas

- **Consultar o cargar automáticamente el dato del operador:** descartada en
  esta etapa porque no hay integración ni evidencia de aceptación para usar una
  respuesta externa.
- **Inferirlo del IBC de Payroll actual:** descartada porque no prueba el valor
  reportado antes del descanso y podría referirse a otro período o fuente.
- **No capturarlo:** mantiene la procedencia fuera del sistema y obliga a
  reconstruirla en una etapa posterior.

## Compatibilidad, migración y reversión

La migración añade columnas nullable y una restricción `CHECK` aditiva. Las
filas anteriores conservan valores nulos y confirmación falsa. No hay backfill,
recálculo de nómina, cambio de snapshots aprobados ni operación sobre datos de
producción. La reversión de código puede dejar las columnas sin uso; si una
corrección de esquema fuera necesaria, se aplicará una migración hacia delante,
sin borrar declaraciones ya capturadas.

## Criterios de aceptación

- UI solo ofrece la declaración para vacaciones disfrutadas; presenta los
  campos como opcionales hasta que el usuario selecciona declararla y exige
  completar/confirmar el conjunto.
- API y base de datos rechazan conjunto parcial, monto inválido, mes no anterior,
  otra clase de evento, referencia u operador vacíos, o falta de confirmación.
- Evento y lectura permanecen tenant-scoped; solo se capturan en período
  `BORRADOR`; la ruta de lectura exige `ADMIN`/`OPERADOR`. La auditoría no
  contiene monto ni referencia.
- Snapshot v13 conserva el valor decimal con dos posiciones, mes, operador,
  referencia y estado `DECLARADO_NO_VERIFICADO` en sus dos copias; snapshots
  históricos permanecen sin cambio.
- Preflight y mappers aceptan v13; el monto declarado no aparece como candidato
  para ningún campo IBC ni remueve los bloqueos de días/bases y pago trazable.
- CI y Browser E2E verifican captura, persistencia al recargar y mensaje visible
  de que el dato no fue validado por el operador.
