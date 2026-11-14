# ADR-SEC-002 — Security Architecture

| Campo             | Valor                                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------ |
| **Estado**        | Aceptado                                                                                                     |
| **Fecha**         | 2026-07-02                                                                                                   |
| **Decisores**     | Arquitectura · Seguridad                                                                                     |
| **Ámbito**        | SaaS multiempresa "La Oficina Nítida" — `apps/api` (NestJS · Prisma · PostgreSQL)                            |
| **Subordinado a** | ADR-SEC-001 (documento rector). Este ADR es el inventario de implementación subordinado; ver ADR-SEC-001 §22 |
| **Reemplaza**     | —                                                                                                            |
| **Relacionado**   | ADR-SEC-001 (documento rector), ADR-001 (motor contable), C3 (cierre), N2A–N2D (nómina)                      |

---

## 1. Contexto

La plataforma opera como SaaS multiempresa con datos financieros, de nómina y personales (empleados, terceros). El modelo de amenazas es el de una aplicación web multi-tenant expuesta a internet con usuarios autenticados de distintos roles y tenants.

Actualmente existen mecanismos de seguridad implementados de forma orgánica durante el desarrollo, pero **no existe un documento arquitectónico que los unifique, establezca principios rectores y trace la hoja de ruta de hardening**. Este ADR llena ese vacío y se mantiene como referencia del estado implementado frente al rector ADR-SEC-001.

El inventario de seguridad actual incluye:

- **Autenticación:** JWT (HS256, 15 min) + refresh tokens rotativos con detección de reuso.
- **Autorización:** RBAC plano de 3 roles (`ADMIN`, `OPERADOR`, `VIEWER`).
- **Aislamiento multi-tenant:** filtros `tenantId` en consultas de aplicación; `TenantPrismaService` instala el tenant en la transacción. Las migraciones activan y fuerzan RLS en una cohorte de 19 tablas, no en todo el esquema.
- **Validación de entrada:** `ValidationPipe` global con `whitelist` + `forbidNonWhitelisted`.
- **Rate limiting:** Solo en endpoints de auth (`@nestjs/throttler`); el límite
  global permanece deliberadamente sin activar hasta resolver sus prerrequisitos
  operativos.
- **Headers HTTP:** Helmet está aplicado en el bootstrap del API con una política
  CSP explícita y headers de transporte/anti-sniffing.
- **RLS:** `ENABLE` y `FORCE` con políticas tenant-scoped están definidos para
  `empleados`, afiliaciones de seguridad social, historial de prima, centros,
  asignaciones y ubicaciones PILA, exportaciones PILA, recaudos y sus
  asignaciones/reversiones, y el agregado, numeración e intentos de facturación
  electrónica. El inventario exacto de las 19 tablas se mantiene en §6.1.
  Contratos y documentos de expediente no están en esa cohorte; sus rutas
  dependen de filtros en la aplicación. Esto describe migraciones del repositorio,
  no un estado operativo de una base desplegada.
- **Auditoría:** `AuditLog` central con `AuditService` global (fire-and-forget).
- **CORS:** Configurable por variable de entorno.

**Restricción rectora:** la seguridad debe ser proporcional al modelo de negocio (operador educativo colombiano, ~docenas de tenants, cientos de usuarios). No se persigue certificación ISO 27001 ni SOC 2 en esta fase. Toda complejidad debe justificarse contra una amenaza concreta al negocio.

---

## 2. Decisión

### 2.1 Principios no negociables

