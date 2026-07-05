# APP-SHELL.md — Especificación del App Shell v2

| Campo         | Valor                                                                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Documento** | Especificación de diseño implementable del contenedor maestro del producto (F1)                                                                  |
| **Fecha**     | 2026-07-03                                                                                                                                       |
| **Estado**    | Propuesto — pendiente de aprobación                                                                                                              |
| **Rige**      | `PLAN-MAESTRO-REDISENO.md` (rector) · `DESIGN-SYSTEM.md` (tokens y contratos, se citan sin repetir) · `PRODUCT-UX-AUDIT.md` (deuda, IDs citados) |
| **Ámbito**    | Estructura maestra: navegación, sidebar, header, layout, anatomía de página y patrones globales. **No** diseña ninguna pantalla ni módulo.       |
| **Sustituye** | El shell actual (`components/layout/app-shell.tsx`) — por evolución, conservando lo correcto (§11)                                               |

Convención: las decisiones se numeran `AS-Dn` y cada una lleva justificación. Los hechos del sistema actual se citan del código real. Nada de lo aquí especificado inventa funcionalidad: todo punto de navegación apunta a rutas existentes, y todo dato mostrado existe en la sesión o en las APIs actuales.

---

## 0. Hechos de partida (verificados en código)

Estos hechos delimitan lo que el shell puede y no puede hacer:

| #   | Hecho                                                                                                                                                                                                                                                                                                                               | Consecuencia de diseño                                                                                                                        |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| H1  | La sesión es **mono-empresa**: `AuthUser` = `{ id, email, nombre?, apellido?, rol, tenantId, tenantNombre? }` (`types/auth.ts`). El login es por NIT+email. No existe API de cambio de tenant en caliente.                                                                                                                          | "Selector de empresa" = **indicador de empresa activa**, no selector (AS-D8). Cambiar de empresa es cerrar sesión.                            |
| H2  | Roles en frontend: `ADMIN \| OPERADOR` (`types/auth.ts:1`). `VIEWER` existe solo en ADR-SEC-002, sin soporte en el tipo de sesión.                                                                                                                                                                                                  | El contrato de permisos (§8.10) se especifica para los 2 roles reales y queda **preparado** para VIEWER sin implementarlo.                    |
| H3  | No existe filtro global de sede: la sede es atributo por entidad (empleado, contrato), no contexto de sesión.                                                                                                                                                                                                                       | **No hay selector de sede en el header** (AS-D9). Ponerlo inventaría una funcionalidad.                                                       |
| H4  | No existe endpoint de búsqueda global.                                                                                                                                                                                                                                                                                              | **No hay búsqueda global en v2** (AS-D10). Se reserva el hueco.                                                                               |
| H5  | En viewports `<lg` (1024px) el sidebar actual es `hidden` **sin alternativa**: la app queda sin navegación (`app-shell.tsx:97`).                                                                                                                                                                                                    | El shell v2 debe incluir drawer móvil (§6.4). Es comportamiento de shell, no funcionalidad nueva.                                             |
| H6  | El header actual deriva título/descripción de página con ~10 ternarios hardcodeados **y** cada página pinta su propio `h1` (NAV-04).                                                                                                                                                                                                | El título sale del header para siempre: lo posee `PageHeader` (DESIGN-SYSTEM §6.6). El header pasa a mostrar **breadcrumbs** (AS-D7).         |
| H7  | Rutas existentes: `/dashboard`, `/perfil`, `/empleados(/[id](/expediente))`, `/sedes`, `/documentos/plantillas(/[id])`, `/documentos/generados(/[id])`, `/configuracion/identidad`, `/alertas`, `/nomina(/periodos(/[id]))`, `/facturacion(/clientes\|productos\|facturas(/[id]))`, `/contratos(/[id])`, `/contratos/lotes(/[id])`. | La navegación v2 apunta a estas rutas **sin renombrarlas** en esta fase.                                                                      |
| H8  | Módulos backend sin UI: contabilidad (C0–C3 operativa), y futuros por ADR: tesorería (P3), PILA (P4), nómina electrónica (P5).                                                                                                                                                                                                      | La estructura reserva su lugar (§2.4) pero **nada aparece en el nav hasta ser operativo** (AS-D5 — lección del señuelo "Expediente", NAV-02). |

---

## 1. Principios del shell

