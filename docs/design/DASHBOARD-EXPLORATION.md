# DASHBOARD-EXPLORATION.md — Exploración de dirección del Dashboard

| Campo                | Valor                                                                                                            |
| -------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Documento**        | Exploración de conceptos para el Dashboard (previo al diseño definitivo)                                         |
| **Fecha**            | 2026-07-03                                                                                                       |
| **Estado**           | Propuesto — pendiente de selección de dirección                                                                  |
| **Rige**             | `PLAN-MAESTRO-REDISENO.md` · `PRODUCT-UX-AUDIT.md` · `DESIGN-SYSTEM.md` · `APP-SHELL.md` (los cuatro, canónicos) |
| **Ámbito**           | Dirección conceptual del Dashboard. **No** contiene mockups, diseño visual, componentes ni código.               |
| **Pregunta rectora** | **¿Qué necesita hacer hoy un operador administrativo?** Toda decisión se mide contra esto.                       |

---

## 0. Inventario de datos reales (la restricción que gobierna todo)

Ningún concepto puede mostrar lo que el backend no entrega. Esto es lo verificado en código; es el material con el que se puede construir, y nada más.

| Fuente          | Endpoint / hook                 | Datos agregables hoy                                                                                                                                                                                                         | Nota                                                                                                                                                                                                                                                                                                |
| --------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Alertas**     | `GET /alerts` (`useAlerts`)     | Lista de `AlertItem { titulo, descripcion, severity: INFO\|WARNING\|CRITICAL, status: OPEN\|RESOLVED, dueDate, employee, expedienteDoc, createdAt }` + `stats { open, resolved, critical }`. Filtrable por estado/severidad. | **Única fuente con dimensión de urgencia/vencimiento** (`dueDate` = `contrato.fechaFin`, PR3 Fase 2). ⚠️ Las alertas se **generan manualmente** con botones (ALERT-01): el dashboard puede _leerlas_, pero su frescura depende de una acción. Es un condicionante de diseño, no un dato a inventar. |
| **Nómina**      | `GET /payroll/dashboard`        | `{ totalPeriodos, empleadosLiquidados, totalDevengos, totalDeducciones, totalNeto, ultimoPeriodo }` + lista de períodos con `status` (hoy `DRAFT\|CLOSED`)                                                                   | Modelo N2 actual; los 7 estados de ADR-002 llegan en F3.                                                                                                                                                                                                                                            |
| **Facturación** | `GET /billing/dashboard`        | `{ clientesActivos, facturasEmitidas, facturasBorrador, totalFacturado }`                                                                                                                                                    | —                                                                                                                                                                                                                                                                                                   |
| **Contratos**   | `GET /contracts`                | `meta.total` + filtrable por `estado` (VIGENTE/VENCIDO/TERMINADO/RENOVADO) → conteos derivables                                                                                                                              | Sin endpoint de "próximos a vencer" propio; eso vive en Alertas.                                                                                                                                                                                                                                    |
| **Lotes**       | `GET /contracts/lotes`          | Lista con `estado` (PENDIENTE/EN_PROCESO/COMPLETADO/COMPLETADO_CON_ERRORES/FALLIDO), `total`, `procesados`, `fallidos`                                                                                                       | **Los lotes en proceso son consultables** — dimensión de "trabajo en curso".                                                                                                                                                                                                                        |
| **Empleados**   | `GET /employees`                | `meta.total` + filtrable por `estado` (ACTIVO/INACTIVO)                                                                                                                                                                      | Conteo de planta.                                                                                                                                                                                                                                                                                   |
| **Expediente**  | `GET /employees/:id/expediente` | Stats **por empleado** (no global)                                                                                                                                                                                           | "Documentos faltantes" a nivel global solo existe reflejado en Alertas.                                                                                                                                                                                                                             |
| **Sesión**      | `useMe`                         | `{ nombre, rol: ADMIN\|OPERADOR, tenantNombre }`                                                                                                                                                                             | Habilita saludo, contexto de empresa y **adaptación por rol**.                                                                                                                                                                                                                                      |

