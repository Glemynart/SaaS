# Matriz preliminar de conceptos para nómina electrónica (DSNE)

**Estado:** preanálisis técnico; no es una matriz normativa ni laboral aprobada.
**Revisión:** 2026-11-08 · **Alcance:** dependientes estándar que ya soporte Payroll.
**Decisión de frontera:** [ADR-021](../adr/ADR-021-electronic-payroll-document.md).

Esta matriz compara el catálogo y los datos que existen hoy en `main` con los
campos del Anexo Técnico DIAN 1.0. “Candidato” identifica similitud estructural;
no autoriza transmitir ni confirma un tratamiento laboral o tributario. Un
concepto sin regla verificable debe bloquear la preparación del DSNE.

## Hechos que delimitan el mapeo

- La norma organiza el DSNE por beneficiario y mes del pago o abono en cuenta;
  un período interno de Payroll no equivale automáticamente a un documento
  mensual. La fuente es el snapshot aprobado y el documento debe acreditar el
  valor devengado, el deducido y su diferencia.
- El código interno clasifica conceptos como `EARNING`, `DEDUCTION`,
  `EMPLOYER_CONTRIBUTION` y `PROVISION`. Su catálogo contiene salario base,
  bonificaciones, horas extra, auxilio de transporte, deducciones de salud,
  pensión y FSP, aportes patronales y provisiones.
- El calculador acumula `BONUS` y `OVERTIME` como valores, sin separar su
  naturaleza salarial ni las clases de hora extra. El enum de novedades también
  incluye vacaciones, enfermedad, licencia y otras; las filas guardan tipo,
  descripción, fecha y valor, y esos tipos no son conceptos que el calculador
  traduzca a devengos.
- `PayrollSnapshot.payload` congela período, conceptos y novedades; en su bloque
  de empleado conserva el ID, salario usado, salario integral y días de nómina,
  pero no una identidad legal completa. Tampoco contiene fecha efectiva ni
  medio de pago/abono. `fechaPrevistaPagoPila` es una fecha prevista de PILA y no
  prueba ese hecho.
- `PayrollService` sí registra una causación contable para un período aprobado:
  el comprobante `PAYROLL/CAUSACION` lleva `PayrollPeriod.fechaFin` como fecha y
  acredita `SALARIOS_POR_PAGAR` por beneficiario. El estado cambia a `CAUSADA`,
  pero no hay estado `PAGADA` ni se registra allí una fecha/medio de desembolso.
  La causación es un posible rastro del reconocimiento contable; este preanálisis
  no determina que sea el abono en cuenta tributario ni que `fechaFin` sea la
  fecha correcta para DSNE. Debe resolverlo Contabilidad/Tributario por caso.

## Cruce preliminar

