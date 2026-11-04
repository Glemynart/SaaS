# ADR-012 — Liquidación semestral de prima de servicios por lote

- **Estado:** Aprobado con condiciones; el MVP habilita únicamente enero–junio. Julio–diciembre queda excluido hasta validar laboralmente un corte y ajuste. La revisión laboral independiente sigue pendiente antes de liquidaciones operativas o pagos reales.
- **Fecha:** 2026-10-30.
- **Goal:** GOAL-02 — Evolución Financiera y Cumplimiento Electrónico.
- **Responsable:** Producto / Payroll.

## Contexto

La demo comercial requiere calcular la prima de servicios de empleados activos
y producir un comprobante individual para cada persona en una operación por
lote. El código actual no ofrece ese flujo:

- `PayrollCalculator` reconoce `PROV_PRIMA` como provisión mensual; la
  contabilización de nómina también causa esa provisión.
- `Liquidation` exige un empleado retirado y calcula prima junto con otros
  conceptos de finiquito. No representa una prima semestral de trabajadores
  activos.
- `BatchDocumentGenerationPlan` y `BatchDocumentGenerationService` están
  ligados a lotes de contratos; no generan comprobantes de nómina.
- `PayrollSnapshot` conserva conceptos y valores por período aprobado, mientras
  que salario y datos maestros del empleado pueden cambiar después.
- El payload de `PayrollSnapshot` congela salario base usado, auxilio de
  transporte, novedades, parámetros legales y conceptos con código y valor.
  `AUX_TRANSP` se conserva separado del IBC. Sin embargo, ni `Empleado` ni
  `PayrollConcept` distinguen un salario fijo de uno variable, y el catálogo no
  guarda la naturaleza salarial por concepto; un código `BONUS` no basta para
  decidir su inclusión en la prima.

El artículo 306 del Código Sustantivo del Trabajo establece 30 días de salario
por año, en dos pagos semestrales, con reconocimiento proporcional al tiempo
trabajado. La lógica para empleados públicos es diferente y no entra en este
alcance. La regulación se debe volver a verificar al implementar y antes de
cada cambio de reglas.

## Estado de validación

- La matriz de conceptos y novedades se tradujo a reglas conservadoras: salario
  fijo estable y horas extra aprobadas se procesan; conceptos sin naturaleza,
  correcciones no reconstruibles, novedades ambiguas y períodos que cruzan el
  semestre se bloquean.
- Enero–junio tiene cálculo versionado y casos aritméticos revisados en pruebas.
  La decisión de alcance del MVP es no calcular ni publicar prima de
  julio–diciembre: no hay una regla general aprobada para fijar, antes del 20
  de diciembre, el corte de servicio y remuneración variable del semestre que
  termina el 31 de diciembre.
- La UI deja julio–diciembre no disponible y la API rechaza ese semestre antes
  de consultar o persistir lotes; así no se guardan previews compuestos solo por
  líneas bloqueadas para un período excluido del MVP.
- El preview presenta períodos y conceptos de origen, días, componentes de la
  base, fórmula y resultado. La aprobación congela snapshots y deltas de
  correcciones utilizados; el PDF se publica en Expediente con hash.
- Las PR #167 y #168 amplían el Browser E2E: genera documentos para 100
  empleados, desconecta el navegador tras aprobar y confirma que el lote entra
  en `PROCESANDO` mientras sigue sin conexión, publica 100 documentos únicos,
  muestra el avance 100/100 al reconectar y permite descargarlos. Se verificó
  en PostgreSQL 16 desechable; el caso tardó 39,5 segundos.
- PR #173 agrega una prueba unitaria de recuperación tras una interrupción
  simulada de la API después de guardar el PDF y antes de publicarlo. Al vencer
  el lease, el worker reutiliza el objeto y completa la publicación sin volver
  a renderizarlo. No simula un reinicio real de proceso ni sustituye el Browser
  E2E anterior.
- La revisión técnica y los resultados esperados no reemplazan la validación
  por un responsable de nómina o asesor laboral. La interfaz y el PDF advierten
  que se verifique el resultado antes de usarlo para pagar. No se registra pago
  ni asiento contable.
- Las migraciones se aplicaron solo a la base PostgreSQL desechable de la
  prueba local. No se aplicaron a demo, staging ni producción.

## Decisión propuesta

