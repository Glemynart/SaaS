## **CONTRACT_TEMPLATES_IMPLEME NTATION.md**

# **Implementación Completa — Motor Documental (Fase 1: Plantillas)**

## **Objetivo**

Implementar la primera fase del Motor Documental de la plataforma.

Esta fase NO debe generar PDFs.

Esta fase NO debe implementar firma electrónica.

Esta fase NO debe implementar expediente digital.

Esta fase NO debe implementar alertas.

El objetivo es construir la base documental sobre la cual se soportarán posteriormente:

- Contratos laborales

- Otrosíes

- Certificaciones laborales

- Cartas

- Memorandos

- Documentos internos

- Expediente digital

- Alertas documentales

## **Lectura obligatoria**

Antes de comenzar:

- START_HERE.md

- PRD.md

- ARCHITECTURE_COMPLETO.md

- BACKLOG_COMPLETO.md

- CODEX_GUIDE.md

- PRODUCT.md

- DESIGN.md

## **Arquitectura obligatoria**

Respetar completamente:

- NestJS

- Prisma

- PostgreSQL

- Next.js App Router

- TanStack Query

- Turborepo

- Multiempresa

- JWT

- Guards existentes

- Roles existentes

## **Multiempresa**

Todas las operaciones deben estar aisladas por tenant.

Obligatorio:

- tenantId obtenido únicamente desde JWT.

- tenantId nunca enviado por frontend.

- tenantId nunca recibido desde body.

- tenantId nunca recibido desde query.

- tenantId nunca recibido desde params.

## **Diseño de dominio**

NO crear ContractTemplate.

Crear una entidad genérica y reutilizable.

## **Prisma**

Crear:

```
enum DocumentTemplateType {
  CONTRACT
  CERTIFICATION
  LETTER
  MEMO
}
model DocumentTemplate {
  id          String   @id @default(uuid())
  tenantId    String
  nombre      String
  descripcion String?
  tipo        DocumentTemplateType
  contenido   String
  activo      Boolean @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  tenant Tenant @relation(fields: [tenantId], references: [id])
  @@index([tenantId])
}
```

## **Preparación para futuras fases**

NO implementar todavía:

- GeneratedDocument

- PDF

- Versiones

- Expediente

- Alertas

Pero documentar claramente en comentarios y arquitectura cómo esta entidad servirá de base para:

```
DocumentTemplate
        ↓
GeneratedDocument
        ↓
PDF
        ↓
EmployeeFile
        ↓
```

```
Alerts
```

## **Backend**

Crear módulo:

```
apps/api/src/document-templates
```

Estructura:

```
document-templates/
├── document-templates.module.ts
├── document-templates.controller.ts
├── document-templates.service.ts
├── dto/
│   ├── create-document-template.dto.ts
│   └── update-document-template.dto.ts
```

## **Endpoints**

Implementar:

```
GET    /document-templates
GET    /document-templates/:id
POST   /document-templates
PATCH  /document-templates/:id
DELETE /document-templates/:id
```

Delete debe ser lógico (soft delete).

## **Variables dinámicas**

Las plantillas deben soportar placeholders.

Ejemplos:

```
{{NOMBRE_COMPLETO}}
{{DOCUMENTO}}
{{CARGO}}
{{SALARIO}}
{{TIPO_CONTRATO}}
{{FECHA_INGRESO}}
{{EMPRESA}}
```

```
{{NIT}}
```

En esta fase:

- almacenar variables

- mostrar variables

- insertar variables

NO reemplazarlas todavía.

## **Frontend**

Crear módulo:

```
apps/web/src/features/document-templates
```

## **Página principal**

Ruta:

```
/documentos/plantillas
```

Mostrar:

- nombre

- tipo

- descripción

- estado

- fecha creación

- acciones

## **Crear plantilla**

Implementar Drawer lateral.

Campos:

- Nombre

- Descripción

- Tipo

- Contenido

## **Tipos de documento**

Selector:

- Contrato

- Certificación

- Carta

- Memorando

## **Editor documental**

No usar un editor complejo.

Utilizar textarea profesional.

Debe permitir:

- escribir libremente

- insertar variables

- mantener formato básico

## **Panel de variables**

Mostrar lateralmente:

```
{{NOMBRE_COMPLETO}}
{{DOCUMENTO}}
{{CARGO}}
{{SALARIO}}
{{TIPO_CONTRATO}}
{{FECHA_INGRESO}}
{{EMPRESA}}
{{NIT}}
```

Al hacer clic:

insertar automáticamente en el cursor.

## **Vista previa**

Crear:

```
/documentos/plantillas/[id]
```

Mostrar:

- nombre

- descripción

- tipo

- contenido

La vista debe sentirse como un documento real.

## **UX**

## Utilizar activamente:

- frontend-design

- interface-design

- impeccable

- emil-design-eng

- interaction-design

Respetar:

- PRODUCT.md

- DESIGN.md

Mantener identidad:

"La Oficina Nítida"

## **Experiencia visual**

Este módulo debe sentirse diferente al CRUD de empleados.

Inspiración:

- editor documental

- gestor documental

- sistema administrativo moderno

Evitar:

- tablas genéricas

- apariencia CRUD básica

- diseño ERP antiguo

## **Seguridad**

Mantener:

- tenantId desde JWT

- guards existentes

- roles existentes

- aislamiento multiempresa

## **Calidad**

Al finalizar ejecutar:

```
pnpm lint
pnpm typecheck
pnpm build
```

Corregir cualquier error encontrado.

## **Entrega**

Generar un walkthrough completo que incluya:

- estructura creada

- entidades Prisma

- endpoints

- DTOs

- frontend

- rutas

- validaciones

- arquitectura multiempresa

- preparación para futuras fases

Explicar claramente cómo esta implementación permitirá posteriormente:

1. Generar contratos desde empleados.

2. Generar PDFs.

3. Crear expedientes digitales.

4. Crear alertas documentales.

5. Mantener historial documental.
