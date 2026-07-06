# AUTH-EXPERIENCE.md — Especificación de la experiencia de entrada

| Campo                | Valor                                                                                                                                                                                                 |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Documento**        | Especificación de diseño implementable de la experiencia de entrada al producto (F2 · rama `feat/f2-auth-design`)                                                                                     |
| **Fecha**            | 2026-07-06                                                                                                                                                                                            |
| **Estado**           | Propuesto — pendiente de aprobación                                                                                                                                                                   |
| **Rige**             | `PLAN-MAESTRO-REDISENO.md` (rector) · `PRODUCT-UX-AUDIT.md` (deuda, IDs citados) · `DESIGN-SYSTEM.md` (DS) · `APP-SHELL.md` (AS) · `DASHBOARD.md` (precedente de formato)                             |
| **Ámbito**           | Landing (solo contratos de conexión), inicio de sesión, registro de empresa, recuperación de contraseña y estados especiales de acceso. **No** contiene código, componentes, React, Tailwind ni HTML. |
| **Pregunta rectora** | **¿Puede una persona llegar desde la landing hasta su oficina —o recuperar un acceso perdido— sin ayuda externa, sin callejones sin salida y sin perder la confianza en el camino?**                  |

Convención: decisiones numeradas `AX-Dn`. Todo flujo especificado se apoya en capacidades backend **existentes y verificadas** (§0); lo que no tiene backend se marca **RESERVADO** y no se implementa (lección AS-D5: cero señuelos). Todo valor visual proviene de tokens DS; cero colores crudos.

---

## 0. Hechos de partida (verificados en código)

| #   | Hecho                                                                                                                                                                                                                                                                                                                                                                         | Consecuencia de diseño                                                                                                                                                                          |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1  | La sesión es mono-empresa por NIT + correo + contraseña (`POST /auth/login`); roles `ADMIN`/`OPERADOR`; refresh por cookie HTTP-only con renovación automática (`use-auth.ts`, `auth-client`).                                                                                                                                                                                | El NIT es parte permanente de la ceremonia de entrada; la experiencia debe hacerlo fácil de recordar, no ocultarlo (AUTH-02).                                                                   |
| H2  | El registro (`POST /auth/register`) crea Tenant + usuario ADMIN en un solo paso (8 campos) y redirige a `/login?registered=1` **sin** iniciar sesión automáticamente (`use-auth.ts:35`).                                                                                                                                                                                      | El flujo registro → login manual se conserva (cambiarlo sería cambio de backend, fuera de alcance §0 del Plan Maestro).                                                                         |
| H3  | La recuperación de contraseña tiene **backend completo** (FASE 7A): `POST /auth/forgot-password {tenantNit, email}` y `POST /auth/reset-password`; token de un solo uso que vence en 1 hora; respuestas genéricas anti-enumeración; al completar el reset se revocan todas las sesiones abiertas. El email real existe (7B.1, Resend) con modo degradado si falta la API key. | La experiencia de recuperación se diseña **completa** sobre API existente; cero endpoints nuevos.                                                                                               |
| H4  | **No existe frontend de recuperación**: no hay ruta, y el login no ofrece "¿Olvidaste tu contraseña?" (`login-form.tsx`). Un usuario que olvida su contraseña hoy no tiene salida en la interfaz.                                                                                                                                                                             | Es el vacío más grave de la experiencia de entrada; su cierre es el corazón de esta especificación (§6).                                                                                        |
| H5  | **No existe sistema de invitaciones** en el backend (cero endpoints, cero modelos en `apps/api/src/auth`). Tampoco existe UI de gestión de usuarios.                                                                                                                                                                                                                          | La invitación se especifica como flujo **RESERVADO** (§7.2): contrato listo, implementación prohibida hasta que el backend exista.                                                              |
| H6  | Los mensajes de error del login backend **distinguen casos**: "Credenciales inválidas (empresa no encontrada)" (NIT inexistente), "La empresa está inactiva…" (400), "El usuario está inactivo." y "Credenciales inválidas." Además, `user.activo` se valida **antes** de comparar la contraseña (`auth.service.ts:95-122`).                                                  | Fuga de enumeración en tensión con el diseño anti-enumeración de 7A. La UI aplica su propio contrato de mensajes (§9.2) y la corrección backend se registra como deuda coordinada (§12, R1/R2). |
| H7  | El middleware redirige a `/login` sin motivo ni retorno, y su matcher solo cubre `/`, `/login`, `/registro`, `/dashboard/*`, `/perfil/*` — el resto de rutas privadas (`/empleados`, `/nomina`, …) no pasa por él (`middleware.ts:33`).                                                                                                                                       | La expiración de sesión hoy es silenciosa e inconsistente. §7.1 define el contrato de expiración y retorno.                                                                                     |
| H8  | La landing está completa (12 secciones) con lenguaje visual propio anterior al sistema (`landing-*`, exento del lint DS hasta F5). Su CTA primario es "Solicitar demo gratuita"; enlaza a `/login` desde el nav y el footer; **no** enlaza a `/registro`.                                                                                                                     | Esta especificación **no rediseña la landing** (ámbito F5); fija únicamente sus contratos de conexión con la entrada (§4).                                                                      |
| H9  | El panel de auth es el módulo visualmente más cuidado del producto (AUTH-03: "fija la vara"), con copy centralizado (`auth-copy.ts`). Pero contiene jerga técnica en superficie ("Tenant", "Refresh protegido", "Cookie HTTP-only", "Roles ADMIN y OPERADOR") y tildes ausentes ("sesion", "Digito", "Razon social") — TR-08/TR-09/AUTH-01.                                   | La estructura y calidad se **conservan**; el contenido verbal se reescribe por completo (§8, §10).                                                                                              |
| H10 | No existe modo de mantenimiento ni patrón global de error de red en el frontend.                                                                                                                                                                                                                                                                                              | Mantenimiento se especifica como patrón **RESERVADO** (§7.6); el error de red se resuelve con patrones de formulario existentes (§7.7).                                                         |

---

## 1. Principios de la experiencia de entrada

Extienden los diez del Plan Maestro (§5); no los repiten.