**Lo que NO existe** (y por tanto ningún concepto puede asumir): endpoint de "tareas del día" transversal, feed de actividad/historial, series temporales, notificaciones, búsqueda global, "documentos faltantes" global fuera de alertas. Un dashboard transversal es **composición en cliente** de las fuentes de arriba (varias queries de React Query) — factible sin API nueva.

---

## 1. Auditoría del Dashboard actual

Archivo: `features/dashboard/components/dashboard-home.tsx` (leído íntegro).

### 1.1 Qué intenta resolver

Confirmar al usuario, tras el login, **que su sesión es válida y aislada**: quién es, en qué empresa opera, con qué rol, y presentar un "mapa de crecimiento" de módulos. Es, en esencia, una pantalla de _acuse de identidad_.

### 1.2 Qué funciona bien

- Técnicamente sólido: maneja `loading` (skeletons anatómicos), `error` de sesión, y usa tokens del sistema (no linaje gray).
- Jerarquía tipográfica cuidada (hero `display`, paneles de info).
- El saludo personalizado (`Hola, {nombre}`) es el germen correcto de una pantalla que debería hablarle al usuario.
- Comunica el aislamiento multiempresa, que es un valor real del producto (PRODUCT.md).

### 1.3 Qué no funciona

- **Desinforma** (DASH-01): lista Empleados, Contratos, Expediente, Alertas, Facturación como "Pendiente / Próximas fases" cuando **todos operan**. La primera pantalla diaria miente sobre el estado del producto.
- **Cero valor operativo** (DASH-02): no muestra un solo dato del trabajo — ni un vencimiento, ni una alerta, ni un lote en curso, ni una nómina pendiente. Responde "¿estás autenticado?", no "¿qué haces hoy?".
- **Habla el idioma del backend** (DASH-03): "El access token se renueva desde una cookie HTTP-only", "El tenant actual proviene del JWT", "empresa: aislada". Jerga técnica donde el usuario espera su operación (TR-09).
- Es una pantalla **terminal**: no lleva a ningún trabajo; hay que abandonarla para hacer algo.
- Microcopy con tildes ausentes (DASH-04).

### 1.4 Qué conservar

- El saludo personalizado con el nombre.
- El manejo riguroso de loading/error.
- El uso disciplinado de tokens.
- La sobriedad visual (nada de sobrecarga cromática).
- La idea —bien ejecutada, mal aplicada— de un hero de bienvenida breve.

### 1.5 Qué debe desaparecer

- La lista de "módulos preparados / Pendiente" completa (DASH-01): contradice la realidad y repite lo que ahora hace la navegación del App Shell.
- Todo el contenido técnico: cookies, JWT, tenant, "empresa aislada", "acceso vigente" (DASH-03).
- El badge "MVP Auth" y el marco de _acuse de sesión_ como propósito central.
- Los paneles de "estado de sesión" como bloque protagonista.

### 1.6 Qué información falta (y existe en datos, §0)

- **Vencimientos y alertas críticas** (Alertas): lo más cercano al job central del cliente ("preavisos").
- **Trabajo en curso**: lotes `EN_PROCESO`, nóminas sin cerrar.
- **Puntos de entrada al trabajo frecuente**: crear empleado, generar contrato, nuevo lote.
- **Pulso de la planta**: nº de empleados activos, contratos vigentes/vencidos.
- **Contexto de rol**: qué le corresponde a ADMIN vs OPERADOR.

### 1.7 Qué tareas diarias debería facilitar

1. Ver de un vistazo **qué requiere atención hoy** (vencimientos, alertas críticas, lotes con errores, nóminas pendientes).
2. **Actuar** sobre ello sin cazar la pantalla correcta.
3. **Arrancar** el trabajo frecuente en un clic (altas, generación documental).
4. Confirmar el **contexto seguro** (empresa/rol) de forma discreta, no como protagonista.

