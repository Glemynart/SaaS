# ADR-001 — Núcleo del motor contable

| Campo           | Valor                                                                             |
| --------------- | --------------------------------------------------------------------------------- |
| **Estado**      | Aprobado                                                                          |
| **Fecha**       | 2026-06-24                                                                        |
| **Decisores**   | Arquitectura · Contabilidad funcional                                             |
| **Ámbito**      | SaaS multiempresa "La Oficina Nítida" — `apps/api` (NestJS · Prisma · PostgreSQL) |
| **Reemplaza**   | —                                                                                 |
| **Relacionado** | Nómina (N2A–N2D), Facturación electrónica (DIAN), Liquidaciones                   |

---

## 1. Contexto

La plataforma ya opera módulos que generan hechos económicos: nómina (devengos, deducciones, aportes patronales, provisiones N2B, liquidaciones N2D), facturación interna y electrónica DIAN, y a futuro cartera, tesorería y compras. Hoy cada módulo persiste sus totales de forma aislada; **no existe un libro contable que los consolide** ni base para estados financieros, libros oficiales (diario, mayor, balance de prueba) ni información exógena.

Se requiere un motor contable que:

- Sea **legalmente correcto** para Colombia (PUC Decreto 2650/1993, partida doble, causación).
- Encaje en el codebase existente: `tenantId` en cada tabla y como primer índice, UUID, `Decimal` con disciplina de peso entero, snapshots inmutables, calculadoras puras, numeración consecutiva tipo `Factura`, `AuditLog` central.
- Se implemente **por fases mergeables**, sin reescribir nómina ni facturación.
- **Evite la sobreingeniería**: no es un ERP, no usa microservicios, ni eventos distribuidos, ni doble ledger caja/causación.

**Restricción rectora:** el cliente objetivo (operador educativo colombiano) necesita nómina legal y contratación masiva; el motor contable es infraestructura habilitante, no un fin en sí mismo. Toda complejidad debe justificarse contra ese objetivo.

---

## 2. Decisión

Se adopta **un único libro mayor de partida doble, en causación, append-only e inmutable tras contabilizar**, con **un solo puerto de entrada** por el cual los módulos fuente postean comprobantes balanceados.

Principios no negociables de la decisión:

1. **Un solo libro en causación.** El estado de caja es un _reporte_ derivado de las cuentas de efectivo (clase 11), no un segundo ledger.
2. **Dependencia de una sola dirección.** Los módulos importan el contable; el núcleo **nunca** importa nómina ni facturación.
3. **Movimientos como fuente de verdad.** Los saldos se derivan; cualquier snapshot de saldos es caché reconstruible, jamás la verdad.
4. **PUC plantilla de plataforma clonado por tenant.** Cada tenant tiene su propio plan de cuentas, personalizable; el catálogo global nunca altera libros en operación.
5. **Tercero canónico unificado** por identidad documental, conviviendo con los modelos operativos existentes (`Empleado`, `ClienteFE`, `Customer`), sin fusionarlos.
6. **Monolito + misma transacción.** La operación fuente y su contabilización ocurren en el mismo `$transaction` de PostgreSQL: sin broker, sin outbox, sin consistencia eventual.

---

## 3. Invariantes

Estas reglas son verificables y se hacen cumplir en el service de contabilización (y, donde aplique, por constraints de BD). Su violación es un defecto bloqueante.

| #   | Invariante                                                                                                                | Punto de aplicación |
| --- | ------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| I1  | Todo comprobante `CONTABILIZADO` cumple **Σ débitos = Σ créditos**.                                                       | Contabilización     |
| I2  | Lo `CONTABILIZADO` es **inmutable**: nunca `UPDATE` de línea ni `DELETE` de comprobante. Corrección por reverso o ajuste. | Persistencia        |
| I3  | **No se contabiliza en período `CERRADO`.**                                                                               | Contabilización     |
| I4  | Cada línea tiene **exactamente uno** de `debito`/`credito` mayor que cero.                                                | Validación de línea |
| I5  | Solo cuentas **`imputable` y `activa`** reciben movimiento.                                                               | Validación de línea |
| I6  | Se respeta `requiereTercero` / `requiereCentroCosto` / `requiereBase` de la cuenta.                                       | Validación de línea |
| I7  | Numeración **consecutiva y sin huecos** por `(tenant, tipoComprobante)`, asignada en la contabilización (no en borrador). | Contabilización     |
| I8  | **Idempotencia de origen:** un documento fuente genera a lo sumo un comprobante — único `(tenant, origenTipo, origenId)`. | Constraint de BD    |
| I9  | Toda transición de estado, cierre, reapertura y anulación queda en `AuditLog` (quién, cuándo, motivo).                    | Auditoría           |

---

## 4. Entidades

Vocabulario de dominio en español (es contabilidad colombiana; lo leen contadores), consistente con la convención del repo: UUID, `tenantId`, `createdAt`/`updatedAt`, snake_case plural vía `@@map`.

