# C3 Cierre Contable — Arquitectura

| Campo          | Valor                                                                             |
| -------------- | --------------------------------------------------------------------------------- |
| **Estado**     | Propuesto                                                                         |
| **Fecha**      | 2026-07-01                                                                        |
| **Decisores**  | Arquitectura · Contabilidad funcional                                             |
| **Ámbito**     | SaaS multiempresa "La Oficina Nítida" — `apps/api` (NestJS · Prisma · PostgreSQL) |
| **Deriva de**  | ADR-001 §5 (estados de período), §9 (fase C3)                                     |
| **Depende de** | C1 (Ledger Core), C2 (Reporting)                                                  |
| **Habilita**   | C4 (Facturación), C5 (Nómina), C6 (Cartera + Tesorería)                           |

---

## 1. Contexto

C0 sembró los catálogos. C1 entregó el puerto único de escritura (`LedgerService`): comprobantes balanceados, inmutables, numerados, idempotentes por origen (I1–I9). C2 entregó **toda la capa de consulta de solo-lectura** (`ReportingService`): diario, mayor, balance de prueba, auxiliares y — como se formaliza en este ADR — **Balance General y Estado de Resultados**, todos derivados en vivo de `movimientos_contables` mediante la primitiva `saldos()`, sin escribir una sola fila.

Falta la capa que **cierra el ejercicio contable**. Hoy:

- **Ningún componente transiciona un período a `CERRADO`.** `LedgerService` respeta I3 (no postear en cerrado), pero `PeriodosContablesService` solo crea, genera el año y consulta; nadie escribe el estado `CERRADO`. La invariante I3 existe sin el mecanismo que la activa.
- **No existe reapertura.** ADR-001 §5 la describe como rara y auditada, pero no está construida.
- **No hay cierre anual.** ADR-001 §5 anticipa "un comprobante que cancela las clases de resultado (4, 5, 6, 7) contra patrimonio"; ese asiento no se genera.

C3 es la fase que **cierra el ciclo contable manual completo** (C0–C3 según ADR-001 §9) antes de conectar los módulos fuente en C4–C5. **C3 es exclusivamente cierre: no incorpora ninguna funcionalidad de reporting.**

**Restricción rectora (heredada):** el motor contable es infraestructura habilitante para nómina legal y contratación masiva, no un ERP. Toda capacidad de C3 debe justificarse contra un cierre contable legalmente correcto para Colombia. Lo demás se difiere.

---

## 2. Decisión

### 2.1 C3 es cierre puro; el reporting es de C2

**El Balance General y el Estado de Resultados son capacidades de C2 (Reporting), no de C3.** Son proyecciones estructuradas de la primitiva `saldos()`, de la misma naturaleza de solo-lectura que el balance de prueba, el diario y el mayor. Su hogar arquitectónico es `ReportingService`.

C3 **consume** esas capacidades — no las implementa — con un único fin: **validar y ejecutar el cierre.** Concretamente, C3 lee de C2 el resultado del ejercicio (Estado de Resultados / saldos de las clases 4–7) para construir el asiento de cierre anual, y lee el cuadre para validar el cierre mensual. **C3 no expone reportes, no formatea estados financieros y no calcula saldos.**

> Nota de coherencia entre ADR: ADR-001 §9 enunció "Balance general, estado de resultados" bajo el rótulo de C3, y C2-reporting §R4 los había diferido a C3. Este ADR **reasigna esas dos capacidades a C2** (donde ya vive la agregación `saldos()`) y deja a C3 como cierre puro. La reasignación no cambia la naturaleza de esas capacidades (siguen siendo lectura pura sobre `saldos()`); solo fija su responsabilidad en el módulo correcto.

### 2.2 Las dos escrituras de C3

C3 introduce exactamente **dos escrituras**, y ninguna rompe el modelo append-only del ADR-001:

- **Transición de estado de período** (`ABIERTO ↔ CERRADO`): es la única mutación _nueva_ que C3 posee de forma directa. Actúa sobre `periodos_contables`, no sobre libros; no toca comprobantes ni movimientos.
- **Comprobante de cierre anual**: se genera **a través del puerto único `LedgerService.registrarComprobante`**, exactamente igual que cualquier módulo fuente. C3 construye un borrador balanceado que cancela las clases de resultado contra patrimonio y lo entrega al puerto. **C3 nunca inserta comprobantes ni movimientos directamente.**

### 2.3 Principios no negociables

1. **C3 no hace reporting.** Balance General, Estado de Resultados y cualquier otra vista financiera pertenecen a C2. C3 los consume por el puerto de lectura de C2; no los construye ni los reexpone.
2. **C3 nunca calcula saldos.** Toda cifra financiera que el cierre necesita proviene de `saldos()` de C2. C3 no reimplementa agregación contable (ver invariante C3-I10).
3. **El cierre anual pasa por el puerto, no lo rodea.** El asiento respeta I1–I8 por construcción. C3 es, para ese asiento, un módulo fuente más.
4. **Cierre cronológico y reapertura LIFO** (decisión formal §2.4).
5. **Cero tablas nuevas, cero columnas nuevas.** `PeriodoContable.estado/cerradoAt/cerradoPorId`, `TipoComprobante 'CC'` y el patrimonio de resultado por `CuentaSistemaMap` ya existen. C3 es lógica, no migración estructural.
6. **El libro es perpetuo: no hay asiento de apertura.** Las cuentas de balance (clases 1, 2, 3) arrastran su saldo entre ejercicios; el cierre anual solo cancela las clases de resultado (4, 5, 6, 7).
7. **La corrección posterior al cierre sigue una política explícita** (§10): por defecto, ajuste en período posterior abierto; la reapertura es la excepción restringida.

### 2.4 Decisión arquitectónica: orden de cierre y reapertura

- **Los períodos se cierran en orden cronológico estricto.** No se cierra el mes _n_ si el mes _n-1_ del mismo tenant sigue `ABIERTO`. El cierre secuencial impide huecos de estado (un mes abierto rodeado de meses cerrados) que invalidarían la lectura de saldos acumulados y el cierre anual.
- **La reapertura solo procede sobre el período cerrado más reciente (LIFO).** No se reabre un mes intermedio dejando meses posteriores cerrados. Si hay que corregir un mes anterior, se reabre en orden inverso al de cierre, un período a la vez. Esto preserva el invariante de que la frontera "cerrado/abierto" sea siempre un único punto en la línea de tiempo.

---

## 3. Qué pertenece y qué NO pertenece a C3

### 3.1 Pertenece a C3 (cierre)

| Capacidad                        | Naturaleza           | Justificación                                                                  |
| -------------------------------- | -------------------- | ------------------------------------------------------------------------------ |
| Validaciones previas al cierre   | Lectura (consume C2) | Condición para transicionar un período; sin ellas el cierre no es confiable.   |
| Cierre de período mensual        | Escritura            | Activa I3. Es la única mutación nueva que ADR-001 §5 asigna a esta fase.       |
| Reapertura de período            | Escritura            | ADR-001 §5 la define como parte del ciclo del período; C1/C2 no la construyen. |
| Cierre anual (asiento de cierre) | Escritura            | ADR-001 §5 y §9 lo asignan a C3; se postea por el puerto de C1.                |

### 3.2 NO pertenece a C3 (se difiere o vive en otro módulo)