---

## 2. Problemas detectados (síntesis)

| #   | Problema                                                                                          | Origen           |
| --- | ------------------------------------------------------------------------------------------------- | ---------------- |
| P1  | El dashboard responde la pregunta equivocada ("¿estás autenticado?" en vez de "¿qué haces hoy?"). | DASH-02          |
| P2  | Desinforma sobre el estado real del producto.                                                     | DASH-01          |
| P3  | Habla en jerga técnica.                                                                           | DASH-03 / TR-09  |
| P4  | Es terminal: no conduce a ninguna acción.                                                         | DASH-02          |
| P5  | Duplica la función de "mapa de módulos" que ahora cumple la navegación del shell.                 | NAV-01 + DASH-01 |
| P6  | No aprovecha ninguna de las fuentes de datos reales disponibles (§0).                             | DASH-02          |

---

## 3. Objetivos del nuevo Dashboard

1. **Responder la pregunta rectora** en una pantalla: qué necesita hacer hoy el operador.
2. **Conducir a la acción**: cada elemento lleva directo al trabajo; nada es decorativo ni terminal.
3. **Alimentarse solo de datos reales** (§0), asumiendo cero APIs nuevas.
4. **Validar el sistema**: demostrar App Shell (PageHeader, anatomía de página), Design System (tokens, StatusBadge, estados), IA (coherencia con los grupos del nav) y navegación (enlaces al trabajo real).
5. **Ser calmado** (principio 5 del Plan Maestro): prioriza por jerarquía y posición, no por saturación cromática. No es un tablero de métricas ni de marketing.
6. **Ser consciente del rol** sin inventar permisos: usa `rol` de la sesión (H2) para ordenar lo relevante.
7. **Escalar** a los módulos por venir (contabilidad, tesorería) sin rediseñarse.

**No-objetivos explícitos:** métricas históricas/gráficas (no hay datos), KPIs de vanidad, tarjetas bonitas sin acción, feed de actividad (no hay API), duplicar la navegación.

---

## 4. Conceptos

Cinco filosofías organizativas distintas, todas nacidas de **este** dominio y **estos** datos. Cada una se describe por su principio ordenador, sus zonas y su lógica — no por su aspecto.

---

### Concepto A — "Bandeja del día" (orientado a tareas / triaje)

**Filosofía.** El dashboard es una **bandeja de entrada que se vacía**, no un informe que se lee. Una sola lista priorizada de cosas que hoy requieren una decisión o una acción, compuesta de todas las fuentes: alertas críticas y por vencer, lotes con errores o en proceso, nóminas sin cerrar, documentos faltantes (vía alertas). Cada ítem es accionable y desaparece de la bandeja al resolverse. El éxito del día se mide por una bandeja vacía.

**Estructura (verbal).** Cabecera breve (saludo + una línea de contexto: "Tienes N asuntos que atender hoy"). Debajo, **una columna única priorizada** por urgencia: primero lo crítico/vencido, luego lo próximo a vencer, luego lo en curso, luego lo informativo. Cada fila: qué es, a quién/qué afecta, desde cuándo, y una acción directa (Resolver, Ver, Renovar-lleva-al-contrato). Filtro ligero por tipo. Estado vacío afirmativo ("Todo al día").

**Ventajas.** Responde la pregunta rectora de la forma más literal posible. Convierte datos dispersos en una sola cola de trabajo. Escala trivialmente: un módulo nuevo aporta ítems a la misma bandeja. Enseña el uso de StatusBadge y de la taxonomía de estados en su forma más pura.

**Desventajas.** Depende fuertemente de Alertas, cuya generación es manual hoy (ALERT-01): una bandeja vacía puede significar "todo al día" _o_ "nadie generó las alertas". Debe resolver esa ambigüedad honestamente (indicar frescura / última generación) sin inventar automatización. Menos útil para el usuario que entra a _arrancar_ una tarea nueva (no a atender pendientes).

