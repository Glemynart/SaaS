# Backlog de GOAL-02 — Evolución Financiera y Cumplimiento Electrónico

Actualizado: 2026-10-30. GOAL-02 es el único Goal activo; GOAL-01 está pausado,
no cerrado. Este backlog conserva el resultado completo de GOAL-02 y prioriza
primero flujos financieros internos que puedan mostrarse a futuros clientes.

## M0 — Flujos financieros internos demostrables

| Prioridad | Estado    | Iniciativa                                                                              | Criterios de aceptación                                                                                                                                                                                                                         | Dependencias y riesgo                                                                                                                                                                                                                     |
| --------- | --------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0        | EN CURSO  | Validar que cada producto de una factura pertenezca al tenant activo y esté disponible. | La API acepta productos activos del mismo tenant, rechaza IDs ajenos, inexistentes o inactivos sin crear la factura, conserva líneas manuales y tiene pruebas de regresión.                                                                     | Sin migración ni decisión de dominio; riesgo alto por aislamiento multiempresa.                                                                                                                                                           |
| P1        | PENDIENTE | Conectar la emisión interna de facturas con el Ledger.                                  | Un acto interno genera un comprobante balanceado e idempotente con tercero, período y origen trazables; anular/corregir conserva evidencia y usa reversión del Ledger.                                                                          | ADR sobre cliente contable, impuestos, evento de emisión, cuentas y reversión; riesgo financiero alto.                                                                                                                                    |
| P1        | EN CURSO  | Verificar de extremo a extremo la causación de nómina en el Ledger desde la UI.         | Un período aprobado conserva su snapshot, crea una causación una sola vez, muestra el comprobante y soporta la corrección definida por el dominio. La rama apilada agrega formulario, transiciones RBAC y comprobante de ajuste en la pantalla. | Reutilizar Payroll y Ledger existentes; permisos, preflight, idempotencia y persistencia cuentan con pruebas de servicio; falta integrar las PR apiladas y verificar el recorrido completo con una nómina demostrable antes de cerrar P1. |
| P1        | EN CURSO  | Preparar un escenario financiero reproducible con datos sintéticos para demo.           | Un tenant explícitamente de demostración carga clientes, productos, facturas internas, nómina, centro de costo, tercero y causación balanceada; la carga es idempotente, tenant-scoped y se verifica desde la UI.                               | Seed local con doble confirmación del tenant; catálogos contables globales preexistentes; factura interna sin integración Ledger/DIAN; el comprobante de nómina es append-only. PR y CI aún pendientes.                                   |

## H1 — Fundación de integraciones regulatorias

| Prioridad | Estado    | Iniciativa                                                                 | Criterios de aceptación                                                                                                                        | Dependencias y riesgo                                                                   |
| --------- | --------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| P1        | PENDIENTE | Aprobar modelo de eventos, evidencia, secretos y adaptadores regulatorios. | ADRs cubren idempotencia, estados, correcciones, retención, permisos, auditoría y cambio de proveedor; proveedor fake con pruebas de contrato. | Caso de uso real y revisión de ADR-SEC-001; no requiere desplegar una integración real. |

## H2/H3 — Cumplimiento electrónico

| Prioridad | Estado    | Iniciativa                                                | Criterios de aceptación                                                                                                                      | Dependencias y riesgo                                                                       |
| --------- | --------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| P2        | PENDIENTE | Facturación electrónica DIAN por proveedor especializado. | Factura fiscal trazable desde Invoice, intentos idempotentes, estados normalizados, rechazo/contingencia y evidencia verificable en sandbox. | H1, ADR fiscal, proveedor, sandbox y custodia de certificados; riesgo normativo alto.       |
| P2        | PENDIENTE | Nómina electrónica derivada de PayrollSnapshot.           | Una nómina aprobada produce un evento inmutable, con rechazo/reintento/corrección y evidencia vinculada al período y al empleado.            | H1, reglas vigentes, proveedor, sandbox, seguridad y ADR de eventos; riesgo normativo alto. |

## H4 — Operación financiera ampliada

