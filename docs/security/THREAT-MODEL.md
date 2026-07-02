# Threat Model — Plataforma SaaS multiempresa "La Oficina Nítida"

| Campo           | Valor                                                                                                                                                                             |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Estado**      | Propuesto — pendiente de aprobación                                                                                                                                               |
| **Fecha**       | 2026-07-02                                                                                                                                                                        |
| **Autores**     | Arquitectura · Seguridad (rol Red Team / Principal Security Architect)                                                                                                            |
| **Ámbito**      | Toda la plataforma, módulos presentes y futuros                                                                                                                                   |
| **Naturaleza**  | Documento vivo de modelado de amenazas. No es un ADR de decisión: es el registro adversario que gobierna la revisión de seguridad de toda funcionalidad nueva.                    |
| **Depende de**  | ADR-SEC-001 (documento rector — invariantes S1–S15, zonas Z0–Z5/ZX). Este Threat Model **no redefine** filosofía, principios ni invariantes; los usa como criterio de mitigación. |
| **Relacionado** | ADR-SEC-002 (inventario de implementación actual), ADR-001 (motor contable), y los ADRs futuros SEC-003…SEC-015 reservados en el rector                                           |

> **Regla de lectura.** Cada vez que este documento dice "mitigación arquitectónica", se refiere a una garantía ya definida en el rector (una invariante Sx, una zona Zx o una sección). Si una amenaza no está cubierta por ninguna invariante, es un **gap** y se marca como tal en §20. Un gap es una decisión pendiente, no una implementación autorizada.

---

## 1. Propósito

Este documento existe para **pensar como el atacante durante años**, no para inventariar controles (eso lo hace el rector). Su función operativa es triple:

1. **Compuerta de diseño.** Toda funcionalidad nueva se revisa contra el catálogo de amenazas relevante a su superficie antes de aprobarse. Si introduce una superficie no contemplada aquí, se añade una amenaza antes de escribir código.
2. **Mapa de prioridades.** Concentra el esfuerzo de hardening donde el impacto sobre el negocio (confianza, contabilidad, expedientes) es mayor, no donde es más fácil.
3. **Memoria adversaria.** Registra ataques que hoy no son posibles pero lo serán (IA agéntica, integraciones, crecimiento del equipo), para que el producto no los descubra en producción.

**Qué NO es este documento:** no es una guía de implementación, no elige herramientas, no propone librerías ni configuración. Describe cómo se rompería la plataforma y qué garantía arquitectónica lo impide.

---

## 2. Metodología

### 2.1 Enfoque

Modelado **centrado en el atacante** (attacker-centric), no en cumplimiento. Se parte de los objetivos del adversario (§4) y se recorren las superficies (§6–§18) buscando el camino más barato hacia cada objetivo. Se complementa con una revisión STRIDE por superficie (Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege) para no dejar categorías sin cubrir.

### 2.2 Ficha de cada amenaza

| Campo                            | Significado                                                                                |
| -------------------------------- | ------------------------------------------------------------------------------------------ |
| **ID**                           | Identificador estable (`T-<superficie>-<n>`). No se reutiliza aunque la amenaza se retire. |
| **Objetivo del atacante**        | Qué gana.                                                                                  |
| **Superficie de ataque**         | Por dónde entra; zona(s) de confianza implicada(s).                                        |
| **Precondiciones**               | Qué debe ser cierto para que el ataque sea viable.                                         |
| **Impacto**                      | Consecuencia sobre el negocio si tiene éxito.                                              |
| **Probabilidad**                 | Ver §2.3.                                                                                  |
| **Severidad**                    | Clasificación final (Crítica/Alta/Media/Baja), ver §2.4.                                   |
| **Detección**                    | Qué señal delata el ataque (referida a la observabilidad del rector §19).                  |
| **Mitigaciones arquitectónicas** | Invariante(s) Sx / zona(s) / sección(es) del rector que lo contienen.                      |
| **Relacionado**                  | ADR donde vive el mecanismo o donde debe diseñarse.                                        |

### 2.3 Escala de probabilidad

| Nivel     | Criterio                                                                                                              |
| --------- | --------------------------------------------------------------------------------------------------------------------- |
| **Alta**  | Ataque automatizable, masivo, con herramientas públicas; ocurre de forma continua contra cualquier SaaS expuesto.     |
| **Media** | Requiere objetivo específico, alguna precondición (una cuenta, un token, conocimiento del dominio) o esfuerzo manual. |
| **Baja**  | Requiere insider, compromiso previo de otro componente, o capacidad sofisticada / cadena de varios pasos.             |

### 2.4 Escala de severidad

Severidad = f(impacto sobre la confianza del producto, reversibilidad, alcance). No es solo impacto × probabilidad: una amenaza de probabilidad baja pero que rompe la invariante suprema (aislamiento de tenant o integridad contable) es **Crítica** por definición, porque su materialización, aunque rara, destruye el producto.

| Nivel       | Criterio                                                                                                                                                                                                   |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Crítica** | Rompe S1 (aislamiento de tenant), S5 (inmutabilidad de evidencia) o S6 (auditoría), o compromete cuentas privilegiadas de plataforma. Pérdida de confianza irreparable, daño legal o fraude no detectable. |
| **Alta**    | Fuga o alteración de datos Restringidos de un tenant, escalamiento de privilegios dentro de un tenant, compromiso de cuentas de tenant, fraude detectable pero costoso.                                    |
| **Media**   | Abuso, degradación de servicio, fuga de datos Internos, enumeración; requiere pasos adicionales para causar daño mayor.                                                                                    |
| **Baja**    | Molestia, fuga de metadatos no sensibles, ataques con mitigación robusta ya estructural.                                                                                                                   |

### 2.5 Convención de trazabilidad

Cada amenaza cita las invariantes del rector que la contienen. La cobertura inversa (invariante → amenazas que protege) está en §22. Las amenazas **sin cobertura completa** por el estado implementado actual (ADR-SEC-002) están en §20.

---

## 3. Activos y joyas de la corona

El atacante no quiere "entrar": quiere uno de estos activos. Ordenados por valor.

| #   | Activo                                                                          | Por qué es valioso                                                                            | Clase (rector §10.1)          |
| --- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------- |
| A1  | **Aislamiento entre tenants**                                                   | Es el producto. Romperlo una vez, públicamente, termina el negocio.                           | Invariante S1                 |
| A2  | **Libros y evidencia contable**                                                 | Valor legal/probatorio. Alterarlos = fraude o inutilización de la contabilidad de un cliente. | Restringido / Z5              |
| A3  | **Expedientes de personas** (posibles menores)                                  | Datos personales sensibles; fuga = daño a terceros + sanción Habeas Data.                     | Restringido                   |
| A4  | **Cuentas privilegiadas de plataforma** (superadmin, operadores)                | Llave maestra potencial hacia todos los tenants.                                              | Restringido                   |
| A5  | **Credenciales/certificados de firma fiscal** (futuro DIAN, nómina electrónica) | Permiten emitir documentos fiscales fraudulentos en nombre del tenant.                        | Secreto máximo (rector §14.4) |
| A6  | **Nómina y pagos** (futuro)                                                     | Desvío de dinero real, fraude de liquidaciones.                                               | Restringido                   |
| A7  | **Auditoría**                                                                   | Su alteración vuelve indetectable cualquier otro ataque.                                      | Z5 / S6                       |
| A8  | **Secretos de infraestructura** (JWT_SECRET, DATABASE_URL, claves)              | Compromiso transversal; forjar sesiones, leer toda la base.                                   | Secreto (S8)                  |
| A9  | **Documentos generados** (contratos, certificados)                              | Fuga, falsificación, suplantación institucional.                                              | Restringido                   |
| A10 | **Disponibilidad**                                                              | Ransomware, DoS: rehén del negocio del cliente.                                               | S13 / rector §10.3            |

---

## 4. Perfiles de atacante (threat actors)

| ID  | Actor                                                                    | Motivación                                                              | Capacidad                                                   | Acceso inicial típico                       |
| --- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------- |
| TA1 | **Externo oportunista / bot**                                            | Robo masivo, ransomware, reventa de datos                               | Herramientas públicas, automatización                       | Ninguno (Z0)                                |
| TA2 | **Tenant malicioso** (cliente legítimo)                                  | Espiar competidores, robar datos de otro tenant, evadir límites de plan | Cuenta válida, conoce el producto desde dentro              | Sesión autenticada en su propio tenant (Z3) |
| TA3 | **Usuario interno de un tenant** (operador desleal)                      | Fraude contable, filtrar expedientes, sabotaje                          | Cuenta operativa, conocimiento de datos                     | Sesión con rol limitado                     |
| TA4 | **Atacante dirigido** (competidor, actor con recursos)                   | Comprometer un tenant concreto o la plataforma                          | Phishing, ingeniería social, exploits encadenados           | Variable                                    |
| TA5 | **Insider de plataforma** (empleado, soporte, dev)                       | Fraude, curiosidad, venta de datos, sabotaje al salir                   | Acceso legítimo a infraestructura, código o soporte         | Z3–Z5 según rol                             |
| TA6 | **Proveedor / cadena de suministro**                                     | Compromiso indirecto masivo                                             | Control de una dependencia, del pipeline o de un tercero ZX | Ejecución dentro del build o del runtime    |
| TA7 | **Agente de IA / automatización** (futuro)                               | Ejecutar acciones a escala; vehículo de inyección                       | Iniciativa propia, velocidad, acceso a herramientas         | Identidad propia o delegada                 |
| TA8 | **Autoridad/tercero comprometido** (futuro: DIAN, pasarela, IdP, correo) | Punto de entrada lateral                                                | Confianza contractual abusada                               | Frontera ZX                                 |

---

## 5. Diagrama de superficies y flujo de datos (textual)

```
[TA1 bot] [TA4 dirigido]                         [TA8 tercero ZX: DIAN, IdP, correo, pasarela, IA externa]
     │           │                                                     │
     ▼           ▼                                                     ▼
  Z0 Internet ───────────► Z1 Borde (rate limit, anti-bot) ───► Z2 Frontend (territorio del atacante)
                                                                       │  (toda entrada = hostil)
                                                                       ▼
                                                 Z3 API/Aplicación  ◄──────── [TA2/TA3 sesión válida]
                                                 (authn + tenant + authz por petición)
                                                       │        │
                                       ┌───────────────┘        └───────────────┐
                                       ▼                                         ▼
                              Z4 Datos (BD, storage, colas)            Z5 Evidencia (auditoría,
                              — solo cliente: Z3                        libros cerrados, docs emitidos,
                                       ▲                                backups) — append-only
                                       │
                              [TA5 insider plataforma]  [TA6 supply chain: pipeline, dependencias]
```

Puntos de ruptura que el atacante busca: (a) saltar Z2→Z4 sin pasar por los controles de Z3; (b) que Z3 confíe en un dato que en realidad viene de Z0/Z2; (c) que una identidad de Z3 vea datos de otro tenant; (d) escribir en Z5; (e) robar un secreto que colapse varias zonas a la vez.

---

## 6. Identidad, autenticación y sesiones

### T-ID-1 — Credential stuffing / password spraying