1. **La entrada es la primera promesa.** El panel de auth ya fija el estándar de calidad del producto (AUTH-03); todo lo que el usuario ve antes del dashboard promete lo que el interior debe cumplir. La entrada nunca puede ser más pulida que honesta: no promete módulos, velocidad ni seguridad que el producto no dé.
2. **La seguridad se comunica como tranquilidad, no como implementación.** El usuario objetivo (auxiliar administrativo, no técnico) necesita saber que sus datos están aislados y su sesión protegida; no necesita saber cómo (cookies, tokens, JWT). Toda señal de seguridad se expresa en lenguaje de confianza (§8.3).
3. **Anti-enumeración en pantalla, especificidad por correo.** Ante un tercero que prueba datos, la pantalla responde siempre lo mismo; ante el usuario legítimo, la información específica viaja por el canal que ya demostró poseer (su correo). Es el contrato que 7A estableció en backend, elevado a regla de experiencia (§9.3).
4. **Sin callejones sin salida.** Todo estado de error o excepción ofrece exactamente una salida accionable y visible: reintentar, solicitar un enlace nuevo, contactar al responsable correcto. Herencia directa del principio fail-secure del Plan Maestro (§5.4) aplicada fuera de la sesión.
5. **Cero señuelos, también en la entrada** (AS-D5). Los flujos sin capacidad backend (invitación, mantenimiento) se especifican como contrato para el futuro pero no producen ni una pantalla, ni un enlace, ni un "próximamente".
6. **El NIT es el nombre de la puerta.** El modelo multiempresa pide un dato que el usuario no siempre recuerda (AUTH-02). En lugar de esconder la fricción, la experiencia la amortigua: explica qué NIT es, lo recuerda por dispositivo y lo prellena en cada retorno (§5.3).

---

## 2. Mapa de la experiencia — arquitectura de información

### 2.1 Rutas de la superficie de entrada

```
/                      Landing pública                    EXISTE (contrato §4)
/login                 Inicio de sesión                   EXISTE (rediseño verbal + estados §5)
/registro              Registro de empresa                EXISTE (rediseño verbal + errores §6... ver §6)
/recuperar             Solicitar recuperación             NUEVA — sobre backend 7A existente (§6)
/restablecer           Definir nueva contraseña (token)   NUEVA — sobre backend 7A existente (§6)
/invitacion/[token]    Aceptar invitación                 RESERVADA — sin backend, no se implementa (§7.2)
```

**AX-D1 — Los estados especiales no son rutas.** Expiración de sesión, cuenta deshabilitada y empresa inactiva son **variantes de `/login`** activadas por parámetros o respuestas; enlace expirado es un **estado de `/restablecer`**; mantenimiento y error de red son **patrones transversales**. Multiplicar rutas para estados fragmentaría la navegación y crearía destinos enlazables a pantallas de error (anti-patrón de wayfinding: una URL debe prometer un lugar, no un fallo).

### 2.2 Flujo completo (mapa de navegación)

```
Landing ──"Iniciar sesión"──────────────► /login ◄────────────────────┐
   │                                        │ ▲                        │
   └─"Solicitar demo" (primario, sheet)     │ └─"¿Ya tienes cuenta?"   │
                                            │                          │
        ┌───────────────────────────────────┼──────────────┐           │
        ▼                                   ▼              ▼           │
   "Crear empresa"                    "¿Olvidaste tu   [login OK]      │
     /registro ──éxito──► /login?registered=1contraseña?"  │           │
        │                                /recuperar        ▼           │
        └─"¿Ya tienes cuenta?"► /login      │         /dashboard       │
                                            ▼         (o `next` §7.1)  │
                                     confirmación                      │
                                     genérica + correo                 │
                                            │                          │
                                            ▼                          │
                                   /restablecer?token=…                │
                                     │            │                    │
                                  [éxito]    [enlace vencido]          │
                                     │            │                    │
                                     ▼            └─"Solicitar enlace  │
                              /login?reset=1         nuevo"► /recuperar│
                                     └─────────────────────────────────┘
```

Reglas de navegación entre pantallas:

- **AX-D2 — Toda pantalla de entrada tiene exactamente un destino primario y como máximo dos enlaces de escape.** Login: entrar (primario) + registro + recuperación. Registro: crear (primario) + login. Recuperar: enviar (primario) + volver a login. Restablecer: guardar (primario) + volver a login. Más enlaces diluyen la única tarea de cada pantalla (carga cognitiva mínima: una decisión por pantalla).
- La marca (logotipo + nombre) enlaza siempre a `/` (landing) — es la única vía de vuelta al mundo público, y basta.
- El middleware conserva la regla existente: con sesión activa, `/login` y `/registro` redirigen a `/dashboard` (H7). Se extiende a `/recuperar` (un usuario con sesión no necesita recuperar contraseña desde fuera); `/restablecer` **queda accesible con sesión** — el enlace del correo debe funcionar aunque haya una sesión abierta en otro perfil del navegador.

### 2.3 El viaje y sus momentos de verdad

Curva emocional del operador a lo largo de la entrada, con los tres momentos que hacen o rompen la confianza:

| Etapa                       | Estado emocional                                                       | Momento de verdad                                                                                                                                                    |
| --------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Descubre la landing         | Curiosidad escéptica                                                   | —                                                                                                                                                                    |
| Registra su empresa         | Ilusión + cautela (datos legales: NIT, razón social)                   | **MV1 — primer login tras el registro:** si el puente registro → login → dashboard fluye sin tropiezo, el producto cumple su primera promesa.                        |
| Uso diario                  | Rutina (el login es un peaje que debe ser instantáneo)                 | —                                                                                                                                                                    |
| Olvida la contraseña        | **Ansiedad máxima** (teme perder acceso a datos laborales de terceros) | **MV2 — la recuperación:** hoy es un callejón sin salida (H4). Es el punto donde más confianza se gana o se pierde de toda la experiencia.                           |
| La sesión expira trabajando | Irritación                                                             | **MV3 — la reentrada:** si al volver a entrar regresa exactamente adonde estaba, la expiración se percibe como protección; si lo deja en el dashboard, como castigo. |

La priorización de la migración (§13) sigue este orden: MV2 primero (vacío total), MV3 segundo (contrato roto), MV1 tercero (funciona pero con costuras verbales).

---

## 3. Objetivo de cada pantalla (síntesis)

| Pantalla     | Objetivo único                                                                     | El usuario se va con…                                             |
| ------------ | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Landing      | Convertir interés en demo (primario) y dar acceso al usuario que regresa (retorno) | Una demo agendada o su sesión iniciada                            |
| Login        | Entrar a la oficina de su empresa en el menor tiempo posible                       | Sesión activa, en el punto donde estaba (o el dashboard)          |
| Registro     | Fundar la oficina: empresa + primer administrador, con datos legales correctos     | Empresa creada y certeza de cuál es el siguiente paso             |
| Recuperar    | Pedir un enlace de recuperación sin revelar información a terceros                 | Expectativa correcta: revisar el correo, vigencia 1 hora          |
| Restablecer  | Definir una contraseña nueva y volver a operar                                     | Contraseña cambiada y aviso de que las demás sesiones se cerraron |
| Estados (§7) | Convertir cada excepción en un desvío señalizado, nunca en un muro                 | Siempre una salida accionable                                     |