| Prioridad | Estado    | Iniciativa                        | Criterios de aceptación                                                                                                    | Dependencias y riesgo                                                 |
| --------- | --------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| P2        | PENDIENTE | Cartera y aplicación de recaudos. | Saldos, vencimientos, pagos parciales y aplicación contra facturas se derivan de hechos trazables y cuadran con el Ledger. | Facturación estable, tercero canónico y caso comercial verificable.   |
| P2        | PENDIENTE | Tesorería y conciliación.         | Obligaciones y pagos se concilian con extractos para un banco/flujo concreto con auditoría e idempotencia.                 | Necesidad real de cliente, Cartera/Payroll/Compras y datos bancarios. |
| P3        | PENDIENTE | Compras y cuentas por pagar.      | Proveedor, obligación, soporte, causación y pago se rastrean hasta el Ledger.                                              | Tercero canónico, aprobaciones y necesidades de proveedor.            |
| P3        | PENDIENTE | Reportes financieros integrados.  | Los reportes se calculan desde fuentes completas; cualquier cobertura parcial se identifica claramente.                    | H4.1–H4.3 o fuentes equivalentes ya verificadas.                      |

## Evidencia inicial y límites

- `main` en `ec9cff01` contiene Billing para clientes, productos y facturas
  internas; el schema distingue esas facturas de la cohorte electrónica
  heredada.
- Payroll ya depende del módulo Accounting; Billing no invoca el Ledger en el
  código revisado. Esta diferencia es una señal de integración pendiente, no
  prueba de que la causación de nómina esté lista para demo.
- La entrega local de causación añade a la pantalla de período la acción ADMIN,
  el preflight visible y el comprobante persistido con sus movimientos. La rama
  apilada agrega el ciclo de correcciones post aprobación y la lectura del
  comprobante de ajuste. P1 continúa EN CURSO hasta integrar las PR y verificar
  el recorrido completo desde una nómina aprobada.
- La rama `codex/goal02-financial-demo-data` prepara un seed local idempotente
  para dos clientes, tres productos, tres facturas internas, un empleado y su
  tercero contable, un centro de costo y una nómina sintética con causación en
  Ledger. La prueba Browser E2E valida aislamiento frente a otro tenant,
  persistencia, reejecución sin duplicados y lectura desde Facturación y Nómina.
  La rama también conecta cada obligación de salarios con el tercero canónico
  por tipo y número de documento, exigido por la cuenta PUC 250505, y conserva el
  centro de costo requerido por las cuentas de gasto. El código sigue fuera de
  `main` hasta completar CI y revisión del PR.
- `Decisiones de Producto.md`, `ENGINEERING_PLAYBOOK.md` y
  `LA_OFICINA_NITIDA_CONTEXT.md` no existen en la raíz ni aparecen en el
  inventario de archivos del checkout consultado. El plan usa `PROJECT_STATE.md`,
  documentación de Goals y código real; la ausencia queda registrada hasta que
  esos documentos se recuperen o se confirme que fueron retirados.
- No se inspeccionaron ni modificaron bases de staging o producción. No se
  generaron datos financieros ni se transmitió información a DIAN/UGPP.

## Estado de Goal y dependencias de entrega — 2026-10-30

- **GOAL ACTIVO:** GOAL-02; GOAL-01 permanece pausado y conservado según
  `docs/goals/README.md`.
- **IMPLEMENTACIÓN BLOQUEADA:** los jobs `verify` y `browser` de PR #155, #156
  y #157 fueron rechazados antes de iniciar runner. GitHub informa pagos
  recientes fallidos o límite de gasto; esto no es un resultado de las pruebas
  del código. En PR #157 pasaron localmente typecheck, builds, pruebas de
  nómina y Playwright, y el Preview de Vercel pasó; CI remoto sigue pendiente.
- **ESPERANDO_MERGE:** PR #151 y #154–#157 conservan la secuencia de bases
  vigente: #151 parte de `main`; #154, #155 y #157 de #151; #156 de #155. #151
  y #154 tienen checks verdes. No se integran cambios a `main` en esta entrega:
  el Goal Master prohíbe despliegues productivos y el historial operativo de
  `deploy/README.md` documenta que un merge a `main` puede publicar Production.
- **ARQUITECTURA DISPONIBLE:** el M0 prioriza demostrar flujos financieros
  internos. ADR-011 propone contabilizar facturas internas al emitirlas, pero
  sigue en estado propuesto y requiere resolver las condiciones previas antes
  de implementar esa integración; no habilita contabilización fiscal ni DIAN.
