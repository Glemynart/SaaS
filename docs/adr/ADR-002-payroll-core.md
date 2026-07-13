# ADR-002 — Núcleo del módulo de nómina

| Campo                      | Valor                                                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Estado**                 | Aceptado — revisión 3 (canónico post-U4)                                                                                 |
| **Fecha**                  | 2026-07-13                                                                                                               |
| **Decisores**              | Arquitectura · Dominio funcional                                                                                         |
| **Ámbito**                 | SaaS multiempresa "La Oficina Nítida" — `apps/api` (NestJS · Prisma · PostgreSQL)                                        |
| **Reemplaza**              | —                                                                                                                        |
| **Relacionado**            | ADR-001 (Accounting Core), investigación `docs/research/payroll/`, implementación existente `apps/api/src/payroll/` (N2) |
| **Fuente de conocimiento** | docs/research/payroll/01-excel-analysis.md, 02-domain-model.md, 03-payroll-mvp.md, 04-business-rules.md                  |

---

## Historial de revisión

| Rev | Fecha      | Cambio                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 2026-07-01 | Versión inicial derivada de la investigación de dominio.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2   | 2026-07-03 | Auditoría del código N2 existente contra el ADR. Se integran decisiones definitivas: **evolucionar** (no reescribir), **Liquidación mensual y Finiquito como agregados distintos**, **fail-secure** (bloquear casos no soportados), **snapshot inmutable por copia**. Se corrigen el modelo de congelamiento (§8), los roles contables reales (§11) y la máquina de estados completa (§6). Se añaden las invariantes PN-I1…PN-I7 (§12) y el estado de partida (§16). Este documento es **canónico para iniciar la implementación de P1**. |
| 3   | 2026-07-13 | Documenta el estado post-U4 ya implementado: `PayrollBlock`, pipeline único de evaluación, `blocks` como fuente funcional, `PayrollRun` solo para resultados válidos, `PayrollSnapshot` solo como evidencia histórica aprobada, política `EXCLUDED`, contrato público alineado y causación contable como caso de uso explícito de P2.                                                                                                                                                                                                     |

---

## 1. Contexto

Un operador educativo colombiano liquida hoy su nómina en una hoja de cálculo que mezcla datos maestros, insumos del período, reglas de cálculo y parámetros legales en un solo artefacto. El resultado funciona, pero es frágil: referencias posicionales entre hojas, parámetros legales incrustados en fórmulas, ausencia de versionado, desprendibles rotos y sin trazabilidad de qué tasa se usó en cada liquidación.

El módulo Payroll sustituye ese Excel por un sistema estructurado, correcto, auditable y reproducible. No añade funciones nuevas: da estructura a la misma lógica, separando lo que el Excel mezcla.

El motor contable ya está diseñado e implementado (ADR-001, fases C0–C3). Payroll es su primer consumidor real, lo que valida la frontera entre ambos contextos.

**Existe ya una implementación base (serie N2)** en `apps/api/src/payroll/`: un motor de cálculo puro y probado (devengos, IBC, deducciones, aportes patronales, provisiones), parámetros legales versionados por vigencia (`ParametroLegalNomina`) y una orquestación de período elemental. Este ADR, en su revisión 3, **gobierna la evolución de esa base** hacia la arquitectura objetivo; no describe un desarrollo desde cero. Ver §16 para el estado de partida detallado.

El dominio ya fue investigado en profundidad. Los documentos de `docs/research/payroll/` constituyen la fuente oficial de conocimiento funcional. Este ADR **no repite esa investigación**: consolida las decisiones arquitectónicas que de ella se derivan.

---

## 2. Objetivos

Payroll v1 debe:

1. **Liquidar** la nómina mensual ordinaria de un operador educativo colombiano —devengos, deducciones, aportes patronales y provisiones— de forma correcta y reproducible.
2. **Garantizar la corrección laboral** como responsabilidad exclusiva del módulo, sin invadir la contabilidad ni el pago.
3. **Versionar parámetros legales** para que una liquidación de enero de 2026 siempre pueda reconstruirse con las reglas de enero de 2026.
4. **Integrarse con Accounting** mediante un resultado de negocio, no mediante instrucciones contables (fase posterior, P2).
5. **Migrar desde el Excel** con fidelidad, sin exigir al cliente que reingrese datos que ya tiene.
6. **Quedar lista para alimentar PILA y nómina electrónica** cuando esos módulos se activen, sin rediseñar el núcleo.
7. **Evolucionar la base existente (N2) sin reescribirla**, preservando el motor de cálculo puro ya probado.

El objetivo **no** es cubrir toda la legislación laboral colombiana, sino hacer bien el caso central y recurrente.

---

## 3. Principios arquitectónicos

1. **Separación de responsabilidades.** Payroll es dueño de la corrección laboral; Accounting es dueño del libro contable; Tesorería es dueña del pago. Ningún módulo invade el territorio del otro.

2. **Simplicidad sobre generalidad.** Un catálogo cerrado de conceptos curado por el equipo es más seguro que un motor de reglas que el usuario configure libremente. La extensibilidad se introduce solo cuando la demanda de clientes reales la justifique.

3. **Modularidad dentro del monolito.** Payroll, Accounting, Employees y Treasury son contextos delimitados dentro del mismo proceso (mismo `$transaction` de PostgreSQL cuando la operación lo exige; ver ADR-001 §2, principio 6). No se extraen a servicios separados ni se comunican por eventos.

4. **Integración por resultado de negocio.** Payroll produce un resultado en lenguaje de nómina (devengos, deducciones, aportes, neto por empleado y por centro de costo). La traducción concepto de nómina → cuenta pertenece al **lado de Payroll** (su capa de integración con Accounting); el **núcleo contable nunca conoce conceptos de nómina** y recibe por su puerto único solo un comprobante ya balanceado (ADR-001 §2, principio 2, y §6).