| Concepto/campo actual | Campo o familia del Anexo Técnico (candidato) | Evaluación frente al código | Estado para DSNE |
| --- | --- | --- | --- |
| `SALARIO_BASE` (`EARNING`) | `Devengados/Basico`: `SueldoTrabajado`, `DiasTrabajados` | El snapshot guarda importe y días; debe probarse que la base y el período corresponden al mes demostrable del pago/abono. | Candidato; falta revisión de nómina y evidencia del hecho. |
| `AUX_TRANSP` (`EARNING`) | `Devengados/Transporte`: `AuxilioTransporte` | Hay importe calculado. El uso fiscal, la naturaleza y el valor reportado deben contrastarse con el pago/abono documentado. | Candidato; no aprobado. |
| `BONUS` (`EARNING`) | `Devengados/Bonificaciones/Bonificacion`: `BonificacionS` o `BonificacionNS` | Payroll solo conserva el código y valor de bonificación. No indica si es salarial o no salarial, ni sus características suficientes para decidirlo. | Bloqueado hasta clasificar cada concepto; no inferir `S`/`NS`. |
| `OVERTIME` (`EARNING`) | Familias de horas extra/recargos, p. ej. `HED`; cada clase tiene importe, cantidad y porcentaje | El cálculo suma valores de horas extra en una única línea. No preserva tipo, horas ni porcentaje; la hora inicial/final es opcional para HED según el anexo, pero cantidad y porcentaje están definidos como requeridos. | Bloqueado; conservar agregación implica perder la desagregación del anexo. |
| `SALUD_EMP` (`DEDUCTION`) | `Deducciones/Salud`: porcentaje y deducción | Se conservan importe calculado y base/tarifa en el concepto. Falta validar el caso contra el importe efectivamente deducido y el mes del pago/abono. | Candidato; requiere revisión y casos. |
| `PENSION_EMP` (`DEDUCTION`) | `Deducciones/FondoPension`: porcentaje y deducción | Se conservan importe calculado y base/tarifa en el concepto; no queda probado por sí solo el descuento efectivamente aplicado al beneficiario. | Candidato; requiere revisión y casos. |
| `FSP` (`DEDUCTION`) | `Deducciones/FondoSP`: `DeduccionSP` y `DeduccionSub`, con porcentajes separados | El cálculo produce una sola línea y una sola tarifa por tramo. El anexo separa solidaridad y subsistencia; no se puede reconstruir una división segura desde el total. | Bloqueado hasta preservar y verificar ambos componentes. |
| `SALUD_PAT`, `PENSION_PAT`, `ARL`, `CAJA`, `ICBF`, `SENA` (`EMPLOYER_CONTRIBUTION`) | Sin mapeo directo a una deducción del beneficiario | Son aportes patronales calculados en Payroll, no descuentos del neto del trabajador. Su interacción contable/tributaria debe revisarse por separado. | No incluir como deducciones del trabajador. |
| `PROV_PRIMA`, `PROV_CESANTIAS`, `PROV_INT_CESANTIAS`, `PROV_VACACIONES` (`PROVISION`) | Sin mapeo automático por el solo hecho de provisionar | La provisión mensual contabiliza una estimación; no prueba que el importe haya sido pagado o abonado en cuenta en el mes DSNE. | Excluir como devengo DSNE por defecto; evaluar el hecho fuente por separado. |
| Novedades `VACATION`, `SICKNESS`, `LICENSE`, `OTHER` | Familias de vacaciones, incapacidades/licencias u otros conceptos, según el caso | La fila actual tiene tipo genérico, descripción, una fecha y valor; no tiene una clasificación laboral detallada ni los datos estructurados y cálculos revisados para todas esas familias. El calculador no las transforma en conceptos. | Bloqueado cuando incidan en el mes hasta definir y aprobar regla/datos. |

Los nombres de campo en la segunda columna son referencias para estudiar el
Anexo Técnico vigente; no son un mapeo de producción. La documentación DIAN
recuerda usar el orden y esquema oficial y no inventar elementos.

## Dependencias antes de declarar una fila compatible

1. Responsable de nómina/laboral aprueba la naturaleza de cada código y la
   relación entre novedad, concepto, período laboral y valor pagado/abonado.
2. Contabilidad/Tributario identifica y aprueba la fuente y fecha del primer
   pago o abono en cuenta, como exige la regla fiscal aplicable al caso. El
   comprobante `PAYROLL/CAUSACION` puede evaluarse como evidencia de un abono
   contable, pero su fecha automática (`fechaFin`) no se acepta por defecto. El
   medio de pago y cualquier desembolso posterior deben tener evidencia propia,
   tenant-scoped y auditable; `fechaPrevistaPagoPila` no satisface el requisito.
3. El snapshot regulatorio incluye identidad completa e histórica del emisor y
   del beneficiario, y los valores/conceptos que corresponden a ese hecho, sin
   leer después datos actuales para completar un documento pasado.
4. El mapeo es versionado por versión normativa y del formato, y detiene la
   generación ante concepto o novedad sin clasificar. La salida conserva el
   desglose solicitado por el anexo sin recomponerlo a partir de totales.
5. Un proveedor y su sandbox pasan pruebas de habilitación y transmisión DIAN.
   La validación técnica del archivo, transmisión, aceptación DIAN, liquidación
   y pago deben permanecer como estados distintos.

## Casos de revisión y resultado esperado

Los resultados esperados aquí son **invariantes**, no importes laborales
aprobados. Nómina debe completar y firmar los importes exactos antes de usarlos
como pruebas regulatorias.