1. **El shell es infraestructura, no protagonista.** Enmarca sin competir: fondo `canvas`, contenido en `background`, el acento reservado al trabajo (regla del 10 %, DESIGN-SYSTEM §4.1).
2. **La estructura visible es la del dominio** (Plan Maestro, principio 1): la agrupación del nav refleja cómo el operador piensa su trabajo, que coincide con la arquitectura Tenant → Sede → Empleado → Contrato → Documento y los motores por período.
3. **Cero señuelos:** nada deshabilitado, nada "próximamente" en la navegación. Un ítem existe cuando su ruta opera.
4. **Un módulo nuevo no toca el shell** salvo para añadir su entrada en un árbol de navegación declarativo (§2.5). El shell no conoce páginas (elimina H6).
5. **Escala hacia los ADR:** la estructura debe absorber Contabilidad, Tesorería, PILA y Nómina Electrónica sin reorganizarse (§2.4).

---

## 2. Navegación principal — arquitectura de información

### 2.1 Árbol de navegación v2

Etiquetas en español (idioma del producto). Toda ruta existe hoy (H7).

```
TRABAJO                          ← sin etiqueta visible de grupo (primer bloque)
  Inicio                         /dashboard
  Alertas                        /alertas                    [indicador numérico §4.6]

PERSONAL                         ← grupo etiquetado
  Empleados                      /empleados
  Contratos                      /contratos
    └ Lotes                      /contratos/lotes            [subítem]

DOCUMENTOS
  Plantillas                     /documentos/plantillas
  Generados                      /documentos/generados

PROCESOS
  Nómina                         /nomina
    └ Períodos                   /nomina/periodos            [subítem]
  Facturación                    /facturacion
    └ Clientes                   /facturacion/clientes       [subítem]
    └ Productos                  /facturacion/productos      [subítem]
    └ Facturas                   /facturacion/facturas       [subítem]
  ▸ Contabilidad                 (reservado — entra cuando exista UI, según superficie F0)

ORGANIZACIÓN
  Sedes                          /sedes
  Identidad corporativa          /configuracion/identidad

─────────────────────────────── (footer del sidebar)
  [Tarjeta de usuario] → menú:   Perfil (/perfil) · Cerrar sesión
```

**Fuera del árbol:** Expediente (vive en el detalle del empleado, donde el dominio lo pone — se elimina el señuelo NAV-02); Perfil (baja al menú de usuario — PER-03).

### 2.2 Decisiones y justificación

| #     | Decisión                                                                                                                                                                                                                                                                                            | Justificación                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AS-D1 | **Cuatro grupos: Trabajo (implícito), Personal, Documentos, Procesos, Organización.**                                                                                                                                                                                                               | Es el modelo mental del operador validable en F0 (Plan Maestro §4.1): lo que hago hoy → a quién administro → con qué documentos → qué motores corren por período → cómo está configurada mi organización. Coincide con la jerarquía del dominio (principio 2). Cinco bloques quedan dentro del límite de escaneo (~7) incluso al crecer.                                                                        |
| AS-D2 | **Orden por frecuencia de uso descendente.** Inicio y Alertas primero (trabajo del día, el job central de preavisos — ALERT); Personal segundo (uso diario intensivo, EMP); Documentos tercero; Procesos cuarto (ritmo mensual: nómina/facturación); Organización último (configuración ocasional). | La frecuencia real documentada en el audit: empleados/contratos/alertas son diarios; nómina es mensual; sedes/identidad se tocan pocas veces al año. El coste de escaneo se paga donde menos se usa.                                                                                                                                                                                                            |
| AS-D3 | **Un solo nivel de subítems, con revelación por contexto** (§4.4). Lotes bajo Contratos; Períodos bajo Nómina; Clientes/Productos/Facturas bajo Facturación.                                                                                                                                        | Resuelve NAV-05 (subrutas hoy inalcanzables) y NAV-03/LOT-05 (Lotes como hermano oscurece que un lote _produce_ contratos). Un único patrón de profundidad — no tabs-en-página para unas secciones y sidebar para otras — mantiene una sola forma de moverse. Máximo un nivel: más profundidad en un sidebar destruye la escaneabilidad y ningún módulo actual o previsto (contabilidad incluida) necesita dos. |
| AS-D4 | **Perfil sale del nav principal** al menú de la tarjeta de usuario.                                                                                                                                                                                                                                 | PER-03: alta visibilidad, baja frecuencia y hoy solo-lectura. El nav principal es para operar; la identidad personal vive donde el usuario la espera (footer/avatar), patrón dominante en SaaS B2B.                                                                                                                                                                                                             |
| AS-D5 | **Nada reservado es visible.** Contabilidad, Tesorería, PILA, Nómina Electrónica no aparecen hasta operar.                                                                                                                                                                                          | Lección directa de NAV-02 (señuelo "Expediente") y principio 3. El roadmap se comunica en otro lugar, no en la navegación diaria.                                                                                                                                                                                                                                                                               |
| AS-D6 | **Las rutas no se renombran en esta fase.** El árbol apunta a las URL existentes aunque su forma ideal difiera (p. ej. `/configuracion/identidad`).                                                                                                                                                 | Evolucionar antes que reescribir; renombrar rutas es refactor de riesgo sin beneficio de experiencia inmediato. Si algún módulo lo justifica, se decidirá en su paso de F2 con redirects.                                                                                                                                                                                                                       |

