# **Implementación Completa del Frontend de Autenticación (apps/web)**

## **Antes de escribir cualquier línea de código**

Lee completamente:

- START_HERE.md

- PRD.md

- ARCHITECTURE_COMPLETO.md

- BACKLOG_COMPLETO.md

- CODEX_GUIDE.md

Lee también:

- PRODUCT.md

- DESIGN.md

Lee la implementación existente del backend:

- Auth Module

- Users Module

- Tenants Module

- JWT Authentication

- Refresh Tokens

- Guards

- Multi-tenancy

## **Uso Obligatorio de Skills**

Durante toda la implementación utiliza activamente:

- frontend-design

- interface-design

- impeccable

- emil-design-eng

- web-design-guidelines

- interaction-design

- taste-skill

Respeta las decisiones definidas en:

- PRODUCT.md

- DESIGN.md

La identidad visual oficial del proyecto es:

1

## **"La Oficina Nítida"**

No redefinir el sistema visual.

Construir sobre él.

## **Objetivo**

Implementar completamente el frontend de autenticación en `apps/web` .

No generar únicamente documentación.

No generar únicamente propuestas.

Implementar directamente.

El resultado debe quedar listo para conectarse con el backend actual.

## **Stack Obligatorio**

- Next.js App Router

- TypeScript estricto

- Tailwind CSS

- Shadcn/UI

- React Hook Form

- Zod

- TanStack Query

## **Módulos a Implementar**

## **Autenticación**

Implementar:

- Login

- Registro de Empresa + Administrador

- Logout

- Perfil autenticado

- Renovación automática de sesión

Consumir:

- POST /auth/register

- POST /auth/login

2

- POST /auth/refresh

- POST /auth/logout

- GET /auth/me

## **Gestión de Sesión**

Implementar:

- Refresh Token mediante cookies HTTP-only.

- No utilizar localStorage para Refresh Tokens.

- Access Token de corta duración.

- Renovación automática de sesión.

- Manejo de expiración.

- Manejo de errores.

- Logout seguro.

## **Arquitectura Frontend**

Diseñar e implementar una estructura preparada para crecer.

Separar claramente:

- UI

- Features

- Hooks

- Services

- API Clients

- Validation Schemas

- Shared Components

Mantener una arquitectura escalable y preparada para futuros módulos.

## **Layout Público**

Implementar:

- Login

- Registro

Diseño:

- Limpio

- Profesional

- Minimalista

- Responsive

3

## **Layout Autenticado**

Implementar:

- Sidebar

- Header

- Área principal de contenido

Preparado para futuros módulos:

- Empleados

- Contratos

- Expediente Digital

- Alertas

- Facturación

- Nómina

## **Middleware**

Implementar:

- Protección de rutas privadas.

- Redirección de usuarios no autenticados.

- Redirección de usuarios autenticados fuera de Login y Registro.

- Manejo de roles ADMIN y OPERADOR.

## **Dashboard Inicial**

Implementar dashboard autenticado básico.

Mostrar:

- Nombre del usuario.

- Nombre de la empresa.

- Rol.

- Estado de sesión.

No implementar todavía módulos de negocio.

## **Calidad UX**

Aplicar activamente las skills instaladas para conseguir una interfaz SaaS premium.

4

## Priorizar:

- Excelente jerarquía visual.

- Espaciado consistente.

- Tipografía cuidada.

- Estados de carga.

- Skeleton loaders.

- Empty states.

- Error states.

- Feedback visual elegante.

- Microinteracciones sutiles.

- Accesibilidad.

- Responsive design.

Inspiración:

- Linear • Stripe • Vercel

Evitar:

- ERP tradicionales. • Interfaces recargadas. • Apariencia genérica generada por IA.

## **Calidad Técnica**

Mantener:

- ESLint • Prettier • TypeScript estricto

No introducir:

- Warnings

- Errores de lint

- Errores de typecheck

## **Restricciones**

NO implementar todavía:

- Empleados

- Contratos

- Expediente Digital

5

- Alertas

- Facturación Electrónica

- Nómina Electrónica

El objetivo es únicamente completar la experiencia de autenticación y sesión.

## **Entregables**

Al finalizar:

1. Mostrar la estructura creada.

2. Explicar el flujo completo de autenticación frontend.

3. Explicar la estrategia de sesión.

4. Explicar el middleware y la protección de rutas.

5. Explicar la integración con el backend.

6. Mostrar las decisiones visuales tomadas basadas en PRODUCT.md y DESIGN.md.

7. Confirmar que el frontend puede autenticarse contra el backend actual.

Implementa directamente.

No te detengas en una fase de planificación.

Si necesitas tomar decisiones razonables para completar la implementación, tómalas y continúa.

6