5. **Parámetros legales versionados por vigencia.** Ninguna tasa, tope ni valor legal se incrusta en código o en fórmulas. Cada parámetro tiene fecha de vigencia. Al aprobar, **cada liquidación guarda una copia inmutable de los valores que usó** (no una referencia mutable). Cambiar el SMMLV no reescribe el pasado. Ver §8.

6. **Evitar sobreingeniería.** No se construye nada que el segmento no necesite en v1. Las decisiones de alcance se toman contra la vara: "¿esto aplica a casi todos los empleados todos los meses?".

7. **Fail-secure ante lo no soportado.** Si Payroll no puede liquidar un caso con corrección garantizada, **lo bloquea con un motivo explícito**; nunca produce un neto silenciosamente incorrecto. Un error visible es preferible a un error oculto. Ver §10.

---

## 4. Bounded Contexts

El sistema se divide en contextos delimitados. Payroll es el _core domain_; los demás lo rodean.

| Contexto                              | Responsabilidad                                                                                             | Relación con Payroll                           |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| **Payroll**                           | Liquidar el período: devengos, deducciones, IBC, aportes, provisiones, neto. Ciclo de estados del proceso.  | Core domain                                    |
| **Employees**                         | Personas, contratos, cargos, afiliaciones, cuenta bancaria.                                                 | Upstream — provee datos maestros por identidad |
| **Configuración Legal / Paramétrica** | Parámetros legales vigentes (SMMLV, auxilio, UVT, tasas, topes), catálogo de conceptos, escalas salariales. | Upstream — provee reglas versionadas           |
| **Accounting Core**                   | Ledger append-only, partida doble, causación, saldos, reportes contables.                                   | Downstream — contabiliza el resultado          |
| **Treasury**                          | Dispersión de netos, pago de obligaciones a terceros, conciliación.                                         | Downstream — paga el resultado                 |
| **Nómina Electrónica**                | Documento soporte y reporte a la DIAN.                                                                      | Downstream futuro — reporta el resultado       |

Cada contexto es dueño exclusivo de sus datos. Payroll referencia empleados y parámetros por identidad, nunca los posee. Accounting y Treasury consumen el resultado de Payroll pero nunca lo modifican.

---

## 5. Agregados y terminología

Payroll define **tres agregados con ciclos de vida distintos** (ProcesoNómina, Liquidación y Finiquito), más sus entidades de soporte. Desde la revisión 2 quedó resuelta una colisión de nombres del código N2 (dos entidades llamadas "liquidación"):

| Elemento                | Tipo DDD                          | Rol                                                                                                                             | Estado en v1          |
| ----------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| **ProcesoNómina**       | Agregado raíz                     | Coordina el ciclo de estados del período, la aprobación y (P2) la causación.                                                    | Núcleo de v1          |
| **Liquidación**         | Agregado (resultado por empleado) | Resultado **mensual** por empleado: devengos, deducciones, aportes, provisiones, neto. Congelable.                              | Núcleo de v1          |
| **LiquidaciónConcepto** | Entidad (dentro de Liquidación)   | Línea de una Liquidación (devengo / deducción / aporte patronal / provisión).                                                   | Núcleo de v1          |
| **Bloqueo de Payroll**  | Entidad independiente             | Bloqueo funcional de la evaluación de un empleado para un PayrollPeriod. Impide producir una Liquidación válida para esa causa. | Núcleo de v1          |
| **Finiquito**           | Agregado                          | Liquidación **definitiva por retiro** (prima, cesantías, intereses, vacaciones, salario pendiente).                             | **Fuera de v1** (§13) |
| **Novedad**             | Entidad de insumo                 | Insumo variable del período (días, ingreso/retiro, ausencias, incapacidad simple, extras, bonos).                               | Núcleo de v1          |

**Decisión de nomenclatura (D14):** en el ADR y en el código objetivo, "**Liquidación**" designa siempre el **resultado mensual por empleado** (lo que el código N2 llama `PayrollRun`). El cálculo de retiro se denomina "**Finiquito**" (el código N2 lo implementó como `Liquidation`, término que se renombra para eliminar la ambigüedad). Ambos comparten el motor de cálculo puro pero son agregados y procesos separados: distinto disparador, distinto ciclo de vida, distinto alcance de versión (el Finiquito está fuera de v1).

Relación estructural:

```
ProcesoNómina (raíz del período)
   └── Liquidación (resultado mensual por empleado)  ── referencia empleado + contrato por identidad
          └── LiquidaciónConcepto (líneas)

Bloqueo de Payroll ── evaluación de empleado + PayrollPeriod + código funcional

Novedad ── insumo del período por empleado

Finiquito (retiro) ── agregado separado, feature-flagged, fuera de v1
```

---

## 6. Máquina de estados del ProcesoNómina

El período recorre una máquina de estados explícita. El recálculo es libre hasta `APROBADA`; después, la corrección es explícita (reliquidación como ajuste, §11).

```
BORRADOR ──calcular──► CALCULADA ──enviar a revisión──► EN_REVISION
   ▲                        │                                │
   │                        │                        rechazar│
   └────────(reabrir)───────┴───────────────◄────────────────┤
                                                     aprobar  ▼
                                                          APROBADA ──contabilizar (misma tx, P2)──► CAUSADA
                                                                                                 │
                                                                                Treasury paga    ▼
                                                                                             PAGADA ──► CERRADA
```

Reglas de la máquina de estados:

- **BORRADOR → CALCULADA:** ejecuta el motor de cálculo sobre los empleados del período. Recalculable libremente.
- **CALCULADA → EN_REVISION → APROBADA:** flujo de un revisor + un aprobador (sin multinivel en v1, ver X6).
- **Congelamiento al entrar en APROBADA:** cada Liquidación captura su snapshot inmutable (§8). A partir de aquí la Liquidación es inmutable.
- **APROBADA → CAUSADA:** caso de uso explícito de P2 ("Contabilizar nómina"). Produce el resultado de negocio y registra la causación en Accounting **en la misma transacción** (D6). La aprobación administrativa termina en APROBADA; hasta que P2 exista, el proceso puede detenerse ahí.
- **CAUSADA → PAGADA:** lo marca Treasury al dispersar (fase P3).
- **PAGADA → CERRADA:** estado terminal del período.
- **Corrección post-APROBADA:** no se edita ni se borra; se emite una nueva versión y la diferencia viaja como ajuste (§11).
- **Auditoría de transiciones:** toda transición de estado (cálculo, aprobación, causación, pago, cierre) se audita conforme a la política de ADR-SEC (ADR-SEC-001 §13 / S6, SEC-I5). Un evento crítico que no pueda registrarse no ocurre (fail-secure).

**Segregación de deberes (revisor ≠ aprobador).** La separación entre quien revisa y quien aprueba forma parte del **modelo de dominio** y queda reflejada en las transiciones `CALCULADA → EN_REVISION → APROBADA`. La **exigencia técnica** de que sean identidades con permisos distintos depende del modelo de autorización granular, diferido a un futuro ADR de autorización granular (hoy el RBAC es plano y no separa "crear" de "aprobar"). Mientras tanto, P1 **registra el actor de cada transición** (auditable) y deja la restricción fuerte por rol al modelo de autorización futuro; esto respeta la dirección de ADR-SEC-001 §12.4 / S11 sin bloquear P1.

Nota de evolución: el código N2 actual solo tiene `DRAFT | CLOSED`. Esta máquina de estados los sustituye; `CLOSED` corresponde a `CERRADA` con semántica terminal real, no a un simple flag.

---

## 7. Responsabilidades de Payroll

### Lo que Payroll hace

- Interpretar contratos vigentes y novedades del período como insumos de cálculo.
- Aplicar el catálogo de conceptos y los parámetros legales vigentes para producir la Liquidación de cada empleado.
- Garantizar las invariantes de negocio (§12): IBC con piso y techo, neto = devengado − deducciones, redondeo a peso, días ≤ período.
- Sostener el ciclo de vida del ProcesoNómina: Borrador → Calculada → Revisión → Aprobada → Causada → Pagada → Cerrada.
- **Congelar el resultado al aprobar mediante una copia inmutable** de parámetros, conceptos e insumos usados (§8).
- Persistir y operar los bloqueos funcionales detectados por la evaluación fail-secure (§10).
- Entregar el resultado agregable (por empleado, por concepto, por centro de costo) a Accounting y a Treasury.
- Generar desprendibles derivados del cálculo aprobado.
- **Bloquear los casos no soportados** en lugar de liquidarlos mal (§10).
- Soportar reliquidación y reversión controladas cuando esa capacidad esté habilitada: los errores se corrigen por nueva versión, no por edición sobre el original.

### Lo que Payroll NO hace

- El **núcleo de cálculo de Payroll** no conoce cuentas contables, débitos, créditos ni el plan de cuentas. La traducción hacia el comprobante contable pertenece exclusivamente a la **capa de integración de Payroll**, descrita en §11.
- No escribe en el Ledger contable.
- No ejecuta pagos ni genera archivos de dispersión bancaria.
- No genera documentos tributarios ni reportes a la DIAN.
- No modela el ciclo completo de vacaciones (solo provisión).
- No administra la relación laboral (eso es Employees).
- No es un motor genérico de reglas: el catálogo de conceptos es cerrado y curado.

---

## 8. Congelamiento inmutable

La reproducibilidad histórica es la columna vertebral de la auditoría y lo que diferencia el producto del Excel. Exige un modelo de congelamiento **inmutable por copia**, no por referencia.

**Decisión (D8, revisada):** al aprobar, cada Liquidación persiste un **snapshot append-only** que contiene:

1. **Los valores de los parámetros legales usados** (SMMLV, auxilio, tarifas, topes, tramos FSP, factores de provisión) — una copia, no un puntero.
2. **El código de cada concepto aplicado** (identificador estable del catálogo de conceptos). No se persiste una "versión" de concepto: hoy no existe un mecanismo de versionado del catálogo y este ADR no lo introduce.
3. **Los insumos** de la liquidación (salario base, salario integral, clase ARL, exoneración, novedades relevantes).

Propiedades:

- El snapshot es **inmutable una vez escrito**: aprobar es el único momento en que se genera; nunca se actualiza.
- La reproducibilidad **no depende de la tabla maestra** de parámetros: `ParametroLegalNomina` puede seguir siendo mutable en su maestro; el resultado histórico se reconstruye desde la copia congelada.
- Se conserva además una **referencia de trazabilidad** a la vigencia de parámetros usada (para saber _cuál_ versión se aplicó), pero esa referencia no es el mecanismo de reproducibilidad.
- `PayrollSnapshot` representa únicamente evidencia histórica aprobada. No es la fuente funcional de bloqueos ni de advertencias operativas; el ciclo de vida de bloqueos pertenece a `PayrollBlock` (§10).

**Por qué el cambio respecto a la rev. 1:** el código N2 congela solo un FK (`parametroLegalId`) hacia una fila mutable (`ParametroLegalNomina.updatedAt` existe). Editar esa fila alteraría retroactivamente una liquidación pasada. Un FK apuntador **no** satisface la reproducibilidad; la copia inmutable sí (invariante PN-I3).

---

## 9. Parámetros legales y catálogo de conceptos

La corrección de una nómina depende de los parámetros legales vigentes en la fecha de liquidación, no en la fecha de consulta. Cambiar el SMMLV en enero no debe alterar la nómina de diciembre.

**Decisión:** todo parámetro legal y de política de empresa se almacena con **vigencia temporal** (fecha desde / fecha hasta). La Liquidación **congela una copia inmutable** de los valores al aprobarse (§8).