- **Objetivo:** tomar cuentas reutilizando credenciales filtradas de otros servicios.
- **Superficie:** endpoint de login (Z1→Z3). Automatizable.
- **Precondiciones:** conocer emails válidos (o el par `tenantNit`+email); usuarios que reutilizan contraseñas.
- **Impacto:** toma de cuenta; con una cuenta ADMIN de tenant, control del tenant.
- **Probabilidad:** Alta. **Severidad:** Alta.
- **Detección:** ráfagas de fallos de login por IP/identidad; éxitos desde geografías/patrones nuevos (rector §13.2, §19.4).
- **Mitigaciones arquitectónicas:** rate limiting por identidad y por IP en el borde (Z1) y en auth (rector §7.4); autenticación proporcional al riesgo y MFA obligatorio para cuentas privilegiadas (rector §6.2); `tenantNit` como parte de la superficie de credenciales eleva el costo de enumerar (ADR-SEC-002 §4.3). Fail secure (S2).
- **Relacionado:** ADR-SEC-004 (ciclo de sesiones, MFA, recuperación).

### T-ID-2 — Phishing / ingeniería social para robo de credenciales

- **Objetivo:** que el usuario entregue credenciales o segundo factor.
- **Superficie:** correo, canales externos; humano (no hay control técnico en Z0).
- **Precondiciones:** usuario objetivo; ausencia de MFA resistente a phishing.
- **Impacto:** toma de cuenta, incluida la de ADMIN de tenant o de plataforma.
- **Probabilidad:** Media. **Severidad:** Alta (Crítica si la víctima es cuenta de plataforma A4).
- **Detección:** login desde dispositivo/ubicación nuevos; step-up fallido; correlación con reportes del usuario (§19).
- **Mitigaciones arquitectónicas:** MFA para privilegiadas (rector §6.2); step-up en acciones críticas de modo que una sesión robada no baste para lo irreversible (rector §6.2, S11); revocación inmediata efectiva (rector §6.3); segregación plataforma/tenant (S7) limita el alcance de una sola cuenta comprometida.
- **Relacionado:** ADR-SEC-004, ADR-SEC-008 (respuesta a incidentes).

### T-ID-3 — Session hijacking / robo de token de sesión vía XSS o terceros

- **Objetivo:** usar la sesión de la víctima sin credenciales.
- **Superficie:** Z2 (navegador); scripts inyectados o de terceros con acceso al material de sesión.
- **Precondiciones:** XSS explotable o dependencia de frontend comprometida (ver T-FE-1, T-DO-\*); material de sesión accesible a scripts.
- **Impacto:** suplantación completa dentro de la ventana de la sesión.
- **Probabilidad:** Media. **Severidad:** Alta.
- **Detección:** uso concurrente del mismo material desde orígenes distintos; anomalía de patrón por identidad (§19.5).
- **Mitigaciones arquitectónicas:** protección estructural del material de sesión frente a lectura por scripts (rector §8.3); minimización de terceros y aislamiento de contenido de terceros (rector §8.7); TTL corta del access token (ADR-SEC-002 §4.2) reduce la ventana; revocación efectiva (S-rector §6.3).
- **Relacionado:** ADR-SEC-004.

### T-ID-4 — Robo/abuso de refresh token

- **Objetivo:** persistencia: mantener acceso más allá de la vida del access token.
- **Superficie:** cliente (Z2), almacenamiento; interceptación.
- **Precondiciones:** obtener un refresh token válido.
- **Impacto:** acceso prolongado; renovación continua de sesiones.
- **Probabilidad:** Media. **Severidad:** Alta.
- **Detección:** presentación de un refresh token ya rotado (señal fuerte de robo).
- **Mitigaciones arquitectónicas:** rotación por uso y detección de reuso que revoca toda la familia de tokens del usuario (ADR-SEC-002 §4.2, SEC-I7); revocación efectiva antes de expiración natural (rector §6.3). **Observación:** el access token no es revocable hoy (ventana de 15 min, R4 de ADR-SEC-002) — gap aceptado, ver §20.
- **Relacionado:** ADR-SEC-004.

### T-ID-5 — Bypass de MFA (cuando exista)

- **Objetivo:** saltarse el segundo factor.
- **Superficie:** flujo de MFA, recuperación, endpoints que no exigen el factor.
- **Precondiciones:** MFA implementado de forma inconsistente (algún camino sin él), o factor débil (SMS interceptable, ausencia de resistencia a phishing).
- **Impacto:** anula la protección de cuentas privilegiadas.
- **Probabilidad:** Media (futuro). **Severidad:** Crítica para cuentas de plataforma.
- **Detección:** acceso privilegiado sin evento de step-up correspondiente (§13.2).
- **Mitigaciones arquitectónicas:** MFA como propiedad de la identidad, no de un endpoint (rector §6.2); toda acción crítica exige re-verificación reciente (S11); fail secure si el factor no puede evaluarse (S2).
- **Relacionado:** ADR-SEC-004. **Gap** hasta que MFA exista (§20).

### T-ID-6 — Abuso de recuperación de cuenta / reset de contraseña

- **Objetivo:** tomar la cuenta a través del flujo de recuperación, no del login.
- **Superficie:** endpoint de password reset (Z1→Z3), correo (ZX).
- **Precondiciones:** enlace de reset predecible, de vida larga, reutilizable, o que no invalide sesiones/tokens previos; correo del tercero comprometido.
- **Impacto:** toma de cuenta sin conocer la contraseña.
- **Probabilidad:** Media. **Severidad:** Alta.
- **Detección:** solicitudes de reset masivas o repetidas; reset seguido de cambio de datos sensibles (§13.2 datos personales).
- **Mitigaciones arquitectónicas:** enlaces de un solo uso, vida corta y ligados a identidad (análogo a rector §11.1 para documentos, aplicable a recuperación); revocación de sesiones tras cambio de credencial (rector §6.3); correo tratado como ZX comprometible (rector §4.1); auditoría del evento (§13.2).
- **Relacionado:** ADR-SEC-004.

### T-ID-7 — Enumeración de usuarios/tenants por respuestas o tiempos

- **Objetivo:** descubrir qué emails/tenants existen para dirigir T-ID-1/2.
- **Superficie:** login, reset, registro (mensajes y tiempos distintos entre "no existe" y "clave errada").
- **Precondiciones:** respuestas o latencias distinguibles.
- **Impacto:** insumo para ataques de credenciales; fuga de la lista de clientes (metadato de negocio).
- **Probabilidad:** Alta. **Severidad:** Media.
- **Detección:** volumen anómalo de intentos con emails variados (§19.4).
- **Mitigaciones arquitectónicas:** ausencia indistinguible de prohibición: mismas respuestas, mismos tiempos (rector §5.2.5, extendido a identidad); errores opacos hacia afuera (rector §7.5, S9).
- **Relacionado:** ADR-SEC-004.

---

## 7. Multiempresa — aislamiento entre tenants (invariante suprema S1)

> Toda amenaza de esta sección que tenga éxito es **Crítica** por definición (§2.4): rompe A1/S1.

### T-MT-1 — Fuga entre tenants por omisión de ámbito en una consulta

- **Objetivo:** leer datos de otro tenant.
- **Superficie:** Z3→Z4; cualquier servicio que construya una consulta sin `tenantId`.
- **Precondiciones:** un solo punto de acceso a datos donde el desarrollador olvidó el filtro de tenant; hoy el aislamiento es disciplina de aplicación sin RLS (ADR-SEC-002 §6.1–6.2).
- **Impacto:** fuga masiva cross-tenant; fin de la confianza (A1).
- **Probabilidad:** Media (un solo olvido basta; el equipo crecerá). **Severidad:** Crítica.
- **Detección:** un servicio que lee volúmenes o filas fuera de su tenant habitual (§19.5); pruebas de invariante que intentan cruzar tenant y deben fallar (rector §21, verificabilidad).
- **Mitigaciones arquitectónicas:** doble imposición dominio **y** datos (S4, rector §5.2.2); rutas de acceso sin tenant obligatorio no deben existir (rector §5.2.3, "imposible por construcción"); pruebas de cruce en el pipeline (S12, rector §17.4). **Estado:** hoy solo hay una capa (aplicación); RLS está diferido (ADR-SEC-002 §9 Fase 3) — **gap crítico**, ver §20.
- **Relacionado:** ADR-SEC-001 §5, ADR-SEC-002 §6.

### T-MT-2 — IDOR / BOLA: acceso a recurso de otro tenant por su identificador

- **Objetivo:** leer/modificar un recurso concreto ajeno manipulando un ID.
- **Superficie:** cualquier endpoint que reciba un identificador de recurso (Z2→Z3).
- **Precondiciones:** que la autorización valide "existe" pero no "pertenece a mi tenant"; identificadores enumerables o filtrables.
- **Impacto:** fuga o alteración dirigida cross-tenant.
- **Probabilidad:** Alta (BOLA es el defecto de API más común). **Severidad:** Crítica.
- **Detección:** accesos denegados repetidos a IDs no propios; secuencias de IDs (§19.4).
- **Mitigaciones arquitectónicas:** autorización por objeto en el servidor, con tenant derivado del contexto y comparado contra la pertenencia del recurso (S3, rector §7.2); identificadores no enumerables ni significativos (rector §5.2.4); ausencia indistinguible de prohibición (§5.2.5); doble imposición (S4).
- **Relacionado:** ADR-SEC-001 §5, §7.

### T-MT-3 — Ruptura de aislamiento por caché / índice / cola compartidos

- **Objetivo:** que un dato de un tenant aparezca en la vista de otro vía un almacén transversal.
- **Superficie:** cachés, índices de búsqueda, colas de trabajo, notificaciones, logs de negocio.
- **Precondiciones:** un subsistema transversal no particionado por tenant; clave de caché sin tenant.
- **Impacto:** fuga cross-tenant silenciosa, difícil de detectar.
- **Probabilidad:** Media. **Severidad:** Crítica.
- **Detección:** auditoría de acierto de caché con tenant cruzado; revisión de claves.
- **Mitigaciones arquitectónicas:** todo lo transversal está particionado por tenant (rector §5.2.6); prohibición de almacenamiento paralelo fuera de mecanismos gobernados (rector §9.6); no mezclar tenants en una misma unidad de render/caché (rector §8.8).
- **Relacionado:** ADR-SEC-001 §5.2, §8.

### T-MT-4 — Ruptura de la frontera de sede dentro de un tenant

- **Objetivo:** un usuario de una sede ve/actúa sobre otra sede.
- **Superficie:** Z3; endpoints de nómina/facturación/reportes sin filtro de sede.
- **Precondiciones:** autorización que considera tenant pero no sede; hoy multi-sede carece de filtros en nómina/facturación (memoria de proyecto: multi-sede 65%).
- **Impacto:** fuga/alteración intra-tenant entre sedes; escalada de alcance operativo.
- **Probabilidad:** Media. **Severidad:** Alta.
- **Detección:** acceso a recursos de sede no asignada (§13.2 denegaciones).
- **Mitigaciones arquitectónicas:** la sede es dimensión de autorización obligatoria (rector §5.3); autorización = f(…, sede, …) (rector §6.4, S3).
- **Relacionado:** ADR-SEC-001 §5.3, ADR-SEC-002 §5.

### T-MT-5 — Confusión de tenant por dato controlado por el cliente

- **Objetivo:** operar sobre otro tenant inyectando `tenantId` en body, header, query o token manipulado.
- **Superficie:** Z2→Z3; cualquier operación que derive el tenant de la petición.
- **Precondiciones:** que algún camino lea el tenant de un parámetro en lugar del contexto autenticado.
- **Impacto:** operación cross-tenant con apariencia legítima.
- **Probabilidad:** Media. **Severidad:** Crítica.
- **Detección:** discrepancia entre tenant del token y tenant del payload (§19.4).
- **Mitigaciones arquitectónicas:** el tenant sale siempre del contexto autenticado, jamás de un parámetro del cliente (S3, rector §7.2); rechazo de campos desconocidos anti mass-assignment (SEC-I2, rector §7.3).
- **Relacionado:** ADR-SEC-001 §6, ADR-SEC-002 §8.3.

