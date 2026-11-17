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
- **Divergencia documental:** ADR-002 §11 afirma que salarios por pagar se
  agregan por período y no requieren tercero. El mapper vigente sí conserva el
  tercero empleado y centro de costo disponibles. Actualizar esa afirmación en
  la documentación de Payroll antes de integrar el diseño.

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
