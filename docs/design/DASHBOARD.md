# DASHBOARD.md — Diseño definitivo del Dashboard "Bandeja del día"

| Campo                | Valor                                                                                                                                                       |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Documento**        | Diseño implementable del Dashboard (pantalla `/dashboard`)                                                                                                  |
| **Fecha**            | 2026-07-03                                                                                                                                                  |
| **Estado**           | Propuesto — pendiente de aprobación                                                                                                                         |
| **Dirección**        | A · **Bandeja del día** (columna vertebral), con préstamos acotados: rol de D, cronología de C, acciones rápidas de E                                       |
| **Rige**             | `PLAN-MAESTRO-REDISENO.md` · `PRODUCT-UX-AUDIT.md` · `DESIGN-SYSTEM.md` (DS) · `APP-SHELL.md` (AS) · `DASHBOARD-EXPLORATION.md`                             |
| **Ámbito**           | Diseño de la pantalla. **No** contiene código, React, Tailwind ni HTML. Especifica estructura, comportamiento y estados para implementar sin reinterpretar. |
| **Pregunta rectora** | **¿Qué necesita hacer hoy un operador administrativo?** Cada decisión responde esto.                                                                        |

Convención: decisiones numeradas `DB-Dn`. Todo dato mostrado existe en las APIs actuales (DASHBOARD-EXPLORATION §0); cero endpoints nuevos. Todo valor visual proviene de tokens DS; cero colores crudos.

---

## 1. Filosofía y límites de los préstamos

**Columna vertebral (A):** el Dashboard es una **bandeja de trabajo que se vacía**, no un informe que se lee. Una sola lista priorizada de asuntos que hoy requieren decisión o acción. El éxito del día es una bandeja vacía ("Todo al día").

Los tres préstamos entran **subordinados**, sin convertir la pantalla en otra filosofía:

| Préstamo                 | Qué se toma                                                                                                    | Límite explícito (para no mezclar filosofías)                                                                                                                                                                                              |
| ------------------------ | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **C · cronología**       | El orden dentro de la bandeja lo manda el tiempo: lo vencido/urgente primero, agrupado por horizonte temporal. | No hay una "línea de tiempo" como vista aparte; el tiempo es el **criterio de orden** de la bandeja, no una segunda pantalla.                                                                                                              |
| **D · rol**              | Consciencia de rol **editorial**: qué acciones rápidas se ofrecen y un matiz de énfasis.                       | El universo de ítems es **idéntico** para ADMIN y OPERADOR (H2: el backend no separa crear de aprobar). El rol no oculta pendientes; solo adapta la zona de acciones y un énfasis. Honestidad ante el límite del RBAC actual (ADR-002 §6). |
| **E · acciones rápidas** | Una zona compacta de arranque de trabajo frecuente, al pie.                                                    | Es secundaria y calmada; nunca compite con la bandeja ni la empuja fuera de vista. Sin "línea-resumen" de E (esa función la cumple el conteo del encabezado, que es propio de A).                                                          |

**DB-D1 — La bandeja es una lista, no tarjetas.** Prohibido resolver la bandeja como rejilla de tarjetas o como paneles de métricas (bans de impeccable: _hero-metric template_, _identical card grids_). El dashboard actual —paneles de sesión + módulos "Pendiente"— se elimina por completo (DASH-01/02/03).

---

## 2. Anatomía de la pantalla

Respeta la anatomía de página del App Shell (AS §7). De arriba abajo:

```
1. PageHeader        "Inicio" · saludo con conteo · [frescura + Actualizar] como acciones
2. Bandeja del día   (dominante) — lista priorizada, agrupada por horizonte temporal
3. Acciones rápidas  (secundaria, al pie) — arranque de trabajo, consciente de rol
```

