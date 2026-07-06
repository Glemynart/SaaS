# DESIGN-SYSTEM.md — Sistema de Diseño de La Oficina Nítida

| Campo          | Valor                                                                                                                            |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Documento**  | Especificación de ingeniería del sistema de diseño (entregable F1)                                                               |
| **Fecha**      | 2026-07-03                                                                                                                       |
| **Estado**     | Propuesto — pendiente de aprobación                                                                                              |
| **Rige**       | `PLAN-MAESTRO-REDISENO.md` (rector) · `PRODUCT-UX-AUDIT.md` (inventario de deuda, IDs citados)                                   |
| **Relación**   | Completa y hace implementable a `DESIGN.md` (north star). Donde difieran, **este documento es el canónico** para implementación. |
| **Ámbito**     | `apps/web` — tokens, primitivas, contratos y gobernanza. **No** diseña componentes individuales ni pantallas.                    |
| **Naturaleza** | Evolutiva: gobierna y completa el sistema existente. **No es un sistema nuevo.**                                                 |

---

## 0. Filosofía

**Evolucionar antes que reescribir** — la misma regla que gobierna la arquitectura del backend (ADR-002 D13) gobierna este sistema.

1. **El sistema ya existe.** Hay una paleta oklch coherente, primitivas con contratos correctos (Button, Input, Alert) y una dirección visual escrita (`DESIGN.md`). El trabajo es **gobernar, completar y hacer cumplir**, no reemplazar.
2. **Los valores visuales actuales se conservan por defecto.** Ningún color, radio o tipografía existente cambia de valor en F1 salvo decisión explícita registrada en §9. Re-vestir viene después (F2), con este sistema como vara.
3. **Todo es verificable.** Cada regla de este documento es o (a) un token en código, o (b) un contrato de componente comprobable, o (c) una regla de lint ejecutable. Lo que no se puede verificar no es una regla, es una opinión — y no va aquí.
4. **Un solo camino para cada necesidad.** Si el sistema resuelve un caso, usar el sistema es obligatorio. Un patrón nuevo solo nace cuando ningún patrón existente resuelve el caso, y nace **dentro** del sistema (§10).
5. **El sistema sirve al dominio.** Estados, severidades e inmutabilidad del dominio (ADR-001/ADR-002) tienen representación canónica única (§7). La UI nunca inventa semántica.

---

## 1. Inventario del sistema actual y veredicto

Auditoría del código real (`globals.css`, `components/ui/*`, `lib/utils.ts`). Cada elemento recibe veredicto: **CONSERVAR** (no tocar), **COMPLETAR** (falta algo), **CORREGIR** (defecto), **GOBERNAR** (existe pero sin regla).

### 1.1 Stack de estilos (CONSERVAR)

| Elemento                                            | Estado                                | Veredicto                                                                          |
| --------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------- |
| Tailwind CSS 4 (CSS-first, `@theme inline`)         | Operativo                             | CONSERVAR — los tokens viven en `globals.css`, no hay `tailwind.config` de colores |
| `class-variance-authority` (cva)                    | Usado en Button                       | CONSERVAR — es el mecanismo oficial de variantes (§6.2)                            |
| `cn()` = `clsx` + `tailwind-merge` (`lib/utils.ts`) | Operativo                             | CONSERVAR — única forma aprobada de componer clases                                |
| `lucide-react`                                      | Único set de iconos                   | CONSERVAR — no introducir otro set                                                 |
| Geist Sans / Geist Mono                             | Fuentes cargadas vía `--font-geist-*` | CONSERVAR — resuelve la tipografía "a definir" de DESIGN.md                        |
| `font-variant-numeric: tabular-nums` en `body`      | Global                                | CONSERVAR — correcto para un producto de tablas y dinero                           |
| `prefers-reduced-motion` global                     | Implementado                          | CONSERVAR                                                                          |

### 1.2 Tokens de color existentes (CONSERVAR + COMPLETAR)

Paleta neutra fría (matiz oklch 248) + primario azul profundo. **Los 17 valores actuales no se modifican.**

| Token                                        | Valor actual                     | Rol                                | Veredicto                                   |
| -------------------------------------------- | -------------------------------- | ---------------------------------- | ------------------------------------------- |
| `--background`                               | `oklch(0.982 0.006 248)`         | Fondo de página                    | CONSERVAR                                   |
| `--canvas`                                   | `oklch(0.955 0.008 248)`         | Fondo del sidebar / zonas hundidas | CONSERVAR                                   |
| `--surface`                                  | `oklch(0.998 0 0)`               | Superficie de tarjetas/paneles     | CONSERVAR                                   |
| `--surface-raised`                           | `oklch(0.99 0.003 248)`          | Superficie elevada                 | CONSERVAR (subutilizado — GOBERNAR en §4.2) |
| `--foreground`                               | `oklch(0.19 0.02 248)`           | Texto principal                    | CONSERVAR                                   |
| `--muted` / `--muted-foreground`             | `0.936/0.42`                     | Fondos suaves / texto secundario   | CONSERVAR                                   |
| `--border` / `--border-soft`                 | `0.852/0.902`                    | Bordes estructural / divisor       | CONSERVAR                                   |
| `--input` / `--control`                      | `0.805/0.972`                    | Borde y fondo de controles         | CONSERVAR                                   |
| `--ring`                                     | `oklch(0.39 0.08 246)`           | Anillo de foco                     | CONSERVAR — es el foco oficial (§4.4)       |
| `--primary` / `--primary-foreground`         | `oklch(0.27 0.065 246)` / blanco | **El acento corporativo**          | CONSERVAR — ver D-01                        |
| `--destructive` / `--destructive-foreground` | `oklch(0.54 0.18 26)` / blanco   | Peligro                            | CONSERVAR                                   |
| `--success`                                  | `oklch(0.48 0.1 155)`            | Éxito                              | CONSERVAR                                   |
| `--ease-out-ui`                              | `cubic-bezier(0.23,1,0.32,1)`    | Easing                             | CONSERVAR                                   |