| Excluido                                                          | Destino      | Motivo                                                                                                       |
| ----------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------ |
| **Balance General**                                               | **C2**       | Reporting. Proyección de `saldos()`. C3 lo consume para validar/ejecutar el cierre; no lo implementa.        |
| **Estado de Resultados**                                          | **C2**       | Reporting. Proyección de `saldos()`. C3 lo consume para calcular el neto del cierre anual; no lo implementa. |
| Cálculo/agregación de saldos                                      | **C2**       | La primitiva `saldos()` es de C2. C3 nunca la reimplementa (C3-I10).                                         |
| Integración con Facturación (factura → comprobante de venta)      | **C4**       | C3 cierra el motor manual; los módulos fuente se conectan después.                                           |
| Integración con Nómina (causación y provisiones)                  | **C5**       | Ídem.                                                                                                        |
| Cartera / Tesorería / conciliación                                | **C6**       | Subledgers/vistas sobre el mayor; dependen de C3 y C4.                                                       |
| Estado de Flujos de Efectivo · Estado de Cambios en el Patrimonio | **C4+ / C2** | Reporting adicional; no es prerrequisito de nómina legal ni parte del cierre.                                |
| Notas a los estados financieros                                   | **C4+**      | Contenido narrativo/estructurado; no es motor contable.                                                      |
| Comparativos multi-período, consolidación multi-tenant            | Diferido     | Sobreingeniería para el cliente objetivo (un operador educativo).                                            |
| Reexpresión / árbol NIIF paralelo                                 | Extensión    | ADR-001 §8: plan único PUC; NIIF como reclasificación si un tenant lo exige.                                 |
| `SaldoCuentaPeriodo` (snapshots precalculados)                    | **C7**       | ADR-001 §8: solo cuando el volumen lo exija. C2 deriva en vivo.                                              |
| Presupuesto, período 13 dedicado de ajustes, multimoneda          | Diferido     | Anti-objetivos explícitos del ADR-001.                                                                       |
| Formato de salida (PDF, XBRL, medios magnéticos DIAN, exógena)    | Transporte   | La presentación no pertenece al módulo de dominio.                                                           |

---

## 4. Relación con Ledger (C1) y Reporting (C2)

```
┌────────────────────────────────────────────────────────────────┐
│  C3 — Cierre Contable  (NO hace reporting; NO calcula saldos)   │
│                                                                  │
│  ── Validación y cálculo del cierre ──                          │
│     CONSUME de C2:  saldos() / Estado de Resultados / cuadre     │
│     (lectura; C3 no agrega ni deriva por su cuenta)              │
│                                                                  │
│  ── Escritura (cierre) ──                                       │
│     (a) Transición de período  → UPDATE periodos_contables       │
│         (única mutación directa; sobre el período, no libros)    │
│     (b) Cierre anual           → LedgerService.registrarComprobante │
│         (borrador balanceado entregado al PUERTO de C1)          │
└────────────────────────────────────────────────────────────────┘
        │ consume (lectura)                │ escritura (b)
        ▼                                  ▼
┌───────────────────────────┐    ┌────────────────────────┐
│ C2 ReportingService        │    │ C1 LedgerService        │
│ saldos() · Balance General │    │ registrarComprobante()  │
│ Estado de Resultados       │    └────────────────────────┘
└───────────────────────────┘
```

Reglas de acoplamiento:

- **C3 depende de C2 para toda lectura financiera y de C1 para el asiento de cierre.** El acoplamiento es de una sola dirección (C3 → C1, C3 → C2); ni C1 ni C2 conocen C3.
- **C3 reutiliza `saldos()` y los estados financieros de C2; no reimplementa agregación.** Si un cálculo de saldo hiciera falta para el cierre, se extiende C2, nunca se duplica en C3.
- **La transición de período es de C3, no de C1.** `LedgerService` _consulta_ el estado del período (I3) pero no lo cambia. C3 es dueño del ciclo de vida del período; C1 y C3 comparten el modelo `PeriodoContable`, y la escritura del estado vive en C3.

---

## 5. Casos de uso

C3 expone cuatro capacidades, **todas de cierre**. Los estados financieros que aparecen abajo como _insumo_ son capacidades de C2 que C3 invoca por lectura; no son casos de uso de C3. El mecanismo de invocación (REST, GraphQL, CLI, batch) pertenece a la capa de transporte.