### 2.3 Grupos y módulos futuros — mapeo a la lista objetivo

Correspondencia con los módulos que el shell debe servir (encargo): Employees → Personal/Empleados; Contracts → Personal/Contratos+Lotes; Documents → Documentos; Payroll → Procesos/Nómina; Accounting → Procesos/Contabilidad (reservado); Alerts → Trabajo/Alertas; Companies → H1: la "empresa" es la sesión (indicador en header §5) + Organización (sedes/identidad); Settings → Organización (y crecerá ahí: usuarios, parámetros).

### 2.4 Plan de absorción de módulos futuros (sin reorganizar)

| Módulo futuro                               | Dónde entra                                                     | Subítems previsibles (según ADR, se confirman en su fase) |
| ------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------- |
| Contabilidad (ADR-001, superficie según F0) | Procesos                                                        | Comprobantes, Libros/Reportes, Períodos y cierre          |
| Tesorería (P3)                              | Procesos                                                        | Dispersión, Obligaciones                                  |
| PILA (P4) / Nómina electrónica (P5)         | Procesos → subítems de Nómina o ítem propio (decisión en F3/F4) | —                                                         |
| Usuarios y roles (futuro RBAC)              | Organización                                                    | —                                                         |
| Expediente avanzado / subida manual         | No entra al nav: sigue dentro del empleado                      | —                                                         |

La regla de crecimiento: un módulo nuevo = un ítem (con subítems) dentro de un grupo existente. Crear un grupo nuevo exige actualizar este documento (§12).

### 2.5 Contrato técnico del árbol

La navegación es **datos, no JSX**: un árbol declarativo único (`nav-tree`) con `{ label, href, icon, group, children?, requiredRole?, badge? }` que alimenta sidebar, drawer móvil y breadcrumbs. Elimina H6 (los ternarios) y cumple el principio 4. `requiredRole` filtra ítems (§8.10); `badge` es el contrato del indicador de Alertas (§4.6).

---

## 3. Layout — estructura general

### 3.1 Geometría (desktop ≥1024px)

```
┌────────────┬──────────────────────────────────────────────┐
│            │  Header (topbar)                h-14 (3.5rem) │
│  Sidebar   ├──────────────────────────────────────────────┤
│  w-[17.5rem]│                                              │
│  (colapsado │  Contenido                                   │
│   w-16)    │  px-6 lg:px-8 · py-6                          │
│            │  ancho por arquetipo (DS §3.6):               │
│  fixed,    │  detail 3xl · standard 4xl · wide 6xl,        │
│  full-height│  centrado con mx-auto                        │
│            │                                              │
└────────────┴──────────────────────────────────────────────┘
```

- **Sidebar:** `fixed inset-y-0 left-0`, ancho expandido `17.5rem` (se conserva el actual), colapsado `4rem`. Fondo `bg-canvas`, borde derecho `border-border`. `z-[--z-shell]`.
- **Header:** sticky top, altura `3.5rem` (baja de las 4.75rem actuales: al perder el título de página —H6— ya no necesita dos líneas; una banda más delgada devuelve espacio vertical al trabajo). Fondo `bg-background/95 backdrop-blur`, borde inferior `border-border`. `z-[--z-sticky]`.
- **Contenido:** el offset izquierdo (`pl-[17.5rem]` / `pl-16`) transiciona con `--duration-base` + `--ease-out-ui` al colapsar. Área de scroll: solo el contenido (sidebar y header persistentes).

### 3.2 Áreas persistentes vs. variables