**Carga cognitiva.** Muy baja: una sola lista, un solo criterio de orden. El usuario no elige dónde mirar.

**Productividad.** Máxima para el trabajo reactivo (atender lo que vence/falla). Baja fricción: leer → actuar en el mismo lugar.

**Escalabilidad.** Excelente. La bandeja es agnóstica al origen; contabilidad (períodos por cerrar), tesorería (pagos pendientes) y nómina ADR-002 (liquidaciones en revisión) se suman como nuevos tipos de ítem sin tocar la estructura.

**Impacto en módulos futuros.** Define el patrón "ítem accionable de bandeja" que todo módulo futuro reutiliza para insertar sus pendientes. Alinea con el indicador de Alertas del sidebar (§4.6 del App Shell).

**Por qué podría ser la mejor.** Es la traducción más directa de "¿qué necesito hacer hoy?" a una interfaz. Y es la que más rotundamente entierra el dashboard actual (de acuse de sesión a cola de trabajo).

---

### Concepto B — "Estado de la operación" (orientado a procesos / por dominio)

**Filosofía.** El dashboard es un **mapa del estado de la operación**, organizado por las mismas áreas del dominio que estructuran la navegación (Personal, Documentos, Procesos, Organización — los grupos de AS-D1). Cada área muestra su pulso actual (conteos reales) + lo único que reclama atención en ella + su punto de entrada. Es un tablero de mando estructurado como el negocio.

**Estructura (verbal).** Cabecera breve. Debajo, una retícula de **paneles-por-área**: Personal (empleados activos, contratos vigentes/vencidos, "N contratos vencen pronto" → alertas), Documentos (plantillas activas, generados recientes), Procesos (último período de nómina y su estado, facturación borrador/emitida), Organización (sedes). Cada panel: 1–2 cifras de pulso + un enlace de atención + un enlace de entrada.

**Ventajas.** Da visión de conjunto del negocio en una pantalla. Refuerza y valida la IA del App Shell (los paneles espejan los grupos del nav). Reutiliza los `dashboard` endpoints ya existentes de nómina y facturación casi tal cual.

**Desventajas.** **Riesgo de recaer en el fallo actual**: un tablero de paneles puede convertirse otra vez en un "mapa de módulos" bonito pero terminal, más cerca del marketing dashboard que el usuario prohibió. La atención queda diluida entre áreas en vez de priorizada. Empuja a "mirar" más que a "hacer".

**Carga cognitiva.** Media: el usuario debe escanear varias áreas y decidir dónde importa. Más información simultánea.

**Productividad.** Buena como launchpad (entrar a cada área), media para actuar sobre urgencias (no las prioriza entre sí).

**Escalabilidad.** Buena estructuralmente (un módulo nuevo = un panel nuevo), pero **peligrosa**: a más módulos, más paneles compitiendo, y el riesgo de saturación crece — justo lo que el Plan Maestro quiere evitar.

**Impacto en módulos futuros.** Contabilidad y tesorería reclamarían su propio panel; el tablero podría volverse ddenso. Requiere gobernanza de cuántos paneles caben.

**Por qué podría ser la mejor.** Si el operador valora "ver cómo va todo" antes de actuar, este es el más informativo. Es también el que más explícitamente valida la coherencia entre dashboard y navegación.

---

### Concepto C — "Radar de vencimientos" (orientado a alertas / línea de tiempo)

**Filosofía.** El valor #1 del producto para el cliente es **no dejar vencer un contrato** ("preavisos", START_HERE/PRODUCT). El dashboard es, ante todo, ese **radar temporal**: una línea de tiempo de lo que viene — contratos que vencen en 7/15/30 días, ordenados cronológicamente. Todo lo demás es secundario y se subordina al eje del tiempo.

**Estructura (verbal).** Cabecera breve. Cuerpo dominado por una **secuencia cronológica de vencimientos** (desde `dueDate` de las alertas de contrato), agrupada por horizonte temporal (vencidos / esta semana / este mes / más adelante), cada entrada con el empleado, el contrato y una acción (Renovar → contrato). Una franja secundaria y discreta debajo para lo no-temporal (lotes en curso, nómina pendiente).

