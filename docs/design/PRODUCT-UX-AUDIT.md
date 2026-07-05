# Auditoría UX del Producto — La Oficina Nítida

| Campo         | Valor                                                                                                    |
| ------------- | -------------------------------------------------------------------------------------------------------- |
| **Documento** | Auditoría UX/UI del producto actual (entregable F0)                                                      |
| **Fecha**     | 2026-07-03                                                                                               |
| **Rige**      | `docs/design/PLAN-MAESTRO-REDISENO.md` (documento rector aprobado)                                       |
| **Estado**    | Propuesto — pendiente de aprobación                                                                      |
| **Alcance**   | Diagnóstico de `apps/web` (frontend real). **No** propone soluciones, componentes, navegación ni diseño. |
| **Método**    | Lectura del código de cada ruta y componente, tokens (`globals.css`), shell y kit de UI.                 |

---

## 0. Cómo leer este documento

- Cada módulo se analiza con las 13 dimensiones pedidas (objetivo, usuarios, flujo, fortalezas, debilidades, UX, UI, IA, consistencia, accesibilidad, productividad, quick wins, riesgo de rediseño).
- **Todo hallazgo lleva una clasificación de severidad**, con un identificador estable (`A-01`, `EMP-03`, …) para poder referenciarlo desde el backlog y desde el rediseño posterior.
- **Ningún hallazgo propone solución.** "Quick win" describe una deuda de bajo esfuerzo/alto impacto, no la corrección concreta.

### Leyenda de severidad

| Símbolo | Nivel           | Criterio                                                                                   |
| ------- | --------------- | ------------------------------------------------------------------------------------------ |
| 🔴      | **Crítico**     | Rompe la confianza, contradice el dominio/ADR, o impide entender/operar. Prioridad máxima. |
| 🟠      | **Mayor**       | Fricción real, inconsistencia sistémica o barrera de accesibilidad frecuente.              |
| 🟡      | **Menor**       | Defecto localizado, pulido, microcopy puntual.                                             |
| 🔵      | **Observación** | No es defecto hoy; es contexto o riesgo a vigilar en el rediseño.                          |

### Hallazgos transversales (afectan a casi todos los módulos)

Estos se enuncian una vez aquí y se referencian por código en cada módulo, para no repetir el diagnóstico.

| ID        | Severidad | Hallazgo                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Evidencia                                                                                                                                                                                                                            |
| --------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **TR-01** | 🔴        | **El sistema de tokens existe pero se evade masivamente.** `globals.css` define una paleta neutra oklch coherente (`--background`, `--surface`, `--foreground`, `--primary`, `--destructive`, `--success`). Aun así hay **225 usos** de utilidades de color hardcodeadas (`bg-white`, `text-emerald-600`, `text-red-600`, `text-blue-600`, `text-amber-600`, `bg-green-50`, `text-violet-700`…) en páginas y features. La regla del 10 % y la paleta restringida de `DESIGN.md` no se cumplen. | grep 225 coincidencias en `app/` + `features/`                                                                                                                                                                                       |
| **TR-02** | 🟠        | **No existen tokens semánticos de estado.** La paleta solo tiene `--success` y `--destructive`; no hay `warning` ni `info`. Todo estado amarillo/azul (alertas WARNING/INFO, badges de contrato, pills de nómina) se codifica a mano por página, sin fuente única.                                                                                                                                                                                                                             | `globals.css` @theme; `alertas/page.tsx:32-36`                                                                                                                                                                                       |
| **TR-03** | 🟠        | **`focus:ring-accent` / `focus:border-accent` referencian un token inexistente.** La paleta define `--primary` y `--ring`, no `--accent`. Los `<select>` nativos usan `focus:ring-accent`, que no corresponde a ningún token de marca; el foco visible no es el del sistema.                                                                                                                                                                                                                   | `contratos/page.tsx:113`, `lotes/page.tsx:48`, `plantillas`, `alertas`                                                                                                                                                               |
| **TR-04** | 🔴        | **Diálogos de confirmación nativos (`window.confirm`) para acciones destructivas/de estado.** Desactivar empleado, desactivar sede, eliminar plantilla, eliminar documento, quitar del expediente, cambiar estado de contrato, **cerrar período de nómina**, eliminar cliente. Rompe la estética, no es accesible/marcable, bloquea el hilo y trata igual a "eliminar cliente" que a "cerrar período" (irreversible contable).                                                                 | 8 sitios: `employees-table.tsx:86`, `sedes-table.tsx:18`, `templates-table.tsx:147`, `generated-docs-table.tsx:96`, `expediente/page.tsx:205`, `contratos/[id]/page.tsx:61`, `nomina/periodos/page.tsx:148`, `clientes/page.tsx:175` |
| **TR-05** | 🟠        | **No hay sistema de notificaciones (toasts).** Las mutaciones (crear, editar, cambiar estado, resolver alerta, importar) tienen éxito o error en silencio o solo cerrando un panel; no hay confirmación visible ni feedback de error consistente. React Query está, pero el resultado no se comunica al usuario.                                                                                                                                                                               | ausencia transversal; ej. `sedes/page.tsx`, `alertas/page.tsx`                                                                                                                                                                       |
| **TR-06** | 🟠        | **No existe primitiva de PageHeader ni de Table compartida.** Cada página compone su propio encabezado (título+descripción+acciones) y sus propias tablas/listas con clases repetidas. La divergencia (tamaños de `h1`, colores, densidades) es consecuencia directa.                                                                                                                                                                                                                          | `components/ui/` tiene 7 primitivas; tablas ad hoc por feature                                                                                                                                                                       |
| **TR-07** | 🟠        | **`SideSheet` no cumple el contrato de diálogo accesible.** Tiene `role="dialog"` y `aria-modal` pero **sin focus trap, sin cierre con `Esc`, sin `aria-labelledby`/`describedby`, sin retorno de foco** al disparador. Es el contenedor de casi todos los formularios del producto.                                                                                                                                                                                                           | `components/ui/side-sheet.tsx:28-62`                                                                                                                                                                                                 |
| **TR-08** | 🟠        | **Inconsistencia ortográfica sistémica.** Tildes ausentes de forma aleatoria en superficie de usuario ("sesion", "generacion", "categoria", "informacion", "Cerrar sesion") conviviendo con texto correcto ("Nómina", "Facturación").                                                                                                                                                                                                                                                          | `app-shell.tsx`, `dashboard-home.tsx`, `profile-view.tsx`, `(auth)/layout.tsx`                                                                                                                                                       |
| **TR-09** | 🟠        | **Fuga de jerga interna a la interfaz de usuario.** "Motor interno de cálculo", "Dominio interno", "Tenant activo", "MVP Auth", "snapshots de cargo y salario", explicación de cookies HTTP-only y JWT. Lenguaje de desarrollador en pantallas de negocio.                                                                                                                                                                                                                                     | `nomina/page.tsx:32`, `facturacion/page.tsx:30`, `contratos/page.tsx:94`, `dashboard-home.tsx`, `app-shell.tsx:213`                                                                                                                  |
| **TR-10** | 🟡        | **Anchos de contenido y tamaños de título inconsistentes.** Contenedores oscilan entre `max-w-3xl`, `max-w-4xl`, `max-w-5xl`, `max-w-6xl` y `h1` entre `text-lg`, `text-2xl`, `text-[2rem]` sin regla. Empleados/Sedes usan `text-2xl`+`text-gray-900`; el resto `text-lg`+`text-foreground`.                                                                                                                                                                                                  | comparar `empleados/page.tsx:116` vs `contratos/page.tsx:92`                                                                                                                                                                         |
| **TR-11** | 🟠        | **Dos linajes visuales conviven.** Un grupo de pantallas usa tokens (`text-foreground`, `bg-surface`, `border-border`); otro usa Tailwind gris crudo (`text-gray-900`, `text-gray-500`, `border-gray-100`, `bg-white`). Empleados, su detalle, sedes y `SideSheet` pertenecen al linaje "gray"; contratos, nómina, alertas al linaje "token".                                                                                                                                                  | `empleados/[id]/page.tsx` (gray) vs `alertas/page.tsx` (token)                                                                                                                                                                       |
| **TR-12** | 🔵        | **La UI no es consciente de permisos.** Muestra el rol como badge pero navegación y acciones no se adaptan a ADMIN/OPERADOR/VIEWER. No es defecto funcional visible hoy, pero contradice least-privilege (SEC-001) y condiciona todo el rediseño.                                                                                                                                                                                                                                              | `app-shell.tsx`                                                                                                                                                                                                                      |