| Área      | Persistencia                                   | Contenido                                          |
| --------- | ---------------------------------------------- | -------------------------------------------------- |
| Sidebar   | Persistente (estado colapsado recordado, §4.3) | Marca, navegación, tarjeta de usuario              |
| Header    | Persistente                                    | Breadcrumbs, indicador de empresa, menú de usuario |
| Contenido | Variable                                       | Anatomía de página estándar (§7)                   |

### 3.3 Ritmo visual y densidad

- Espaciado vertical del contenido: secciones separadas por `space-y-6`; dentro de una sección, `space-y-4`. Escala Tailwind 4px, sin valores arbitrarios.
- Densidad por defecto: **cómoda** (la actual: filas de tabla ~py-3.5/py-4). La densidad **compacta** es una capacidad prevista del contrato de tabla (§8.1) que se decide al diseñar `DataTable` — el shell solo garantiza que el layout no la impide.
- Tipografía, radios, sombras: exclusivamente los roles y tokens de DESIGN-SYSTEM §3 (el shell no introduce valores propios).

---

## 4. Sidebar — especificación

### 4.1 Estructura (de arriba abajo)

1. **Zona de marca** (h-14, alineada con el header): brand-mark + "La Oficina Nítida". Sin subtítulo ("Mesa de operaciones" se elimina — NAV-06). En colapsado: solo el brand-mark, centrado.
2. **Navegación** (flex-1, scroll propio si desborda): grupos + ítems + subítems según §2.1.
3. **Tarjeta de usuario** (footer): avatar de iniciales (patrón `profile-avatar` reducido) + nombre + email truncados. Al activarla abre **menú de usuario** (mismo menú que el del header, §5.4): rol visible, Perfil, Cerrar sesión.

Se elimina del sidebar: el panel "Contexto seguro" (texto técnico — TR-09; la seguridad se demuestra, no se narra) y el botón suelto de cerrar sesión (pasa al menú).

### 4.2 Expandido — anatomía de ítems

- **Etiqueta de grupo:** rol `caption-2` en mayúsculas espaciadas (`uppercase tracking-wider text-muted-foreground/70`), `px-3`, margen superior `mt-6` (primer grupo sin etiqueta, §2.1). No interactiva.
- **Ítem:** h-9, `rounded-[--radius-control]`, icono `size-4` + etiqueta `text-sm`. Estados:
  - Reposo: `text-muted-foreground`.
  - Hover: `bg-muted text-foreground` (transición `--duration-fast`).
  - **Activo:** `bg-surface text-foreground` + realce `shadow-[inset_0_0_0_1px_var(--border)]` (se conserva el tratamiento actual, que es correcto y sobrio) + `aria-current="page"`.
  - Foco: contrato único de foco (DS §4.4).
- **Subítem:** h-8, indentado con guía vertical (`border-l border-border-soft` a la altura del icono del padre), `text-sm text-muted-foreground`; mismos estados. Sin icono propio (el icono pertenece al módulo).

### 4.3 Colapsado (nuevo comportamiento)

- Disparador: botón al final de la zona de navegación (icono panel-left, `aria-label` "Colapsar navegación"/"Expandir navegación"). Atajo de teclado: `[` (documentado en el tooltip).
- Ancho `4rem`; se muestran solo iconos de **ítems de primer nivel**, centrados; etiquetas de grupo se sustituyen por un separador (`border-t border-border-soft`).
- Cada icono muestra **tooltip** con la etiqueta (aparición `--duration-fast`, `role="tooltip"`).
- Los subítems no se pierden: activar un ítem con hijos navega a su ruta padre, y la **navegación secundaria del módulo se revela en el contenido** vía breadcrumbs + el propio módulo; al expandir el sidebar, el árbol restaura su estado.
- Persistencia: el estado colapsado/expandido se recuerda por dispositivo (`localStorage`), clave `shell:sidebar-collapsed`.
- El indicador numérico de Alertas (§4.6) se conserva en colapsado como punto/badge sobre el icono.

### 4.4 Revelación de subítems (navegación secundaria)

- Un ítem con hijos muestra chevron discreto. Los hijos se revelan cuando: (a) el ítem o uno de sus hijos está activo (**auto-expansión por ruta**), o (b) el usuario activa el chevron (estado manual recordado en sesión).
- El padre es navegable por sí mismo (su `href` propio): activar "Facturación" va a `/facturacion`; el chevron solo pliega/despliega.
- Animación de despliegue: altura con `--duration-base`; sin animación bajo `prefers-reduced-motion` (ya global).

### 4.5 Cálculo de ítem activo

