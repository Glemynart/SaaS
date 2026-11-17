# ADR-026 — Registro y verificación de desembolsos a empleados

- **Estado:** Aceptada para el primer incremento bajo la decisión explícita de Producto/Nómina del 2026-11-16; distribución de pagos parciales en días y contabilización del pago permanecen fuera de este incremento.
- **Fecha:** 2026-11-16.
- **Goal:** GOAL-02 — Evolución Financiera y Cumplimiento Electrónico.
- **Responsable:** Producto / Nómina / Contabilidad.

## Contexto

`PayrollPeriod.APROBADA` y `CAUSADA` representan revisión y causación contable,
no desembolso. La ruta histórica `POST /liquidations/:id/pay` permite una
declaración administrativa (`LiquidationStatus.PAID`) sin guardar fecha, medio,
referencia ni soporte. N2D.4 usa esos estados como proxy de días salariales
cubiertos. El producto no tiene una entidad de pago a empleados y
`CustomerReceipt` representa dinero recibido de clientes.

Producto define que un salario solo se considera cubierto cuando el desembolso
se registra y un usuario autorizado revisa y verifica evidencia. Aprobación,
causación, declaración manual y archivo aún no revisado no son cobertura.

## Decisión

1. Crear un agregado tenant-scoped `EmployeeDisbursement` para pagos parciales
   a partir de una obligación congelada de `PayrollRun.netoPagar` o
   `Liquidation.totalLiquidacion`. El beneficiario se deriva de la obligación;
   la API no acepta un empleado independiente. El monto usa `Decimal`, moneda
   `COP`, fecha de desembolso, medio, referencia opcional, clave de idempotencia,
   autor registrador y metadatos de un soporte privado.
2. Los estados son `DECLARED`, `SUPPORTED`, `VERIFIED` y `CANCELLED`. Crear
   siempre declara; adjuntar un soporte validado avanza a `SUPPORTED`; una
   acción explícita de ADMIN, con soporte existente, registra `VERIFIED`, actor
   y fecha. Una fecha de desembolso futura en `America/Bogota` no se puede
   verificar como pago realizado. Ninguna operación de registro cambia
   automáticamente a verificado.
   Los datos del desembolso no se editan después de declarados; un error se
   cancela antes de verificar y se crea otro registro.
3. Los pagos parciales y múltiples se acumulan por obligación. La cobertura
   monetaria es `SUM(VERIFIED) - SUM(reversals)`; los estados no verificados
   reservan saldo para impedir declarar más de la obligación. El saldo
   pendiente nunca es negativo. La base de datos y el servicio fijan moneda COP,
   importe positivo, relación tenant/beneficiario y fuente única.
4. Un reverso parcial o total crea un registro independiente enlazado al pago
   verificado. Su importe no puede exceder el saldo no reversado; la unicidad de
   la clave de idempotencia y el lock de obligación serializan reintentos y
   concurrencia. No se edita ni elimina el desembolso original. Una liquidación
   no se puede anular mientras conserve desembolsos verificados asociados;
   deben reversarse primero. A la inversa, un reverso de nómina se bloquea
   mientras una liquidación activa haya usado esa cobertura; se anula primero
   la liquidación para preservar su snapshot y luego se registra el reverso.
5. Los estados y hechos se auditan en la misma transacción tenant-scoped que
   los cambios. La tabla tiene RLS habilitado y forzado; sus políticas consumen
   `audit_private.current_tenant_id()` del contexto firmado y nunca confían por
   sí solas en `app.current_tenant_id`, que es un GUC modificable por el rol SQL.
   La migración de desembolsos debe ejecutarse después de la migración que
   instala ese helper. Los soportes se guardan
   bajo un prefijo privado derivado del tenant y del desembolso; nunca se
   devuelve una URL pública. Si una transacción falla después de subir el
   archivo, el servicio bloquea y consulta la referencia persistida antes de
   compensar la carga para esperar una transacción concurrente en curso. Si la
   base no permite confirmar el resultado del commit, conserva el archivo para
   no romper una referencia que pudo haberse confirmado; ese caso puede dejar
   un objeto huérfano que debe resolverse mediante reconciliación.
