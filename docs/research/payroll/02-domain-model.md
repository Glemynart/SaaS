# 02 — Modelo de Dominio del Payroll (conceptual)

> **Naturaleza de este documento.** Modelo conceptual del dominio de Nómina para un ERP SaaS de operadores educativos colombianos. No contiene implementación, código, tablas ni APIs. Su propósito es fijar el lenguaje ubicuo, los límites de responsabilidad y las piezas del modelo que guiarán el diseño técnico posterior.

---

## 1. Objetivo del dominio Payroll

Liquidar, de forma **correcta, auditable y reproducible**, la nómina periódica de un operador educativo: a partir de los contratos vigentes y las novedades del período, calcular devengos, deducciones, aportes patronales y provisiones, determinar el neto a pagar de cada empleado, y entregar un **resultado de negocio** que Accounting contabilice y Tesorería pague.

El dominio es dueño de la **corrección laboral** (qué se devengó, qué se dedujo, qué aportó el empleador). No es dueño de la contabilidad, ni del pago, ni del reporte tributario: esos son otros contextos que consumen su resultado.

Principio rector heredado de la investigación: **profundidad antes que amplitud**. Hacer bien el caso central (nómina mensual ordinaria) importa más que cubrir toda la legislación.

---

## 2. Bounded contexts

El sistema se divide en contextos delimitados para no mezclar responsabilidades. Payroll es el _core domain_; los demás lo rodean.

| Contexto                              | Responsabilidad                                                        | Relación con Payroll                     |
| ------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------- |
| **Payroll (Nómina)**                  | Liquidar el período: devengos, deducciones, aportes, provisiones, neto | Core domain                              |
| **Employees (Talento)**               | Personas, contratos, cargos, afiliaciones                              | Upstream — provee datos maestros         |
| **Configuración Legal / Paramétrica** | Parámetros legales vigentes, catálogo de conceptos, escalas            | Upstream — provee reglas                 |
| **Accounting Core**                   | Ledger append-only, partida doble, causación                           | Downstream — contabiliza el resultado    |
| **Tesorería**                         | Dispersión de netos y pago de obligaciones a terceros                  | Downstream — paga el resultado           |
| **Nómina Electrónica**                | Documento soporte y reporte a la DIAN                                  | Downstream futuro — reporta el resultado |

Payroll modela lo que necesita de los contextos upstream y **emite un resultado** hacia los downstream, sin invadir sus responsabilidades.

---

## 3. Responsabilidades del dominio Payroll

- Interpretar los contratos vigentes y las novedades del período como insumos de cálculo.
- Aplicar el catálogo de conceptos y los parámetros legales vigentes para producir la liquidación de cada empleado.
- Garantizar las invariantes de negocio (IBC, topes, neto = devengado − deducciones, redondeo).
- Sostener el ciclo de vida del período (borrador → revisión → aprobación → causación → pago → cierre).
- Congelar el resultado al aprobar, dejándolo reproducible desde sus insumos y su "receta" (versión de parámetros y conceptos).
- Entregar el resultado agregable (por empleado, por concepto, por centro de costo) a Accounting y a Tesorería.

Lo que **no** hace: no conoce cuentas contables ni débitos/créditos, no escribe en el Ledger, no ejecuta pagos, no genera documentos tributarios.

---

## 4. Entidades principales

- **Trabajador (Empleado).** La persona. Identidad estable por documento; sobrevive a sus contratos y a las corridas de nómina.
- **Contrato laboral.** La relación de trabajo: tipo, salario, cargo, sede/centro de costo, afiliaciones, fechas. Fuente de las condiciones que alimentan el cálculo.
- **Novedad.** Un hecho variable del período (incapacidad, licencia, horas extra, ausencia, bonificación, deducción, ingreso, retiro). Insumo auditable.
- **Proceso de Nómina.** La corrida de un período para una empresa: define el período, el tipo y el estado; coordina y controla.
- **Liquidación.** El resultado de un trabajador en un período: sus renglones de concepto, IBC, totales y neto. Es el "hecho de nómina" que se congela al aprobar.
- **Concepto de Nómina.** La definición declarativa de un concepto (tipo, naturaleza, base, regla, condición, orden). Configuración curada.
- **Juego de Parámetros Legales.** El conjunto de valores legales vigentes por fecha (SMMLV, auxilio, UVT, tasas, topes).
- **Estructura Organizacional / Entidades de Seguridad Social.** Empresa, sedes, centros de costo, clase de riesgo, EPS/AFP/ARL/CCF de referencia.

---

## 5. Agregados

Los agregados definen los límites de consistencia. **Se referencian entre sí solo por identidad**, nunca por posición ni por objeto embebido —corrigiendo la fragilidad del Excel.

- **Trabajador** — raíz maestra; identidad = documento; contiene datos personales y cuenta bancaria.
- **Contrato** — raíz maestra; referencia al Trabajador; contiene condiciones laborales y afiliaciones. Invariantes: coherencia de fechas, una afiliación vigente por subsistema, reglas del tipo de salario.
- **Proceso de Nómina** — raíz transaccional de la corrida; contiene estado, período, referencias a las versiones usadas y totales de control. **No** embebe las liquidaciones (serían cientos): las referencia por identidad.
- **Liquidación** — raíz transaccional por trabajador·período; contiene los renglones de concepto, IBC, totales y el _snapshot_ de parámetros/conceptos aplicados. Invariante: neto = devengado − deducciones; inmutable al cerrar.
- **Novedad** — raíz de insumo; referencia contrato y período; persiste como hecho auditable.
- **Concepto de Nómina**, **Juego de Parámetros Legales**, **Escala Salarial**, **Estructura Organizacional**, **Entidad de Seguridad Social** — raíces de configuración/referencia, versionadas por vigencia.

