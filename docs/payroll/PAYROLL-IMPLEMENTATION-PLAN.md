# Payroll — Plan de Implementación P0→P4

| Campo            | Valor                                           |
| ---------------- | ----------------------------------------------- |
| **Documento**    | Plan de implementación                          |
| **Fecha**        | 2026-07-03                                      |
| **Arquitectura** | ADR-002 rev. 2 (canónica)                       |
| **Estado**       | Aprobado — todo PR siguiente debe ejecutar esto |

---

## Preámbulo

Este documento es la **guía de implementación** para Claude.

- **Define qué**, **en qué orden**, **por qué** y **con qué dependencias**.
- **No rediseña** arquitectura.
- **No reabre** ADRs.
- **No escribe** código.
- **No crea** migraciones.

Arquitectura congelada. Dominio congelado. Solo ejecución.

---

# 1. Roadmap Completo

## P0 — Catálogos (~70% hecho)

**Objetivo:** Cerrar los catálogos que el núcleo de liquidación necesita como precondición.

**Dependencias:** Ninguna. Es la base.

**Criterio de finalización:**

- `ConceptCodigo` completo y documentado
- Factores de provisión en `ParametroLegalNomina` (no hardcoded)
- Calendario de períodos configurable por tenant
- Seed de parámetros legales actualizado a 2026

---

## P1 — Núcleo de Liquidación

**Objetivo:** Liquidadora mensual ordinaria completa hasta `APROBADA`, con congelamiento inmutable y fail-secure. Este es el 80% del valor de Payroll v1.

**Dependencias:** P0 completo.

**Criterio de finalización:**

- `ProcesoNómina` con máquina de estados `BORRADOR → CALCULADA → EN_REVISION → APROBADA`
- `Liquidación` (ex-`PayrollRun`) con snapshot inmutable por copia
- Salvaguarda fail-secure operando por empleado
- Reliquidación no destructiva (versiones, no delete+recreate)
- `Liquidation` renombrado a `Finiquito`, feature-flagged
- Desprendible derivado del cálculo aprobado
- Test de aceptación: liquidar enero 2026 de un colegio real y obtener el mismo neto que el Excel

---

## P2 — Integración Contable

**Objetivo:** Transición `APROBADA → CAUSADA` con causación en Ledger vía la capa de integración de Payroll.

**Dependencias:** P1 completo. Accounting C1 operativo (ya lo está).

**Criterio de finalización:**

- Mapper concepto→cuenta traduce resultado de nómina a comprobante balanceado
- Causación en misma transacción PostgreSQL que la aprobación
- Idempotencia por origen (`origenTipo='PAYROLL'`)
- Reliquidación genera comprobante de ajuste (no edita el original)
- Verificación: Σ débitos = Σ créditos para cada comprobante de nómina

---

## P3 — Integración con Treasury

**Objetivo:** Entregar datos de dispersión (netos por empleado + obligaciones a terceros) para que Treasury ejecute pagos.

**Dependencias:** P2 completo.

**Criterio de finalización:**

- Reporte de dispersión por empleado y por centro de costo
- Hitos de pago registrables (transición `CAUSADA → PAGADA → CERRADA`)
- Datos de cuenta bancaria accesibles desde Employees

---

## P4 — PILA

**Objetivo:** Generar archivo PILA a partir del resultado de nómina.

**Dependencias:** P2 completo. P3 no bloquea.

**Criterio de finalización:**

- Generación de archivo PILA (formato operador)
- Validación de estructura contra esquema oficial

---

## P5 — Nómina Electrónica

**Objetivo:** Generar documento soporte de nómina electrónica (DIAN).

**Dependencias:** P2 completo. P3 y P4 no bloquean.

**Criterio de finalización:**

- Documento soporte de nómina electrónica según resolución DIAN vigente
- Validación de estructura contra esquema oficial

---

# 2. Backlog Detallado

## P0 — Catálogos

