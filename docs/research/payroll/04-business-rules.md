# 04 — Reglas de Negocio del Payroll (referencia funcional)

> **Naturaleza de este documento.** Consolida todas las reglas de negocio identificadas durante la investigación (análisis del Excel + modelo de dominio + definición del MVP). Es la **referencia funcional del módulo Payroll**. No contiene implementación, código, tablas ni APIs.
>
> **Cómo leerlo.** Las reglas se agrupan por categoría. Cada regla indica: **descripción**, **entradas**, **resultado esperado**, **dependencias** y si **depende de parámetros legales configurables**. La columna de naturaleza distingue lo **legal** (obligación normativa) de lo que es **política de empresa** (decisión del operador).
>
> **Convención de versiones.** `[v1]` obligatoria en el MVP, `[v2]` diferida, `[Futuro]` fuera del horizonte cercano. Las reglas sin marca son transversales y aplican siempre.

---

## Índice de categorías

1. Contratación
2. Salario
3. Novedades
4. Prestaciones sociales
5. Vacaciones
6. Incapacidades
7. Licencias
8. Aportes (empleado y patronales)
9. Deducciones
10. Horas extras
11. Recargos
12. Parámetros legales
13. Aprobación
14. Contabilización
15. Pago
16. Invariantes transversales

---

## 1. Contratación

### R-CON-01 — Un contrato define las condiciones de liquidación `[v1]`

- **Descripción:** el cálculo de nómina se hace sobre un contrato vigente, no sobre la persona. El contrato aporta salario, tipo, cargo, sede/centro de costo, afiliaciones y fechas.
- **Entradas:** datos del contrato.
- **Resultado esperado:** insumos base para la liquidación del período.
- **Dependencias:** Empleado (Talento).
- **Parámetros configurables:** no.

### R-CON-02 — Tipos de contrato soportados `[v1: indefinido y fijo]` `[v2: obra/labor, aprendizaje]`

- **Descripción:** v1 cubre término indefinido y fijo, que abarcan casi toda la planta de un colegio.
- **Entradas:** tipo de contrato.
- **Resultado esperado:** reglas aplicables al vínculo.
- **Dependencias:** —.
- **Parámetros configurables:** no (catálogo cerrado de tipos).

### R-CON-03 — Ingreso y retiro dentro del período `[v1]`

- **Descripción:** un contrato que inicia o termina dentro del período liquida proporcional a los días de vínculo.
- **Entradas:** fechas de inicio/fin, período.
- **Resultado esperado:** días liquidables acotados al vínculo.
- **Dependencias:** R-SAL-02 (prorrateo).
- **Parámetros configurables:** días base (§12).

### R-CON-04 — Salvaguarda de casos no soportados `[v1]`

- **Descripción:** los vínculos con condiciones que el v1 no sabe liquidar (salario integral, variable) se marcan y bloquean para evitar liquidaciones erróneas silenciosas.
- **Entradas:** tipo de salario, condiciones especiales.
- **Resultado esperado:** exclusión controlada, no cálculo incorrecto.
- **Dependencias:** R-SAL-04.
- **Parámetros configurables:** no.

---

## 2. Salario

### R-SAL-01 — Escala salarial por cargo/perfil `[v1]`

- **Descripción:** el salario base proviene de una escala por cargo o perfil, no de un valor digitado por persona (docente licenciado, normalista, bachiller; coordinador; cargos administrativos).
- **Entradas:** cargo/perfil del contrato, escala vigente.
- **Resultado esperado:** salario básico asignado.
- **Dependencias:** Configuración (escala).
- **Parámetros configurables:** sí (escala salarial, política de empresa).

### R-SAL-02 — Prorrateo por días `[v1]`

- **Descripción:** la base salarial del período = salario básico / días base × días liquidados.
- **Entradas:** salario básico, días liquidados.
- **Resultado esperado:** base salarial del período.
- **Dependencias:** R-NOV-01 (días).
- **Parámetros configurables:** días base (30 vs calendario).
- **Naturaleza:** legal (regla de liquidación).

### R-SAL-03 — Salario bruto/neto objetivo `[Futuro / opcional]`

