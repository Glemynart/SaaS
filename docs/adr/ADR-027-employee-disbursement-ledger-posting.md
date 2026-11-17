# ADR-027 — Contabilización de desembolsos verificados a empleados

- **Estado:** Propuesta pendiente de decisión de Contabilidad / Producto / Nómina.
- **Fecha:** 2026-11-17.
- **Goal:** GOAL-02 — Evolución Financiera y Cumplimiento Electrónico.
- **Dependencia:** la entidad `EmployeeDisbursement` y la verificación de soportes están en el PR #394; ese PR sigue abierto y esta propuesta no implica que la capacidad esté desplegada.

## Contexto comprobado

- El PR #394 separa declaración, soporte, verificación administrativa y reverso
  de cobertura salarial. `VERIFIED` significa que una persona revisó evidencia;
  no confirma una transferencia bancaria.
- Nómina ya crea un comprobante de causación por `PayrollPeriod` en la misma
  transacción que cambia el período a `CAUSADA`. El origen es
  `(PAYROLL, periodoId, CAUSACION)`. La línea `SALARIOS_POR_PAGAR` acredita el
  neto por tercero empleado y centro de costo. El mapper agrupa líneas por
  cuenta, tercero, centro de costo y descripción.
- `Liquidation` tiene conceptos con código y valor, pero el código actual no
  crea un comprobante de causación para la liquidación ni resuelve una cuenta
  por concepto.
- Recaudos de clientes son un precedente técnico, no una regla para pagos a
  empleados: requieren período abierto para la fecha del recaudo, seleccionan
  roles `CAJA_GENERAL` o `BANCO_PRINCIPAL`, y registran el comprobante Ledger
  y AuditLog dentro de la transacción.
- `EmployeeDisbursement` admite `BANK_TRANSFER`, `CASH`, `CHECK` y `OTHER`, pero
  el registro no identifica una cuenta de salida ni define tipo de comprobante.
  El reverso actual guarda importe y texto libre; no declara si el dinero
  regresó o si solo se corrigió evidencia.
- ADR-001 define eventos de origen estables e idempotentes y separa `CAUSACION`
  de `PAGO`. ADR-002 asigna el pago a Treasury y la causación a Accounting.
- **Divergencia documental corregida localmente:** ADR-002 §11 se actualiza en
  revisión 4 para indicar que el mapper conserva tercero y centro de costo
  cuando existen y agrupa según esas dimensiones. La revisión local aún no se ha
  publicado.

## Catálogo contable verificado en el código

La plantilla C0 y `DEFAULT_SYSTEM_ACCOUNT_MAPPINGS` contienen estos roles y
códigos. Su existencia en la plantilla es un hecho del repositorio; no aprueba
por sí sola su uso para desembolsos ni demuestra que cada tenant tenga una
cuenta bancaria conciliada:

| Uso actual o candidato           | Rol / cuenta                              | Código C0 | Evidencia y límite                                                                                                        |
| -------------------------------- | ----------------------------------------- | --------: | ------------------------------------------------------------------------------------------------------------------------- |
| Efectivo                         | `CAJA_GENERAL`                            |  `110505` | Mapeo de tesorería existente. No hay selección de caja por desembolso.                                                    |
| Banco                            | `BANCO_PRINCIPAL`                         |  `111005` | Mapeo existente a Bancos moneda nacional. No identifica la cuenta bancaria concreta de origen.                            |
| Pasivo neto de nómina            | `SALARIOS_POR_PAGAR`                      |  `250505` | La causación vigente lo acredita por tercero empleado; su uso para debitar pagos es candidato pendiente de aprobación.    |
| Cesantías por pagar              | `PROVISION_CESANTIAS_POR_PAGAR`           |  `261005` | Rol usado por la causación de provisiones de nómina. No está asociado hoy a conceptos de `Liquidation`.                   |
| Intereses de cesantías por pagar | `PROVISION_INTERESES_CESANTIAS_POR_PAGAR` |  `261010` | Mismo límite: existe en la causación de nómina, falta mapeo aprobado de finiquito.                                        |
| Vacaciones por pagar             | `PROVISION_VACACIONES_POR_PAGAR`          |  `261015` | Mismo límite.                                                                                                             |
| Prima por pagar                  | `PROVISION_PRIMA_POR_PAGAR`               |  `261020` | Mismo límite.                                                                                                             |
| Gasto de sueldos                 | `GASTO_SUELDOS`                           |  `510506` | Usado por el mapper de causación de nómina.                                                                               |
| Gasto de cesantías               | `GASTO_PROVISION_CESANTIAS`               |  `510530` | Usado por el mapper de provisiones de nómina.                                                                             |
| Gasto de intereses de cesantías  | `GASTO_PROVISION_INTERESES_CESANTIAS`     |  `510533` | Usado por el mapper de provisiones de nómina.                                                                             |
| Gasto de prima                   | `GASTO_PROVISION_PRIMA`                   |  `510536` | Usado por el mapper de provisiones de nómina.                                                                             |
| Gasto de vacaciones              | `GASTO_PROVISION_VACACIONES`              |  `510539` | Usado por el mapper de provisiones de nómina.                                                                             |
| Anticipo tributario              | `ANTICIPO_RETEFUENTE`                     |  `135515` | **No** es anticipo al empleado; el nombre C0 es Retención en la fuente (anticipo). No debe mapearse a pagos de empleados. |
| Comprobante genérico de ajuste   | tipo `AJ`                                 |      `AJ` | Existe en C0 como “Comprobante de ajuste”; no está aprobado como tipo para pago o reverso de desembolso.                  |