---

## 1. Autenticación (login · registro · recuperación)

- **Objetivo:** dar acceso seguro multiempresa (NIT + email + contraseña) y registrar nuevas empresas.
- **Usuarios:** cualquier usuario (ADMIN/OPERADOR) al inicio de sesión; ADMIN al registrar la empresa.
- **Flujo principal:** `(auth)/login` → NIT, email, contraseña → dashboard. Registro y recuperación como rutas hermanas.
- **Fortalezas:** es el módulo visualmente más cuidado y coherente; usa un sistema de copy centralizado (`auth-copy.ts`), `react-hook-form` + `zod`, `Suspense`, estados de éxito/error explícitos, clases propias (`auth-panel`, `auth-kicker`). Marca la vara de calidad que el resto del producto no alcanza.
- **Debilidades:** el pulido de esta sección **contrasta** con el interior de la app y crea una expectativa que las pantallas operativas incumplen (`AUTH-03`).

**Hallazgos**

| ID      | Sev | Dimensión     | Hallazgo                                                                                                                                                                                     |
| ------- | --- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AUTH-01 | 🟡  | Microcopy     | "Ahora puedes iniciar sesion" sin tilde en el estado de éxito (`login-form.tsx:47`). Instancia de TR-08.                                                                                     |
| AUTH-02 | 🔵  | UX            | El login pide NIT además de email — correcto por el modelo multiempresa, pero es fricción no explicada; el usuario podría no saber el NIT de memoria. Observación para research, no defecto. |
| AUTH-03 | 🔵  | Consistencia  | La calidad visual del panel de auth fija un estándar que el resto del producto deberá igualar; hoy es un outlier hacia arriba.                                                               |
| AUTH-04 | 🟡  | Accesibilidad | El brandmark "1" y textos decorativos usan `translate="no"`; falta verificar orden de foco y `aria-live` en los `Alert` de error/éxito (no confirmado como fallo, a validar).                |

- **IA:** correcta y aislada del shell (layout propio).
- **Productividad:** adecuada; el formulario es corto.
- **Quick wins:** AUTH-01.
- **Riesgo de rediseño:** **Bajo.** Es autocontenido; re-vestirlo con el sistema definitivo no toca lógica. Sirve como referencia de estilo, no como problema.

---

## 2. App Shell y Navegación global (transversal)

- **Objetivo:** contener la app, orientar la navegación entre módulos y mostrar contexto (empresa, usuario, rol).
- **Usuarios:** todos, en cada pantalla, todo el día. Es el marco de la experiencia diaria.
- **Flujo principal:** sidebar fijo con 13 ítems → header con título/descripción de página + empresa + rol.
- **Fortalezas:** estructura sólida (sidebar fijo + header sticky), estados activos calculados, skeleton de usuario, panel "contexto seguro", responsive a `lg`.

**Hallazgos**

| ID     | Sev | Dimensión                     | Hallazgo                                                                                                                                                                                                                                                          |
| ------ | --- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------- |
| NAV-01 | 🔴  | IA                            | **Navegación plana de 13 ítems sin agrupar** que mezcla trabajo diario, personas, documentos, motores, organización y espacio personal en una sola lista. No refleja el dominio ni escala a contabilidad/tesorería. (`app-shell.tsx:31-45`)                       |
| NAV-02 | 🔴  | IA / UX                       | **"Expediente" aparece deshabilitado como señuelo** (`href:'#expediente', enabled:false`) aunque el módulo existe y funciona dentro del detalle de empleado. Presenta como "no disponible" algo operativo. (`app-shell.tsx:44`)                                   |
| NAV-03 | 🟠  | IA                            | **Jerarquías del dominio no expresadas:** "Lotes" es hermano suelto de "Contratos"; "Plantillas" y "Generados" cuelgan sin agrupar bajo "Documentos"; "Perfil" ocupa la 2.ª posición del nav principal, por encima de módulos operativos. (`app-shell.tsx:33-43`) |
| NAV-04 | 🟠  | Consistencia / Mantenibilidad | **Doble sistema de títulos.** El header deriva `pageTitle`/`pageDescription` de una cadena de ~10 ternarios hardcodeada (`app-shell.tsx:52-93`) **y** cada página renderiza su propio `h1`. Dos títulos compiten y cada módulo nuevo obliga a editar el shell.    |
| NAV-05 | 🟠  | UX                            | **Subrutas reales inaccesibles desde el nav.** `nomina/periodos`, `facturacion/clientes                                                                                                                                                                           | productos | facturas` y el expediente solo se alcanzan por enlaces dentro del contenido; no hay navegación secundaria consistente. |
| NAV-06 | 🟡  | Microcopy                     | "Mesa de operaciones", "Cerrar sesion" (sin tilde), "MVP Auth" como badge permanente en el header, "Sesión segura" como fallback del nombre de empresa. Jerga/placeholder en superficie (TR-08/TR-09). (`app-shell.tsx:104,176,213`)                              |
| NAV-07 | 🔵  | Permisos                      | El nav no filtra por rol; todos ven todos los ítems. Instancia de TR-12.                                                                                                                                                                                          |
| NAV-08 | 🟡  | Accesibilidad                 | El ítem deshabilitado usa `<span aria-disabled>` sin explicar por qué; los estados activos dependen de contraste sutil (`shadow-[inset...]`) cuya suficiencia AA no está verificada.                                                                              |

