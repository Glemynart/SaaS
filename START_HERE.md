## **START_HERE.md**

## **SaaS de Gestión Administrativa para Operadores Educativos y Contratistas**

## **Estado del Proyecto**

Este documento describe la visión y el contexto del proyecto. La existencia de una capacidad se verifica siempre contra el código y su recorrido funcional; la documentación es una hipótesis hasta comprobarla.

Antes de escribir código, modificar arquitectura o agregar funcionalidades, cualquier desarrollador o IA debe leer este documento completo.

La metodología vigente está en [`docs/goals/README.md`](docs/goals/README.md). El Goal activo es [`GOAL-01 — Primer Cliente Operando`](docs/goals/GOAL-01-primer-cliente-operando.md) y gobierna la priorización sobre cualquier orden o alcance histórico de este documento.

## **Visión del Producto**

Desarrollar una plataforma SaaS multiempresa enfocada en pequeñas empresas, contratistas y operadores educativos que permita gestionar:

- Contratos masivos.

- Contratos individuales.

- Expediente digital de empleados.

- Alertas de vencimiento contractual.

- Facturación electrónica.

- Contabilidad v1.

- Nómina electrónica (fase futura).

La plataforma no busca ser un ERP contable integral ni reemplazar de inmediato sistemas como Siigo, World Office o Helisa. Incluye contabilidad v1 para operar catálogos, comprobantes, reportes y cierres por tenant; las integraciones y alcances regulatorios más amplios siguen siendo evoluciones posteriores.

La propuesta de valor es:

- Menor complejidad.

- Implementación rápida.

- Soporte cercano.

- Automatización de procesos repetitivos.

- Menor dependencia de soluciones ERP tradicionales.

## **Mercado Objetivo**

## **Cliente Principal**

Operadores educativos.

1

Características:

- 50 a 300 empleados.

- Contratación masiva anual.

- Alto volumen documental.

- Necesidad de preavisos.

- Gestión constante de contratos.

## **Cliente Secundario**

Contratistas y pequeñas empresas.

Características:

- Uso intensivo de facturación electrónica. • Necesidad de generar contratos.

- Poco interés en sistemas ERP complejos.

## **Qué Problema Resolvemos**

## **Recursos Humanos**

- Generación masiva de contratos.

- Generación individual de contratos.

- Gestión documental.

- Control de vencimientos.

- Expediente digital.

## **Facturación**

- Facturación electrónica.

- Notas crédito.

- Notas débito.

- Historial documental.

- Reenvío de documentos.

## **Qué NO Somos**

No somos:

- ERP.

- ERP contable integral.

- Sistema financiero.

- Software de tesorería.

- Sistema bancario.

2

La contabilidad v1 se opera dentro de la plataforma. Las integraciones con Siigo, World Office, Helisa, Alegra u otros sistemas son alcance futuro.

## **Visión funcional histórica**

La lista siguiente conserva la visión amplia del producto. No representa por sí sola el alcance comercial activo ni demuestra que una capacidad exista. GOAL-01 define qué debe completarse para el primer cliente; las capacidades futuras permanecen en Backlog hasta ser priorizadas.

## **Módulo 1**

Autenticación y Multiempresa.

Incluye:

- Registro de empresa.

- Login.

- JWT.

- Roles.

- Usuarios.

## **Módulo 2**

Empleados.

Incluye:

- CRUD.

- Importación Excel.

- Búsqueda.

- Filtros.

## **Módulo 3**

Plantillas de Contratos.

Incluye:

- Upload DOCX.

- Variables dinámicas.

- Vista previa.

3

## **Módulo 4**

Contratos Individuales.

Incluye:

- Generación DOCX.

- Generación PDF.

- Historial.

## **Módulo 5**

Contratos Masivos.

Incluye:

- Carga Excel.

- Generación por lotes.

- ZIP final.

## **Módulo 6**

Expediente Digital.

Incluye:

- Upload documentos.

- Clasificación.

- Descarga. • Historial.

## **Módulo 7**

Alertas.

Incluye:

- Contratos por vencer.

- Alertas 30 días.

- Alertas 15 días.

- Alertas 7 días.

4

## **Capacidad futura — Módulo 8**

Facturación Electrónica.

Fuera de GOAL-01. El código actual contiene una fundación de facturación interna, pero no emisión electrónica DIAN ni integración Matías API.

Incluye:

- Clientes.

- Productos.

- Facturas.

- Notas crédito.

- Notas débito.

- PDF.

- XML.

- Integración Matías API.

## **Capacidad existente o futura según el caso — Módulo 9**

Documentos Generados, Certificaciones Laborales y Contabilidad v1.

Documentos generados y certificaciones apoyan GOAL-01. La superficie comercial de contabilidad requiere una decisión de producto futura y no bloquea el Goal activo.

Incluye:

- Snapshot documental inmutable y PDF canónico.

- Publicación en expediente digital.

- Certificaciones laborales mediante `GeneratedDocument` y `ExpedienteDoc`.

