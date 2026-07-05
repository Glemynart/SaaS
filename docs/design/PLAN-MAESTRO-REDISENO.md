# Plan Maestro de Rediseño — La Oficina Nítida

| Campo         | Valor                                                                                                                                                                               |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Documento** | Estrategia de rediseño de experiencia (Plan Maestro)                                                                                                                                |
| **Fecha**     | 2026-07-03                                                                                                                                                                          |
| **Estado**    | Propuesto — pendiente de aprobación                                                                                                                                                 |
| **Ámbito**    | Experiencia de producto (`apps/web`). No modifica arquitectura, dominio, backend, reglas de negocio ni ADRs.                                                                        |
| **Fuentes**   | START_HERE, PROJECT_STATE, PRD, PRODUCT, DESIGN, ARCHITECTURE_COMPLETO, BACKLOG_COMPLETO, ADR-001, ADR-002, ADR-SEC-001/002, PAYROLL-IMPLEMENTATION-PLAN, código real de `apps/web` |

---

## 0. Restricción rectora

Este plan rediseña **la experiencia**, no el sistema. Todo lo que sigue asume como inmutable: la arquitectura multiempresa/multisede, el dominio (Tenant → Sede → Empleado → Contrato → ExpedienteDoc), las máquinas de estado de ADR-001 y ADR-002, el RBAC existente, los endpoints y los casos de uso. Donde la UX actual contradice al dominio, **el dominio gana** y la UX se corrige.

---

## 1. Comprensión del producto

### 1.1 El negocio

La Oficina Nítida es un SaaS B2B multiempresa para **operadores educativos colombianos**: organizaciones de 50–300 empleados que administran uno o varios colegios con múltiples sedes, con **contratación masiva anual** (docentes e instructores), alta carga documental, obligaciones de cumplimiento normativo colombiano (DANE, DIAN, PILA, nómina electrónica) y una operación que hoy vive en Excel y Word.

La propuesta de valor es **centralizar la gestión laboral, documental y operativa** sin la complejidad de un ERP: menor complejidad que Siigo/World Office, implementación rápida, soporte cercano, automatización de lo repetitivo. El posicionamiento explícitamente **no** es "software de nómina electrónica" ni "software contable" — aunque ambos motores existen o existirán como infraestructura.

Cliente secundario: contratistas y pequeñas empresas centradas en facturación electrónica.

### 1.2 Los usuarios

Del RBAC y los ADR se derivan los perfiles reales (no hay research formal de usuarios — brecha identificada en §3.4):

| Perfil                             | Rol técnico          | Trabajo diario (JTBD funcional)                                                                                                                                                                                                                |
| ---------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Administrador del operador**     | ADMIN                | Configurar la empresa, sedes, identidad; aprobar nómina; cerrar períodos; responder ante la ley. Job: "tener la tranquilidad de que todo está en regla y poder demostrarlo".                                                                   |
| **Auxiliar administrativo / RRHH** | OPERADOR             | Altas de empleados, importaciones Excel, generar contratos (individuales y por lote), mantener expedientes, atender alertas de vencimiento. Es el **usuario de todos los días**. Job: "sacar el volumen del día sin errores y sin re-digitar". |
| **Revisor de nómina**              | (dominio ADR-002 §6) | Revisar la liquidación calculada antes de aprobar. La segregación revisor ≠ aprobador es parte del modelo de dominio.                                                                                                                          |
| **Contador / consulta**            | VIEWER (SEC-002)     | Consultar libros, reportes, comprobantes. Hoy sin UI; el motor contable C0–C3 no tiene frontend.                                                                                                                                               |

Dimensión emocional transversal (relevante para diseño): el dominio maneja dinero, contratos y datos de personas (posiblemente menores). El usuario necesita **sentir** control, trazabilidad y reversibilidad — el ADR-SEC-001 lo formula como "el activo principal es la confianza".

### 1.3 Los procesos