- **UI:** consistente internamente, pero mezcla token y gris según la página que enmarca (TR-11).
- **Productividad:** la lista plana obliga a escanear 13 ítems; sin agrupación no hay memoria muscular.
- **Quick wins:** NAV-02 (quitar/activar el señuelo), NAV-06 (microcopy).
- **Riesgo de rediseño:** **Alto.** Es el componente más transversal; cualquier cambio de IA toca todas las pantallas. Pero es también el de mayor retorno. NAV-04 acopla shell y páginas: desacoplar títulos es prerrequisito de casi todo lo demás.

---

## 3. Dashboard / Inicio

- **Objetivo (declarado):** confirmar identidad, empresa y rol; mostrar un "mapa de crecimiento" de módulos.
- **Objetivo (esperado por el usuario):** responder "¿qué tengo que hacer hoy?".
- **Usuarios:** todos, es la primera pantalla tras el login.
- **Flujo principal:** entra → ve hero de bienvenida + tarjetas de sesión + lista de "módulos preparados" marcados como Pendiente.
- **Fortalezas:** limpio, buen uso de skeletons y jerarquía tipográfica; técnicamente maneja loading/error.

**Hallazgos**

| ID      | Sev | Dimensión          | Hallazgo                                                                                                                                                                                                                                                              |
| ------- | --- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DASH-01 | 🔴  | UX / Confianza     | **El dashboard contradice la realidad del producto.** Lista Empleados, Contratos, Expediente, Alertas, Facturación como "Pendiente" / "Próximas fases" cuando **todos están operativos**. La primera pantalla diaria desinforma. (`dashboard-home.tsx:20-46,126-160`) |
| DASH-02 | 🔴  | UX / Productividad | **No aporta ningún valor operativo.** No muestra vencimientos, alertas, nóminas en curso, lotes ni accesos al trabajo del día. Es una pantalla de estado de sesión, no un panel de trabajo.                                                                           |
| DASH-03 | 🟠  | Microcopy / IA     | **Habla el idioma del backend:** "El access token se renueva desde una cookie HTTP-only", "El tenant actual proviene del JWT", "empresa: aislada", "acceso: vigente". Contenido técnico donde el usuario espera su operación. (`dashboard-home.tsx:83-101,162-170`)   |
| DASH-04 | 🟡  | Microcopy          | "esta listo", "sesion", "modulos" sin tildes (TR-08).                                                                                                                                                                                                                 |
| DASH-05 | 🔵  | UX                 | El saludo usa `user?.nombre` con fallback "equipo"; correcto, pero es lo único personalizado en una pantalla que debería estar llena de datos del tenant.                                                                                                             |

- **UI:** correcta pero vacía de sustancia.
- **IA:** el dashboard debería ser el hub del día; hoy es una hoja informativa terminal.
- **Consistencia:** usa tokens (bien), pero su contenido no se parece a ninguna otra pantalla operativa.
- **Accesibilidad:** sin problemas graves detectados.
- **Quick wins:** DASH-04 (microcopy); DASH-01 (dejar de marcar como "Pendiente" lo que existe) es de bajo esfuerzo aunque la solución real es F2.
- **Riesgo de rediseño:** **Bajo en lo técnico** (casi no tiene lógica), **alto en lo estratégico** (define la experiencia diaria y depende de datos de otros módulos). Es el candidato #1 de mayor impacto visible.

---

## 4. Empleados (lista · alta/edición · importación)

- **Objetivo:** gestionar la planta: alta, edición, desactivación, búsqueda, importación masiva Excel (hasta 500).
- **Usuarios:** auxiliar administrativo/RRHH (uso diario intensivo).
- **Flujo principal:** lista con filtros → `SideSheet` de alta/edición → tabla; importación por `SideSheet` con plantilla, carga, validación y reporte de errores.
- **Fortalezas:** módulo funcionalmente rico y validado end-to-end; el flujo de importación tiene descarga de plantilla, validación previa y **reporte de errores fila/campo/mensaje** — el mejor tratamiento de lote del producto. Filtros de búsqueda/estado presentes.

**Hallazgos**

| ID     | Sev | Dimensión          | Hallazgo                                                                                                                                                                                                                                                                                           |
| ------ | --- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EMP-01 | 🟠  | Consistencia / UI  | Pertenece al **linaje "gray"** (`text-gray-900`, `text-gray-500`, `bg-white`, `border-gray-100`, `bg-green-50 text-green-700`), divergente del linaje token del resto (TR-01, TR-11). Título `text-2xl` frente al `text-lg` mayoritario (TR-10). (`empleados/page.tsx:116`, `employees-table.tsx`) |
| EMP-02 | 🟠  | UX / Productividad | **La paginación está congelada:** `const [page] = useState(1)` sin setter (`empleados/page.tsx:26`); con >20 empleados no hay forma de avanzar de página desde la UI. Barrera real para el segmento (50–300 empleados).                                                                            |
| EMP-03 | 🔴  | Accesibilidad / UX | Desactivar empleado usa `window.confirm` (TR-04). Acción de estado sensible resuelta con diálogo nativo. (`employees-table.tsx:86`)                                                                                                                                                                |
| EMP-04 | 🟠  | UX                 | La fila de la tabla no es navegable como un todo; para ver el detalle no hay enlace obvio desde la lista (las acciones son Editar/Desactivar). El detalle se alcanza sobre todo desde alertas, no desde la propia lista.                                                                           |
| EMP-05 | 🟡  | Consistencia       | El `<input type="file">` de importación es un dropzone **solo-click** (no soporta arrastrar-soltar pese a parecerlo visualmente). Expectativa visual ≠ comportamiento. (`empleados/page.tsx:179-199`)                                                                                              |
| EMP-06 | 🟡  | UX                 | El resultado de importación exitosa se muestra dentro del panel, pero no hay confirmación persistente (toast) ni refresco visible del conteo (TR-05).                                                                                                                                              |
| EMP-07 | 🔵  | IA                 | El subtítulo "Gestiona la nómina, contratos e información laboral" promete nómina y contratos desde una pantalla que no los enlaza.                                                                                                                                                                |

- **IA:** el empleado es el hub natural del dominio (contrato, expediente, sede, futuras liquidaciones) pero la lista no lo trata como tal.
- **Quick wins:** EMP-02 (paginación rota es casi un bug), EMP-05.
- **Riesgo de rediseño:** **Medio.** Flujos validados que conviene conservar; el riesgo está en re-vestir sin romper importación. Alto valor porque es la pantalla más usada.

---

## 5. Expediente digital (dentro de Empleado)

- **Objetivo:** ver y gestionar los documentos del empleado (`ExpedienteDoc`), con estadísticas por categoría.
- **Usuarios:** auxiliar administrativo.
- **Flujo principal:** desde detalle de empleado → "Expediente" → stats + lista de documentos con descarga/eliminación; los documentos entran automáticamente al generarse.
- **Fortalezas:** buen empty state explicativo, stats por categoría, formato de fecha/tamaño localizado, acciones on-hover.

**Hallazgos**