**Faltantes** (COMPLETAR, §3): `--warning`, `--info`, tokens de radio, duración, sombra, z-index, tipografía de roles, overlay.

### 1.3 Primitivas existentes (`components/ui/`)

| Primitiva   | Estado                                                                                                                                         | Veredicto                                                                                                                                                                   |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`    | cva, 4 variantes, 4 tamaños, `focus-visible:ring-2 ring-ring ring-offset-2`, `active:scale-[0.98]`, `disabled`                                 | **CONSERVAR — es el patrón de referencia.** Su contrato de foco es el canónico del sistema                                                                                  |
| `Input`     | `border-input bg-control`, foco `border-ring + ring-ring/20`, disabled                                                                         | CONSERVAR                                                                                                                                                                   |
| `Label`     | Tipografía correcta                                                                                                                            | COMPLETAR — no exige asociación `htmlFor` (contrato en §6.4)                                                                                                                |
| `Alert`     | 3 variantes tokenizadas, `role=alert/status`, patrón `/8 /25` de superficies derivadas                                                         | CONSERVAR — su patrón de derivación por opacidad se canoniza en §3.2                                                                                                        |
| `Badge`     | **Sin variantes**; recibe colores por `className`                                                                                              | **CORREGIR** — es el vector principal de las 225 evasiones (TR-01): cada página le inyecta `bg-emerald-50 text-emerald-700…`. Debe ganar variantes semánticas (roster §6.6) |
| `Skeleton`  | Correcto                                                                                                                                       | CONSERVAR                                                                                                                                                                   |
| `SideSheet` | `role=dialog` + `aria-modal`, pero **sin focus trap, sin Esc, sin `aria-labelledby`, sin retorno de foco**; backdrop `bg-black/20` hardcodeado | **CORREGIR** — debe cumplir el contrato de diálogo (§6.5) sin cambiar su API pública (`open/onOpenChange/title/description`)                                                |

### 1.4 CSS de composición en `globals.css` (GOBERNAR)

~40 clases-receta específicas de página (`auth-*`, `brand-mark`, `folio-*`, `dashboard-hero`, `session-*`, `info-panel`, `module-*`, `profile-*`) + `landing-*` + `tiptap`/`document-preview`.

- Usan tokens correctamente (bien) y contienen dos **recetas visuales valiosas** que se canonizan: el realce interior `inset 0 1px 0 rgb(255 255 255/0.7x)` y la derivación de tonos con `color-mix(in oklch, …)`.
- **Problema:** son composiciones de página viviendo en CSS global — no escalan ni se descubren. Regla de gobernanza en §10.3: quedan **congeladas** (no se añaden más), y cada una migra a componente cuando su pantalla pase por F2. `landing-*` es ámbito F5. `tiptap`/`document-preview` son ámbito del editor y no se tocan en F1.

### 1.5 Defectos sistémicos confirmados (CORREGIR — referencias al audit)

| Defecto                                 | Audit                                   | Tratamiento en este documento              |
| --------------------------------------- | --------------------------------------- | ------------------------------------------ |
| 225 usos de colores Tailwind crudos     | TR-01/SYS-01                            | Invariante DS-I1 + lint §5 + migración §11 |
| `focus:ring-accent` → token inexistente | TR-03/SYS-03                            | Decisión D-01                              |
| Sin tokens `warning`/`info`             | TR-02/SYS-02                            | §3.2                                       |
| 4+ convenciones de estado distintas     | TR-02, CON-02, ALERT-04, FAC-06, NOM-03 | Taxonomía única §7                         |
| `window.confirm` en 8 flujos            | TR-04/SYS-05                            | Contrato de confirmación §6.5              |
| Sin toasts                              | TR-05/SYS-07                            | Contrato de feedback §6.5                  |
| `SideSheet` no accesible                | TR-07/SYS-06                            | Contrato de diálogo §6.5                   |
| Dos linajes visuales (gray vs token)    | TR-11                                   | DS-I1 + migración §11                      |
| Escalas de título/ancho sin regla       | TR-10                                   | §3.4, §3.6                                 |
| Acciones solo-hover                     | EXP-03                                  | Contrato de acciones §6.4                  |
| Voseo/tildes/jerga                      | TR-08/TR-09                             | Voz §8                                     |

---

## 2. Arquitectura del sistema

Cuatro capas con dependencia estrictamente descendente. Una capa solo consume la inmediatamente inferior; saltarse capas es defecto.

```
L3  Features            apps/web/src/features/** y app/**        (pantallas, lógica de negocio)
      │ compone
L2  Patrones            apps/web/src/components/ui/**            (PageHeader, DataTable, ConfirmDialog, Toast, …)
      │ compone
L1  Primitivas          apps/web/src/components/ui/**            (Button, Input, Badge, Alert, …)
      │ consume
L0  Tokens              apps/web/src/app/globals.css             (:root + @theme inline)
```

Reglas estructurales:

- **L0** es la única fuente de valores visuales. Ningún archivo fuera de `globals.css` declara colores, radios, sombras, duraciones o z-index en crudo.
- **L1 y L2 conviven en `components/ui/`** (plano, estilo shadcn — se conserva la convención existente). La distinción L1/L2 es conceptual (primitiva atómica vs. composición con política), no de carpeta. `components/layout/` queda reservado para el App Shell.
- **L3 no estiliza semántica.** Una feature puede componer layout (grids, gaps, anchos permitidos §3.6) pero no puede: mapear estados a colores, construir tablas/diálogos/confirmaciones propias, ni declarar colores. Si L3 necesita algo que L2 no da, se extiende L2 (§10.2).
- Los iconos son siempre `lucide-react`, tamaño por defecto `size-4`, decorativos con `aria-hidden`.

---

## 3. Especificación de tokens (L0)

Todo lo siguiente vive en `globals.css`. Formato: valores en `:root`, exposición a Tailwind en `@theme inline` (patrón existente, se conserva).

### 3.1 Color — capa base (sin cambios)

Los 17 tokens de §1.2 se conservan con sus valores exactos. No se renombran, no se reajustan.

### 3.2 Color — capa semántica de estado (NUEVA)

Se añaden dos tokens de estado, en la misma familia tonal desaturada que `--success` (cumple DESIGN.md: "tonalidades desaturadas", nada chillón):

```css
--warning: oklch(0.55 0.11 80); /* ámbar desaturado, misma luminosidad percibida que success */
--info: oklch(0.45 0.08 250); /* azul informativo, distinguible de --primary por luminosidad */
```

Exposición: `--color-warning`, `--color-info` en `@theme inline`.

**Regla de derivación (canoniza el patrón existente de `Alert`):** los estados **no tienen** tokens `-surface`/`-border`/`-foreground` propios. Sus superficies se derivan por opacidad del token base, con exactamente tres niveles permitidos:

| Uso                   | Clase permitida      | Ejemplo             |
| --------------------- | -------------------- | ------------------- |
| Fondo teñido          | `bg-{estado}/8`      | `bg-warning/8`      |
| Fondo teñido enfático | `bg-{estado}/12`     | `bg-destructive/12` |
| Borde teñido          | `border-{estado}/25` | `border-success/25` |
| Texto/icono           | `text-{estado}`      | `text-info`         |

**Regla de sobriedad (deriva de la regla del 10 % de DESIGN.md):** los colores de estado **nunca** se usan como fondo sólido. La única excepción es `--destructive` como fondo del `Button variant="destructive"` (ya existe, con su `-foreground`). `success`, `warning` e `info` no tienen variante sólida ni `-foreground`: son tinte + texto, siempre.

### 3.3 Decisión D-01 — el token `accent` (RESUELTO)

**No se crea un token `--accent`.**

- El "único color de acento" que DESIGN.md dejó por resolver **ya está resuelto en el código**: es `--primary` (`oklch(0.27 0.065 246)`). Se declara formalmente: **primary es el acento corporativo**. Crear un alias `--accent` duplicaría el nombre de un mismo concepto y violaría la fuente única.
- Los ~10 usos existentes de `focus:ring-accent` / `focus:border-accent` (TR-03) son **defectos**, no consumidores a satisfacer: apuntan a un token que nunca existió, sobre `<select>` nativos que el roster §6.6 reemplaza. Migración: esos usos se corrigen al contrato de foco (§4.4) cuando cada pantalla pase por F2; mientras tanto quedan registrados como deuda (audit TR-03).
- Queda **prohibido** introducir la palabra `accent` en clases o tokens. Regla lintable en §5.

### 3.4 Tipografía — roles con nombre (resuelve TR-10)

Una sola familia (Geist Sans; Geist Mono solo para cifras/códigos donde ya se usa). La jerarquía es por rol, no por gusto de página. Clases exactas:

| Rol             | Clases canónicas                                                                | Uso único                                                       |
| --------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `display`       | `text-[2rem] sm:text-[2.45rem] font-semibold leading-tight tracking-[-0.035em]` | Heros (dashboard, perfil, auth) — máximo 1 por pantalla         |
| `page-title`    | `text-lg font-semibold tracking-[-0.018em]`                                     | Título de página (lo renderiza el PageHeader, nunca la feature) |
| `section-title` | `text-base font-semibold`                                                       | Título de sección/tarjeta grande                                |
| `card-title`    | `text-sm font-medium`                                                           | Título de tarjeta/fila                                          |
| `body`          | `text-sm` (+ `leading-6` en párrafos)                                           | Texto por defecto                                               |
| `caption`       | `text-xs text-muted-foreground`                                                 | Metadatos, ayudas                                               |
| `caption-2`     | `text-2xs text-muted-foreground`                                                | Micro-metadatos (fecha, tamaño, contador)                       |
| `numeric`       | `font-mono` + tamaño del contexto                                               | Consecutivos, índices, cifras destacadas                        |

Se añade **un** tamaño a la escala para eliminar los arbitrarios `text-[0.68rem]`/`text-[0.65rem]` dispersos:

```css
/* @theme inline */
--text-2xs: 0.6875rem;
--text-2xs--line-height: 1rem;
```

Regla: **quedan prohibidos los tamaños arbitrarios** `text-[...]` fuera de los roles `display` (los dos valores listados) — lintable §5. Los `text-2xl` de Empleados/Sedes (linaje gray) migran a `page-title` en su paso F2.

### 3.5 Radio, sombra, motion, z-index (codifican valores ya en uso)

```css
/* :root — radios (valores actuales observados, no se cambia nada visualmente) */
--radius-control: 0.375rem; /* botones, inputs, selects (= rounded-md actual) */
--radius-card: 0.75rem; /* tarjetas y contenedores de tabla (= rounded-xl actual) */
--radius-panel: 0.875rem; /* paneles hero / auth (= 14px actual) */