Flujos principales, en orden de frecuencia de uso:

1. **Ciclo del empleado**: alta (individual o Excel masivo hasta 500) → asignación de sede → contrato → generación documental → expediente → alertas de vencimiento → renovación/retiro.
2. **Ciclo documental**: plantilla DOCX con variables → generación (individual/lote) → PDF → archivo en expediente (`ExpedienteDoc`, convención de `storageKey` definida).
3. **Ciclo de nómina** (arquitectura objetivo ADR-002): novedades → cálculo → BORRADOR → CALCULADA → EN_REVISION → APROBADA (congelamiento inmutable) → CAUSADA → PAGADA → CERRADA. Con salvaguarda **fail-secure**: empleados no liquidables se bloquean con motivo explícito.
4. **Ciclo contable** (ADR-001, sin UI hoy): comprobantes append-only, períodos ABIERTO/CERRADO, reportes derivados de `saldos()`, cierre mensual y anual.
5. **Ciclo de facturación**: clientes → productos → facturas/notas → (futuro) Matías API/DIAN.

### 1.4 Objetivos del SaaS

- Que el operador **opere sin Excel** en los procesos principales (definición de éxito del MVP).
- Corrección legal auditable (nómina reproducible, contabilidad inmutable, evidencia en AuditLog).
- Base para módulos regulatorios futuros: PILA, nómina electrónica, facturación electrónica DIAN.

### 1.5 Estado actual del producto (frontend)

**Módulos con UI operativa**: auth/registro, dashboard (placeholder), perfil, empleados (CRUD + importación + detalle + expediente), sedes, plantillas documentales, documentos generados, identidad corporativa, alertas, contratos (+ lotes), nómina (UI del modelo N2 antiguo: períodos DRAFT/CLOSED), facturación (clientes, productos, facturas). Landing completada.

**Módulos de dominio sin UI**: motor contable completo (C0–C3), la arquitectura objetivo de nómina (estados, revisión/aprobación, bloqueos, desprendibles), tesorería (futuro).

**Sistema de diseño**: `DESIGN.md` define una dirección clara y valiosa ("Linear/Stripe: neutros, un acento, flat, bordes finos, regla del 10 %") pero es un **seed sin resolver**: tokens `[to be resolved]`, sección de componentes vacía. La librería UI real tiene solo 7 primitivas (alert, badge, button, input, label, side-sheet, skeleton); todo lo demás (tablas, formularios, diálogos, selects, tabs, toasts) se construye ad hoc en cada página.

---

## 2. Diagnóstico

### 2.1 Fortalezas

1. **Dirección de diseño ya decidida y correcta.** DESIGN.md + PRODUCT.md definen north star, anti-referencias (ERPs saturados), principios y accesibilidad AA. El rediseño no parte de cero conceptual: parte de una intención escrita que solo falta ejecutar con rigor.
2. **Arquitectura frontend sana.** Feature folders (`features/*` con hooks/services), React Query, patrón BFF, tipos compartidos. El rediseño puede ser incremental por módulo sin reescritura estructural.
3. **El dominio es un regalo para la UX.** Máquinas de estado explícitas, invariantes verificables, fail-secure, auditoría — son exactamente el material del que se hace una interfaz que transmite confianza. Pocas veces el backend le da al diseño tanto que mostrar.
4. **Módulos recientes validados end-to-end** (sedes 10/10 flujos, importación 7/7): la base funcional es estable; el rediseño no compite con bugs.
5. **Consistencia de patrones básicos**: skeletons de carga, estados de error, empty states existen en casi todas las páginas.

### 2.2 Debilidades (deuda de experiencia, priorizada)