| Entidad                 | Rol                           | Notas clave                                                                                                                                                                       |
| ----------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **CuentaContable**      | Plan de cuentas (árbol PUC)   | `codigo`, `cuentaPadreId`, `nivel`, `naturaleza` (DÉBITO/CRÉDITO), `claseContable`, `imputable`, `esCuentaSistema`, `requiereTercero/CentroCosto/Base`. **Sin saldo almacenado.** |
| **Tercero**             | Contraparte contable canónica | Único `(tipoDocumento, numeroDocumento)`. Roles por banderas (cliente, proveedor, empleado, entidad gubernamental, banco). Régimen y responsabilidades fiscales para exógena.     |
| **PeriodoContable**     | Unidad de control de cierre   | `(tenant, año, mes)` + envoltorio de año fiscal. `estado` ABIERTO/CERRADO.                                                                                                        |
| **TipoComprobante**     | Catálogo de comprobantes      | Prefijo + consecutivo propio (CI, CE, CC, NC, nómina, ventas).                                                                                                                    |
| **ComprobanteContable** | Encabezado del asiento        | `fecha`, `periodoId`, `tipoId`, `numero`, `concepto`, `estado`, `moneda`, `totalDebito/Credito`, `origenTipo`/`origenId`, `usuarioId`.                                            |
| **MovimientoContable**  | Línea débito/crédito          | `cuentaId`, `terceroId`, `centroCostoId?`, `debito`, `credito`, `baseGravable?`, `descripcion`.                                                                                   |
| **CentroCosto**         | Dimensión analítica opcional  | Catálogo plano (arranca mapeado 1:1 con `Sede`). **Sin jerarquía ni prorrateo.**                                                                                                  |
| **CuentaSistemaMap**    | Registro rol → cuenta         | Desacopla integraciones del código de cuenta (`IVA_GENERADO_19`, `SALARIOS_POR_PAGAR`, `BANCO_PRINCIPAL`…).                                                                       |

**Multimoneda:** se reservan columnas (`moneda`, `tasaCambio`) pero el motor opera **solo COP** en V1. El libro siempre se lleva y reporta en COP.

**`AuditLog`:** se reutiliza el existente; no se crea entidad nueva de auditoría.

---

## 5. Estados

### Comprobante

```
BORRADOR ──contabilizar──▶ CONTABILIZADO ──anular──▶ ANULADO
```

| Estado          | Editable | Número   | Afecta libros | Reglas                                                      |
| --------------- | -------- | -------- | ------------- | ----------------------------------------------------------- |
| `BORRADOR`      | Sí       | No       | No            | Descartable libremente.                                     |
| `CONTABILIZADO` | No       | Sí       | Sí            | Cuadra (I1), cuentas imputables (I5), período abierto (I3). |
| `ANULADO`       | No       | conserva | No            | Solo desde `CONTABILIZADO`.                                 |

**Corrección:** período abierto → `ANULADO` (excluido de reportes) o nota de ajuste; **período cerrado → comprobante de reverso** en período abierto (el original no se toca). La anulación nunca borra ni libera consecutivo.

### Período

```
ABIERTO ──cerrar──▶ CERRADO ──reabrir (ADMIN, auditado, motivo)──▶ ABIERTO
```

La **reapertura es rara por diseño**: el mecanismo de corrección preferente es el reverso/ajuste en período abierto, no reabrir. El **cierre anual** genera un comprobante que cancela las clases de resultado (4, 5, 6, 7) contra patrimonio.

---

## 6. Puerto contable

El núcleo expone **una única superficie de entrada**. Los módulos fuente construyen un comprobante en borrador (encabezado + líneas + `origenTipo`/`origenId`) y lo entregan; el núcleo valida, numera, contabiliza y devuelve el resultado.

Operaciones del puerto:

- `registrarComprobante(borrador)` → valida invariantes, asigna número, contabiliza.
- `anular(comprobanteId, motivo)` → marca anulado o emite reverso según el período.
- `cerrarPeriodo` / `reabrirPeriodo` → control de cierre auditado.
- `saldos(tenant, rangoCuentas, rangoFechas, [tercero], [centroCosto])` → **primitiva única** de la que derivan todos los reportes.

Reglas del puerto:

- **El núcleo no conoce nómina ni facturación.** El `borrador` es genérico (cuenta, tercero, centro de costo, débito/crédito).
- Cada módulo es dueño de su **mapper dominio → cuentas** (calculadora pura, como las de nómina), que resuelve `rol → cuenta` vía `CuentaSistemaMap`.
- La contabilización ocurre en la **misma transacción** que la operación fuente.
- La **idempotencia** (I8) protege contra doble contabilización al reprocesar.

---

## 7. Integraciones futuras

Todos los módulos integran por el mismo puerto, sin acoplar el núcleo.

