# C2 Reporting — Arquitectura

---

## 1. Arquitectura

### 1.1 Principio rector

**Toda consulta es SELECT sobre tablas existentes. C2 no escribe una sola fila.**

Los saldos se derivan en cada consulta desde `movimientos_contables`. No se almacenan. No se cachean. No hay tablas nuevas.

Esto es consistente con I2 (inmutabilidad), I5 (cuentas imputables), y con el principio de que "los movimientos son la fuente de verdad, los saldos se derivan".

---

### 1.2 Responsabilidad única

```
┌──────────────────────────────────────────────────┐
│  ReportingService  (read-only)                   │
│                                                  │
│  SELECT ComprobanteContable                      │
│  SELECT MovimientoContable                       │
│  JOIN CuentaContable, Tercero, CentroCosto       │
│  GROUP BY / SUM (balance de prueba)              │
│  ORDER BY fecha, numero (diario, mayor)          │
│                                                  │
│  NUNCA: INSERT, UPDATE, DELETE, Transaction      │
└──────────────────────────────────────────────────┘
```

`ReportingService` consulta directamente mediante Prisma. No depende de `LedgerService` ni de ningún otro servicio del módulo contable.

Valida únicamente:

- `tenantId` — pertenece al contexto del request
- `periodoId` — existe y pertenece al tenant
- Parámetros de consulta — rangos de fecha, cuentas, terceros

El puerto de escritura (`LedgerService`) y el módulo de consulta (`ReportingService`) no se conocen entre sí.

---

### 1.3 Modelo de datos — sin tablas nuevas

```
Todas las consultas usan exclusivamente:

  comprobantes_contables  ─── (tenantId, fecha, estado, tipoComprobanteId, periodoId)
  movimientos_contables   ─── (tenantId, cuentaId, terceroId, centroCostoId, debito, credito)

Con JOINs de solo-lectura a:
  cuentas_contables       ─── (codigo, nombre, nivel)
  terceros                ─── (tipoDocumento, numeroDocumento, razonSocial)
  centros_costo           ─── (codigo, nombre)
  tipos_comprobante       ─── (codigo, nombre)
  periodos_contables      ─── (anio, mes, estado)
```

El append-only se respeta porque ReportingService nunca emite INSERT, UPDATE, ni DELETE.

---

### 1.4 Primitiva única de saldo

ADR-001 sección 6 anticipa:

> _una sola primitiva `saldos(tenant, rangoCuentas, rangoFechas, [tercero], [centroCosto])` a partir de la cual se derivan todos los reportes_

C2 implementa esa primitiva:

```
saldos(filtros) =
  SELECT cuentaId,
         SUM(debito)  AS totalDebito,
         SUM(credito) AS totalCredito,
         SUM(debito) - SUM(credito) AS saldo  -- débito = saldo deudor positivo
  FROM movimientos_contables
  WHERE tenantId = $tenantId
    AND comprobanteId IN (
      SELECT id FROM comprobantes_contables
      WHERE estado = 'CONTABILIZADO'
        AND fecha >= $fechaInicio AND fecha <= $fechaFin
    )
    [AND cuentaId BETWEEN $cuentaDesde AND $cuentaHasta]
    [AND terceroId = $terceroId]
    [AND centroCostoId = $centroCostoId]
  GROUP BY cuentaId
```

Todos los reportes de C2 se construyen sobre esta consulta o variantes de ella.

---

## 1.5 Casos de uso

C2 expone siete capacidades de consulta. La decisión de si se invocan mediante REST, GraphQL, CLI, exportación batch o cualquier otro mecanismo pertenece a la capa de transporte, no a este módulo.

| #   | Caso de uso                  | Descripción                                                                                                   | Fuente principal                             |
| --- | ---------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| U1  | `ObtenerLibroDiario`         | Libro diario paginado. Comprobantes completos ordenados por fecha, número.                                    | `ComprobanteContable` + `MovimientoContable` |
| U2  | `ObtenerLibroMayor`          | Libro mayor para una cuenta. Movimientos ordenados cronológicamente con saldo corriente calculado en memoria. | `MovimientoContable` filtrado por `cuentaId` |
| U3  | `ObtenerBalancePrueba`       | Suma de débitos y créditos agrupada por cuenta a una fecha de corte.                                          | `MovimientoContable` + `GROUP BY cuentaId`   |
| U4  | `ObtenerAuxiliarTercero`     | Mayor filtrado por cuenta + tercero.                                                                          | `MovimientoContable` + `JOIN Tercero`        |
| U5  | `ObtenerAuxiliarCentroCosto` | Mayor filtrado por cuenta + centro de costo.                                                                  | `MovimientoContable` + `JOIN CentroCosto`    |
| U6  | `ObtenerBalanceGeneral`      | Posición financiera a fecha de corte: Activo, Pasivo, Patrimonio agrupados por clase/grupo PUC.               | `saldos()` agrupado por clase (1, 2, 3)      |
| U7  | `ObtenerEstadoResultados`    | Resultado de un rango: Ingresos − Gastos − Costos = Utilidad/Pérdida del ejercicio.                           | `saldos()` agrupado por clase (4, 5, 6, 7)   |