- **Sin zona de resumen/stats.** El único "resumen" es el conteo en el encabezado y la propia estructura de bandas (que ya dice cuántos asuntos hay y de qué urgencia). No se añaden tarjetas de cifras (DB-D1).
- **Arquetipo de ancho: `standard` (max-w-4xl), centrado** (AS §3.6). Una bandeja se lee mejor en una columna acotada; anchos mayores dispersan la lectura vertical. Las acciones rápidas comparten ese ancho.
- Ritmo vertical: `space-y-6` entre las tres zonas; dentro de la bandeja, las bandas se separan con `space-y-6`, las filas por divisor (§4.4).

---

## 3. PageHeader del Dashboard

Usa el `PageHeader` del sistema (DS §6.6), única fuente del `h1` (cierra NAV-04/DASH):

- **Título:** "Inicio" (rol `page-title`). Es la etiqueta del nav (AS §2.1); coherencia nav↔pantalla.
- **Descripción (rol `caption`) = saludo + conteo, en lenguaje del usuario:**
  - Con pendientes: _"Hola, {nombre}. Tienes {N} asuntos por atender hoy."_ — el conteo `N` = total de ítems de la bandeja.
  - Bandeja vacía: _"Hola, {nombre}. Todo al día."_
  - `{nombre}` cae a "equipo" si la sesión no lo trae (se conserva el fallback actual, corregido de tildes).
- **Acciones del header (no primarias — regla del 10 %):**
  - **Frescura:** texto discreto _"Actualizado hace {tiempo}"_ (rol `caption-2`), derivado del `createdAt` más reciente entre los datos cargados / marca de la última carga en cliente.
  - **Actualizar** (`Button variant="outline" size="sm"`, icono refresh): **DB-D2 — resuelve la deuda ALERT-01 con honestidad.** Como las alertas se generan manualmente, "Actualizar" dispara las funciones existentes `generateContractAlerts` + `generateMissingDocAlerts` y luego re-consulta todas las fuentes. No se simula tiempo real: la frescura se muestra y el usuario la refresca con un control que usa APIs ya existentes (cero endpoints nuevos). Estado `loading` mientras corre (§9).

**No** hay indicador de empresa aquí (vive en el header global del shell, AS §5.2) ni badges de rol/MVP (eliminados).

---

## 4. La Bandeja del día (núcleo)

### 4.1 Modelo de ítem (tipos, todos con dato real)

Cada ítem de la bandeja es una instancia de un **modelo tipado común** (el punto de extensión — §12). Tipos en v1, todos de fuentes verificadas (EXPLORATION §0):

| Tipo de ítem                        | Fuente real                                                       | Semántica (StatusBadge, DS §7)                      | Acción(es)                                                                       |
| ----------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------- |
| **Contrato por vencer / vencido**   | `GET /alerts` (alerta de contrato: `dueDate`≠null, `employee`)    | `danger` si vencido/CRITICAL · `warning` si próximo | Primaria: **Ver empleado** (`/empleados/:employeeId`) · Secundaria: **Resolver** |
| **Documento faltante**              | `GET /alerts` (`generateMissingDocAlerts`, `employee`)            | `warning`                                           | **Ver empleado** · **Resolver**                                                  |
| **Alerta crítica (genérica)**       | `GET /alerts` `severity=CRITICAL, status=OPEN`                    | `danger`                                            | **Resolver** · (Ver empleado si `employee`≠null)                                 |
| **Lote con errores / fallido**      | `GET /contracts/lotes` `estado∈{COMPLETADO_CON_ERRORES, FALLIDO}` | `warning`/`danger`                                  | **Ver lote** (`/contratos/lotes/:id`)                                            |
| **Lote en proceso**                 | `GET /contracts/lotes` `estado=EN_PROCESO`                        | `info`                                              | **Ver lote**                                                                     |
| **Nómina sin cerrar**               | `GET /payroll` períodos `status=DRAFT` (N2 actual)                | `neutral` (borrador)                                | **Ver período** (`/nomina/periodos/:id`)                                         |
| **Facturas en borrador** (agregado) | `GET /billing/dashboard` `facturasBorrador`                       | `neutral`                                           | **Ver facturas** (`/facturacion/facturas`) — un solo ítem con el conteo          |