| ID    | Unidad                             | Descripción                                                                                                                                                                      | Tamaño |
| ----- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| P0-U1 | Factores de provisión a parámetros | Migrar `FACTOR_PROV_*` del calculator a `ParametroLegalNomina`. Añadir columnas `pctProvPrima`, `pctProvCesantias`, `pctProvIntCesantias`, `pctProvVacaciones`. Actualizar seed. | S      |
| P0-U2 | Catálogo de conceptos completo     | Documentar `ConceptCodigo` como fuente canónica. Verificar que todo concepto del calculator tiene código. Añadir códigos faltantes si los hay.                                   | XS     |
| P0-U3 | Calendario de períodos             | Tabla `payroll_calendars` con `(tenantId, nombre, fechaInicio, fechaFin, diasBase, frecuencia)`. Seed con calendario 2026 mensual.                                               | S      |
| P0-U4 | Seed de parámetros legales 2026    | Actualizar `ParametroLegalNomina` con SMMLV 2026 ($1.423.500), auxilio, UVT, tasas vigentes.                                                                                     | XS     |
| P0-U5 | Catálogo de tipos de novedad       | Completar enum `PayrollNoveltyType` con todos los tipos del research (ABSENCE, MATERNITY, PATERNITY, ENTRY, EXIT, DEDUCTION_MANUAL).                                             | XS     |

---

## P1 — Núcleo de Liquidación

| ID     | Unidad                                | Descripción                                                                                                                                                                                          | Tamaño |
| ------ | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| P1-U1  | Renombrar `Liquidation` → `Finiquito` | Renombrar modelo, servicio, controller y DTOs. Feature-flag en módulo (no expuesto en API v1).                                                                                                       | S      |
| P1-U2  | Máquina de estados `ProcesoNómina`    | Migrar `PayrollPeriodStatus` de `DRAFT\|CLOSED` → `BORRADOR\|CALCULADA\|EN_REVISION\|APROBADA\|CAUSADA\|PAGADA\|CERRADA`. Service de transiciones con validación.                                    | M      |
| P1-U3  | Auditoría de transiciones             | `AuditLog` en cada transición de estado (quién, cuándo, desde, hacia, motivo). Bloquear transición si no se audita.                                                                                  | S      |
| P1-U4  | Snapshot inmutable de `Liquidación`   | Tabla `payroll_liquidacion_snapshots` con copia de: parámetros legales usados, código de concepto aplicado, insumos (salario base, contrato tipo, clase ARL, exoneración). Append-only, no editable. | M      |
| P1-U5  | Congelamiento al aprobar              | Al transitar a `APROBADA`: escribir snapshot (U4), marcar `Liquidación` como inmutable. Bloquear edición post-aprobación.                                                                            | M      |
| P1-U6  | Salvaguarda fail-secure               | Convertir warnings actuales en bloqueos: salario integral, sin contrato vigente, clase ARL inválida, contrato no soportado, divergencia salario empleado/contrato. Operar por empleado.              | M      |
| P1-U7  | Reliquidación no destructiva          | Sustituir `delete+recreate` por `nueva versión`. `ProcesoNómina.version` autoincremental. Previas versiones inmutables. Diferencia calculable.                                                       | M      |
| P1-U8  | Centros de costo en `Liquidación`     | Añadir `centroCostoId` a `Liquidación`. Poblar desde el contrato del empleado. Agregar al resultado de negocio.                                                                                      | S      |
| P1-U9  | Flujo de revisión/aprobación          | Endpoints: `submitForReview`, `approve`, `reject`. Validar segregación (revisor ≠ aprobador). Registrar actores.                                                                                     | M      |
| P1-U10 | Desprendible de pago                  | Servicio que deriva colilla desde `Liquidación` aprobada. Template de colilla (PDF o HTML).                                                                                                          | M      |
| P1-U11 | Reporte de resumen de nómina          | Endpoint de reporting: totales por concepto, por empleado, por centro de costo. Filtrable por período.                                                                                               | M      |
| P1-U12 | Refactor `PayrollRun` → `Liquidación` | Renombrar modelo, migrar FK `payrollRunId` → `liquidacionId`, actualizar todo el código. Este es el cambio más grande de P1.                                                                         | L      |
| P1-U13 | Test de aceptación — Excel vs sistema | Cargar el Excel del research como datos de prueba. Ejecutar liquidación. Comparar neto por empleado. Documentar diferencias.                                                                         | M      |

> **Nota sobre importación desde Excel:** la importación inicial de datos desde Excel forma parte del alcance funcional de v1 (ADR-002 §13, MVP §1). Su implementación reutilizará o extenderá el módulo `employee-import` ya existente. Por ese motivo no se descompone como unidad independiente dentro del roadmap del núcleo Payroll.