U6 y U7 son proyecciones estructuradas de `saldos()`, de la misma naturaleza de solo-lectura que U1–U5. **C3 (cierre contable) consume U6 y U7 para validar el cuadre previo al cierre mensual y para calcular el neto del cierre anual; C2 no conoce ni depende de C3.**

**Parámetros comunes de consulta:**

```
tenantId       (obligatorio, del contexto)
fechaInicio    (opcional, default: inicio del período actual)
fechaFin       (opcional, default: fin del período actual)
periodoId      (opcional, alternativo a fechas)
page / limit   (paginación)
```

**Parámetros específicos por caso de uso:**

```
U1: + tipoComprobanteId, estado
U2: + cuentaId (obligatorio)
U3: + nivel (profundidad PUC), cuentaDesde, cuentaHasta
U4: + cuentaId, terceroId
U5: + cuentaId, centroCostoId
U6: + fechaCorte (o periodoId)
U7: + fechaInicio, fechaFin (o periodoId)
```

**Ninguno de estos casos de uso acepta operaciones de escritura.**

---

## 2. Riesgos

| #      | Riesgo                                                                                   | Impacto | Probabilidad     | Mitigación                                                                                                                                                                                       |
| ------ | ---------------------------------------------------------------------------------------- | ------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **R1** | `ObtenerBalancePrueba` sobre millones de movimientos degrada con GROUP BY masivo         | Medio   | Baja (escala C2) | Fase 5: índices compuestos + EXPLAIN ANALYZE. Si >1M movimientos, paginar con `LIMIT + OFFSET` o cursor.                                                                                         |
| **R2** | `ObtenerLibroMayor` con saldo corriente en memoria: O(n) en app para cuentas muy activas | Bajo    | Baja             | El saldo corriente se calcula en el backend secuencialmente. Para cuentas con >100K movimientos, paginar y calcular saldo inicial desde `saldos()` previamente.                                  |
| **R3** | Confusión del usuario: "balance de prueba" vs "balance de cierre de período"             | Alto    | Alta             | Documentar: C2 entrega saldo _a fecha de corte_, no _a cierre de período_. El cierre es C3.                                                                                                      |
| **R4** | Scope creep: piden Flujo de Efectivo o Estado de Cambios en el Patrimonio en C2          | Alto    | Media            | Balance General (U6) y Estado de Resultados (U7) sí son de C2. Flujo de Efectivo, ECP y notas quedan diferidos (C4+); si aparecen en requisitos, es un nuevo ADR.                                |
| **R5** | Rendimiento de JOINs con cuentas, terceros, centros de costo en reportes paginados       | Bajo    | Media            | Los JOINs son sobre FKs indexadas. No hay riesgo significativo hasta >100K registros por página.                                                                                                 |
| **R6** | `numero` de comprobante es NULL en BORRADOR, lo que puede romper ordenamientos           | Bajo    | Media            | Solo incluir `estado = 'CONTABILIZADO'` por defecto en diario y mayor. Incluir borradores solo bajo flag explícito `incluirBorradores=true` con ordenamiento alternativo por `fecha, createdAt`. |

---

## 3. Plan de implementación

Cada fase es una rama independiente, mergeable y desplegable por sí misma. Ninguna fase modifica Ledger ni ADR-001.

---

### Fase 1 — Libro Diario

**Rama:** `feat/c2-diario`

**Alcance:** U1 exclusivamente.

**Archivos estimados (2):**

- `ReportingService` con método `obtenerLibroDiario(tenantId, filtros)`
- Tests (unitarios: 3 comprobantes, verificar orden, paginación)

**Validación:** consulta con `fechaInicio=2026-01-01` devuelve comprobantes ordenados con sus movimientos anidados.

**Dependencias:** ninguna fase posterior.

**Tiempo estimado:** 1 sesión.

---

### Fase 2 — Libro Mayor

**Rama:** `feat/c2-mayor`

**Alcance:** U2 exclusivamente.

**Archivos estimados (1 adicional):**

- `ReportingService.obtenerLibroMayor(tenantId, cuentaId, filtros)` → movimientos con `saldoCorriente` calculado incrementalmente