---

## 4. Landing — contratos de conexión (no rediseño)

El rediseño visual de la landing es ámbito F5 (Plan Maestro §3.2); redisenarla aquí duplicaría trabajo contra un sistema visual que F5 alineará. Esta sección fija solo lo que la experiencia de entrada **necesita de ella**:

- **AX-D3 — La demo sigue siendo el CTA primario; el registro no se promociona desde la landing.** La estrategia comercial actual es demo-first (H8: la landing no enlaza a `/registro`, y el flujo self-service completo existe pero se alcanza desde `/login`). Esta especificación **conserva** esa decisión como decisión de negocio explícita y reversible: si el dueño del producto decide abrir el registro self-service desde la landing, el único cambio es añadir un enlace secundario "Crear cuenta" junto a "Iniciar sesión" en el nav — el destino ya existe y esta especificación ya lo cubre.
- **"Iniciar sesión" permanece visible en el nav y footer de la landing** (existe hoy, se conserva): es la puerta del usuario que regresa. Nunca dentro de un menú desplegable en desktop.
- **Continuidad de marca en la transición:** al pasar de `/` a `/login` cambian el registro (brand → product) y la densidad, pero la marca (logotipo "1" + "La Oficina Nítida") y la promesa verbal deben ser reconocibles como el mismo producto. La landing promete "sin depender del Excel"; el auth promete "tu oficina separada y verificable" — ambas frases pertenecen a la misma voz (§8). Hasta F5 se acepta la divergencia visual (H8); la divergencia **verbal** no se acepta y se corrige en esta fase (§10).
- La landing no muestra estados de sesión ("Hola, {nombre}") ni personalización: es una superficie pública y estática. Si hay sesión activa, "Iniciar sesión" lleva a `/login`, que el middleware redirige a `/dashboard` (regla existente, se conserva).

---

## 5. Inicio de sesión

### 5.1 Estructura y jerarquía

Se conserva la anatomía actual (H9, AUTH-03): pantalla dividida en **panel de marca** (desktop, ≥`lg`) + **escenario de formulario**; en <`lg`, encabezado compacto de marca + formulario. Dentro del panel del formulario, de arriba abajo:

1. Línea de marca (logotipo + nombre) — enlaza a `/`.
2. Contexto breve ("Acceso privado" se conserva como etiqueta de zona).
3. `h1` único: "Entra a tu oficina" (se conserva — es la mejor frase del producto: dice multiempresa sin decir tenant).
4. Descripción: "Accede con el NIT de la empresa y tu correo." (se acorta: "corporativo" excluye sin necesidad — hay operadores con correos personales).
5. Zona de avisos (una sola): éxito post-registro, éxito post-restablecimiento, sesión expirada o error de credenciales. **Nunca dos avisos simultáneos**; prioridad: error > expiración > éxitos.
6. Formulario: NIT → correo → contraseña → acción primaria "Entrar".
7. Escape 1: "¿Olvidaste tu contraseña?" (**nuevo** — cierra H4).
8. Escape 2: "¿Aún no tienes empresa? Crear cuenta".

**AX-D4 — El enlace de recuperación vive junto al campo de contraseña**, alineado al extremo opuesto de la etiqueta "Contraseña" (patrón universal: el usuario lo busca exactamente ahí en el momento exacto de la duda), no al pie de la pantalla. Rol tipográfico `caption`, color `muted-foreground` con hover a `foreground` — visible sin competir con la acción primaria.

### 5.2 Campos y productividad

| Campo      | Comportamiento                                                                                                                                                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NIT        | Numérico (`inputMode` numérico, ya existe). **Texto de ayuda permanente** (rol `caption`): "El NIT con el que se registró la empresa, sin dígito de verificación." — responde AUTH-02 sin research pendiente. Prellenado según AX-D5. |
| Correo     | Autocompletado de navegador (ya existe). Sin cambios funcionales.                                                                                                                                                                     |
| Contraseña | Gana **control de mostrar/ocultar** (botón-icono dentro del campo, nombre accesible "Mostrar contraseña"/"Ocultar contraseña", nunca solo-hover). Reduce errores de tipeo — la causa #1 de la ansiedad de "¿olvidé mi contraseña?".   |

- **AX-D5 — Memoria de NIT por dispositivo.** Tras un login exitoso, el NIT (solo el NIT: es un dato público del registro mercantil colombiano, no un secreto) se recuerda en el navegador y se prellena en visitas futuras. Con NIT prellenado, el foco inicial cae en el correo; sin él, en el NIT. Nunca se recuerdan correo ni contraseña por parte de la aplicación (eso es del gestor del navegador). Un enlace discreto "¿Otra empresa?" bajo el campo limpia el valor recordado. Ahorra el tecleo más frágil de la ceremonia en el 95 % de los accesos (el usuario diario entra siempre a la misma empresa — H1).
- Foco inicial automático al primer campo vacío. Envío con Enter desde cualquier campo. Un solo envío por vez (botón en `loading` + deshabilitado, patrón existente).
- La validación de formato es en cliente y al enviar (patrón zod existente); los mensajes de campo aparecen bajo el campo (patrón `AuthField` existente) y se corrigen de tildes (§10).

### 5.3 Estados de la pantalla

| Estado                                      | Disparador                        | Comportamiento                                                                                                                                                             |
| ------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Por defecto**                             | Visita directa                    | Formulario limpio (NIT prellenado si hay memoria AX-D5).                                                                                                                   |
| **Registro completado**                     | `?registered=1` (existente)       | Aviso de éxito: "Tu empresa quedó registrada. Inicia sesión para entrar a tu oficina." NIT prellenado con el recién registrado (AX-D5 se alimenta desde el registro).      |
| **Contraseña restablecida**                 | `?reset=1` (**nuevo**)            | Aviso de éxito: "Tu contraseña se actualizó. Inicia sesión con la nueva contraseña."                                                                                       |
| **Sesión expirada**                         | `?expired=1` (**nuevo**, §7.1)    | Aviso informativo (semántica `info`, no error — expirar no es culpa del usuario): "Tu sesión terminó por seguridad. Vuelve a entrar para continuar donde estabas."         |
| **Error de credenciales**                   | Respuesta 401/400 del backend     | Aviso de error según el contrato de mensajes §9.2. El formulario **conserva NIT y correo**; solo la contraseña se limpia. Foco al campo de contraseña.                     |
| **Cuenta deshabilitada / empresa inactiva** | Respuesta específica (§7.4, §7.5) | Aviso de error con vía de salida (responsable correcto), según §9.2.                                                                                                       |
| **Enviando**                                | Envío en curso                    | Botón primario en `loading`, campos deshabilitados. Sin overlay, sin spinner de página.                                                                                    |
| **Error de red**                            | Fallo de conexión                 | §7.7 — aviso de error con reintento; lo escrito no se pierde.                                                                                                              |
| **Éxito**                                   | 200                               | Navegación inmediata a `next` validado (§7.1) o `/dashboard`. Sin pantalla intermedia de "bienvenido", sin coreografía (registro `product`: la entrada carga a una tarea). |