### T-MT-6 — Noisy neighbor: un tenant degrada el servicio de otro

- **Objetivo:** DoS indirecto o consumo desproporcionado.
- **Superficie:** operaciones costosas (importaciones masivas, lotes, reportes) sin cuota por tenant.
- **Precondiciones:** ausencia de cuotas por tenant; procesamiento síncrono pesado (memoria: `procesarLote` síncrono puede causar timeout).
- **Impacto:** degradación/indisponibilidad para otros tenants (A10).
- **Probabilidad:** Media. **Severidad:** Media.
- **Detección:** consumo anómalo por tenant (§19.4–5).
- **Mitigaciones arquitectónicas:** cuotas y límites por tenant en cómputo, almacenamiento, peticiones y trabajos pesados (rector §5.2.7, §17.5).
- **Relacionado:** ADR-SEC-001 §5.2.7, §17.

### T-MT-7 — Abuso de procesos legítimamente cross-tenant (plataforma)

- **Objetivo:** usar un proceso de plataforma (métricas, facturación del SaaS, mantenimiento) como puerta a datos de tenants.
- **Superficie:** identidades y jobs con visibilidad global.
- **Precondiciones:** proceso cross-tenant con permisos amplios, no inventariado o mal acotado.
- **Impacto:** fuga masiva; punto único de compromiso hacia todos los tenants.
- **Probabilidad:** Baja. **Severidad:** Crítica.
- **Detección:** auditoría de todo acceso de plataforma a datos de tenant (§13.2, S15).
- **Mitigaciones arquitectónicas:** las excepciones cross-tenant usan identidades dedicadas, inventariadas, de mínimo privilegio y auditadas (rector §5.2.3); acceso de plataforma excepcional, acotado y visible al tenant (S15).
- **Relacionado:** ADR-SEC-001 §5.2, §5.3.

---

## 8. APIs

### T-API-1 — BFLA: acceso a función administrativa sin el rol

- **Objetivo:** invocar una operación privilegiada con un rol insuficiente.
- **Superficie:** endpoints sin declaración de rol; hoy un endpoint sin `@Roles` es accesible por cualquier rol autenticado (ADR-SEC-002 §5.2).
- **Precondiciones:** endpoint que olvida declarar su autorización.
- **Impacto:** escalamiento funcional dentro del tenant.
- **Probabilidad:** Media. **Severidad:** Alta.
- **Detección:** invocación de funciones fuera del perfil del rol (§13.2).
- **Mitigaciones arquitectónicas:** secure by default — un módulo que no declara su política no es accesible (rector §5.2/§9.1, S2); autorización declarativa central (rector §6.5). **Observación:** el default actual (endpoint sin `@Roles` = abierto a autenticados) contradice secure-by-default — **gap**, §20.
- **Relacionado:** ADR-SEC-001 §6–7, ADR-SEC-002 §5.

### T-API-2 — Mass assignment / parameter tampering

- **Objetivo:** escribir campos no previstos (`rol`, `tenantId`, montos, estados) inyectándolos en el payload.
- **Superficie:** endpoints de mutación (Z2→Z3).
- **Precondiciones:** binding permisivo que acepte campos fuera del contrato.
- **Impacto:** auto-elevación, cross-tenant, fraude contable.
- **Probabilidad:** Alta. **Severidad:** Alta.
- **Detección:** rechazos de campos no permitidos (§19.4).
- **Mitigaciones arquitectónicas:** validación estricta con rechazo de campos desconocidos (S9, rector §7.3; SEC-I2, ADR-SEC-002 §8.3); totales y estados derivados en el dominio, nunca aceptados del cliente (rector §12.7).
- **Relacionado:** ADR-SEC-001 §7, ADR-SEC-002 §8.

### T-API-3 — Race condition / TOCTOU en operaciones sensibles

- **Objetivo:** explotar la ventana entre verificación y efecto (doble gasto, doble aprobación, doble contabilización).
- **Superficie:** operaciones concurrentes sobre el mismo recurso (aprobación de nómina, contabilización, cierre).
- **Precondiciones:** ausencia de transaccionalidad o de control de concurrencia/idempotencia.
- **Impacto:** doble efecto económico, estados inconsistentes, saltarse una validación.
- **Probabilidad:** Media. **Severidad:** Alta.
- **Detección:** duplicados detectados por idempotencia; anomalías de secuencia (§19).
- **Mitigaciones arquitectónicas:** escrituras con efecto económico/legal transaccionales y auditadas (rector §9.5); idempotencia en operaciones expuestas a reintentos (rector §7.4, coherente con ADR-001).
- **Relacionado:** ADR-001, ADR-SEC-001 §9, §12.

### T-API-4 — Replay de peticiones

- **Objetivo:** reejecutar una operación válida capturada (pago, aprobación).
- **Superficie:** Z1→Z3; operaciones de escritura.
- **Precondiciones:** ausencia de idempotencia o de nonce/ventana temporal.
- **Impacto:** duplicación de efectos.
- **Probabilidad:** Media. **Severidad:** Media.
- **Detección:** repetición de identificadores de operación (§19).
- **Mitigaciones arquitectónicas:** idempotencia en escrituras (rector §7.4); autorización contra estado actual del recurso (S3, rector §6.4) — una operación ya aplicada no se repite.
- **Relacionado:** ADR-SEC-001 §7.

### T-API-5 — Enumeración / scraping masivo

- **Objetivo:** extraer catálogos completos (empleados, terceros, documentos) por iteración.
- **Superficie:** endpoints de lectura sin paginación obligatoria ni límites.
- **Precondiciones:** endpoints que devuelvan colecciones grandes o permitan iterar IDs.
- **Impacto:** fuga a granel dentro del tenant; con IDOR (T-MT-2), cross-tenant.
- **Probabilidad:** Alta. **Severidad:** Media (Alta si se combina con IDOR).
- **Detección:** volumen de lectura anómalo por identidad (§19.5).
- **Mitigaciones arquitectónicas:** paginación obligatoria, límites de tamaño, "nunca devolver todo" (rector §7.4); rate limiting por identidad y tenant; identificadores no enumerables (§5.2.4).
- **Relacionado:** ADR-SEC-001 §7.

### T-API-6 — Fuerza bruta y abuso de endpoints costosos

- **Objetivo:** adivinar valores (tokens, códigos) o agotar recursos.
- **Superficie:** cualquier endpoint sin límite; hoy el rate limiting solo cubre auth (ADR-SEC-002 §1, R3).
- **Precondiciones:** ausencia de throttling global.
- **Impacto:** toma de cuenta, DoS, costo de cómputo.
- **Probabilidad:** Alta. **Severidad:** Media.
- **Detección:** tasa anómala por endpoint/identidad (§19.4).
- **Mitigaciones arquitectónicas:** anti-abuso por diseño, rate limiting por identidad y por tenant (rector §7.4); el borde absorbe la hostilidad (rector §16.3). **Estado:** rate limiting global pendiente (ADR-SEC-002 §9 Fase 1) — **gap**, §20.
- **Relacionado:** ADR-SEC-001 §7, §16.

### T-API-7 — Fuga de información por errores/respuestas verbosas

- **Objetivo:** aprender estructura interna, existencia de recursos ajenos, versiones.
- **Superficie:** respuestas de error, cabeceras, mensajes de validación.
- **Precondiciones:** errores ricos hacia afuera.
- **Impacto:** reconocimiento para otros ataques; distinción existe/no-existe (rompe §5.2.5).
- **Probabilidad:** Alta. **Severidad:** Media.
- **Detección:** — (es defecto de diseño, se previene no se detecta).
- **Mitigaciones arquitectónicas:** errores opacos hacia afuera, ricos hacia observabilidad interna (rector §7.5, S9); ausencia indistinguible de prohibición (§5.2.5).
- **Relacionado:** ADR-SEC-001 §7.

### T-API-8 — Superficie de API muerta o no versionada

- **Objetivo:** explotar endpoints antiguos/olvidados con controles obsoletos.
- **Superficie:** endpoints no usados, versiones retiradas de facto pero vivas.
- **Precondiciones:** falta de inventario y retiro de superficie.
- **Impacto:** ataque por el eslabón sin mantenimiento.
- **Probabilidad:** Media. **Severidad:** Media.
- **Detección:** inventario periódico de superficie (rector §7.7).
- **Mitigaciones arquitectónicas:** superficie mínima, retiro de lo no usado, versionado con retiro gobernado (rector §7.6–7.7).
- **Relacionado:** ADR-SEC-001 §7, ADR-SEC-012 (APIs públicas futuras).

---

## 9. Frontend (Z2 — territorio del atacante)

### T-FE-1 — XSS (almacenado o reflejado)

- **Objetivo:** ejecutar script en la sesión de la víctima → robo de sesión (T-ID-3), acciones en su nombre.
- **Superficie:** cualquier renderizado de contenido generado por usuario (nombres, notas, campos libres, documentos).
- **Precondiciones:** salida sin codificación por contexto; contenido de usuario tratado como confiable.
- **Impacto:** toma de sesión, exfiltración, pivote a otras amenazas.
- **Probabilidad:** Media. **Severidad:** Alta.
- **Detección:** violaciones de política de contenido reportadas; patrones anómalos.
- **Mitigaciones arquitectónicas:** toda salida codificada según contexto; contenido de usuario siempre hostil (rector §8.3); restricción estructural de qué puede cargar/ejecutar la página y hacia dónde conectar (rector §8.7); material de sesión no accesible a scripts (§8.3).
- **Relacionado:** ADR-SEC-001 §8.

### T-FE-2 — CSRF

- **Objetivo:** que el navegador de la víctima ejecute una acción autenticada sin su intención.
- **Superficie:** operaciones de mutación que dependan de credenciales ambientales del navegador.
- **Precondiciones:** ausencia de protección contra uso forjado desde otro origen.
- **Impacto:** acción no deseada con la identidad de la víctima.
- **Probabilidad:** Media. **Severidad:** Media.
- **Detección:** origen/referer inconsistente (§19).
- **Mitigaciones arquitectónicas:** protección contra uso forjado desde otros orígenes como amenaza permanente de diseño (rector §8.3); autorización por petición contra estado actual (S3).
- **Relacionado:** ADR-SEC-001 §8.

### T-FE-3 — Clickjacking

- **Objetivo:** engañar al usuario para que actúe sobre la app embebida en un sitio hostil.
- **Superficie:** carga de la app en un marco de terceros.
- **Precondiciones:** la app permite ser enmarcada.
- **Impacto:** acciones no intencionadas del usuario.
- **Probabilidad:** Baja. **Severidad:** Baja.
- **Detección:** —.
- **Mitigaciones arquitectónicas:** restricción estructural del enmarcado (rector §8.7, headers de seguridad). **Estado:** headers (Helmet) pendientes (ADR-SEC-002 §9 Fase 1) — **gap**, §20.
- **Relacionado:** ADR-SEC-001 §8.

### T-FE-4 — Fuga de datos por sobreexposición del backend a la vista

- **Objetivo:** obtener datos que la vista no muestra pero el backend envió "por si acaso".
- **Superficie:** respuestas que incluyen más de lo que la vista requiere; filtrado en cliente.
- **Precondiciones:** enviar colecciones completas o campos sensibles al cliente.
- **Impacto:** fuga de datos Restringidos accesible con las herramientas del navegador.
- **Probabilidad:** Alta. **Severidad:** Alta.
- **Detección:** revisión de proyecciones; —.
- **Mitigaciones arquitectónicas:** el frontend recibe solo los datos de la vista, ya autorizados y proyectados (rector §8.2); salida como proyección deliberada (S9, rector §7.3); prohibido filtrar en cliente (§8.2).
- **Relacionado:** ADR-SEC-001 §8, §7.