| #   | Caso de uso            | Naturaleza | Descripción                                                                                                          | Insumo / Puerto                                                                          |
| --- | ---------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| U1  | `ValidarCierrePeriodo` | Lectura    | Ejecuta las validaciones previas (§6) y devuelve un veredicto con la lista de bloqueos. No muta nada.                | Consume cuadre/`saldos()` de **C2**                                                      |
| U2  | `CerrarPeriodo`        | Escritura  | Si U1 pasa, transiciona `ABIERTO → CERRADO`, fija `cerradoAt`/`cerradoPorId` y audita (I9).                          | UPDATE `periodos_contables`                                                              |
| U3  | `ReabrirPeriodo`       | Escritura  | `CERRADO → ABIERTO`. Solo ADMIN, con motivo obligatorio, auditado (I9). Solo el período cerrado más reciente (LIFO). | UPDATE `periodos_contables`                                                              |
| U4  | `CerrarAnioFiscal`     | Escritura  | Genera el comprobante que cancela clases 4/5/6/7 contra patrimonio, vía `LedgerService`. Luego cierra diciembre.     | Consume `saldos()`/Estado de Resultados de **C2** + `LedgerService.registrarComprobante` |

**Capacidades de reporting consumidas de C2 (no son casos de uso de C3):**

- `ObtenerEstadoResultados` (C2) → C3 lo usa para conocer el resultado del ejercicio a cancelar en U4.
- `ObtenerBalanceGeneral` / `ObtenerBalancePrueba` (C2) → C3 los usa como red de validación de cuadre en U1.

**Parámetros:**

```
Comunes:  tenantId (del contexto), userId (para escrituras; queda en AuditLog)
U1 / U2:  periodoId (obligatorio)
U3:       periodoId (obligatorio), motivo (obligatorio), rol ADMIN
U4:       anio (obligatorio)
```

**El único caso de uso de lectura (U1) no escribe. Las escrituras (U2, U3, U4) son las únicas mutaciones de C3.**

---

## 6. Validaciones previas al cierre (U1)

El cierre mensual (U2) solo procede si `ValidarCierrePeriodo` no devuelve bloqueos. Son consultas puras que consumen C2; no mutan estado y no calculan saldos por su cuenta.

| Validación                      | Regla                                                                                                                                                                      |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Período existe y está `ABIERTO` | No se cierra lo inexistente ni lo ya cerrado (idempotencia de intención).                                                                                                  |
| Sin comprobantes en `BORRADOR`  | Todo borrador del período debe contabilizarse o descartarse antes del cierre; un borrador colgado es ambiguo.                                                              |
| Cierre cronológico              | No se cierra un período si existe un período **anterior** aún `ABIERTO` (decisión §2.4; invariante C3-I2).                                                                 |
| Cuadre del período              | Σ débitos = Σ créditos de los comprobantes `CONTABILIZADO` del período. Se **lee de C2** (balance de prueba); siempre verdadero por I1, se verifica como red de seguridad. |

El cierre anual (U4) añade una precondición: **todos los meses del año (1–12) deben estar `CERRADO`** salvo diciembre, que debe estar `ABIERTO` para recibir el asiento de cierre antes de cerrarse (ver §8).

---

## 7. Invariantes funcionales de C3

Extienden el registro global I1–I9 del ADR-001. Su violación es un defecto bloqueante.