| Parámetro                          | Ejemplo                                  | Naturaleza          |
| ---------------------------------- | ---------------------------------------- | ------------------- |
| SMMLV                              | $1.423.500 → $1.520.000                  | Legal, anual        |
| Auxilio de transporte              | $200.000 → $220.000                      | Legal, anual        |
| UVT                                | $49.799 → $53.000                        | Legal, anual        |
| Tasas de aportes                   | Pensión 12%, salud 8.5%, ARL 0.522%      | Legal               |
| Factores de provisión              | Prima, cesantías, intereses, vacaciones  | Legal               |
| Escalas salariales                 | Licenciado = $2.847.600                  | Política de empresa |
| Exoneración de aportes             | Bandera por empresa                      | Legal / política    |
| Topes en SMMLV                     | IBC techo 25, auxilio ≤ 2, integral ≥ 13 | Legal               |
| Días base y calendario de períodos | Mes comercial 30 días                    | Política de empresa |
| Política de redondeo               | Redondeo a peso                          | Política de empresa |

**Nota de evolución (factores de provisión):** en el código N2 los factores de provisión (prima, cesantías, intereses, vacaciones) están hardcoded como constantes en el calculator; el propio código lo señala como riesgo de versionado. La arquitectura objetivo los **traslada a `ParametroLegalNomina`**, cerrando el principio 5 / D3. Es trabajo de P0.

**Catálogo de conceptos:** es un **catálogo cerrado y curado por el equipo** (D2), materializado como código versionado (`ConceptCodigo`), no como tabla configurable por el usuario (anti-objetivo X1). Para la trazabilidad, el snapshot de la Liquidación (§8) registra el **código** de concepto aplicado a cada línea (identificador estable). No se persiste una "versión" de concepto: no existe hoy un mecanismo de versionado del catálogo y este ADR no lo diseña; si en el futuro se requiere, será una decisión aparte.

---

## 10. Salvaguarda fail-secure

**Decisión (D10, reforzada):** ante un caso que Payroll no puede liquidar con corrección garantizada, **bloquea** la evaluación de ese empleado para el PayrollPeriod con un motivo explícito. Nunca sustituye un dato faltante por un default silencioso que produzca un neto plausible pero incorrecto.

Casos que **bloquean** (lista inicial, extensible de forma curada):

- Salario integral (fuera de v1).
- Sin contrato vigente que cubra el período.
- Clase de riesgo ARL no resuelta o inválida.
- Tipo de contrato no soportado en v1.
- Divergencia material entre el salario del empleado y el del contrato.

Reglas de operación:

- La salvaguarda opera en la **evaluación de un empleado para un PayrollPeriod**: un empleado bloqueado no impide calcular al resto del período.
- La clasificación funcional del pipeline tiene tres resultados conceptuales: **resultado válido**, **advertencia informativa** y **bloqueo funcional**.
- `PayrollRun` representa únicamente resultados válidos. Si un empleado queda bloqueado, no existe un resultado de liquidación válido que pueda formar parte de los resultados del período para esa causa.
- `PayrollBlock` es la entidad independiente que persiste el ciclo de vida del bloqueo funcional. Su identidad estable se compone de PayrollPeriod, empleado y código funcional del bloqueo; no depende del texto del mensaje.
- `blocks` es la única fuente funcional de verdad para decidir fail-secure. `serviceWarnings` puede existir solo como compatibilidad temporal de contrato o presentación, no como fuente de decisión del dominio.
- El pipeline de evaluación es único: cálculo y aprobación reutilizan la misma clasificación de resultados. No existe una segunda implementación de reglas de bloqueo para aprobar.
- El ProcesoNómina **no puede pasar a APROBADA** mientras existan bloqueos activos sin resolver o sin excluir explícitamente.
- Estados del bloqueo en U4: `ACTIVE`, `RESOLVED`, `EXCLUDED`. No se introducen estados adicionales.
- Un bloqueo `EXCLUDED` no se reactiva automáticamente si la misma causa vuelve a aparecer durante el mismo PayrollPeriod. Esa política es una decisión de negocio consciente: la exclusión explícita conserva trazabilidad y evita que la misma causa funcional vuelva a impedir la aprobación dentro del mismo período.
- Se distingue **bloqueo** (detiene la liquidación válida de ese empleado) de **advertencia informativa** (p. ej. IBC topado a 25 SMMLV, que es un resultado legal correcto y no debe bloquear).

**Por qué el cambio respecto al código N2:** hoy el motor usa _fallbacks + warnings_ y **liquida igual** (contrato no vigente → fallback; clase ARL inválida → clase I; salario integral → lo calcula). Eso contradice el principio fail-secure. En la arquitectura objetivo, esos casos pasan de "advertir y continuar" a "bloquear" (invariante PN-I4).

---

## 11. Integración con Accounting (fase posterior — P2)

La frontera entre Payroll y Accounting es una decisión arquitectónica fundacional, compartida con ADR-001. Se implementa **después del núcleo** (P2): P1 deja el ProcesoNómina hasta APROBADA; P2 añade la transición a CAUSADA.

**Regla inviolable (PN-I1):** Payroll nunca escribe en el Ledger.

El flujo de P2 es:

```
Payroll: proceso aprobado ──► contabilizar nómina ──► capa de integración de Payroll traduce concepto→cuenta ──► entrega comprobante balanceado al puerto contable
```

1. Payroll conserva un ProcesoNómina aprobado y produce un **resultado de negocio**: hechos económicos en lenguaje de nómina —devengos, deducciones, aportes patronales, provisiones, neto por empleado— agregables por concepto y **por centro de costo**.

2. La **capa de integración de Payroll** (su **mapper concepto → cuenta**, calculadora pura al estilo ADR-001 §6) traduce ese resultado a un comprobante balanceado, resolviendo `rol → cuenta` vía `CuentaSistemaMap`. El **núcleo contable no conoce los conceptos de nómina**: recibe por su puerto único (ADR-001 §6) un borrador genérico (cuenta, tercero, centro de costo, débito/crédito) y lo valida, numera y contabiliza. Los roles de nómina **ya existen** en el seed del motor contable: `SALARIOS_POR_PAGAR`, `APORTES_SALUD_POR_PAGAR`, `APORTES_PENSION_POR_PAGAR`, `PROVISION_PRESTACIONES`, `GASTO_SUELDOS`, `GASTO_APORTES_SOCIALES`.