### T-FE-5 — Almacenamiento local inseguro / caché de datos sensibles

- **Objetivo:** recuperar datos sensibles del dispositivo o de cachés intermedias.
- **Superficie:** almacenamiento del navegador, service workers, cachés compartidas, URLs con datos.
- **Precondiciones:** persistencia local de datos sensibles; respuestas sensibles cacheables; datos en URLs.
- **Impacto:** fuga desde el dispositivo o desde intermediarios (logs, historiales, CDN).
- **Probabilidad:** Media. **Severidad:** Media.
- **Detección:** —.
- **Mitigaciones arquitectónicas:** sin persistencia local durable de datos sensibles (rector §8.4); caché consciente de sensibilidad, nada privado en cachés compartidas (rector §8.5, §16.4); URLs nunca portan datos sensibles (§8.5, S10).
- **Relacionado:** ADR-SEC-001 §8, §16.

### T-FE-6 — Fuga por SSR / hidratación / mezcla de contexto

- **Objetivo:** que el render servidor mezcle datos de identidades o tenants.
- **Superficie:** renderizado en servidor, cachés de render, estado de hidratación.
- **Precondiciones:** una unidad de render/caché que mezcle datos de tenants distintos.
- **Impacto:** fuga cross-tenant o cross-usuario en la página.
- **Probabilidad:** Baja. **Severidad:** Crítica (rompe S1 si es cross-tenant).
- **Detección:** pruebas de aislamiento en render; —.
- **Mitigaciones arquitectónicas:** el render en servidor maneja datos por identidad; prohibido mezclar identidades/tenants en una misma unidad de render/caché (rector §8.8).
- **Relacionado:** ADR-SEC-001 §8.8.

### T-FE-7 — Autorización basada en la interfaz (ocultar ≠ proteger)

- **Objetivo:** ejecutar una acción "oculta" en la UI llamando directo a la API.
- **Superficie:** rutas/botones ocultos cuya única barrera es el frontend.
- **Precondiciones:** confiar en el estado de la UI como control de acceso.
- **Impacto:** acceso a funciones no autorizadas (converge con T-API-1).
- **Probabilidad:** Alta. **Severidad:** Alta.
- **Detección:** invocación de endpoints sin pasar por la UI (§13.2).
- **Mitigaciones arquitectónicas:** el estado de la interfaz jamás es insumo de autorización; cada dato/acción se autoriza en el backend por petición (rector §8.6, S3).
- **Relacionado:** ADR-SEC-001 §8, §6.

---

## 10. Backend / lógica de negocio

### T-BE-1 — Bypass de autorización por camino no cubierto

- **Objetivo:** alcanzar un efecto sin pasar por el control (endpoint alterno, job, evento).
- **Superficie:** Z3; rutas internas, jobs, disparadores que no reevalúan autorización.
- **Precondiciones:** autorización aplicada solo en el camino "principal".
- **Impacto:** escalamiento o acción no autorizada.
- **Probabilidad:** Media. **Severidad:** Alta.
- **Detección:** acción sin evento de autorización previo (§13).
- **Mitigaciones arquitectónicas:** autorización en cada punto de entrada, cada operación (S3, rector §9.2); toda frontera explícita e inventariada (rector §4.2.1); defensa en profundidad (S4).
- **Relacionado:** ADR-SEC-001 §4, §9.

### T-BE-2 — Bypass de validación de negocio

- **Objetivo:** crear estados imposibles (montos negativos, fechas fuera de período, saldos inventados).
- **Superficie:** operaciones de dominio que confían en datos ya "validados".
- **Precondiciones:** validación solo en frontera de tipos, no de reglas de negocio; aceptar totales del cliente.
- **Impacto:** corrupción lógica, fraude contable.
- **Probabilidad:** Media. **Severidad:** Alta.
- **Detección:** invariantes de dominio violadas (§19).
- **Mitigaciones arquitectónicas:** montos/balances validados en el dominio, totales derivados nunca aceptados (rector §12.7); dentro del dominio los datos ya son de tipos válidos, pero las reglas se imponen en el dominio (rector §9.3).
- **Relacionado:** ADR-001, ADR-SEC-001 §9, §12.

### T-BE-3 — Inyección (SQL, comandos, plantillas, rutas)

- **Objetivo:** ejecutar instrucciones no previstas componiéndolas con datos del usuario.
- **Superficie:** cualquier composición dinámica con entrada del usuario.
- **Precondiciones:** concatenación en lugar de parametrización.
- **Impacto:** desde fuga total de datos (rompe S1) hasta ejecución.
- **Probabilidad:** Media. **Severidad:** Crítica.
- **Detección:** patrones de inyección en entrada (§19); pruebas.
- **Mitigaciones arquitectónicas:** regla absoluta: nunca se componen instrucciones dinámicas con datos del usuario; todo parametrizado, sin casos especiales (rector §9.4, S9).
- **Relacionado:** ADR-SEC-001 §9.

### T-BE-4 — Deserialización / procesamiento inseguro de entrada estructurada

- **Objetivo:** ejecutar o corromper mediante datos estructurados hostiles (payloads, archivos, importaciones).
- **Superficie:** importadores (Excel de empleados, 500 filas), parsers, colas.
- **Precondiciones:** parseo permisivo de contenido no confiable.
- **Impacto:** ejecución, corrupción, DoS.
- **Probabilidad:** Media. **Severidad:** Alta.
- **Detección:** errores de parseo anómalos; tamaños/tipos fuera de rango (§19).
- **Mitigaciones arquitectónicas:** toda entrada externa hostil hasta validarse contra esquema estricto (S9, rector §4.2.3); contenido subido hostil, verificación de tipo real y límites (rector §11.5); fail secure (S2).
- **Relacionado:** ADR-SEC-001 §9, §11.

### T-BE-5 — Abuso de lógica de negocio (flujos fuera de orden)

- **Objetivo:** saltarse pasos de un flujo (aprobar sin crear, pagar sin aprobar, cerrar sin cuadrar).
- **Superficie:** máquinas de estado de nómina, contabilidad, lotes.
- **Precondiciones:** transiciones que no validan el estado previo contra el estado actual persistido.
- **Impacto:** fraude, inconsistencia, doble efecto.
- **Probabilidad:** Media. **Severidad:** Alta.
- **Detección:** transiciones inválidas rechazadas y auditadas (§13.2).
- **Mitigaciones arquitectónicas:** autorización = f(…, estado del recurso) (rector §6.4, S3); flujos irreversibles con fricción y segunda identidad (rector §9.10, S11); segregación de deberes (rector §3.2).
- **Relacionado:** ADR-001, ADR-SEC-001 §9, §12.

### T-BE-6 — Degradación de invariante por optimización de rendimiento

- **Objetivo (indirecto):** que un atajo de performance abra un hueco (saltarse ámbito de tenant, auditoría o inmutabilidad).
- **Superficie:** rutas "rápidas", cachés, bulk operations.
- **Precondiciones:** presión de rendimiento resuelta relajando un control.
- **Impacto:** reintroduce T-MT-1/3, T-AUD-\*, etc.
- **Probabilidad:** Media (presión organizacional real). **Severidad:** Alta.
- **Detección:** revisión de diseño; pruebas de invariante (§21).
- **Mitigaciones arquitectónicas:** las invariantes no se negocian por rendimiento; si el rendimiento exige rediseño, se rediseña con invariantes intactas (rector §9.9, §17.1).
- **Relacionado:** ADR-SEC-001 §9, §17.

---

## 11. Base de datos y almacenamiento (Z4/Z5)

### T-DB-1 — Acceso directo a la base saltándose la aplicación

- **Objetivo:** leer/escribir datos sin pasar por Z3 (y sin filtro de tenant ni auditoría).
- **Superficie:** conexión de red a Z4; credenciales de BD.
- **Precondiciones:** ruta de red a la base desde fuera de Z3; credenciales expuestas (ver T-SEC-\*).
- **Impacto:** fuga o alteración total, sin auditoría (invisible).
- **Probabilidad:** Baja. **Severidad:** Crítica.
- **Detección:** conexiones desde origen no-Z3; anomalías de acceso (§19.5).
- **Mitigaciones arquitectónicas:** Z4 sin ruta de red desde el exterior, único cliente Z3 (rector §4.2.5); identidades de servicio de mínimo privilegio (rector §6.6); RLS como defensa en profundidad para que ni una consulta raw cruce tenant (ADR-SEC-002 §9 Fase 3 — diferido, **gap** §20).
- **Relacionado:** ADR-SEC-001 §4, §16.

### T-DB-2 — Fuga o robo de backups

- **Objetivo:** obtener una copia completa de la base sin tocar producción.
- **Superficie:** almacenamiento de backups, replicación, snapshots.
- **Precondiciones:** backups accesibles con credenciales de producción o sin cifrado/aislamiento.
- **Impacto:** fuga total, cross-tenant (Crítica).
- **Probabilidad:** Baja. **Severidad:** Crítica.
- **Detección:** acceso anómalo al almacén de backups (§13.2 plataforma).
- **Mitigaciones arquitectónicas:** cifrado en reposo con claves separadas (rector §10.1); al menos una copia fuera del alcance de las credenciales de producción (S13); auditoría de restauraciones (§13.2).
- **Relacionado:** ADR-SEC-001 §10, §14, ADR-SEC-009.

### T-DB-3 — Ransomware / destrucción de datos y backups

- **Objetivo:** cifrar/borrar producción y sus copias para extorsionar.
- **Superficie:** producción + backups alcanzables desde credenciales comprometidas.
- **Precondiciones:** compromiso de producción con alcance a todas las copias.
- **Impacto:** indisponibilidad total (A10); rehén del negocio de todos los tenants.
- **Probabilidad:** Media (amenaza universal). **Severidad:** Crítica.
- **Detección:** borrados/cifrados masivos anómalos (§19.5).
- **Mitigaciones arquitectónicas:** backups con inmutabilidad temporal, copia lógicamente aislada, restauración ensayada (S13, rector §10.3); infraestructura reconstruible, el servidor comprometido se reemplaza (rector §16.1); degradación segura (§10.3).
- **Relacionado:** ADR-SEC-001 §10, §16, ADR-SEC-009.

### T-DB-4 — Corrupción / restauración maliciosa o errónea

- **Objetivo:** alterar datos vía una restauración manipulada o "rollback" que revive datos borrados por derecho.
- **Superficie:** procesos de restauración y replicación.
- **Precondiciones:** restauración sin control de dos personas ni auditoría; sin distinción dato-suprimible / evidencia-retenida.
- **Impacto:** corrupción de integridad; reaparición de datos personales suprimidos (incumplimiento Habeas Data).
- **Probabilidad:** Baja. **Severidad:** Alta.
- **Detección:** auditoría de restauraciones; verificación de integridad post-restauración (§13.2, rector §10.2).
- **Mitigaciones arquitectónicas:** restauración global es operación catastrófica con control de dos personas (rector §5.3, S11); auditoría inmutable del evento (S6); distinción por clasificación entre dato suprimible y evidencia retenida (rector §10.4).
- **Relacionado:** ADR-SEC-001 §10, ADR-SEC-009, ADR-SEC-014.

---

## 12. Documentos (contratos, expedientes, certificados)

### T-DO-1 — Acceso a documento por URL directa / enlace filtrado