6. N2D.4 deja de interpretar estados de nómina como pago. Sin desembolsos
   verificados, cuenta los días comerciales trabajados como pendientes. Si el
   pago verificado cubre exactamente el `netoPagar` de la ejecución del mes de
   retiro, cuenta cero días pendientes. Una cobertura verificada parcial no se
   convierte en días mediante una proporción: la creación de la liquidación
   falla cerrada con un conflicto accionable hasta resolver esa cobertura.
   Pagos declarados o soportados que aún no fueron verificados aportan cero a
   la cobertura.
7. `VERIFIED` significa evidencia revisada por una persona; no implica
   confirmación bancaria automática. Este incremento no crea un comprobante
   Ledger. La contabilización del pago se mantiene como una operación separada:
   nómina ya causa `SALARIOS_POR_PAGAR`, pero la liquidación no tiene un asiento
   previo por concepto ni una regla aprobada para clasificar el abono. No se
   cambiará el Ledger para evitar crear una imputación contable no aprobada o
   duplicar la causación existente.
8. Se conserva la ruta histórica `/liquidations/:id/pay` y su estado `PAID` por
   compatibilidad. Sus metadatos siguen identificándolo como una declaración
   manual no verificada; nunca aporta cobertura salarial.

## Límites y decisiones pendientes

- No hay regla laboral aprobada para distribuir un pago parcial entre días del
  período de retiro. El flujo no convierte dinero a días y no genera una
  liquidación cuando queda un saldo verificado parcial en el `PayrollRun`.
- No se implementa integración con bancos, dispersión, conciliación ni
  contabilización del desembolso. Para Ledger, Contabilidad debe definir la
  cuenta de salida, asiento para cada concepto de liquidación, fecha contable y
  tratamiento cuando el período del desembolso está cerrado.
- La interfaz de desembolsos en la rama de implementación cubre obligaciones de
  nómina/liquidación, soporte privado, cola de revisión, historial y reversos.
  Su disponibilidad a clientes requiere integrar y desplegar la rama; esta
  implementación local no se declara publicada.
- La verificación no requiere que `verifiedByUserId` sea diferente del
  registrador: el sistema exige una acción explícita y un permiso de ADMIN,
  pero no inventa una política de doble firma para tenants con un solo
  administrador.

## Consecuencias

- La declaración administrativa histórica no se interpreta como transferencia.
- El saldo y la cobertura pueden reconstruirse a partir de pagos verificados y
  reversos append-only.
- Los pagos pendientes de verificación no reducen la obligación.
- Un pago parcial de nómina impide calcular N2D.4 hasta saldar o reversar el
  saldo; no se estima su equivalente en días.
- Ledger puede mostrar un pasivo aún abierto después de que se verifique un
  desembolso, hasta que se defina y ejecute la contabilización de tesorería.

## Procedimiento de diagnóstico de soportes

El endpoint administrativo de reconciliación es exclusivamente diagnóstico:

1. Ejecutar el diagnóstico con un ADMIN en el tenant afectado y conservar la
   huella, el resumen de hallazgos y el evento de AuditLog.
2. Repetirlo antes de resolver una diferencia. Si la huella cambió, revisar el
   nuevo estado en lugar de actuar sobre el reporte anterior.
3. Para `ORPHAN_STORAGE_OBJECT`, comprobar que terminó cualquier solicitud
   ambigua y buscar la referencia exacta en los registros de desembolso y
   auditoría. No borrar el archivo desde la aplicación ni por antigüedad.
4. Para `SUPPORT_OBJECT_MISSING`, `SUPPORT_SIZE_MISMATCH` o
   `SUPPORT_HASH_MISMATCH`, conservar el registro y el objeto original
   disponible; verificación y descarga fallan cerradas. Determinar primero si
   puede recuperarse el objeto original desde el proveedor o un backup.
5. Para `CROSS_TENANT_STORAGE_REFERENCE`, detener cualquier reparación y
   escalar como incidente de aislamiento. El reporte de un tenant no revela la
   key del otro tenant.
6. Cualquier resolución futura que modifique un registro o elimine un objeto
   requiere un cambio separado con autorización explícita, revalidación de la
   huella, operación idempotente y evento de auditoría. Esta implementación no
   expone reparación ni eliminación automática.

## Validación esperada

Probar las transiciones, idempotencia, pagos parciales, reversos concurrentes,
aislamiento RLS, validación de soporte privado y el cálculo de N2D.4 contra
PostgreSQL desechable 17.11. Toda prueba fallida debe abortar antes de acceder a
datos persistentes.