**Ventajas.** Ataca de frente el job central y diferenciador del segmento. Convierte la propuesta de valor comercial en la primera pantalla. Usa `dueDate` real, ya disponible. Es el más _memorable_ ("el software que no te deja vencer un contrato").

**Desventajas.** **Demasiado estrecho** para ser el único dashboard: un operador hace mucho más que vigilar vencimientos (altas, documentos, nómina, facturación). Depende íntegramente de que las alertas de contrato estén generadas (ALERT-01) — sin generación, el radar está ciego. Los días de anticipación (7/15/30) existen como severidad de alerta, no como corte temporal explícito garantizado.

**Carga cognitiva.** Baja en su eje (una línea de tiempo), pero deja fuera del foco tareas que el usuario igual necesita, forzándolo a navegar para el resto.

**Productividad.** Máxima para el subconjunto "vencimientos"; nula para el resto del trabajo diario.

**Escalabilidad.** Limitada como concepto rector: el tiempo es un buen eje para vencimientos, pero contabilidad/tesorería/nómina no son primordialmente cronológicos. Envejecería como "el dashboard de contratos", no del producto.

**Impacto en módulos futuros.** Bajo: los módulos por venir no encajan naturalmente en un eje de vencimientos. Sería un dashboard que no crece con el producto.

**Por qué podría ser la mejor.** Si la estrategia comercial es liderar con "preavisos" como diferenciador, ninguna otra dirección lo comunica con tanta fuerza desde la pantalla de inicio.

---

### Concepto D — "Tu turno de trabajo" (orientado al trabajo del día / consciente del rol)

**Filosofía.** El dashboard **se adapta a quién eres y reanuda tu flujo**. Dos zonas: "Requiere tu atención" (lo que a _tu rol_ le toca decidir/hacer hoy) y "Tu trabajo" (accesos para arrancar y continuar). Un ADMIN ve lo que aprueba/cierra; un OPERADOR ve lo que captura/genera. El dashboard es el arranque personalizado de la jornada, no un informe general.

**Estructura (verbal).** Cabecera con saludo + contexto de empresa/rol discreto. **Zona 1 "Requiere tu atención":** pendientes filtrados por rol y prioridad (para ADMIN: nóminas por cerrar/aprobar-en-F3, lotes con errores, alertas críticas; para OPERADOR: alertas por atender, lotes en proceso, importaciones con errores). **Zona 2 "Tu trabajo":** puntos de entrada frecuentes (crear empleado, generar contrato, nuevo lote, nueva factura) según lo que el rol puede hacer (contrato de permisos §8.10 del App Shell, sin inventar reglas).

**Ventajas.** Responde la pregunta rectora _personalizada_: "qué necesitas hacer **tú** hoy". Usa el rol de la sesión (dato real). Combina atención (reactivo) y arranque (proactivo) en una sola pantalla. Valida el contrato de permisos del App Shell de forma tangible.

**Desventajas.** La distinción ADMIN/OPERADOR es hoy binaria y el backend no separa "crear" de "aprobar" (ADR-002 §6 lo deja para un RBAC futuro): la adaptación por rol sería _editorial_ (qué se enfatiza), no _de permisos duros_, y hay que ser honesto sobre ese límite para no prometer segregación que el sistema aún no impone. Dos zonas = algo más de estructura que la bandeja única.

**Carga cognitiva.** Baja-media: dos zonas claras con propósito distinto (atender vs. arrancar).

**Productividad.** Alta y equilibrada: sirve tanto al día reactivo (zona 1) como al proactivo (zona 2). El más completo como "pantalla de arranque de jornada".

**Escalabilidad.** Muy buena: los módulos futuros aportan a "Requiere tu atención" (nuevos pendientes por rol) y a "Tu trabajo" (nuevas acciones), sin cambiar la estructura de dos zonas. Cuando llegue el RBAC granular y los estados de nómina ADR-002, este concepto los absorbe nativamente.