- **Descripción:** política observada en el Excel de ajustar el básico para que básico + auxilio dé una cifra redonda. Es política de empresa, no obligación.
- **Entradas:** cifra objetivo.
- **Resultado esperado:** básico ajustado.
- **Dependencias:** R-SAL-01.
- **Parámetros configurables:** sí (política de empresa).

### R-SAL-04 — Salario integral `[v2]`

- **Descripción:** solo si el salario ≥ 13 SMMLV; su IBC es el 70 % y no genera prima ni cesantías separadas.
- **Entradas:** salario, tipo.
- **Resultado esperado:** liquidación con factor prestacional embebido.
- **Dependencias:** R-APO-01 (IBC), R-PRE-\*.
- **Parámetros configurables:** tope en SMMLV, porcentaje de IBC.
- **Naturaleza:** legal.

---

## 3. Novedades

### R-NOV-01 — Días efectivos del período `[v1]`

- **Descripción:** los días liquidados resultan de los días del período menos ausencias, incapacidades y licencias no remuneradas.
- **Entradas:** período, novedades de ausentismo.
- **Resultado esperado:** días liquidables por empleado.
- **Dependencias:** R-INC-_, R-LIC-_, R-DED-\*.
- **Parámetros configurables:** días base.

### R-NOV-02 — Novedades como insumo auditable `[v1]`

- **Descripción:** toda novedad (incapacidad, licencia, extra, ausencia, bonificación, deducción, ingreso, retiro) se registra como hecho del período y persiste, independientemente de recálculos.
- **Entradas:** novedad capturada.
- **Resultado esperado:** insumo trazable de la liquidación.
- **Dependencias:** —.
- **Parámetros configurables:** no.

### R-NOV-03 — Cotas de las novedades `[v1]`

- **Descripción:** las novedades de días no pueden exceder los días del período; las fechas caen dentro del período.
- **Entradas:** fechas y cantidades de la novedad.
- **Resultado esperado:** validación de consistencia.
- **Dependencias:** R-NOV-01.
- **Parámetros configurables:** no.

---

## 4. Prestaciones sociales

### R-PRE-01 — Provisión de cesantías `[v1: provisión]` `[v2: pago]`

- **Descripción:** se provisiona mensualmente sobre la base prestacional (salario + auxilio de transporte). El desembolso anual se difiere a v2.
- **Entradas:** base prestacional del período.
- **Resultado esperado:** valor provisionado de cesantías.
- **Dependencias:** R-SAL-02, R-AUX-01.
- **Parámetros configurables:** sí (tasa; legal 8,33 %).
- **Naturaleza:** legal.

### R-PRE-02 — Intereses a las cesantías `[v1: provisión]`

- **Descripción:** se provisionan sobre el valor de las cesantías (no sobre el salario).
- **Entradas:** cesantías provisionadas.
- **Resultado esperado:** valor provisionado de intereses.
- **Dependencias:** R-PRE-01.
- **Parámetros configurables:** sí (tasa; legal 12 % anual).
- **Naturaleza:** legal.
- **Nota:** el Excel usaba base y tasa incorrectas; el módulo debe corregirlo.

### R-PRE-03 — Prima de servicios `[v1: provisión]` `[v2: pago]`

- **Descripción:** se provisiona sobre la base prestacional (salario + auxilio). El pago semestral (junio/diciembre) se difiere a v2.
- **Entradas:** base prestacional.
- **Resultado esperado:** valor provisionado de prima.
- **Dependencias:** R-SAL-02, R-AUX-01.
- **Parámetros configurables:** sí (tasa; legal 8,33 %).
- **Naturaleza:** legal.

---

## 5. Vacaciones

### R-VAC-01 — Provisión de vacaciones `[v1: provisión]`

- **Descripción:** se provisionan sobre el salario **sin** incluir el auxilio de transporte (a diferencia de cesantías/prima).
- **Entradas:** base salarial.
- **Resultado esperado:** valor provisionado de vacaciones.
- **Dependencias:** R-SAL-02.
- **Parámetros configurables:** sí (tasa; legal 4,17 %).
- **Naturaleza:** legal.

### R-VAC-02 — Ciclo de vacaciones (disfrute/compensación) `[v2]`