---

## P2 — Integración Contable

| ID    | Unidad                                 | Descripción                                                                                                                                                                                                                                                                                   | Tamaño |
| ----- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| P2-U1 | Mapper concepto→cuenta                 | Implementar capa de integración de Payroll: `ConceptoNomina` → `(cuenta débito, cuenta crédito)` vía `CuentaSistemaMap`. Roles ya existen: `SALARIOS_POR_PAGAR`, `APORTES_SALUD_POR_PAGAR`, `APORTES_PENSION_POR_PAGAR`, `PROVISION_PRESTACIONES`, `GASTO_SUELDOS`, `GASTO_APORTES_SOCIALES`. | M      |
| P2-U2 | Comprobante balanceado                 | Construir `comprobante` con Σ débitos = Σ créditos desde el mapper de P2-U1. Validar invariante I1 de ADR-001.                                                                                                                                                                                | M      |
| P2-U3 | Causación en misma transacción         | Transición `APROBADA → CAUSADA` ejecuta: (a) snapshot + (b) entrega comprobante al puerto contable + (c) actualiza estado, todo en `$transaction`.                                                                                                                                            | L      |
| P2-U4 | Idempotencia por origen                | `origenTipo='PAYROLL'`, `origenId=procesoNominaId`, `origenEvento='CAUSACION'`. Un proceso → exactamente un comprobante.                                                                                                                                                                      | M      |
| P2-U5 | Reliquidación como ajuste contable     | Segunda versión → comprobante de ajuste con `origenEvento='AJUSTE'`. Diferencia neta, no reemplazo del original.                                                                                                                                                                              | M      |
| P2-U6 | Test de integración Payroll→Accounting | Test end-to-end: crear nómina → calcular → aprobar → causar → verificar saldos contables.                                                                                                                                                                                                     | L      |

---

## P3 — Treasury

| ID    | Unidad                  | Descripción                                                                                            | Tamaño |
| ----- | ----------------------- | ------------------------------------------------------------------------------------------------------ | ------ |
| P3-U1 | Reporte de dispersión   | Endpoint que entrega: empleado, cuenta bancaria, neto, banco, tipo de cuenta. Agrupable por banco.     | M      |
| P3-U2 | Hitos de pago           | Endpoints: `markAsPaid(procesoNominaId)`, `markAsClosed(procesoNominaId)`. Transiciones con auditoría. | M      |
| P3-U3 | Obligaciones a terceros | Desglose de aportes patronales y parafiscales con entidad destino (EPS, AFP, ARL, CCF, SENA, ICBF).    | S      |

---

## P4 — PILA

| ID    | Unidad          | Descripción                                                                                         | Tamaño |
| ----- | --------------- | --------------------------------------------------------------------------------------------------- | ------ |
| P4-U1 | Generación PILA | Archivo ASCII/XML por operador PILA: empleados, IBC, aportes, novedades. Validación contra esquema. | L      |

---

## P5 — Nómina Electrónica

| ID    | Unidad                 | Descripción                                                          | Tamaño |
| ----- | ---------------------- | -------------------------------------------------------------------- | ------ |
| P5-U1 | Documento soporte DIAN | XML de nómina electrónica según resolución DIAN vigente. Validación. | L      |

---

# 3. Orden de Implementación