| #   | Debilidad                                                                                                                                                                                                                                                                                                                                                                  | Evidencia                                                                                   | Severidad                |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------ |
| D1  | **El dashboard es un placeholder obsoleto que contradice el producto.** Lista los módulos como "Pendiente" cuando 10+ están operativos; su contenido habla de JWT, tokens y tenants (lenguaje de desarrollador) en vez del trabajo del día. Es la primera pantalla diaria y hoy no aporta nada operativo.                                                                  | `features/dashboard/dashboard-home.tsx` (badge "MVP Auth", "Módulos preparados… Pendiente") | Crítica                  |
| D2  | **Navegación plana que no refleja el dominio.** 13 ítems sin agrupar ni jerarquía: Perfil en 2ª posición, Identidad en el medio, "Lotes" como hermano de "Contratos", "Plantillas"/"Generados" sin contexto, "Expediente" deshabilitado en el nav aunque existe (vive dentro de empleado), `nomina/periodos` inaccesible desde el nav. No escala a contabilidad/tesorería. | `app-shell.tsx:31-45`                                                                       | Crítica                  |
| D3  | **Doble titulación y mapeo de títulos frágil.** El header del shell muestra título+descripción por página vía una cadena de ternarios hardcodeada, y las páginas además renderizan su propio `h1` — dos títulos compitiendo, y cada módulo nuevo exige editar el shell.                                                                                                    | `app-shell.tsx:52-93` vs `nomina/page.tsx:30`                                               | Alta                     |
| D4  | **Disciplina de tokens rota.** Páginas con `bg-white`, `text-emerald-600`, `text-red-600`, `text-blue-600`, `text-amber-600` hardcodeados — viola la paleta restringida y la regla del 10 % de DESIGN.md; el color semántico (devengo/deducción/neto) es ad hoc por página.                                                                                                | `nomina/page.tsx`, `facturacion/page.tsx`                                                   | Alta                     |
| D5  | **Microcopy inconsistente y con fuga de jerga interna.** Tildes ausentes de forma aleatoria ("sesion", "generacion", "categoria" junto a "Nómina", "Facturación"); textos internos en UI de usuario: "Motor interno de cálculo", "Dominio interno", "Tenant activo", "MVP Auth", explicación de cookies HTTP-only en el dashboard.                                         | shell + dashboard + páginas                                                                 | Alta                     |
| D6  | **La UI de nómina refleja el modelo viejo (N2), no el aprobado.** La pantalla actual asume DRAFT/CLOSED; ADR-002 define 7 estados, revisión/aprobación con segregación, bloqueos fail-secure y snapshots. P1 está por implementarse: **si no se diseña esa experiencia ahora, se improvisará**.                                                                            | `nomina/*` vs ADR-002 §6                                                                    | Alta (ventana de tiempo) |
| D7  | **Kit de componentes insuficiente para un producto de tablas y formularios.** Sin primitivas de Table, Select, Dialog/Confirm, Tabs, Toast, DatePicker, EmptyState, PageHeader, StatusBadge — cada página resuelve lo suyo; la divergencia crece con cada módulo.                                                                                                          | `components/ui/` (7 archivos)                                                               | Alta                     |
| D8  | **Módulos futuros de alto peso sin fundamento UX.** El motor contable (C0–C3 completo en backend) no tiene ni una pantalla; no hay decisión de producto sobre si se expone y a quién. Tesorería, PILA y nómina electrónica llegarán sobre el mismo vacío.                                                                                                                  | rutas de `apps/web`                                                                         | Media (estratégica)      |
| D9  | **La UI no es consciente de permisos.** Muestra el rol como badge pero la navegación y las acciones no se adaptan (ADMIN vs OPERADOR vs VIEWER). SEC-001 exige least-privilege; la UI debería reflejarlo.                                                                                                                                                                  | `app-shell.tsx`                                                                             | Media                    |
| D10 | **Alertas subdesarrolladas frente a su peso en la propuesta de valor.** "Preavisos de vencimiento" es uno de los jobs centrales del cliente; hoy es una lista plana sin priorización visual, agrupación por urgencia ni acciones directas (renovar, generar documento).                                                                                                    | `alertas/page.tsx`                                                                          | Media                    |