**Impacto en módulos futuros.** Alto y positivo: define desde ya el patrón "atención por rol", que es exactamente la forma en que nómina (revisor/aprobador) y contabilidad (cierre) querrán aparecer.

**Por qué podría ser la mejor.** Es el que mejor equilibra reactivo + proactivo y el único que prepara explícitamente el terreno para la segregación de deberes que los ADR anticipan, sin inventarla hoy.

---

### Concepto E — "Panel de arranque" (orientado a productividad / acción rápida)

**Filosofía.** El trabajo del dashboard es **lanzarte al trabajo en un clic** y quitarse de en medio. Minimalista: saludo, una línea-resumen de "hoy", una retícula de acciones primarias, y una franja delgada de pendientes. Es un trampolín, no un destino. Optimizado para el usuario experto que entra a _hacer_, no a leer.

**Estructura (verbal).** Cabecera con saludo. Una **línea-resumen** ("3 alertas críticas · 1 lote en proceso · nómina de octubre sin cerrar") como texto denso y escaneable, cada fragmento enlazado. Debajo, una **retícula de acciones de arranque** (nuevo empleado, generar contrato, nuevo lote, nueva factura, generar alertas). Nada más.

**Ventajas.** El más rápido para el experto diario. Mínima carga. Cero riesgo de "dashboard bonito terminal". Barato de construir y de mantener. Muy alineado con la calma del sistema.

**Desventajas.** **Demasiado delgado para ser la pantalla que valida todo el trabajo** (objetivo 4): apenas ejercita el Design System y la anatomía de página. Para el usuario nuevo aporta poca orientación (asume que ya sabe qué hacer). La "línea-resumen" comprime la urgencia en texto, perdiendo la priorización visual que el job de vencimientos merece.

**Carga cognitiva.** Mínima, casi austera.

**Productividad.** Máxima para arrancar tareas; baja para _entender_ qué está pendiente (lo resume, no lo despliega).

**Escalabilidad.** Buena por simplicidad (añadir una acción o un fragmento de resumen), pero como concepto rector se queda corto: no hay dónde crezca la profundidad que contabilidad/nómina traerán.

**Impacto en módulos futuros.** Neutro: no estorba, pero tampoco define patrones ricos que los módulos futuros puedan heredar.

**Por qué podría ser la mejor.** Si la prioridad absoluta es velocidad para usuarios expertos y un mantenimiento mínimo, es el más eficiente. Como _complemento_ de otro concepto (su retícula de acciones) es muy valioso.

---

## 5. Comparativa

| Criterio                                    | A · Bandeja | B · Estado operación      | C · Radar vencimientos    | D · Turno de trabajo | E · Panel arranque |
| ------------------------------------------- | ----------- | ------------------------- | ------------------------- | -------------------- | ------------------ |
| Responde "¿qué hago hoy?"                   | ★★★★★       | ★★★☆☆                     | ★★★☆☆ (solo vencimientos) | ★★★★★                | ★★★☆☆              |
| Conduce a la acción                         | ★★★★★       | ★★★☆☆                     | ★★★★☆                     | ★★★★★                | ★★★★☆              |
| Carga cognitiva (menos = mejor)             | Muy baja    | Media                     | Baja (estrecha)           | Baja-media           | Mínima             |
| Reactivo (atender)                          | ★★★★★       | ★★★☆☆                     | ★★★★☆                     | ★★★★★                | ★★☆☆☆              |
| Proactivo (arrancar)                        | ★★☆☆☆       | ★★★☆☆                     | ★☆☆☆☆                     | ★★★★☆                | ★★★★★              |
| Escalabilidad a módulos ADR                 | ★★★★★       | ★★★☆☆ (riesgo saturación) | ★★☆☆☆                     | ★★★★★                | ★★★☆☆              |
| Valida el sistema (objetivo 4)              | ★★★★☆       | ★★★★☆                     | ★★★☆☆                     | ★★★★★                | ★★☆☆☆              |
| Riesgo de recaer en el fallo actual         | Bajo        | **Alto**                  | Bajo                      | Bajo                 | Muy bajo           |
| Dependencia de generación manual de alertas | Alta        | Media                     | **Total**                 | Media                | Media              |
| Consciencia de rol                          | No          | No                        | No                        | **Sí**               | No                 |
| Coste/complejidad de construir              | Media       | Media                     | Media                     | Media-alta           | Baja               |