1. Crear un agregado de **prima semestral** independiente de `PayrollPeriod`,
   de `Liquidation` (finiquito) y de la provisión mensual `PROV_PRIMA`.
2. La primera versión cubre empleados dependientes del sector privado con
   contrato laboral dentro del tenant. El salario integral se excluye de la
   liquidación separada y aparece en el resultado como “no aplica”. Casos no
   modelados se bloquean con una explicación; no se estiman silenciosamente.
3. El cálculo consume únicamente `PayrollSnapshot` aprobados y sus conceptos
   históricos; nunca vuelve a leer `Empleado.salario` como fuente histórica.
   La base fija mensual se toma del salario nominal congelado por snapshot, no
   del importe de nómina pagado si fue prorrateado. La fórmula versionada es
   `roundPeso(baseMensualElegible × días360 / 360)`. El auxilio de transporte
   se evalúa por separado y se suma a la base cuando los snapshots acreditan
   que se causó, conforme al artículo 7 de la Ley 1 de 1963.
4. La matriz preliminar de conceptos y el manejo de novedades quedan sujetos a
   los criterios de aceptación de abajo. El código actual no registra la
   naturaleza salarial de cada bonificación ni subtipo de licencia. Una
   bonificación sin clasificación salarial explícita, una novedad genérica o
   desconocida, o un concepto no reconocido bloquea la línea; no se deduce su
   naturaleza del solo tipo `EARNING` ni del IBC. Las correcciones de nómina
   aprobadas se
   aplican desde su materialización inmutable; una corrección pendiente,
   aprobada sin materialización o con conceptos no soportados bloquea la línea.
   Faltantes, solapamientos o cobertura incompleta de snapshots también
   bloquean la aprobación.
5. La convención versionada para contar servicio es 30/360: intervalos con
   inicio inclusivo y fin exclusivo, meses normalizados a 30 días y tope de 180
   días por semestre. Son días de servicio calendario, no turnos efectivamente
   asistidos. Vacaciones, incapacidades y licencia de maternidad no reducen los
   días computables para el MVP. Una suspensión, licencia no remunerada o
   novedad sin subtipo e intervalo confiables bloquea el cálculo; el sistema no
   deduce ni cuenta esos días por inferencia. La guía oficial consultada expresa
   la prima proporcional como días del semestre × medio salario / 180; la
   normalización 30/360 es la convención versionada del MVP y requiere revisión
   laboral antes del uso operativo.
6. El preview muestra por empleado los períodos fuente, conceptos, días,
   base y fórmula. La aprobación congela una copia de los insumos y el
   resultado. Una corrección crea una nueva versión relacionada; no edita ni
   borra el original.
7. La identidad de una línea es tenant + empleado + año + semestre. Repetir la
   misma operación devuelve la liquidación existente en vez de duplicarla.
8. Tras aprobar el lote, se genera un PDF individual por empleado con el
   detalle de cálculo, y se publica en el Expediente Digital conservando la
   relación con la liquidación. El contenido se deriva del snapshot aprobado.
9. Esta primera entrega **calcula y documenta** la prima; no registra pagos ni
   crea un asiento de pago en el Ledger. La provisión contable mensual conserva
   su comportamiento actual. El asiento de liquidación/pago y Tesorería son un
   incremento posterior que deberá consumir este agregado de forma idempotente,
   reversar o reclasificar provisiones sin duplicar gasto y conservar tercero,
   sede y evidencia.
10. El lote y todos los accesos se limitan al tenant activo; la generación y
    aprobación siguen RBAC. El proceso debe tolerar reintentos sin duplicar
    liquidaciones ni PDFs.

## Alcance inicial decidido y criterio de corte de diciembre

El artículo 306 CST reconoce 30 días de salario por año, pagados en dos partes:
la primera a más tardar el 30 de junio y la segunda dentro de los primeros
veinte días de diciembre; el reconocimiento cubre el semestre trabajado o el
tiempo proporcional laborado. La jurisprudencia de la Corte Suprema consultada
también describe los pagos como correspondientes a los semestres de calendario.
Estas fuentes no fijan una regla general para determinar, antes del 20 de
diciembre, los días y la base salarial definitivos hasta el 31 de diciembre.
No es válido resolver esa diferencia proyectando días o conceptos futuros, ni
usar como regla general un corte presente en un convenio colectivo particular.