Estados vacíos: no existen en esta superficie (no hay colecciones); se declara para cumplir el contrato de estados completo.

---

## 6. Registro de empresa

### 6.1 Estructura y carga cognitiva

Se conserva el **paso único** (H2): ocho campos en una pantalla es la carga correcta para un acto fundacional que el usuario hace una sola vez, con sus datos legales a mano; un asistente multipaso añadiría ceremonia sin reducir el esfuerzo real (los datos no dependen unos de otros). Lo que sí se corrige es la **agrupación semántica**:

**AX-D6 — El formulario se organiza en dos grupos titulados, en este orden: "Tu empresa" (NIT + dígito de verificación, nombre comercial, razón social) y "La cuenta del administrador" (nombre, apellido, correo, contraseña).** Cada grupo con título de rol `section-title` y los campos que ya existen. La agrupación convierte ocho campos planos en dos preguntas mentales ("¿qué empresa?" y "¿quién la administra?") — reduce la carga percibida sin tocar el contrato de la API. El grupo de empresa va primero porque es la identidad del espacio (coherente con "Registra tu empresa").

Jerarquía verbal de la pantalla:

- `h1`: "Registra tu empresa" (se conserva).
- Descripción: "Crea el espacio de tu empresa y la cuenta del administrador. Podrás invitar a tu equipo más adelante." — la segunda frase **solo** se añade cuando exista la capacidad de invitación (§7.2); hasta entonces: "Crea el espacio de tu empresa y la cuenta del administrador." (cero promesas sin backend, principio 5).
- Etiqueta de zona: "Nueva oficina" (se conserva).

### 6.2 Campos: ayuda y expectativas

| Campo                | Ajuste especificado                                                                                                                                                                                                                                                                             |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NIT + Dígito         | Etiqueta "Dígito" gana su tilde y ayuda: "El dígito de verificación que acompaña al NIT (aparece en el RUT)." El NIT indica: "Sin puntos ni dígito de verificación."                                                                                                                            |
| Nombre comercial     | Ayuda: "Como se conoce a tu organización. Así aparecerá dentro de la plataforma."                                                                                                                                                                                                               |
| Razón social         | Con tilde. Ayuda: "El nombre legal exacto, como aparece en el RUT. Se usará en tus documentos."                                                                                                                                                                                                 |
| Contraseña           | Requisito visible **antes** del error, como ayuda permanente: "Mínimo 8 caracteres." + control mostrar/ocultar (mismo patrón que login). **No se pide confirmación de contraseña**: el control de visibilidad la reemplaza con menos fricción, y la recuperación (§6.3) es la red de seguridad. |
| Correo administrador | Ayuda: "A este correo llegarán los enlaces de recuperación de la cuenta." — fija la expectativa del canal de rescate desde el día uno.                                                                                                                                                          |

### 6.3 Estados de la pantalla

| Estado                | Comportamiento                                                                                                                                                                                                                                                                                                             |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Por defecto**       | Formulario limpio, foco en NIT.                                                                                                                                                                                                                                                                                            |
| **Error de campo**    | Mensajes bajo el campo (patrón existente), tildes corregidas (§10). Foco al primer campo con error tras el envío.                                                                                                                                                                                                          |
| **NIT ya registrado** | El error más importante de la pantalla, con salida doble: "Ya existe una empresa registrada con este NIT. Si es la tuya, **inicia sesión** o **recupera tu contraseña**." — ambos enlaces en el propio aviso. Convierte el rechazo en reencuentro (el caso real más probable: el administrador olvidó que ya se registró). |
| **Enviando**          | Botón "Crear empresa" en `loading`; campos deshabilitados.                                                                                                                                                                                                                                                                 |
| **Éxito**             | Redirección a `/login?registered=1` (flujo existente H2) con el NIT sembrado en la memoria del dispositivo (AX-D5): el primer login no exige re-teclear lo que se acaba de escribir.                                                                                                                                       |
| **Error de red**      | §7.7.                                                                                                                                                                                                                                                                                                                      |

---

## 7. Recuperación de contraseña y estados especiales

### 7.0 Recuperación — `/recuperar` (nueva pantalla)

La pantalla con más ansiedad de todo el producto (MV2). Diseño para calmar: una sola pregunta, expectativas exactas, cero acusaciones.

- Anatomía: misma plantilla que login (panel de marca + escenario). `h1`: "Recupera tu acceso". Descripción: "Te enviaremos un enlace a tu correo para definir una contraseña nueva."
- **Dos campos**: NIT de la empresa (con la misma ayuda y prellenado AX-D5 del login — si el usuario venía de `/login`, el NIT ya está puesto) y correo. Son exactamente los datos que el backend 7A exige (H3); no se pide nada más.
- Acción primaria: "Enviar enlace de recuperación". Escape: "Volver a iniciar sesión".

**AX-D7 — La confirmación es genérica e idéntica en todos los casos** (existe o no la cuenta, activa o no). Tras enviar, la pantalla completa pasa a estado de confirmación (no un toast: el usuario debe poder leerlo con calma):

> **"Revisa tu correo"** — "Si los datos corresponden a una cuenta activa, enviamos un enlace a {correo ingresado}. El enlace vence en **1 hora** y solo puede usarse una vez. Si no lo encuentras, revisa la carpeta de spam."

Con dos salidas: "Volver a iniciar sesión" y "¿Datos incorrectos? Intentar de nuevo" (regresa al formulario con los valores conservados). El texto dice "si los datos corresponden" — nunca afirma que el correo salió (anti-enumeración §9.3 y honestidad ante el modo degradado del email, H3/R4).

Estados: por defecto · enviando (botón `loading`) · confirmación (descrita) · error de red (§7.7). No hay estado de "cuenta no encontrada": no existe por contrato.

### 7.0b Restablecimiento — `/restablecer` (nueva pantalla)

Llega desde el enlace del correo con el token en la URL; el token es **invisible** para el usuario (jerga prohibida: nunca se muestra ni se menciona "token").

