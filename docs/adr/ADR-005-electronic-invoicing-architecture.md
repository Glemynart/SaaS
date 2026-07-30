# ADR-005 — Arquitectura de facturación electrónica

| Campo           | Valor                                                                |
| --------------- | -------------------------------------------------------------------- |
| **Estado**      | accepted                                                             |
| **Fecha**       | 2026-07-29                                                           |
| **Decisores**   | Equipo de arquitectura y producto                                    |
| **Ámbito**      | SaaS multiempresa «La Oficina Nítida» · facturación electrónica DIAN |
| **Relacionado** | [PR10](../PR10-ELECTRONIC-INVOICING-ARCHITECTURE.md), ADR-001        |

## Contexto

El módulo de facturación interno existente no tiene aún la semántica, evidencia ni resiliencia requeridas para emitir documentos electrónicos ante DIAN. La integración con MATIAS es externa, su contrato puede evolucionar y las entregas asíncronas pueden repetirse o quedar ambiguas. La solución debe respetar el monolito multiempresa, conservar la trazabilidad fiscal y no acoplar el dominio ni a un proveedor ni a BullMQ.

## Decisión

Se adopta un bounded context de facturación electrónica dentro del monolito modular. `FacturaElectronica` es el agregado fiscal inmutable tras la numeración; la transmisión es durable e idempotente; MATIAS queda detrás de un puerto de transmisión y BullMQ es únicamente un ejecutor de infraestructura reemplazable.

## Decisiones internas

### FE-01 — Contexto dentro del monolito modular

Se mantiene la facturación electrónica como bounded context del monolito, separado del billing interno actual. Se descartan un microservicio independiente y extender sin límite el modelo interno; reduce complejidad operativa y preserva límites explícitos.

### FE-02 — Agregado fiscal con snapshot inmutable

`FacturaElectronica` conserva snapshots de emisor, adquirente, líneas, impuestos y totales desde la numeración. Se descarta leer catálogos vivos o editar lo emitido; las correcciones se resuelven mediante un documento fiscal nuevo conforme a la regla aplicable.

### FE-03 — Numeración local, atómica y por tenant

El consecutivo se asigna desde un rango del tenant al crear la transmisión durable, no en borrador ni como campo manual. Se descarta delegarlo implícitamente al proveedor; un número asignado no se reutiliza y la auditoría explica cualquier excepción.

### FE-04 — Transmisión durable y ejecución desacoplada

Los casos de uso dependen solo del puerto de transmisión electrónica y la transmisión persistida es la fuente de verdad. BullMQ es el ejecutor inicial que despierta el procesamiento, no una dependencia de dominio ni un requisito permanente; puede cambiarse sin modificar reglas de negocio. Se descartan la emisión HTTP síncrona y confiar solo en una cola efímera.

### FE-05 — Puerto MATIAS y payload canónico propio

MATIAS se consume mediante una capa anticorrupción. **El payload canónico del dominio nunca será el DTO del proveedor: el dominio define su propio modelo y el adaptador traduce hacia y desde MATIAS API.** Se descarta filtrar DTOs, códigos de error o convenciones MATIAS al agregado fiscal.

### FE-06 — Perfil fiscal y secretos por tenant

Cada tenant tiene perfil emisor, habilitación, rango y referencia de credenciales propios. Se descarta una API key global compartida; los secretos no se guardan en claro ni se registran en auditoría.

### FE-07 — Conciliación antes de repetir resultados ambiguos

Ante un timeout o respuesta no concluyente, la factura pasa a conciliación y se consulta al proveedor antes de reintentar. Se descarta repetir ciegamente cualquier fallo de red para evitar documentos duplicados.

### FE-08 — Contabilización posterior a aceptación

Solo `FACTURA_ACEPTADA` puede causar la venta mediante el puerto contable y la idempotencia de origen de ADR-001. Se descarta contabilizar al crear o transmitir, y se mantiene la consistencia eventual controlada entre lo fiscal y el libro.

### FE-09 — Evidencia privada y auditoría central

Los artefactos autorizados se conservan privados con checksum y las acciones se registran en `AuditLog` sin secretos ni PII innecesaria. Se descartan URL públicas permanentes y el uso de logs como almacén de evidencia.

## Alternativas consideradas

### Acoplar el dominio a MATIAS y BullMQ

- **Pros**: menor trabajo inicial de integración.
- **Contras**: cambios del proveedor o del mecanismo de ejecución afectarían las reglas de negocio y las pruebas del dominio.
- **Por qué no**: la resiliencia y la capacidad de cambiar infraestructura son requisitos del módulo fiscal.

### Emitir sin persistencia durable o de manera síncrona

- **Pros**: flujo inicial aparentemente simple.
- **Contras**: timeouts ambiguos, pérdida de trabajo y riesgo de doble transmisión.
- **Por qué no**: no ofrece evidencia ni recuperación segura para un documento fiscal.

## Consecuencias

### Positivas

- El modelo fiscal, la auditoría y la numeración permanecen bajo control de la plataforma y por tenant.
- Cambiar MATIAS o BullMQ se localiza en infraestructura; la validación sandbox precede al adaptador.
- Los reintentos y la contabilidad se realizan sin duplicar documentos ni comprobantes.

### Negativas

- Requiere snapshots, estados técnicos, reconciliación y un adaptador explícito.
- La salida a producción depende de validar el contrato real de MATIAS y la habilitación de cada tenant.

### Riesgos

- Cambios regulatorios o del contrato externo: se mitigan con payload versionado, puerto aislado y sandbox.
- Rangos/credenciales mal configurados: se mitigan con validación, alertas y auditoría administrativa.
- Indisponibilidad externa: se mitiga con transmisión durable, ejecutor reemplazable, reconciliador y circuit breaker.
