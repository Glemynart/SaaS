# Nómina de ingreso durante un mes calendario

Fecha de revisión: 2026-11-05

## Evidencia normativa consultada

- La [Resolución 5858 de 2016, numeral 22 del Anexo Técnico 2](https://normativa.colpensiones.gov.co/colpens/compilacion/docs/resolucion_minsaludps_5858_2016.htm)
  dispone que para liquidar aportes PILA los meses se consideran de 30 días y
  exige reportar la fecha real de la novedad. Sus ejemplos asignan 3 días a un
  ING del 28 de febrero de 2017, 2 días al ING del 29 de febrero de 2016 y 1
  día al ING del 30 o 31 de marzo.
- El [Concepto 322391 de 2021 de Función Pública](https://www1.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=173389)
  cita el mes laboral de 30 días y el ejemplo de un empleado que empieza el 19
  de febrero y recibe 12/30 partes de su sueldo mensual hasta fin de mes.
- La [Ley 15 de 1959 y el artículo 5 del Decreto 1258 de 1959](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=274217)
  describen el auxilio de transporte como ligado a los días en que se presta
  el servicio y a los desplazamientos requeridos.

## Hechos del código

- `PayrollPeriod` acepta fechas explícitas y el servicio no impone hoy que cada
  período sea un mes calendario completo.
- El cálculo ordinario utiliza `Empleado.salario` como salario mensual,
  calcula conceptos y prestaciones desde ese valor y congela ese salario en
  `PayrollRun.salarioBaseSnapshot`.
- PILA mantiene preflight propio. El snapshot de empleados con fecha de ingreso
  posterior al inicio del período no acredita cobertura completa; esta mejora
  no genera ni habilita archivos PILA para ingresos parciales.
- Los datos de asistencia, modalidad de trabajo y desplazamientos diarios no
  están modelados por Payroll.

## Alcance implementado en el incremento

- Solo para salario ordinario, una sola fecha de ingreso dentro de un período
  que cubre el mes calendario completo y un único contrato vigente que empieza
  en esa fecha y cubre el resto del mes.
- Cuenta los días con la convención 30/360 sustentada por los ejemplos
  oficiales, calcula el salario del período como `salario mensual / 30 × días`
  y conserva el salario mensual como referencia histórica.
- Prorratea los importes mensuales que ya reconoce el motor, incluido el
  auxilio cuando cumple la condición salarial existente. Esta prorrata es una
  inferencia de días de vinculación: no representa asistencia ni demuestra el
  derecho individual al auxilio para cada día.
- Congela `diasNomina` en el rastro y en el snapshot aprobado. Las correcciones
  reutilizan esos días; los snapshots históricos sin el campo se leen como
  períodos completos (30 días).
- Contratos superpuestos o insuficientes, salarios integrales, novedades de
  retiro, novedad PILA/Payroll que requiera segmentación y períodos parciales
  siguen fuera del cálculo admitido o bloqueados por sus guardas existentes.
- No requiere migración de base de datos. Los snapshots son JSON versionado y
  los datos históricos no se reescriben.

## Inferencias y límites

- Aplicar el divisor 30 al salario desde la fecha de ingreso se apoya en la
  convención laboral y en el ejemplo de 12/30 partes, pero la fórmula concreta
  del producto es una inferencia que debe contrastarse con casos laborales
  revisados por especialistas antes de uso operativo.
- La prorrata de auxilio por días de vinculación aproxima el importe mensual.
  Sin asistencia, modalidad y desplazamientos, no permite resolver ausencias,
  teletrabajo, transporte suministrado ni excepciones de elegibilidad.
- El nuevo cálculo Payroll no habilita PILA parcial: faltan segmentación por
  novedad, días e IBC aprobado por subsistema, junto con la validación del
  operador.
- No se implementan ingreso y retiro en un mismo período, retiro parcial,
  cambios de salario, varios contratos, salario integral, períodos de pago
  fraccionados ni situaciones especiales de cotización.
