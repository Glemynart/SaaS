# 03 — Definición del MVP del módulo Payroll

> **Naturaleza de este documento.** Documento de producto y arquitectura funcional. Define el alcance de Payroll v1 para un ERP SaaS de operadores educativos colombianos y clasifica cada capacidad por versión. No contiene implementación, código, tablas ni APIs.

---

## Principio rector

> **Profundidad antes que amplitud.** El v1 debe ejecutar de punta a punta —correcta, auditable y reproducible— la **nómina mensual ordinaria de un colegio**, incluyendo su causación contable y el desprendible del empleado. Es preferible cubrir bien un tipo de contrato, una frecuencia y un catálogo acotado de conceptos, que cubrir mal toda la legislación laboral.

Un error de nómina tiene consecuencias legales, financieras y de confianza. La ventaja del v1 no es tener muchas funciones, sino que **los números salgan bien y se pueda demostrar por qué**. Esa es la vara de cada decisión de alcance.

---

## 1. Alcance de Payroll v1

### Funcionalidades obligatorias (v1)

| Capacidad                                       | Justificación                                                                                                             |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Multiempresa (tenant) y multi-sede**          | Base del SaaS y realidad del segmento (operadores con varias instituciones y sedes). No negociable.                       |
| **Maestro de empleados**                        | Sin trabajadores no hay nómina.                                                                                           |
| **Contratos laborales (indefinido y fijo)**     | Cubren casi toda la planta docente y administrativa de un colegio.                                                        |
| **Parámetros legales versionados**              | Columna vertebral de la corrección y la auditoría; diferencia el producto del Excel.                                      |
| **Catálogo de conceptos acotado y curado**      | Define qué se liquida; cerrado, no configurable libremente por el usuario.                                                |
| **Novedades básicas**                           | Insumos variables del mes: días, ingreso/retiro, ausencias, incapacidad simple, horas extra, deducciones, bonificaciones. |
| **Liquidación de nómina mensual ordinaria**     | El caso de uso central y recurrente.                                                                                      |
| **Cálculo de aportes patronales y provisiones** | Imprescindible para causar el costo real del empleador, aunque el reporte a PILA sea posterior.                           |
| **Flujo con revisión y aprobación**             | La nómina es un acto controlado; el flujo de estados es parte del valor.                                                  |
| **Redondeo a peso**                             | Sin él, el producto es inservible para pagar y contabilizar.                                                              |
| **Causación contable vía Accounting**           | La integración con el Ledger es razón de ser del ERP.                                                                     |
| **Desprendibles derivados del cálculo**         | Documento obligatorio para el empleado; derivado, nunca capturado.                                                        |
| **Reportes operativos**                         | Resumen de nómina y listado de netos para banco (como datos).                                                             |
| **Reliquidación y reversión controladas**       | Los errores se corrigen por nueva versión, no por edición.                                                                |
| **Importación inicial desde Excel**             | El cliente viene de hojas de cálculo; sin migración no adopta.                                                            |

### Funcionalidades para v2

| Capacidad                                                                   | Por qué esperar                                                                                             |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Retención en la fuente**                                                  | Compleja (UVT, depuración) y afecta a pocos empleados de un colegio; en v1 se maneja como deducción manual. |
| **Pago de prima y de cesantías**                                            | En v1 se provisionan mensualmente; el desembolso semestral/anual puede ser una corrida posterior.           |
| **Liquidación definitiva por retiro**                                       | Cálculo delicado (cesantías, vacaciones, indemnización); bajo volumen, alto riesgo.                         |
| **Módulo de vacaciones (ciclo completo)**                                   | En v1 es novedad + provisión; el ciclo de solicitud/disfrute/compensación es un producto en sí.             |
| **Fondo de Solidaridad Pensional y salario integral**                       | Casos de borde en el segmento; se posponen con salvaguarda de validación.                                   |
| **Frecuencia quincenal, libranzas con amortización, aprobación multinivel** | Mejoras que no bloquean el caso central.                                                                    |
| **Exportación PILA y formatos bancarios específicos**                       | v1 entrega los valores; los archivos por operador/banco se priorizan con clientes reales.                   |

### Funcionalidades futuras

- **Nómina electrónica (DIAN)** y **facturación electrónica** — módulos ya declarados futuros.
- **Autoservicio del empleado** (portal, descarga de colilla, solicitudes).
- **Salario variable con promedios**, convenciones colectivas, contratos de aprendizaje con reglas propias.
- **Motor de reglas totalmente configurable por el usuario (DSL)** — ver riesgos.
- **Integración con control de asistencia / biometría.**

**Criterio de admisión a v1:** una capacidad entra si (a) aplica a casi todos los empleados todos los meses y (b) su cálculo es estable y de bajo riesgo. Lo episódico o de cálculo delicado se pospone, con salvaguardas que impidan liquidar mal en silencio.

---

## 2. Flujo funcional completo

```
Empleado → Contrato → Novedades → Liquidación → Revisión → Aprobación → Contabilización → Pago → Desprendible
```