1. **Defensa en profundidad.** La seguridad no depende de un solo mecanismo. Cada capa (red, aplicación, base de datos) aporta controles independientes.
2. **Aislamiento de tenant por diseño.** Toda consulta a base de datos incluye `tenantId`. El no hacerlo es un defecto bloqueante.
3. **Menor privilegio.** Un usuario autenticado solo accede a los recursos de su tenant y solo a los endpoints autorizados por su rol.
4. **Auditabilidad.** Todo evento de seguridad relevante (login, logout, CRUD sensible, cierre contable, cambios de configuración) queda registrado en `AuditLog`.
5. **Secretos fuera del código.** Las credenciales y claves se obtienen del entorno (`process.env`) y se validan al iniciar la aplicación.
6. **Falla cerrado (fail-closed).** Ante un error de seguridad (token inválido, tenant inactivo, rol insuficiente), el acceso se deniega.
7. **Proporcionalidad.** No se implementan controles que excedan el perfil de riesgo actual del negocio. Cada control nuevo responde a una amenaza concreta.

### 2.2 Modelo de confianza

```
┌──────────────────────────────────────────────────────────┐
│  Internet (no confiable)                                   │
│    │                                                       │
│    ▼                                                       │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Capa de transporte (CORS, Helmet)                     │ │
│  │  │                                                    │ │
│  │  ▼                                                    │ │
│  │ ┌──────────────────────────────────────────────────┐ │ │
│  │ │ Capa de autenticación (JwtAuthGuard)              │ │ │
│  │ │  │                                                │ │ │
│  │ │  ▼                                                │ │ │
│  │ │ ┌──────────────────────────────────────────────┐ │ │ │
│  │ │ │ Capa de tenant (ActiveTenantGuard)            │ │ │ │
│  │ │ │  │                                            │ │ │ │
│  │ │ │  ▼                                            │ │ │ │
│  │ │ │ ┌──────────────────────────────────────────┐ │ │ │ │
│  │ │ │ │ Capa de autorización (RolesGuard)         │ │ │ │ │
│  │ │ │ │  │                                        │ │ │ │ │
│  │ │ │ │  ▼                                        │ │ │ │ │
│  │ │ │ │ ┌──────────────────────────────────────┐ │ │ │ │ │
│  │ │ │ │ │ Validación de entrada (ValidationPipe)│ │ │ │ │ │
│  │ │ │ │ │  │                                    │ │ │ │ │ │
│  │ │ │ │ │  ▼                                    │ │ │ │ │ │
│  │ │ │ │ │ ┌──────────────────────────────────┐ │ │ │ │ │ │
│  │ │ │ │ │ │ Lógica de negocio + tenantId      │ │ │ │ │ │ │
│  │ │ │ │ │ │  │                                │ │ │ │ │ │ │
│  │ │ │ │ │ │  ▼                                │ │ │ │ │ │ │
│  │ │ │ │ │ │ ┌──────────────────────────────┐ │ │ │ │ │ │ │
│  │ │ │ │ │ │ │ PostgreSQL (RLS parcial)      │ │ │ │ │ │ │ │
│  │ │ │ │ │ │ │ Auditoría (AuditLog)          │ │ │ │ │ │ │ │
│  │ │ │ │ │ │ └──────────────────────────────┘ │ │ │ │ │ │ │
│  │ │ │ │ │ └──────────────────────────────────┘ │ │ │ │ │ │
│  │ │ │ │ └──────────────────────────────────────┘ │ │ │ │ │
│  │ │ │ └──────────────────────────────────────────┘ │ │ │ │
│  │ │ └──────────────────────────────────────────────┘ │ │ │
│  │ └──────────────────────────────────────────────────┘ │ │
│  └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### 2.3 Sesgo arquitectónico

- **Stateless siempre que sea posible.** El access token JWT es stateless; no se consulta la base de datos en cada request para autorización básica.
- **Application-layer y DB-layer para tenant isolation.** La disciplina de `tenantId` en cada `WHERE` se conserva en todo el esquema. RLS protege hoy 19 tablas mediante migraciones independientes; la expansión al resto requiere migraciones y pruebas por cohorte. Las políticas usan `app.current_tenant_id`, instalado por `TenantPrismaService` dentro de la transacción.
- **Rate limiting progresivo.** Auth tiene throttling estricto; los endpoints de datos se protegen con throttling global moderado en una fase posterior.

---

## 3. Qué pertenece y qué NO pertenece a SEC

### 3.1 Pertenece a la arquitectura de seguridad

| Capacidad                          | Estado actual       | Prioridad |
| ---------------------------------- | ------------------- | --------- |
| Autenticación JWT + refresh tokens | Implementado        | —         |
| RBAC de 3 roles                    | Implementado        | —         |
| Aislamiento multi-tenant           | Implementado (app)  | —         |
| Validación de entrada (DTOs)       | Implementado        | —         |
| Rate limiting en auth              | Implementado        | —         |
| Auditoría centralizada             | Implementado        | —         |
| CORS configurable                  | Implementado        | —         |
| Security headers (Helmet)          | Implementado        | —         |
| Rate limiting global               | Pendiente           | Alta      |
| RLS en PostgreSQL                  | Parcial (19 tablas) | Media     |
| Tests de guards de seguridad       | Pendiente           | Alta      |
| Rotación de refresh tokens         | Implementado        | —         |
| Detección de reuso de tokens       | Implementado        | —         |

### 3.2 NO pertenece a SEC (se difiere o vive en otro ámbito)

| Excluido                             | Destino      | Motivo                                                         |
| ------------------------------------ | ------------ | -------------------------------------------------------------- |
| mTLS entre servicios                 | Diferido     | Monolito; no hay comunicación inter-servicio hoy.              |
| API Keys para integraciones externas | Diferido     | No hay integraciones machine-to-machine hoy.                   |
| WAF / CDN security                   | Infra/DevOps | Responsabilidad de la capa de despliegue, no de la aplicación. |
| Escaneo de dependencias (SCA)        | CI/CD        | Pertenece al pipeline, no a la arquitectura de aplicación.     |
| SAST / DAST                          | CI/CD        | Ídem.                                                          |
| Certificación ISO 27001 / SOC 2      | Compliance   | Fuera del alcance actual del producto.                         |
| Encriptación de datos en reposo      | Infra        | Responsabilidad del motor de base de datos / disco.            |
| Firewall de base de datos            | Infra        | Responsabilidad del entorno de despliegue.                     |
| Gestión centralizada de secretos     | Diferido     | `.env` es suficiente para la escala actual.                    |

---

## 4. Autenticación

### 4.1 Flujo de tokens

```
POST /auth/login ──► { accessToken, refreshToken }
                          │
                          ▼
              ┌──────────────────────┐
              │ Access Token (JWT)    │
              │ payload: { sub,       │
              │   tenantId, rol,      │
              │   email }             │
              │ TTL: 15 min           │
              │ Almacenamiento:       │
              │   memoria del cliente │
              └──────────────────────┘
                          │
              ┌──────────────────────┐
              │ Refresh Token         │
              │ formato: {id}:{uuid}  │
              │ storage: DB (hash) +  │
              │   cliente (raw)       │
              │ TTL: 7 días           │
              │ Rotación: por uso     │
              │ Revocación: por reuso │
              └──────────────────────┘