| ID     | Sev | Dimensión                     | Hallazgo                                                                                                                                                                                                                    |
| ------ | --- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EXP-01 | 🟠  | UI / Consistencia             | **7 colores de badge de categoría hardcodeados** (`bg-blue-50`, `bg-emerald-50`, `bg-cyan-50`, `bg-violet-50`, `bg-amber-50`, `bg-red-50`, `bg-gray-50`) sin fuente única (TR-01/TR-02). (`expediente/page.tsx:28-39`)      |
| EXP-02 | 🔴  | Accesibilidad                 | Eliminar documento usa `window.confirm('¿Quitar este documento del expediente?')` (TR-04). (`expediente/page.tsx:205`)                                                                                                      |
| EXP-03 | 🟠  | Accesibilidad / Productividad | **Acciones visibles solo en hover** (`opacity-0 group-hover:opacity-100`). Sin equivalente por teclado/foco: un usuario que navega con teclado o toca en tablet no descubre Descargar/Eliminar. (`expediente/page.tsx:183`) |
| EXP-04 | 🟡  | UX                            | Descargar abre el PDF en `window.open` a una URL construida en cliente; sin estado de carga ni manejo de fallo. (`expediente/page.tsx:189-194`)                                                                             |
| EXP-05 | 🔵  | IA                            | El expediente vive dentro del empleado (correcto) pero el nav lo presenta como módulo aparte deshabilitado (NAV-02); doble mensaje sobre dónde está.                                                                        |
| EXP-06 | 🟡  | Microcopy                     | Mezcla registro voseante ("Generá documentos…") con el resto del producto que usa "Gestiona/Ingresa" (tú). Inconsistencia de tratamiento (ver también ALERT-07, PER-…). (`expediente/page.tsx:145`)                         |

- **Consistencia:** el voseo ("Generá", "Usá") aparece solo en expediente, alertas y nómina; el resto tutea. Falta decisión de voz.
- **Quick wins:** EXP-06 (unificar tratamiento), EXP-01.
- **Riesgo de rediseño:** **Bajo-medio.** Componente contenido; el riesgo es la subida real de documentos (hoy solo entra vía generación) que puede cambiar con almacenamiento en producción.

---

## 6. Sedes

- **Objetivo:** CRUD de sedes/centros de trabajo con municipios DANE; base de la arquitectura multisede.
- **Usuarios:** ADMIN (configuración organizacional).
- **Flujo principal:** lista/tabla → `SideSheet` de alta/edición → activar/desactivar.
- **Fortalezas:** validado 10/10 flujos; maneja `isError` con estado dedicado; formulario con selector DANE.

**Hallazgos**

| ID     | Sev | Dimensión         | Hallazgo                                                                                                                                                                                               |
| ------ | --- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| SED-01 | 🟠  | Consistencia / UI | Linaje "gray" (`text-gray-900`, `text-gray-500`) y título `text-2xl`, como Empleados; divergente del resto (TR-10/TR-11). (`sedes/page.tsx:50`)                                                        |
| SED-02 | 🔴  | Accesibilidad     | Desactivar sede usa `window.confirm` (TR-04). (`sedes-table.tsx:18`)                                                                                                                                   |
| SED-03 | 🟡  | UX                | El error de mutación se muestra como banner rojo hardcodeado dentro del `SideSheet` (`border-red-200 bg-red-50 text-red-600`), patrón repetido pero no sistematizado (TR-05). (`sedes/page.tsx:83-87`) |
| SED-04 | 🔵  | IA                | Sedes es organizacional pero comparte nivel de nav con módulos operativos diarios; su frecuencia de uso es mucho menor.                                                                                |

- **Productividad:** adecuada para un catálogo de baja cardinalidad.
- **Quick wins:** SED-03 (unificar el banner de error).
- **Riesgo de rediseño:** **Bajo.** Catálogo estable y validado; re-vestir es directo.

---

## 7. Contratos (lista · detalle · cambio de estado)

- **Objetivo:** gestionar contratos laborales con snapshots de cargo/salario y su ciclo de estados (VIGENTE→VENCIDO/TERMINADO/RENOVADO).
- **Usuarios:** auxiliar administrativo, ADMIN.
- **Flujo principal:** lista con búsqueda/filtro → `SideSheet` de alta → detalle con transiciones de estado permitidas.
- **Fortalezas:** el detalle **modela correctamente las transiciones válidas** (`VALID_TRANSITIONS`) espejando el dominio; muestra snapshot, plantilla, lote, sede; buen empty/loading.

**Hallazgos**

| ID     | Sev | Dimensión          | Hallazgo                                                                                                                                                                                                                                               |
| ------ | --- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CON-01 | 🔴  | Accesibilidad / UX | El cambio de estado (acto de negocio con efectos: vencer/terminar/renovar) se confirma con `window.confirm('¿Cambiar estado a X?')` (TR-04). Ninguna explicación de consecuencias ni reversibilidad. (`contratos/[id]/page.tsx:61`)                    |
| CON-02 | 🟠  | UI / Consistencia  | Estados con **color hardcodeado y sin icono** (`estadoBadge`: emerald/red/gray/blue), distinto del lenguaje de estado de alertas, nómina y facturas. No hay un StatusBadge común (TR-02/TR-06). (`contratos/[id]/page.tsx:20-28`)                      |
| CON-03 | 🟠  | UX / Consistencia  | El alta usa `<select>` nativos sin estilar con `focus:ring-accent` (token inexistente, TR-03); la fecha usa `<input type="date">` nativo. Formulario funcional pero visualmente crudo frente a los formularios de auth. (`contratos/page.tsx:110-215`) |
| CON-04 | 🟠  | Productividad / UX | **La lista no expone paginación** pese a que el hook la soporta (`page/limit`); con muchos contratos no hay avance de página en la vista principal (a diferencia de Lotes, que sí la tiene). (`contratos/page.tsx`)                                    |
| CON-05 | 🟡  | Microcopy          | "Gestión de contratos laborales con snapshots de cargo y salario" — "snapshots" es jerga (TR-09). (`contratos/page.tsx:94`)                                                                                                                            |
| CON-06 | 🟡  | UX                 | El detalle no ofrece acción de generar documento/PDF del contrato (FASE 6C pendiente), pero tampoco comunica que ese paso existirá; el usuario puede buscarlo sin encontrarlo.                                                                         |
| CON-07 | 🔵  | IA                 | Contrato es hijo del empleado en el dominio, pero se navega como módulo independiente; la relación empleado↔contratos no es evidente desde ninguna de las dos pantallas.                                                                               |

- **Accesibilidad:** selects nativos (teclado ok) pero foco no tematizado (TR-03).
- **Quick wins:** CON-05, CON-02 (unificar con el futuro StatusBadge).
- **Riesgo de rediseño:** **Medio.** El modelo de transiciones es correcto y debe preservarse tal cual; el riesgo es alterar la semántica de estados al re-vestir. Alto valor por ser flujo central.

---

## 8. Lotes de contratos

