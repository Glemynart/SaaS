## **START_HERE.md**

## **SaaS de Gestión Administrativa para Operadores Educativos y Contratistas**

## **Estado del Proyecto**

Este documento es la fuente de verdad del proyecto.

Antes de escribir código, modificar arquitectura o agregar funcionalidades, cualquier desarrollador o IA debe leer este documento completo.

## **Visión del Producto**

Desarrollar una plataforma SaaS multiempresa enfocada en pequeñas empresas, contratistas y operadores educativos que permita gestionar:

- Contratos masivos.

- Contratos individuales.

- Expediente digital de empleados.

- Alertas de vencimiento contractual.

- Facturación electrónica.

- Nómina electrónica (fase futura).

La plataforma NO busca reemplazar sistemas contables como Siigo, World Office o Helisa.

La contabilidad seguirá realizándose en dichas plataformas mediante exportaciones e integraciones futuras.

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

- Sistema contable.

- Sistema financiero.

- Software de tesorería.

- Sistema bancario.

2

La contabilidad permanece en:

- Siigo.

- World Office.

- Helisa.

- Alegra.

- Otros sistemas contables.

## **MVP Aprobado**

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

## **Módulo 8**

Facturación Electrónica.

Incluye:

- Clientes.

- Productos.

- Facturas.

- Notas crédito.

- Notas débito.

- PDF.

- XML.

- Integración Matías API.

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

Seguir estrictamente:

```
E1 Infraestructura
↓
E2 Auth + Multiempresa
↓
E3 Empleados
↓
E4 Contratos
↓
E5 Expediente
↓
E6 Alertas
↓
E7 Facturación
↓
E7b Dashboard
```

No alterar dependencias.

## **Definición de Éxito del MVP**

El MVP se considera exitoso cuando:

- Una empresa puede registrar empleados.

- Puede importar empleados desde Excel.

- Puede generar contratos individuales.

- Puede generar contratos masivos.

- Puede almacenar expedientes.

- Puede recibir alertas de vencimiento.

- Puede emitir facturas electrónicas reales mediante Matías API.

- Puede operar sin utilizar Excel para los procesos principales.

En ese momento se inicia la fase comercial formal y la incorporación de los primeros clientes de pago.

11