- **Descripción:** solicitud, disfrute y compensación en dinero. En v1 solo existe la provisión y, si se paga, se captura como novedad.
- **Entradas:** días de vacaciones, decisión disfrute/compensación.
- **Resultado esperado:** devengo/salida correspondiente.
- **Dependencias:** R-NOV-02.
- **Parámetros configurables:** reglas de acumulación.
- **Naturaleza:** legal.

---

## 6. Incapacidades

### R-INC-01 — Incapacidad reduce días y afecta devengo `[v1: simple]`

- **Descripción:** en v1 la incapacidad se registra como novedad que reduce días laborados; el tratamiento simple evita implementar el cálculo legal completo.
- **Entradas:** días de incapacidad, tipo.
- **Resultado esperado:** ajuste de días y devengo.
- **Dependencias:** R-NOV-01.
- **Parámetros configurables:** días base.
- **Salvaguarda:** los casos complejos se marcan para revisión manual.

### R-INC-02 — Cálculo legal completo de incapacidades `[v2]`

- **Descripción:** porcentajes por tipo (común, laboral), transición de responsabilidad EPS/ARL, prórrogas y topes.
- **Entradas:** tipo de incapacidad, días, IBC, origen.
- **Resultado esperado:** valor a cargo del empleador y de la entidad.
- **Dependencias:** R-APO-01 (IBC), parámetros legales.
- **Parámetros configurables:** sí (porcentajes, umbrales de días).
- **Naturaleza:** legal.

---

## 7. Licencias

### R-LIC-01 — Licencia remunerada / no remunerada `[v1]`

- **Descripción:** la remunerada mantiene el devengo; la no remunerada reduce días y devengo.
- **Entradas:** tipo de licencia, días.
- **Resultado esperado:** ajuste de días/devengo según tipo.
- **Dependencias:** R-NOV-01.
- **Parámetros configurables:** no (más allá de días base).

### R-LIC-02 — Licencias de maternidad/paternidad `[v2]`

- **Descripción:** cálculo y financiación específicos por la EPS.
- **Entradas:** tipo, días, IBC.
- **Resultado esperado:** valor y responsable del pago.
- **Dependencias:** R-APO-01.
- **Parámetros configurables:** sí.
- **Naturaleza:** legal.

---

## 8. Aportes

### R-APO-01 — Ingreso Base de Cotización (IBC) `[v1]`

- **Descripción:** IBC = devengos salariales **menos** auxilio de transporte, con piso de 1 SMMLV y techo de 25 SMMLV (integral = 70 %, v2).
- **Entradas:** devengos salariales, auxilio, SMMLV.
- **Resultado esperado:** base de cotización del período.
- **Dependencias:** R-SAL-02, R-AUX-01.
- **Parámetros configurables:** sí (SMMLV, topes en SMMLV).
- **Naturaleza:** legal.

### R-APO-02 — Aporte de salud del empleado (4 %) `[v1]`

- **Descripción:** deducción del 4 % sobre el IBC.
- **Entradas:** IBC.
- **Resultado esperado:** valor deducido por salud.
- **Dependencias:** R-APO-01.
- **Parámetros configurables:** sí (tasa).
- **Naturaleza:** legal.

### R-APO-03 — Aporte de pensión del empleado (4 %) `[v1]`

- **Descripción:** deducción del 4 % sobre el IBC.
- **Entradas:** IBC.
- **Resultado esperado:** valor deducido por pensión.
- **Dependencias:** R-APO-01.
- **Parámetros configurables:** sí (tasa).
- **Naturaleza:** legal.

### R-APO-04 — Fondo de Solidaridad Pensional `[v1]`

- **Descripción:** aporte adicional escalonado (desde 1 %) para IBC ≥ 4 SMMLV.
- **Entradas:** IBC, SMMLV.
- **Resultado esperado:** deducción adicional.
- **Dependencias:** R-APO-01.
- **Parámetros configurables:** sí (umbral y escalas).
- **Naturaleza:** legal.

### R-APO-05 — Aportes patronales y parafiscales `[v1: cálculo/causación]`

- **Descripción:** salud patronal (8,5 %), pensión patronal (12 %), ARL (por clase de riesgo), ICBF (3 %), SENA (2 %), Caja de Compensación (4 %), sobre el IBC. Se calculan para costear y causar, aunque el reporte a PILA sea posterior.
- **Entradas:** IBC, clase de riesgo, bandera de exoneración.
- **Resultado esperado:** costo patronal del período.
- **Dependencias:** R-APO-01, R-APO-06.
- **Parámetros configurables:** sí (todas las tasas, clase de riesgo).
- **Naturaleza:** legal.