1. **Empleado.** Se registra la persona: identidad, datos y cuenta bancaria. Es un maestro estable, independiente de sus contratos.
2. **Contrato.** Se definen las condiciones laborales: tipo, salario, cargo, sede/centro de costo, afiliaciones y fechas. Aquí viven los datos que alimentan el cálculo. Un empleado puede tener contratos sucesivos.
3. **Novedades.** Durante el período se capturan los hechos variables del mes: días efectivos, ingresos y retiros, incapacidades, licencias, ausencias, horas extra, bonificaciones y deducciones. Son los insumos auditables.
4. **Liquidación.** El sistema calcula, por empleado, devengos → bases (IBC) → deducciones → neto, y en paralelo aportes patronales y provisiones. Es determinística: mismos insumos + mismos parámetros → mismo resultado. Estado inicial: **Borrador**.
5. **Revisión.** Un responsable contrasta totales, casos atípicos y cuadres. Mientras el proceso esté abierto se pueden ajustar novedades y **recalcular** libremente. Estado: **Calculada / En revisión**.
6. **Aprobación.** Se **congelan** los parámetros y las definiciones de concepto usados. La nómina deja de ser editable; corregir a partir de aquí implica una **reliquidación** explícita. Estado: **Aprobada**.
7. **Contabilización (causación).** Payroll entrega el **resultado de negocio aprobado**; Accounting lo traduce a asientos balanceados en el Ledger (gasto, provisiones, obligaciones). Payroll no toca el Ledger. Estado: **Causada**.
8. **Pago.** Tesorería ejecuta la dispersión de los netos y de las obligaciones a terceros; el Ledger refleja la cancelación de los pasivos. Estado: **Pagada**.
9. **Desprendible.** Se generan los comprobantes individuales **derivados del cálculo aprobado**, garantizando que la colilla coincide exactamente con lo liquidado, causado y pagado.

El período termina en estado **Cerrado**: hecho histórico inmutable, reproducible desde sus insumos y su versión de parámetros/conceptos.

---

## 3. Contrato conceptual con Accounting (resumen)

Regla inviolable: **Payroll nunca escribe en el Ledger.** Payroll es autoridad de la corrección laboral y emite un resultado de negocio agregable (por empleado, concepto y centro de costo). Accounting es dueño del Ledger append-only, del plan de cuentas y del mapeo concepto→cuenta, y traduce el resultado en asientos balanceados. La causación es idempotente; las correcciones se hacen por reliquidación (ajuste), nunca por edición. La provisión (causación) y el pago (Tesorería) son dos momentos distintos del mismo hecho. _(Detalle conceptual completo en el documento 02.)_

---

## 4. Riesgos de sobreingeniería

**A evitar en v1**

- **Motor de reglas configurable por el usuario (fórmulas libres / DSL):** reproduce el caos del Excel con más pasos. El catálogo de conceptos debe ser cerrado y curado por el equipo.
- **Intérprete genérico de "cualquier concepto imaginable":** modelar extensibilidad antes de conocer la variación real de 3–5 colegios es especulativo.
- **Soportar todos los tipos de contrato, frecuencias y salario integral/variable de entrada:** multiplica los casos de prueba sin atender a la mayoría real.
- **Construir PILA o nómina electrónica prematuramente:** ya están fuera de v1.
- **Workflow de aprobación multinivel configurable, multi-moneda, microservicios:** complejidad sin demanda comprobada.

**A posponer**

- Retención en la fuente, FSP, liquidación definitiva, pago de prima/cesantías/vacaciones, incapacidad con cálculo legal completo, módulo de vacaciones, formatos bancarios y de PILA específicos, autoservicio del empleado.

**Decisiones a aplazar hasta tener clientes reales**

- Amplitud de la parametrización (descubrirla con pilotos, no adivinarla).
- Profundidad del flujo de aprobación (¿un revisor + un aprobador basta?).
- Formatos de dispersión bancaria y si se automatiza la PILA.
- Detalle fino de la política de redondeo y de casos de borde (incapacidades, retiros a mitad de mes).
- El catálogo definitivo de conceptos por tipo de operador, que solo se estabiliza al ver nóminas reales.

**Riesgo transversal (de producto, no de alcance): la confianza.** Si el primer cliente ve un neto o una causación equivocada, no vuelve. El v1 debe invertir su esfuerzo en **correctitud, reproducibilidad y auditoría** de lo poco que hace, y en una **migración fiel desde Excel**, antes que en ampliar cobertura funcional.

---

## 5. Decisiones de fondo (insumos para el ADR)

1. **Alcance v1 = nómina mensual ordinaria completa** (cálculo + causación + colilla), no cobertura amplia de la ley.
2. **Catálogo de conceptos cerrado y curado**, no motor de reglas del usuario.
3. **Parámetros legales y de política versionados por vigencia**, como base de la corrección y la auditoría.
4. **Frontera Payroll↔Accounting = resultado de negocio**; el Ledger es exclusivo de Accounting.
5. **Postergar deliberadamente** retención, liquidaciones especiales, PILA y nómina electrónica hasta validar con clientes reales.