- **Objetivo:** generación masiva de contratos (selección de empleados + plantilla + parámetros) y seguimiento del proceso por estado.
- **Usuarios:** auxiliar administrativo en el pico de contratación anual.
- **Flujo principal:** lista con búsqueda/filtro/paginación → `SideSheet` con selección múltiple de empleados → crear → detalle del lote.
- **Fortalezas:** **es el módulo con la paginación bien resuelta** (a imitar), estados de lote tipados (PENDIENTE→EN_PROCESO→COMPLETADO/CON_ERRORES/FALLIDO), selección múltiple con contador, validación de submit (nombre+plantilla+≥1 empleado), manejo de error de creación.

**Hallazgos**

| ID     | Sev | Dimensión          | Hallazgo                                                                                                                                                                                                                                  |
| ------ | --- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LOT-01 | 🟠  | UX / Productividad | La **selección de empleados es una lista de checkboxes con `max-h-48` scroll** sin buscador ni "seleccionar todos / por sede". Para el caso real (decenas o cientos de empleados) es lenta y propensa a error. (`lotes/page.tsx:273-298`) |
| LOT-02 | 🟠  | UI / Consistencia  | Selects con `selectClass` propia y `focus:ring-accent` (TR-03); error de creación como banner rojo hardcodeado (TR-05). (`lotes/page.tsx:47-48,187-191`)                                                                                  |
| LOT-03 | 🟡  | Accesibilidad      | Los checkboxes usan `<label>` envolvente (bien), pero la lista scrollable no anuncia su tamaño ni cambios de selección a lectores de pantalla (TR-05).                                                                                    |
| LOT-04 | 🟡  | UX                 | El estado "COMPLETADO_CON_ERRORES" se etiqueta "Con errores" en el filtro pero el lenguaje de estados del lote no comparte el StatusBadge del resto (TR-02).                                                                              |
| LOT-05 | 🔵  | IA                 | "Lotes" como ítem de nav hermano de "Contratos" (NAV-03) oscurece que un lote **produce** contratos; la relación causal no se ve.                                                                                                         |

- **Productividad:** el flujo es potente pero el selector de empleados es el cuello de botella del pico anual (LOT-01).
- **Quick wins:** LOT-02.
- **Riesgo de rediseño:** **Medio.** Flujo masivo crítico; su lógica de estados y validación debe conservarse. El selector de empleados es la oportunidad de mayor impacto en productividad.

---

## 9. Plantillas de documentos

- **Objetivo:** CRUD de plantillas con variables dinámicas (contrato, certificación, carta, memorando), duplicar, activar/desactivar, sembrar base.
- **Usuarios:** ADMIN/operador que configura el motor documental.
- **Flujo principal:** lista con búsqueda/filtro por tipo → tabla con acciones → `TemplateForm` (editor con variables) → detalle.
- **Fortalezas:** funcional completo (duplicar, toggle, seed de 4 plantillas base), filtro por tipo, editor enriquecido; usa tokens.

**Hallazgos**

| ID     | Sev | Dimensión         | Hallazgo                                                                                                                                                          |
| ------ | --- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PLT-01 | 🔴  | Accesibilidad     | Eliminar plantilla y sembrar base usan `window.confirm` (TR-04). (`templates-table.tsx:147`, `plantillas/page.tsx:85`)                                            |
| PLT-02 | 🟠  | UI / Consistencia | Select de tipo con `focus:ring-accent` (TR-03) y layout de toolbar propio (`flex-1` spacer) no sistematizado. (`plantillas/page.tsx:127-138`)                     |
| PLT-03 | 🟡  | IA                | "Plantillas" y "Generados" son dos ítems de nav sin agrupar bajo "Documentos" (NAV-03); la relación plantilla→documento generado no es visible en la navegación.  |
| PLT-04 | 🔵  | UX                | El seed de plantillas base es una acción potente escondida como botón secundario "Plantillas base"; su efecto (crea 4 registros) se explica solo en el `confirm`. |
| PLT-05 | 🔵  | Productividad     | La gestión de variables dinámicas (núcleo del valor) no se auditó a nivel del editor (`TemplateForm`); requiere revisión propia en el rediseño del módulo.        |

- **Quick wins:** PLT-02.
- **Riesgo de rediseño:** **Medio.** El editor de variables es sensible; re-vestir la lista es directo, pero el editor merece auditoría específica en su fase.

---

## 10. Documentos generados

- **Objetivo:** historial de documentos generados a partir de plantillas + empleados; ver y eliminar.
- **Usuarios:** auxiliar administrativo.
- **Flujo principal:** lista con búsqueda → tabla → ver detalle / descargar / eliminar.
- **Fortalezas:** simple y enfocado; usa tokens; búsqueda presente.

**Hallazgos**

| ID     | Sev | Dimensión     | Hallazgo                                                                                                                                                                      |
| ------ | --- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GEN-01 | 🔴  | Accesibilidad | Eliminar documento generado usa `window.confirm` (TR-04). (`generated-docs-table.tsx:96`)                                                                                     |
| GEN-02 | 🟠  | IA            | **No hay filtro por tipo, empleado ni estado**, solo búsqueda de texto; el historial documental crece sin dimensiones de corte, dificultando encontrar un documento concreto. |
| GEN-03 | 🟡  | Consistencia  | Sin paginación visible en la página (el hook usa `limit:20`); mismo patrón de listas sin control de avance (EMP-02/CON-04).                                                   |
| GEN-04 | 🔵  | UX            | La relación con el expediente (el mismo PDF vive en ambos sitios) no se comunica; el usuario podría no entender por qué un documento aparece en dos lugares.                  |

- **Quick wins:** GEN-01 (parte de TR-04).
- **Riesgo de rediseño:** **Bajo.** Lista sencilla; re-vestir directo.

---

## 11. Alertas

- **Objetivo:** seguimiento del ciclo de vida contractual: vencimientos y documentos faltantes, con severidad y resolución.
- **Usuarios:** auxiliar administrativo, ADMIN — es uno de los **jobs centrales** del cliente (preavisos).
- **Flujo principal:** stats → filtros (estado/severidad) → lista de alertas con severidad, empleado enlazado, resolver; botones para generar alertas de contratos/docs faltantes.
- **Fortalezas:** stats (abiertas/críticas/resueltas), iconos por severidad, enlace directo al empleado, filtros, empty state, resolución inline.

**Hallazgos**

