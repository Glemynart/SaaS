# 01 — Análisis del Excel de Nómina (investigación de origen)

> **Naturaleza de este documento.** Es el resumen de conocimiento obtenido al analizar la hoja de cálculo de nómina que hoy usa un operador educativo real (nómina de mayo 2026). No reproduce el Excel: destila su lógica, sus reglas y sus defectos para informar el diseño del módulo Payroll del ERP. Sirve como evidencia de campo del problema que el producto resuelve.

---

## 1. Propósito del Excel

El libro liquida la nómina mensual de un operador educativo (Unión Temporal que administra un contrato de canasta educativa) para tres grupos de personal —docentes, directivos docentes y administrativos— en varias sedes. A partir de un salario básico y unos días laborados, calcula devengos, deducciones, neto a pagar, y produce tres vistas derivadas: un listado para dispersión bancaria, los desprendibles individuales y un resumen con aportes patronales y provisiones.

Es, en esencia, un **motor de nómina artesanal**: mezcla en un mismo artefacto los datos maestros (empleados, salarios), los insumos del período (días, deducciones), las reglas de cálculo (fórmulas) y los parámetros legales (valores incrustados). Esa mezcla es precisamente la fuente de su fragilidad.

---

## 2. Descripción de las hojas

El libro contiene siete hojas: tres de liquidación (origen de datos), tres derivadas (consumidoras) y una vacía.

| Hoja                   | Rol      | Contenido                                                                                                       |
| ---------------------- | -------- | --------------------------------------------------------------------------------------------------------------- |
| **Docentes**           | Origen   | Liquidación de 46 docentes. Salario por perfil académico, días, auxilio de transporte, deducciones y neto.      |
| **Nómina Directivos**  | Origen   | Liquidación de 3 coordinadores. Misma idea, con una estructura de fórmulas ligeramente distinta.                |
| **Administrativos**    | Origen   | Liquidación de 36 administrativos (profesional, digitador, secretaria, auxiliares, servicios generales).        |
| **Listado para Banco** | Derivada | Consolida el neto, la cuenta y el banco de las tres hojas anteriores para la dispersión. Suma el total a pagar. |
| **Desprendibles**      | Derivada | Comprobante de pago individual por empleado (dos por bloque).                                                   |
| **Resumen por Ítem**   | Derivada | Totales por grupo y cálculo de aportes patronales, parafiscales y provisiones prestacionales.                   |
| **Hoja auxiliar**      | Vacía    | Sin uso.                                                                                                        |

> Detalle relevante: el nombre de la hoja de docentes lleva un **espacio final**, que se arrastra a todas las referencias cruzadas y es una fuente clásica de errores al renombrar.

---

## 3. Flujo entre hojas

```
[Docentes]     ─┐
[Directivos]   ─┼─►  Listado para Banco  ─►  Resumen (encabezado / total a pagar)
[Administrat.] ─┘         │
      │                   └──►  (neto por persona → total nómina a pagar)
      │
      ├──────────────────►  Desprendibles      (comprobante por empleado)
      │
      └──────────────────►  Resumen por Ítem   (totales por grupo → aportes y provisiones)
```

Las tres hojas de liquidación son la **fuente de verdad**. Las otras tres son vistas que las referencian **celda a celda por posición**. No existe un lugar central de parámetros: cada constante legal vive dentro de las fórmulas.

---

## 4. Conceptos de nómina identificados

**Devengos**

- Sueldo / básico (entrada por escala de perfil o cargo).
- Base salarial = básico prorrateado por días.
- Auxilio de transporte (valor fijo prorrateado por días).
- "Otros devengados" (columna presente pero sin uso en el período).

**Deducciones al empleado**

- Aporte a salud (4 %).
- Aporte a pensión (4 %).
- "Otras / libranzas" (cajón genérico: libranzas, préstamos, descuentos varios).

**Aportes patronales (solo en el resumen)**

- Salud patronal (8,5 %), Pensión patronal (12 %), ARL (0,522 %, riesgo clase I), ICBF (3 %), SENA (2 %), Caja de Compensación (4 %).

**Provisiones prestacionales (solo en el resumen)**

- Cesantías, intereses a las cesantías, prima de servicios, vacaciones.

**Escalas salariales detectadas (política de la empresa)**

- Docentes: Licenciado ≈ 2.847.600; Normalista ≈ 2.328.000; Bachiller / Docente Sabedor ≈ 1.969.000.
- Directivos (Coordinador) ≈ 2.950.000.
- Administrativos: Profesional ≈ 3.100.000; Digitador ≈ 2.250.000; varios cargos ≈ 1.910.000; auxiliares/servicios generales ≈ 1.750.905 (valor ajustado para que básico + auxilio = 2.000.000 exactos).

---

## 5. Fórmulas principales (destiladas por patrón)

Las hojas repiten un puñado de patrones por fila. Resumidos en lenguaje funcional:

| Cálculo                      | Lógica                                                  | Naturaleza                       |
| ---------------------------- | ------------------------------------------------------- | -------------------------------- |
| Base salarial                | `básico / 30 × días`                                    | Legal (mes comercial de 30 días) |
| Auxilio de transporte        | `valor_auxilio / 30 × días`                             | Legal (valor anual por decreto)  |
| Total devengado              | `base salarial + auxilio + otros`                       | Derivado                         |
| Salud empleado               | `base salarial × 4 %`                                   | Legal                            |
| Pensión empleado             | `base salarial × 4 %`                                   | Legal                            |
| Total deducciones            | `salud + pensión + otras`                               | Derivado                         |
| Neto a pagar                 | `total devengado − total deducciones`                   | Derivado                         |
| Totales de columna           | sumatoria del grupo                                     | Derivado                         |
| Aporte patronal / parafiscal | `total salario base × tasa`                             | Legal                            |
| Provisión prestacional       | `base × tasa`                                           | Legal / política                 |
| Consolidado bancario         | referencia cruzada al neto, cuenta y banco de cada hoja | Consolidación                    |
| Desprendible                 | referencia cruzada a los valores del empleado           | Consolidación                    |