- **Objetivo:** descargar un documento ajeno con su enlace.
- **Superficie:** URLs de descarga; enlaces compartidos, en logs, historiales, referers.
- **Precondiciones:** documentos "públicos por URL" o enlaces de vida larga/reutilizables no ligados a identidad.
- **Impacto:** fuga de expedientes/contratos (A3, A9); cross-tenant si el almacén es común (Crítica).
- **Probabilidad:** Media. **Severidad:** Alta (Crítica si cruza tenant).
- **Detección:** acceso a documentos Restringidos registrado (§13.2); descargas anómalas.
- **Mitigaciones arquitectónicas:** privado por defecto, sin documentos públicos por URL; autorización en el momento del acceso; enlaces de un solo uso/vida corta, ligados a identidad, auditados (rector §11.1, S10).
- **Relacionado:** ADR-SEC-001 §11, ADR-SEC-005.

### T-DO-2 — Enumeración del almacén de documentos

- **Objetivo:** descubrir documentos por nombres/rutas predecibles.
- **Superficie:** nomenclatura del almacén; listados.
- **Precondiciones:** nombres/rutas significativos o secuenciales; almacén navegable.
- **Impacto:** descubrimiento y fuga masiva.
- **Probabilidad:** Media. **Severidad:** Alta.
- **Detección:** accesos a rutas inexistentes en secuencia (§19.4).
- **Mitigaciones arquitectónicas:** almacén no navegable, nombres no enumerables ni significativos; metadatos en el sistema de registro, no en el nombre del archivo (rector §11.2).
- **Relacionado:** ADR-SEC-001 §11, ADR-SEC-005. **Observación:** hoy expediente y branding viven en filesystem local (memoria) — verificar no-navegabilidad, posible **gap** §20.

### T-DO-3 — Subida de contenido malicioso

- **Objetivo:** almacenar/servir un archivo que ataque a otros usuarios o al servidor.
- **Superficie:** carga de documentos; render/servido posterior.
- **Precondiciones:** confiar en la extensión declarada; servir contenido interpretable en el origen de la app.
- **Impacto:** XSS almacenado (T-FE-1), ejecución, distribución de malware.
- **Probabilidad:** Media. **Severidad:** Alta.
- **Detección:** verificación de tipo real fallida; análisis de contenido (§13.2).
- **Mitigaciones arquitectónicas:** contenido subido hostil: tipo real verificado, límites, análisis antes de servir, jamás ejecución del lado servidor (rector §11.5); servir ≠ ejecutar, entrega que el navegador no interpreta como código en el origen (rector §11.6).
- **Relacionado:** ADR-SEC-001 §11, ADR-SEC-005.

### T-DO-4 — Manipulación de versiones / firmas / metadatos

- **Objetivo:** alterar un documento emitido (contrato, certificado) o su procedencia.
- **Superficie:** almacén de versiones; huellas de integridad; metadatos.
- **Precondiciones:** reemplazo in situ en vez de versión encadenada; ausencia de huella de integridad.
- **Impacto:** falsificación de documentos con valor legal; repudio.
- **Probabilidad:** Baja. **Severidad:** Alta.
- **Detección:** verificación de integridad activa; huella al ingresar (rector §10.2, §11.4).
- **Mitigaciones arquitectónicas:** versión emitida inmutable, correcciones como nueva versión encadenada, nunca reemplazo; huella de integridad registrada al ingresar (rector §11.4, S5); verificación de integridad periódica (rector §10.2).
- **Relacionado:** ADR-SEC-001 §11, §10, ADR-SEC-005.

---

## 13. Contabilidad y dominios de valor legal (evidencia Z5)

> Éxito aquí compromete A2/A7 y suele ser **Crítico** por romper S5/S6.

### T-CO-1 — Alteración de asientos contabilizados (edición de evidencia)

- **Objetivo:** modificar/borrar un comprobante ya contabilizado para ocultar o fabricar hechos.
- **Superficie:** Z3→Z5; cualquier ruta de escritura sobre libros.
- **Precondiciones:** existencia de una ruta que edite en lugar de compensar.
- **Impacto:** fraude; inutilización probatoria de la contabilidad.
- **Probabilidad:** Baja. **Severidad:** Crítica.
- **Detección:** escritura rechazada sobre evidencia (§19.4); verificación de encadenamiento (rector §10.2).
- **Mitigaciones arquitectónicas:** el libro es append-only e inmutable; corrección solo por compensación encadenada (S5, rector §12.1); ni Z3 puede modificar Z5, solo añadir (rector §4.1).
- **Relacionado:** ADR-001, ADR-SEC-001 §12.

### T-CO-2 — Doble contabilización / doble efecto económico

- **Objetivo:** registrar dos veces un mismo hecho (o pago) para fraude o error explotable.
- **Superficie:** disparadores de contabilización; reintentos; concurrencia (converge con T-API-3/4).
- **Precondiciones:** ausencia de idempotencia de origen.
- **Impacto:** cifras falsas, descuadre, fraude.
- **Probabilidad:** Media. **Severidad:** Alta.
- **Detección:** violación de consecutivo; duplicados por idempotencia (§13.2).
- **Mitigaciones arquitectónicas:** idempotencia de origen; todo asiento remite a su documento fuente y evento (rector §12.5, coherente ADR-001); numeración consecutiva sin huecos (rector §12.2).
- **Relacionado:** ADR-001, ADR-SEC-001 §12.

### T-CO-3 — Manipulación de cierres / reapertura informal de períodos

- **Objetivo:** reabrir un período cerrado para alterar resultados.
- **Superficie:** flujo de cierre/reapertura (rama actual: C3 cierre).
- **Precondiciones:** reapertura por edición o sin segunda aprobación ni rastro.
- **Impacto:** manipulación de estados financieros; fraude.
- **Probabilidad:** Baja. **Severidad:** Crítica.
- **Detección:** eventos de cierre/reapertura auditados (§13.2); cualquier escritura en período cerrado (§19.4).
- **Mitigaciones arquitectónicas:** períodos cerrados intocables; reapertura como flujo privilegiado con justificación, segunda aprobación y rastro, jamás edición (rector §12.3, S5, S11).
- **Relacionado:** ADR-001, C3-accounting-closure, ADR-SEC-001 §12.

### T-CO-4 — Abuso de reversos/anulaciones

- **Objetivo:** usar el mecanismo legítimo de reverso para descuadrar, ocultar o defraudar.
- **Superficie:** operaciones de reverso/anulación.
- **Precondiciones:** reverso sin encadenar al original, sin límites ni alertas.
- **Impacto:** fraude difícil de rastrear.
- **Probabilidad:** Media. **Severidad:** Alta.
- **Detección:** patrón anómalo de reversos por identidad; operaciones masivas con alerta (rector §12.7).
- **Mitigaciones arquitectónicas:** corrección compensatoria encadenada al original (S5, rector §12.1); operaciones contables masivas con límites y alertas (rector §12.7); auditoría de reverso/anulación (§13.2).
- **Relacionado:** ADR-001, ADR-SEC-001 §12.

### T-CO-5 — Fraude interno por concentración de deberes

- **Objetivo:** que una sola persona registre, apruebe y cierre → fraude de extremo a extremo.
- **Superficie:** roles; hoy RBAC plano no distingue crear/aprobar (ADR-SEC-002 §5.3).
- **Precondiciones:** un rol único que ejecute todo el flujo.
- **Impacto:** fraude sin segundo control.
- **Probabilidad:** Media. **Severidad:** Alta.
- **Detección:** misma identidad en todos los pasos de un flujo crítico (§13).
- **Mitigaciones arquitectónicas:** segregación de deberes: registrar/aprobar/cerrar separables por rol, con identidades distintas exigibles (rector §12.4, S11). **Estado:** el RBAC actual no separa crear/aprobar — **gap**, §20; destino ADR-SEC-015 (modelo de autorización detallado).
- **Relacionado:** ADR-SEC-001 §12, ADR-SEC-015 (rol detallado).

---

## 14. Nómina y facturación (futuros)

### T-NO-1 — Modificación fraudulenta de liquidaciones

- **Objetivo:** alterar montos/beneficiarios de una liquidación.
- **Superficie:** máquina de estados de liquidación (DRAFT/APPROVED/PAID/VOIDED, N2D).
- **Precondiciones:** edición tras aprobación; aceptar totales del cliente.
- **Impacto:** desvío de pago, fraude laboral.
- **Probabilidad:** Media. **Severidad:** Alta.
- **Detección:** cambios post-aprobación auditados (§13.2 nómina); descuadres.
- **Mitigaciones arquitectónicas:** totales derivados en dominio (rector §12.7); transición autorizada contra estado actual (S3); segregación crear/aprobar/pagar (S11); auditoría de LIQUIDACION\_\* (ADR-SEC-002 §7.2).
- **Relacionado:** ADR-001, ADR-SEC-001 §9, §12, N2D.

### T-NO-2 — Manipulación de datos de pago (destino de fondos)

- **Objetivo:** cambiar la cuenta destino de un beneficiario justo antes de pagar.
- **Superficie:** datos bancarios del empleado/tercero; ventana entre cambio y pago.
- **Precondiciones:** cambio de datos de pago sin step-up ni ventana de verificación.
- **Impacto:** desvío directo de dinero.
- **Probabilidad:** Media. **Severidad:** Alta.
- **Detección:** cambio de datos de pago seguido de pago inmediato (§13.2).
- **Mitigaciones arquitectónicas:** cambio de datos de pago = acción crítica con step-up (rector §6.2); segregación de deberes en el pago (S11); auditoría del cambio (§13.2 datos personales/nómina).
- **Relacionado:** ADR-SEC-001 §6, §12, ADR-SEC-004.

### T-FA-1 — Alteración de facturas / numeración

- **Objetivo:** modificar facturas emitidas o crear huecos/duplicados de numeración.
- **Superficie:** facturación interna y electrónica (DIAN futura).
- **Precondiciones:** edición de emitidas; numeración no consecutiva/gobernada.
- **Impacto:** fraude fiscal, descuadre, sanción.
- **Probabilidad:** Media. **Severidad:** Alta.
- **Detección:** huecos de consecutivo (incidente de integridad, rector §12.2).
- **Mitigaciones arquitectónicas:** numeración consecutiva sin huecos por tenant y tipo (rector §12.2); factura emitida inmutable, corrección por nota encadenada (S5).
- **Relacionado:** ADR-001, ADR-SEC-001 §12, ADR-SEC-007.

### T-FA-2 — Robo/abuso de certificados de firma fiscal (DIAN)

- **Objetivo:** emitir documentos fiscales fraudulentos en nombre del tenant.
- **Superficie:** custodia de certificados de firma (secreto máximo, A5); frontera ZX con DIAN.
- **Precondiciones:** certificados accesibles fuera del inventario gobernado o compartidos entre tenants.
- **Impacto:** fraude fiscal imputable al tenant; daño legal grave.
- **Probabilidad:** Baja. **Severidad:** Crítica.
- **Detección:** uso de certificado fuera de patrón; auditoría de firma (§13.2 integraciones).
- **Mitigaciones arquitectónicas:** certificados por tenant, nunca compartidos, en inventario gobernado, cifrados con separación por tenant, no visibles a operadores (rector §12.6, §14.4, S8); lo transmitido a la autoridad y sus respuestas como evidencia inmutable (rector §12.6, S5).
- **Relacionado:** ADR-SEC-001 §12, §14, ADR-SEC-007.

### T-FA-3 — Repudio / pérdida de evidencia de transmisión fiscal