Nota de diseño: separar **Proceso** y **Liquidación** en agregados distintos permite calcular a cada empleado de forma independiente y paralelizable, dejando al Proceso solo la coordinación del período.

---

## 6. Value Objects (si aplican)

Objetos inmutables, sin identidad, iguales por valor:

- **Dinero** — monto en COP con política de redondeo a peso.
- **Tasa / Porcentaje** — proporción validada.
- **Período** — año, mes, quincena, rango de fechas y días base.
- **Días liquidados** — días efectivos, acotados por el período.
- **Documento de identidad** — tipo + número.
- **Salario** — monto + tipo (ordinario/integral) + naturaleza.
- **IBC** — base de cotización calculada (piso 1 SMMLV, techo 25 SMMLV; integral = 70 %).
- **Base de cálculo** — la base concreta a la que se aplica un concepto (derivada, no capturada).
- **Naturaleza salarial** — salarial / no salarial; determina si afecta el IBC y las prestaciones.
- **Clase de riesgo** — I–V, mapea a la tasa de ARL.
- **Cuenta bancaria** — banco, tipo y número.
- **Múltiplo de SMMLV** — expresa topes que se resuelven contra el parámetro vigente.
- **Resultado de concepto** — concepto + base + tarifa + valor (reproducible).
- **Referencia de versión** — puntero inmutable a la versión de parámetro/concepto usada.

Principio clave: IBC, bases y resultados de concepto son **valores calculados**, no datos capturados. En el Excel eran celdas editables; aquí no tienen identidad ni se persisten como insumo.

---

## 7. Reglas de negocio relevantes (visión de dominio)

El catálogo completo y detallado vive en el documento 04. A nivel de dominio, las reglas se agrupan así:

- **Legales, parametrizables:** IBC y sus topes; condición del auxilio de transporte; aportes de empleado (4 % + 4 %); aportes patronales y parafiscales con su exoneración; provisiones prestacionales; prorrateo por días.
- **De política de empresa:** escalas salariales, auxilios extralegales, criterio de provisión, política de redondeo, bandera de exoneración de aportes.
- **Invariantes transversales:** toda liquidación cerrada es reproducible desde insumos + versión; no se recalcula un período cerrado con parámetros actuales; un cambio en contrato o novedad no altera liquidaciones ya cerradas (solo futuras o reliquidaciones explícitas).

---

## 8. Integración conceptual con otros contextos

> Solo responsabilidades. Sin eventos, sin APIs, sin contratos técnicos.

### Con **Employees (Talento)**

Employees es dueño de las personas, contratos, cargos y afiliaciones. Payroll los **consume por identidad** como insumo maestro y no los modifica. Un cambio de salario o de afiliación ocurre en Employees; Payroll lo toma en la siguiente liquidación, sin alterar las ya cerradas.

### Con **Accounting Core**

Payroll produce un **resultado de negocio aprobado** (hechos económicos en lenguaje de nómina: devengos, deducciones, aportes, provisiones, neto por empleado y agregados por centro de costo). Accounting es dueño del Ledger append-only, del plan de cuentas y del mapeo concepto→cuenta, y traduce ese resultado en asientos balanceados. **Payroll nunca escribe en el Ledger.** La frontera es un resultado de negocio, no una instrucción contable. La causación es idempotente: una nómina aprobada se contabiliza una vez; las correcciones generan reliquidaciones que producen su propio ajuste.

### Con **Tesorería**

La causación reconoce las obligaciones (con empleados, seguridad social, parafiscales); el **pago** las extingue. Payroll marca ambos hitos y entrega los montos y beneficiarios a pagar; Tesorería ejecuta la dispersión. El Ledger refleja provisión al causar y cancelación al pagar. Son dos momentos distintos del mismo hecho.

### Con **Configuración Legal / Paramétrica**

Provee a Payroll los parámetros legales vigentes por fecha y el catálogo de conceptos, ambos versionados. Payroll los **aplica** según la vigencia del período liquidado y **guarda la referencia de versión** en cada liquidación. Así, un cambio anual de ley no reescribe el pasado y la reproducibilidad queda garantizada.

### Con **Nómina Electrónica** (futuro)

Consumirá el resultado ya aprobado para generar el documento soporte y reportarlo a la DIAN. Payroll no debe acoplarse a este contexto en v1; basta con que su resultado sea completo y trazable para alimentarlo cuando exista.

---

## 9. Cómo el modelo corrige los defectos del Excel

| Defecto del Excel                    | Solución en el dominio                                     |
| ------------------------------------ | ---------------------------------------------------------- |
| Referencias posicionales entre hojas | Referencias por identidad entre agregados                  |
| Parámetros legales incrustados       | Juego de Parámetros Legales versionado                     |
| Colillas desfasadas / rotas          | Comprobante derivado del cálculo aprobado                  |
| Sin redondeo                         | Value Object Dinero con política de redondeo               |
| Escalas digitadas fila a fila        | Escala Salarial como configuración                         |
| Bases inconsistentes entre grupos    | Motor único de conceptos con orden de evaluación explícito |
| Sin trazabilidad de tasas usadas     | Snapshot de versión en cada liquidación cerrada            |
| Sin validaciones                     | Invariantes en Contrato, Liquidación y Novedad             |

---

Este modelo conceptual es la base sobre la que se define el alcance del producto (documento 03) y se detallan las reglas funcionales (documento 04).