**Validación:** Para una cuenta con 5 movimientos, el último `saldoCorriente` coincide con `SUM(debito) - SUM(credito)` de balance de prueba (validación cruzada manual).

**Dependencias:** ninguna. Independiente de Fase 1.

**Tiempo estimado:** 1 sesión.

---

### Fase 3 — Balance de Prueba

**Rama:** `feat/c2-balance-prueba`

**Alcance:** U3 exclusivamente. Implementa la primitiva `saldos()`.

**Archivos estimados (1 adicional):**

- `ReportingService.obtenerBalancePrueba(tenantId, filtros)` → lista de `{ cuentaId, codigo, nombre, totalDebito, totalCredito }`
- Validación: total débitos == total créditos (I1) para el rango consultado

**Validación:** El balance de prueba siempre cuadra (débitos == créditos) porque se deriva de movimientos que ya cumplen I1 al ser contabilizados.

**Dependencias:** ninguna. Independiente de Fase 1 y 2.

**Tiempo estimado:** 1 sesión.

---

### Fase 4 — Auxiliares

**Rama:** `feat/c2-auxiliares`

**Alcance:** U4 + U5.

**Archivos estimados (2 adicionales):**

- `ReportingService.obtenerAuxiliarTercero(...)` → mismo patrón que mayor, filtrado adicionalmente por `terceroId`
- `ReportingService.obtenerAuxiliarCentroCosto(...)` → mismo patrón, filtrado por `centroCostoId`

**Validación:** La suma de auxiliares por tercero para una cuenta == total de la cuenta en balance de prueba (validación de integridad).

**Dependencias:** ninguna si se usa la misma estrategia de consulta que Fase 2. Pero lógicamente conviene después de F2 para reutilizar el patrón.

**Tiempo estimado:** 1 sesión.

---

### Fase 5 — Índices y performance

**Rama:** `feat/c2-performance`

**Alcance:** Solamente después de tener datos reales o un seed de volumen significativo.

**Actividades:**

- `EXPLAIN ANALYZE` sobre las 5 consultas con >10K comprobantes
- Identificar sequential scans
- Evaluar índices compuestos candidatos:
  - `(tenantId, fecha, estado)` en `comprobantes_contables`
  - `(tenantId, cuentaId, comprobanteId)` en `movimientos_contables`
- Agregar solo los índices que `EXPLAIN` justifique

**No hacer en esta fase:** caché, vistas materializadas, réplicas de lectura, agregaciones precalculadas.

**Dependencias:** Fases 1-4 completadas.

**Tiempo estimado:** postergar hasta tener datos reales. No es bloqueante.

---

## 4. Orden recomendado

```
Fase 1 (diario) ──┐
                  ├── Son independientes entre sí
Fase 2 (mayor) ──┤   Pueden implementarse en paralelo
                  │   si hay múltiples desarrolladores
Fase 3 (balance) ─┘

Fase 4 (auxiliares)  ← Después de Fase 2 (reutiliza patrón mayor)

Fase 5 (índices)     ← Después de Fases 1-4 con datos reales
```

**Orden secuencial recomendado (un solo desarrollador):**

```
1. feat/c2-balance-prueba   (la primitiva saldos() es la base conceptual)
2. feat/c2-diario            (el reporte más consultado por contadores)
3. feat/c2-mayor             (depende conceptualmente de entender saldos)
4. feat/c2-auxiliares        (extensión natural de mayor)
5. feat/c2-performance       (solo cuando haya volumen)
```

**Justificación del orden:** Implementar `balance-prueba` primero obliga a resolver `saldos()`, que es la consulta más compleja (GROUP BY + SUM). Una vez que `saldos()` funciona, `diario` y `mayor` son consultas más simples que se benefician de tener la base de agregación ya probada. Además, `balance-prueba` sirve como validación cruzada para `mayor` (el saldo corriente del último movimiento debe coincidir con el `SUM` de `balance-prueba` para esa cuenta).

---

### Resumen de invariantes que C2 debe respetar

| Invariante                   | Cómo lo respeta C2                                                                 |
| ---------------------------- | ---------------------------------------------------------------------------------- |
| I1 (débitos == créditos)     | `ObtenerBalancePrueba` verifica que `SUM(debito) == SUM(credito)` en toda consulta |
| I2 (inmutabilidad)           | Solo SELECT. Ninguna mutación.                                                     |
| I3 (no postear a cerrados)   | No aplica: C2 no postea                                                            |
| I8 (idempotencia por origen) | No aplica: C2 no postea                                                            |
| Append-only                  | Todas las consultas son read-only sobre las tablas existentes                      |
