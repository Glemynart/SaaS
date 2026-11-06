# Guion de demo financiera — GOAL-02

Este guion organiza una demostración comercial de los flujos internos de
nómina, prima, PILA, facturación y contabilidad que existen en `main`. Los pasos
se contrastaron con las rutas de navegación y los recorridos E2E del producto.
Usa un tenant de demostración con datos ficticios; no ejecutes procesos contra
staging, producción ni información laboral real.

## Preparación

1. Inicia sesión con un usuario `ADMIN` del tenant de demostración.
2. Confirma que los empleados, afiliaciones y ubicaciones laborales PILA tengan
   los datos y vigencias necesarios para el período que vas a mostrar.
3. Prepara una nómina aprobada para enseñar contabilidad o PILA. Si quieres
   mostrar el cálculo, usa un período de prueba con datos ficticios y revisa
   novedades y resultados antes de aprobarlo.
4. Prepara el primer semestre del año para la demostración de prima. El cálculo
   masivo de julio–diciembre permanece deshabilitado hasta resolver y versionar
   la regla del corte de diciembre.
5. Revisa que la demostración no use credenciales, certificados ni referencias
   de pago reales.

Para cargar los datos financieros ficticios de facturación y contabilidad en una
base **local**, sigue el [instructivo del seed financiero](./GOAL-02-financial-demo-seed.md).
Ese seed está restringido a una base local y crea una nómina sintética de un
empleado; sirve para mostrar comprobantes de demo, no para demostrar un cálculo
operativo de nómina, la prima masiva o la exportación PILA de un grupo.

## Recorrido sugerido (10–18 minutos; los escenarios adicionales son opcionales)

### 1. Nómina y resultado contable (3 minutos)

Abre **Nómina → Períodos** (`/nomina/periodos`) y entra a un período preparado.
Muestra el resultado por empleado y, cuando corresponda, el snapshot aprobado.
Luego abre **Contabilidad → Comprobantes** (`/contabilidad/comprobantes`) y
consulta el comprobante de causación de nómina. Señala las cuentas de gasto y
pasivo, y verifica que los totales débito y crédito coincidan.

La prueba de navegador del escenario financiero valida un período con un
snapshot sintético y el comprobante en Ledger. Aclara que ese fixture automatizado
no sustituye una validación contable del cliente ni convierte los datos sintéticos
en una liquidación operativa.

Escenario opcional para ingreso durante el mes: prepara antes un empleado
ficticio con ingreso y contrato desde el 10 de octubre de 2026, salario mensual de
$8.000.000, y un único contrato vigente hasta el 31 de octubre. Crea un período
que cubra el mes completo (1–31 de octubre) en **Nómina → Períodos**, genera el
cálculo y muestra 21 días liquidados y $5.600.000 en el concepto de salario base,
dejando claro que el snapshot conserva $8.000.000 como salario mensual de
referencia y los 21 días. El contrato
debe comenzar en la fecha de ingreso; períodos parciales, contratos
superpuestos, salario integral y novedades que requieran segmentación no están
cubiertos por este recorrido. La fórmula y la prorrata de auxilio requieren
revisión laboral independiente antes de uso operativo. Consulta las [reglas y
límites documentados](../research/pila/PAYROLL-NEW-HIRE-PRORATION.md).

Para prepararlo desde la interfaz, registra primero el empleado ficticio en
**Empleados** (`/empleados`), incluyendo sede, cargo, salario mensual, tipo de
contrato y fecha de ingreso. Después crea su contrato real desde **Contratos**
(`/contratos`) con el mismo empleado, sede, fecha de inicio y salario; el perfil
laboral del empleado por sí solo no crea el registro de contrato. Verifica que
el contrato cubra todo el período antes de calcular. Tras revisar el resultado,
puedes enviarlo a revisión, aprobarlo y mostrar que el snapshot congela el
salario de referencia y los 21 días, mientras el concepto guarda $5.600.000; si
la empresa de demo tiene configuradas las cuentas de nómina, también puedes causar
el período y consultar el comprobante balanceado en Ledger. Este escenario no
habilita ni demuestra una exportación PILA válida para ingresos parciales.

### 2. Prima de servicios por lote (2–3 minutos)

Abre **Nómina → Prima de servicios** (`/nomina/prima`), selecciona enero–junio,
crea la vista previa y revisa empleados, días y valores antes de aprobar. Tras la
aprobación, muestra los documentos PDF publicados en el expediente de cada
empleado.

La demo cubre el cálculo y la generación documental del primer semestre; no
registra pagos ni asientos de tesorería. No presentes julio–diciembre como
disponible: sigue protegido hasta que exista una regla laboral aprobada para el
corte y ajuste de diciembre.

### 3. Preparación y exportación PILA (2–3 minutos)