| Caso | Resultado esperado para aceptar la matriz |
| --- | --- |
| Nómina estándar mensual, con un snapshot aprobado | Un beneficiario y un mes; devengos, deducciones y diferencia cuadran con los snapshots y la evidencia de pago/abono; identidad y formato pasan sus validaciones. |
| Dos pagos dentro del mismo mes | Consolidación individual por beneficiario sin duplicar conceptos; períodos no se cruzan ni traslapan y el mes de cada hecho está probado. |
| Período que cruza meses, se traslapa o tiene snapshot sin aprobar | Bloqueo explícito; no asignar por nombre del período ni por `fechaPrevistaPagoPila`. |
| Período `CAUSADA`, sin comprobante de desembolso | No afirmar que fue pagado. El comprobante de causación puede usarse como abono en cuenta solo si Contabilidad/Tributario aprueba que el reconocimiento y la fecha representan el hecho fiscal para esos conceptos; de lo contrario bloquear. |
| Bonificación salarial frente a no salarial | Cada caso produce el campo que el responsable aprueba; un `BONUS` sin clasificación se rechaza. |
| Horas extra de clases distintas | Cantidad, porcentaje, tipo y pago quedan conservados por clase; un `OVERTIME` agregado se rechaza. |
| Aporte FSP con solidaridad y subsistencia | Los dos importes y porcentajes se verifican por separado; un total único no se divide por inferencia. |
| Vacaciones, incapacidad y licencias | Cada subtipo incluye períodos, días, valor y regla laboral aprobada; un tipo genérico no se transmite. |
| Ajuste después de aceptación DIAN | Se conserva el DSNE original y el ajuste se enlaza con su CUNE según la regla técnica validada. |
| Caída/red ambigua durante transmisión | Se conserva el intento; el resultado no se supone rechazado ni se reenvía a ciegas. |

## Fuentes y evidencia

### Fuentes oficiales vigentes consultadas el 2026-11-08

- [Resolución 227 de 2025, Normograma DIAN](https://normograma.dian.gov.co/dian/compilacion/docs/resolucion_dian_0227_2025.htm), reglas compiladas de DSNE y anexos aplicables.
- [Oficio DIAN 904127 de 2022](https://normograma.dian.gov.co/dian/compilacion/docs/oficio_dian_904127_2022.htm): doctrina sobre incluir los conceptos al momento del pago o abono en cuenta, lo que ocurra primero; la situación concreta depende del reconocimiento y de los hechos de cada obligado.
- [Anexo Técnico DSNE 1.0, Resolución DIAN 000013 de 2021 (PDF oficial)](https://www.dian.gov.co/normatividad/Normatividad/Resoluci%C3%B3n%20000013%20de%2011-02-2021.pdf): sueldo y días, bonificaciones salariales/no salariales, horas extras, salud, pensión y componentes FSP.
- [Documentación técnica DIAN de nómina electrónica](https://micrositios.dian.gov.co/sistema-de-facturacion-electronica/documentacion-tecnica-soporte-de-pago-de-nomina-electronica/): identifica Anexo 1.0 y casos de transmisión y validación.

### Código contrastado en `main` (`67ea240`)

- `apps/api/src/payroll/calculator/payroll-types.ts`: catálogo de códigos y tipos de concepto.
- `apps/api/src/payroll/calculator/payroll-calculator.ts`: conceptos calculados, agregación de `BONUS`/`OVERTIME` y una sola tarifa FSP.
- `apps/api/src/payroll/payroll-mapper.ts`: los registros de novedad se convierten a tipo/valor, sin clasificación DSNE adicional.
- `apps/api/prisma/schema.prisma`: enum y campos de `PayrollNovelty`; `PayrollSnapshot` conserva `payload` JSON.
- `apps/api/src/payroll/payroll.service.ts`: captura de conceptos y novedades en `PayrollSnapshot.payload`; no incluye identidad legal completa ni evidencia efectiva del pago/abono.
- `apps/api/src/payroll/payroll.service.ts` y `apps/api/src/payroll/accounting/payroll-accounting.mapper.ts`: al causar, registran un comprobante `PAYROLL/CAUSACION`, lo fechan en `PayrollPeriod.fechaFin` y acreditan salarios por pagar por tercero. Esto es una causación en Ledger, no evidencia de pago bancario ni de su medio.

**Conclusión técnica:** aún no existe un subconjunto listo para transmitirse
con garantía normativa. Salario, auxilio, salud y pensión son candidatos para
revisión; bonificaciones, horas extra, FSP y novedades están bloqueados por
datos que hoy no se conservan o reglas que faltan. La causación actual en
Ledger no basta por sí sola para confirmar el mes del abono ni el medio de pago.
Esta matriz prepara la revisión; no habilita implementación ni publicidad de
compatibilidad.