| #      | Invariante                                                                                                                                                                                                                                                                 | Punto de aplicación |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| C3-I1  | Un período solo pasa a `CERRADO` si supera **todas** las validaciones de §6 (sin borradores, cierre cronológico, cuadre).                                                                                                                                                  | `CerrarPeriodo`     |
| C3-I2  | El cierre es **cronológico**: no se cierra el mes _n_ si el mes _n-1_ del mismo tenant sigue `ABIERTO` (decisión §2.4).                                                                                                                                                    | `CerrarPeriodo`     |
| C3-I3  | Cerrar un período ya `CERRADO` es **idempotente / no-op auditado**, nunca un error de corrupción.                                                                                                                                                                          | `CerrarPeriodo`     |
| C3-I4  | La **reapertura** solo la ejecuta ADMIN, con motivo, y solo sobre el período `CERRADO` **más reciente** (LIFO, decisión §2.4), para no dejar huecos de estado.                                                                                                             | `ReabrirPeriodo`    |
| C3-I5  | Toda transición de período (cierre, reapertura) y todo cierre anual queda en `AuditLog` (quién, cuándo, motivo) — reafirma I9.                                                                                                                                             | Auditoría           |
| C3-I6  | El **asiento de cierre anual se postea exclusivamente por `LedgerService`** y por tanto cumple I1–I8. C3 no inserta comprobantes ni movimientos directamente.                                                                                                              | `CerrarAnioFiscal`  |
| C3-I7  | El asiento de cierre **cancela a cero** los saldos de las clases 4, 5, 6, 7 y traslada el neto a la cuenta de patrimonio de resultado (rol `CuentaSistemaMap`).                                                                                                            | `CerrarAnioFiscal`  |
| C3-I8  | El cierre anual es **idempotente por origen** (I8): clave `(tenant, origenTipo='CIERRE_ANUAL', origenId=anio, origenEvento='CIERRE')`. No se cierra dos veces el mismo año.                                                                                                | `CerrarAnioFiscal`  |
| C3-I9  | **No hay asiento de apertura.** Las cuentas de balance (1, 2, 3) arrastran saldo por el libro perpetuo; C3 no genera comprobante de apertura del año siguiente.                                                                                                            | Diseño              |
| C3-I10 | **C3 nunca calcula saldos contables.** Toda la información financiera utilizada durante el cierre (cuadre, resultado del ejercicio, saldos de clases 4–7) proviene de C2 (`saldos()` / estados financieros). C3 no reimplementa agregación ni deriva saldos por su cuenta. | Todo el módulo      |
| C3-I11 | El neto que el asiento de cierre traslada a patrimonio **coincide con el Estado de Resultados que entrega C2** para el ejercicio. C3 lo consume, no lo recalcula (corolario de C3-I10).                                                                                    | `CerrarAnioFiscal`  |
| C3-I12 | Reabrir un período con cierre anual ya posteado exige **reversar primero** ese comprobante por el puerto (`LedgerService.anular`); C3 no borra el asiento.                                                                                                                 | `ReabrirPeriodo`    |

---

## 8. Mecánica del cierre anual (U4)

Diseño deliberadamente mínimo, sin período 13 ni entidad nueva:

1. **Precondición:** meses 1–11 `CERRADO`; diciembre `ABIERTO`.
2. **Cálculo (lectura de C2):** se obtienen de **C2** los saldos de las clases 4, 5, 6, 7 al 31 de diciembre (`saldos()` / Estado de Resultados). C3 no calcula estos saldos (C3-I10).
3. **Construcción del borrador (C3):** un comprobante tipo `CC` (cierre) fechado 31-dic que:
   - Debita cada cuenta de resultado con saldo crédito (clase 4, ingresos) por su saldo.
   - Acredita cada cuenta de resultado con saldo débito (clases 5, 6, 7) por su saldo.
   - Lleva el **neto** (utilidad o pérdida) a la cuenta de patrimonio resuelta por `CuentaSistemaMap` (rol `RESULTADO_EJERCICIO`).
   - Cuadra por construcción (I1).
4. **Posteo (puerto C1):** el borrador se entrega a `LedgerService.registrarComprobante` con clave de origen idempotente (C3-I8). El puerto numera, valida y persiste.
5. **Cierre de diciembre:** tras postear, C3 ejecuta `CerrarPeriodo(diciembre)`.