- **Objetivo:** negar (o no poder probar) qué se transmitió a la autoridad y qué respondió.
- **Superficie:** intercambio con DIAN (ZX); contingencias.
- **Precondiciones:** no conservar transmisión y respuesta como evidencia.
- **Impacto:** indefensión ante la autoridad; disputas irresolubles.
- **Probabilidad:** Media. **Severidad:** Alta.
- **Detección:** —.
- **Mitigaciones arquitectónicas:** transmitido y respuestas conservados como evidencia inmutable (rector §12.6, S5); verificación técnica de lo recibido del tercero (rector §4.1 ZX).
- **Relacionado:** ADR-SEC-001 §12, ADR-SEC-007.

---

## 15. IA, agentes y automatizaciones (futuros)

### T-AI-1 — Prompt injection (inyección indirecta de instrucciones)

- **Objetivo:** que contenido leído por un agente (documento, correo, campo) le ordene actuar fuera de lo previsto.
- **Superficie:** todo dato que un agente procese (expedientes, correos, notas).
- **Precondiciones:** el agente mezcla instrucciones legítimas con datos; puede ejecutar acciones con sus permisos.
- **Impacto:** exfiltración de datos, acciones no autorizadas a escala.
- **Probabilidad:** Alta (cuando exista IA). **Severidad:** Alta (Crítica si el agente puede tocar Z5 o cruzar tenant).
- **Detección:** acciones del agente fuera de patrón; auditoría por acción (§13.2 IA).
- **Mitigaciones arquitectónicas:** todo contenido que el agente lee es entrada hostil; instrucciones y datos separados por diseño; ningún dato leído eleva lo permitido (rector §18.2); agente = usuario no confiable con iniciativa, mínimo privilegio acotado a tenant (rector §18.1, S14).
- **Relacionado:** ADR-SEC-001 §18, ADR-SEC-010.

### T-AI-2 — Exceso de privilegio / herencia silenciosa de permisos del agente

- **Objetivo:** que el agente actúe con más permisos que el usuario o que "el sistema".
- **Superficie:** identidad y permisos del agente.
- **Precondiciones:** agente que hereda permisos del invocador o corre como sistema.
- **Impacto:** escalamiento vía IA.
- **Probabilidad:** Media. **Severidad:** Crítica.
- **Detección:** acción del agente sin usuario asociado o fuera de la intersección de permisos (§13.2).
- **Mitigaciones arquitectónicas:** el agente actúa en nombre de un usuario con la **intersección** de permisos usuario∩agente; identidad propia, jamás permisos de sistema (rector §18.1, S14, S7).
- **Relacionado:** ADR-SEC-001 §18, ADR-SEC-010.

### T-AI-3 — Fuga de contexto / de documentos hacia IA externa

- **Objetivo:** exfiltrar datos Restringidos enviándolos a un modelo/herramienta externa.
- **Superficie:** salida hacia proveedores de IA (ZX).
- **Precondiciones:** ausencia de política por clasificación sobre qué sale y hacia dónde.
- **Impacto:** fuga de datos personales/contables a un tercero.
- **Probabilidad:** Media. **Severidad:** Alta.
- **Detección:** egress hacia proveedores de IA con datos Restringidos (§19); auditoría de acciones IA.
- **Mitigaciones arquitectónicas:** salida a IA gobernada por clasificación, política explícita por tenant; datos Restringidos no salen sin base contractual y consentimiento (rector §18.4, S10).
- **Relacionado:** ADR-SEC-001 §10, §18, ADR-SEC-010.

### T-AI-4 — Tool poisoning / integración MCP maliciosa o comprometida

- **Objetivo:** que una herramienta externa conectada (MCP u otra) devuelva contenido hostil o abuse su alcance.
- **Superficie:** frontera ZX de herramientas conectadas.
- **Precondiciones:** herramienta con alcance excesivo; respuestas tratadas como confiables.
- **Impacto:** inyección (T-AI-1), exfiltración, acciones no autorizadas.
- **Probabilidad:** Media. **Severidad:** Alta.
- **Detección:** herramienta que actúa fuera de su alcance inventariado (§13.2).
- **Mitigaciones arquitectónicas:** cada herramienta inventariada, alcance mínimo, respuestas como entrada hostil (rector §18.5, ZX); cuotas y detección de anomalías propias de agentes (rector §18.6).
- **Relacionado:** ADR-SEC-001 §18, ADR-SEC-010.

### T-AI-5 — Ejecución de acción irreversible por un agente sin aprobación humana

- **Objetivo:** que el agente cierre un período, exporte masivamente o transmita a DIAN por su cuenta.
- **Superficie:** capacidades irreversibles expuestas a agentes.
- **Precondiciones:** agente autorizado a ejecutar (no solo preparar) lo irreversible.
- **Impacto:** daño irreversible a escala y velocidad de máquina.
- **Probabilidad:** Media. **Severidad:** Crítica.
- **Detección:** acción irreversible sin aprobación humana asociada (§13.2).
- **Mitigaciones arquitectónicas:** el agente puede preparar, ejecutar exige aprobación de identidad humana autorizada (rector §18.3, S14); cuotas específicas de agentes (§18.6).
- **Relacionado:** ADR-SEC-001 §18, ADR-SEC-010.

---

## 16. DevOps, cadena de suministro e infraestructura

### T-DV-1 — Compromiso de dependencia (paquete malicioso o vulnerado)

- **Objetivo:** ejecutar código propio dentro del build o del runtime vía una dependencia.
- **Superficie:** árbol de dependencias del monorepo; actualizaciones automáticas.
- **Precondiciones:** dependencia no fijada, sin inventario, actualización silenciosa.
- **Impacto:** compromiso transversal (runtime con acceso a datos de todos los tenants).
- **Probabilidad:** Media. **Severidad:** Crítica.
- **Detección:** composición de software conocida; egress inesperado del build (rector §15.3).
- **Mitigaciones arquitectónicas:** dependencias fijadas por versión verificable, inventariadas, actualizaciones deliberadas y revisadas, prohibida la actualización silenciosa a producción (rector §15.1); build sin credenciales amplias (rector §15.3).
- **Relacionado:** ADR-SEC-001 §15, ADR-SEC-011.

### T-DV-2 — Compromiso del pipeline CI/CD

- **Objetivo:** desplegar código o artefactos maliciosos a producción.
- **Superficie:** el pipeline (infraestructura crítica de producción).
- **Precondiciones:** acceso al pipeline sin las mismas exigencias que producción; despliegue manual sin rastro.
- **Impacto:** control del producto; puerta a todos los tenants.
- **Probabilidad:** Baja. **Severidad:** Crítica.
- **Detección:** artefacto que difiere de la fuente; despliegue fuera del pipeline (rector §15.3).
- **Mitigaciones arquitectónicas:** pipeline con exigencias de producción (MFA, mínimo privilegio, auditoría); nada llega a producción fuera del pipeline; integridad de artefacto verificable fuente→producción (S12, rector §15.3).
- **Relacionado:** ADR-SEC-001 §15, ADR-SEC-011.

### T-DV-3 — Exfiltración de secretos del repositorio/pipeline

- **Objetivo:** obtener JWT_SECRET, DATABASE_URL, claves, certificados.
- **Superficie:** código, historia de git, artefactos, configuración versionada, logs de CI; hoy secretos en `.env` (ADR-SEC-002 §3.2, R5).
- **Precondiciones:** secreto incrustado o accesible a ejecución de código no revisado.
- **Impacto:** con JWT_SECRET, forjar sesiones de cualquier tenant (Crítica); con DATABASE_URL, T-DB-1.
- **Probabilidad:** Media. **Severidad:** Crítica.
- **Detección:** escaneo de secretos; uso de secreto desde origen inesperado (§19).
- **Mitigaciones arquitectónicas:** cero secretos fuera del inventario gobernado, nunca en código/repositorio/artefacto/config/cliente; rotables y de ámbito mínimo (S8, rector §14); ejecución sobre código no confiable sin acceso a secretos (rector §15.3). **Estado:** gestión centralizada de secretos diferida, `.env` hoy — **gap**, §20.
- **Relacionado:** ADR-SEC-001 §14, §15, ADR-SEC-006.

### T-DV-4 — Compromiso de identidad de repositorio / commits no verificables

- **Objetivo:** introducir cambio malicioso suplantando a un desarrollador o sin revisión.
- **Superficie:** GitHub, ramas protegidas, revisión de PR.
- **Precondiciones:** ramas sin protección; sin revisión de segunda persona; identidad de autor no verificable.
- **Impacto:** ruta insegura o backdoor en producción.
- **Probabilidad:** Baja. **Severidad:** Alta.
- **Detección:** cambios sin revisión; historia reescrita en ramas de release (rector §15.3).
- **Mitigaciones arquitectónicas:** cambios solo por revisión de segunda persona en ramas protegidas; identidad de autor verificable; historia no reescribible en release (rector §15.3, S12).
- **Relacionado:** ADR-SEC-001 §15, ADR-SEC-011.

### T-DV-5 — Mezcla de entornos / datos reales en no-producción

- **Objetivo:** atacar el entorno más débil (dev/test) para alcanzar datos o secretos de producción.
- **Superficie:** entornos de desarrollo/pruebas.
- **Precondiciones:** entornos que comparten credenciales, secretos, redes o datos reales.
- **Impacto:** fuga de datos reales; pivote a producción.
- **Probabilidad:** Media. **Severidad:** Alta.
- **Detección:** uso de credenciales de producción fuera de producción (§19).
- **Mitigaciones arquitectónicas:** entornos separados de verdad; no-producción jamás con secretos ni datos reales (rector §14.5, §16.7).
- **Relacionado:** ADR-SEC-001 §14, §16.

### T-DV-6 — Aplicación alcanzable directamente / borde ausente

- **Objetivo:** llegar a la aplicación sin pasar por filtrado, rate limiting ni anti-bot.
- **Superficie:** exposición de red de Z3.
- **Precondiciones:** la aplicación es alcanzable sin capa de borde.
- **Impacto:** habilita fuerza bruta, scraping, DoS (T-API-5/6).
- **Probabilidad:** Media. **Severidad:** Media.
- **Detección:** tráfico a Z3 que no pasó por el borde (§19).
- **Mitigaciones arquitectónicas:** el borde absorbe la hostilidad; la aplicación nunca alcanzable directamente (rector §16.3); segmentación de red por defecto-denegar (rector §16.2).
- **Relacionado:** ADR-SEC-001 §16.

---

## 17. Insider threat (amenaza interna)

### T-IN-1 — Operador/soporte de plataforma accede a datos de un tenant

- **Objetivo:** curiosidad, venta de datos, espionaje.
- **Superficie:** herramientas de soporte/operación con acceso a datos de tenants.
- **Precondiciones:** acceso de soporte amplio, permanente o no auditado.
- **Impacto:** fuga; pérdida de confianza (A4).
- **Probabilidad:** Media. **Severidad:** Alta.
- **Detección:** todo acceso de plataforma a datos de tenant auditado y visible para el tenant (S15, §13.2).
- **Mitigaciones arquitectónicas:** acceso de soporte excepcional, justificado, acotado en alcance y tiempo, idealmente con consentimiento, visible al tenant; no existe acceso de soporte permanente (rector §5.3, S15); permisos de plataforma y de tenant disjuntos (S7).
- **Relacionado:** ADR-SEC-001 §5.3, §13.

### T-IN-2 — Superadministrador abusa de capacidades catastróficas

- **Objetivo:** borrar/exportar tenants, restaurar, alterar el modelo de autorización.
- **Superficie:** capacidades de superadmin (A4).
- **Precondiciones:** superadmin que actúa solo, sin segundo control.
- **Impacto:** daño catastrófico o fraude a escala plataforma.
- **Probabilidad:** Baja. **Severidad:** Crítica.
- **Detección:** acciones catastróficas auditadas inmutablemente (S6, §13.2).
- **Mitigaciones arquitectónicas:** los menos superadmins posibles; acciones sensibles con verificación reforzada; control de dos personas para lo catastrófico/irreversible (rector §5.3, S11); ni superadmin altera auditoría (S6).
- **Relacionado:** ADR-SEC-001 §5.3, §13.

