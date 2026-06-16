# TENANT_BRANDING_IMPLEMENTATION.md

## Objetivo

Implementar la identidad corporativa de cada empresa (tenant).

Preparar el sistema para que los documentos futuros puedan incluir:

- Logo empresarial
- Nombre del representante legal
- Firma digitalizada del representante legal

Esta fase NO debe generar PDFs.

Esta fase NO debe implementar expediente digital.

Esta fase NO debe implementar alertas.

## Arquitectura

Mantener:

- NestJS
- Prisma
- PostgreSQL
- Next.js App Router
- TanStack Query
- Multiempresa

## Base de datos

Extender Tenant.

Agregar:

logoUrl String? representanteLegal String? firmaRepresentanteUrl String?

## Backend

Crear módulo:

tenant-branding

Permitir:

GET /tenant-branding

PATCH /tenant-branding

## Frontend

Nueva sección:

Configuración → Identidad Corporativa

Campos:

- Razón social  
  • NIT
- Representante legal

Uploads:

- Logo
- Firma representante

## Storage

Preparar arquitectura compatible con:

\- Cloudflare R2

No implementar todavía migraciones complejas.

Puede utilizar almacenamiento temporal local si es necesario para esta fase.

## Variables documentales

Agregar nuevas variables globales:

{{LOGO\_EMPRESA}}

{{REPRESENTANTE\_LEGAL}}

{{FIRMA\_REPRESENTANTE}}

Estas variables deben quedar disponibles para:

- DocumentTemplate
- GeneratedDocument

## Vista previa

Permitir visualizar:

- Logo cargado
- Firma cargada
- Datos corporativos

## Seguridad

Mantener:

- tenantId desde JWT
- aislamiento multiempresa

## Calidad

Al finalizar:

- lint
- typecheck
- build

Corregir cualquier error.

## Entrega

Generar walkthrough completo.

Explicar cómo esta implementación prepara el sistema para:

GeneratedDocument ↓ PDF ↓ Expediente Digital ↓ Alertas