```
P0-U1 (Factores provisión) ──┐
P0-U2 (Catálogo conceptos)  ──┤
P0-U3 (Calendario)           ──┤── P0 (independientes entre sí)
P0-U4 (Seed 2026)            ──┤
P0-U5 (Tipos novedad)        ──┘
         │
         ▼
P1-U1  (Renombrar Liquidation → Finiquito)  ← no depende de nadie en P1
         │
         ▼
P1-U12 (PayrollRun → Liquidación)  ← el rename grande, habilita todo lo demás
         │
         ├──► P1-U2  (Máquina de estados)      ← usa el modelo renombrado
         │         │
         │         ▼
         │    P1-U3  (Auditoría transiciones)   ← depende de U2
         │
         ├──► P1-U4  (Snapshot inmutable)       ← usa el modelo renombrado
         │         │
         │         ▼
         │    P1-U5  (Congelamiento)             ← depende de U4 + U2
         │
         ├──► P1-U6  (Fail-secure)               ← usa el modelo renombrado
         │
         ├──► P1-U8  (Centros de costo)          ← usa el modelo renombrado
         │
         ├──► P1-U7  (Reliquidación)             ← depende de U2 + U4 + U5
         │
         ├──► P1-U9  (Flujo revisión/aprobación) ← depende de U2
         │
         ├──► P1-U11 (Reporte resumen)           ← depende de U2 + U8
         │
         ├──► P1-U10 (Desprendible)              ← depende de U2 + U5
         │
         └──► P1-U13 (Test aceptación Excel)     ← depende de TODO P1
                  │
                  ▼
            P2-U1 (Mapper concepto→cuenta)
                  │
                  ▼
            P2-U2 (Comprobante balanceado)
                  │
                  ├──► P2-U3 (Causación misma tx)
                  │
                  ├──► P2-U4 (Idempotencia)
                  │
                  ├──► P2-U5 (Reliquidación ajuste contable)
                  │
                  └──► P2-U6 (Test integración)
                           │
                           ▼
                     P3-U1 (Reporte dispersión)
                           │
                           ▼
                     P3-U2 (Hitos pago)
                           │
                           ▼
                     P3-U3 (Obligaciones terceros)
                           │
                           ▼
                      P4-U1 (PILA)
                            │
                            ▼
                      P5-U1 (Nómina electrónica)
```

---

# 4. Dependencias Detalladas

## P0

| Unidad | Depende de                       | Desbloquea                                |
| ------ | -------------------------------- | ----------------------------------------- |
| P0-U1  | `ParametroLegalNomina` existente | P1-U4, P1-U5, P1-U6 (factores legales)    |
| P0-U2  | —                                | P0-U1, P1-U4 (códigos estables)           |
| P0-U3  | —                                | P1-U2 (días base)                         |
| P0-U4  | P0-U1 (misma tabla)              | Todo P1                                   |
| P0-U5  | —                                | P1-U6 (tipos de novedad para fail-secure) |

## P1

| Unidad | Depende de           | Desbloquea                                         |
| ------ | -------------------- | -------------------------------------------------- |
| P1-U1  | —                    | P1-U12 (evita colisión de nombres)                 |
| P1-U2  | P1-U12, P0-U3        | P1-U3, P1-U5, P1-U7, P1-U9, P1-U11, P1-U10, P1-U13 |
| P1-U3  | P1-U2                | —                                                  |
| P1-U4  | P1-U12, P0-U1, P0-U2 | P1-U5, P1-U7                                       |
| P1-U5  | P1-U2, P1-U4         | P1-U7, P1-U10                                      |
| P1-U6  | P1-U12, P0-U1, P0-U5 | P1-U13                                             |
| P1-U7  | P1-U2, P1-U4, P1-U5  | P2-U5                                              |
| P1-U8  | P1-U12               | P1-U11, P2-U1                                      |
| P1-U9  | P1-U2                | P1-U13                                             |
| P1-U10 | P1-U2, P1-U5         | P1-U13                                             |
| P1-U11 | P1-U2, P1-U8         | P1-U13                                             |
| P1-U12 | P1-U1                | P1-U2, P1-U4, P1-U6, P1-U8                         |
| P1-U13 | Todo P1              | P2                                                 |

## P2

| Unidad | Depende de         | Desbloquea   |
| ------ | ------------------ | ------------ |
| P2-U1  | P1 completo, P1-U8 | P2-U2        |
| P2-U2  | P2-U1              | P2-U3        |
| P2-U3  | P2-U2, P1-U5       | P2-U4, P2-U6 |
| P2-U4  | P2-U3              | —            |
| P2-U5  | P2-U3, P1-U7       | P2-U6        |
| P2-U6  | P2-U3, P2-U5       | P3, P4       |

## P3

| Unidad | Depende de  | Desbloquea |
| ------ | ----------- | ---------- |
| P3-U1  | P2 completo | P3-U2      |
| P3-U2  | P3-U1       | —          |
| P3-U3  | P3-U1       | —          |

## P4

| Unidad | Depende de  | Desbloquea |
| ------ | ----------- | ---------- |
| P4-U1  | P2 completo | —          |