/* sombras — el sistema es flat por defecto (DESIGN.md); solo existen estas tres */
--shadow-card: 0 1px 2px rgb(15 23 42 / 0.04); /* tarjetas (= shadow-sm actual) */
--shadow-inset-hi: inset 0 1px 0 rgb(255 255 255 / 0.72); /* realce interior (receta existente) */
--shadow-overlay: 0 24px 48px -12px rgb(15 23 42 / 0.18); /* paneles flotantes (sustituye shadow-2xl del SideSheet) */

/* motion — duraciones observadas, canonizadas */
--duration-fast: 150ms; /* hover, color, foco */
--duration-base: 200ms; /* despliegues pequeños */
--duration-slow: 250ms; /* paneles, acordeones */
/* --ease-out-ui ya existe y se conserva */

/* overlay del backdrop (sustituye bg-black/20 hardcodeado) */
--overlay: oklch(0.19 0.02 248 / 0.22);
```

Escala de z-index (codifica lo existente: header z-10, sidebar z-20, sheet z-50):

```css
--z-sticky: 10; /* headers pegajosos */
--z-shell: 20; /* sidebar */
--z-overlay: 50; /* diálogos, sheets, toasts (toast: 50 + orden DOM) */
```

Regla: prohibido `z-[...]` arbitrario y `shadow-*` de Tailwind fuera de los tres tokens (lintable §5).

### 3.6 Layout — anchos de contenido permitidos (resuelve TR-10)

Tres arquetipos, y solo tres. Cada página declara el suyo; el PageHeader (roster §6.6) los materializa:

| Arquetipo  | Ancho       | Páginas                                        |
| ---------- | ----------- | ---------------------------------------------- |
| `detail`   | `max-w-3xl` | Detalle de una entidad (contrato, documento)   |
| `standard` | `max-w-4xl` | Listas de una columna, procesos, configuración |
| `wide`     | `max-w-6xl` | Tablas densas (empleados, contratos, lotes)    |

`max-w-5xl` (perfil) migra a `standard` o `wide` en su paso F2. Espaciado: escala Tailwind de 4px sin cambios; sin tokens propios de spacing.

---

## 4. Reglas visuales del sistema (gobiernan L1–L3)

### 4.1 Color

- **DS-I1 (invariante):** todo color proviene de un token. Prohibidas las escalas crudas de Tailwind (`gray-*`, `emerald-*`, `red-*`, `blue-*`, `amber-*`, etc.), `bg-white`, `text-white`, `bg-black` y los valores arbitrarios `#hex`/`rgb()`/`oklch()` fuera de `globals.css`. Sustitutos: `bg-white → bg-surface`, `text-gray-900 → text-foreground`, `text-gray-500 → text-muted-foreground`, `border-gray-100 → border-border-soft`, verdes/rojos/azules de estado → taxonomía §7.
- **Regla del 10 %** (DESIGN.md, ahora verificable): `--primary` solo en acción primaria (1 por vista), estados de selección/activo, y foco. Nunca como fondo decorativo ni divisor.
- El significado **nunca** viaja solo en el color: todo estado lleva etiqueta de texto (y opcionalmente icono). Deriva de WCAG 1.4.1; corrige ALERT-06, NOM-03.