El asiento queda en el período de diciembre. Las clases de resultado quedan en cero al iniciar el ejercicio siguiente; las de balance arrastran su saldo sin intervención (C3-I9).

---

## 9. Modelo de datos — sin tablas nuevas

C3 no añade tablas ni columnas. Usa exclusivamente lo que C0/C1 ya definen:

```
Escritura de período:
  periodos_contables  ── estado, cerradoAt, cerradoPorId   (UPDATE, única mutación directa)

Asiento de cierre (vía LedgerService):
  comprobantes_contables / movimientos_contables            (INSERT por el puerto de C1)
  tipos_comprobante        ── 'CC' (ya en catálogo)
  cuenta_sistema_map       ── rol 'RESULTADO_EJERCICIO'      (dato/seed, no schema)

Lectura financiera (consumida de C2, no implementada en C3):
  saldos() / Estado de Resultados / Balance de prueba       (SELECT, propiedad de C2)
```

La única dependencia de datos nueva es **un registro en `CuentaSistemaMap`** (`rol='RESULTADO_EJERCICIO'` → cuenta de patrimonio 3605/59xx según PUC del tenant). Es configuración por tenant, coherente con el contrato inmutable de `CuentaSistemaMap`. Su ausencia bloquea U4 con un error claro, no un asiento incorrecto.

---

## 10. Política de correcciones posteriores al cierre

Un hecho detectado después de cerrar un período se corrige por una de dos vías. **Ambas existen, con jerarquía estricta:** la vía por defecto es el ajuste en período posterior; la reapertura es la excepción restringida.

### 10.1 Vía por defecto — Asiento de ajuste en período posterior abierto

Es el mecanismo preferente (coherente con ADR-001 §5, que empuja al reverso/ajuste antes que a reabrir).

- La corrección se contabiliza como un comprobante nuevo (ajuste o reverso) **en el período abierto vigente**, por el puerto de C1.
- El período cerrado **no se toca**: preserva la inmutabilidad (I2) y no re-expresa cifras ya presentadas.
- Es la única vía cuando la corrección puede reflejarse legítimamente en un período posterior (la inmensa mayoría de los casos operativos).

### 10.2 Excepción — Reapertura del período cerrado

Solo cuando la corrección **debe** quedar registrada dentro del propio período cerrado (p. ej., re-expresión exigida sobre una declaración ya presentada).

- Solo ADMIN, con motivo obligatorio, auditada (C3-I4/I5).
- Solo sobre el período cerrado más reciente (LIFO, §2.4); corregir un mes anterior obliga a reabrir en orden inverso, un período a la vez.
- Si el período tiene el cierre anual posteado, primero se **reversa ese asiento por el puerto** (C3-I12), luego se corrige, y finalmente se re-cierra y se vuelve a ejecutar el cierre anual.

### 10.3 Regla de decisión

| Situación                                                          | Vía                                                   |
| ------------------------------------------------------------------ | ----------------------------------------------------- |
| La corrección puede reflejarse en un período posterior             | **Ajuste en período posterior** (§10.1) — por defecto |
| La corrección debe reflejarse dentro del período cerrado           | **Reapertura** (§10.2) — excepción                    |
| El período cerrado ya tiene cierre anual posteado y debe reabrirse | Reapertura **+ reverso previo** del cierre (C3-I12)   |

---

## 11. Riesgos

### 11.1 Riesgos funcionales