### T-IN-3 — Desarrollador introduce ruta insegura o backdoor

- **Objetivo:** dejar (con o sin intención) un camino que salte controles.
- **Superficie:** código; el equipo crecerá (rector §17.4).
- **Precondiciones:** un solo desarrollador puede introducir una ruta insegura sin que falle nada.
- **Impacto:** reintroduce cualquier amenaza (T-MT-1, T-CO-1, etc.).
- **Probabilidad:** Media. **Severidad:** Alta.
- **Detección:** pruebas de invariante que fallan; revisión de PR (rector §15.3, §17.4).
- **Mitigaciones arquitectónicas:** la seguridad no depende de que todos recuerden las reglas: las rutas inseguras no deben existir (rector §5.2.3), y verificación automática de invariantes en el pipeline (rector §17.4, §21); revisión obligatoria de segunda persona (S12).
- **Relacionado:** ADR-SEC-001 §15, §17, §21.

### T-IN-4 — Insider que sale con acceso vigente

- **Objetivo:** conservar acceso tras la baja (empleado del tenant o de plataforma).
- **Superficie:** sesiones/tokens/credenciales no revocados a tiempo.
- **Precondiciones:** revocación lenta o incompleta.
- **Impacto:** acceso post-baja; fuga o sabotaje.
- **Probabilidad:** Media. **Severidad:** Alta.
- **Detección:** actividad de identidad dada de baja (§19).
- **Mitigaciones arquitectónicas:** revocación inmediata y efectiva en toda la plataforma como requisito arquitectónico (rector §6.3); capacidad de revocar en minutos ante incidente (rector §19.7).
- **Relacionado:** ADR-SEC-001 §6, §19, ADR-SEC-004.

### T-IN-5 — Presión organizacional por excepciones (riesgo social)

- **Objetivo (indirecto):** que una urgencia comercial cree una puerta trasera permanente ("este cliente grande necesita acceso especial", "compartamos este secreto por hoy").
- **Superficie:** proceso de decisión, no técnica.
- **Precondiciones:** ausencia de invariantes escritas que resistan la presión.
- **Impacto:** erosión gradual de las garantías.
- **Probabilidad:** Media. **Severidad:** Alta (acumulativa).
- **Detección:** revisión de arquitectura; toda excepción exige ADR (rector §20.2).
- **Mitigaciones arquitectónicas:** las invariantes existen precisamente para resistir esta presión; toda excepción exige ADR (rector §20.2, §21).
- **Relacionado:** ADR-SEC-001 §20, §21.

---

## 18. Terceros y fronteras ZX (integraciones presentes y futuras)

### T-ZX-1 — Compromiso del proveedor de identidad / correo / pasarela

- **Objetivo:** usar un tercero comprometido como entrada lateral.
- **Superficie:** frontera ZX (IdP, correo — hoy Resend para password reset, pasarela futura, DIAN).
- **Precondiciones:** confianza implícita en el tercero; sin verificación de lo recibido.
- **Impacto:** toma de cuenta (vía reset, T-ID-6), suplantación, fuga.
- **Probabilidad:** Baja. **Severidad:** Alta.
- **Detección:** anomalías en el intercambio; verificación fallida (§19).
- **Mitigaciones arquitectónicas:** ZX con assume breach: confianza contractual verificada técnicamente en cada intercambio; credenciales revocables, mínimo dato compartido, verificación de lo recibido (rector §4.1, §20.2).
- **Relacionado:** ADR-SEC-001 §4, §20.

### T-ZX-2 — Abuso de futuras API públicas para integradores

- **Objetivo:** abusar de credenciales de integración (robo, exceso de alcance, cuota).
- **Superficie:** APIs públicas para terceros (futuras).
- **Precondiciones:** credenciales de integración sin scopes mínimos, sin cuota, no revocables por tenant.
- **Impacto:** fuga o abuso a escala máquina.
- **Probabilidad:** Media (futuro). **Severidad:** Alta.
- **Detección:** uso fuera de scope/cuota por consumidor (§13.2 integraciones).
- **Mitigaciones arquitectónicas:** credenciales de integración revocables por tenant, scopes de mínimo privilegio, cuotas por consumidor, registro completo (rector §7.1); identidades no humanas de primer nivel (rector §6.6).
- **Relacionado:** ADR-SEC-001 §6, §7, ADR-SEC-012.

---

## 19. Priorización consolidada

Ordenadas por severidad y, dentro de cada nivel, por probabilidad. La columna "Estado" indica si el rector ya cubre la amenaza estructuralmente (**Cubierta**) o si el estado implementado actual deja un **Gap** (detalle en §20 más abajo, tabla de gaps).

### 19.1 Críticas

| ID     | Amenaza                                     | Prob. | Invariante clave | Estado            |
| ------ | ------------------------------------------- | ----- | ---------------- | ----------------- |
| T-MT-1 | Fuga cross-tenant por omisión de ámbito     | Media | S1, S4           | **Gap** (sin RLS) |
| T-MT-2 | IDOR/BOLA cross-tenant                      | Alta  | S1, S3, S4       | Cubierta (diseño) |
| T-MT-5 | Confusión de tenant por dato del cliente    | Media | S1, S3           | Cubierta          |
| T-MT-3 | Aislamiento roto por caché/índice/cola      | Media | S1               | Cubierta (diseño) |
| T-MT-7 | Abuso de proceso cross-tenant de plataforma | Baja  | S1, S15          | Cubierta (diseño) |
| T-FE-6 | Fuga cross-tenant por SSR/hidratación       | Baja  | S1               | Cubierta (diseño) |
| T-BE-3 | Inyección (SQL/comando/plantilla)           | Media | S9               | Cubierta          |
| T-CO-1 | Alteración de evidencia contable            | Baja  | S5               | Cubierta          |
| T-CO-3 | Reapertura informal de períodos             | Baja  | S5, S11          | Cubierta (C3)     |
| T-DB-1 | Acceso directo a la base                    | Baja  | Z4, S4           | **Gap** (sin RLS) |
| T-DB-2 | Fuga de backups                             | Baja  | S13              | Gap infra (§20)   |
| T-DB-3 | Ransomware                                  | Media | S13              | Gap infra (§20)   |
| T-FA-2 | Robo de certificados de firma DIAN          | Baja  | S8               | Futuro (SEC-007)  |
| T-AI-2 | Exceso de privilegio de agente IA           | Media | S14, S7          | Futuro (SEC-010)  |
| T-AI-5 | Acción irreversible de IA sin humano        | Media | S14              | Futuro (SEC-010)  |
| T-DV-1 | Compromiso de dependencia                   | Media | §15              | Gap CI/CD (§20)   |
| T-DV-2 | Compromiso del pipeline                     | Baja  | S12              | Gap CI/CD (§20)   |
| T-DV-3 | Exfiltración de secretos                    | Media | S8               | **Gap** (.env)    |
| T-IN-2 | Abuso de superadmin catastrófico            | Baja  | S11, S6          | Cubierta (diseño) |

### 19.2 Altas

| ID      | Amenaza                                       | Prob. | Invariante clave | Estado                              |
| ------- | --------------------------------------------- | ----- | ---------------- | ----------------------------------- |
| T-ID-1  | Credential stuffing                           | Alta  | §6.2, §7.4       | Parcial (MFA futuro)                |
| T-ID-2  | Phishing                                      | Media | §6.2, S11        | Parcial (MFA futuro)                |
| T-ID-3  | Session hijacking                             | Media | §8.3             | Parcial (headers §20)               |
| T-ID-4  | Abuso de refresh token                        | Media | SEC-I7           | Cubierta                            |
| T-ID-6  | Abuso de recuperación de cuenta               | Media | §6.3             | Futuro (SEC-004)                    |
| T-MT-4  | Ruptura de frontera de sede                   | Media | S3, §5.3         | **Gap** (sede parcial)              |
| T-API-1 | BFLA (función sin rol)                        | Media | S2, §6.5         | **Gap** (default abierto)           |
| T-API-2 | Mass assignment                               | Alta  | S9, SEC-I2       | Cubierta                            |
| T-API-3 | Race condition                                | Media | §9.5             | Parcial                             |
| T-FE-1  | XSS                                           | Media | §8.3, §8.7       | Parcial (CSP §20)                   |
| T-FE-4  | Sobreexposición del backend                   | Alta  | S9, §8.2         | Cubierta (disciplina)               |
| T-FE-7  | Autorización por interfaz                     | Alta  | S3, §8.6         | Cubierta                            |
| T-BE-1  | Bypass de autorización por camino no cubierto | Media | S3, S4           | Cubierta (diseño)                   |
| T-BE-2  | Bypass de validación de negocio               | Media | §12.7            | Cubierta                            |
| T-BE-4  | Deserialización insegura                      | Media | S9, §11.5        | Parcial                             |
| T-BE-5  | Abuso de lógica de negocio                    | Media | S3, S11          | Parcial (RBAC plano)                |
| T-BE-6  | Degradación de invariante por performance     | Media | §9.9             | Cubierta (regla)                    |
| T-DB-4  | Restauración maliciosa/errónea                | Baja  | S11, §10.4       | Futuro (SEC-009)                    |
| T-DO-1  | Acceso a documento por URL                    | Media | §11.1            | Futuro (SEC-005)                    |
| T-DO-2  | Enumeración del almacén                       | Media | §11.2            | **Gap** (filesystem)                |
| T-DO-3  | Subida de contenido malicioso                 | Media | §11.5            | Parcial                             |
| T-DO-4  | Manipulación de versiones/firmas              | Baja  | S5, §11.4        | Futuro (SEC-005)                    |
| T-CO-2  | Doble contabilización                         | Media | §12.5            | Cubierta (ADR-001)                  |
| T-CO-4  | Abuso de reversos                             | Media | S5, §12.7        | Cubierta                            |
| T-CO-5  | Fraude interno por concentración de deberes   | Media | S11, §12.4       | **Gap** (RBAC plano)                |
| T-NO-1  | Modificación de liquidaciones                 | Media | S3, S11          | Parcial                             |
| T-NO-2  | Manipulación de datos de pago                 | Media | §6.2, S11        | Futuro (SEC-004)                    |
| T-FA-1  | Alteración de facturas/numeración             | Media | §12.2, S5        | Futuro (SEC-007)                    |
| T-FA-3  | Repudio de transmisión fiscal                 | Media | S5               | Futuro (SEC-007)                    |
| T-AI-1  | Prompt injection                              | Alta  | §18.2, S14       | Futuro (SEC-010)                    |
| T-AI-3  | Fuga de contexto/documentos a IA              | Media | S10, §18.4       | Futuro (SEC-010)                    |
| T-AI-4  | Tool poisoning / MCP                          | Media | §18.5            | Futuro (SEC-010)                    |
| T-DV-4  | Commits no verificables                       | Baja  | S12              | Parcial                             |
| T-DV-5  | Mezcla de entornos                            | Media | §14.5            | Parcial                             |
| T-IN-1  | Soporte accede a datos de tenant              | Media | S15              | Cubierta (diseño)                   |
| T-IN-3  | Dev introduce ruta insegura                   | Media | §17.4            | **Gap** (sin pruebas de invariante) |
| T-IN-4  | Insider sale con acceso                       | Media | §6.3             | Cubierta                            |
| T-IN-5  | Presión por excepciones                       | Media | §20.2            | Cubierta (proceso)                  |
| T-ZX-1  | Compromiso de tercero ZX                      | Baja  | §4.1             | Cubierta (diseño)                   |
| T-ZX-2  | Abuso de API pública futura                   | Media | §7.1             | Futuro (SEC-012)                    |