Observaciones sobre las fórmulas:

- La base de la deducción (salud/pensión) **excluye** el auxilio de transporte: coincide con el concepto legal de IBC.
- En directivos, el total devengado prorratea básico **y** auxilio juntos, y la deducción se toma sobre el básico completo (sin prorratear). Es una estructura distinta a la de las otras dos hojas.
- Las provisiones usan tasas redondeadas (10 % cesantías, 10 % prima, 5 % vacaciones) en lugar de las legales (8,33 %, 8,33 %, 4,17 %), y los intereses a las cesantías se calculan sobre una base y tasa que no corresponden a la ley.

---

## 6. Dependencias entre fórmulas

**Cadena de cálculo por empleado:**

```
básico + días  →  base salarial
                  base salarial + auxilio + otros  →  total devengado
base salarial   →  salud (4%)  ┐
base salarial   →  pensión (4%)┼→ total deducciones
otras (manual)  ───────────────┘
total devengado − total deducciones  →  neto
neto  →  listado bancario  →  total a pagar
neto  →  desprendible del empleado
```

**Entre hojas:** el listado bancario, los desprendibles y el resumen dependen de las tres hojas de liquidación mediante referencias posicionales. Todos los aportes y provisiones dependen de **un único nodo**: el "total salario base" del resumen; cambiarlo recalcula los diez conceptos patronales.

**Riesgo estructural de estas dependencias:** al ser referencias por posición (no por identidad del empleado), insertar, borrar u ordenar filas desalinea silenciosamente las hojas derivadas.

---

## 7. Entradas (insumos que se capturan a mano cada mes)

- Nombres, cédula/identificación, perfil o cargo, sede.
- Salario básico (según escala).
- Días laborados (0–30).
- Otras deducciones / libranzas.
- Número de cuenta y banco.
- (Implícitos) valor del auxilio de transporte y tasas legales, incrustados en las fórmulas.

---

## 8. Salidas (resultados producidos)

- Neto a pagar por empleado.
- Totales de devengado y deducciones por grupo.
- Total de nómina a pagar (consolidado bancario).
- Total salario base y total de aportes patronales.
- Total de provisiones prestacionales.
- Total de apropiaciones (costo adicional del empleador).
- Comprobantes de pago individuales.
- Listado de netos para dispersión bancaria.

---

## 9. Observaciones

- El modelo es **determinístico y sencillo**: pocas reglas, repetidas cientos de veces. La complejidad no está en el cálculo, sino en la ausencia de estructura.
- Correctamente, el IBC excluye el auxilio de transporte, y la base de vacaciones excluye el auxilio mientras la de cesantías/prima lo incluye.
- Existe un flujo de control manual (ELABORADO / REVISADO / APROBADO / NÓMINA CAUSADA) que anticipa los estados del futuro proceso de nómina.
- La hoja define escalas salariales por perfil/cargo, no por persona: es una política replicable.
- Aparece una regla de "salario bruto objetivo" (ajustar el básico para que básico + auxilio dé una cifra redonda).

---

## 10. Inconsistencias detectadas

**Críticas**

- **Desprendibles rotos:** una parte considerable de los comprobantes referencia celdas eliminadas y devuelve error; muchos empleados no tienen colilla válida.
- **Desprendible que no cuadra con la nómina:** en algún comprobante el auxilio de transporte aparece en cero, produciendo un neto distinto al realmente pagado. El documento entregado al empleado no refleja el pago real.
- **Columna de identificación del listado bancario apunta al nombre**, no a la cédula; para algunos grupos queda vacía. El archivo de dispersión no lleva identificación confiable.

**Altas**

- **Sin redondeo a peso:** netos y totales arrastran decimales; no hay redondeo en ninguna parte.
- **Doble prorrateo del auxilio en directivos** cuando los días son distintos de 30 (no se manifiesta en un mes completo, pero es un error latente).
- **Base de deducción inconsistente entre grupos** (prorrateada vs. completa).
- **Constante de auxilio divergente:** conviven dos valores distintos de auxilio en el mismo libro.
- **Provisiones e intereses con tasas no legales.**

**De diseño**

- Parámetros legales incrustados y repetidos cientos de veces.
- Referencias posicionales entre hojas (causa raíz de los errores de referencia).
- Cálculos manuales sueltos mezclados con la estructura.
- Riesgo tributario no documentado sobre la exoneración de aportes (según la naturaleza jurídica del operador).
- Ausencia de retención en la fuente y de fondo de solidaridad pensional (hoy no aplican, pero no hay campos si los salarios suben).
- Sin validaciones (días ≤ 30, IBC mínimo, cuenta no vacía, cédula única).

---

## 11. Conclusión para el producto

El Excel demuestra que el problema de negocio es **acotado y bien delimitado** (nómina mensual ordinaria de un colegio), pero que su implementación actual es **frágil, no auditable y propensa a errores silenciosos**. El valor del módulo Payroll no está en añadir funciones, sino en dar estructura a esta misma lógica: separar datos maestros, insumos, reglas y parámetros; versionar lo legal; derivar (no capturar) los comprobantes; redondear; y hacer cada liquidación reproducible y auditable.

Estos hallazgos alimentan directamente el modelo de dominio (documento 02), la definición del MVP (documento 03) y el catálogo de reglas de negocio (documento 04).