## P5

| Unidad | Depende de  | Desbloquea |
| ------ | ----------- | ---------- |
| P5-U1  | P2 completo | —          |

---

# 5. Riesgos

## P0 — Catálogos

| Riesgo                                                                                          | Tipo    | Mitigación                                                                                                 |
| ----------------------------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------- |
| `ParametroLegalNomina` tiene `updatedAt` que permitiría editar filas usadas por runs históricos | Técnico | Se mitiga en P1-U4 (snapshot por copia, no FK). Hasta entonces, no editar filas con runs asociados.        |
| Factores de provisión actualmente hardcoded en calculator                                       | Técnico | P0-U1 los mueve a DB. Si se olvida actualizar seed, el calculator usaría valores viejos. Validar con test. |
| Deuda técnica: columnas nullable heredadas de runs N1                                           | Técnico | Sanear en P1-U12 (migración de rename). Definir política: NULL → default o columna eliminada.              |

## P1 — Núcleo

| Riesgo                                                                                    | Tipo      | Mitigación                                                                                                                     |
| ----------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------ |
| El rename `PayrollRun` → `Liquidación` rompe referencias en cascada                       | Técnico   | P1-U12 es la unidad más grande de P1 por esta razón. Migración atómica con tests de humo.                                      |
| La salvaguarda fail-secure podría bloquear empleados que antes se liquidaban (aunque mal) | Funcional | Documentar el cambio. La transición de "warn and continue" a "block" es la decisión D10 del ADR.                               |
| Datos de producción existentes que no encajen en el nuevo modelo                          | Técnico   | Cuestión abierta del ADR §18. Si no hay datos de producción, se hace clean start. Si los hay, se necesita script de migración. |
| Procesamiento síncrono en request HTTP con planta grande                                  | Técnico   | Deuda técnica identificada en ADR §16. Aceptada para v1. Mitigación: timeout generoso en el endpoint de cálculo.               |

## P2 — Accounting

| Riesgo                                                            | Tipo      | Mitigación                                                                                                   |
| ----------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------ |
| Descuadre entre el resultado de Payroll y el comprobante contable | Funcional | El mapper es código puro y testeable. Test P2-U6 verifica extremo a extremo.                                 |
| `$transaction` demasiado grande (cálculo + causación)             | Técnico   | El cálculo ya se hizo en P1. En P2 solo se mapea y se contabiliza. Si el mapper es puro, no agrega latencia. |
| Reliquidación que requiera revertir causación y re-causar         | Funcional | ADR-002 §11: la diferencia viaja como comprobante de ajuste, nunca borrando el original. Inmutable.          |

## P3 — Treasury

| Riesgo                                      | Tipo      | Mitigación                                                          |
| ------------------------------------------- | --------- | ------------------------------------------------------------------- |
| Integración bancaria prematura              | Funcional | v1 solo entrega datos. No se integra con bancos (ADR-002 §13, X11). |
| Cuenta bancaria del empleado desactualizada | Funcional | Responsabilidad de Employees. Payroll solo lee.                     |

## P4 — PILA

| Riesgo                             | Tipo      | Mitigación                                                                  |
| ---------------------------------- | --------- | --------------------------------------------------------------------------- |
| Cambio regulatorio en formato PILA | Funcional | P4 se aísla en módulo separado. Cambios de formato no afectan P0-P3.        |
| Complejidad del esquema oficial    | Técnico   | Validación automatizada contra XSD/schema. No construir sin especificación. |

## P5 — Nómina Electrónica

| Riesgo                             | Tipo      | Mitigación                                                                  |
| ---------------------------------- | --------- | --------------------------------------------------------------------------- |
| Cambio regulatorio en formato DIAN | Funcional | P5 se aísla en módulo separado. Cambios de formato no afectan P0-P4.        |
| Complejidad del esquema oficial    | Técnico   | Validación automatizada contra XSD/schema. No construir sin especificación. |

---

# 6. Estrategia Git

## Ramas

```
main ←── feat/payroll-p0-catalogos
   ←── feat/payroll-p1-nucleo          (depende de p0 mergeado)
   ←── feat/payroll-p2-accounting       (depende de p1 mergeado)
   ←── feat/payroll-p3-treasury         (depende de p2 mergeado)
   ←── feat/payroll-p4-pila             (depende de p2 mergeado)
   ←── feat/payroll-p5-nomina-electronica (depende de p2 mergeado)
```