### 2.3 Oportunidades

1. **Momento perfecto**: las superficies de los motores por venir aún no existen — nómina P1 (estados, aprobaciones, bloqueos), contabilidad (comprobantes, cierre), tesorería, y la facturación electrónica real vía Matías API. Diseñar sus patrones comunes (estados, inmutabilidad, evidencia) **antes** de implementarlos evita retrabajo y define el patrón para todos los flujos "serios" del producto.
2. **Diferenciación por confianza**: ningún competidor del segmento comunica trazabilidad y auditabilidad en la interfaz. El dominio ya la garantiza; mostrarla (quién aprobó, cuándo se congeló, qué versión de parámetros se usó) convierte una propiedad técnica en argumento de venta.
3. **La estética anti-ERP ya elegida** (nítida, calma, un acento) es exactamente lo que el usuario objetivo — personal no contable saturado de Siigo — valora. Ejecutarla bien es diferenciación directa contra las anti-referencias.
4. **Productividad del operador**: la contratación masiva anual es el pico de dolor del cliente; optimizar los flujos por lote (importación → contratos → expedientes) tiene el mayor retorno de experiencia por hora invertida.

### 2.4 Riesgos

| Riesgo                                                                                | Mitigación en este plan                                                                                                                                           |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rediseñar "todo a la vez" y desestabilizar módulos validados                          | Fases por módulo, con fundaciones (tokens + componentes) primero; los módulos estables solo se re-vestimentan, no se re-flujan.                                   |
| Diseñar la UX de nómina/contabilidad sin usuarios reales del dominio contable/laboral | F0 incluye validación con al menos un operador real o experto funcional; el fail-secure y la aprobación se prototipan antes de P1-U9.                             |
| El rediseño compite por capacidad con el roadmap funcional (P0–P2 de nómina, C3-U4)   | El roadmap de diseño se secuencia para **preceder** a cada fase funcional, no bloquearla: los patrones de nómina se diseñan mientras se implementa P0/P1 backend. |
| Deriva de alcance hacia funcionalidades nuevas                                        | Restricción rectora §0: cero funcionalidades nuevas; solo reorganización, consistencia y exposición de capacidades existentes.                                    |
| Decisiones visuales sin marca definida (tokens "to be resolved")                      | La resolución de tokens es la primera unidad de F1 y requiere decisión del dueño del producto (¿existe color corporativo?).                                       |

### 2.5 Inconsistencias documentales detectadas (a resolver, no a diseñar)

Documentadas y priorizadas como pide el encargo; **no se propone solución aquí**:

| #   | Inconsistencia                                                                                                                                                                                                                                                                                                                                                               | Prioridad                          |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| I1  | `LA_OFICINA_NITIDA_CONTEXT.md` y `Decisiones de Producto.md` — referenciados en el encargo — **no existen en el repositorio**.                                                                                                                                                                                                                                               | Alta                               |
| I2  | START_HERE/ARCHITECTURE afirman "la contabilidad NO será desarrollada; permanece en Siigo/World Office", pero ADR-001 construyó un motor contable completo (C0–C3). Observación: **la superficie funcional del motor contable visible en cada fase — y para qué perfil — no está definida en ningún documento**, y esa definición condiciona la arquitectura de información. | Alta (bloquea la IA definitiva)    |
| I3  | El dashboard afirma que los módulos están "Pendiente"; PROJECT_STATE los marca completados. Contradicción producto-realidad visible al usuario.                                                                                                                                                                                                                              | Alta (afecta al alcance de F2)     |
| I4  | VIEWER existe en ADR-SEC-002 pero START_HERE lo declara fuera del MVP; la UI no lo contempla.                                                                                                                                                                                                                                                                                | Media                              |
| I5  | START_HERE exige BullMQ/Redis; decisiones posteriores (FASE 5D, 7B.1) los descartan explícitamente. Documento fundacional desactualizado.                                                                                                                                                                                                                                    | Media                              |
| I6  | Next.js 14 (START_HERE) vs Next.js 15 (ARCHITECTURE_COMPLETO).                                                                                                                                                                                                                                                                                                               | Baja                               |
| I7  | ADR-001 dice "Estado: Propuesto" en el documento pero PROJECT_STATE lo registra "Aprobado". ADR-SEC-000/001 con conflicto pendiente (según memoria del proyecto).                                                                                                                                                                                                            | Baja (higiene documental)          |
| I8  | "Expediente" deshabilitado en la navegación con href `#expediente`, pese a que el módulo existe dentro de empleado.                                                                                                                                                                                                                                                          | Media (afecta al alcance de F1/F2) |