### R-APO-06 — Exoneración de aportes `[v1: bandera]`

- **Descripción:** empleadores elegibles quedan exonerados de salud patronal, ICBF y SENA sobre trabajadores que ganan menos de 10 SMMLV. Depende de la naturaleza jurídica del operador.
- **Entradas:** bandera de exoneración de la empresa, IBC, SMMLV.
- **Resultado esperado:** aportes patronales ajustados.
- **Dependencias:** R-APO-05.
- **Parámetros configurables:** sí (bandera por empresa, umbral en SMMLV).
- **Naturaleza:** legal.
- **Nota:** el Excel no documentaba esta decisión; en el ERP es explícita por tenant.

---

## 9. Deducciones

### R-DED-01 — Deducciones voluntarias / libranzas `[v1: valor manual]` `[v2: amortización]`

- **Descripción:** libranzas, préstamos, anticipos y descuentos varios. En v1 se capturan como valor manual del período; la amortización programada se difiere.
- **Entradas:** valor de la deducción, autorización.
- **Resultado esperado:** reducción del neto.
- **Dependencias:** R-TOT-02.
- **Parámetros configurables:** no.
- **Naturaleza:** política / autorización individual.

### R-DED-02 — Embargos judiciales `[v2]`

- **Descripción:** deducción por orden judicial con límites legales.
- **Entradas:** orden judicial, límites.
- **Resultado esperado:** deducción y consignación a tercero.
- **Dependencias:** R-TOT-02.
- **Parámetros configurables:** sí (límites legales).
- **Naturaleza:** legal.

### R-DED-03 — Retención en la fuente `[v2]`

- **Descripción:** retención por procedimiento 1/2 en UVT; en v1 se maneja, si aplica, como deducción manual.
- **Entradas:** base depurada, UVT, rentas exentas.
- **Resultado esperado:** valor retenido.
- **Dependencias:** R-TOT-01, R-APO-02/03.
- **Parámetros configurables:** sí (UVT, tablas, tope).
- **Naturaleza:** legal.

---

## 10. Horas extras

### R-HEX-01 — Horas extra `[v1: cantidad × factor o valor manual]`

- **Descripción:** en v1 se capturan como cantidad de horas por un factor, o como valor manual; el cálculo legal fino se difiere.
- **Entradas:** cantidad de horas, factor, valor hora.
- **Resultado esperado:** devengo por horas extra.
- **Dependencias:** R-SAL-01.
- **Parámetros configurables:** sí (factores).
- **Naturaleza:** legal.

### R-HEX-02 — Cálculo legal completo de horas extra `[v2]`

- **Descripción:** diurna/nocturna, dominical/festiva, con sus porcentajes exactos y su efecto sobre el IBC.
- **Entradas:** tipo de hora, cantidad, valor hora.
- **Resultado esperado:** devengo detallado.
- **Dependencias:** R-APO-01.
- **Parámetros configurables:** sí (porcentajes legales).
- **Naturaleza:** legal.

---

## 11. Recargos

### R-REC-01 — Recargos nocturno, dominical y festivo `[v1: valor manual]` `[v2: cálculo]`

- **Descripción:** en v1 se capturan como valor; en v2 se calculan con sus porcentajes legales. Afectan el devengo salarial y, por tanto, el IBC.
- **Entradas:** tipo de recargo, cantidad, valor hora.
- **Resultado esperado:** devengo por recargo.
- **Dependencias:** R-SAL-01, R-APO-01.
- **Parámetros configurables:** sí (porcentajes).
- **Naturaleza:** legal.

---

## 12. Parámetros legales

> Todos con **vigencia temporal**: nunca incrustados en la lógica, siempre con fecha de aplicación. La liquidación de un período usa la versión vigente en ese período y guarda su referencia.

### R-PAR-01 — SMMLV `[v1]`

- **Descripción:** salario mínimo legal; base de múltiples topes.
- **Por qué configurable:** cambia cada año; un período pasado debe recalcularse con el SMMLV que le correspondía.
- **Dependencias:** R-AUX-01, R-APO-01, R-APO-04/06, R-SAL-04.