- `h1`: "Define tu nueva contraseña". Un solo campo: contraseña nueva (ayuda "Mínimo 8 caracteres." + mostrar/ocultar). Acción primaria: "Guardar y continuar".
- Aviso permanente bajo el campo (rol `caption`, semántica `info`): "Por seguridad, se cerrarán las sesiones abiertas en otros dispositivos." — comunica la revocación que el backend ya ejecuta (H3), convirtiendo un efecto invisible en evidencia de protección (principio 3 del Plan Maestro).
- **Éxito**: redirección a `/login?reset=1` (§5.3). Sin login automático (el backend no lo ofrece; además, obligar al login inmediato con la contraseña nueva la fija en la memoria).
- **Enlace vencido, ya usado o inválido** (§7.3): la pantalla no muestra el formulario; muestra el estado de enlace expirado.
- Acceso con sesión activa permitido (§2.2). Error de red: §7.7.

### 7.1 Expiración de sesión (MV3)

Contrato de expiración — hoy inexistente (H7):

1. **Detección**: cuando la renovación de sesión falla definitivamente en cualquier ruta privada, la aplicación navega a `/login?expired=1&next={ruta actual}`.
2. **`next`**: solo se acepta una ruta **interna** (path relativo dentro de la aplicación, verificado); cualquier valor absoluto o externo se descarta y se usa `/dashboard`. Nunca se incluyen parámetros sensibles.
3. **Reentrada**: `/login` muestra el aviso de sesión expirada (§5.3), con NIT prellenado (AX-D5). Tras el login exitoso, navega a `next`.
4. **Cobertura completa**: el contrato aplica a **todas** las rutas privadas, no solo a las del matcher actual (deuda H7 — criterio de aceptación §11).
5. **Trabajo sin guardar**: en v1 se acepta la pérdida del contenido de formularios abiertos al expirar (los formularios del producto son cortos y viven en paneles). Registrado como límite conocido (R6); la mitigación real (renovación proactiva durante actividad) es del backend/sesión, no de esta superficie.

Tono del aviso: informativo, no culpabilizador ni alarmista ("terminó por seguridad", nunca "tu sesión ha caducado ⚠"). Semántica `info` de la taxonomía DS §7.

### 7.2 Invitación — RESERVADO (contrato para cuando exista el backend)

No existe capacidad de invitación ni gestión de usuarios (H5). **Prohibido implementar cualquier superficie de invitación en esta fase** (principio 5). Se deja el contrato para que, cuando el backend llegue (previsiblemente con "Usuarios y roles" en Organización, AS §2.4), la experiencia ya esté decidida:

- El correo de invitación lleva a `/invitacion/[token]`: pantalla hermana de `/restablecer` (mismo patrón: token invisible, un formulario mínimo).
- Contenido: "{Nombre del administrador} te invitó a la oficina de {empresa}" + campos nombre/apellido (si el backend no los tiene ya) + contraseña. Acción: "Aceptar invitación y entrar".
- El invitado **no elige empresa ni rol**: ambos vienen sellados en la invitación. El NIT de la empresa queda sembrado en la memoria del dispositivo (AX-D5) para sus logins futuros.
- Enlace vencido/revocado: mismo patrón §7.3, con salida "Pide al administrador que te envíe una invitación nueva" (el invitado **no** puede regenerarla — el responsable es el administrador, y el mensaje lo señala).
- Al existir esta capacidad, la descripción del registro gana la frase de invitación (§6.1) y este documento se actualiza (regla de gobernanza §14).

### 7.3 Enlace expirado, usado o inválido

Patrón único para todo enlace con token (hoy: restablecimiento; futuro: invitación):

- La pantalla del token **valida antes de mostrar el formulario**; si el enlace no sirve, muestra el estado terminal — nunca deja al usuario llenar un formulario que fallará al enviar (respeto por el esfuerzo).
- Mensaje sin culpa y sin tecnicismos: "**Este enlace ya no es válido.** Los enlaces vencen después de 1 hora o al usarse una vez." + salida única y primaria: "Solicitar un enlace nuevo" (→ `/recuperar`, con los valores que se puedan prellenar). Escape: "Volver a iniciar sesión".
- El mismo estado cubre token ausente, malformado, vencido o consumido: distinguirlos en pantalla no aporta nada al usuario y sí a un atacante.

### 7.4 Empresa inexistente o inactiva

- **NIT inexistente** (en login o recuperación): la pantalla **no lo revela**. En login se muestra el error genérico de credenciales (§9.2); en recuperación, la confirmación genérica (AX-D7). El mensaje backend actual "empresa no encontrada" no se traslada a la interfaz y su corrección se registra como deuda coordinada (R1).
- **Empresa inactiva** (suspendida): el usuario legítimo de una empresa suspendida necesita saberlo para actuar (fail-secure: motivo + responsable). Mensaje: "**El acceso de esta empresa está suspendido.** Escribe a soporte para reactivarlo." con el canal de soporte visible. Se acepta que esto confirme la existencia del NIT: el NIT colombiano es un dato público, y el costo de ocultarlo (un cliente pagando sin saber por qué no entra) supera al beneficio.

### 7.5 Usuario deshabilitado

- Mensaje en login: "**Tu cuenta está deshabilitada.** Contacta al administrador de tu empresa para reactivarla." — motivo + responsable correcto (el administrador del tenant, no el soporte de la plataforma; deshabilitar usuarios es una decisión interna de la empresa).
- Deuda de seguridad registrada (R2): el backend valida `activo` **antes** de la contraseña (H6), de modo que cualquiera que conozca el correo puede descubrir que la cuenta está deshabilitada. La recomendación es validar la contraseña primero y solo entonces revelar el estado. La interfaz muestra el mensaje cuando el backend lo emita; el orden de validación es decisión backend (coordinación ADR-SEC).

### 7.6 Mantenimiento — RESERVADO (patrón para cuando exista la capacidad)

No hay infraestructura de modo mantenimiento (H10). **No se implementa pantalla alguna** hasta que exista. El patrón, para entonces:

- Pantalla completa con la marca, sin navegación: "**Estamos en mantenimiento.** Volvemos en poco tiempo. Tu información está segura." Sin cuenta regresiva salvo que sea real; sin disculpas dramáticas; la frase de seguridad de datos es obligatoria (el usuario que ve caído el sistema donde viven sus contratos piensa primero en sus datos).
- Regla desde ya vigente: **ningún error crudo del servidor llega a la superficie de entrada** — todo fallo 5xx en auth se presenta con el patrón de error de red/servicio (§7.7).

### 7.7 Error de red

Patrón para todos los formularios de la superficie de entrada:

- Aviso de error inline en la zona de avisos: "**No pudimos conectar.** Revisa tu conexión e inténtalo de nuevo." El botón primario vuelve a estar disponible y **reenvía lo ya escrito** — el contenido tecleado jamás se pierde por un fallo de red.
- Si el navegador reporta estar sin conexión, la variante es más específica: "Parece que no tienes conexión a internet." Sin códigos, sin "Error 500", sin jerga.
- Fallos del servidor (5xx) usan el mismo patrón con verbo distinto: "El servicio no está disponible en este momento. Inténtalo de nuevo en unos minutos." — es la cara visible de §7.6 mientras no exista modo mantenimiento formal.

---

## 8. Identidad, tono y branding

### 8.1 El puente entre dos registros

La entrada es la bisagra entre la landing (registro de marca: persuasiva, expresiva) y el producto (registro de producto: denso, calmado, al servicio de la tarea). La resolución:

- **AX-D8 — Las pantallas de auth pertenecen al registro de producto**, con una única licencia de marca: el panel lateral de marca en desktop (H9), que se conserva como pieza de identidad. Todo lo demás — tipografía por roles DS §3.4, tokens, foco, motion — es el sistema del producto, sin excepción. Coherente con que auth ya usa los tokens correctamente (AUTH-03).
- La voz es una sola en las tres superficies (landing, auth, app): español de Colombia, tuteo, vocabulario del usuario (DS §8). Lo que cambia entre registros es la intención (persuadir → acompañar), nunca la personalidad (eficiente, confiable, práctica — PRODUCT.md).

### 8.2 Jerarquía tipográfica

Roles DS §3.4 exclusivamente: el `h1` de cada pantalla de auth usa un tamaño entre `page-title` y `display` que **ya existe en el código del panel de auth**; en la implementación se normaliza a un rol nombrado (la resolución exacta es de F1/DS, no de este documento — se prohíbe introducir un tamaño arbitrario nuevo). Descripciones en `body` con `muted-foreground`; ayudas de campo en `caption`; etiquetas de zona ("Acceso privado", "Nueva oficina") en `caption-2`.

### 8.3 Las señales de seguridad, reescritas

El panel de marca y el pie del formulario hoy hablan en jerga (H9). Sustitución completa — mismo lugar, misma estructura de tres señales, contenido nuevo:

| Hoy (jerga TR-09)                                        | Especificado (lenguaje de confianza)                                                                                                                                                                                                           |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Tenant · Separado por NIT"                              | "Cada empresa, su propia oficina" — "Tus datos nunca se mezclan con otros."                                                                                                                                                                    |
| "Sesión · Refresh protegido"                             | "Sesión protegida" — "Se renueva sola mientras trabajas y se cierra por seguridad al dejar de usarla."                                                                                                                                         |
| "Roles · ADMIN y OPERADOR"                               | "Acceso por permisos" — "Cada persona ve solo lo que le corresponde."                                                                                                                                                                          |
| Pie: "Cookie HTTP-only · Roles activos · Tenant aislado" | Se elimina. Si se conserva un pie, dice una sola cosa verdadera y humana: "Protegemos tu información con los estándares del sector financiero." — o nada. Tres tecnicismos con check no tranquilizan al auxiliar administrativo; lo intimidan. |

El texto largo del panel ("La sesion empieza con el NIT…") se reescribe: "Entra con el NIT de tu empresa y tu correo. Todo lo que hagas queda dentro de tu oficina: tus empleados, tus contratos y tus documentos." — con tildes, sin "tenant", sin "menús contables".

### 8.4 Motion

Registro de producto (DS §4.3, precedente DASHBOARD §11): el movimiento comunica estado, jamás decora.

| Momento                                                                          | Movimiento                                                                                      | Token                               |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------- |
| Aparición de un aviso (error/éxito)                                              | Crossfade de opacidad                                                                           | `--duration-fast`                   |
| Botón primario en envío                                                          | Spin del indicador de progreso                                                                  | continuo, `linear`                  |
| Transición entre estados de pantalla (formulario → confirmación en `/recuperar`) | Crossfade del contenido del panel                                                               | `--duration-base` + `--ease-out-ui` |
| Login exitoso → aplicación                                                       | Navegación directa. **Sin** pantalla de transición, sin cortina, sin coreografía de bienvenida. | —                                   |
| Hover/press de controles                                                         | Estados estándar del sistema (incluye la pulsación existente del botón).                        | `--duration-fast`                   |

Prohibido: animar la entrada de la pantalla de login (carga a una tarea), animar campo por campo, y cualquier animación del panel de marca. `prefers-reduced-motion`: los crossfades se vuelven instantáneos; el spin de progreso se conserva (estado esencial).

---

## 9. Contratos

### 9.1 Contrato de parámetros de URL

| Parámetro      | Pantalla       | Valores      | Efecto                          | Regla                                                                                   |
| -------------- | -------------- | ------------ | ------------------------------- | --------------------------------------------------------------------------------------- |
| `registered=1` | `/login`       | bandera      | Aviso de registro exitoso       | Existente, se conserva.                                                                 |
| `reset=1`      | `/login`       | bandera      | Aviso de contraseña actualizada | Nuevo.                                                                                  |
| `expired=1`    | `/login`       | bandera      | Aviso de sesión expirada        | Nuevo. Compatible con `next`.                                                           |
| `next`         | `/login`       | ruta interna | Destino tras login exitoso      | Solo paths internos verificados; inválido → `/dashboard`. Nunca se refleja en pantalla. |
| `token`        | `/restablecer` | opaco        | Credencial del restablecimiento | Jamás visible ni mencionado en la interfaz. Se valida antes de mostrar el formulario.   |

Los parámetros de bandera son **aditivos e inofensivos**: una URL vieja sin ellos funciona idéntica a hoy (garantía de rollback §14).

### 9.2 Contrato de mensajes (backend → interfaz)

La interfaz **nunca imprime el mensaje del backend tal cual**; mapea por caso. Fuente única (mismo espíritu que `auth-copy.ts`, que se conserva y amplía como el diccionario central de esta superficie):

| Caso backend                                                  | Mensaje en pantalla                                                                                        | Semántica |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------- |
| Credenciales inválidas / NIT inexistente / correo inexistente | "Los datos no coinciden con una cuenta activa. Revisa el NIT, el correo y la contraseña."                  | `danger`  |
| Usuario deshabilitado                                         | "Tu cuenta está deshabilitada. Contacta al administrador de tu empresa para reactivarla."                  | `danger`  |
| Empresa inactiva                                              | "El acceso de esta empresa está suspendido. Escribe a soporte para reactivarlo."                           | `danger`  |
| Demasiados intentos (throttling 7A)                           | "Demasiados intentos. Espera unos minutos e inténtalo de nuevo."                                           | `warning` |
| Enlace de restablecimiento inválido/vencido                   | Estado de §7.3 (pantalla, no aviso).                                                                       | —         |
| Red / 5xx                                                     | §7.7.                                                                                                      | `danger`  |
| Cualquier caso no mapeado                                     | El genérico de credenciales (en login) o el de servicio (resto). **Nunca** el texto crudo de la excepción. | `danger`  |