Regla única (reemplaza la lógica ad hoc actual): un ítem está activo si `pathname` es exactamente su `href` o desciende de él (`href + '/'`), **salvo** que un descendiente más específico del árbol también coincida — en ese caso el activo es el más específico y sus ancestros muestran estado "abierto" (chevron desplegado), no "activo". Garantiza exactamente un `aria-current="page"` por vista.

### 4.6 Indicadores

- **Alertas:** badge numérico con el conteo de alertas abiertas (dato ya disponible en `GET /alerts` stats). Estilo: `caption-2` sobre `bg-muted` — **neutro por defecto**; adopta tinte `warning` solo si existe al menos una alerta `CRITICAL` abierta (taxonomía DS §7; calma operativa: el sidebar no grita).
- Ningún otro ítem lleva badge en v2. El contrato `badge` del árbol (§2.5) queda para módulos futuros con revisiones pendientes (p. ej. nómina EN_REVISION en F3), siempre con la misma sobriedad.

### 4.7 Estados del sidebar

- **Sesión cargando:** skeleton en tarjeta de usuario (se conserva el actual); la navegación se pinta de inmediato (no depende de la sesión).
- **Error de sesión:** la tarjeta muestra estado de error con acción de reintento/cerrar sesión; la navegación permanece utilizable.

---

## 5. Header — especificación

### 5.1 Propósito

Orientación (dónde estoy) y contexto (como quién y en qué empresa opero). **No** es dueño del título de página (H6): el título vive en `PageHeader` dentro del contenido. El header no acumula acciones de módulo — las acciones viven en el `PageHeader` de cada página.

### 5.2 Contenido (izquierda → derecha)

1. **Botón de menú** (solo `<lg`): abre el drawer móvil (§6.4).
2. **Breadcrumbs** (AS-D7): derivados del árbol de navegación + segmentos dinámicos.
   - Forma: `Grupo omitido → Módulo / Sección / Entidad`. Ej.: `Empleados / María Pérez / Expediente`; `Facturación / Facturas / FAC-0041`; `Nómina / Períodos / Octubre 2026`.
   - El último segmento no es enlace (`aria-current="page"`); los anteriores sí. Segmentos de entidad usan el nombre presentable ya cargado por la página (contrato: la página lo publica al shell vía el mecanismo del `PageHeader`; mientras carga, skeleton de 8ch).
   - En una ruta raíz de módulo, el breadcrumb es un solo segmento (ej. `Empleados`) — discreto, `text-sm text-muted-foreground`, último segmento `text-foreground`.
   - Justificación AS-D7: sustituye tres mecanismos divergentes de hoy (título duplicado H6, enlaces "Volver a X" artesanales, y flechas-atrás sueltas) por uno, y da a las rutas profundas (expediente, detalle de factura) el contexto que hoy no tienen.
3. **Espacio flexible** — hueco reservado para búsqueda global cuando exista backend (H4/AS-D10). En v2 queda vacío; no se pinta ningún control desactivado (principio 3).
4. **Indicador de empresa activa** (AS-D8): `Building2` + `tenantNombre` (`text-xs font-medium`), contenedor `bg-surface border-border rounded-[--radius-control]`. **No interactivo** (H1): sin chevron, sin affordance de menú — un chevron prometería un selector que no existe. Si `tenantNombre` es null: se muestra el NIT o nada, jamás un placeholder técnico ("Sesión segura" se elimina — NAV-06). En `<sm` se oculta (el usuario opera en una sola empresa; el dato está en el menú de usuario).
5. **Menú de usuario:** avatar de iniciales (h-8). Menú desplegable (§5.4).

Se eliminan del header: badge de rol permanente y badge "MVP Auth" (NAV-06/TR-09) — el rol vive en el menú de usuario y en Perfil.

### 5.3 Lo que el header NO tiene (decisiones explícitas)

| #      | Exclusión                     | Justificación                                                                                                                                                           |
| ------ | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AS-D8  | Sin **selector** de empresa   | H1: la sesión es mono-tenant; un selector inventaría funcionalidad. El indicador comunica el aislamiento (principio de PRODUCT.md) sin prometer cambio en caliente.     |
| AS-D9  | Sin selector de sede          | H3: no existe contexto global de sede. La sede se filtra donde el dominio la tiene (listas de empleados/contratos).                                                     |
| AS-D10 | Sin búsqueda global           | H4: no hay endpoint. Se reserva la posición central; se especificará cuando exista el servicio.                                                                         |
| AS-D11 | Sin campana de notificaciones | No existe sistema de notificaciones; las alertas de dominio tienen su módulo e indicador en el nav (§4.6). Duplicarlas en el header crearía dos bandejas para lo mismo. |