### R-PAR-02 — Auxilio de transporte `[v1]`

- **Descripción:** valor mensual del auxilio.
- **Por qué configurable:** valor anual por decreto; su condición depende del SMMLV.
- **Dependencias:** R-AUX-01.

### R-PAR-03 — UVT `[v2]`

- **Descripción:** unidad de valor tributario.
- **Por qué configurable:** anual; base de la retención y umbrales tributarios.
- **Dependencias:** R-DED-03.

### R-PAR-04 — Tasas de aportes y provisiones `[v1]`

- **Descripción:** salud/pensión empleado y patronal, ARL por clase, ICBF, SENA, CCF, cesantías, intereses, prima, vacaciones.
- **Por qué configurable:** son legales y pueden cambiar; algunas varían por empresa/sede.
- **Dependencias:** R-APO-_, R-PRE-_, R-VAC-01.

### R-PAR-05 — Topes en SMMLV `[v1]`

- **Descripción:** auxilio ≤ 2 SMMLV, IBC piso 1 / techo 25, FSP ≥ 4, integral ≥ 13.
- **Por qué configurable:** se resuelven contra el SMMLV vigente; centralizarlos evita dejarlos fijos.
- **Dependencias:** R-AUX-01, R-APO-01/04, R-SAL-04.

### R-PAR-06 — Calendario de períodos y cortes `[v1]`

- **Descripción:** cuándo se abre, cierra y paga cada nómina; días base del período.
- **Por qué configurable:** define el prorrateo y la operación mensual.
- **Dependencias:** R-SAL-02, R-NOV-01.

### R-PAR-07 — Política de redondeo `[v1]`

- **Descripción:** redondeo a peso, uniforme.
- **Por qué configurable:** afecta pagos y cuadres contables; debe ser explícita.
- **Dependencias:** R-TOT-03, R-CTB-01.

---

## 13. Aprobación

### R-APR-01 — Ciclo de estados del período `[v1]`

- **Descripción:** Borrador → Calculada/Revisión → Aprobada → Causada → Pagada → Cerrada. El recálculo solo es posible con el período abierto.
- **Entradas:** transición solicitada.
- **Resultado esperado:** estado válido y coherente.
- **Dependencias:** R-APR-02.
- **Parámetros configurables:** no (máquina de estados fija en v1).

### R-APR-02 — Congelamiento al aprobar `[v1]`

- **Descripción:** al aprobar, se congelan los parámetros y las definiciones de concepto usados; la nómina deja de ser editable.
- **Entradas:** aprobación.
- **Resultado esperado:** liquidación inmutable con snapshot de versión.
- **Dependencias:** R-TRV-01 (reproducibilidad).
- **Parámetros configurables:** no.

### R-APR-03 — Revisión antes de aprobar `[v1]`

- **Descripción:** un responsable contrasta totales y casos atípicos; puede ajustar novedades y recalcular mientras el período siga abierto.
- **Entradas:** liquidación calculada.
- **Resultado esperado:** validación previa a la aprobación.
- **Dependencias:** R-APR-01.
- **Parámetros configurables:** profundidad del flujo (multinivel, v2).

---

## 14. Contabilización

### R-CTB-01 — Payroll no escribe en el Ledger `[v1]`

- **Descripción:** Payroll produce un resultado de negocio; Accounting lo traduce a asientos balanceados. La frontera es un resultado de negocio, no una instrucción contable.
- **Entradas:** resultado de nómina aprobado.
- **Resultado esperado:** causación en el Ledger a cargo de Accounting.
- **Dependencias:** R-APR-02.
- **Parámetros configurables:** el mapeo concepto→cuenta pertenece a la capa de integración de Payroll (ADR-002 §11).

### R-CTB-02 — Causación idempotente `[v1]`

- **Descripción:** una nómina aprobada se causa una sola vez; las correcciones se hacen por reliquidación (ajuste), nunca por edición de asientos.
- **Entradas:** resultado aprobado / reliquidación.
- **Resultado esperado:** un asiento por causación; ajustes por diferencia.
- **Dependencias:** R-CTB-01, R-TRV-02.
- **Parámetros configurables:** no.