### 9.3 Contrato anti-enumeración (regla de experiencia)

1. Ninguna pantalla pública confirma ni niega la existencia de un NIT, un correo o una cuenta, con la única excepción deliberada de "empresa suspendida" (§7.4, justificada).
2. La información específica del estado de una cuenta viaja únicamente al correo de esa cuenta.
3. Los estados de token no distinguen causa (§7.3).
4. La UI cumple 1–3 aunque el backend, hoy, revele más (H6); las correcciones backend son R1/R2.

### 9.4 Contrato de estados por pantalla

Toda pantalla de esta superficie implementa su tabla de estados completa (§5.3, §6.3, §7.0, §7.0b) — por defecto, enviando, éxito, error de datos, error de red — antes de considerarse terminada (registro `product`: no se entrega la mitad de los estados). Los avisos usan el mecanismo inline existente (`Alert`) con `aria-live`; el toast no participa en auth (no hay contexto de aplicación que lo contenga).

### 9.5 Contrato con el backend

Cero endpoints nuevos. Las dos pantallas nuevas consumen 7A tal cual: `POST /auth/forgot-password {tenantNit, email}` y `POST /auth/reset-password {token, contraseña nueva}` (la forma exacta del payload de reset es la que 7A ya define). La invitación no consume nada porque no existe (§7.2).

---

## 10. Microcopy — diccionario de la superficie

Reglas DS §8 (tuteo, tildes, cero jerga). El diccionario completo vive en el copy centralizado; aquí, los textos normativos:

| Clave                    | Texto                                                                                                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Login · título           | Entra a tu oficina                                                                                                                                                                                      |
| Login · descripción      | Accede con el NIT de la empresa y tu correo.                                                                                                                                                            |
| Login · acción           | Entrar                                                                                                                                                                                                  |
| Login · recuperación     | ¿Olvidaste tu contraseña?                                                                                                                                                                               |
| Login · a registro       | ¿Aún no tienes empresa? **Crear cuenta**                                                                                                                                                                |
| Registro · título        | Registra tu empresa                                                                                                                                                                                     |
| Registro · descripción   | Crea el espacio de tu empresa y la cuenta del administrador.                                                                                                                                            |
| Registro · grupos        | Tu empresa · La cuenta del administrador                                                                                                                                                                |
| Registro · acción        | Crear empresa                                                                                                                                                                                           |
| Registro · a login       | ¿Ya tienes cuenta? **Iniciar sesión**                                                                                                                                                                   |
| Recuperar · título       | Recupera tu acceso                                                                                                                                                                                      |
| Recuperar · descripción  | Te enviaremos un enlace a tu correo para definir una contraseña nueva.                                                                                                                                  |
| Recuperar · acción       | Enviar enlace de recuperación                                                                                                                                                                           |
| Recuperar · confirmación | Revisa tu correo — Si los datos corresponden a una cuenta activa, enviamos un enlace a {correo}. El enlace vence en 1 hora y solo puede usarse una vez. Si no lo encuentras, revisa la carpeta de spam. |
| Restablecer · título     | Define tu nueva contraseña                                                                                                                                                                              |
| Restablecer · aviso      | Por seguridad, se cerrarán las sesiones abiertas en otros dispositivos.                                                                                                                                 |
| Restablecer · acción     | Guardar y continuar                                                                                                                                                                                     |
| Enlace vencido · título  | Este enlace ya no es válido                                                                                                                                                                             |
| Enlace vencido · cuerpo  | Los enlaces vencen después de 1 hora o al usarse una vez.                                                                                                                                               |
| Enlace vencido · salida  | Solicitar un enlace nuevo                                                                                                                                                                               |
| Avisos de `/login`       | (§5.3: registro exitoso, contraseña actualizada, sesión expirada)                                                                                                                                       |
| Errores                  | (§9.2, tabla completa)                                                                                                                                                                                  |

Correcciones obligatorias del stock actual (cierra AUTH-01 y las instancias TR-08 de la superficie): "iniciar sesion" → "iniciar sesión"; "Digito" → "Dígito"; "Razon social" → "Razón social"; "¿Aun no…" → "¿Aún no…"; "contrasena"/"valido"/"verificacion" en mensajes zod → con tilde; el texto del panel de marca según §8.3.

---

## 11. Accesibilidad (WCAG AA como criterio de aceptación)

- **Un `h1` por pantalla** (título §10); la etiqueta de zona y la línea de marca no son encabezados. En `/registro`, los dos grupos AX-D6 son `h2`.
- **Avisos anunciados**: la zona de avisos usa el `Alert` existente con su rol correcto (`alert` para error — asertivo; `status` para éxito/info — cortés). Resuelve la verificación pendiente AUTH-04.
- **Errores de campo** asociados por descripción accesible (patrón `AuthField`/`FormField` DS §6.6); tras un envío fallido, el foco va al primer campo con error; tras un error de credenciales, al campo de contraseña.
- **Mostrar/ocultar contraseña**: botón real con nombre accesible que alterna, dentro del campo, operable por teclado, nunca solo-hover (DS §6.4). El estado del campo se anuncia por el propio cambio de tipo.
- **Orden de teclado = orden visual**; el enlace "¿Olvidaste tu contraseña?" es alcanzable entre el campo de contraseña y el botón de envío (donde el ojo lo encuentra).
- **Foco visible** con el contrato único DS §4.4 en todos los controles, incluido el enlace de recuperación y el botón de visibilidad.
- **Contraste**: textos de ayuda en `caption`/`muted-foreground` sobre las superficies de auth deben verificar ≥4.5:1 (los tokens actuales lo cumplen; se verifica en implementación como en DASHBOARD §10).
- **`autocomplete` correcto** (ya existente, se conserva): organización, correo, contraseña actual/nueva — imprescindible para gestores de contraseñas, que son la mitigación real del olvido.
- **Reduced-motion**: §8.4.

---

## 12. Riesgos