Honestidad de dominio marcada en la propia interfaz donde aplica: la nómina usa los estados N2 (`DRAFT/CLOSED`); cuando F3 traiga los 7 estados de ADR-002, el ítem "Nómina" gana los nuevos tipos (en revisión, por aprobar) sin cambiar el modelo (§12).

### 4.2 Algoritmo de priorización (determinista, sin reinterpretación)

La bandeja es **una sola lista** agrupada en **bandas por horizonte temporal** (préstamo C). Orden:

**Bandas** (un ítem cae en la primera que cumpla):

1. **`Requiere acción`** — vencido, crítico o fallido: `dueDate < hoy` **o** `severity=CRITICAL` **o** lote `∈{FALLIDO, COMPLETADO_CON_ERRORES}`.
2. **`Esta semana`** — `dueDate ∈ [hoy, hoy+7]`, **o** alerta `WARNING` sin `dueDate`.
3. **`Este mes`** — `dueDate ∈ (hoy+7, hoy+30]`.
4. **`En curso`** — lote `EN_PROCESO`, nómina `DRAFT`, facturas borrador, alertas `INFO`, y `dueDate > hoy+30`.

**Orden dentro de una banda** (clave de ordenación estable):

1. ítems con `dueDate` primero, por `dueDate` ascendente (lo más próximo, arriba);
2. luego por severidad `CRITICAL > WARNING > INFO > neutral`;
3. desempate por `createdAt` descendente (lo más reciente arriba).

**DB-D3 — Una banda vacía no se muestra.** Sin encabezados de banda huérfanos. Si solo hay ítems "En curso", la bandeja abre directamente en esa banda.

### 4.3 Encabezado de banda

- Rol `caption-2` en mayúsculas espaciadas + conteo de la banda: _"REQUIERE ACCIÓN · 3"_, _"ESTA SEMANA · 2"_. `text-muted-foreground`.
- **La urgencia se comunica por posición y por texto, no por bandas de color** (calma operativa, principio 5; anti-Siigo de PRODUCT.md). La banda "Requiere acción" no lleva fondo rojo; su peso lo dan el orden (primera) y las etiquetas de sus ítems.
- Es `h2` en el árbol de encabezados (§10).

### 4.4 Anatomía de una fila de bandeja (verbal, sin código)

Fila de ancho completo, separada de la siguiente por divisor `border-border-soft`; hover `bg-muted/40` (patrón ya existente en listas). **DB-D4 — prohibido el borde-lateral de color** (ban de impeccable) y prohibido el fondo de color por fila.

De izquierda a derecha:

1. **Indicador de tipo (izquierda):** icono `size-4` (lucide) en contenedor neutro `size-8 rounded-[--radius-control] border-border bg-surface` (patrón de las filas de expediente/alertas). El icono identifica el **tipo** (contrato, documento, lote, nómina, factura); es monocromo `text-muted-foreground`. La urgencia **no** viaja en este icono.
2. **Cuerpo (centro, `min-w-0`, flexible):**
   - **Línea 1 — asunto** (rol `card-title`, `text-foreground`): frase en lenguaje del usuario que nombra la entidad. Ej.: _"El contrato de María Pérez vence pronto"_, _"Faltan documentos en el expediente de Juan Gómez"_, _"El lote «Contratos enero» terminó con 2 errores"_, _"La nómina de octubre sigue en borrador"_. Truncado con `min-w-0`.
   - **Línea 2 — contexto** (rol `caption-2`, `text-muted-foreground`): `StatusBadge` semántico (DS §7) + **frase temporal explícita** + meta. Ej.: `[Vencido]` _"hace 2 días · María Pérez"_; `[Atención]` _"vence en 3 días"_; `[En proceso]` _"18 de 40 procesados"_. La frase temniral es texto, nunca solo color (WCAG 1.4.1).