### 5.4 Menú de usuario (único, compartido por header y tarjeta del sidebar)

Contenido: nombre completo + email (encabezado no interactivo) · rol como badge de la taxonomía (`neutral`) · separador · **Perfil** (`/perfil`) · **Cerrar sesión** (con su estado `loading`). Contrato de menú: navegación por flechas, `Esc` cierra, foco retorna al disparador (contrato de diálogo DS §6.5 aplicado a popover).

---

## 6. Responsive

### 6.1 Breakpoints de shell

| Rango          | Sidebar                                | Header                                                  | Contenido |
| -------------- | -------------------------------------- | ------------------------------------------------------- | --------- |
| `≥lg` (1024px) | Fijo, expandido o colapsado (§4.3)     | Completo                                                | `px-8`    |
| `md–lg`        | **Drawer** (§6.4), cerrado por defecto | Botón menú + breadcrumbs + indicador empresa + avatar   | `px-6`    |
| `<md`          | Drawer                                 | Botón menú + breadcrumb (solo último segmento) + avatar | `px-4`    |

### 6.2 Prioridad de supervivencia en anchos menores

1º navegación (drawer), 2º avatar/menú de usuario, 3º breadcrumb final, 4º indicador de empresa (se repliega al menú), 5º breadcrumbs completos.

### 6.3 El contenido no es responsabilidad del shell

Las páginas gestionan su propio responsive dentro del arquetipo de ancho. El shell garantiza: nunca scroll horizontal causado por el marco, y `min-w-0` en las áreas flexibles (los truncados ya presentes se conservan).

### 6.4 Drawer móvil (corrige H5)

- Panel izquierdo `w-[17.5rem]` sobre backdrop `bg-[--overlay]`, `z-[--z-overlay]`; mismo contenido que el sidebar expandido (marca + navegación + tarjeta de usuario).
- Cumple íntegro el **contrato de diálogo** (DS §6.5): focus trap, `Esc`, retorno de foco al botón de menú, `aria-label="Navegación principal"`.
- Se cierra al navegar (selección de ítem) y al tocar el backdrop. Animación: `translate-x` con `--duration-base` + `--ease-out-ui`.

---

## 7. Anatomía de página estándar (zona variable)

Toda página del producto se compone, en este orden, de bloques opcionales pero **siempre en este orden**:

```
1. PageHeader        título (page-title) + descripción (caption) + acciones primarias/secundarias
                     — única fuente del h1 (DS §6.6); publica el nombre de entidad a breadcrumbs (§5.2)
2. Zona de resumen   stats/tarjetas del módulo (opcional)
3. FilterBar         búsqueda + filtros + acciones de colección (opcional)
4. Contenido         DataTable | lista | detalle | formulario
5. Pagination        cuando el contenido es colección paginada
```

Reglas:

- **Una** acción primaria (`Button` default) por página, en el PageHeader; el resto son `outline`/`ghost` (regla del 10 %).
- Máximo un `display` (hero) por pantalla y solo en las páginas que ya lo usan legítimamente (dashboard, perfil, auth).
- Las páginas de detalle abren con breadcrumbs como vía de retorno — quedan prohibidos los enlaces artesanales "Volver a X" (AS-D7).
- El arquetipo de ancho (detail/standard/wide) se declara en el PageHeader y aplica a toda la página; prohibido mezclar anchos por sección.

---

## 8. Patrones globales — contratos de comportamiento

El shell fija el **comportamiento**; el diseño de cada componente viene después (roster DS §6.6). Cada contrato cita su deuda.

### 8.1 Tablas y colecciones (TR-06, EMP-01/04)

- Toda colección usa `DataTable` (o lista estandarizada para colecciones no tabulares) dentro de la anatomía §7.
- La fila entera es **navegable** cuando existe detalle (resuelve EMP-04: hoy el detalle de empleado es inalcanzable desde su lista); las acciones de fila viven en una celda de acciones al final.
- Acciones de fila **nunca solo-hover** (EXP-03): visibles también con `focus-within` y en punteros gruesos (contrato DS §6.4).
- Columnas de estado: exclusivamente `StatusBadge` (taxonomía DS §7).
- Orden y densidad son capacidades del componente, no de la página.