Notas de honestidad de datos aplicables a todos: (a) la frescura de alertas depende de una acción manual (ALERT-01) — cualquier concepto que las use debe comunicar la última actualización, no fingir tiempo real; (b) los estados de nómina son los N2 actuales hasta F3; (c) la adaptación por rol es editorial, no de permisos duros, hasta el RBAC granular futuro.

---

## 6. Recomendación final

**Dirección recomendada: Concepto A "Bandeja del día" como columna vertebral, con dos préstamos acotados — la consciencia de rol de D y la lógica cronológica de C como criterio de orden — y la retícula de acciones de E como cierre.**

Razonamiento:

1. **A es la respuesta más literal a la pregunta rectora.** Una cola de trabajo priorizada es, textualmente, "lo que necesito hacer hoy". Ningún otro concepto lo dice con menos rodeos, y es el que más rotundamente sepulta el dashboard-acuse actual.
2. **D aporta lo que a A le falta**: el arranque proactivo y la consciencia de rol. Adoptar de D la idea de "esto te toca a **ti**" (editorial, honesta sobre sus límites) enriquece la bandeja sin cambiar su naturaleza. Por eso no recomiendo D puro: su estructura de dos zonas es valiosa, pero la _priorización unificada_ de A es superior para decidir qué atender primero.
3. **C aporta el criterio de orden correcto**: dentro de la bandeja, los vencimientos de contrato mandan la prioridad, honrando el job central del cliente — sin convertir todo el dashboard en un radar estrecho que no escala (el defecto de C puro).
4. **E aporta el trampolín**: una franja de acciones de arranque al pie cubre al usuario que entra a _hacer_, no a _atender_, sin inflar la pantalla.
5. **Descartados como dirección rectora:** **B** por su riesgo real de recaer en el "mapa de módulos bonito y terminal" que estamos eliminando, y porque diluye la prioridad; **C puro** por estrecho y no escalable; **E puro** por demasiado delgado para validar el sistema (objetivo 4).

Esta dirección **escala a los ADR** (contabilidad, tesorería y nómina-ADR-002 se suman como nuevos tipos de ítem y de acción), **valida el sistema completo** (ejercita PageHeader, StatusBadge, taxonomía de estados, permisos editoriales, anatomía de página), **usa solo datos reales** (§0) y **respeta la calma** del Plan Maestro (una lista priorizada, no un muro de tarjetas).

**Condición de diseño a resolver en la fase definitiva** (no ahora, y sin inventar API): cómo comunica la bandeja su _frescura_ dado que las alertas se generan manualmente (ALERT-01) — probablemente exponiendo "última actualización" y la acción de refrescar que ya existe, en lugar de simular tiempo real. Es la única deuda de dominio que la dirección elegida arrastra, y conviene tenerla explícita antes de diseñar.

---

## 7. Qué decidir ahora

Selecciona una de estas salidas:

1. **Aprobar la dirección recomendada** (A + préstamos de D/C/E) → paso siguiente: diseño definitivo del Dashboard sobre esa base.
2. **Elegir otro concepto puro** (A, B, C, D o E) como dirección → se diseña ese.
3. **Pedir otra combinación** distinta a la recomendada.

No se diseña ninguna pantalla hasta que elijas dirección.

---

_Fin de DASHBOARD-EXPLORATION.md. Pendiente de selección de dirección antes del diseño definitivo._