**Regla:** una rama por fase (P0, P1, P2, P3, P4, P5). No una rama por unidad.

## Tamaño de PR

- **PR ideal:** 200–400 líneas de diff (sin contar migraciones automáticas).
- **PR máximo:** 800 líneas. Si una unidad excede eso, dividirla en sub-PRs.
- **PR de migración de rename (P1-U12):** inevitablemente grande. Aceptado como excepción. Revisar con cuidado extra.

## Tamaño de commits

- **Commit atómico:** una unidad de P0-Ux / P1-Ux por commit.
- **Mensaje:** convencional commit. Ej: `feat(payroll): P0-U1 mover factores de provisión a ParametroLegalNomina`
- **No mezclar:** refactor + feature en el mismo commit.

## Flujo

```
git checkout -b feat/payroll-p0-catalogos
# P0-U1 → commit
# P0-U2 → commit
# ...
# PR → review → merge a main

git checkout -b feat/payroll-p1-nucleo
# P1-U1 → commit
# ...
# PR → review → merge a main
```

---

# 7. Prompts Futuros para Claude

Cada prompt está diseñado para ser ejecutado en una sesión independiente, con el contexto del ADR-002 y este plan ya cargados.

## P0

| Prompt                     | Alcance                                                                                                                                            |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `P0-U1-factores-provision` | Añadir columnas de factores de provisión a `ParametroLegalNomina`, actualizar seed, actualizar calculator para leer de params en vez de constantes |
| `P0-U2-catalogo-conceptos` | Auditar `ConceptCodigo` contra el research, documentar, añadir códigos faltantes                                                                   |
| `P0-U3-calendario`         | Crear tabla `PayrollCalendar`, seed mensual 2026, exponer endpoint CRUD                                                                            |
| `P0-U4-seed-2026`          | Actualizar seed de `ParametroLegalNomina` con SMMLV 2026 y tarifas vigentes                                                                        |
| `P0-U5-tipos-novedad`      | Completar `PayrollNoveltyType` con ABSENCE, MATERNITY, PATERNITY, ENTRY, EXIT, DEDUCTION_MANUAL                                                    |

## P1

| Prompt                         | Alcance                                                                                                  |
| ------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `P1-U1-rename-finiquito`       | Renombrar modelo `Liquidation` y todo su ecosistema a `Finiquito`. Feature-flag.                         |
| `P1-U2-maquina-estados`        | Migrar `PayrollPeriodStatus` al enum completo. Service de transiciones. Tests de estados ilegales.       |
| `P1-U3-auditoria-transiciones` | `AuditLog` en cada transición de estado. Fail-secure: si no audita, no transiciona.                      |
| `P1-U4-snapshot-inmutable`     | Crear tabla `LiquidacionSnapshot`. Service que escribe copia de params + conceptos + insumos al aprobar. |
| `P1-U5-congelamiento`          | Lógica de inmutabilidad post-aprobación. Bloquear escritura en Liquidación aprobada.                     |
| `P1-U6-fail-secure`            | Convertir warnings en bloqueos. Lista de casos del ADR §10. Tests por cada caso.                         |
| `P1-U7-reliquidacion`          | Versionado de `Liquidacion`. Service de reliquidación. Tests de versiones.                               |
| `P1-U8-centros-costo`          | Añadir `centroCostoId` a `Liquidacion`. Poblar desde contrato.                                           |
| `P1-U9-flujo-aprobacion`       | Endpoints `submitForReview`, `approve`, `reject`. Validación revisor ≠ aprobador.                        |
| `P1-U10-desprendible`          | Service de colilla. Template PDF/HTML. Endpoint de descarga.                                             |
| `P1-U11-reporte-resumen`       | Endpoint de reporting agregado por concepto, empleado, centro de costo.                                  |
| `P1-U12-rename-liquidacion`    | Renombrar `PayrollRun` a `Liquidacion`. Actualizar modelo, migración, servicios, controller, tests.      |
| `P1-U13-test-excel`            | Datos de prueba desde el Excel del research. Comparación de netos.                                       |

## P2