### 8.2 Formularios (CON-03, FAC-03)

- Alta/edición de entidad: en `SideSheet` (patrón dominante actual, se canoniza). Los formularios inline expandibles (facturas, períodos de nómina) migran a este patrón en su paso F2.
- Todo campo va en `FormField` (label asociada, error con `aria-describedby`, ayuda). Selects: componente `Select` del sistema, no `<select>` con clases artesanales (TR-03).
- Envío: botón primario con estado `loading`; error de servidor como `Alert` inline en el formulario; éxito cierra y notifica por toast (§8.6).
- Doble vía de cierre (Cancelar + X + `Esc`) sin perder datos sin aviso: si hay cambios, confirmación nivel 1.

### 8.3 Filtros y búsqueda de colección

- `FilterBar` bajo el PageHeader: búsqueda a la izquierda, filtros enumerados después, acciones de colección a la derecha (patrón actual de plantillas, canonizado).
- Los filtros reflejan **estado del dominio** con las etiquetas de la taxonomía (nunca enums crudos — ALERT-04).
- El estado de filtros vive en la URL (querystring) para que navegación y recarga lo conserven — comportamiento de shell, verificable.

### 8.4 Acciones

- Jerarquía única: primaria (1/página) · secundaria (`outline`) · terciaria (`ghost`) · destructiva (`destructive`, solo en contexto de confirmación §8.5).
- Los botones dicen el verbo real (DS §8). Acciones que disparan mutaciones muestran `loading` y quedan deshabilitadas durante el vuelo (contrato DS §6.3).

### 8.5 Confirmaciones (TR-04)

- `window.confirm` queda prohibido en todo el shell y sus páginas. Aplican los dos niveles del DS §6.5: destructivo recuperable → ConfirmDialog nivel 1; irreversible de dominio (cerrar período; futuros: aprobar liquidación, contabilizar) → nivel 2 con explicación del efecto y de la vía de corrección del dominio.

### 8.6 Feedback (TR-05)

- Contrato DS §6.5: éxito → toast; error de formulario → `Alert` inline; error fuera de formulario → toast asertivo. Nunca silencio. Los toasts se montan en el shell (una sola región `aria-live` global, esquina inferior derecha, `z-[--z-overlay]`).

### 8.7 Estados vacíos

- `EmptyState` estándar: icono + qué significa + **qué hacer** (acción si el usuario puede crearla desde ahí). Prohibido el vacío mudo ("No hay X.") y el vacío con jerga. El primer uso de un módulo es parte de la curva de aprendizaje (PRODUCT.md).

### 8.8 Estados de carga

- Skeletons que **imitan la anatomía §7** de la página (header + zona de resumen + colección), no bloques genéricos únicos. Sin spinners de página completa; los spinners quedan para acciones (§8.4).

### 8.9 Estados de error

- Error de carga de página: bloque estándar en la zona de contenido con mensaje en lenguaje de usuario + acción de reintento. El shell (nav + header) permanece operativo — el error nunca deja al usuario sin salida.
- Error 404/sin acceso de entidad: mensaje neutro ("no existe o no tienes acceso" — patrón actual correcto, se conserva) + breadcrumb como retorno.

### 8.10 Permisos (TR-12, preparación sin invención)

- El árbol de navegación acepta `requiredRole`; los ítems no permitidos **no se renderizan** (no se deshabilitan — principio 3). Con los roles reales (H2): v2 arranca con todo visible para ADMIN y OPERADOR salvo que un módulo declare lo contrario en su paso F2; la infraestructura queda lista para VIEWER.
- Acciones: regla general **ocultar** lo no permitido; **deshabilitar con motivo** (tooltip) solo cuando ver-sin-poder comunica algo útil (p. ej. flujos de aprobación futuros donde "no eres el aprobador" es información). La decisión por acción pertenece a cada módulo en F2/F3.

### 8.11 Auditoría visible (principio 3 del Plan Maestro)

- Contrato progresivo, sin inventar endpoints: toda página de **detalle** reserva una zona estándar de metadatos al pie (creado el / actualizado el — datos ya presentes en las entidades). Cuando el dominio expone actor y transición (nómina P1-U3, contabilidad I9), esa misma zona los muestra con el patrón "quién · cuándo · qué" definido aquí de una vez.
- Los ConfirmDialog de nivel 2 declaran que la acción queda auditada — solo donde el backend efectivamente audita (AuditLog existente).

---

## 9. Accesibilidad del shell