Desde el detalle del período de nómina, revisa **Preparación de datos PILA**.
Muestra el empleado, los campos candidatos y las brechas que impiden generar el
archivo. Solo cuando la pantalla habilite la acción, genera y descarga los
archivos tipo 1 y tipo 2; enseña el historial de la exportación local.

El flujo soporta únicamente los escenarios dependientes estándar incluidos en
la matriz de aceptación. La validación local verifica el formato y las reglas
implementadas para ese alcance; no significa que un operador haya aceptado el
archivo, emitido una liquidación o recibido un pago. La compatibilidad se declara
por operador solo después de superar pruebas de carga con ese operador.

Para preparar una prueba específica con SOI, sigue el [protocolo de aceptación
por operador](../research/pila/SOI-OPERATOR-ACCEPTANCE-CHECKLIST.md). El archivo
localmente validado y los estados de aceptación, liquidación y pago son hitos
distintos. Si el Autocorrector de SOI cambia datos o valores, no apruebes ni
pagues esos cambios sin conciliarlos con los snapshots aprobados de nómina.

### 4. Factura interna, cartera y Ledger (3–4 minutos)

Abre **Facturación** (`/facturacion`) y muestra el resumen de emitido, recaudo
aplicado y cartera pendiente. Si vas a crear datos en vivo, usa un cliente y
producto ficticios desde **Clientes** (`/facturacion/clientes`) y **Productos**
(`/facturacion/productos`); luego crea una factura en **Facturas**
(`/facturacion/facturas`) y consulta su comprobante en
**Contabilidad → Comprobantes**.

Registra un recaudo ficticio y muestra cómo las aplicaciones reducen el saldo de
las facturas. Las referencias de demo no representan transferencias reales; la
cartera refleja aplicaciones internas, no conciliación bancaria.

Si también vas a mostrar la cancelación de una factura emitida, usa una factura
de demo y registra un motivo. Si tiene recaudos activos, reviértelos antes de
cancelar. La factura quedará anulada; Ledger marca el comprobante original como
anulado cuando su período está abierto y crea un comprobante de reverso en el
período abierto actual cuando el período original está cerrado. Esto cancela la
factura interna del producto y no transmite ni cancela un documento ante DIAN.

En Contabilidad → Reportes (/contabilidad/reportes) consulta el Balance de
Prueba, el Balance General o el Estado de Resultados y descarga el resultado en
CSV para abrirlo en Excel. Los libros paginados descargan únicamente la página
visible; cambia de página y descarga cada una cuando necesites exportar más
registros.

### 5. Seguimiento de facturación electrónica (opcional, 1 minuto)

Con un usuario `ADMIN`, abre **Facturación → Facturación electrónica**
(`/facturacion/electronica`) y muestra **Seguimiento de transmisiones**. La vista
consulta hasta las últimas 50 transmisiones guardadas para el tenant y resume el
último intento registrado. Si no hay registros previos, muestra el estado vacío;
no fabriques resultados ni ejecutes un envío durante la demostración. Solo
presenta intentos originados en una prueba autorizada de sandbox, si existen, y
aclara que el estado normalizado del proveedor no equivale a aceptación DIAN.
La pantalla no transmite ni concilia documentos.

## Qué comunicar con precisión

- **Sí se puede mostrar:** nómina interna, causación al Ledger, prima masiva de
  enero–junio con PDF por empleado, nómina estándar de un ingreso a mitad de un
  mes completo en el alcance documentado, preparación y descarga local de PILA cuando
  no haya brechas, facturación interna, cartera derivada de recaudos y
  comprobantes contables, además del seguimiento de intentos electrónicos ya
  persistidos cuando existan.
- **Aún no se debe ofrecer como terminado:** transmisión de factura electrónica
  a DIAN, transmisión de nómina electrónica, aceptación o liquidación de una
  planilla por un operador, pagos PILA, conciliación bancaria y liquidación
  masiva de prima de julio–diciembre.
- Una factura interna en estado `ISSUED` no es una factura electrónica aceptada
  por DIAN. Un archivo PILA localmente validado no prueba aceptación, liquidación
  ni pago por un operador.

## Evidencia consultada

- [Seed financiero local](./GOAL-02-financial-demo-seed.md).
- [Escenario E2E de demo financiera](../../e2e/financial-demo-scenario.spec.ts).
- [Seed financiero E2E](../../e2e/financial-demo-seed.spec.ts).
- [Prima masiva E2E](../../e2e/service-premium-smoke.spec.ts).
- [Exportación PILA E2E](../../e2e/payroll-pila-export-smoke.spec.ts).
- [Ingreso a mitad de mes hasta aprobación y Ledger](../../e2e/payroll-new-hire-proration-smoke.spec.ts).
- [Backlog de GOAL-02](./GOAL-02-backlog.md), incluida la matriz de alcance y
  sus límites normativos.
- [PR #304: seguimiento de transmisiones](https://github.com/Glemynart/SaaS/pull/304),
  que añade la vista de solo lectura descrita en el paso 5.