- Catálogos, comprobantes, reportes y cierres contables por tenant.

## **Funcionalidades Fuera del MVP**

NO desarrollar inicialmente:

- Nómina electrónica completa.

- Firma electrónica.

- Portal empleados.

- Portal clientes.

- Workflow documental.

- Integraciones bancarias.

- Inteligencia artificial documental.

- Dashboard avanzado.

- Viewer role.

- Importación masiva de clientes FE.

- ZIP completo de expediente.

Estas funcionalidades quedan para versiones posteriores.

## **Arquitectura Aprobada**

## **Frontend**

- Next.js 14

- React

- TypeScript

- Tailwind CSS

## **Backend**

- NestJS

5

• TypeScript

## **Base de Datos**

- PostgreSQL

## **ORM**

- Prisma

## **Cola de Procesamiento**

- BullMQ • Redis

## **Storage**

- Cloudflare R2

## **Infraestructura**

- Railway

## **Correo**

- Resend

## **Multiempresa**

Modelo:

- `Tenant ├─ Users`

- `├─ Employees`

- `├─ Contracts`

- `├─ Documents`

- `├─ Customers`

6

```
 ├─ Products
 └─ Invoices
```

Regla obligatoria:

Todas las tablas deben tener:

```
tenantId
```

Toda consulta debe filtrar por:

```
where:{
tenantId
}
```

El tenantId siempre proviene del JWT.

Nunca desde el body.

Nunca desde parámetros manipulables por el usuario.

## **Seguridad**

Implementar desde el inicio:

## **JWT**

Access Token:

- 15 minutos.

Refresh Token:

- 7 días.

## **Rate Limiting**

Obligatorio en:

- Login.

- Registro.

- Refresh Token.

7

## **Validación de Archivos**

No confiar en MIME enviado por navegador.

Validar:

- Magic numbers. • Extensiones permitidas.

- Tamaño máximo.

## **Límite de Procesamiento**

Máximo:

```
500 empleados por lote
```

Validar antes de encolar.

## **Auditoría**

Agregar módulo AuditLog.

Registrar:

- Login.

- Creación.

- Edición.

- Eliminación.

- Emisión de facturas. • Generación de contratos.

## **Riesgos Técnicos Prioritarios**

## **Riesgo #1**

Conversión DOCX → PDF.

Debe resolverse ANTES del módulo de contratos.

Evaluar:

- Gotenberg.

- LibreOffice.

8

- CloudConvert.

No asumir que funcionará en Railway.

## **Riesgo #2**

Numeración de Facturas.

La generación de consecutivos debe ser atómica.

No utilizar:

```
leer -> sumar -> guardar
```

Utilizar:

- Transacciones.

- Locks.

- Incrementos atómicos.

## **Riesgo #3**

Dependencia de Matías API.

Preparar:

- Retry.

- Circuit breaker.

- Logging.

- Sandbox.

## **Convenciones de Desarrollo**

## **Backend**

- Controllers delgados.

- Lógica en Services.

- DTOs para validación.

- Prisma únicamente desde Services.

9

## **Frontend**

Separación:

```
ui/
domain/
pages/
```

## **Código**

- TypeScript estricto.

- ESLint.

- Prettier.

- Conventional Commits.

## **Variables Snapshot**

Mantener.

Cada contrato debe guardar los datos utilizados durante su generación.

Motivo:

El empleado puede cambiar:

- Cargo.

- Salario.

- Dependencia.

El contrato histórico debe conservar los valores originales.

## **Qué Debe Hacer Codex**

Siempre:

1. Leer este documento.

2. Leer backlog.

3. Ejecutar una única tarea a la vez.

4. Cumplir criterios de aceptación.

5. No inventar funcionalidades.

6. No modificar arquitectura sin aprobación.

10

## **Orden de Ejecución**

La secuencia histórica por módulos queda reemplazada por la jerarquía de Goals:

```
Producto
└── Goal activo
    └── Milestones
        └── Epics end-to-end
            └── PRs de entrega
```

Antes de trabajar debe verificarse si la tarea acerca el proyecto al Goal activo. Las dependencias se comprueban contra arquitectura, dominio, documentación, código y migraciones.

## **Definición de Éxito Comercial Activa**

GOAL-01 se considera exitoso cuando:

- El primer cliente está incorporado y operando en producción.

- Sus usuarios administran la organización sin compartir credenciales.

- Puede registrar o importar empleados y preparar su información laboral.

- Puede completar contratación individual e inteligente desde la UI.

- Cada contrato produce su PDF canónico y llega al expediente correcto.

- El expediente admite la operación documental básica acordada con el piloto.

- Las alertas se generan automáticamente y conducen a acciones verificables.

- Deployment, migraciones, seguridad, backup, restauración, monitoreo y soporte están probados.

- Existe evidencia end-to-end y aceptación del cliente sobre el recorrido principal.

Facturación electrónica, nómina electrónica, suite financiera e IA no son criterios de cierre de GOAL-01.

11