### 19.3 Medias

| ID      | Amenaza                             | Prob. | Invariante clave | Estado                         |
| ------- | ----------------------------------- | ----- | ---------------- | ------------------------------ |
| T-ID-5  | Bypass de MFA                       | Media | §6.2, S11        | Futuro (SEC-004)               |
| T-ID-7  | Enumeración de usuarios/tenants     | Alta  | §5.2.5, S9       | Parcial                        |
| T-MT-6  | Noisy neighbor                      | Media | §5.2.7           | **Gap** (sin cuotas)           |
| T-API-4 | Replay                              | Media | §7.4             | Parcial                        |
| T-API-5 | Enumeración/scraping                | Alta  | §7.4             | Parcial                        |
| T-API-6 | Fuerza bruta / abuso                | Alta  | §7.4             | **Gap** (rate limit solo auth) |
| T-API-7 | Fuga por errores verbosos           | Alta  | S9, §7.5         | Cubierta                       |
| T-API-8 | Superficie muerta/no versionada     | Media | §7.6–7.7         | Parcial                        |
| T-FE-2  | CSRF                                | Media | §8.3             | Parcial                        |
| T-FE-5  | Almacenamiento local/caché inseguro | Media | §8.4–8.5         | Parcial                        |
| T-DV-6  | Aplicación alcanzable directamente  | Media | §16.3            | Gap infra                      |

### 19.4 Bajas

| ID     | Amenaza      | Prob. | Invariante clave | Estado                |
| ------ | ------------ | ----- | ---------------- | --------------------- |
| T-FE-3 | Clickjacking | Baja  | §8.7             | **Gap** (headers §20) |

---

## 20. Gaps: amenazas donde el estado actual no alcanza al rector

El rector es el objetivo; el estado implementado (ADR-SEC-002) es el presente. Estos son los deltas donde una amenaza real no está aún contenida a nivel arquitectónico. **No son autorización de implementación** — son insumo para priorizar el hardening y para la revisión de ADR-SEC-002 que el rector §22 ya ordena.

| Gap                                                                 | Amenazas                      | Delta frente al rector                                                                                                       | Severidad del gap |
| ------------------------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| G1 — Aislamiento en una sola capa (sin RLS)                         | T-MT-1, T-DB-1                | Rompe la doble imposición S4; un olvido fuga cross-tenant.                                                                   | **Crítico**       |
| G2 — Secretos en `.env`, sin inventario gobernado                   | T-DV-3                        | Contradice S8; compromiso de un secreto (JWT_SECRET) colapsa varios tenants.                                                 | **Crítico**       |
| G3 — Default de autorización abierto (endpoint sin rol = accesible) | T-API-1                       | Contradice secure-by-default (S2); un olvido expone función.                                                                 | Alto              |
| G4 — RBAC plano sin segregación crear/aprobar                       | T-CO-5, T-BE-5, T-NO-1        | No permite exigir S11 (segregación de deberes) donde el negocio lo requiere.                                                 | Alto              |
| G5 — Sin pruebas de invariante en el pipeline                       | T-IN-3 y todas las S-críticas | El rector §21 exige que cada invariante tenga prueba que la viole y falle; su ausencia degrada invariantes a aspiraciones.   | Alto              |
| G6 — Rate limiting solo en auth                                     | T-API-6, T-API-5, T-MT-6      | Sin anti-abuso general (rector §7.4).                                                                                        | Medio             |
| G7 — Headers de seguridad ausentes (Helmet pendiente)               | T-FE-1, T-FE-3, T-ID-3        | Falta la restricción estructural de §8.7.                                                                                    | Medio             |
| G8 — Filtros de sede incompletos                                    | T-MT-4                        | Sede como dimensión de autorización aún no uniforme (§5.3).                                                                  | Medio             |
| G9 — Almacén documental en filesystem local                         | T-DO-1, T-DO-2                | Verificar no-navegabilidad y control de acceso por petición (§11.1–11.2).                                                    | Medio             |
| G10 — Auditoría fire-and-forget parcial                             | T-CO-_, T-IN-_                | El rector §13.1 exige que la indisponibilidad de auditoría bloquee la acción crítica; hoy es best-effort (`.catch(()=>{})`). | Medio             |
| G11 — Backups/DR e infraestructura de borde                         | T-DB-2, T-DB-3, T-DV-6        | Dependen de la capa de despliegue; el rector §10.3/§16 los eleva a requisito con S13.                                        | Alto (infra)      |

> Cada gap crítico/alto debería resolverse en su ADR de destino (§22 del rector) antes de que la superficie que lo expone crezca. El orden sugerido de atención por reducción de riesgo: **G1 → G2 → G5 → G4 → G3 → G7 → G6 → resto.** Esta secuencia es una recomendación de priorización de riesgo, no un plan de implementación aprobado.

---

## 21. Riesgos futuros (horizonte 5–10 años)

Amenazas que hoy no son materializables pero cuya llegada es probable; se registran para que el producto las diseñe con anticipación, no las descubra en producción.

| #   | Riesgo emergente                                                                                                                     | Por qué llegará                                                            | Amenazas semilla                                           | Ancla en el rector                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------- |
| F1  | **IA agéntica operando dentro del producto** (asistentes que preparan cierres, liquidaciones, respuestas)                            | El mercado empujará automatización; el operador educativo la pedirá.       | T-AI-1..5                                                  | §18, S14, ADR-SEC-010                             |
| F2  | **Ecosistema de integraciones y MCP** (terceros conectando herramientas y datos)                                                     | La plataforma será plataforma; habrá API pública y conectores.             | T-ZX-2, T-AI-4                                             | §7.1, §18.5, ADR-SEC-010/012                      |
| F3  | **Crecimiento del equipo** (decenas de desarrolladores)                                                                              | El conocimiento de seguridad hoy concentrado se diluye.                    | T-IN-3, T-BE-6                                             | §17.4, §21 (pruebas de invariante)                |
| F4  | **Crecimiento de clientes y datos** (miles de tenants, cientos de millones de registros)                                             | Escala natural del negocio.                                                | T-MT-1 por optimización, auditoría inabarcable, T-MT-6     | §17 (escalabilidad de la seguridad)               |
| F5  | **Nuevas exigencias regulatorias** (evolución DIAN, Habeas Data, posibles certificaciones ISO/SOC exigidas por clientes grandes)     | Clientes institucionales lo exigirán; la ley cambia.                       | T-FA-\*, obligaciones de notificación                      | §10.4, §13, §22 (SEC-013/014)                     |
| F6  | **Multi-región / residencia de datos**                                                                                               | Clientes con requisitos de localización.                                   | Fuga por replicación cross-región, T-DB-2                  | §16.5, ADR-SEC-009                                |
| F7  | **Modo offline / apps móviles**                                                                                                      | Demanda de operación en campo (sedes educativas).                          | Persistencia local de datos sensibles (T-FE-5 amplificado) | §8.4 (exige ADR propio)                           |
| F8  | **Nuevas clases de ataque a IA** (envenenamiento de contexto persistente, exfiltración por canal encubierto en respuestas de modelo) | La superficie IA es joven y evoluciona rápido.                             | T-AI-1, T-AI-3 evolucionados                               | §18, ADR-SEC-010                                  |
| F9  | **Presión comercial acumulada por excepciones**                                                                                      | Ventas grandes pedirán "accesos especiales".                               | T-IN-5                                                     | §20.2, §21 (invariantes como defensa social)      |
| F10 | **Compromiso de proveedor cloud / criptografía obsoleta** (p. ej. horizonte post-cuántico para firmas fiscales de larga retención)   | Los certificados y evidencias deben sobrevivir décadas de retención legal. | T-FA-2/3, T-DB-2                                           | §14 (rotación), §10 (integridad), ADR-SEC-006/007 |

**Principio rector para todos:** el modelo (identidad central, autorización declarativa, clasificación de datos, evidencia append-only, aislamiento por tenant como primera dimensión de partición) es independiente de la tecnología; cada riesgo futuro se absorbe reimplementando mecanismos, no rediseñando garantías (rector §17, §20.2).

---

## 22. Matriz invariante → amenazas contenidas (cobertura inversa)

Verifica que cada invariante del rector tiene amenazas que la ejercen (una invariante sin amenaza asociada es probablemente innecesaria; una amenaza sin invariante es un gap).

| Invariante                                          | Amenazas que contiene                           |
| --------------------------------------------------- | ----------------------------------------------- |
| S1 Aislamiento de tenant                            | T-MT-1..7, T-FE-6, T-DB-1/2, T-DO-1, T-BE-3     |
| S2 Denegar por defecto / fail secure                | T-API-1, T-BE-1/4, T-ID-\*                      |
| S3 Autorización servidor por operación              | T-MT-2/4/5, T-API-1/2, T-FE-7, T-BE-1/5, T-NO-1 |
| S4 Doble capa (defensa en profundidad)              | T-MT-1, T-DB-1, T-BE-1                          |
| S5 Evidencia append-only                            | T-CO-1..4, T-DO-4, T-FA-1/3, T-DB-4             |
| S6 Auditoría íntegra / no alterable                 | T-IN-1/2, T-CO-\*, todas (detección)            |
| S7 No auto-elevación / disjunción plataforma-tenant | T-API-2, T-AI-2, T-IN-1/2                       |
| S8 Secretos gobernados                              | T-DV-3, T-FA-2, T-DB-1                          |
| S9 Entrada hostil / salida mínima / no inyección    | T-BE-2/3/4, T-API-2/5/7, T-FE-4                 |
| S10 Clasificación gobierna todo                     | T-FE-4/5, T-DO-1, T-AI-3                        |
| S11 Segregación de deberes / dos personas           | T-CO-3/5, T-BE-5, T-NO-1/2, T-IN-2, T-DB-4      |
| S12 Nada a producción fuera del pipeline            | T-DV-1/2/4                                      |
| S13 Backups aislados y restauración ensayada        | T-DB-2/3                                        |
| S14 IA con identidad propia y aprobación humana     | T-AI-1..5                                       |
| S15 Acceso de plataforma excepcional y visible      | T-MT-7, T-IN-1                                  |

---

## 23. Mantenimiento de este documento

1. **Compuerta obligatoria.** Toda funcionalidad nueva se revisa contra las superficies de §6–§18 relevantes. Si abre una superficie no listada, se añade la amenaza (con su ficha completa) antes de aprobar el diseño.
2. **IDs estables.** Una amenaza retirada conserva su ID marcado como retirado; nunca se reutiliza.
3. **Sincronía con el rector.** Si una revisión del rector cambia una invariante, se actualizan las columnas "Mitigaciones arquitectónicas" e "invariante clave" aquí.
4. **Cierre de gaps (§20).** Cada gap se cierra en su ADR de destino; al cerrarse, su fila pasa de "Gap" a "Cubierta" con referencia al ADR que lo resolvió.
5. **Revisión adversaria periódica.** La verificación ofensiva del rector (§15.2) se prueba contra este catálogo, con foco permanente en S1 (aislamiento de tenant) y S5 (evidencia).
6. **Verificabilidad.** Coherente con el rector §21: cada amenaza Crítica debería tener, en el pipeline, una prueba que intente el ataque y falle. Una amenaza Crítica sin prueba es riesgo latente, no riesgo mitigado.

---

_FIN del Threat Model. Documento propuesto. Ninguna implementación derivada (incluida la resolución de los gaps de §20) debe iniciarse hasta aprobación explícita._