---

## 3. Estrategia de rediseño

### 3.1 Cómo dividir el proyecto

Tres calles paralelas con dependencias explícitas:

1. **Fundaciones** (transversal): tokens, componentes, shell, navegación, lenguaje. Todo lo demás depende de esto.
2. **Rediseño de módulos existentes** (incremental): re-vestir y re-fluir módulo a módulo sobre las fundaciones, ordenado por frecuencia de uso diaria.
3. **Diseño anticipado de módulos venideros** (estratégica): patrones UX para los motores que el roadmap funcional traerá — nómina P1/P2, superficie contable (según F0), facturación electrónica con Matías API, y a futuro tesorería/PILA — sincronizados con ese roadmap para llegar **antes** que cada implementación.

### 3.2 Fases propuestas

- **F0 — Alineación y descubrimiento** (corta, bloqueante): resolver las preguntas abiertas (§3.4), validar perfiles de usuario y JTBD con al menos un operador real, auditoría heurística formal por módulo, tree-test/card-sort ligero de la navegación propuesta. Entregable: este plan aprobado + mapa de IA validado.
- **F1 — Fundaciones**: resolver tokens de DESIGN.md (color de acento, tipografía, espaciado, elevación, semántica de estados), construir el kit de componentes faltante, App Shell v2 (navegación agrupada, un solo sistema de títulos, breadcrumbs, contexto de empresa, permisos), glosario de microcopy en español correcto.
- **F2 — Núcleo diario**: dashboard operativo real (alertas, vencimientos, accesos al trabajo del día), empleados + expediente, contratos + lotes, alertas. Es donde vive el 80 % del uso.
- **F3 — Motores**: experiencia de nómina alineada a ADR-002 (estados, revisión/aprobación, bloqueos fail-secure, desprendibles, evidencia de congelamiento) — diseñada en paralelo al desarrollo de P1; facturación.
- **F4 — Superficies nuevas y periferia**: UI contable (si F0 decide exponerla: períodos, comprobantes, libros, cierre), configuración/identidad, perfil, preparación de patrones para tesorería/PILA.
- **F5 — Landing y marca** (opcional/paralela): alinear la landing al sistema visual resultante.

### 3.3 Orden de ataque y qué se conserva

**Primero**: fundaciones (F1) — sin tokens ni componentes todo rediseño de pantalla nace inconsistente. Inmediatamente después el **dashboard y la navegación** (mayor deuda visible, menor riesgo funcional: casi no tienen lógica).

**Rediseño profundo**: dashboard (D1), navegación/shell (D2, D3), nómina (D6 — con ventana de tiempo), alertas (D10).

**Rediseño ligero (solo alinear al sistema, conservar flujos)**: sedes, plantillas, documentos generados, importación de empleados, identidad corporativa — están validados end-to-end y sus flujos funcionan; se re-vestimentan con los nuevos componentes sin tocar su lógica ni su estructura.

**Para el final**: facturación (a la espera de la integración Matías API real que puede cambiar los flujos), perfil, landing.

### 3.4 Información adicional necesaria (preguntas antes de diseñar)

