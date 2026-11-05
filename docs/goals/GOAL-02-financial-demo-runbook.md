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

## Recorrido sugerido (10–15 minutos)

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

## Qué comunicar con precisión

- **Sí se puede mostrar:** nómina interna, causación al Ledger, prima masiva de
  enero–junio con PDF por empleado, preparación y descarga local de PILA cuando
  no haya brechas, facturación interna, cartera derivada de recaudos y
  comprobantes contables.
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
- [Backlog de GOAL-02](./GOAL-02-backlog.md), incluida la matriz de alcance y
  sus límites normativos.