3. La causación es **idempotente por origen** (`origenTipo='PAYROLL'`): un proceso aprobado genera exactamente un comprobante de causación. Si se reliquida, la diferencia viaja como comprobante de **ajuste**, nunca borrando el original. Ver ADR-001 §3, invariante I8.

4. La causación (reconocimiento de la obligación) y el pago (extinción de la obligación) son **dos momentos distintos** del mismo hecho. La causación la dispara el caso de uso explícito `Contabilizar nómina`; el pago lo dispara Treasury al dispersar. El Ledger refleja ambos.

5. **Sin consistencia eventual, sin broker, sin outbox.** La transición `APROBADA → CAUSADA` y el registro del comprobante contable ocurren en la misma transacción de PostgreSQL (principio de sincronía de ADR-001 §2, principio 6).

**Reliquidación como ajuste:** el código N2 recalcula de forma **destructiva** (borra y recrea los runs). Eso es aceptable solo antes de aprobar. Una vez el proceso está aprobado/causado, la corrección es una **nueva versión** cuya diferencia se contabiliza como ajuste, preservando el congelamiento (§8) y el append-only del Ledger.

**Corrección post-aprobación.** Payroll P1 no incluye correcciones posteriores a la aprobación. Esa capacidad queda separada como **Payroll P1.5**: acto explícito de corrección, con ciclo de vida propio e invariantes sobre la aprobación original, preservando el período aprobado previo como **inmutable** (PN-I2) y auditado. La materialización de sus efectos queda fuera de este alcance y se definirá como iniciativa posterior. En P2, cualquier efecto contable derivado de esa materialización seguirá el principio de ajuste idempotente (punto 3 de esta sección).

---

## 12. Invariantes de Payroll (PN-I)

Invariantes que toda implementación de Payroll debe mantener. Son criterios de auditoría y de aceptación de P1/P2.

| #          | Invariante                                                                                                                        |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **PN-I1**  | Payroll **nunca escribe en el Ledger**. Produce un resultado de negocio; Accounting contabiliza.                                  |
| **PN-I2**  | Una Liquidación **aprobada es inmutable**. La corrección se hace por nueva versión / ajuste, jamás editando ni borrando.          |
| **PN-I3**  | El **snapshot de parámetros, conceptos e insumos es una copia append-only**, no una referencia mutable.                           |
| **PN-I4**  | Caso no soportado ⇒ **bloqueo con motivo explícito**, nunca un neto silenciosamente incorrecto (fail-secure).                     |
| **PN-I5**  | `neto = devengado − deducciones`. Cada concepto se redondea a peso; las líneas redondeadas **cuadran con los totales**.           |
| **PN-I6**  | Causación **idempotente por origen**: un ProcesoNómina aprobado ⇒ exactamente un comprobante de causación.                        |
| **PN-I7**  | Todo resultado es **agregable por empleado, por concepto y por centro de costo**.                                                 |
| **PN-I8**  | `PayrollRun` existe solo para resultados válidos; un bloqueo funcional no produce una Liquidación válida.                         |
| **PN-I9**  | `PayrollBlock` es la fuente funcional de verdad de fail-secure y se correlaciona por PayrollPeriod + empleado + código funcional. |
| **PN-I10** | `PayrollSnapshot` representa solo evidencia histórica aprobada; no reemplaza el ciclo de vida de bloqueos.                        |

> Estas invariantes son **específicas del dominio Payroll** y conviven con las invariantes de plataforma de ADR-SEC-001, que aplican a Payroll sin repetirse aquí —en particular **S1** (aislamiento de tenant), **S5** (evidencia append-only) y **S6 / SEC-I5** (toda transición crítica queda auditada o la acción no ocurre).

---

## 13. Alcance de v1

Definido a partir del documento de MVP (03-payroll-mvp.md). Principio rector: **profundidad antes que amplitud**.

**Definición de fases y de v1 / MVP.** En este ADR, **v1 = MVP = P0–P2**: **P0** (catálogos: parámetros legales y factores de provisión, conceptos, calendario), **P1** (núcleo de liquidación hasta `APROBADA`: agregados, estados, congelamiento, fail-secure), **P2** (integración contable: causación en `CAUSADA`). **P3+** (Treasury, PILA, nómina electrónica) son posteriores al MVP. En la tabla siguiente, una capacidad marcada (P2)/(P3) entra en v1 pero en la fase indicada, no en P1.

### Entra en v1

| Capacidad                                                                                                                  | Fundamento                                                             |
| -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Multiempresa (tenant) y multi-sede                                                                                         | Base del SaaS; no negociable                                           |
| Maestro de empleados y contratos (indefinido y fijo)                                                                       | Cubren la planta real de un colegio                                    |
| Catálogo de conceptos cerrado y curado                                                                                     | Define qué se liquida; no configurable por el usuario                  |
| Parámetros legales versionados por vigencia (incl. factores de provisión)                                                  | Corrección + auditoría                                                 |
| Novedades básicas (días, ingreso/retiro, ausencias, incapacidad simple, horas extra, deducciones manuales, bonificaciones) | Insumos variables del mes                                              |
| Liquidación mensual ordinaria completa                                                                                     | Devengos → IBC → deducciones → neto + aportes patronales + provisiones |
| Flujo con revisión y aprobación                                                                                            | Borrador → Calculada → Revisión → Aprobada                             |
| Redondeo a peso en todos los resultados                                                                                    | Sin ello no se puede pagar ni contabilizar                             |
| Congelamiento inmutable al aprobar (copia de parámetros, conceptos e insumos)                                              | Reproducibilidad                                                       |
| Salvaguarda fail-secure de casos no soportados                                                                             | Bloquear, no liquidar mal en silencio                                  |
| Resultado de negocio para Accounting (P2)                                                                                  | Integración con el Ledger                                              |
| Resultado para Treasury (montos y beneficiarios) (P3)                                                                      | Dispersión de netos y obligaciones                                     |
| Desprendibles derivados del cálculo                                                                                        | Consistentes por construcción                                          |
| Reliquidación y reversión controladas                                                                                      | Corrección sin edición                                                 |
| Importación inicial desde Excel                                                                                            | Sin migración no hay adopción                                          |