1. **¿Qué superficie funcional del motor contable será visible en cada fase, y para qué perfil?** El motor existe (C0–C3); lo indefinido es su exposición progresiva: qué capacidades se muestran primero (p. ej. consulta de reportes), cuáles después (comprobante manual, cierre de período) y quién accede a cada una (contador externo, ADMIN). Define ramas enteras de la IA. (Relacionado con I2.)
2. **¿Existen los documentos `LA_OFICINA_NITIDA_CONTEXT.md` y `Decisiones de Producto.md`** fuera del repo? Si contienen decisiones de producto no reflejadas aquí, deben incorporarse antes de F1.
3. **¿Hay clientes usando el producto en producción hoy?** Cambia el riesgo del rediseño (migración de hábitos vs. lienzo casi libre).
4. **¿Hay acceso a usuarios reales** (auxiliar administrativo de un operador educativo) para entrevistas cortas y pruebas de los flujos de nómina/contratos?
5. **¿Existe identidad de marca** (logo, color corporativo) o el acento de DESIGN.md se decide en F1?
6. **¿VIEWER entra en el alcance** de esta versión de la UI? (I4)
7. **¿La landing entra en el alcance** de este proyecto de rediseño?

(Se retira la pregunta sobre dispositivos objetivo: PRODUCT.md ya define el contexto de uso — computadores de oficina, desktop-first — y se toma como dado.)

---

## 4. Arquitectura de experiencia

### 4.1 Navegación (estado actual → dirección)

Hoy: lista plana de 13 ítems cuyo orden mezcla identidad personal, configuración, operación y motores. Del análisis se desprende una **hipótesis de agrupación** — no una decisión — a validar con card-sort/tree-test en F0: los ítems se agrupan naturalmente por el modelo mental del operador, que coincide con el dominio (trabajo del día · personas y contratos · documentos · motores de proceso · organización · personal). La agrupación definitiva sale de F0.

Observaciones que la IA definitiva deberá resolver (sea cual sea la agrupación elegida):

- Existe un ítem deshabilitado como señuelo ("Expediente", href `#expediente`) mientras el módulo real vive dentro del detalle de empleado (D2/I8).
- Subrutas reales (`nomina/periodos`, `facturacion/clientes|productos|facturas`) no son alcanzables desde la navegación; solo desde enlaces dentro del contenido.
- La relación jerárquica Contratos ↔ Lotes y Plantillas ↔ Generados no se expresa: aparecen como hermanos sueltos.
- Los espacios personales (Perfil) y de configuración (Identidad) compiten en la misma lista con los módulos operativos.

### 4.2 Arquitectura de información

El principio rector: **la jerarquía visible debe ser la del dominio** (Tenant → Sede → Empleado → Contrato → Expediente → Documento). Hoy esas relaciones existen en datos pero son invisibles en la superficie: el empleado es el hub natural (su contrato, su expediente, su sede, sus liquidaciones futuras) y debe experimentarse como tal. Los motores (nómina, contabilidad, facturación) son espacios de **proceso por período**, con el período como unidad de navegación y el estado como información primaria.

### 4.3 Consistencia entre módulos

El diagnóstico identifica tres frentes donde los módulos divergen hoy; su formalización como "contratos de consistencia" se decidirá y documentará en F1:

1. **Contrato de página**: un solo PageHeader (título, descripción, acciones primarias, breadcrumb) — elimina la doble titulación (D3) y el mapeo hardcodeado del shell.
2. **Contrato de colección**: toda lista (empleados, contratos, facturas, períodos, comprobantes) usa la misma tabla: búsqueda, filtros, paginación, densidad, empty state, columnas de estado con el mismo StatusBadge.
3. **Contrato de estado**: los estados de dominio (VIGENTE/VENCIDO/…, BORRADOR→CERRADA, ABIERTO/CERRADO, EMITIDA/…) se representan con **un único lenguaje visual semántico** (color+icono+etiqueta) en todo el producto. El color comunica estado, nunca decora (corrige D4).