3. **Acciones (derecha, `shrink-0`):** **siempre visibles** — nunca solo-hover (corrige EXP-03; contrato DS §6.4). Acción primaria como `Button variant="outline" size="sm"` con **nombre accesible completo** ("Ver empleado María Pérez"); acción secundaria (Resolver) como `ghost`. En ≤`sm` las acciones bajan a una segunda fila bajo el cuerpo (§8).

**DB-D5 — Sin enlace envolvente de fila.** La fila no es un `<a>` que envuelve a los botones (evita interactivos anidados, trampa de accesibilidad). El asunto (línea 1) puede ser el enlace de navegación; las acciones son botones hermanos. Un solo destino de navegación por fila, más las acciones explícitas.

### 4.5 Consciencia de rol (préstamo D, editorial y honesto)

- **DB-D6:** el **conjunto de ítems no cambia** por rol; ADMIN y OPERADOR ven los mismos pendientes (H2). El rol solo afecta:
  - la **zona de acciones rápidas** (§5), y
  - un **matiz de énfasis** dentro de la banda "En curso": para ADMIN, "Nómina sin cerrar" se ordena por encima de "Facturas en borrador"; para OPERADOR, a la inversa. Es reordenamiento editorial dentro de una banda, no ocultamiento.
- No se muestran affordances de aprobación/cierre que el rol no pueda ejecutar hasta que el RBAC granular exista (regla ocultar-vs-deshabilitar, AS §8.10). Hoy, ambas acciones "Ver período" son idénticas para los dos roles.

---

## 5. Zona de acciones rápidas (préstamo E, al pie)

**DB-D7 — Secundaria y calmada, nunca protagonista.** Debajo de la bandeja, separada por `space-y-6`, un bloque compacto:

- Encabezado `caption-2` en mayúsculas: _"ACCIONES RÁPIDAS"_.
- Una fila de **3–4 acciones de arranque** (no tarjetas grandes: botones/enlaces compactos con icono + etiqueta, `bg-surface border-border rounded-[--radius-control]`, alineados en `flex flex-wrap gap-3`). Cada una **navega** al punto de creación del módulo (el dashboard no abre el SideSheet de otra página):
  - **Comunes:** Nuevo empleado (`/empleados`) · Generar contrato (`/contratos`) · Nuevo lote (`/contratos/lotes`).
  - **Consciente de rol (editorial):** para OPERADOR se prioriza _Nuevo empleado_ / _Generar contrato_ (captura); para ADMIN se añade _Nueva factura_ (`/facturacion/facturas`). Máximo 4 visibles; el resto vive en su módulo.
- Ninguna acción rápida es `variant="default"` (la acción primaria del 10 % no vive aquí; estas son atajos, no la acción principal de la pantalla).

Justificación de posición (al pie, no arriba): la pantalla es primordialmente de **triaje** (atender la bandeja); poner el arranque de tareas nuevas por encima de los pendientes contradiría la filosofía A. El usuario que entra a _crear_ lo encuentra tras un scroll corto y consistente.

---

## 6. Jerarquía visual y ritmo

- **Un solo `display`/hero: ninguno.** El dashboard-bandeja no abre con hero (a diferencia del actual). El `PageHeader` con `page-title` es la cima tipográfica; esto baja el tono de "pantalla de bienvenida" a "pantalla de trabajo" (objetivo del rediseño).
- Escala tipográfica: solo roles DS §3.4 (`page-title`, `card-title`, `caption`, `caption-2`). Cero tamaños arbitrarios.
- La bandeja domina el peso visual; las acciones rápidas son visiblemente más ligeras (menos contraste, elementos menores).
- Densidad: cómoda (filas ~`py-3.5`), la del resto del producto (AS §3.3). Sin modo compacto en v1.
- Contenedor de la bandeja: superficie `bg-surface`, borde `border-border`, `rounded-[--radius-card]`, `shadow-[--shadow-card]` — el patrón de contenedor de lista ya existente. **Flat por defecto** (DS §4.2): sin sombras pesadas.