### Explícitamente fuera de v1

| Capacidad                                         | Motivo del aplazamiento                                                                                                                              |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Retención en la fuente                            | Compleja (UVT, depuración); pocos empleados de colegio la alcanzan; v1 la maneja como deducción manual                                               |
| Salario integral                                  | Muy poco frecuente en el segmento; **se bloquea** con salvaguarda (§10)                                                                              |
| Pago de prima, cesantías y vacaciones             | En v1 solo se provisionan; el desembolso semestral/anual es v2                                                                                       |
| **Finiquito (liquidación definitiva por retiro)** | Agregado separado (§5); cálculo delicado, bajo volumen, alto riesgo. Existe implementación N2 (`Liquidation`) que queda **feature-flagged** hasta v2 |
| Ciclo completo de vacaciones                      | Producto en sí mismo; v1 = provisión + novedad manual                                                                                                |
| Incapacidad con cálculo legal completo            | v1 = simple (reduce días); v2 = porcentajes, transición EPS/ARL                                                                                      |
| Frecuencia quincenal, libranzas con amortización  | No bloquean el caso central mensual                                                                                                                  |
| Aprobación multinivel                             | Un revisor + un aprobador basta en v1                                                                                                                |
| Formatos bancarios específicos                    | v1 entrega los datos; los archivos por banco se priorizan con clientes                                                                               |
| PILA y nómina electrónica                         | Módulos futuros; Payroll les entregará el resultado cuando existan                                                                                   |
| Autoservicio del empleado                         | Portal, descarga de colilla — futuro                                                                                                                 |
| Motor de reglas configurable por el usuario       | **Riesgo de sobreingeniería** — ver §15                                                                                                              |

> Nota: el **Fondo de Solidaridad Pensional (FSP)** ya está implementado en el motor N2 por tramos progresivos y se conserva. Deja de estar "fuera de v1" respecto a la rev. 1.

---

## 14. Decisiones aprobadas

| #   | Decisión                                                                                                                                                                                                                            | Fundamento                                                                                                                                                                                                  |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **Payroll como core domain dentro del monolito.** No se extrae a microservicio.                                                                                                                                                     | Misma transacción que Accounting (ADR-001 §2, principio 6). El volumen no lo justifica.                                                                                                                     |
| D2  | **Catálogo de conceptos cerrado y curado por el equipo.** No es un motor de reglas configurable por el usuario.                                                                                                                     | Evita reproducir el caos del Excel con más pasos. Las reglas de nómina colombiana son estables y acotadas.                                                                                                  |
| D3  | **Parámetros legales versionados por vigencia**, no incrustados en código ni en fórmulas (incluye los factores de provisión).                                                                                                       | Permite liquidar un período pasado con sus reglas, no con las actuales. Es la base de la auditoría.                                                                                                         |
| D4  | **Separación ProcesoNómina / Liquidación en agregados distintos.** El Proceso coordina el período; la Liquidación es el resultado por empleado.                                                                                     | Permite calcular empleados de forma independiente y paralelizable. La referencia es por identidad, no por posición.                                                                                         |
| D5  | **Resultado de negocio como frontera Payroll ↔ Accounting.** Payroll no conoce el plan de cuentas; Accounting no conoce los conceptos de nómina.                                                                                    | Consistente con ADR-001 §2, principio 2, y §6: el mapper concepto → cuenta vive en el **lado de Payroll** (su capa de integración); el núcleo contable solo recibe un comprobante balanceado por su puerto. |
| D6  | **Causación como caso de uso explícito de P2, transaccional con el Ledger.** La aprobación administrativa llega a APROBADA; `Contabilizar nómina` transiciona APROBADA → CAUSADA y registra el comprobante en la misma transacción. | Principio de sincronía de ADR-001. Sin consistencia eventual, sin broker, y sin mezclar aprobación administrativa con causación contable.                                                                   |
| D7  | **Estados del proceso: Borrador → Calculada → Revisión → Aprobada → Causada → Pagada → Cerrada.** Recálculo libre hasta aprobar; después, explícito (reliquidación).                                                                | La nómina es un acto controlado. El flujo es parte del valor. Ver §6.                                                                                                                                       |
| D8  | **Congelamiento inmutable al aprobar:** copia append-only de parámetros, conceptos e insumos usados (no un FK apuntador).                                                                                                           | Garantiza reproducibilidad histórica aunque cambien los maestros. Ver §8.                                                                                                                                   |
| D9  | **Redondeo a peso como política explícita y uniforme.**                                                                                                                                                                             | Sin ello no se puede pagar ni conciliar con el banco ni cuadrar el balance.                                                                                                                                 |
| D10 | **Salvaguarda fail-secure:** los casos no soportados se bloquean con motivo, no se liquidan mal.                                                                                                                                    | Un neto equivocado es peor que un mensaje de "no soportado aún". Ver §10.                                                                                                                                   |
| D11 | **Payload de integración a Accounting por empleado y por centro de costo.**                                                                                                                                                         | Permite que el Ledger registre el gasto en la sede correcta desde v1.                                                                                                                                       |
| D12 | **Desprendibles derivados del cálculo aprobado**, nunca capturados.                                                                                                                                                                 | Corrige el defecto del Excel (colillas rotas o inconsistentes con lo pagado).                                                                                                                               |
| D13 | **Evolucionar la base N2, no reescribir.** Se conserva el motor de cálculo puro, el mapper, `ParametroLegalNomina` y los roles contables; se adaptan las capas de agregado, estado, congelamiento e integración.                    | El motor está probado y es fiel al ADR en espíritu. Reescribir descartaría trabajo correcto. Ver §16.                                                                                                       |
| D14 | **"Liquidación" = resultado mensual; "Finiquito" = retiro.** Dos agregados distintos; se renombra el `Liquidation` (retiro) del código N2 a Finiquito.                                                                              | Elimina la colisión de nombres del código N2. Ver §5.                                                                                                                                                       |
| D15 | **Snapshot inmutable por copia** como mecanismo único de reproducibilidad; el FK de vigencia queda solo como trazabilidad.                                                                                                          | Un FK a fila mutable no garantiza reproducibilidad. Ver §8. (Detalla D8.)                                                                                                                                   |
| D16 | **La integración con Accounting es fase posterior (P2).** P1 llega hasta APROBADA; P2 añade CAUSADA.                                                                                                                                | Permite entregar y validar el núcleo de liquidación antes de acoplar la causación.                                                                                                                          |
| D17 | **`PayrollBlock` como entidad independiente del resultado.** El bloqueo vive en la evaluación de un empleado para un PayrollPeriod y se identifica por PayrollPeriod + empleado + código funcional.                                 | Evita contaminar `PayrollRun` con resultados inválidos y evita correlaciones frágiles basadas en texto.                                                                                                     |
| D18 | **Pipeline único de evaluación para cálculo y aprobación.** `blocks` es la fuente funcional de verdad; `serviceWarnings` queda solo como compatibilidad temporal.                                                                   | Evita doble implementación de reglas fail-secure y mantiene una decisión centralizada de aprobación.                                                                                                        |
| D19 | **Política `EXCLUDED`.** Un bloqueo excluido explícitamente no se reactiva automáticamente por la misma causa durante el mismo PayrollPeriod.                                                                                       | La exclusión es una decisión operativa trazable dentro del período, no un efecto colateral del recálculo.                                                                                                   |

