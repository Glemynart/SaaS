# ARCHITECTURE.md

# Arquitectura General

## Objetivo

Construir una plataforma SaaS multiempresa para:

- Contratos masivos
- Contratos individuales
- Expediente digital
- Alertas
- Facturación electrónica

La plataforma no desarrollará un ERP contable ni sustituirá Siigo, World Office u otros sistemas; la contabilidad operativa continuará en ellos.
El núcleo contable interno definido por ADR-001 se limita a infraestructura de causación. PR18 solo conecta una factura electrónica `ACEPTADA` a ese núcleo y no amplía el MVP de facturación.

---

# Stack Tecnológico

## Frontend

- Next.js 15
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- TanStack Query
- React Hook Form
- Zod

## Backend

- NestJS
- Prisma
- PostgreSQL

## Infraestructura

- Railway
- Redis
- BullMQ
- Cloudflare R2
- Resend

---

# Arquitectura de Carpetas

## Frontend

apps/web

- app/
- components/ui
- components/domain
- lib
- hooks
- services
- types

## Backend

apps/api

- auth
- tenants
- users
- employees
- contracts
- files
- alerts
- invoices
- customers
- products
- audit

---

# Multiempresa

Todas las tablas poseen:

tenantId

Reglas:

- tenantId proviene del JWT
- Nunca desde body
- Nunca desde query params

---

# Seguridad

## JWT

- Access Token: 15 minutos
- Refresh Token: 7 días

## Rate Limiting

Obligatorio:

- Login
- Registro
- Refresh

## Uploads

Validar:

- MIME real
- Magic Number
- Tamaño máximo

---

# Procesamiento Asíncrono

BullMQ

Usos:

- Contratos masivos
- Conversión PDF
- Correos
- Alertas

---

# Almacenamiento

Cloudflare R2

Tipos:

- Contratos
- Expedientes
- Facturas
- XML

---

# Riesgos Técnicos

## DOCX → PDF

Resolver antes del módulo de contratos.

Evaluar:

- Gotenberg
- LibreOffice
- CloudConvert

## Facturación

Implementar numeración atómica.

## Matías API

Implementar:

- Retry
- Circuit Breaker
- Logging

---

# Frontend

Desarrollo paralelo al backend.

Semana 1:

- Login
- Layout
- Sidebar
- Dashboard

Semana 2:

- Usuarios
- Perfil

Semana 3:

- Empleados

Semana 4:

- Contratos

Semana 5:

- Expediente

Semana 6:

- Facturación

---

# Funcionalidades Fuera del MVP

- Nómina electrónica completa
- Firma electrónica
- Portal empleados
- Portal clientes
- Integraciones bancarias
- IA documental

---

# Definición de Éxito

La plataforma debe permitir:

- Crear empleados
- Importar empleados desde Excel
- Generar contratos individuales
- Generar contratos masivos
- Gestionar expedientes
- Mostrar alertas
- Emitir facturas reales mediante Matías API