| #   | Riesgo                                                                                    | Impacto | Mitigación                                                                                            |
| --- | ----------------------------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------- |
| RF1 | Cerrar un mes con borradores colgados deja hechos económicos sin contabilizar.            | Alto    | Validación previa dura (§6): sin borradores no hay cierre.                                            |
| RF2 | Cuenta de resultado (`RESULTADO_EJERCICIO`) no mapeada → cierre anual imposible o errado. | Alto    | U4 falla explícitamente si falta el rol en `CuentaSistemaMap`; nunca postea a una cuenta por defecto. |
| RF3 | Doble ejecución del cierre anual duplica el traslado a patrimonio.                        | Alto    | Idempotencia por origen (C3-I8); el puerto de C1 rechaza el segundo intento.                          |
| RF4 | Reapertura descuidada re-expresa una declaración ya presentada a la DIAN.                 | Alto    | Solo ADMIN, motivo, auditada (C3-I4/I5), LIFO; la política §10 empuja al ajuste en período posterior. |
| RF5 | Confusión sobre dónde viven los estados financieros (¿C2 o C3?).                          | Medio   | §2.1 y §3.2: Balance General y Estado de Resultados son de C2; C3 solo los consume para el cierre.    |

### 11.2 Riesgos de arquitectura

| #   | Riesgo                                                                                    | Impacto | Mitigación                                                                                                                |
| --- | ----------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------- |
| RA1 | Tentación de que C3 inserte el asiento de cierre directamente (rodeando el puerto de C1). | Alto    | Invariante C3-I6: el cierre anual pasa **obligatoriamente** por `LedgerService`. Prohibido `tx.comprobante.create` en C3. |
| RA2 | Que C3 implemente o reexponga reportes (Balance General, Estado de Resultados).           | Alto    | §2.1/§2.3: C3 no hace reporting; consume las capacidades de C2. Cualquier reporte nuevo es C2 o un ADR nuevo.             |
| RA3 | Que C3 calcule saldos por su cuenta en vez de consumir `saldos()` de C2.                  | Alto    | Invariante C3-I10: C3 nunca calcula saldos; toda cifra financiera proviene de C2.                                         |
| RA4 | Scope creep: pedir Flujo de Efectivo, ECP, notas o comparativos dentro de C3.             | Medio   | §3.2 los difiere (a C2/C4+); si entran en requisitos, es un ADR nuevo.                                                    |
| RA5 | Introducir un "período 13" o entidad de cierre para modelar el asiento anual.             | Bajo    | §8: el asiento va al período de diciembre; sin entidad nueva. Anti-sobreingeniería.                                       |

### 11.3 Riesgos de migración

| #   | Riesgo                                                                                       | Impacto | Mitigación                                                                                             |
| --- | -------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------ |
| RM1 | C3 no requiere migración estructural — riesgo de asumir que sí y añadir columnas superfluas. | Bajo    | Decisión §2.3: cero tablas/columnas nuevas. El único cambio de datos es un seed de `CuentaSistemaMap`. |
| RM2 | Tenants existentes sin el rol `RESULTADO_EJERCICIO` sembrado.                                | Medio   | Seed/backfill idempotente del rol al provisionar; U4 valida su presencia antes de operar.              |
| RM3 | Períodos históricos creados en C0 sin haberse cerrado nunca (todos `ABIERTO`).               | Bajo    | El cierre cronológico (C3-I2) obliga a cerrar en orden; operación, no migración.                       |

---

## 12. Fases de implementación

Cada fase es una rama independiente, mergeable y desplegable por sí misma. Ninguna fase modifica C1 (Ledger) ni C2 (Reporting); C3 los **consume**. Las capacidades de reporting (Balance General, Estado de Resultados) **no son fases de C3** — se implementan en C2.

---

### Fase 1 — Cierre mensual + validaciones previas

**Rama:** `feat/c3-cierre-periodo`

**Alcance:** U1 (`ValidarCierrePeriodo`) + U2 (`CerrarPeriodo`). Invariantes C3-I1, C3-I2, C3-I3, C3-I5, C3-I10.

**Naturaleza:** escritura sobre `periodos_contables` (transición de estado). Sin comprobantes. Las validaciones consumen C2.