### 4.4 Productividad y carga cognitiva

- **El pico de valor es el lote**: importación de 500 empleados, contratos masivos, ZIP. Estos flujos merecen la mejor UX de progreso, validación previa y reporte de errores del producto (hoy son funcionales pero planos).
- **Densidad progresiva**: el operador experto quiere tablas densas y teclado; el nuevo, guía. Resolver con defaults calmados y densidad/atajos opcionales, no con dos productos.
- **Reducir navegación de ida y vuelta**: las acciones frecuentes desde la lista (generar documento desde empleado, renovar desde alerta) sin viajar a tres pantallas — respetando siempre los casos de uso existentes, sin inventar operaciones nuevas.
- **Carga cognitiva del miedo**: en nómina y contabilidad la ansiedad del usuario es "¿esto ya no se puede deshacer?". La UI debe responder siempre, de forma pasiva, tres preguntas: _¿en qué estado está?, ¿qué sigue?, ¿es reversible?_

### 4.5 La experiencia diaria del usuario administrativo (hoy vs. objetivo)

Hoy: entra → dashboard que le habla de JWT y módulos "pendientes" → navega por prueba y error una lista plana → trabaja en tablas correctas pero desiguales → las alertas son una lista sin prioridad.

Objetivo: entra → ve su día (vencimientos próximos, procesos de nómina en revisión, lotes en curso, importaciones con errores) → cada elemento lo lleva directo a la acción → los estados y la evidencia de auditoría le confirman que todo quedó en regla.

---

## 5. Principios de diseño

Extienden (no reemplazan) los cuatro de PRODUCT.md. Gobiernan toda decisión posterior; nada de colores ni componentes aquí.

1. **La estructura visible es la del dominio.** Navegación, jerarquía y agrupación reflejan Tenant → Sede → Empleado → Contrato → Expediente y los procesos por período. Si la UI necesita explicar la estructura con texto, la estructura está mal.
2. **El estado es el protagonista.** Este producto administra máquinas de estado (contratos, nóminas, períodos, facturas). Toda entidad muestra su estado, la acción siguiente y su reversibilidad, con un único lenguaje visual en todo el producto.
3. **Confianza por evidencia, no por decoración.** La trazabilidad que el backend ya garantiza (quién, cuándo, qué versión, congelado/inmutable) se hace visible con sobriedad. Los candados y sellos se muestran cuando existen de verdad.
4. **Fail-secure también en la superficie.** Un bloqueo (nómina no liquidable, transición ilegal, período cerrado) nunca es un error críptico: explica el motivo, señala al responsable de resolverlo y no deja callejones sin salida. Herencia directa de ADR-002 §10.
5. **Calma operativa.** Neutros, un acento, cero alarmismo cromático (anti-Siigo). La urgencia se expresa por jerarquía y posición, no por saturación. Las alertas informan y priorizan; no gritan.
6. **El lote es primera clase.** Los flujos masivos (importar, generar por lote, ZIP) reciben el mejor tratamiento de validación previa, progreso y reporte de errores, porque son el pico de dolor del cliente.
7. **Un solo idioma, impecable.** Español colombiano correcto (tildes incluidas), vocabulario del dominio del usuario (liquidación, comprobante, expediente, sede) y cero jerga interna (tenant, motor, dominio, JWT, MVP) en superficie de usuario.
8. **Consistencia antes que novedad.** Un patrón nuevo solo se introduce si ningún patrón existente resuelve el caso; cada patrón nuevo se documenta en el sistema de diseño o no existe.
9. **Denso para el experto, guiado para el nuevo.** Defaults calmados y aprendibles; densidad, atajos y velocidad disponibles sin convertir la pantalla en un ERP.
10. **Accesible por contrato.** WCAG AA, navegación por teclado real en formularios y tablas, `prefers-reduced-motion` — como criterio de aceptación por pantalla, no como auditoría final.

---

## 6. Roadmap de diseño

