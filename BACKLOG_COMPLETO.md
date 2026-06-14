# BACKLOG.md

# Epic E1 - Infraestructura

## Objetivo

Dejar lista la base técnica del proyecto.

### Feature F1.1 - Monorepo

- T1.1.1 Crear repositorio
- T1.1.2 Configurar pnpm workspaces
- T1.1.3 Configurar Turborepo
- T1.1.4 Crear apps/web
- T1.1.5 Crear apps/api
- T1.1.6 Crear packages/types

### Feature F1.2 - Base de datos

- T1.2.1 Configurar PostgreSQL
- T1.2.2 Configurar Prisma
- T1.2.3 Generar schema.prisma
- T1.2.4 Ejecutar migraciones

### Feature F1.3 - Infraestructura Cloud

- T1.3.1 Railway
- T1.3.2 Redis
- T1.3.3 Cloudflare R2
- T1.3.4 Resend

### Feature F1.4 - Calidad

- ESLint
- Prettier
- Husky
- Conventional Commits

---

# Epic E2 - Auth y Multiempresa

### F2.1 Autenticación

- Login
- Logout
- Refresh Token
- Recuperar contraseña
- Rate limiting

### F2.2 Multiempresa

- Tenant
- TenantSettings
- Tenant middleware
- Tenant guards

### F2.3 Roles

- ADMIN
- OPERATOR

---

# Epic E3 - Empleados

### F3.1 CRUD

- Crear empleado
- Editar empleado
- Eliminar empleado
- Listar empleados

### F3.2 Excel

- Descargar plantilla
- Importar Excel
- Validaciones
- Reporte de errores

### F3.3 Búsquedas

- Filtros
- Paginación
- Ordenamiento

---

# Epic E4 - Contratos

### F4.1 Plantillas

- Upload DOCX
- Variables dinámicas
- Vista previa

### F4.2 Contratos Individuales

- Generar DOCX
- Generar PDF
- Historial

### F4.3 Contratos Masivos

- Lotes
- BullMQ
- Estado del proceso
- Descarga ZIP

### F4.4 Conversión PDF

- Evaluar Gotenberg
- Evaluar LibreOffice
- Prueba de carga

---

# Epic E5 - Expediente Digital

### F5.1 Documentos

- Upload
- Descarga
- Clasificación
- Versionado básico

### F5.2 Seguridad

- Validación MIME
- Validación Magic Number
- Límites de tamaño

---

# Epic E6 - Alertas

### F6.1 Contratos

- Alertas 30 días
- Alertas 15 días
- Alertas 7 días

### F6.2 Dashboard

- Contratos próximos a vencer

---

# Epic E7 - Facturación Electrónica

### F7.1 Clientes

- CRUD clientes

### F7.2 Productos

- CRUD productos

### F7.3 Facturas

- Crear factura
- PDF
- XML
- Historial

### F7.4 Notas

- Nota crédito
- Nota débito

### F7.5 Matías API

- Sandbox
- Producción
- Retry
- Circuit breaker
- Logging

---

# Epic E8 - Auditoría

### F8.1 AuditLog

- Login
- Creación
- Edición
- Eliminación
- Facturación
- Contratos

---

# MVP FINAL

Debe permitir:

- Multiempresa
- Usuarios
- Empleados
- Contratos individuales
- Contratos masivos
- Expediente digital
- Alertas
- Facturación electrónica