**Validación:** un período con borradores no cierra; el mes _n_ no cierra si _n-1_ sigue abierto; cerrar dos veces es no-op auditado; tras cerrar, `LedgerService` rechaza postear en él (I3 ya vigente).

**Dependencias:** C2 (lectura de cuadre). Ninguna fase posterior.

---

### Fase 2 — Reapertura

**Rama:** `feat/c3-reapertura`

**Alcance:** U3 (`ReabrirPeriodo`). Invariantes C3-I4, C3-I5, C3-I12. Formaliza la política de correcciones §10.

**Naturaleza:** escritura sobre `periodos_contables`.

**Validación:** solo ADMIN reabre; motivo obligatorio; solo el período cerrado más reciente (LIFO); queda auditado; con cierre anual posteado, exige reverso previo.

**Dependencias:** Fase 1 (necesita períodos que se puedan cerrar).

---

### Fase 3 — Cierre anual

**Rama:** `feat/c3-cierre-anual`

**Alcance:** U4 (`CerrarAnioFiscal`). Invariantes C3-I6, C3-I7, C3-I8, C3-I9, C3-I10, C3-I11, C3-I12. Seed del rol `RESULTADO_EJERCICIO`.

**Naturaleza:** lectura del resultado desde **C2** + escritura vía `LedgerService` (asiento) + transición de diciembre (reutiliza Fase 1).

**Validación:** el asiento cancela clases 4/5/6/7 a cero; el neto queda en la cuenta de patrimonio y coincide con el Estado de Resultados de C2 (C3-I11); el año no se cierra dos veces (C3-I8); tras el cierre, un balance de prueba del año siguiente (leído de C2) muestra las cuentas de resultado en cero y las de balance con saldo arrastrado.

**Dependencias:** Fase 1 (cierre de diciembre), C1 (`LedgerService`), **C2 (Estado de Resultados / `saldos()`)**.

---

## 13. Orden recomendado

```
Fase 1 (Cierre mensual)     ← Primera escritura; activa I3 y las validaciones previas.
Fase 2 (Reapertura)         ← Después de Fase 1; formaliza la política de correcciones.
Fase 3 (Cierre anual)       ← Última: consume el resultado de C2 y postea por el puerto de C1.
```

**Requisito transversal:** Balance General y Estado de Resultados deben existir **en C2** antes de la Fase 3, porque C3 los consume para calcular el cierre anual. Su construcción es trabajo de C2, no de C3.

**Justificación del orden:** el cierre mensual (1) introduce la primera mutación con sus validaciones y activa I3; la reapertura (2) es su contraparte y fija la política de correcciones; el cierre anual (3) va al final porque compone las dos anteriores, consume el reporting de C2 y es la única fase que escribe por el puerto de C1.

---

## 14. Resumen de invariantes globales que C3 respeta

| Invariante                  | Cómo lo respeta C3                                                                                  |
| --------------------------- | --------------------------------------------------------------------------------------------------- |
| I1 (débitos = créditos)     | El asiento de cierre cuadra por construcción; C3 no evalúa cuadres que no lea de C2.                |
| I2 (inmutabilidad)          | C3 no edita ni borra comprobantes; corrige por ajuste en período posterior o reverso (§10, C3-I12). |
| I3 (no postear en cerrado)  | C3 es quien **activa** I3 al transicionar el período a `CERRADO`.                                   |
| I7 (consecutivo)            | El asiento de cierre se numera por el puerto de C1, como cualquier comprobante.                     |
| I8 (idempotencia de origen) | El cierre anual usa clave de origen `(CIERRE_ANUAL, anio, CIERRE)`; no se cierra dos veces (C3-I8). |
| I9 (auditoría)              | Cierre, reapertura y cierre anual quedan en `AuditLog` (C3-I5).                                     |
| Append-only                 | La única mutación directa nueva es el estado del período; el asiento es un INSERT por el puerto.    |

---

_Fin del ADR C3._