| ID       | Sev | Dimensión         | Hallazgo                                                                                                                                                                                                                         |
| -------- | --- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ALERT-01 | 🟠  | UX / IA           | **Las alertas se generan manualmente** con botones "Docs faltantes" / "Contratos"; el usuario debe recordar pulsarlos para que aparezcan. Un job de vigilancia que exige acción manual del vigilado. (`alertas/page.tsx:82-109`) |
| ALERT-02 | 🟠  | UX                | **Lista plana sin priorización real:** las alertas críticas no se separan ni ordenan por urgencia/vencimiento; severidad es solo un badge de color. No responde "¿qué vence primero?". (`alertas/page.tsx:175-222`)              |
| ALERT-03 | 🟠  | Productividad     | **Sin acción directa desde la alerta** (renovar contrato, generar documento faltante). Resolver solo marca como resuelta; el trabajo real ocurre en otra pantalla. (`alertas/page.tsx:209-218`)                                  |
| ALERT-04 | 🟠  | UI / Consistencia | Severidades con color hardcodeado (`SEVERITY_COLORS` blue/amber/red) y etiquetas en inglés crudo ("INFO", "WARNING", "CRITICAL") mostradas al usuario. (`alertas/page.tsx:32-36,188`)                                            |
| ALERT-05 | 🟡  | UX                | Las alertas resueltas se muestran con `opacity-50` en la misma lista; no hay separación clara resuelto/abierto más allá del filtro.                                                                                              |
| ALERT-06 | 🟡  | UI                | El color es el **único** portador de severidad en el badge (el icono ayuda, pero la etiqueta es el enum en inglés); riesgo de estado-por-color (TR-02).                                                                          |
| ALERT-07 | 🟡  | Microcopy         | Voseo ("Usá los botones superiores") inconsistente con el tuteo mayoritario (EXP-06). (`alertas/page.tsx:169`)                                                                                                                   |

- **IA:** siendo un job central, su peso en la navegación y su capacidad de acción están por debajo de su importancia.
- **Quick wins:** ALERT-04/ALERT-07 (idioma/microcopy).
- **Riesgo de rediseño:** **Medio-alto en valor.** Conservar la generación y resolución; el rediseño de priorización y acción directa es donde más se gana. No tocar la semántica de severidad del dominio.

---

## 12. Nómina (dashboard · períodos · detalle de período)

- **Objetivo (UI actual):** motor interno de cálculo con períodos DRAFT/CLOSED, generación de liquidaciones y totales.
- **Objetivo (arquitectura aprobada ADR-002):** ProcesoNómina con 7 estados, revisión/aprobación con segregación, congelamiento inmutable, fail-secure, desprendibles.
- **Usuarios:** ADMIN (aprobar/cerrar), revisor, auxiliar (calcular).
- **Flujo principal actual:** dashboard con contadores → lista de períodos → crear → generar → cerrar → detalle con runs y conceptos.
- **Fortalezas:** dashboard con totales devengos/deducciones/neto formateados en COP; detalle con desglose por empleado y conceptos; máquina simple funcionando.

**Hallazgos**

| ID      | Sev | Dimensión          | Hallazgo                                                                                                                                                                                                                                                                                                                    |
| ------- | --- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NOM-01  | 🔴  | UX / Dominio       | **La UI refleja el modelo N2 obsoleto (DRAFT/CLOSED), no el aprobado.** No existe revisión/aprobación, ni congelamiento, ni estados intermedios, ni bloqueos fail-secure, ni segregación revisor≠aprobador. Diseñar sobre este modelo consolidaría el diseño equivocado (ADR-002 §6). (`nomina/periodos/page.tsx:117-155`)  |
| NOM-02  | 🔴  | UX / Confianza     | **Acciones irreversibles sin la ceremonia debida.** "Cerrar período" (efecto contable) se dispara con `window.confirm('¿Cerrar este período?')` (TR-04) — el acto más delicado del módulo con el diálogo más pobre. (`nomina/periodos/page.tsx:148`)                                                                        |
| NOM-02b | 🟠  | UX                 | "Generar" y "Cerrar" son botones ghost pequeños del mismo peso visual, pese a tener consecuencias muy distintas (calcular vs. sellar). Sin jerarquía de riesgo. (`nomina/periodos/page.tsx:131-154`)                                                                                                                        |
| NOM-03  | 🟠  | UI / Consistencia  | **Estado por color puro y hardcodeado:** devengos verde, deducciones rojo, neto azul repetidos en dashboard y detalle con `text-emerald-600/red-600/blue-600` sin token (TR-01/TR-02). El estado del período (borrador/cerrado) usa otra convención de color aún. (`nomina/page.tsx:71-88`, `periodos/[id]/page.tsx:47-70`) |
| NOM-04  | 🟠  | UX / Productividad | El detalle de período **no ofrece acción** (no se puede aprobar, revisar, exportar desprendible ni reliquidar desde ahí); es solo lectura. La liquidación por empleado no es navegable a un desprendible. (`periodos/[id]/page.tsx`)                                                                                        |
| NOM-05  | 🟡  | IA                 | El acceso a `nomina/periodos` es un botón dentro del dashboard de nómina, no un ítem de nav (NAV-05).                                                                                                                                                                                                                       |
| NOM-06  | 🟡  | Microcopy          | "Motor interno de cálculo y gestión de nómina", "Gestioná los períodos", pills de concepto EARNING/DEDUCTION por color. Jerga (TR-09) + voseo (EXP-06). (`nomina/page.tsx:32`, `periodos/page.tsx:58`)                                                                                                                      |
| NOM-07  | 🔵  | Riesgo temporal    | P1 (núcleo de liquidación) está por implementarse; **la especificación UX de los nuevos estados no existe.** Si P1 avanza sin ella, se improvisará la experiencia de aprobación/congelamiento.                                                                                                                              |

- **Accesibilidad:** conceptos y totales dependen de color (verde/rojo) sin etiqueta textual de signo más allá de `+`/`-`.
- **Quick wins:** NOM-06 (microcopy); el resto es rediseño de fondo, no quick win.
- **Riesgo de rediseño:** **Alto y con ventana de tiempo.** No se debe pulir la UI actual: se debe diseñar la experiencia del modelo ADR-002 **antes** de que P1-U9 (aprobación) y P1-U10 (desprendible) se implementen. Es el punto de coordinación diseño↔backend más sensible del proyecto.

---

## 13. Facturación (dashboard · clientes · productos · facturas)

- **Objetivo:** dominio de clientes, productos y facturas; base para facturación electrónica futura (Matías API/DIAN).
- **Usuarios:** contratista/pequeña empresa (cliente secundario), auxiliar.
- **Flujo principal:** dashboard con contadores → sub-secciones clientes/productos/facturas; factura con ítems, cliente, número, estados.
- **Fortalezas:** dashboard con KPIs (clientes, emitidas, borrador, total facturado); CRUD de clientes/productos; factura con ítems dinámicos que autocompletan desde producto.

**Hallazgos**