---

## 7. Color y estado

- **Restrained** (DS §4.1, register de producto): neutros + un acento (`primary`) reservado a la acción y a nada decorativo. La bandeja es mayoritariamente monocroma; el color aparece **solo** en los `StatusBadge` y en el foco.
- Estados exclusivamente por `StatusBadge` con la taxonomía DS §7 (`neutral/info/success/warning/danger`), tinte por opacidad `/8` + texto `text-{estado}`, **sin fondos sólidos** (salvo `destructive` de botón, que aquí no aplica). Corrige NOM-03/ALERT-04/CON-02 en su primera aparición conjunta.
- **El color nunca es el único portador de significado:** toda urgencia lleva frase temporal en texto (§4.4).
- Cifras monetarias (facturas borrador): sin colorear (DS §7). El neto de nómina no aparece en el dashboard (es dato de módulo, no un pendiente).

---

## 8. Responsive

Dentro del arquetipo `standard`, el shell garantiza el marco (AS §6); la pantalla gestiona su contenido:

| Rango | Bandeja                                                                                                                                                 | Acciones rápidas                                               |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `≥md` | Fila completa: indicador · cuerpo · acciones en línea a la derecha.                                                                                     | Fila horizontal `flex-wrap`.                                   |
| `<md` | El cuerpo ocupa el ancho; las **acciones bajan a una segunda línea** bajo el contexto, alineadas a la izquierda, sin quedar ocultas (nunca solo-hover). | Se apilan a ancho completo (una acción por línea si no caben). |

- Sin scroll horizontal jamás (AS §6.3); `min-w-0` en el cuerpo de fila para truncar el asunto largo.
- El conteo del encabezado y las frases temporales no se truncan (información esencial).

---

## 9. Estados de la pantalla

Contrato de estados completo (register de producto: "no ship half of these"):

| Estado                            | Comportamiento                                                                                                                                                                                                                                                                                                                                               |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Carga**                         | **Skeleton que imita la anatomía** (AS §8.8): encabezado + 3–4 filas-esqueleto con la silueta de fila (indicador + dos líneas + acción). Sin spinner central.                                                                                                                                                                                                |
| **Vacío (todo al día)**           | `EmptyState` afirmativo que **enseña**, no "nada aquí": icono sereno (check discreto, `text-success` puntual), título _"Todo al día"_, apoyo _"No tienes asuntos pendientes por ahora. Cuando un contrato esté por vencer o un lote necesite atención, aparecerá aquí."_ + la zona de acciones rápidas visible (para que la pantalla siga siendo útil).      |
| **Sin generar / frescura dudosa** | Si las fuentes de alertas devuelven 0 pero nunca se han generado, el empty state añade una línea honesta: _"¿Esperabas ver alertas? Pulsa Actualizar para revisar vencimientos y documentos."_ — evita confundir "todo al día" con "nadie generó" (deuda ALERT-01, resuelta sin inventar API).                                                               |
| **Error total**                   | Bloque de error estándar en la zona de contenido (AS §8.9): mensaje en lenguaje de usuario + **Reintentar**. El shell (nav/header) permanece operativo.                                                                                                                                                                                                      |
| **Error parcial (degradación)**   | **DB-D8:** la bandeja se compone de varias queries independientes (alertas, lotes, nómina, facturación). Si **una** falla, las demás **se renderizan igual**; la fuente caída muestra una fila-aviso discreta dentro de su banda (_"No se pudieron cargar los lotes. Reintentar."_) en vez de tumbar toda la pantalla. Degradación elegante, no todo-o-nada. |
| **Refrescando**                   | Al pulsar Actualizar: el icono entra en `loading` (spin), el botón se deshabilita, y al terminar los ítems nuevos entran con el contrato de movimiento (§11); el conteo y la frescura se actualizan con `aria-live`.                                                                                                                                         |
| **Resolviendo un ítem**           | El botón Resolver entra en `loading`; al éxito, la fila abandona la bandeja (§11) y el conteo baja; toast de confirmación (contrato de feedback DS §6.5). Al fallo, la fila permanece + toast de error.                                                                                                                                                      |