**Decisión para el MVP:** habilitar únicamente enero–junio; excluir
julio–diciembre del cálculo y de la generación del comprobante mientras una
revisión laboral independiente no apruebe el corte de servicio, la base y el
tratamiento de un eventual ajuste. El sistema bloquea el segundo semestre y no
genera proyección ni PDF definitivo. Esta limitación de alcance no elimina ni
reduce el derecho o la obligación legal; evita emitir un cálculo cuya regla
no ha sido validada.

La evidencia consultada no define por sí sola un corte técnicamente seguro.
Esta conclusión describe el alcance del MVP, no afirma que la ley omita toda
regla aplicable. Para reabrir el semestre se requieren una regla laboral
revisada y casos esperados aprobados que cubran el pago dentro del plazo legal,
el período completo y cualquier ajuste posterior.

### Revisión de fuentes oficiales — 2026-11-04

La compilación vigente del artículo 306 CST conserva el pago máximo el 30 de
junio y durante los primeros veinte días de diciembre, con reconocimiento por
semestre trabajado o proporcional al tiempo. La Sentencia C-871/2014 recoge la
referencia histórica a semestres calendario; MinJusticia señala que incapacidad
y licencia de maternidad no reducen días porque el contrato no se suspende.
Esta revisión no encontró una regla oficial general para proyectar antes del
20 de diciembre los días restantes hasta el 31 ni la remuneración variable de
esos días, ni para ajustar una proyección luego del pago. No se usa el corte
del 30 de noviembre de una convención colectiva como regla general.