| Prompt                         | Alcance                                                                                       |
| ------------------------------ | --------------------------------------------------------------------------------------------- |
| `P2-U1-mapper-concepto-cuenta` | Capa de integración: `ConceptCodigo` → `(cuentaDebito, cuentaCredito)` vía `CuentaSistemaMap` |
| `P2-U2-comprobante-balanceado` | Construir comprobante con Σ débitos = Σ créditos desde el mapper                              |
| `P2-U3-causacion`              | Transacción `APROBADA → CAUSADA` que incluye causación en Ledger                              |
| `P2-U4-idempotencia`           | Garantizar `(tenant, origenTipo, origenId, origenEvento)` único                               |
| `P2-U5-ajuste-contable`        | Reliquidación → comprobante de ajuste por diferencia                                          |
| `P2-U6-test-integracion`       | Test e2e Payroll→Accounting                                                                   |

## P3

| Prompt                        | Alcance                                      |
| ----------------------------- | -------------------------------------------- |
| `P3-U1-dispersion`            | Endpoint de datos de dispersión bancaria     |
| `P3-U2-hitos-pago`            | Transiciones `CAUSADA → PAGADA → CERRADA`    |
| `P3-U3-obligaciones-terceros` | Desglose de obligaciones con entidad destino |

## P4

| Prompt       | Alcance                    |
| ------------ | -------------------------- |
| `P4-U1-pila` | Generación de archivo PILA |

## P5

| Prompt                     | Alcance                              |
| -------------------------- | ------------------------------------ |
| `P5-U1-nomina-electronica` | Generación de documento soporte DIAN |

---

# 8. Checklist Maestro

## P0 — Catálogos

- [ ] P0-U1 — Factores de provisión en `ParametroLegalNomina`
- [ ] P0-U2 — Catálogo de conceptos completo
- [ ] P0-U3 — Calendario de períodos
- [ ] P0-U4 — Seed de parámetros legales 2026
- [ ] P0-U5 — Tipos de novedad completos

## P1 — Núcleo de Liquidación

- [ ] P1-U1 — Renombrar `Liquidation` → `Finiquito`
- [ ] P1-U12 — Renombrar `PayrollRun` → `Liquidación`
- [ ] P1-U2 — Máquina de estados
- [ ] P1-U3 — Auditoría de transiciones
- [ ] P1-U4 — Snapshot inmutable
- [ ] P1-U5 — Congelamiento al aprobar
- [ ] P1-U6 — Salvaguarda fail-secure
- [ ] P1-U7 — Reliquidación no destructiva
- [ ] P1-U8 — Centros de costo
- [ ] P1-U9 — Flujo de revisión/aprobación
- [ ] P1-U10 — Desprendible de pago
- [ ] P1-U11 — Reporte de resumen
- [ ] P1-U13 — Test de aceptación Excel

## P2 — Integración Contable

- [ ] P2-U1 — Mapper concepto→cuenta
- [ ] P2-U2 — Comprobante balanceado
- [ ] P2-U3 — Causación en misma transacción
- [ ] P2-U4 — Idempotencia por origen
- [ ] P2-U5 — Reliquidación como ajuste contable
- [ ] P2-U6 — Test de integración

## P3 — Treasury

- [ ] P3-U1 — Reporte de dispersión
- [ ] P3-U2 — Hitos de pago
- [ ] P3-U3 — Obligaciones a terceros

## P4 — PILA

- [ ] P4-U1 — Generación PILA

## P5 — Nómina Electrónica

- [ ] P5-U1 — Documento soporte DIAN

---

## Estado del módulo Payroll

| Fase                    | Estado           | Fecha      |
| ----------------------- | ---------------- | ---------- |
| Research                | Completado       | 2026-06    |
| ADR-002 rev. 2          | Completado       | 2026-07-03 |
| Plan de implementación  | Completado       | 2026-07-03 |
| P0 — Catálogos          | ~70% — pendiente | —          |
| P1 — Núcleo             | Pendiente        | —          |
| P2 — Accounting         | Pendiente        | —          |
| P3 — Treasury           | Pendiente        | —          |
| P4 — PILA               | Pendiente        | —          |
| P5 — Nómina Electrónica | Pendiente        | —          |

---

_Fin del plan de implementación._