### R-CTB-03 — Provisión y pago son momentos distintos `[v1]`

- **Descripción:** la causación reconoce obligaciones; el pago las extingue. El Ledger refleja ambos.
- **Entradas:** hito de causación / hito de pago.
- **Resultado esperado:** reconocimiento y luego cancelación de pasivos.
- **Dependencias:** R-PAG-01.
- **Parámetros configurables:** no.

---

## 15. Pago

### R-PAG-01 — Dispersión de netos y obligaciones `[v1: datos]` `[v2: formatos]`

- **Descripción:** Tesorería paga los netos a los empleados y las obligaciones a terceros (seguridad social, parafiscales). En v1 se entregan los montos y beneficiarios; los formatos bancarios específicos se difieren.
- **Entradas:** netos por empleado, obligaciones a terceros, cuentas bancarias.
- **Resultado esperado:** orden de pago / listado de dispersión.
- **Dependencias:** R-TOT-03, R-CTB-03.
- **Parámetros configurables:** formatos por banco (v2).

### R-PAG-02 — Desprendible derivado del cálculo `[v1]`

- **Descripción:** el comprobante individual se deriva de la liquidación aprobada; coincide exactamente con lo liquidado, causado y pagado.
- **Entradas:** liquidación aprobada.
- **Resultado esperado:** colilla consistente por empleado.
- **Dependencias:** R-APR-02.
- **Parámetros configurables:** no.
- **Nota:** corrige el defecto del Excel (colillas desfasadas o rotas).

---

## 16. Invariantes transversales

### R-TRV-01 — Neto = Total devengado − Total deducciones `[v1]`

- **Descripción:** identidad fundamental de toda liquidación, con la política de redondeo aplicada.
- **Entradas:** devengos, deducciones.
- **Resultado esperado:** neto a pagar.
- **Dependencias:** R-TOT-01, R-TOT-02, R-PAR-07.
- **Parámetros configurables:** política de redondeo.

### R-TRV-02 — Reproducibilidad y no recálculo del pasado `[v1]`

- **Descripción:** toda liquidación cerrada es reproducible desde sus insumos + snapshot de versión; nunca se recalcula un período cerrado con parámetros actuales.
- **Entradas:** insumos + referencia de versión.
- **Resultado esperado:** mismo resultado, auditable.
- **Dependencias:** R-APR-02, R-PAR-\*.
- **Parámetros configurables:** no.

### R-TRV-03 — Referencias por identidad, no por posición `[v1]`

- **Descripción:** empleados, contratos y conceptos se referencian por identidad; insertar o reordenar datos no desalinea resultados.
- **Entradas:** —.
- **Resultado esperado:** integridad estructural.
- **Dependencias:** —.
- **Parámetros configurables:** no.
- **Nota:** corrige la causa raíz de los errores de referencia del Excel.

### R-TRV-04 — Cambios en maestros no alteran el pasado `[v1]`

- **Descripción:** un cambio en contrato o novedad afecta liquidaciones futuras o reliquidaciones explícitas, nunca las ya cerradas.
- **Entradas:** cambio en maestro/novedad.
- **Resultado esperado:** aislamiento temporal de resultados.
- **Dependencias:** R-TRV-02.
- **Parámetros configurables:** no.

---

## Definiciones de bases de cálculo (referencia rápida)

| Base                   | Contenido                                             | Excluye                                        | Usada por                     |
| ---------------------- | ----------------------------------------------------- | ---------------------------------------------- | ----------------------------- |
| **Base salarial**      | Salario básico prorrateado por días                   | —                                              | Devengo, IBC                  |
| **IBC**                | Devengos salariales                                   | Auxilio de transporte; con piso/techo en SMMLV | Aportes empleado y patronales |
| **Base prestacional**  | Salario + auxilio de transporte                       | —                                              | Cesantías, intereses, prima   |
| **Base de vacaciones** | Salario                                               | Auxilio de transporte                          | Provisión de vacaciones       |
| **Base de retención**  | Devengado − deducciones obligatorias − rentas exentas | —                                              | Retención en la fuente (v2)   |

---

Este documento es la **referencia funcional viva** del módulo Payroll. Debe actualizarse a medida que se validen reglas con clientes reales y se promuevan capacidades de v2 a v1.
