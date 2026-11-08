# ADR-021 — Documento soporte de pago de nómina electrónica

| Campo           | Valor                                                                    |
| --------------- | ------------------------------------------------------------------------ |
| **Estado**      | accepted bajo la delegación de Producto al Lead Engineer                 |
| **Fecha**       | 2026-11-08                                                               |
| **Decisores**   | Producto (delegación explícita) · Arquitectura · Nómina · Seguridad       |
| **Ámbito**      | H3 de GOAL-02; generación futura del DSNE para dependientes estándar      |
| **Relacionado** | GOAL-02 · ADR-002 · ADR-005 · ADR-020 · ADR-SEC-001                      |

## Contexto verificado

- La DIAN publica el documento soporte de pago de nómina electrónica (DSNE)
  como parte de la facturación electrónica. La Resolución 227 de 2025 compila
  las reglas de la Resolución 013 de 2021; a la fecha de esta revisión, sus
  artículos 1.5.3.2.1–1.5.3.2.3 y 1.5.3.3.1 siguen definiendo finalidad,
  periodicidad, obligados y contenido.
- El DSNE es soporte fiscal de costos y deducciones. No es el desprendible de
  pago ni crea el hecho económico. La DIAN exige generación y transmisión
  independiente por beneficiario, aunque los pagos se hagan en intervalos más
  cortos. Debe acumular devengos y deducciones mensualmente por beneficiario.
- El contenido exige, entre otros datos, identidad del sujeto y beneficiario,
  consecutivo interno, conceptos devengados y deducidos, diferencia, medio de
  pago, fecha/hora de generación, firma digital y datos del software/proveedor.
  El anexo técnico oficial que publica la DIAN continúa identificado como
  versión 1.0.
- La resolución también exige interacción del software con retención en la
  fuente, cuentas por pagar/cobrar, gastos y demás información contable y
  tributaria exigida por el anexo. Esta interacción no convierte la validación
  DIAN en una causación contable.
- El plazo ordinario de transmisión es dentro de los primeros diez días del
  mes siguiente al que corresponde el pago o abono en cuenta. La compilación
  contempla un plazo de hasta 48 horas después de superada una contingencia
  tecnológica, con soporte de la incidencia. El Concepto DIAN 10193 de 2026
  aclara que la transmisión tardía no impide por sí sola reconocer costos o
  deducciones si se acreditan los requisitos sustanciales; no elimina el plazo
  ordinario ni reemplaza la evidencia del pago o abono.
- En `main`, `PayrollSnapshot` congela períodos, conceptos, totales y parte de
  la evidencia de cálculo por empleado/período, pero no congela la identidad
  legal completa del empleador ni del beneficiario. `PayrollPeriod` permite
  rangos de fechas arbitrarios y solo tiene `fechaPrevistaPagoPila`, que no
  demuestra el pago o abono efectivo ni su medio. `PayrollCorrection` conserva
  intenciones/materializaciones internas, pero no representa notas de ajuste
  DIAN. No existe todavía un DSNE, una transmisión de nómina ni una prueba de
  proveedor para este flujo.

## Decisión

1. **Dominio separado.** El DSNE será un documento regulatorio de nómina dentro
   del monolito y separado de `PayrollRun`, `PayrollSnapshot`, desprendibles,
   PILA y facturación electrónica. No mutará nóminas aprobadas ni creará un
   segundo Ledger.
2. **Unidad mensual por beneficiario.** El documento inicial corresponderá a un
   tenant, un beneficiario y un mes tributario. Puede acumular varias nóminas
   aprobadas de ese beneficiario dentro del mes, sin asumir que un
   `PayrollPeriod` equivale a un DSNE. Se bloquea la generación cuando un
   período cruza el mes, hay períodos traslapados o duplicados, falta un
   snapshot aprobado, no se puede asignar el hecho al mes del pago/abono, o
   conceptos/novedades no tienen una regla versionada y verificable.
3. **Fuente de verdad y snapshot regulatorio propio.** Solo se consumen
   `PayrollSnapshot` aprobados del tenant. Al preparar el DSNE se debe congelar
   la identidad legal del emisor y del beneficiario, el período tributario,
   los conceptos mapeados, los totales, el medio y fecha del pago/abono
   declarados por una fuente autorizada, los IDs y huellas de los snapshots,
   las versiones normativa/formato y el consecutivo. No se completa un
   documento histórico leyendo después `Tenant` o `Empleado` como si fueran
   snapshots. `fechaPrevistaPagoPila` no puede usarse como fecha efectiva.
4. **Mapeo cerrado y fallo seguro.** Cada concepto Payroll se convierte a los
   conceptos y novedades admitidos por el Anexo Técnico de nómina electrónica
   mediante una tabla explícita, versionada y revisada. Un concepto, tipo de
   vínculo, dato de identidad, pago o novedad sin cobertura bloquea el
   documento completo de esa persona; no se inventan códigos ni se omiten
   valores. La primera cohorte se limita a dependientes laborales estándar que
   Payroll soporte; pensionados, vínculos legales/reglamentarios distintos y
   escenarios especiales quedan fuera hasta validación específica.