No se encontró un rol de cuenta para anticipos a empleados, ni un campo que
vincule cada desembolso con una cuenta concreta de caja/banco. Tampoco existe
una causación contable del agregado `Liquidation` (finiquito): tiene conceptos
y valores, pero el código no resuelve cuentas por concepto ni crea el
comprobante de causación. Por tanto, no se deben completar esos vacíos con
`135515`, `AJ` o una cuenta elegida por el método de pago.

## Matriz funcional y ejemplos aritméticos (sin autorización de posteo)

Los importes de esta tabla son una ilustración matemática de saldo, no una
política contable ni una instrucción ejecutable. Los asientos candidatos
permanecen pendientes de aprobación de Contabilidad. La causación de nómina
existente usa sus mappers y las cuentas de la tabla anterior; no debe duplicarse
al contabilizar un desembolso. Para las filas de pagos y reversos, se supone
que los importes citados fueron registrados y verificados, y que los reversos
reducen la cobertura conforme al comportamiento actual; no se afirma que los
fondos se hayan liquidado o devuelto realmente.

| Evento / ejemplo                                              | Hecho que queda registrado                                                                                                                   | Cuenta/asiento candidato                                                                                                                                                                                                                              | Fecha y período                                                                                                                                                 | Auditoría / reverso                                                                                                                     |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Causación de nómina por COP 1.000.000 netos                   | El período `CAUSADA` tiene un comprobante `CAUSACION` de Payroll; el ejemplo es solo el componente neto por pagar.                           | El mapper vigente acredita `SALARIOS_POR_PAGAR` (`250505`) por tercero empleado. El débito total de causación incluye devengos, aportes y provisiones según Payroll; no se puede inferir del neto aislado.                                            | Fecha y período del comprobante de causación ya creado.                                                                                                         | AuditLog de la operación fuente y origen idempotente `PAYROLL / periodoId / CAUSACION`. No crear otro comprobante al registrar el pago. |
| Desembolso completo por COP 1.000.000                         | Solo tras adjuntar soporte y verificación administrativa; `VERIFIED` no confirma liquidación bancaria.                                       | Candidato: débito `SALARIOS_POR_PAGAR` (`250505`) y crédito a la cuenta real de fondos. No se postea hasta decidir banco/caja y tipo de comprobante.                                                                                                  | `paidAt` es la fecha declarada; si su período está cerrado, bloquear hasta regla de regularización aprobada. `verifiedAt` no sustituye la fecha del movimiento. | Origen candidato `EMPLOYEE_DISBURSEMENT / disbursementId / PAGO`; reverso contable solo si se confirma retorno de fondos.               |
| Primer desembolso parcial por COP 400.000 sobre COP 1.000.000 | Saldo aritmético no cubierto: COP 600.000.                                                                                                   | Mismo asiento candidato por COP 400.000; pendiente aprobación.                                                                                                                                                                                        | `paidAt`, sujeto a período abierto y a la decisión de fecha.                                                                                                    | Una operación idempotente por desembolso; no tocar el comprobante de causación.                                                         |
| Segundo desembolso por COP 350.000                            | Total declarado/verificado COP 750.000; saldo aritmético no cubierto COP 250.000.                                                            | Mismo asiento candidato por COP 350.000; no exceder saldo pendiente.                                                                                                                                                                                  | Igual regla; la fecha propia de cada pago.                                                                                                                      | Segundo origen distinto para el segundo desembolso. Los dos comprobantes no se consolidan sobrescribiendo el primero.                   |
| Reverso parcial de COP 100.000 del primer pago                | Cobertura aritmética neta pasa de COP 750.000 a COP 650.000; saldo no cubierto pasa a COP 350.000.                                           | No hay asiento autorizado. Si hubo devolución efectiva, el candidato compensa el importe contra las mismas cuentas del pago original; si solo se corrige el soporte, no debe afirmar devolución de dinero. El esquema actual no distingue esos casos. | Período abierto autorizado para el reverso; no modificar el original ni reabrir el período.                                                                     | Evento de reverso idempotente relacionado con el comprobante original; decisión pendiente sobre evidencia y aprobación.                 |
| Reverso total de los COP 350.000 del segundo pago             | Tras reversar íntegramente el segundo pago y mantener el reverso parcial anterior, cobertura neta aritmética COP 300.000; saldo COP 700.000. | No hay asiento autorizado; compensatorio candidato por COP 350.000 solo si retornaron los fondos.                                                                                                                                                     | Igual regla del reverso parcial.                                                                                                                                | Append-only y enlazado al pago original; el estado histórico queda preservado.                                                          |
| Pago declarado el 31-oct y verificado el 02-nov               | La fecha de evidencia y la fecha de revisión son distintas; verificar después no cambia el día real declarado.                               | No generar asiento por la mera verificación. Si octubre está cerrado, no postear automáticamente en noviembre ni alterar octubre.                                                                                                                     | `paidAt` candidato para fecha contable; `verifiedAt` solo fecha de control. Una regularización en período abierto requiere política aprobada.                   | Conservar ambas fechas. AuditLog registra la verificación; no constituye confirmación bancaria.                                         |