---

## 15. Decisiones descartadas

| #   | Decisión descartada                                                                                    | Por qué se rechaza en v1                                                                                                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| X1  | **Motor genérico de reglas (fórmulas libres / DSL / diseñador visual).**                               | Reproduce el caos del Excel con más pasos. Un catálogo cerrado y curado es más seguro, más simple y cubre el 100 % del segmento objetivo. Cuando 5+ clientes reales demuestren variación no cubierta, se reconsidera. |
| X2  | **Microservicio de nómina separado del monolito.**                                                     | La contabilización requiere la misma transacción (ADR-001 §2, principio 6). Extraer Payroll obligaría a consistencia eventual, outbox y reconciliación para un módulo que no tiene demanda de escala independiente.   |
| X3  | **Arquitectura orientada a eventos (event sourcing, CQRS, colas).**                                    | Complejidad injustificada para una nómina mensual de menos de 100 empleados. El estado del proceso es una máquina de estados simple; no hay eventos que requieran publicación externa.                                |
| X4  | **Multimoneda y multicountry.**                                                                        | El segmento es exclusivamente colombiano y opera en COP. Las columnas de moneda se reservan como en ADR-001, pero no se implementan.                                                                                  |
| X5  | **Cálculo distribuido / paralelización de liquidaciones en v1.**                                       | Una nómina de 100 empleados se liquida secuencialmente en milisegundos. La arquitectura de agregados lo permite en el futuro sin rediseño.                                                                            |
| X6  | **Workflow de aprobación multinivel configurable.**                                                    | Un revisor + un aprobador es suficiente para el segmento. La profundidad se valida con clientes reales.                                                                                                               |
| X7  | **Cobertura de todos los tipos de contrato y salario integral/variable de entrada.**                   | Multiplica los casos de prueba sin atender a la mayoría real. Se implementan cuando el primer cliente que los necesite justifique el costo. En v1 se bloquean (§10).                                                  |
| X8  | **PILA y nómina electrónica dentro del mismo módulo.**                                                 | Son módulos separados que consumen el resultado de Payroll. Construirlos prematuramente acopla el núcleo a formatos que cambian por regulación.                                                                       |
| X9  | **Tablas separadas por tipo de empleado (docente, directivo, administrativo).**                        | La clasificación del personal es un atributo del contrato, no una razón para duplicar la estructura de liquidación. El Excel lo hacía porque las hojas no tenían filtro; el ERP lo resuelve con un atributo.          |
| X10 | **Cálculo de salario bruto objetivo (ajustar básico para que básico + auxilio dé una cifra redonda).** | Política observada en un Excel, no una regla general. Se pospone hasta que la demande un cliente.                                                                                                                     |
| X11 | **Integración directa con bancos para dispersión.**                                                    | v1 entrega los datos de dispersión. Los formatos específicos y la integración con cada banco se priorizan con clientes reales.                                                                                        |
| X12 | **Reescribir Payroll desde cero.**                                                                     | El motor de cálculo N2 es correcto, puro y probado. Los huecos están en agregado/estado/congelamiento/integración, no en la aritmética. Se evoluciona (D13).                                                          |
| X13 | **Congelar la liquidación mediante un FK a la fila de parámetros (sin copia).**                        | La fila maestra es mutable; el FK no garantiza reproducibilidad. Se congela por copia inmutable (D8/D15).                                                                                                             |

---

## 16. Estado de partida y estrategia de evolución

Auditoría del código N2 existente (`apps/api/src/payroll/`) contra esta arquitectura. Guía la ejecución de P0/P1 sin proponer migraciones concretas (se diseñan contra el estado real de la base de datos).

### Se conserva (reutilizar tal cual o casi)