| ID     | Sev | Dimensión         | Hallazgo                                                                                                                                                                                                                                                                                  |
| ------ | --- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FAC-01 | 🟠  | UI / Consistencia | Dashboard con KPIs en colores hardcodeados (emerald/amber/blue) y `bg-white`; el formulario de factura usa `<select>`/`<input>` **sin clases de token** (`border` crudo, `rounded-md border px-3`), el más crudo del producto. (`facturacion/page.tsx:44-66`, `facturas/page.tsx:94-119`) |
| FAC-02 | 🔴  | Accesibilidad     | Eliminar cliente usa `window.confirm('¿Eliminar?')` — además con copy mínimo sin contexto (TR-04). (`clientes/page.tsx:175`)                                                                                                                                                              |
| FAC-03 | 🟠  | UX                | La factura usa **formularios inline expandibles** (`showForm` toggle) en lugar del `SideSheet` que el resto del producto usa para alta/edición; inconsistencia de patrón de creación. (`facturas/page.tsx:34,93`)                                                                         |
| FAC-04 | 🟠  | UX / Riesgo       | **Numeración de factura manual** (`numero: 'FAC-001'` como input de texto libre). El propio START_HERE marca la numeración atómica como riesgo #2; exponerla como texto libre en UI invita a errores/duplicados. (`facturas/page.tsx:112-117`)                                            |
| FAC-05 | 🟠  | IA                | El dashboard de facturación enlaza a sus 3 subsecciones con tarjetas "Clientes →/Productos →/Facturas →", pero esas subsecciones no están en el nav (NAV-05); la navegación depende del contenido.                                                                                        |
| FAC-06 | 🟡  | UI                | Estados de factura (EMITIDA/BORRADOR/…) con su propio esquema de color/icono, cuarta convención de estado distinta (contrato, alerta, período, factura) — refuerza la ausencia de StatusBadge común (TR-02/TR-06).                                                                        |
| FAC-07 | 🟡  | Microcopy         | "Dominio interno de clientes, productos y facturas" — jerga (TR-09). (`facturacion/page.tsx:30`)                                                                                                                                                                                          |
| FAC-08 | 🔵  | Riesgo            | La integración real Matías API/DIAN no está; los flujos de emisión pueden cambiar sustancialmente. Diseñar en profundidad antes de esa integración es prematuro.                                                                                                                          |

- **Quick wins:** FAC-07, FAC-06 (alinear al StatusBadge común).
- **Riesgo de rediseño:** **Medio-alto.** Conviene re-vestir superficialmente ahora y reservar el rediseño profundo para cuando la integración electrónica defina los flujos reales (coherente con el Plan Maestro: facturación "para el final").

---

## 14. Identidad corporativa (Configuración)

- **Objetivo:** gestionar la marca del tenant (representante legal, logo, firma) usada en documentos.
- **Usuarios:** ADMIN.
- **Flujo principal:** ver branding → editar representante → subir logo/firma.
- **Fortalezas:** funcional; maneja loading, edición inline y subida de imágenes.

**Hallazgos**

| ID     | Sev | Dimensión        | Hallazgo                                                                                                                                                                                                                                               |
| ------ | --- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| IDN-01 | 🟡  | UI / Rendimiento | Uso de `<img>` nativo para logo/firma (2 warnings de build pre-existentes documentados en PROJECT_STATE); no crítico pero señal de deuda.                                                                                                              |
| IDN-02 | 🟠  | UX               | Subida de imágenes dispara la mutación **inmediatamente al seleccionar archivo** (`onChange → mutate`), sin previsualización de confirmación ni validación visible de formato/tamaño en la UI (aunque el backend valide). (`identidad/page.tsx:49-55`) |
| IDN-03 | 🟡  | IA               | "Identidad" está en el nav principal como ítem suelto; es configuración de baja frecuencia mezclada con módulos diarios (NAV-03).                                                                                                                      |
| IDN-04 | 🔵  | Consistencia     | Es una de las pantallas de "configuración", categoría que hoy no existe como agrupación; su ubicación es incidental.                                                                                                                                   |

- **Quick wins:** ninguno de bajo riesgo evidente más allá de microcopy.
- **Riesgo de rediseño:** **Bajo.** Pantalla de configuración contenida.

---

## 15. Perfil

- **Objetivo:** mostrar credencial del usuario (nombre, email, empresa, rol) y contexto de trabajo.
- **Usuarios:** todos.
- **Flujo principal:** ver credencial + contexto (solo lectura).
- **Fortalezas:** pantalla pulida (usa clases propias `profile-hero`, `profile-avatar`), avatar con iniciales, jerarquía cuidada.

**Hallazgos**

| ID     | Sev | Dimensión | Hallazgo                                                                                                                                                                                                           |
| ------ | --- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PER-01 | 🟠  | UX / IA   | **Perfil es de solo lectura:** no permite cambiar contraseña, editar datos ni gestionar la sesión desde aquí, pese a ocupar la 2.ª posición del nav. Alta visibilidad, baja utilidad. (`profile-view.tsx`)         |
| PER-02 | 🟡  | Microcopy | "confirma quien opera, en que empresa trabaja y que nivel de acceso" — sin tildes (TR-08) y con tono explicativo-defensivo ("sin exponer controles técnicos") que delata jerga (TR-09). (`profile-view.tsx:49,70`) |
| PER-03 | 🔵  | IA        | Perfil como ítem principal del nav (NAV-03) compite con módulos operativos; su frecuencia real de uso es baja.                                                                                                     |

- **Quick wins:** PER-02.
- **Riesgo de rediseño:** **Bajo.** Contenido, sin lógica compleja.

---

## 16. Sistema visual y fundaciones (transversal)

- **Objetivo:** dar consistencia visual, tokens, componentes y voz a todo el producto.
- **Estado:** `DESIGN.md` define north star y reglas pero deja tokens "to be resolved" y componentes vacíos; `globals.css` **sí** resolvió una paleta neutra oklch, pero sin capa semántica y masivamente evadida.

**Hallazgos** (consolidan los transversales TR-01…TR-12)

| ID     | Sev | Dimensión       | Hallazgo                                                                                                                                                                         |
| ------ | --- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SYS-01 | 🔴  | Consistencia    | Paleta definida pero **evadida en 225 puntos** con colores Tailwind crudos (TR-01).                                                                                              |
| SYS-02 | 🟠  | Consistencia    | Sin tokens semánticos de estado (warning/info) → cada módulo inventa su color de estado (TR-02).                                                                                 |
| SYS-03 | 🟠  | Consistencia    | `focus:ring-accent` apunta a un token inexistente; el foco no es el de marca (TR-03).                                                                                            |
| SYS-04 | 🟠  | Componentes     | Kit de 7 primitivas; faltan PageHeader, Table, Select, Dialog/Confirm, Tabs, Toast, DatePicker, EmptyState, StatusBadge, Pagination — por eso cada página los reinventa (TR-06). |
| SYS-05 | 🔴  | Accesibilidad   | `window.confirm` como patrón de confirmación en 8 flujos, incluidos actos irreversibles (TR-04).                                                                                 |
| SYS-06 | 🟠  | Accesibilidad   | `SideSheet` (contenedor de casi todos los formularios) sin focus trap / Esc / labelledby / retorno de foco (TR-07).                                                              |
| SYS-07 | 🟠  | Feedback        | Sin sistema de toasts; mutaciones sin confirmación/error visible consistente (TR-05).                                                                                            |
| SYS-08 | 🟠  | Voz y microcopy | Tildes inconsistentes (TR-08) + jerga interna (TR-09) + mezcla tuteo/voseo (EXP-06). Sin glosario de dominio ni guía de voz.                                                     |
| SYS-09 | 🟡  | Consistencia    | Dos linajes visuales (gray vs token) y escalas de título/ancho sin regla (TR-10/TR-11).                                                                                          |
| SYS-10 | 🔵  | Permisos        | La UI no refleja RBAC (TR-12); condiciona el diseño de nav y acciones.                                                                                                           |