5. **Numeración y correcciones inmutables.** El consecutivo interno es
   tenant-scoped, atómico y no reutilizable. Cada documento generado conserva
   su snapshot regulatorio y evidencia. Si un documento validado por DIAN debe
   cambiarse o eliminarse, se crea una nota de ajuste que referencia su CUNE y
   conserva el original; nunca se edita ni se vuelve a numerar el documento
   transmitido. La traducción de tipos de nota y la ruta para documentos
   rechazados deben ajustarse al Anexo Técnico y a la matriz de proveedor antes
   de implementar esos casos.
6. **Transmisión durable, estados distintos.** La generación, los intentos,
   el resultado del proveedor y la validación DIAN son hechos separados. Se
   conservan estados `PENDING/UNKNOWN`, rechazo y validación confirmada, con
   intentos, transiciones y evidencia append-only, idempotencia y conciliación
   ante resultado ambiguo. Una caída del navegador no cancela el trabajo del
   servidor. Reintentos automáticos de resultado ambiguo quedan prohibidos.
7. **Interacción contable sin doble causación.** El documento debe enlazar los
   snapshots y el comprobante de nómina existente, y permitir la conciliación
   de conceptos y retenciones requeridos por la versión vigente del anexo. La
   generación o validación del DSNE no crea otro gasto, pago, recaudo ni asiento.
   La contabilización sigue ADR-001/ADR-002; un ajuste contable nace de la
   corrección financiera correspondiente, no de una respuesta DIAN.
8. **Proveedor y seguridad.** El puerto de nómina electrónica será específico
   para este documento; ADR-020 cubre facturación electrónica y no se reutiliza
   su payload como DTO de nómina. No se selecciona aún proveedor. Antes de un
   adaptador real se requiere contrato y ambiente sandbox verificados, secreto
   tenant-scoped fuera del repositorio, firma/certificados resueltos, política
   de retención y controles de observabilidad. XML, respuestas y acuses se
   almacenan privados y tenant-scoped con hash; los secretos y PII innecesaria
   no se registran en logs.

## Límites de esta decisión

- Esta ADR decide el límite del dominio y los bloqueos; no implementa
  persistencia, numeración, XML, firma, interfaz, worker ni transmisión.
- No declara que DIAN haya validado un documento, que un proveedor sea
  compatible, ni que exista un pago o abono. La validación DIAN verifica reglas
  técnicas/de contenido; la responsabilidad sustancial permanece en el
  obligado.
- No habilita automáticamente correcciones materiales de Payroll, PILA,
  tesorería, pagos, retenciones, liquidaciones ni nómina electrónica para
  pensionados o escenarios especiales.
- Antes de implementar se debe contrastar nuevamente el Anexo Técnico oficial,
  cerrar la matriz laboral de conceptos/devengos/deducciones/novedades con un
  responsable de nómina y probar resultados representativos; la aprobación de
  esta frontera no equivale a esa revisión técnica o laboral.

## Consecuencias

- La futura unidad fiscal no queda acoplada al ciclo de períodos internos ni a
  la semántica de PILA.
- Múltiples períodos de pago dentro del mes se pueden consolidar solo cuando
  las fuentes aprobadas y el mes del pago/abono sean demostrables; rangos
  ambiguos se bloquean.
- Para avanzar hacen falta un origen verificable de pago/abono y medio, una
  matriz de conceptos contra el Anexo Técnico y una prueba de contrato en
  sandbox. La infraestructura y el proveedor no se simulan como resueltos.
- La aceptación técnica por DIAN, el hecho económico, el Ledger y el pago se
  muestran como estados distintos en la interfaz futura.

## Fuentes oficiales consultadas el 2026-11-08

- [Resolución 227 de 2025, Normograma DIAN](https://normograma.dian.gov.co/dian/compilacion/docs/resolucion_dian_0227_2025.htm), en particular artículos 1.5.3.2.1–1.5.3.2.3, 1.5.3.3.1, 1.5.3.4.1.1, 1.5.3.5.1.5–1.5.3.5.1.9 y 1.5.3.6.2.
- [Documentación técnica oficial del documento soporte de nómina electrónica](https://micrositios.dian.gov.co/sistema-de-facturacion-electronica/documentacion-tecnica-soporte-de-pago-de-nomina-electronica/); la página lista la Resolución 000013 de 2021 y el Anexo Técnico.
- [Concepto DIAN 10193 de 2026](https://normograma.dian.gov.co/dian/compilacion/docs/oficio_dian_10193_2026.htm), publicado el 2026-06-04. Aclara los efectos fiscales de la transmisión extemporánea; no altera el plazo ordinario de transmisión.