Solo orden y entregables; ningún diseño todavía. Cada fase tiene una compuerta de aprobación.

| Fase                        | Contenido                                                                                                                                                                                                                                                                                                       | Entregables                                                                                                                       | Compuerta                                                             |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **F0 — Alineación**         | Respuestas a §3.4; validación de perfiles/JTBD con un operador real o experto funcional; auditoría heurística formal por módulo; card-sort/tree-test de la hipótesis de IA (§4.1).                                                                                                                              | Plan aprobado; mapa de IA validado; definición de la superficie funcional contable visible por fase; glosario de dominio para UI. | Aprobación del dueño del producto.                                    |
| **F1 — Fundaciones**        | Resolución de tokens de DESIGN.md (acento, tipografía, escala, semántica de estados); kit de componentes faltante (PageHeader, Table, Form, Select, Dialog/Confirm, Tabs, Toast, DatePicker, EmptyState, StatusBadge); App Shell v2 (nav agrupada, títulos únicos, breadcrumbs, permisos); normas de microcopy. | DESIGN.md completado (tokens + componentes documentados); shell y kit implementables.                                             | Revisión de sistema de diseño.                                        |
| **F2 — Núcleo diario**      | Dashboard operativo real; empleados (lista, detalle-hub, expediente); contratos + lotes; alertas priorizadas y accionables. Migración visual (sin cambio de flujo) de sedes, plantillas, generados, identidad.                                                                                                  | Módulo a módulo, cada uno auditable contra los tres contratos de consistencia (§4.3).                                             | Validación con usuario/operador por módulo.                           |
| **F3 — Motores**            | Experiencia de nómina ADR-002: períodos y estados, flujo revisión/aprobación, bloqueos fail-secure, desprendible, evidencia de congelamiento — **diseñada antes/junto a P1 backend**; facturación alineada.                                                                                                     | Especificación UX de nómina lista antes de P1-U9/U10; facturación migrada.                                                        | Coherencia verificada contra ADR-002 (estados y invariantes exactos). |
| **F4 — Superficies nuevas** | UI contable según la superficie funcional por fase definida en F0 (períodos, comprobantes, libros/reportes de C2, cierre C3); patrones preparados para tesorería/PILA; configuración y perfil.                                                                                                                  | Especificación UX contable coherente con ADR-001 (append-only, reverso, cierre).                                                  | Coherencia verificada contra ADR-001.                                 |
| **F5 — Landing y marca**    | Alineación de la landing al sistema resultante.                                                                                                                                                                                                                                                                 | Landing actualizada.                                                                                                              | Opcional / según decisión comercial.                                  |

**Sincronización con el roadmap funcional**: F1–F2 no dependen de ningún desarrollo backend. F3 debe completar su especificación **antes** de que P1-U9 (flujo de aprobación) y P1-U10 (desprendible) se implementen, para que la primera implementación ya nazca con la experiencia correcta. F4 depende de la decisión I2/pregunta 1.

---

## 7. Criterios de éxito del rediseño

- El dashboard responde "¿qué tengo que hacer hoy?" en una pantalla.
- Un auxiliar nuevo ejecuta el ciclo alta → contrato → expediente sin inducción externa (principio de PRODUCT.md "rápida curva de aprendizaje", ahora medible).
- Cero textos con jerga interna y cero inconsistencias ortográficas en superficie de usuario.
- Todos los estados de dominio del producto usan el mismo sistema visual.
- Ninguna pantalla usa colores fuera de los tokens (auditable con lint).
- La especificación UX de cada motor existe antes de que su fase funcional exponga flujos al usuario: nómina antes de P1 (aprobación/desprendible), superficie contable antes de exponerse según lo definido en F0, facturación antes de la integración real con Matías API.
- WCAG AA verificado por pantalla rediseñada.

---

_Fin del Plan Maestro de Rediseño. Pendiente de aprobación antes de iniciar F0/F1._