- **Motor de cálculo puro** (`calculator/`): devengos, IBC (integral 70 %, piso/techo), auxilio, deducciones (salud, pensión, FSP progresivo), aportes patronales (salud, pensión, ARL por clase, caja, ICBF, SENA), exoneración Art. 114-1, provisiones. Determinístico, sin I/O, probado.
- **Mapper puro** (`payroll-mapper.ts`) y **advertencias tipadas** (`payroll-warnings.ts`).
- **`ParametroLegalNomina`** (modelo + seed + resolución por vigencia): satisface D3.
- **Roles de nómina en `CuentaSistemaMap`**: el destino contable de P2 ya está mapeado.
- **API / RBAC / auditoría de eventos**.

### Se adapta

- **Estados:** `PayrollPeriod (DRAFT|CLOSED)` → `ProcesoNómina` con la máquina de estados de §6.
- **Liquidación:** `PayrollRun` → `Liquidación`, con snapshot inmutable (§8) y dimensión de centro de costo (PN-I7).
- **Factores de provisión:** de constantes hardcoded → `ParametroLegalNomina` (§9).
- **Salvaguarda:** de "advertir y liquidar" → **bloquear** (§10); U4 ya clasifica resultados válidos, advertencias y bloqueos, y usa `blocks` como fuente funcional.
- **Reliquidación:** de destructiva (delete/recreate) → nueva versión + ajuste (§11).
- **Salario base:** divergencia material entre empleado y contrato se trata como bloqueo funcional fail-secure.

### Se añade

- Snapshot inmutable de la Liquidación (§8).
- Flujo de revisión/aprobación (§6).
- `PayrollBlock` persistente con ciclo de vida `ACTIVE | RESOLVED | EXCLUDED` (§10).
- Mapper concepto→cuenta y causación (P2, §11).

### Se separa / renombra

- `Liquidation` (retiro) → **`Finiquito`**, feature-flagged, fuera de v1 (§5, §13).

### Deuda técnica a sanear

- `ParametroLegalNomina.updatedAt` mutable vs. reproducibilidad → resuelto por copia inmutable (§8).
- Columnas nullable heredadas de runs "N1" → decidir saneamiento contra datos reales.
- Duplicación de carga de datos entre `generatePayroll` y `recalculatePayroll`.
- Procesamiento síncrono en el request HTTP (riesgo de timeout con planta grande).

---

## 17. Roadmap

Cada fase es mergeable de forma independiente. El orden es deliberado: los catálogos habilitan el núcleo; el núcleo habilita la integración contable; la integración habilita PILA y nómina electrónica.

```
Payroll Research (completado)            docs/research/payroll/
        │
ADR Payroll (este documento, rev. 3)     docs/adr/ADR-002-payroll-core.md
        │
P0  — Catálogos de Payroll  (~70% hecho) Parámetros legales (existe) + factores de provisión a params + conceptos + calendario
        │
P1  — Payroll Core                       ProcesoNómina (estados), Liquidación válida, snapshot inmutable,
        │                                centro de costo, salvaguarda fail-secure, PayrollBlock, contrato público
        │
P1.5 — Corrección post-aprobación         Acto explícito, ciclo propio e invariantes sobre aprobación original
Futuro — Materialización de correcciones  Fuera de P1.5
        │
P2  — Integración con Accounting         Mapper concepto → cuenta, contabilizar nómina (misma tx), ajustes idempotentes
        │
P3  — Integración con Treasury           Resultado de dispersión (datos), hitos de pago
        │
P4  — PILA                               Planilla Integrada de Liquidación de Aportes (v2)
        │
P5  — Nómina Electrónica                 Documento soporte DIAN (futuro)
```

**Principio de priorización:** P0–P2 entregan una nómina completa, correcta y contabilizada. Eso es el MVP. P3–P5 son extensiones que dependen de clientes reales y regulación.

**Alcance cerrado de P1:** Payroll P1 comprende el flujo completo de generación, revisión y aprobación segura de una nómina ordinaria: resultados válidos, snapshots aprobados, centro de costo, contrato público y gestión fail-secure de bloqueos. Las capacidades de corrección posteriores a la aprobación no forman parte de P1 y pasan a **Payroll P1.5**.

---

## 18. Riesgos aceptados y cuestiones abiertas

### Riesgos aceptados

| Riesgo                                                             | Decisión                                | Mitigación                                                                                                |
| ------------------------------------------------------------------ | --------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Error de nómina detectado por el cliente.**                      | Aceptado como riesgo operativo del MVP. | Reliquidación y reversión controladas; el error se corrige con trazabilidad, no editando.                 |
| **El catálogo cerrado de conceptos no cubre un caso real.**        | Aceptado.                               | Se extiende el catálogo de forma curada (el equipo decide, no el usuario).                                |
| **Cambio regulatorio que afecte los parámetros legales.**          | Aceptado.                               | El versionado por vigencia permite incorporar el cambio sin reescribir el pasado.                         |
| **Volumen de empleados que degrade el cálculo secuencial.**        | Aceptado.                               | La arquitectura de agregados independientes por empleado permite paralelización futura sin rediseño.      |
| **Cliente con tipo de contrato o salario no soportado en v1.**     | Aceptado.                               | La salvaguarda fail-secure bloquea la liquidación en lugar de producir un resultado incorrecto.           |
| **Descuadre entre el resultado de Payroll y el asiento contable.** | Aceptado como riesgo operativo.         | El mapper vive en la capa de integración de Payroll y es verificable; reporte de conciliación por origen. |

### Cuestiones abiertas

1. **¿Hay datos de nómina en producción?** Define si las siguientes fases requieren backfill o saneamiento limpio de datos históricos.
2. **Finiquito:** ¿se mantiene operativo detrás de flag o se congela hasta v2?
3. **Materialización de correcciones:** iniciativa posterior a P1.5 para definir y habilitar los efectos materiales y sus ajustes contables sobre nóminas ya causadas.

---

_Fin del ADR-002 (revisión 3)._