### 4.2 Superficie y elevación

- Flat por defecto: profundidad por **borde + diferencia de superficie**, no por sombra. `--shadow-card` es el máximo para contenido estático; `--shadow-overlay` solo para elementos flotantes; `--shadow-inset-hi` es el realce de paneles destacados.
- Jerarquía de superficies (de fondo a frente): `canvas` → `background` → `surface` (`surface-raised` reservado para hover/active de superficies; si tras F2 sigue sin uso, se depreca vía §10.4).

### 4.3 Motion

- Transiciones con `--duration-fast` + `ease-out` para color/hover; `--ease-out-ui` para movimiento espacial. Nada anima `width/height/top/left`; solo `transform` y `opacity`.
- `prefers-reduced-motion` ya está resuelto globalmente; ningún componente lo reimplementa.

### 4.4 Foco (contrato único)

El foco canónico es el de `Button`/`Input`, sin variaciones nuevas:

- Elementos sólidos: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background`.
- Campos de formulario: `focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20`.
- Prohibido: `outline-none` sin reemplazo visible, `focus:` en lugar de `focus-visible:` (salvo campos), y cualquier referencia a `accent` (D-01).

---

## 5. Gobernanza mecánica — lint del sistema

La invariante DS-I1 se hace cumplir con ESLint (ya presente en el repo), no con disciplina. Especificación implementable:

**Regla:** `no-restricted-syntax` sobre literales y template literals en `apps/web/src/**/*.{ts,tsx}`, excluyendo `globals.css` (no aplica) y `components/landing/**` (ámbito F5, exención temporal registrada):

```
Patrón 1 (escalas crudas):
/\b(?:bg|text|border|ring|fill|stroke|divide|from|to|via|shadow|outline)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/

Patrón 2 (blanco/negro directos):
/\b(?:bg|text|border)-(?:white|black)(?:\/\d+)?\b/

Patrón 3 (token fantasma):
/\b(?:ring|border|bg|text)-accent\b/

Patrón 4 (arbitrarios de tipografía, sombra y z):
/\btext-\[[^\]]+\]/   /\bshadow-\[(?!--|var\(--)[^\]]+\]/   /\bz-\[(?!--|var\(--)[^\]]+\]/
```

- **Excepción de consumo de token (Patrón 4 — sombra y z):** los arbitrarios de sombra y z-index admiten referencias a variables CSS — `shadow-[--shadow-card]`, `z-[--z-shell]` y la forma `[var(--…)]` — porque así es como se consumen los tokens de infraestructura de §3.5 (que viven en `:root`, no en `@theme`, y por tanto no son utilidades nombradas). El lookahead `(?!--|var\(--)` bloquea únicamente valores **hardcodeados**. `text-[…]` **no** lleva excepción: la tipografía se consume por rol (`text-2xs`, §3.4), nunca por `text-[--…]`. Fiel al espíritu de DS-I1: prohibir hardcodeados, no el consumo de tokens.
- Mensaje de error de cada patrón: indicar el token sustituto (mapa de §4.1).
- **Excepciones:** se declaran inline con `eslint-disable-next-line` + comentario del motivo + ID de deuda. Sin ID, la revisión la rechaza. Los dos usos legítimos de `display` (§3.4) se reescriben como clases de rol para no necesitar excepción.
- **Política de adopción:** la regla entra como `error` para **archivos nuevos y modificados** (lint-staged sobre el diff) y el stock de 225 violaciones existentes se quema módulo a módulo en F2 (§11). No se hace un big-bang de reescritura.

---

## 6. Arquitectura de componentes — contratos (no diseños)

Esta sección define **qué debe cumplir** cada pieza, no cómo se ve ni su API detallada. El diseño de cada componente es trabajo posterior a la aprobación de este documento.

### 6.1 Principios de composición

1. **Composición sobre configuración:** piezas pequeñas que se ensamblan (patrón `SideSheet > form > footer` ya en uso) antes que mega-componentes con 20 props.
2. **Controlado por convención:** todo estado abierto/cerrado se expone como `open` / `onOpenChange` (convención ya establecida por `SideSheet`; se mantiene).
3. **El dominio entra por props tipadas, no por estilos:** un componente recibe `estado: ContratoEstado`, jamás `className="bg-emerald-50"`. El mapeo semántico vive dentro del sistema (§7).
4. **`className` es para layout del consumidor** (márgenes, grid area), no para redefinir la semántica visual del componente. `cn()` con `tailwind-merge` sigue siendo el mecanismo.

### 6.2 Contrato de API

- Variantes con **cva** (patrón `Button`); `forwardRef` en todo elemento interactivo; atributos nativos extendidos (`React.ButtonHTMLAttributes` etc.).
- Nombres de variantes semánticos (`variant="destructive"`), nunca cromáticos (`variant="red"`).
- Exportar `xVariants` cuando otra pieza necesite las clases (patrón `buttonVariants` existente).

### 6.3 Contrato de estados de interacción

Todo componente interactivo define, sin excepción: `hover`, `focus-visible` (§4.4), `active`, `disabled` (patrón existente: `disabled:pointer-events-none disabled:opacity-50`), y su estado `loading` cuando dispare mutaciones (spinner `Loader2` + `disabled`, patrón ya en uso — se canoniza).

### 6.4 Contrato de accesibilidad (WCAG AA como criterio de aceptación)

- Todo control tiene nombre accesible; `Label` siempre asociado por `htmlFor` (se refuerza en su implementación).
- Iconos decorativos: `aria-hidden`. Botones solo-icono: `sr-only` con la acción (patrón ya presente en `SideSheet`/expediente — se generaliza).
- **Acciones nunca solo-hover:** todo lo revelado por hover es también alcanzable/visible con `focus-within` y en pantallas táctiles (corrige EXP-03).
- Estados con texto además de color (§4.1).
- Feedback de mutaciones anunciado con `aria-live` (lo materializa el Toast del roster).

### 6.5 Contratos de las tres piezas con política (los "contratos entre componentes")

**Contrato de diálogo** — cumplen: SideSheet (corregido), ConfirmDialog, y cualquier overlay futuro:

1. Focus trap mientras está abierto; 2. `Esc` cierra (salvo confirmación de acto irreversible); 3. foco inicial al primer elemento pertinente y **retorno de foco** al disparador al cerrar; 4. `aria-labelledby`/`aria-describedby` apuntando a título/descripción; 5. backdrop `bg-[--overlay]`; 6. scroll de body bloqueado (ya resuelto en SideSheet, se conserva).

**Contrato de confirmación** (elimina `window.confirm`, TR-04) — dos niveles, decididos por el dominio y no por la página:

- **Nivel 1 — destructivo recuperable** (desactivar empleado/sede, eliminar plantilla/documento/cliente): ConfirmDialog con título específico, consecuencia en una frase, botón `destructive` etiquetado con el verbo real ("Desactivar empleado", nunca "Aceptar").
- **Nivel 2 — irreversible de dominio** (cerrar período de nómina; futuros: aprobar liquidación, contabilizar, cerrar año): además de lo anterior, el diálogo **explica el efecto e indica la vía de corrección** que el dominio ofrece (reverso, nueva versión — ADR-001/002), y exige confirmación no accidental (acción explícita, no Enter por defecto). Alineado con el principio 4 del Plan Maestro (fail-secure en superficie).

**Contrato de feedback** (TR-05):

- Mutación exitosa → toast de confirmación breve; mutación fallida → toast de error **o** `Alert` inline si el error pertenece al formulario abierto. Nunca silencio.
- El toast es el único elemento con posición fija además de los diálogos; anuncia por `aria-live="polite"` (éxito) / `"assertive"` (error).
- `Alert` sigue siendo el mecanismo inline; los banners rojos artesanales (SED-03, LOT-02) migran a `Alert variant="destructive"`.

### 6.6 Roster de piezas del sistema (inventario comprometido, sin diseño)

Derivado 1:1 de SYS-04. Ninguna pieza fuera de esta lista se crea sin pasar por §10.2.

| Pieza                                 | Capa | Estado                                         | Contratos que debe cumplir                                                                                                                               | Deuda que cierra                 |
| ------------------------------------- | ---- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Button, Input, Label, Alert, Skeleton | L1   | Existen — conservar (Label refuerza `htmlFor`) | §6.2–6.4                                                                                                                                                 | —                                |
| **Badge**                             | L1   | Existente — **rehacer variantes**              | §6.2; variantes = taxonomía §7; deja de aceptar color por `className`                                                                                    | TR-01 parcial                    |
| **StatusBadge**                       | L2   | Nuevo (sobre Badge)                            | Único mapeo estado-de-dominio → variante+etiqueta+icono (§7)                                                                                             | CON-02, ALERT-04, FAC-06, NOM-03 |
| **Select**                            | L1   | Nuevo                                          | Reemplaza `<select>` nativos estilados a mano; contrato de foco §4.4; teclado nativo                                                                     | TR-03, CON-03, LOT-02            |
| **FormField**                         | L2   | Nuevo                                          | Label+control+error+ayuda; error con `aria-describedby`                                                                                                  | formularios sin feedback         |
| **SideSheet**                         | L2   | Existente — corregir                           | Contrato de diálogo §6.5 sin cambiar API                                                                                                                 | TR-07                            |
| **ConfirmDialog**                     | L2   | Nuevo                                          | Contrato de confirmación §6.5 (2 niveles)                                                                                                                | TR-04                            |
| **Toast** (+provider)                 | L2   | Nuevo                                          | Contrato de feedback §6.5                                                                                                                                | TR-05                            |
| **PageHeader**                        | L2   | Nuevo                                          | Título (`page-title` §3.4) + descripción + acciones + arquetipo de ancho §3.6; **una sola fuente de título por página** (prerrequisito del App Shell v2) | NAV-04, TR-06                    |
| **DataTable**                         | L2   | Nuevo                                          | Encabezados, densidad, hover de fila, celda de acciones (§6.4), empty/loading integrados                                                                 | TR-06, EMP-01                    |
| **Pagination**                        | L2   | Nuevo                                          | Patrón ya correcto de Lotes, extraído y canonizado                                                                                                       | EMP-02, CON-04, GEN-03           |
| **EmptyState**                        | L2   | Nuevo                                          | Icono+mensaje+acción opcional; canoniza el patrón dashed existente                                                                                       | TR-06                            |
| **FilterBar**                         | L2   | Nuevo                                          | Search+selects+acciones; canoniza la toolbar repetida                                                                                                    | TR-06                            |
| **DatePicker**                        | L1   | Diferido                                       | `<input type="date">` nativo es aceptable en F1/F2; se decide en F3 si nómina lo exige                                                                   | CON-03 parcial                   |

Orden de implementación sugerido (por dependencia, no por fecha): tokens §3 → Badge/StatusBadge → Toast/ConfirmDialog (desbloquean TR-04/05 en todos los módulos) → PageHeader (desbloquea App Shell) → Select/FormField → DataTable/Pagination/FilterBar/EmptyState → SideSheet fix.

---

## 7. Taxonomía canónica de estados del dominio

Fuente única del mapeo estado → semántica. La implementa `StatusBadge`; ningún otro archivo mapea estados a colores. Cinco semánticas, ancladas a los tokens de §3.1–3.2:

| Semántica | Token                        | Significado                                      |
| --------- | ---------------------------- | ------------------------------------------------ |
| `neutral` | `muted` / `muted-foreground` | Inactivo, terminal sin carga emocional, borrador |
| `info`    | `info`                       | En curso, informativo, transicional              |
| `success` | `success`                    | Vigente, correcto, completado                    |
| `warning` | `warning`                    | Requiere atención, parcial, próximo a vencer     |
| `danger`  | `destructive`                | Vencido, fallido, crítico                        |

Mapeo comprometido (los estados son del dominio y **no se renombran**; la etiqueta visible es la traducción oficial):

| Dominio                            | Estado                                                                       | Semántica                                         | Etiqueta                         |
| ---------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------- | -------------------------------- |
| Empleado                           | `ACTIVO` / `INACTIVO`                                                        | success / neutral                                 | Activo / Inactivo                |
| Contrato                           | `VIGENTE`                                                                    | success                                           | Vigente                          |
| Contrato                           | `VENCIDO`                                                                    | danger                                            | Vencido                          |
| Contrato                           | `TERMINADO`                                                                  | neutral                                           | Terminado                        |
| Contrato                           | `RENOVADO`                                                                   | info                                              | Renovado                         |
| Lote                               | `PENDIENTE` / `EN_PROCESO`                                                   | info                                              | Pendiente / En proceso           |
| Lote                               | `COMPLETADO`                                                                 | success                                           | Completado                       |
| Lote                               | `COMPLETADO_CON_ERRORES`                                                     | warning                                           | Completado con errores           |
| Lote                               | `FALLIDO`                                                                    | danger                                            | Fallido                          |
| Alerta (severidad)                 | `INFO` / `WARNING` / `CRITICAL`                                              | info / warning / danger                           | Informativa / Atención / Crítica |
| Alerta (estado)                    | `OPEN` / `RESOLVED`                                                          | warning / neutral                                 | Abierta / Resuelta               |
| Factura                            | `BORRADOR` / `EMITIDA` / `ANULADA`                                           | neutral / success / danger                        | Borrador / Emitida / Anulada     |
| Nómina (actual N2)                 | `DRAFT` / `CLOSED`                                                           | neutral / neutral                                 | Borrador / Cerrado               |
| Nómina (ADR-002, **reservado F3**) | `BORRADOR`→`CALCULADA`→`EN_REVISION`→`APROBADA`→`CAUSADA`→`PAGADA`→`CERRADA` | neutral→info→warning→success→info→success→neutral | según glosario F3                |
| Contable (**reservado F4**)        | `ABIERTO` / `CERRADO` · `BORRADOR`/`CONTABILIZADO`/`ANULADO`                 | success / neutral · neutral / success / danger    | según superficie F0              |

Reglas: cifras monetarias **no** se colorean por defecto (los `+verde/-rojo` de nómina se re-evalúan en F3 contra esta taxonomía); "devengo/deducción" es tipo de concepto, no estado — su tratamiento se decide en el diseño de nómina, no aquí.

---

## 8. Voz y microcopy (parte del sistema)

- **Idioma:** español de Colombia, ortografía completa (tildes siempre — TR-08). **Tratamiento: tuteo** ("Gestiona", "Ingresa"); queda prohibido el voseo ("Gestioná", "Usá") — corrige EXP-06/ALERT-07/NOM-06.
- **Vocabulario del dominio del usuario:** empleado, contrato, expediente, sede, liquidación, comprobante, período. **Prohibido en superficie de usuario:** tenant, snapshot, motor, dominio, JWT, token, MVP, run, dual-write (TR-09).
- **Verbos reales en acciones:** el botón dice lo que hace ("Desactivar empleado", "Cerrar período"), nunca "Aceptar/OK/Sí".
- Estados y severidades siempre en español (ALERT-04).
- El glosario término-a-término es entregable de F0 (Plan Maestro); este documento fija las reglas, no el diccionario.

---

## 9. Registro de decisiones del sistema

| #    | Decisión                                                                                                                                    | Fundamento                                                         |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| D-01 | No existe token `accent`; `--primary` es el acento corporativo; usos de `*-accent` son defectos a migrar.                                   | §3.3. Fuente única de nombre por concepto.                         |
| D-02 | La paleta base (17 tokens) se conserva con valores exactos.                                                                                 | Evolucionar antes que reescribir; la paleta cumple DESIGN.md.      |
| D-03 | Estados semánticos = 2 tokens nuevos (`warning`, `info`) + derivación por opacidad `/8 /12 /25`; sin variantes sólidas salvo `destructive`. | Canoniza el patrón de `Alert`; regla del 10 %; calma operativa.    |
| D-04 | Tipografía por roles con clases exactas + token `--text-2xs`; prohibidos arbitrarios.                                                       | Resuelve TR-10 sin cambiar la estética dominante.                  |
| D-05 | Radios/sombras/duraciones/z-index tokenizados con los valores hoy en uso.                                                                   | Codificar, no rediseñar.                                           |
| D-06 | Tres anchos de contenido (`3xl/4xl/6xl`) como únicos arquetipos de página.                                                                  | Resuelve TR-10.                                                    |
| D-07 | Cumplimiento por ESLint sobre archivos nuevos/modificados; stock de 225 se migra por módulo en F2.                                          | Sin big-bang; misma estrategia de migración por fases del backend. |
| D-08 | `Badge` deja de aceptar semántica por `className`; `StatusBadge` es el único mapeo estado→visual.                                           | Cierra el vector principal de evasión.                             |
| D-09 | Confirmaciones en 2 niveles (destructivo / irreversible de dominio); `window.confirm` prohibido.                                            | TR-04; fail-secure en superficie (Plan Maestro, principio 4).      |
| D-10 | Recetas CSS de página en `globals.css` congeladas; migran a componentes con su pantalla en F2; `landing-*` es F5.                           | Gobernar sin big-bang.                                             |
| D-11 | `DatePicker` diferido; `<input type="date">` aceptable hasta F3.                                                                            | No construir antes de la demanda (anti-sobreingeniería).           |
| D-12 | Sin modo oscuro en F1. La arquitectura de tokens (valores en `:root`) lo deja abierto; se decidirá cuando haya demanda real.                | Alcance controlado.                                                |

---

## 10. Reglas de evolución del sistema

### 10.1 Añadir un token

Solo si: (1) el valor se necesita en ≥2 sitios, (2) ningún token existente ni derivación `color-mix`/opacidad lo cubre, (3) se registra en §9 con fundamento. Los tokens se añaden en `:root` + `@theme inline`; nunca en un componente.

### 10.2 Añadir o extender un componente

Orden obligatorio: (1) ¿lo cubre una pieza del roster §6.6? → usarla; (2) ¿casi? → extender sus variantes vía cva en su archivo; (3) ¿no? → proponerlo como adición al roster (actualiza este documento) antes de escribirlo. Un componente que nace en `features/` y se usa en 2+ features debe promoverse a `components/ui/`.

### 10.3 CSS global

`globals.css` solo acepta: tokens, reset/base, y utilidades de rol tipográfico si se materializan como clases. **No se añaden más clases-receta de página** (D-10).

### 10.4 Deprecación

Un token/patrón se depreca marcándolo con comentario `/* @deprecated — motivo, sustituto */`, registrándolo en §9, y eliminándolo solo cuando el lint confirme cero usos.

### 10.5 Autoridad documental

`DESIGN.md` queda como declaración de north star (no se edita en F1); **este documento es la especificación operativa**. Conflicto entre ambos → gana este, y la discrepancia se registra en §9.

---

## 11. Plan de adopción (sin fechas; secuencia por dependencia)

1. **F1-a — Tokens:** añadir §3.2/§3.4/§3.5 a `globals.css`. Cero cambios visuales (los valores nuevos aún no tienen consumidores).
2. **F1-b — Lint:** activar §5 sobre archivos nuevos/modificados. Desde aquí, la deuda no crece.
3. **F1-c — Piezas de política:** Badge+StatusBadge, Toast, ConfirmDialog, PageHeader (orden de §6.6). Cada una reemplaza su antipatrón en las pantallas que toque.
4. **F1-d — Resto del roster** según el orden de §6.6; SideSheet se corrige sin cambiar API.
5. **F2 — Migración por módulo** (orden del Plan Maestro): al pasar cada pantalla, se queman sus violaciones de lint, se adopta la taxonomía §7 y se migran sus recetas CSS (D-10). Criterio de salida por módulo: **cero violaciones de §5 + contratos §6.3–6.5 verificados**.

**Criterios de aceptación de F1 completo:** tokens de §3 presentes en `globals.css` y expuestos en `@theme`; lint de §5 activo y en verde sobre el diff; roster §6.6 implementado con sus contratos; `window.confirm` con cero usos en `apps/web/src` (excepto landing hasta F5); `typecheck` y `build` verdes.

---

_Fin de DESIGN-SYSTEM.md. Pendiente de aprobación antes de continuar con el App Shell o cualquier pantalla._