```

### 4.2 Decisiones de diseño

- **HS256** como algoritmo de firma. La aplicación es un monolito; no hay necesidad de RS256 (clave pública/privada) para verificadores distribuidos. Si se migra a microservicios, se reevalúa.
- **Refresh token rotation** en cada uso: se emite un nuevo par `{id, secret}`, se hashea y almacena, y se invalida el anterior. Esto limita la ventana de un refresh token robado a una sola oportunidad de uso.
- **Detección de reuso (anti-theft):** si se presenta un refresh token ya revocado, se revocan **todos** los refresh tokens del usuario. Esto indica que un atacante tiene un token viejo y está intentando usarlo.
- **Logout:** revoca el refresh token específico. El access token sigue vivo hasta su expiración natural (15 min). No se implementa blacklist de access tokens por complejidad operativa.

### 4.3 Registro

- `tenantNit` + `email` + `passwordPlain` → crea `Tenant` + `User` (ADMIN) en una transacción atómica.
- `tenantNit` como parte de la superficie de credenciales: el tenant es parte de "quién eres", no un filtro posterior.

---

## 5. Autorización (RBAC)

### 5.1 Modelo de roles

| Rol        | Alcance típico                                                                                                                            |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `ADMIN`    | Acceso total: CRUD completo, aprovisionamiento contable, facturación, nómina, baja de empleados, branding, cierre contable.               |
| `OPERADOR` | Operativo: gestión de contratos, empleados, documentos, ejecución de nómina. Sin acceso a configuración del sistema ni aprovisionamiento. |
| `VIEWER`   | Solo lectura. Definido en schema pero **no aplicado** en ningún controller. Su activación está diferida.                                  |

### 5.2 Mecanismo

- **Decorador `@Roles(...)`** sobre controladores y métodos.
- **`RolesGuard`** lee los metadatos, compara con `user.rol` del JWT.
- Si un endpoint **no** tiene `@Roles`, es accesible por cualquier rol autenticado.
- El rol se obtiene del JWT (no se consulta la BD en cada request), coherente con la TTL corta del access token (15 min).

### 5.3 Limitaciones conocidas

- No hay jerarquía de roles (ADMIN no hereda OPERADOR).
- No hay permisos granulares (ej. "puede aprobar nómina pero no crear empleados").
- `VIEWER` no está implementado en ningún guard.
- No hay diferenciación entre "crear" y "aprobar" a nivel de rol.

---

## 6. Aislamiento Multi-Tenant

### 6.1 Estrategia actual: disciplina de aplicación

- **Toda entidad** tiene `tenantId` como primer índice compuesto.
- **Todo servicio** recibe `tenantId` del `@CurrentUser()` (extraído del JWT) y lo incluye explícitamente en cada `WHERE`.
- **`ActiveTenantGuard`** verifica que el tenant existe y está activo antes de ejecutar el handler.
- No existe `$use` middleware global de Prisma. `TenantPrismaService` instala
  `app.current_tenant_id` con alcance local a la transacción. Las migraciones
  activan y fuerzan RLS en estas 19 tablas: `afiliaciones_seguridad_social`,
  `customer_receipt_reversals`, `customer_receipts`, `empleados`,
  `facturas_electronicas`, `intentos_facturas_electronicas`,
  `invoice_receipt_allocations`, `lineas_facturas_electronicas`,
  `perfiles_emisor_electronicos`, `pila_asignaciones_centro_trabajo`,
  `pila_centros_trabajo`, `pila_exports`, `pila_ubicaciones_laborales`,
  `rangos_numeracion_electronica`, `resultados_intentos_facturas_electronicas`,
  `service_premium_batches`, `service_premium_lines`,
  `transiciones_facturas_electronicas` y `transmisiones_facturas_electronicas`.
- La suite `employees.rls.postgres.spec.ts` comprueba la lista de tablas con
  `ENABLE` y `FORCE` y ejercita varios dominios con un rol `NOBYPASSRLS`;
  pruebas separadas cubren el dominio y el historial de intentos de facturación
  electrónica. No se ha acreditado una prueba operativa sobre la base desplegada.
- El resto del esquema, incluidos contratos, `generated_documents`,
  `expediente_doc_families` y `expediente_docs`, continúa dependiendo del filtro
  de tenant en la aplicación.

### 6.2 Riesgo aceptado

Un bug de omisión de `tenantId` en una tabla sin RLS puede exponer datos entre tenants. La mitigación actual combina **disciplina de código + revisión en PR + tests de aislamiento** con políticas RLS en las 19 tablas listadas en §6.1. Para esas políticas, la protección depende de que la consulta use el contexto instalado por la ruta de aplicación: `app.current_tenant_id` es un parámetro PostgreSQL personalizado aceptado por nombre de dos partes y no constituye por sí solo una identidad de tenant confiable frente a una sesión SQL con credenciales. RLS reduce omisiones de filtro en la ruta normal; no protege contra credenciales SQL comprometidas ni cubre las tablas sin política. Ver [opciones de configuración personalizadas de PostgreSQL](https://www.postgresql.org/docs/current/runtime-config-custom.html). La expansión y la revisión de la fuente confiable del tenant requieren unidades independientes.

### 6.3 Soft delete

Los modelos con datos potencialmente referenciados (`Empleado`, `CuentaContable`, `Tercero`, `CentroCosto`, `ClienteFE`, `DocumentTemplate`) usan `deletedAt` en lugar de `DELETE` físico. Los modelos inmutables (`ComprobanteContable`, `MovimientoContable`) no tienen soft delete.

---

## 7. Auditoría

### 7.1 Modelo

| Campo        | Tipo   | Descripción                                              |
| ------------ | ------ | -------------------------------------------------------- |
| `tenantId`   | UUID   | Tenant al que pertenece el evento                        |
| `userId`     | UUID   | Usuario que ejecutó la acción                            |
| `action`     | String | Verbo descriptivo (`LOGIN`, `COMPROBANTE_ANULADO`, etc.) |
| `entityType` | String | Tipo de entidad afectada                                 |
| `entityId`   | UUID?  | ID de la entidad afectada                                |
| `metadata`   | JSON?  | Datos adicionales específicos del evento                 |

### 7.2 Eventos auditados

| Dominio      | Eventos                                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Auth         | `LOGIN`, `PASSWORD_RESET_REQUESTED`, `PASSWORD_RESET_COMPLETED`                                                                 |
| Contratos    | `CONTRATO_CREATE`, generación de documentos                                                                                     |
| Empleados    | CRUD completo                                                                                                                   |
| Nómina       | `LIQUIDACION_CREATE`, `LIQUIDACION_APPROVE`, `LIQUIDACION_PAY`, `LIQUIDACION_VOID`                                              |
| Contabilidad | `COMPROBANTE_CONTABILIZADO`, `COMPROBANTE_ANULADO`, `COMPROBANTE_REVERSO`, `PERIODO_CONTABLE_CERRADO`, `ACCOUNTING_PROVISIONED` |
| Email        | Envíos de correo                                                                                                                |

### 7.3 Propiedades

- **Fire-and-forget:** toda llamada a `AuditService.log()` usa `.catch(() => {})`. Un fallo de auditoría **nunca** interrumpe la operación de negocio.
- **Inmutable:** no hay endpoint de modificación ni eliminación de registros de auditoría.
- **No hay retención automática:** los logs no se purgan automáticamente. Una política de retención se definirá cuando el volumen lo exija.

---

## 8. Validación de Entrada

### 8.1 Pipeline global

```typescript
// main.ts
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true, // Elimina propiedades no declaradas en el DTO
    forbidNonWhitelisted: true, // Rechaza requests con propiedades no declaradas
    transform: true, // Convierte tipos automáticamente (string → number, etc.)
  }),
);
```

### 8.2 DTOs

- Todos los endpoints de mutación usan DTOs con decoradores `class-validator`.
- `@IsEmail()`, `@IsNotEmpty()`, `@MinLength()`, `@MaxLength()`, `@IsEnum()`, `@IsOptional()`, etc.
- La validación de tipos se apoya en TypeScript + `class-transformer`.

### 8.3 Protección contra mass assignment

`whitelist: true` + `forbidNonWhitelisted: true` garantizan que solo las propiedades declaradas en el DTO se aceptan. Cualquier propiedad extra (ej. `{...body, rol: 'ADMIN'}`) es rechazada.

---

## 9. Fases de hardening

Cada fase es independiente, mergeable y desplegable por sí misma. El orden refleja prioridad de riesgo, no dependencia técnica.

### Fase completada — SEC-02 Authorization (Deny by Default)

**Estado:** ✅ Completada (2026-07-14)  
**Rama:** `initiative/security-hardening-v1`

**Alcance implementado:**

- Clasificación completa de la superficie HTTP de `apps/api`.
- Migración de toda la superficie a políticas explícitas.
- Precondición objetiva de activación mediante `assertEligible()`.
- Enforcement runtime de `Deny by Default`.

**Resultado validado:**

- 125 operaciones HTTP clasificadas.
- 0 operaciones `LEGACY_INFERRED`.
- 0 operaciones ambiguas.
- 0 operaciones sin política.
- Una operación sin política válida queda denegada.
- `RBAC`, `AUTHENTICATED` y `UNAUTHENTICATED` conservan su comportamiento previo.

### Fase parcialmente completada — Security headers + Rate limiting global

**Estado:** Helmet completado; rate limiting global pendiente por prerrequisitos
operativos.

**Alcance:**

- Helmet está instalado y configurado con HSTS, X-Frame-Options,
  X-Content-Type-Options y CSP explícita en `apps/api/src/security/security-headers.ts`.
- Extender `ThrottlerGuard` como guard global con límite moderado por defecto (ej. 100 req/min por IP).
- Mantener los límites estrictos existentes en auth.

**Validación:** headers de seguridad presentes en todas las respuestas; la
activación del rate limiting global queda pendiente hasta verificar sus
prerrequisitos operativos.

### Fase parcialmente completada — Tests de seguridad

**Estado:** Parcialmente completada.

**Alcance implementado:**

- Existen pruebas unitarias para `JwtAuthGuard`, `ActiveTenantGuard` y
  `RolesGuard`; en esta rama se completan casos límite de contexto de tenant y
  ausencia de metadatos de rol.
- `TercerosService` tiene pruebas unitarias a nivel de servicio para el
  aislamiento en lectura, creación, actualización, borrado lógico y detección de
  documentos duplicados. Un ID de otro tenant no devuelve sus datos ni ejecuta
  escrituras.
- `PeriodosContablesService` tiene pruebas unitarias que verifican el aislamiento
  en consulta, unicidad de creación, consulta por ID y generación anual
  idempotente; los períodos generados siempre conservan el tenant autenticado.

**Pendiente:**

- Incorporar pruebas de aislamiento en los demás servicios multi-tenant que no
  las tengan.
- Añadir validación de entrada para los DTOs críticos aún no cubiertos.
- Revisar y cerrar las brechas restantes de cobertura de ramas por guard.

**Validación:** las tres suites de guards alcanzan 100% de sentencias y líneas
en conjunto y 90,62% de ramas; `ActiveTenantGuard` aún tiene una rama
instrumentada pendiente. Las pruebas de servicio comprueban que las consultas
incluyan `tenantId` y que las escrituras no ocurran si el registro queda fuera
del tenant activo.

### Fase siguiente — Row-Level Security (RLS)

**Estado:** Parcialmente implementada; la cobertura sigue siendo incompleta.

**Alcance:**

- Completar la expansión progresiva de RLS a tablas multi-tenant adicionales mediante migraciones y pruebas independientes; hoy hay políticas en las 19 tablas enumeradas en §6.1.
- Revisar por separado una fuente de identidad de tenant confiable frente a SQL arbitrario con el rol de aplicación; el parámetro `app.current_tenant_id` actual no cubre ese escenario.
- Mantener el `tenantId` en las consultas de aplicación (doble capa).

**Validación:** para cada cohorte protegida, una consulta dentro de una
transacción tenant-scoped del tenant A no debe leer ni mutar filas del tenant B
aunque omita `tenantId` en el `WHERE`. Esta prueba de omisión no acredita que el
GUC sea confiable frente a una sesión SQL que pueda establecerlo.

### Fase siguiente — Granularidad de permisos

**Estado:** Diferida

**Alcance:**

- Activar rol `VIEWER` en controladores.
- Evaluar si se necesita un modelo de permisos más granular (ej. `CAN_APPROVE_PAYROLL`, `CAN_CREATE_EMPLOYEE`).
- Si se justifica: implementar decorador `@Permissions()` con bitmask o string-based permissions.

**Validación:** VIEWER funcional; decisión documentada sobre permisos granulares.

---

## 10. Riesgos

### 10.1 Riesgos actuales (aceptados)

| #   | Riesgo                                                                | Impacto | Mitigación actual                                                                                | Plan                                                               |
| --- | --------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| R1  | Omisión de `tenantId` en una consulta → fuga de datos entre tenants.  | Alto    | Disciplina de código, revisión en PR, tests de aislamiento.                                      | Fase 3: RLS como defensa en profundidad.                           |
| R2  | Rate limiting global aún no activado en endpoints de datos.           | Medio   | Límites estrictos en auth y caracterización operativa documentada.                               | Activar sólo con prerrequisitos de infraestructura verificados.    |
| R4  | Access token no revocable → ventana de 15 min tras logout/compromiso. | Bajo    | TTL corta (15 min).                                                                              | Aceptado. Blacklist añadiría estado global a un sistema stateless. |
| R5  | Secretos en `.env` en texto plano.                                    | Medio   | `.env` en `.gitignore`. Acceso al servidor restringido.                                          | Aceptado para la escala actual.                                    |
| R6  | `VIEWER` definido pero no implementado.                               | Bajo    | No hay usuarios VIEWER hoy.                                                                      | Fase 4 si hay demanda.                                             |
| R7  | Auditoría fire-and-forget sin dead-letter.                            | Bajo    | `.catch(() => {})` en todo `audit.log`. Los logs de auditoría no son críticos para la operación. | Aceptado.                                                          |
| R8  | Sin tests dedicados de guards de seguridad.                           | Medio   | Los guards son simples y se prueban indirectamente vía tests de controller.                      | Fase 2: tests unitarios dedicados.                                 |

### 10.2 Riesgos de arquitectura

| #   | Riesgo                                                                       | Impacto | Mitigación                                                                                  |
| --- | ---------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------- |
| RA1 | Scope creep de seguridad: perseguir certificaciones antes de tener producto. | Alto    | Principio de proporcionalidad (§2.1.7). Cada control nuevo se justifica contra una amenaza. |
| RA2 | Expandir RLS y romper queries existentes.                                    | Medio   | Cada expansión requiere migración y tests exhaustivos sobre la cohorte afectada.            |
| RA3 | Activar throttling global sin conocer la cadena de proxies.                  | Bajo    | Caracterización operativa y activación diferida hasta contar con evidencia.                 |

---

## 11. Resumen de invariantes de seguridad

| #      | Invariante                                                                                               | Punto de aplicación          |
| ------ | -------------------------------------------------------------------------------------------------------- | ---------------------------- |
| SEC-I1 | Toda consulta a base de datos desde un contexto de request incluye `tenantId` del token, nunca del body. | Todos los servicios          |
| SEC-I2 | Ningún endpoint de mutación acepta `tenantId` o `rol` desde el body del request.                         | DTOs + `ValidationPipe`      |
| SEC-I3 | Un token JWT expirado o mal firmado es rechazado antes de ejecutar cualquier lógica de negocio.          | `JwtAuthGuard`               |
| SEC-I4 | Un tenant inactivo no puede servir requests autenticadas.                                                | `ActiveTenantGuard`          |
| SEC-I5 | Toda transición de estado sensible (login, cierre contable, aprobación de nómina) queda en `AuditLog`.   | `AuditService.log()`         |
| SEC-I6 | Los secretos (JWT_SECRET, DATABASE_URL, API keys) nunca se escriben en código fuente.                    | `ConfigService` + `.env`     |
| SEC-I7 | Un refresh token reusado invalida todos los tokens del usuario (anti-theft).                             | `AuthService.refreshToken()` |
| SEC-I8 | Las contraseñas nunca se almacenan en texto plano; usan bcrypt con cost factor ≥ 10.                     | `AuthService` + `User`       |

---

_FIN del ADR-SEC-002._