La cuenta de salida debe seleccionarse o mapearse por configuración tenant-scoped
aprobada, no derivarse de `BANK_TRANSFER`, `CASH`, `CHECK` o `OTHER`. La
distinción entre `FUNDS_RETURNED` y `EVIDENCE_CORRECTION`, el tipo documental,
la fecha de un ajuste tardío y la segregación de funciones siguen siendo
decisiones contables/operativas pendientes.

## Evidencia técnica para concurrencia

El servicio de desembolsos usa una transacción tenant-aware y bloquea la
obligación fuente antes de volver a leerla y calcular el saldo. PostgreSQL 17
documenta que `SELECT ... FOR UPDATE` mantiene el bloqueo de fila hasta el fin
de la transacción y que el segundo solicitante espera y ve la fila confirmada
actualizada bajo `READ COMMITTED`. Esto respalda el patrón, pero no sustituye
una prueba concurrente real para la futura operación de posteo Ledger. Prisma
ORM v6 permite configurar el nivel de aislamiento de una transacción
interactiva; cualquier estrategia de reintento ante conflicto/deadlock debe
repetir la transacción completa y solo para errores transitorios identificados.

Referencias oficiales: [Prisma ORM v6 — Transactions](https://www.prisma.io/docs/orm/v6/prisma-client/queries/transactions),
[PostgreSQL 17 — Explicit Locking](https://www.postgresql.org/docs/17/explicit-locking.html),
[PostgreSQL 17 — Transaction Isolation](https://www.postgresql.org/docs/17/transaction-iso.html).

## Alternativas

### A. Mantener los desembolsos fuera de Ledger

Es el estado actual del incremento de evidencia. Conserva la seguridad y no
inventa cuentas ni asientos, pero el pasivo de salarios permanece abierto en
Ledger después de que un desembolso sea verificado.

### B. Contabilizar automáticamente al verificar el soporte

No recomendada. La verificación administrativa de un documento no confirma el
movimiento bancario, y esta operación automática carecería de decisiones sobre
cuenta de salida, fecha contable, tipo de comprobante y tratamiento de
reversos.

### C. Verificar y contabilizar como acciones separadas

Recomendada como arquitectura del siguiente incremento. La verificación sigue
significando revisión de evidencia. Una acción explícita de contabilización
crea el comprobante balanceado solo después de validar obligación, cuentas,
fecha y período; se registra su resultado sin cambiar el significado de
`VERIFIED` ni afirmar confirmación bancaria.

## Dirección propuesta

1. **Alcance inicial: obligaciones de nómina ya causadas.** Exigir un
   `PayrollPeriod` en `CAUSADA` con comprobante vigente de
   `(PAYROLL, periodoId, CAUSACION)`. La liquidación definitiva queda fuera hasta
   que exista una causación de sus conceptos o Accounting apruebe una regla
   explícita para reconocerlos.
2. **Asiento candidato para nómina.** Por cada desembolso contabilizado, débito
   a la cuenta aprobada de salarios por pagar, conservando el tercero empleado
   y el centro de costo disponible; crédito a la cuenta de caja/banco que
   corresponda al origen real de los fondos. El importe no excede la obligación
   neta pendiente. No se deriva la cuenta únicamente del texto del método.
3. **Cuentas y métodos.** Usar una cuenta de salida seleccionada o una
   configuración tenant-scoped aprobada por Contabilidad. `CHECK` solo puede
   contabilizarse con la cuenta bancaria efectiva identificada; `OTHER` queda
   bloqueado hasta que tenga una clasificación y mapeo aprobados. No asumir que
   los defaults usados para recaudos aplican a desembolsos.
4. **Tipo de comprobante.** El código y la configuración del tipo de comprobante
   quedan pendientes de Contabilidad. `origenEvento = PAGO` es consistente con
   ADR-001, pero no sustituye la decisión del tipo documental.
5. **Fecha y período.** Propuesta: conservar `paidAt` como fecha efectiva
   declarada y usarla como fecha del asiento; `verifiedAt` permanece como fecha
   de revisión. Si no hay exactamente un período abierto que contenga `paidAt`,
   la contabilización se bloquea. No reabrir ni alterar períodos cerrados; una
   regularización posterior requeriría un proceso contable aprobado y una fecha
   autorizada.
6. **Idempotencia y atomicidad.** Registrar el pago con origen único
   `(tenant, EMPLOYEE_DISBURSEMENT, disbursementId, PAGO)`. La comprobación de
   saldo, creación del comprobante, vínculo/estado visible del desembolso y
   AuditLog deben quedar en una transacción tenant-scoped. Un retry debe
   recuperar el comprobante existente solo si el origen y el contenido
   coinciden; ante una diferencia, fallar con conflicto. Reutilizar el bloqueo
   de obligación de la operación financiera existente para serializar pagos
   concurrentes.
7. **Estado de evidencia y estado contable separados.** Un pago puede estar
   verificado y pendiente de contabilizar. No cambiar `VERIFIED` a “pagado en
   Ledger”; exponer el comprobante y el resultado contable por separado. Un
   fallo contable no borra ni desverifica evidencia válida.
8. **Reversos.** No generar un reverso de Ledger desde el texto libre actual.
   Propuesta: distinguir al menos `FUNDS_RETURNED` (movimiento de fondos
   confirmado con soporte, que requiere reverso contable) y
   `EVIDENCE_CORRECTION` (corrige la cobertura documental, sin afirmar que el
   dinero regresó). Cada efecto contable debe usar un evento de origen de
   reverso distinto e idempotente en un período permitido. Contabilidad debe
   decidir la cuenta y el flujo de anulación antes de implementar.
9. **Liquidaciones.** No contabilizar el pago de una liquidación contra gasto
   por defecto. La propuesta es separar una causación por conceptos, mapeando
   cada código a su pasivo contable, y luego aplicar pagos contra esos pasivos.
   Hasta que se aprueben esos mapeos y las reglas de fecha/período, las
   liquidaciones conservan desembolsos de evidencia sin posteo automático.
10. **Sin integración bancaria.** Un comprobante Ledger acredita el registro
    contable interno; tampoco acredita por sí mismo que un banco liquidó la
    transferencia. Conciliación bancaria e integración de dispersión siguen
    fuera de alcance.

## Decisiones que debe confirmar Contabilidad / Producto / Nómina

1. ¿Se aprueba la alternativa C y el alcance inicial limitado a períodos de
   nómina ya causados?
2. ¿La cuenta de salida se selecciona en cada desembolso o se toma de un mapeo
   tenant-scoped? ¿Qué cuentas y tipos de comprobante corresponden a
   transferencia, efectivo y cheque? ¿Se mantiene bloqueado `OTHER`?
3. ¿`paidAt` es la fecha contable? Si su período está cerrado, ¿se bloquea
   hasta una regularización autorizada, o se registra en un período abierto con
   una fecha de ajuste distinta?
4. ¿Qué conceptos de liquidación generan pasivo, en qué cuentas se mapean y en
   qué transición se causan?
5. ¿Qué evidencia y autorización distinguen un retorno efectivo de fondos de
   una corrección de soporte? ¿Qué asiento corresponde a cada uno?
6. ¿La contabilización requiere un actor distinto de quien registró/verificó
   el desembolso? El RBAC actual no impone doble aprobación.

## Criterios de aceptación del siguiente incremento

- Ningún desembolso se contabiliza al adjuntar o verificar soporte.
- No se contabiliza nómina sin causación activa, saldo pendiente, cuentas y
  período válidos.
- Pagos parciales repetidos no exceden ni reducen dos veces la obligación.
- Dos requests concurrentes producen un solo origen `PAGO` y saldo coherente.
- Una transacción fallida no deja comprobante parcial, vínculo falso ni evento
  de auditoría separado.
- Un período cerrado nunca se modifica ni reabre implícitamente.
- No hay movimiento contable derivado de `OTHER` o de un reverso ambiguo.
- La prueba PostgreSQL real cubre reintentos, concurrencia, cierre, rollback,
  idempotencia, RLS y atomicidad de AuditLog.
- La UI distingue evidencia revisada, registro contable y estado bancario.

## Límite de esta propuesta

Este documento no aprueba cuentas, fechas, asientos, cambios de esquema ni
implementación. Hasta que las decisiones anteriores se validen, ADR-026
mantiene el desembolso fuera de Ledger y las obligaciones de liquidación fuera
de esta integración.