| #   | Riesgo                                                                                                                                        | Mitigación / tratamiento                                                                                                                                                           |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | **Enumeración por mensajes backend** (H6): "empresa no encontrada" confirma NITs; contradicción con 7A.                                       | La UI aplica §9.2/§9.3 desde ya (no imprime mensajes crudos). Corrección backend: unificar en "Credenciales inválidas". Coordinar con ADR-SEC-000 (pendiente de aprobación).       |
| R2  | **Enumeración de cuentas deshabilitadas** (H6): `activo` se valida antes que la contraseña.                                                   | Recomendación backend: comparar contraseña primero; revelar "deshabilitada" solo con contraseña correcta. Decisión backend, registrada aquí; la UI no puede corregirla sola.       |
| R3  | **Middleware incompleto** (H7): rutas privadas fuera del matcher no redirigen; la expiración se comporta distinto según la ruta.              | El contrato §7.1 exige cobertura completa; es criterio de aceptación (C7). Riesgo de implementación: probar expiración en una ruta profunda, no solo en `/dashboard`.              |
| R4  | **Email en modo degradado** (H3): si falta la API key, el backend responde éxito y no envía nada; el usuario espera un correo que no llegará. | El copy de AX-D7 no promete el envío como certeza. Pendiente operativo (ya registrado en 7B.1): configurar Resend y DNS en producción **antes** de publicar `/recuperar`.          |
| R5  | **Deriva visual landing ↔ auth hasta F5** (H8).                                                                                               | Aceptada y acotada: la divergencia verbal se corrige ahora (§4); la visual espera a F5.                                                                                            |
| R6  | **Pérdida de trabajo al expirar la sesión** (§7.1.5).                                                                                         | Límite conocido de v1; el retorno con `next` reduce el costo. Mitigación futura: renovación proactiva (backend).                                                                   |
| R7  | **Tentación de implementar invitación/mantenimiento sin backend.**                                                                            | Prohibición explícita (§7.2/§7.6) + principio 5. El criterio C10 lo verifica.                                                                                                      |
| R8  | **El NIT recordado (AX-D5) en equipos compartidos** revela qué empresa usa ese equipo.                                                        | Aceptado: el NIT es dato público y el equipo de oficina es el contexto de uso declarado (PRODUCT.md). "¿Otra empresa?" permite limpiarlo. Nunca se recuerdan correo ni contraseña. |

---

## 13. Migración (secuencia por dependencia, sin fechas)

Orden por los momentos de verdad (§2.3), cada paso entregable y reversible por sí solo:

1. **M1 — Voz y verdad verbal** (sin cambio funcional): correcciones de microcopy §10, señales de seguridad §8.3, ayudas de campo §5.2/§6.2, agrupación del registro AX-D6. Quema las violaciones TR-08/TR-09 de la superficie (política de adopción DS §5).
2. **M2 — Recuperación (MV2)**: rutas `/recuperar` y `/restablecer` sobre 7A, con sus estados completos (§7.0, §7.0b, §7.3) + el enlace AX-D4 en login + `?reset=1`. **Requisito de salida a producción**: R4 resuelto (email operativo).
3. **M3 — Expiración y retorno (MV3)**: contrato §7.1 completo (`expired`/`next`, cobertura de todas las rutas privadas), memoria de NIT AX-D5, contrato de mensajes §9.2 en login.
4. **M4 — Registro (MV1)**: estados §6.3 (en especial NIT duplicado con salida doble), mostrar/ocultar contraseña en ambos formularios.
5. **M5 — Conexiones de landing** (§4): verificación de enlaces y coherencia verbal. (El rediseño visual queda en F5.)

Cada M cierra con: cero violaciones del lint DS §5 en los archivos tocados, contrato de estados §9.4 verificado, `typecheck` y `build` verdes (criterio estándar F2).

## 14. Rollback y gobernanza

- **M1** es texto: se revierte con el commit, sin efectos de datos.
- **M2** añade rutas nuevas aisladas y un enlace: retirar el enlace y las rutas restaura el estado actual; el backend 7A no se toca y ya existía.
- **M3/M4** son aditivos sobre pantallas existentes; los parámetros de URL son banderas inofensivas (§9.1) — una URL antigua funciona idéntica. Revertir un M no rompe los anteriores.
- Ninguna migración de datos, ningún cambio de schema, ningún endpoint nuevo: el rollback de cualquier paso es `git revert`.
- **Gobernanza**: añadir un estado especial, una ruta de entrada o una variante de aviso actualiza este documento (misma disciplina que DS §10 / AS §12 / DASHBOARD §12). Cuando el backend de invitaciones exista, §7.2 se promueve de RESERVADO a especificación activa mediante revisión de este documento, no improvisando.

---

## 15. Criterios de aceptación (verificables)

1. Desde `/login` existe un camino completo y sin ayuda externa para recuperar el acceso: enlace visible → `/recuperar` → correo → `/restablecer` → `/login?reset=1` → sesión (cierra H4/MV2).
2. La confirmación de `/recuperar` es idéntica exista o no la cuenta (AX-D7), y ningún texto de pantalla confirma la existencia de NIT/correo, salvo la excepción documentada de empresa suspendida (§9.3).
3. Un enlace de restablecimiento vencido, usado o corrupto muestra el estado §7.3 con salida "Solicitar un enlace nuevo"; nunca un formulario que fallará ni un error técnico.
4. Toda expiración de sesión, en **cualquier** ruta privada, lleva a `/login?expired=1&next=…` y el login exitoso regresa a `next` (validado como ruta interna) (§7.1, R3).
5. La interfaz jamás imprime mensajes crudos del backend; todos los casos de la tabla §9.2 tienen su texto y los no mapeados caen al genérico.
6. "Usuario deshabilitado" y "empresa suspendida" señalan cada uno a su responsable correcto (administrador de la empresa / soporte) (§7.4/§7.5).
7. El NIT se prellena tras registro, tras expiración y en retornos (AX-D5), y "¿Otra empresa?" lo limpia; correo y contraseña nunca se recuerdan por la aplicación.
8. Cero jerga técnica en superficie (tenant, token, cookie, JWT, refresh, ADMIN/OPERADOR como enum) y cero tildes ausentes en todas las pantallas de entrada (TR-08/TR-09, §8.3/§10).
9. Cada pantalla implementa su tabla completa de estados (§9.4), el error de red conserva lo escrito (§7.7), y los avisos se anuncian con la semántica viva correcta (§11).
10. No existe ninguna superficie, ruta ni enlace de invitación o mantenimiento mientras no exista su backend (AS-D5, R7).
11. Un `h1` por pantalla, foco gestionado tras errores, mostrar/ocultar contraseña accesible, contraste AA verificado (§11).
12. Cero violaciones del lint DS §5 en el código de la superficie; `typecheck` y `build` verdes.

---

_Fin de AUTH-EXPERIENCE.md. Pendiente de aprobación antes de implementar (M1–M5) y antes de continuar con Employees._