---

## 10. Accesibilidad (WCAG AA como criterio de aceptación)

- **Árbol de encabezados:** `h1` = "Inicio" (en el PageHeader, único de la pantalla — AS §7). Cada banda es `h2`. La zona de acciones rápidas es `h2`.
- **Semántica de lista:** cada banda es una lista (`ul`) de ítems (`li`); el conteo por banda va en su `h2`.
- **Región viva:** el conteo del encabezado y los cambios tras Actualizar/Resolver se anuncian por una región `aria-live="polite"` (p. ej. _"Ahora tienes 4 asuntos"_). Errores por `assertive`.
- **Nombres accesibles:** cada acción incluye el asunto ("Ver empleado María Pérez", "Resolver alerta de documento faltante de Juan Gómez"); nada de "Ver" suelto para lectores de pantalla.
- **Estado por texto + badge**, nunca solo color (§4.4/§7).
- **Teclado:** orden de tab = orden visual; sin interactivos anidados (DB-D5); foco visible con el contrato único DS §4.4.
- **Contraste:** obligación verificable — `card-title` (`text-foreground` 0.19) y `caption-2` (`muted-foreground` 0.42) sobre `surface`/`background` (~0.998/0.982) superan holgado 4.5:1; los `StatusBadge` (`text-{estado}` sobre tinte `/8`) se verifican ≥4.5:1 en implementación (los tokens de estado son oscuros sobre tinte muy claro; pasan, se confirma).
- **Reduced-motion:** todas las animaciones tienen alternativa (§11); ya resuelto globalmente, la pantalla no lo reimplementa.

---

## 11. Contrato de movimiento

Motion **solo cuando comunica un cambio de estado o una relación** (register de producto; instrucción del usuario: nunca decorativo). Reutiliza los tokens DS (§3.5) — **no se inventan tokens nuevos** (DS §10.1):

| Momento                                  | Movimiento                                                                 | Token                                       | Por qué (productividad/claridad)                                              |
| ---------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------- |
| **Resolver un ítem**                     | La fila colapsa en altura + desvanece (`opacity`), luego la lista refluye. | `--duration-base` (200ms) + `--ease-out-ui` | Comunica "esto salió de tu bandeja" — el feedback central del acto de vaciar. |
| **Entrada de ítems tras Actualizar**     | Los ítems nuevos aparecen con crossfade (`opacity`).                       | `--duration-fast` (150ms)                   | Comunica que el refresco trajo datos, sin coreografía.                        |
| **Icono Actualizar / Resolver en curso** | Spin del icono mientras corre.                                             | `linear`, continuo                          | Estado de progreso (esencial).                                                |
| **Conteo / frescura**                    | Cambio de texto instantáneo + `aria-live`.                                 | —                                           | Información, no animación.                                                    |
| **Hover/press de filas y botones**       | Estados estándar del sistema.                                              | `--duration-fast`                           | Feedback de interacción (DS §4.3).                                            |

**DB-D9 — Sin secuencia de carga orquestada** (ban de producto): en la carga inicial **no hay entrada escalonada por fila**; se pasa de skeleton a contenido con, a lo sumo, un crossfade del contenedor (`--duration-fast`). El dashboard carga a una tarea; el usuario no ve "aparecer" la pantalla.

**Reduced-motion:** el colapso-al-resolver y los crossfades se vuelven **instantáneos** (cambio directo); el spin de progreso se conserva (estado esencial). Sin sliding/scaling. Nada anima `width/top/left`; solo `opacity` y `height` (esta última solo en el colapso-al-resolver, aceptada por ser el feedback de estado).

---