- **Riesgo de rediseño:** **Fundacional.** Nada se rediseña con consistencia hasta resolver tokens + kit + voz. Es prerrequisito de F1 y de todos los módulos.

---

## 17. Backlog priorizado de deuda UX

Ordenado por severidad y por efecto de palanca (los transversales primero, porque cada uno cierra deuda en varios módulos). Este backlog es la base para el Design System (F1) y el rediseño por módulo (F2+). **No incluye soluciones.**

### 🔴 Críticos (bloquean confianza, dominio o accesibilidad)

| #   | ID(s)                     | Deuda                                                                                                                           | Alcance                     |
| --- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| 1   | DASH-01, DASH-02, DASH-03 | Dashboard desinforma (módulos "Pendiente"), no aporta valor operativo y habla en jerga de backend.                              | Dashboard                   |
| 2   | NAV-01, NAV-02            | Navegación plana de 13 ítems sin jerarquía de dominio; ítem señuelo deshabilitado ("Expediente").                               | Shell (transversal)         |
| 3   | TR-04 / SYS-05            | `window.confirm` para acciones destructivas e **irreversibles** (incluye cerrar período de nómina).                             | 8 módulos                   |
| 4   | NOM-01, NOM-02, NOM-07    | UI de nómina refleja el modelo N2 obsoleto, no ADR-002; actos irreversibles sin ceremonia; falta especificación UX antes de P1. | Nómina (ventana de tiempo)  |
| 5   | TR-01 / SYS-01            | Sistema de tokens evadido en 225 puntos; paleta y regla del 10 % incumplidas.                                                   | Transversal / Design System |

### 🟠 Mayores (fricción sistémica, inconsistencia, barreras frecuentes)

| #   | ID(s)                         | Deuda                                                                                                          | Alcance                         |
| --- | ----------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| 6   | NAV-04                        | Doble sistema de títulos (shell hardcodeado vs. `h1` por página); acopla shell y módulos.                      | Shell                           |
| 7   | TR-02, TR-06 / SYS-02, SYS-04 | Sin tokens semánticos de estado ni StatusBadge/Table/PageHeader comunes → 4+ convenciones de estado distintas. | Transversal                     |
| 8   | TR-07 / SYS-06                | `SideSheet` sin contrato de diálogo accesible.                                                                 | Transversal (formularios)       |
| 9   | TR-05 / SYS-07                | Sin toasts; feedback de mutaciones inconsistente.                                                              | Transversal                     |
| 10  | TR-08, TR-09 / SYS-08         | Ortografía inconsistente + jerga interna + tuteo/voseo mezclados.                                              | Transversal                     |
| 11  | EMP-02, CON-04, GEN-03        | Paginación ausente o congelada en listas de alta cardinalidad.                                                 | Empleados, Contratos, Generados |
| 12  | ALERT-01, ALERT-02, ALERT-03  | Alertas manuales, sin priorización por urgencia, sin acción directa.                                           | Alertas                         |
| 13  | LOT-01                        | Selector de empleados del lote sin buscador/selección masiva (cuello de botella del pico anual).               | Lotes                           |
| 14  | TR-11, TR-03 / SYS-09, SYS-03 | Dos linajes visuales conviven; foco apunta a token inexistente.                                                | Transversal                     |
| 15  | NAV-03, NAV-05                | Jerarquías de dominio no expresadas; subrutas inaccesibles desde el nav.                                       | Shell                           |
| 16  | FAC-01, FAC-03, FAC-04        | Facturación con formularios más crudos, patrón de creación divergente y numeración manual riesgosa.            | Facturación                     |
| 17  | EXP-03                        | Acciones del expediente solo en hover (sin teclado/táctil).                                                    | Expediente                      |
| 18  | CON-01, CON-02                | Cambio de estado de contrato sin ceremonia ni StatusBadge común.                                               | Contratos                       |
| 19  | IDN-02                        | Subida de logo/firma sin previsualización ni validación visible.                                               | Identidad                       |
| 20  | PER-01                        | Perfil de solo lectura con alta visibilidad de nav y baja utilidad.                                            | Perfil                          |

### 🟡 Menores (pulido localizado)

| #   | ID(s)                                            | Deuda                                                           |
| --- | ------------------------------------------------ | --------------------------------------------------------------- |
| 21  | TR-10 / SYS-09                                   | Escalas de título y anchos de contenedor sin regla.             |
| 22  | EMP-05                                           | Dropzone de importación solo-click aunque parece drag-and-drop. |
| 23  | EXP-06, ALERT-07, NOM-06                         | Voseo puntual inconsistente con el tuteo mayoritario.           |
| 24  | ALERT-04, ALERT-06                               | Severidades mostradas como enum inglés + estado-por-color.      |
| 25  | CON-05, FAC-07, PER-02, NAV-06, DASH-04, AUTH-01 | Microcopy: jerga y tildes puntuales.                            |
| 26  | GEN-02                                           | Historial de generados sin filtros de corte.                    |
| 27  | PLT-02, LOT-02, SED-03                           | Banners de error y selects hardcodeados no sistematizados.      |
| 28  | IDN-01                                           | `<img>` nativo con warnings de build.                           |

### 🔵 Observaciones (contexto/riesgo para el rediseño, no defecto hoy)

| #   | ID(s)                                           | Nota                                                                                                                                             |
| --- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 29  | TR-12 / SYS-10, NAV-07                          | La UI no refleja RBAC; condiciona nav y acciones del rediseño.                                                                                   |
| 30  | NOM-07, FAC-08                                  | Nómina y facturación tienen fases funcionales por venir; diseñar su profundidad antes es prematuro salvo la especificación de estados de nómina. |
| 31  | AUTH-02, EMP-07, CON-07, EXP-05, GEN-04, PLT-05 | Puntos que requieren research o auditoría específica del módulo en su fase.                                                                      |
| 32  | AUTH-03                                         | El panel de auth fija un estándar de calidad que el interior deberá igualar.                                                                     |

---

## 18. Lectura del backlog para las fases siguientes

- Los ítems **1–5 (🔴)** y **6–10 (🟠 transversales)** son materia de **F1 (Fundaciones)**: tokens, kit de componentes, shell, voz. Resolverlos cierra deuda en cascada.
- Los ítems **11–20** son materia de **F2 (Núcleo diario)** módulo por módulo, cada uno auditable contra los tres contratos de consistencia del Plan Maestro.
- El ítem **4 (Nómina)** es materia de **F3** con la restricción temporal ya señalada: su especificación UX debe preceder a P1-U9/U10.
- Facturación (**16**) se re-viste ahora y se rediseña a fondo cuando la integración electrónica defina los flujos (F3/F4).
- Las observaciones **29–32** alimentan las preguntas abiertas de F0 que el Plan Maestro dejó para decisión del dueño del producto.

---

_Fin de la Auditoría UX del Producto. Pendiente de aprobación antes de continuar F0._