- **Skip link** "Saltar al contenido" como primer elemento enfocable (hoy inexistente), visible al foco.
- Landmarks: `aside > nav[aria-label="Navegación principal"]`, `header[role=banner]`, `main` con `id` destino del skip link, breadcrumbs en `nav[aria-label="Ruta de navegación"]`.
- Exactamente un `aria-current="page"` (§4.5). Foco: contrato único DS §4.4 en todo elemento interactivo del shell.
- Drawer y menús cumplen el contrato de diálogo/popover (§6.4, §5.4).
- Objetivo AA verificado en: contraste de ítems reposo/activo sobre `canvas`, indicador de alertas, breadcrumbs.
- Teclado completo: tab-order = orden visual; `[` colapsa sidebar; sin atajos adicionales en v2 (se definirán con demanda real).

---

## 10. Estados globales del shell

| Estado                   | Comportamiento                                                                                            |
| ------------------------ | --------------------------------------------------------------------------------------------------------- |
| Sesión cargando          | Shell completo visible de inmediato (nav estática); skeletons solo en datos de sesión (usuario, empresa). |
| Sesión inválida/expirada | Redirección a login (comportamiento actual del guard, se conserva); sin pantallas intermedias del shell.  |
| Error de red recuperable | El contenido muestra §8.9; el shell nunca se desmonta.                                                    |
| Ruta inexistente         | Página 404 estándar dentro del shell (breadcrumb: Inicio).                                                |

---

## 11. Migración desde el shell actual (evolucionar, no reescribir)

**Se conserva:** geometría base del sidebar (17.5rem, `bg-canvas`, borde), tratamiento del ítem activo (inset ring — §4.2), brand-mark, skeletons de sesión, `lg` como breakpoint principal, guard de sesión.

**Se adapta:** header 4.75rem→3.5rem y pierde título/descripción (→PageHeader) y badges (→menú usuario); nav plana → árbol declarativo con grupos y subítems; tarjeta de usuario + logout → tarjeta con menú; título por ternarios → breadcrumbs desde el árbol.

**Se añade:** colapsado con persistencia, drawer móvil (H5), breadcrumbs, indicador de alertas, skip link, región global de toasts, árbol `nav-tree` declarativo.

**Se elimina:** ítem señuelo "Expediente" (NAV-02), panel "Contexto seguro", badges "MVP Auth"/rol permanente, subtítulo "Mesa de operaciones", fallback "Sesión segura" (NAV-06, TR-09).

**Compatibilidad:** las páginas actuales siguen funcionando dentro del shell v2 sin modificarse (sus `h1` duplicados conviven con los breadcrumbs hasta que cada una adopte `PageHeader` en su paso F2 — la doble titulación muere módulo a módulo, no en big-bang).

---

## 12. Reglas de evolución del shell

1. Añadir un módulo = añadir su entrada al `nav-tree` (§2.5) dentro de un grupo existente. No toca componentes del shell.
2. Crear un grupo nuevo, mover un módulo de grupo o añadir un tercer nivel: requiere actualizar este documento con justificación (misma disciplina que DS §10).
3. Añadir contenido al header: prohibido salvo materializar los huecos ya reservados (búsqueda global H4) o decisión registrada aquí.
4. Los badges del nav siguen §4.6 (sobriedad); ningún módulo introduce su propio estilo de indicador.

---

## 13. Criterios de aceptación (verificables)

1. Navegación renderizada desde `nav-tree` declarativo; cero ternarios de título en el shell.
2. Todas las rutas de H7 alcanzables desde sidebar/drawer (incl. `nomina/periodos`, `facturacion/*` — NAV-05 cerrado); cero ítems deshabilitados (NAV-02 cerrado).
3. Un solo `h1` por vista una vez la página adopta PageHeader; breadcrumbs correctos en rutas profundas (empleado/expediente, factura, período).
4. `<lg`: drawer operativo con contrato de diálogo completo (H5 cerrado).
5. Colapsado persistente con tooltips; `[` funciona.
6. Skip link, landmarks y `aria-current` únicos verificados; contraste AA de los estados del nav.
7. Indicador de alertas refleja el conteo real y solo tiñe con CRITICAL.
8. Cero violaciones del lint DS §5 en el código del shell; `typecheck` y `build` verdes.
9. Las páginas existentes funcionan sin modificación dentro del shell v2.

---

_Fin de APP-SHELL.md. Pendiente de aprobación antes de continuar con el Dashboard._