## 12. Escalabilidad (módulos futuros, sin rediseño)

La bandeja es el punto de extensión, igual que el `nav-tree` lo es para el shell:

- Un módulo nuevo **contribuye ítems** al modelo tipado (§4.1) declarando: fuente de dato real, mapeo a banda (§4.2), semántica `StatusBadge`, texto de asunto y acción(es). No toca la estructura de la pantalla.
- Mapeo previsto (se confirma en la fase de cada módulo):
  - **Nómina ADR-002 (F3):** "Liquidación en revisión" (`info`, banda Requiere acción/En curso según estado), "Período por aprobar" (rol ADMIN, editorial), "Empleados bloqueados por fail-secure" (`warning`).
  - **Contabilidad (F4, según superficie F0):** "Período contable por cerrar" (`neutral`/`warning`).
  - **Tesorería (P3):** "Pagos pendientes de dispersión" (`info`).
- Las **acciones rápidas** crecen igual: un módulo puede aportar un atajo, respetando el máximo de 4 visibles y la consciencia de rol.
- Regla de gobernanza: añadir un tipo de ítem o una banda nueva actualiza este documento (misma disciplina que DS §10 / AS §12).

---

## 13. Consistencia con los documentos rectores (verificación)

| Fuente        | Cómo se honra                                                                                                                                                                                                                                   |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plan Maestro  | Responde "¿qué hago hoy?" (principio 1/2); estado protagonista (2); confianza por evidencia sobria (3); fail-secure en superficie via estados honestos (4); calma operativa, sin alarmismo cromático (5); voz única en español, cero jerga (7). |
| Audit UX      | Cierra DASH-01/02/03 (elimina el dashboard-acuse); usa StatusBadge único (CON-02/ALERT-04/NOM-03); acciones no solo-hover (EXP-03); sin `window.confirm` (resolver usa toast); resuelve la deuda de frescura ALERT-01 con honestidad.           |
| Design System | Cero colores crudos (DS-I1); tokens de tipografía/estado/motion/radio; `StatusBadge`/`PageHeader`/`EmptyState`/`Toast` del roster §6.6; foco único §4.4; sin token `accent`.                                                                    |
| App Shell     | Anatomía de página §7; arquetipo `standard`; PageHeader dueño del `h1`; el conteo alimenta el indicador de Alertas del sidebar (§4.6); patrones globales de estados/feedback/permisos.                                                          |
| Exploration   | Dirección A con préstamos acotados D/C/E, exactamente como se aprobó.                                                                                                                                                                           |

---

## 14. Criterios de aceptación (verificables)

1. La pantalla muestra una única bandeja priorizada, agrupada en bandas por horizonte temporal; sin paneles de métricas ni tarjetas de módulos (DB-D1).
2. Todo ítem proviene de una fuente real (§4.1); cero endpoints nuevos.
3. Orden determinista según §4.2; bandas vacías no se renderizan (DB-D3).
4. Filas sin borde-lateral de color, sin enlace envolvente, con acciones siempre visibles y nombradas (DB-D4/D5, EXP-03).
5. Rol afecta solo acciones rápidas + énfasis editorial; el universo de ítems es idéntico (DB-D6).
6. Estados carga/vacío/sin-generar/error-total/error-parcial/refrescando/resolviendo implementados (§9); skeleton anatómico, empty que enseña, degradación parcial (DB-D8).
7. "Actualizar" usa las funciones de generación existentes; frescura visible; sin simular tiempo real (DB-D2).
8. Un solo `h1`; bandas `h2`; listas semánticas; `aria-live` en conteo/cambios; contraste AA verificado (§10).
9. Movimiento solo de estado, tokens DS, reduced-motion, sin secuencia de carga escalonada (§11, DB-D9).
10. Cero violaciones del lint DS §5 en el código del dashboard; `typecheck` y `build` verdes.

---

_Fin de DASHBOARD.md. Pendiente de aprobación antes de continuar con Employees._