| Módulo                      | Disparador                               | Asiento típico                                                                                                                      |
| --------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Nómina electrónica**      | Cierre de `PayrollPeriod` / run aprobado | DB gasto de personal + parafiscales · CR salarios por pagar, retenciones, seguridad social. Provisiones N2B → DB gasto · CR pasivo. |
| **Liquidaciones**           | Transición a `PAID`                      | DB prestaciones · CR por pagar / banco.                                                                                             |
| **Facturación electrónica** | Factura `ACEPTADA`                       | DB CxC (tercero) · CR ingresos (41), IVA generado (2408), retefuente/reteica.                                                       |
| **Cartera (CxC)**           | — (no es ledger)                         | **Vista**: auxiliar de la cuenta por cobrar por tercero + cruce de pagos (open items). El recaudo postea DB banco · CR clientes.    |
| **Tesorería**               | Pago / recaudo                           | Movimientos sobre 1105/1110. **Conciliación** = matching de movimientos vs. extracto.                                               |

**Principio:** nómina y facturación son **documentos fuente** que postean; cartera y tesorería son **vistas/subledgers** sobre el mayor. Modelar cartera o tesorería como libros nuevos es duplicar el motor y queda explícitamente descartado.

---

## 8. Riesgos aceptados

| Riesgo                                                                    | Decisión                           | Mitigación                                                                                                                        |
| ------------------------------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Cálculo de saldos por escaneo** de movimientos no escala a largo plazo. | Aceptado en V1.                    | Índices `(tenantId, cuentaId, fecha)`; tabla `SaldoCuentaPeriodo` (snapshot reconstruible) cuando el volumen lo exija — no antes. |
| **Sin multimoneda funcional.**                                            | Aceptado.                          | Columnas reservadas; activación es aditiva, sin migración estructural.                                                            |
| **Centros de costo sin jerarquía ni prorrateo.**                          | Aceptado.                          | El campo opcional existe desde V1; el motor analítico se difiere a demanda real.                                                  |
| **Contención del consecutivo** bajo alta concurrencia de posteo.          | Aceptado.                          | Contadores por tipo + transacciones cortas (patrón `Factura`).                                                                    |
| **Reapertura de período** puede re-expresar declaraciones presentadas.    | Aceptado y restringido.            | Solo ADMIN, auditada, con motivo; el diseño empuja al reverso.                                                                    |
| **Descuadre subledger ↔ mayor** (nómina/factura vs. contable).            | Aceptado como riesgo operativo.    | Reporte de conciliación por `origenTipo`/`origenId`.                                                                              |
| **Plan único PUC** (NIIF como reclasificación, no árbol paralelo).        | Aceptado para el cliente objetivo. | Si un tenant exige NIIF separado, se evalúa como extensión, no se asume en V1.                                                    |

**Anti-objetivos explícitos (no se construyen):** doble ledger caja/causación, microservicios, eventos distribuidos, broker/outbox, DSL de reglas de causación, jerarquías de centro de costo, presupuesto, tablas de tercero por tipo, saldos almacenados como fuente de verdad.

---

## 9. Fases de implementación

Cada fase es mergeable de forma independiente, al estilo de las cadenas N2D / N3A.

| Fase                             | Alcance                                                                                                                                                              | Depende de |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| **C0 — Catálogos**               | `CuentaContable` (seed PUC), `Tercero`, `PeriodoContable`, `TipoComprobante`, `CentroCosto`. CRUD + seed.                                                            | —          |
| **C1 — Motor de asientos**       | `ComprobanteContable` + `MovimientoContable`; estados; balance (I1); numeración (I7); control de período (I3); inmutabilidad (I2). Nota contable manual. **Núcleo.** | C0         |
| **C2 — Reportes núcleo**         | Primitiva `saldos()` → libro diario, mayor, balance de prueba.                                                                                                       | C1         |
| **C3 — Estados financieros**     | Balance general, estado de resultados, cierre mensual y anual.                                                                                                       | C2         |
| **C4 — Integración Facturación** | Puerto + mapper de factura + `CuentaSistemaMap`. Factura `ACEPTADA` → comprobante de venta.                                                                          | C1         |
| **C5 — Integración Nómina**      | Mapper de nómina. Cierre de período → causación y provisiones.                                                                                                       | C1         |
| **C6 — Cartera + Tesorería**     | Subledgers/vistas: open items sobre CxC, recaudos/pagos, conciliación.                                                                                               | C3, C4     |
| **C7+ — Escala**                 | `SaldoCuentaPeriodo`, plantillas de causación configurables, multimoneda, exógena, presupuesto.                                                                      | A demanda  |

**C0–C3 entregan un motor contable manual completo y reportable** sin tocar nómina ni facturación. C4–C5 conectan los módulos existentes. C6 en adelante es expansión.

---

_Fin del ADR-001._