**Decisión vigente:** no habilitar todavía el cálculo operativo de
julio–diciembre. Mantener cálculo, aprobación y PDF bloqueados en ese semestre
hasta que una regla general de corte y ajuste esté documentada y haya casos
representativos revisados. El prototipo de enero–junio permanece disponible;
esto no registra pagos ni asientos. Fuentes: [artículo 306 CST compilado](https://normativa.colpensiones.gov.co/colpens/compilacion/docs/codigo_sustantivo_trabajo.htm),
[Sentencia C-871/2014](https://www.corteconstitucional.gov.co/relatoria/2014/C-871-14.htm)
y [LegalApp de MinJusticia](https://www.minjusticia.gov.co/programas-co/LegalApp/Paginas/Que-es-la-prima-de-servicios-y-que-hacer-si-no-se-reconoce-o-paga.aspx).

## Matriz del MVP de conceptos y novedades

Esta matriz es la política implementada por `PRIMA_SEMESTRAL_V1`. Cubre todos
los códigos estables de `ConceptCodigo` y valida que cada uno conserve su tipo
de nómina esperado. Todo código fuera de la matriz, aunque figure como
deducción o aporte, bloquea la línea. La naturaleza de `BONUS` no está en el
modelo, así que sigue bloqueado mientras no haya clasificación salarial
explícita. Incorporar o reclasificar conceptos requiere versionar la regla y
revisar sus casos antes de habilitar el cálculo.

| Dato/concepto de origen                                                                                                    | Regla propuesta                                                                                                                                                                                                             | Evidencia/riesgo                                                                                                                                                                                                                                                                    |
| -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SALARIO_BASE`                                                                                                             | Incluir el salario ordinario mensual nominal congelado por snapshot. Si cambia entre snapshots o dentro del período, bloquear en el MVP hasta tener fecha efectiva y regla laboral aprobadas; no promediar automáticamente. | `PayrollSnapshot` conserva el salario nominal usado, pero no registra explícitamente modalidad salarial ni la fecha efectiva de una modificación dentro del período. El promedio del salario variable tiene sustento separado y no resuelve por sí solo un aumento de salario fijo. |
| `OVERTIME`                                                                                                                 | Incluir como pago salarial del período y promediar con el salario fijo por el semestre (o fracción servida), usando solo snapshots aprobados.                                                                               | CST art. 127 incluye el trabajo suplementario como salario; la CSJ ha aplicado promedio semestral a salario variable en prima legal. El IBC por sí solo no determina la base de prima.                                                                                              |
| `BONUS`                                                                                                                    | Incluir solo con clasificación explícita como salarial; excluir si está clasificado como no salarial. Si no hay clasificación, bloquear.                                                                                    | El modelo actual no guarda esa naturaleza; `BONUS` por sí solo es insuficiente.                                                                                                                                                                                                     |
| `AUX_TRANSP`                                                                                                               | Sumar aparte solo cuando los snapshots acrediten causación; no integrar al IBC por este motivo.                                                                                                                             | Ley 1 de 1963, art. 7; respetar la vigencia y el valor congelado en cada snapshot.                                                                                                                                                                                                  |
| Comisiones, recargos, salario en especie u otro concepto no catalogado                                                     | Bloquear hasta modelar su código, naturaleza y regla en una versión aprobada.                                                                                                                                               | El catálogo actual no los representa individualmente; no reutilizar `BONUS` para ocultar su origen.                                                                                                                                                                                 |
| `SALUD_EMP`, `PENSION_EMP`, `FSP`                                                                                          | Excluir de la base individual de prima; exigir tipo de concepto `DEDUCTION`.                                                                                                                                                | Son descuentos al trabajador y no salario causado.                                                                                                                                                                                                                                  |
| `SALUD_PAT`, `PENSION_PAT`, `ARL`, `CAJA`, `ICBF`, `SENA`                                                                  | Excluir de la base individual de prima; exigir tipo de concepto `EMPLOYER_CONTRIBUTION`.                                                                                                                                    | Son aportes patronales, no salario causado al trabajador.                                                                                                                                                                                                                           |
| `PROV_PRIMA`, `PROV_CESANTIAS`, `PROV_INT_CESANTIAS`, `PROV_VACACIONES`                                                    | Excluir de la base individual de prima; exigir tipo de concepto `PROVISION`.                                                                                                                                                | Son provisiones/costos y no pagos de salario al trabajador.                                                                                                                                                                                                                         |
| `LICENSE`, `OTHER`, tipo de novedad no reconocido, bonificación sin clasificar o cualquier código fuera de `ConceptCodigo` | Bloquear la línea hasta tener subtipo/naturaleza verificable y una regla versionada; un tipo contable desconocido o discordante también bloquea.                                                                            | Los campos de novedad actuales solo guardan un tipo amplio, fecha y valor; un tipo nuevo o histórico sin regla explícita no puede tratarse como si no afectara la prima.                                                                                                            |
| Vacaciones e incapacidad tipificada como `SICKNESS`                                                                        | Contar el tiempo; no restar esos días del semestre.                                                                                                                                                                         | MinJusticia LegalApp confirma expresamente que el tiempo de incapacidad no se descuenta; existe un código específico para `SICKNESS`.                                                                                                                                               |
| Licencia que pudiera ser maternidad                                                                                        | La regla laboral reconoce el tiempo, pero `LICENSE` carece de subtipo; **bloquear** hasta que el dato permita identificar y probar maternidad sin inferirla.                                                                | LegalApp confirma la regla para maternidad; el modelo actual solo contiene `LICENSE` genérica y no permite distinguirla de otras licencias.                                                                                                                                         |
| Suspensión, licencia no remunerada u otra ausencia no tipificada                                                           | Bloquear el empleado afectado; no sumar ni restar días por inferencia.                                                                                                                                                      | El código actual no guarda subtipo, intervalos ni tratamiento para prima. La regla se debe aprobar antes de incluir esos casos.                                                                                                                                                     |
| Salario integral                                                                                                           | Marcar “no aplica prima separada”; no emitir valor cero como si fuera una liquidación ordinaria.                                                                                                                            | Regla legal distinta por factor prestacional integral; su documentación no es un pago.                                                                                                                                                                                              |

## Criterios de aceptación y casos laborales para revisión

Todos los importes de la tabla usan COP, redondeo half-up al peso y fórmula
`base mensual elegible × días360 / 360`, con auxilio cuando corresponda. El
promedio solo se aplica a remuneración variable salarial registrada, no a
cambios de `SALARIO_BASE` sin una regla y vigencia demostrables. Los resultados
son resultados esperados verificados para la demostración controlada; no
sustituyen revisión laboral independiente antes del uso operativo. Cambiar la
matriz exige versionar la regla y actualizar los casos antes de habilitar
cálculos.

| Caso                                                  | Insumos esperados                                                                                                                                                                   | Resultado esperado / bloqueo                                                                                                                                                                                         |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Semestre completo, fijo                               | 6 snapshots mensuales aprobados; salario $2.000.000 y auxilio causado $200.000 en cada mes; 180 días.                                                                               | Base $2.200.000; prima **$1.100.000**.                                                                                                                                                                               |
| Semestre completo, fijo y variable salarial           | Seis snapshots mensuales aprobados: `SALARIO_BASE` $2.000.000 en cada mes; `OVERTIME` $0, $200.000, $100.000, $300.000, $0 y $200.000; auxilio causado promedio $200.000; 180 días. | Promedio salarial ($2.000.000 + $800.000 / 6) + auxilio; prima **$1.166.667**.                                                                                                                                       |
| Cambio de salario fijo dentro del semestre            | Tres snapshots con salario nominal $2.000.000 y tres con $2.400.000, sin otra remuneración variable; auxilio promedio $200.000; 180 días.                                           | **Bloquear** hasta que Payroll/asesoría laboral determine la regla aplicable y exista vigencia salarial verificable. No tratar el aumento como remuneración variable ni publicar un promedio automático.             |
| Fracción desde el 15 de enero hasta el 30 de junio    | Salario fijo nominal $2.200.000; auxilio causado $200.000; intervalo 30/360 `[15-ene, 1-jul)`, 166 días de servicio.                                                                | Prima **$1.106.667**. El test fija inicio inclusivo, fin exclusivo y normalización de cada mes a 30 días.                                                                                                            |
| Incapacidad tipificada                                | Mismos salarios y cobertura completa que el caso fijo; snapshot con `SICKNESS` durante 15 días.                                                                                     | Mantener 180 días computables y **$1.100.000**; no descontar los 15 días.                                                                                                                                            |
| Licencia potencialmente de maternidad sin subtipo     | Snapshot contiene `LICENSE`, pero no identifica subtipo ni intervalo caracterizado.                                                                                                 | **Bloquear**; no inferir que es maternidad ni descontar días. Cuando se incorpore subtipo verificable, contar el tiempo conforme a la regla laboral.                                                                 |
| Vacaciones                                            | Mismos salarios y cobertura completa que el caso fijo; vacaciones durante el semestre.                                                                                              | Mantener 180 días computables y **$1.100.000**; no descontar vacaciones.                                                                                                                                             |
| Bonificación explícitamente salarial/no salarial      | $100.000 mensuales por seis meses, salario fijo $2.000.000 y auxilio $200.000.                                                                                                      | Con clasificación salarial: **$1.150.000**; no salarial: **$1.100.000**; con el catálogo actual sin naturaleza explícita: **bloquear**.                                                                              |
| Auxilio no causado                                    | Salario fijo $2.200.000, sin auxilio causado en snapshots; 180 días.                                                                                                                | Prima **$1.100.000**; no recuperar auxilio desde datos actuales del empleado.                                                                                                                                        |
| Falta de snapshot, solapamiento o período sin aprobar | Falta cobertura aprobada para cualquier parte del semestre.                                                                                                                         | **Bloquear** aprobación y generación de PDF con causa por empleado; no completar con `Empleado.salario`.                                                                                                             |
| Corrección de nómina aprobada                         | Hay correcciones `APROBADA` vinculadas a snapshots del período; la materialización contiene cambios de `OVERTIME`, `SALARIO_BASE` o `BONUS`.                                        | Aplicar deltas aprobados a conceptos compatibles y guardar IDs/hash de las correcciones. Un cambio efectivo de `SALARIO_BASE` bloquea según la regla de cambio salarial; `BONUS` bloquea por naturaleza desconocida. |
| Corrección de nómina pendiente o sin materialización  | Existe corrección `BORRADOR`/`EN_REVISION`, o una corrección `APROBADA` sin materialización válida.                                                                                 | **Bloquear** la línea hasta resolverla; no publicar un resultado basado en un snapshot cuyo ajuste está pendiente o no puede reconstruirse.                                                                          |
| Novedad no caracterizada/suspensión                   | `LICENSE`, `OTHER`, suspensión o licencia no remunerada sin subtipo/regla aprobados.                                                                                                | **Bloquear** el empleado afectado, sin estimación silenciosa.                                                                                                                                                        |
| Licencia no remunerada o suspensión con fecha         | Hay evidencia de una novedad que puede afectar el tiempo de servicio, pero el MVP no contiene un tratamiento aprobado para prima.                                                   | **Bloquear** aunque las fechas sean conocidas; no asumir que el art. 53 CST autoriza descontar prima ni que debe contarse el tiempo suspendido.                                                                      |
| Salario integral                                      | Empleado dependiente con salario integral en la evidencia contractual aplicable.                                                                                                    | Resultado “no aplica prima separada”; no crear obligación ni PDF de liquidación con monto cero.                                                                                                                      |
| Segundo semestre antes del 20 de diciembre            | No existe snapshot aprobado que represente el semestre completo a 31 de diciembre.                                                                                                  | **Bloqueado en el MVP**; sin proyección ni PDF definitivo. Probar que el usuario ve la limitación.                                                                                                                   |

Las pruebas de `service-premium-calculator.spec.ts` verifican la cobertura
exhaustiva del catálogo, importes esperados, días 30/360, novedades reconocidas
y bloqueadas, snapshots faltantes, correcciones y conceptos no clasificados.
Las pruebas de dominio también cubren tenant cruzado denegado, RBAC, reintento
idempotente, corrección como versión nueva, PDF con hash/relación a los
snapshots y preservación del original. La revisión laboral independiente
sigue pendiente antes de una liquidación operativa. El segundo semestre
continúa bloqueado hasta que esa revisión apruebe el corte y cualquier ajuste.

## Alcance fuera de esta decisión

- Finiquitos por retiro, cesantías, intereses y vacaciones.
- Liquidación para empleados públicos, trabajadores oficiales, contratistas
  independientes o acuerdos colectivos especiales.
- Registro de pago, dispersión bancaria, asiento de pago o conciliación.
- PILA y nómina electrónica, que requieren decisiones y validaciones propias.
- Interpretar novedades no reconocidas como días cotizados o como factores
  salariales sin evidencia en Payroll.

## Alternativas descartadas

| Alternativa                                            | Motivo para descartarla                                                                                                      |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Reutilizar `Liquidation`                               | Está acotada a empleados retirados y mezcla prima con otros conceptos de finiquito.                                          |
| Representar la prima como otro `PayrollPeriod`         | Confunde un período de nómina ordinaria con una prestación semestral y puede volver a calcular salarios y aportes.           |
| Calcular con `Empleado.salario` actual                 | No reproduce una fecha histórica, omite cambios salariales y no permite auditar la base del período.                         |
| Publicar el PDF sin snapshot aprobado                  | Permite que una reejecución o un cambio de plantilla altere el resultado documental sin trazabilidad.                        |
| Registrar el pago en el Ledger en esta primera entrega | El módulo de Tesorería/pagos no existe; mezclar pago con cálculo sin flujo de caja ni reversión elevaría el riesgo contable. |

## Migración, reversión y riesgos

- La persistencia nueva será aditiva y tenant-scoped. No se modifican ni se
  eliminan snapshots, nóminas aprobadas, comprobantes contables o documentos
  históricos.
- Si la entrega debe revertirse, se deshabilitan las rutas/UI nuevas y se
  conserva la evidencia generada; no se borran liquidaciones aprobadas ni sus
  PDFs.
- El cálculo requiere que la nómina de origen esté aprobada y completa. La
  cobertura incompleta bloquea el cálculo hasta completar o corregir el período
  de origen.
- Las correcciones postaprobación forman parte de la base efectiva solo si
  están `APROBADA` y su materialización versionada se puede reconstruir. Las
  correcciones pendientes o inválidas bloquean el cálculo; el snapshot
  original nunca se modifica.
- Los períodos legales son enero–junio y julio–diciembre; el pago se debe
  programar dentro de los vencimientos del artículo 306 (a más tardar 30 de
  junio y durante los primeros veinte días de diciembre). El MVP solo habilita
  enero–junio. Julio–diciembre está excluido hasta revisión laboral del corte y
  ajuste; no imputar remuneración futura ni presentar una proyección como valor
  definitivo.
- La tarifa y los conceptos elegibles deben verificarse contra norma vigente y
  el dominio laboral antes del uso operativo, con casos de prueba revisados para
  salario fijo, novedades salariales variables, auxilio de transporte, cambios
  salariales, fracciones de período y corte de diciembre. La existencia de una
  provisión mensual no prueba por sí sola que una liquidación semestral esté
  correcta.

## Consecuencias

- Se obtiene una capacidad demostrable de cálculo y documentos por empleado
  sin confundirla con un finiquito ni con una nómina mensual.
- Los documentos no se pueden considerar comprobantes de pago hasta que exista
  una integración posterior con el Ledger/Tesorería.
- La ruta PILA queda priorizada después de este incremento. Requiere estructurar
  afiliaciones y novedades del cotizante, producir el archivo técnico vigente y
  probar su carga con operadores; el código actual solo tiene varias
  afiliaciones como texto libre.

## Fuentes verificadas

- `docs/adr/ADR-002-payroll-core.md` — Payroll y finiquito son agregados
  separados; prima está provisionada en nómina y su pago fue diferido.
- `apps/api/src/payroll/calculator/payroll-calculator.ts` y su spec —
  `PROV_PRIMA` es provisión mensual, no pago semestral.
- `apps/api/src/payroll/liquidation/liquidation.service.ts`,
  `liquidation-calculator.ts` y sus specs — ruta de retiro, sin lote/UI para
  empleados activos.
- `apps/api/src/payroll/payroll.service.ts` — los snapshots aprobados congelan
  conceptos, parámetros, salario base y auxilio de transporte. El cálculo y las
  specs de `payroll-calculator.ts` confirman que el auxilio se congela separado
  del IBC; no existe un indicador `salarioVariable` ni naturaleza salarial por
  concepto en el schema actual.
- `apps/api/src/batch-document-generation/batch-document-generation.service.ts`
  y su spec — generación por plan está ligada al lote contractual.
- Código Sustantivo del Trabajo, artículo 306, [Gestor Normativo de Función
  Pública](https://www1.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=199983).
- Código Sustantivo del Trabajo, artículos 127 y 128, sobre salario y pagos
  que pueden pactarse como no salariales, en el mismo [Gestor Normativo de
  Función Pública](https://www1.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=199983).
- Ministerio de Justicia, [LegalApp: prima de servicios](https://www.minjusticia.gov.co/programas-co/LegalApp/Paginas/Que-es-la-prima-de-servicios-y-que-hacer-si-no-se-reconoce-o-paga.aspx):
  incapacidad y licencia de maternidad no descuentan tiempo para esta
  liquidación; confirma proporcionalidad y fechas legales.
- Ministerio de Justicia, [LegalApp: cómo liquidar un contrato de trabajo](https://www.minjusticia.gov.co/programas-co/LegalApp/Paginas/Como-liquidar-un-contrato-de-trabajo.aspx):
  documenta la base con sueldo, horas extras, recargos, comisiones,
  bonificaciones salariales y auxilio de transporte; expresa la prima
  proporcional como días del semestre × medio salario / 180.
- Ley 1 de 1963, artículo 7, y Corte Suprema de Justicia, sentencia 2994 de
  1989: el auxilio de transporte se incorpora para liquidar prestaciones
  sociales, sin transformarse por ello en salario general; [Ley 1 de 1963,
  Cancillería](https://www.cancilleria.gov.co/sites/default/files/Normograma/docs/pdf/ley_0001_1963.pdf)
  y [sentencia 2994 de 1989, Gestor Normativo de Función
  Pública](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=88002).
- Corte Suprema de Justicia, Sala Laboral, Gaceta Judicial CLVIII, parte 2,
  n.º 2399 (1978), sobre la base promedio semestral en el caso examinado de
  salario variable: [publicación oficial](https://cortesuprema.gov.co/corte/wp-content/uploads/subpage/GJ/Gaceta%20Judicial/GJ%20CLVIII%20Parte%202%20n.%202399%20%281978%29.pdf).
- Corte Suprema de Justicia, Sala Laboral, sentencia SCL 6506 de 1994: para el
  salario variable por comisiones, la base de la prima legal se determina con
  el promedio del semestre respectivo; [texto en el Normograma de
  Colpensiones](https://normativa.colpensiones.gov.co/colpens/docs/csj_scl_6506_1994.htm).
- Corte Suprema de Justicia, Gaceta Judicial CXXXV, n.º 2330–2332 (1970),
  describe el pago de junio y diciembre como correspondiente a los semestres
  de calendario; [publicación oficial](https://cortesuprema.gov.co/corte/wp-content/uploads/subpage/GJ/Gaceta%20Judicial/GJ%20CXXXV%20n.%202330-2332%20%281970%29.pdf).
- Corte Suprema de Justicia, sentencia SL4089-2022, cita para un grupo sujeto
  a un acuerdo particular factores de prima de Navidad causados entre el 1 de
  julio y el 30 de noviembre. Ese texto no establece una regla general para
  todos los trabajadores privados bajo el artículo 306; [sentencia oficial](https://www.cortesuprema.gov.co/corte/wp-content/uploads/relatorias/la/bdic2022/SL4089-2022.pdf).
