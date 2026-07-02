# ADR-SEC-001 — Arquitectura de seguridad de la plataforma (documento rector)

| Campo           | Valor                                                                                               |
| --------------- | --------------------------------------------------------------------------------------------------- |
| **Estado**      | Propuesto — pendiente de aprobación                                                                 |
| **Fecha**       | 2026-07-02                                                                                          |
| **Decisores**   | Arquitectura · Seguridad                                                                            |
| **Ámbito**      | Toda la plataforma SaaS multiempresa "La Oficina Nítida" — todos los módulos presentes y futuros    |
| **Naturaleza**  | Documento rector de seguridad. Independiente de tecnología: sobrevive a cambios de stack.           |
| **Reemplaza**   | — (ADR-SEC-002 queda subordinado como ADR de implementación; ver §22)                               |
| **Relacionado** | ADR-001 (motor contable), ADR-SEC-002 (estado actual), expedientes, nómina, facturación electrónica |

---

## 1. Contexto

La plataforma es un SaaS web multiempresa para operadores educativos colombianos. No es un MVP desechable: administrará durante años información de alta sensibilidad — expedientes de personas (incluidos posibles menores de edad), contratos, certificados, libros contables oficiales, nómina y, a futuro, nómina electrónica y facturación electrónica ante la autoridad tributaria.

Ese perfil implica tres consecuencias arquitectónicas:

1. **El activo principal es la confianza.** Una fuga entre tenants, una alteración de libros contables o la pérdida de expedientes destruye el producto, independientemente de su calidad funcional.
2. **Habrá atacantes profesionales.** Se asume actividad permanente de robo de información, escalamiento de privilegios, abuso de APIs, acceso cruzado entre tenants, manipulación de documentos, fraude contable, scraping, bots, ransomware, ataques internos, ingeniería social y compromiso de proveedores.
3. **El stack cambiará; la arquitectura no debe hacerlo.** Las reglas de este documento se expresan en términos de responsabilidades, fronteras e invariantes — nunca en términos de una tecnología concreta.

Este ADR define la filosofía, los principios, el modelo de confianza y las invariantes que **todo módulo futuro debe cumplir**. Los mecanismos concretos de cada dominio se documentarán en ADRs de seguridad derivados (ver §22).

---

## 2. Decisión

Se adopta una arquitectura de seguridad basada en cinco pilares:

1. **Assume breach.** Todo componente puede ser comprometido; la arquitectura se diseña para limitar el radio de impacto de ese compromiso, no para pretender que nunca ocurrirá.
2. **El tenant es la frontera de seguridad primaria.** El aislamiento entre empresas es la invariante suprema del sistema; ninguna funcionalidad, optimización o urgencia la puede relajar.
3. **Autorización centralizada y declarativa.** Existe un único modelo de autorización para toda la plataforma; ningún módulo inventa su propio esquema de permisos.
4. **Inmutabilidad y evidencia.** Lo que tiene valor legal o probatorio (contabilidad, documentos, auditoría) es append-only; la corrección se hace por compensación, nunca por edición.
5. **Seguridad como propiedad estructural, no como capa añadida.** Las garantías se aplican en el punto arquitectónico más profundo posible (datos > dominio > API > frontend), de modo que un error en una capa superior no las anule.

---

## 3. Filosofía y principios arquitectónicos

### 3.1 Filosofía

- **Assume breach.** Cada componente se diseña preguntando: _si esto cae, ¿qué alcanza el atacante?_ La respuesta aceptable siempre es "un subconjunto acotado", nunca "todo".
- **La seguridad no depende del comportamiento correcto de las personas.** Ni del desarrollador que olvida un filtro, ni del operador que se equivoca, ni del administrador honesto. Las garantías críticas se imponen estructuralmente.
- **Simplicidad como control de seguridad.** Un diseño que nadie entiende completo no puede auditarse. Se prefiere el mecanismo simple y verificable sobre el sofisticado y opaco.
- **Lo que no se registra no existió.** Toda acción con efecto sobre datos de un tenant debe poder reconstruirse después.

### 3.2 Principios obligatorios

| Principio                                                       | Regla arquitectónica                                                                                                                                                                                                                                                                                                    |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Zero Trust**                                                  | Ninguna petición es confiable por su origen de red. Toda petición — externa, interna, entre servicios, de un job programado o de un agente de IA — se autentica y autoriza explícitamente en cada frontera que cruza. No existe la noción de "red interna confiable".                                                   |
| **Least Privilege**                                             | Toda identidad (humana, de servicio, de integración, de IA) recibe el mínimo permiso necesario, acotado a tenant, sede, módulo y acción. Los permisos amplios son excepcionales, temporales, justificados y auditados.                                                                                                  |
| **Secure by Default**                                           | El estado por defecto de todo recurso es denegado, privado, cifrado y no expuesto. Habilitar acceso es siempre una decisión explícita y registrada. Un módulo nuevo que no declara su política de acceso no es accesible.                                                                                               |
| **Fail Secure**                                                 | Ante error, ambigüedad o indisponibilidad de un control (autorización, validación, verificación de tenant), el sistema **deniega**. Nunca se degrada a "permitir" para preservar disponibilidad, salvo decisión de negocio documentada por dominio no sensible.                                                         |
| **Defense in Depth**                                            | Toda garantía crítica se impone en al menos dos capas independientes (p. ej. autorización en dominio **y** restricción a nivel de datos), de modo que el fallo de una no anule la garantía.                                                                                                                             |
| **Segregación de responsabilidades**                            | Quien opera no aprueba; quien desarrolla no despliega sin control; quien administra la plataforma no lee datos de tenants; quien registra contabilidad no cierra períodos sin un segundo rol donde el negocio lo exija. Ninguna identidad individual puede ejecutar de extremo a extremo un flujo crítico irreversible. |
| **Minimización de datos**                                       | Solo se recolecta, retiene y expone el dato necesario para la función. Todo dato personal tiene finalidad declarada y ciclo de vida definido (Habeas Data).                                                                                                                                                             |
| **Reversibilidad de decisiones, irreversibilidad de evidencia** | Las decisiones tecnológicas deben poder revertirse; la evidencia (auditoría, libros, documentos firmados) jamás.                                                                                                                                                                                                        |

---

## 4. Modelo de confianza y trust boundaries

### 4.1 Zonas de confianza

Se definen zonas ordenadas de menor a mayor confianza. **Cruzar de una zona a otra siempre exige autenticación, autorización y validación de entrada**, sin excepciones.

| Zona                      | Contenido                                                                       | Nivel de confianza                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Z0 — Internet**         | Navegadores, bots, atacantes, integraciones de terceros                         | Ninguno                                                                                                   |
| **Z1 — Borde**            | Terminación de tráfico, filtrado, rate limiting, protección anti-automatización | Mínimo: solo decide si el tráfico merece llegar más adentro                                               |
| **Z2 — Frontend**         | Aplicación web servida al usuario                                               | **Territorio del atacante**: todo lo que llega al navegador se considera público para efectos de diseño   |
| **Z3 — API / Aplicación** | Servicios de negocio                                                            | Confianza operativa, nunca implícita: cada petición porta identidad y contexto de tenant verificados      |
| **Z4 — Datos**            | Bases de datos, almacenamiento de documentos, colas                             | Máxima protección; jamás accesible desde Z0–Z2 directamente                                               |
| **Z5 — Evidencia**        | Auditoría, libros cerrados, documentos con valor legal, backups                 | Append-only; ni siquiera Z3 puede modificar, solo añadir                                                  |
| **ZX — Terceros**         | Autoridad tributaria, pasarelas, proveedores de identidad, correo, IA externa   | Confianza contractual, verificada técnicamente en cada intercambio; se asume que pueden ser comprometidos |

### 4.2 Reglas de frontera

1. **Toda frontera es explícita y está inventariada.** Añadir una integración, un canal o un consumidor nuevo exige declarar qué frontera cruza y con qué identidad.
2. **La identidad viaja, no se hereda.** Cuando una petición atraviesa capas, el contexto de identidad y tenant se propaga verificable de extremo a extremo; ningún componente "asume" el tenant por configuración o por conexión.
3. **Los datos que entran de Z0 o ZX son hostiles** hasta ser validados contra un esquema estricto (allowlist, tipos, rangos, tamaño). La validación ocurre en Z3, no en Z2.
4. **Los datos que salen hacia Z0 o ZX se minimizan**: nunca se serializa un modelo interno completo; toda respuesta es una proyección explícita.
5. **Z4 y Z5 no tienen ruta de red desde el exterior.** Su único cliente es Z3, con identidades de servicio de mínimo privilegio.
6. **Los secretos nunca cruzan hacia zonas de menor confianza.** Nada que deba permanecer secreto llega jamás a Z2.

---

## 5. Multiempresa: aislamiento entre tenants

### 5.1 Regla suprema

> **Ningún dato, documento, registro contable, log de negocio, identificador enumerable ni metadato de un tenant puede ser leído, inferido, modificado o contado por otro tenant, bajo ninguna circunstancia, por ninguna vía, en ninguna capa.**

Esta es la invariante S1 (ver §21). Todo lo demás en este documento está subordinado a ella.

### 5.2 Reglas arquitectónicas de aislamiento

1. **Tenant explícito en toda unidad de dato.** Todo registro, documento, evento, log de negocio y entrada de caché pertenece exactamente a un tenant, y esa pertenencia es parte del dato, no del contexto de la petición.
2. **Doble imposición (defensa en profundidad).** El aislamiento se impone en la capa de dominio (todo acceso exige contexto de tenant) **y** en la capa de datos (restricciones estructurales que rechazan consultas sin ámbito de tenant). Un olvido del desarrollador debe fallar cerrado, no fugar datos.
3. **Imposible por construcción, no por disciplina.** Los puntos de acceso a datos que no exigen tenant como parámetro obligatorio no deben existir. Las excepciones (procesos de plataforma legítimamente cross-tenant: facturación del SaaS, métricas agregadas, mantenimiento) usan identidades dedicadas, inventariadas y auditadas.
4. **Identificadores no enumerables y no significativos.** Ningún identificador expuesto permite adivinar el siguiente, inferir volumen de negocio ni deducir la existencia de recursos de otros tenants.
5. **Ausencia indistinguible de prohibición.** Consultar un recurso de otro tenant responde exactamente igual que consultar un recurso inexistente. Ni códigos de error, ni tiempos, ni mensajes distintos.
6. **Aislamiento también en lo transversal:** búsqueda, reportes, exportaciones, colas de trabajo, cachés, índices, notificaciones y logs de negocio están particionados por tenant. Un job por lotes procesa tenant por tenant, nunca con visibilidad global implícita.
7. **Recursos compartidos con equidad.** Un tenant no puede degradar el servicio de otro (noisy neighbor): cuotas y límites por tenant en cómputo, almacenamiento, peticiones y trabajos pesados.
8. **Salida de datos gobernada.** Exportaciones masivas y respaldos por tenant existen como capacidad de primer nivel (portabilidad, terminación de contrato), pero son operaciones privilegiadas, auditadas y con verificación reforzada de identidad.

### 5.3 Jerarquía interna del tenant: sedes, usuarios y roles

Dentro de cada tenant existe una segunda frontera, más débil pero obligatoria:

- **Sedes.** Un tenant puede tener múltiples sedes. Los permisos se acotan por sede; un usuario de sede solo ve su sede salvo concesión explícita multi-sede. La sede es dimensión de autorización, no de aislamiento físico.
- **Usuarios operativos.** Mínimo privilegio funcional: ven y hacen solo lo que su rol en su(s) sede(s) permite.
- **Administradores de tenant.** Gobiernan usuarios, roles y configuración **de su tenant**. No pueden: leer credenciales, alterar auditoría, reabrir períodos contables sin flujo controlado, ni ampliar sus propios permisos sin dejar rastro. La creación/elevación de administradores es un evento crítico auditado.
- **Operadores de plataforma (personal propio).** Administran la plataforma, **no los datos de los tenants**. El acceso de soporte a datos de un tenant es: excepcional, con justificación registrada, acotado en alcance y tiempo, idealmente con consentimiento del tenant, y auditado de forma visible para el tenant. No existe el "acceso de soporte permanente".
- **Superadministradores de plataforma.** Los menos posibles. Sus acciones sensibles exigen verificación reforzada y quedan en auditoría inmutable. Para operaciones catastróficas o irreversibles (borrado de tenant, restauración global, cambios al modelo de autorización) se exige **control de dos personas**.

**Regla anti-escalamiento:** ninguna identidad puede otorgarse a sí misma permisos superiores; toda elevación la concede una identidad distinta con autoridad suficiente y queda auditada. Los permisos de plataforma y los permisos de tenant son espacios disjuntos: tener uno no implica jamás el otro.

---

## 6. Identidad, autenticación y autorización (modelo transversal)

Independiente del proveedor de identidad concreto (que es reemplazable):

1. **Identidad única y centralizada.** Una sola fuente de verdad de identidades por plataforma; los módulos nunca gestionan credenciales propias.
2. **Autenticación proporcional al riesgo.** Acciones de bajo riesgo: sesión válida. Acciones críticas (cambios de permisos, cierres contables, exportaciones masivas, cambio de datos de pago, borrados): re-verificación reciente de identidad (step-up). Cuentas privilegiadas: siempre autenticación multifactor.
3. **Sesiones con ciclo de vida.** Expiración por inactividad y absoluta; revocación inmediata efectiva en toda la plataforma (cambio de permisos, salida de un empleado del tenant, compromiso sospechado). La revocación es un requisito arquitectónico: el diseño de sesiones debe permitir invalidar antes de cualquier expiración natural.
4. **Autorización = f(identidad, tenant, sede, rol, recurso, acción, estado del recurso).** Se evalúa **en el backend, en cada petición**, contra el estado actual de permisos — nunca contra permisos embebidos en un artefacto de sesión de larga vida, y nunca solo en el frontend.
5. **Modelo de permisos declarativo y único.** Roles y permisos se declaran en un modelo central versionado. Un módulo nuevo declara sus recursos y acciones en ese modelo; no implementa lógica de permisos ad-hoc. Esto habilita auditoría de "quién puede qué" en toda la plataforma en cualquier momento.
6. **Identidades no humanas de primer nivel.** Servicios, jobs, integraciones y agentes de IA tienen identidad propia, credenciales propias, permisos propios y rotación propia. Nunca reutilizan credenciales de humanos ni actúan "como el sistema".

---

## 7. APIs

Política única para todas las APIs presentes y futuras:

1. **Toda API se clasifica al nacer** en uno de tres planos, con requisitos crecientes:
   - **Pública** (expuesta a terceros/integraciones): contrato versionado y estable, autenticación de integración con credenciales revocables por tenant, cuotas y rate limiting por consumidor, alcances (scopes) de mínimo privilegio, registro completo de uso.
   - **Privada** (consumida por el frontend propio): misma exigencia de autenticación/autorización que la pública — el frontend **no** es un cliente confiable — pero sin compromiso de estabilidad de contrato hacia terceros.
   - **Interna** (servicio a servicio, jobs): identidad de servicio, sin acceso desde Z0 jamás, mínimo privilegio entre servicios.
2. **Autorización en el servidor en cada operación.** Ninguna API confía en que "el cliente ya validó". Ninguna operación deduce el tenant de un parámetro manipulable por el cliente: el tenant sale del contexto autenticado.
3. **Contratos explícitos.** Entrada validada contra esquema estricto (rechazo de campos desconocidos en operaciones sensibles — anti mass-assignment); salida como proyección deliberada, nunca el modelo interno.
4. **Anti-abuso por diseño.** Rate limiting por identidad y por tenant; límites de tamaño y paginación obligatoria (nunca "devolver todo"); operaciones costosas con cuotas; idempotencia en operaciones de escritura expuestas a reintentos.
5. **Errores opacos hacia afuera, ricos hacia adentro.** El cliente recibe lo mínimo para actuar; el detalle diagnóstico va a observabilidad interna. Los errores jamás filtran existencia de recursos ajenos, estructura interna ni versiones.
6. **Versionado con retiro gobernado.** Las APIs públicas evolucionan por versiones; retirar una versión es un proceso comunicado, nunca un cambio silencioso que empuje a los integradores a soluciones inseguras.
7. **Superficie mínima.** Todo endpoint no usado se retira. La superficie de API se inventaría y revisa periódicamente; un endpoint que nadie reclama es superficie de ataque gratuita.

---

## 8. Frontend

Principio rector: **el frontend es territorio del atacante (Z2).** Nada que llegue al navegador es secreto; nada que venga del navegador es confiable.

1. **Cero secretos en el cliente.** Ni credenciales de servicios, ni claves de integración, ni lógica de autorización determinante. Lo que el frontend "oculta" es cortesía de UX, no control de seguridad.
2. **Exposición mínima de datos.** El frontend recibe solo los datos de la vista actual, ya autorizados y proyectados por el backend. Prohibido enviar colecciones completas "y filtrar en el cliente", y prohibido incluir campos sensibles "por si la vista los necesita".
3. **Sesión robusta frente al navegador hostil.** El material de sesión se protege contra lectura por scripts inyectados y contra uso forjado desde otros orígenes (XSS y CSRF como amenazas permanentes de diseño, no como bugs puntuales). Toda salida se codifica según su contexto; el contenido generado por usuarios se trata siempre como activo hostil.
4. **Sin persistencia local de datos sensibles.** Datos personales, contables o documentales no se almacenan de forma durable en el dispositivo. Lo que exija persistencia local (si algún día existe modo offline) requerirá un ADR propio con cifrado y expiración.
5. **Caché consciente de sensibilidad.** Ninguna respuesta con datos personales o de negocio es cacheable por intermediarios compartidos. Las URLs nunca portan datos sensibles (van a logs, historiales y cabeceras de referencia).
6. **Navegación no confiable.** Ocultar una ruta o un botón no protege nada: cada dato que una vista muestra fue autorizado por el backend para esa identidad en esa petición. El estado de la interfaz jamás es insumo de autorización.
7. **Aislamiento de contenido de terceros.** Scripts de terceros en la aplicación son dependencia de cadena de suministro con acceso potencial a la sesión: se minimizan, se fijan por versión y se restringe estructuralmente lo que la página puede cargar y hacia dónde puede conectarse.
8. **El renderizado respeta la frontera.** Cualquier renderizado que ocurra en el servidor maneja datos por identidad; está prohibido mezclar en una misma unidad de render/caché datos de identidades o tenants distintos.

---

## 9. Backend: reglas obligatorias para todo módulo futuro

Todo módulo que se incorpore a la plataforma cumple, sin excepción:

1. **Declara sus recursos y acciones** en el modelo central de autorización antes de exponer funcionalidad.
2. **Todo punto de entrada exige contexto autenticado con tenant**, o declara explícitamente (y con revisión de seguridad) ser público.
3. **Valida toda entrada** contra esquema estricto en la frontera; dentro del dominio los datos ya son de tipos válidos.
4. **No construye instrucciones dinámicas con datos del usuario** (consultas, comandos, rutas de archivos, plantillas): toda composición usa mecanismos parametrizados. Regla absoluta, sin "casos especiales".
5. **Escrituras con efectos económicos o legales son transaccionales y auditadas** (coherente con ADR-001: operación fuente y su efecto en el mismo límite transaccional cuando el disparador es síncrono; idempotencia cuando es asíncrono).
6. **No inventa almacenamiento paralelo** (archivos sueltos, cachés propios, colas propias) fuera de los mecanismos gobernados por la plataforma, porque cada almacenamiento paralelo es una fuga potencial del aislamiento por tenant.
7. **Registra en auditoría** todo evento de su dominio clasificado como crítico (§13).
8. **Falla cerrado**: excepción o ambigüedad ⇒ denegar y registrar, nunca continuar "en modo permisivo".
9. **No degrada invariantes por rendimiento.** Optimizar jamás justifica saltarse el ámbito de tenant, la auditoría o la inmutabilidad. Si el rendimiento exige un rediseño, se rediseña con las invariantes intactas.
10. **Los flujos irreversibles tienen fricción proporcional:** confirmación reforzada, y cuando el negocio lo exige, segunda identidad aprobadora (segregación de deberes).

---

## 10. Datos: confidencialidad, integridad, disponibilidad

### 10.1 Confidencialidad

- **Clasificación obligatoria.** Todo dato pertenece a una clase — _Público · Interno · Confidencial · Restringido_ (datos personales, financieros, documentos legales; los datos de menores y datos sensibles de Habeas Data son siempre Restringido) — y la clase determina cifrado, acceso, retención, exposición en logs y destino permitido (p. ej. qué puede salir hacia terceros o hacia IA).
- **Cifrado por defecto** en tránsito en todas las fronteras (también internas: Zero Trust) y en reposo en Z4/Z5, con gestión de claves separada de los datos que protegen y capacidad de rotación sin rediseño.
- **Los datos Restringidos nunca aparecen en logs, errores, URLs ni analítica.**

### 10.2 Integridad

- **La fuente de verdad es única y las derivaciones son reconstruibles** (coherente con ADR-001: los saldos se derivan; los snapshots son caché).
- **Lo que tiene valor probatorio es append-only** con encadenamiento verificable (capacidad de detectar alteración, no solo prohibirla).
- **Toda mutación crítica es atribuible:** quién, cuándo, desde qué contexto, sobre qué versión previa.
- **Verificación de integridad activa:** el sistema debe poder demostrar periódicamente que la evidencia no fue alterada (verificación programada de cadenas/sumas), no solo asumirlo.

### 10.3 Disponibilidad

- **Objetivos de recuperación definidos por clase de dato** (cuánta pérdida es tolerable, cuánto tiempo de caída es tolerable) — los libros contables y expedientes tienen los objetivos más estrictos.
- **Backups como defensa anti-ransomware:** copias con inmutabilidad temporal, al menos una lógicamente aislada de las credenciales de producción (el compromiso total de producción no puede alcanzar todas las copias), y **restauración ensayada periódicamente** — un backup no probado no existe.
- **La degradación es segura:** si un subsistema cae, el sistema reduce funcionalidad, jamás controles.

### 10.4 Ciclo de vida

- Todo dato personal tiene: finalidad, base de tratamiento, retención y destino final (borrado o anonimización) definidos **al diseñar el módulo**, no después (Habeas Data / GDPR por diseño).
- El borrado por derecho del titular convive con las obligaciones de retención legal (contable, laboral): el diseño distingue _dato personal suprimible_ de _evidencia legalmente retenida_, y esa distinción se decide por clasificación, no caso por caso.

---

## 11. Documentos (contratos, expedientes, certificados, archivos privados)

1. **Privado por defecto, sin excepción.** No existen documentos "públicos por URL". Toda descarga pasa por autorización en el momento del acceso; los enlaces directos que se emitan son de un solo uso o de vida corta, ligados a identidad, y auditados.
2. **El almacén de documentos no es navegable.** Nombres/rutas internas no enumerables ni significativas; los metadatos (nombre real, dueño, tenant, clasificación) viven en el sistema de registro, no en el nombre del archivo.
3. **Todo documento pertenece a un tenant y a un expediente/dominio**, hereda la clasificación de su contenido y su acceso se decide por el modelo central de autorización (incluida dimensión de sede).
4. **Integridad demostrable.** Todo documento almacenado tiene huella de integridad registrada al ingresar; una versión emitida (certificado, contrato firmado) es inmutable — las correcciones generan nueva versión encadenada, nunca reemplazo.
5. **El contenido subido es hostil.** Verificación de tipo real (no la extensión declarada), límites de tamaño, análisis de contenido malicioso antes de ser servible a otros usuarios, y jamás ejecución/interpretación del lado servidor de contenido subido.
6. **Servir ≠ ejecutar.** Los documentos se entregan de forma que el navegador no los interprete como código en el origen de la aplicación.
7. **Acceso registrado.** Ver o descargar documentos Restringidos es evento de auditoría (quién, cuál, cuándo) — imprescindible ante fugas y para auditorías externas.
8. **Retención documental legal:** los expedientes y contratos siguen el ciclo de vida de §10.4, con retenciones del ámbito educativo y laboral colombiano definidas por el negocio.

---

## 12. Contabilidad y dominios de valor legal

Hereda y eleva las invariantes de ADR-001 a rango de seguridad:

1. **El libro es evidencia (Z5).** Comprobantes contabilizados, cierres y libros oficiales son append-only e inmutables; la corrección es compensatoria (reverso/ajuste) y queda encadenada al original.
2. **Numeración consecutiva sin huecos** por tenant y tipo — un hueco es un incidente de integridad, no un detalle.
3. **Períodos cerrados son intocables.** La reapertura, si el negocio la permite, es un flujo privilegiado, con justificación, segunda aprobación y rastro completo — jamás una edición.
4. **Segregación de deberes contable:** registrar, aprobar y cerrar son capacidades separables por rol; la plataforma debe poder exigir identidades distintas en cada paso cuando el tenant lo requiera.
5. **Trazabilidad de origen extremo a extremo:** todo asiento remite a su documento fuente y evento de origen (idempotencia de origen de ADR-001); toda cifra de un reporte oficial es reconstruible desde movimientos.
6. **Documentos fiscales futuros (nómina electrónica, facturación electrónica):** lo transmitido a la autoridad tributaria y sus respuestas se conservan como evidencia inmutable; las credenciales/certificados de firma ante terceros son secretos de máxima clase (§14), por tenant, jamás compartidos entre tenants.
7. **Antifraude estructural:** montos y balances se validan en el dominio (nunca aceptados del cliente), los totales se derivan (nunca se aceptan), y las operaciones contables masivas tienen límites y alertas.

---

## 13. Auditoría

### 13.1 Política

- **La auditoría es un subsistema de plataforma, no una tabla por módulo.** Escritura append-only, a prueba de manipulación (encadenamiento verificable), con reloj confiable, particionada por tenant y con retención legal propia (años, definida por normativa contable/laboral).
- **Nadie la edita. Nadie la borra dentro de retención. Ningún rol — ni superadministrador — tiene capacidad de alteración.** La purga tras retención es un proceso gobernado, no una capacidad de usuario.
- **Registra el hecho, no el secreto:** actor, tenant, acción, recurso, resultado, origen, momento y justificación cuando aplique — nunca credenciales ni contenido Restringido.
- **La indisponibilidad de auditoría bloquea la acción crítica** (fail secure): si un evento crítico no puede registrarse, la operación no ocurre.

### 13.2 Qué debe registrarse siempre (eventos críticos, nunca se pierden)

- Autenticación: éxitos en cuentas privilegiadas, fallos repetidos, re-verificaciones, revocaciones.
- Autorización: toda concesión/revocación de permisos, creación/elevación de administradores, denegaciones repetidas (señal de ataque).
- Tenant: creación, suspensión, exportación masiva, borrado; **todo acceso de plataforma/soporte a datos de un tenant**.
- Contabilidad: contabilización, reverso, cierre, reapertura, anulación (I9 de ADR-001).
- Documentos: creación, nueva versión, acceso a Restringidos, emisión de enlaces, destrucción por retención.
- Datos personales: exportación, supresión, cambios de finalidad o consentimiento.
- Plataforma: cambios de configuración de seguridad, gestión de secretos, despliegues, restauraciones de backup, alteraciones del modelo de autorización.
- Integraciones e IA: alta/baja de credenciales, cambios de alcance, acciones ejecutadas por agentes.

---

## 14. Gestión de secretos

1. **Inventario central y única vía de acceso.** Todo secreto (credenciales de servicio, claves de cifrado, credenciales de integración por tenant, certificados de firma) está inventariado, con dueño, alcance y fecha de rotación. Los servicios los obtienen en tiempo de ejecución por un mecanismo gobernado — jamás incrustados en código, repositorio, imagen, configuración versionada o frontend.
2. **Rotación como propiedad de diseño.** Todo secreto es rotable sin ventana de caída y sin redespliegue coordinado heroico; la rotación periódica y la rotación de emergencia (ante sospecha) son procedimientos ensayados.
3. **Ámbito mínimo.** Un secreto da acceso a lo mínimo: por servicio, por entorno, por tenant cuando corresponde (certificados fiscales). El compromiso de un secreto acota el impacto a su ámbito (assume breach).
4. **Los secretos de tenants son del tenant:** cifrados con separación por tenant, nunca visibles ni siquiera a operadores de plataforma en claro, y revocables por el tenant.
5. **Entornos no productivos jamás usan secretos ni datos reales de producción.**

---

## 15. Dependencias, vulnerabilidades y cadena de suministro

### 15.1 Dependencias

- Toda dependencia es un proveedor con acceso potencial al proceso: se adopta con criterio (mantenimiento activo, superficie mínima), se fija por versión verificable, se inventaría (composición conocida del software en todo momento) y se retira cuando no se usa.
- Las actualizaciones son deliberadas y revisadas; la actualización automática silenciosa hacia producción está prohibida.

### 15.2 Gestión de vulnerabilidades

- Proceso continuo, no evento: detección permanente (dependencias, imágenes, configuración), clasificación por severidad **en el contexto de la plataforma** (¿alcanza datos de tenants?), plazos máximos de remediación por severidad, y registro de decisiones (remediado, mitigado, riesgo aceptado y por quién).
- Existe un canal de divulgación responsable para reportes externos, con compromiso de respuesta.
- Se practica verificación ofensiva periódica (revisión externa/pruebas de penetración) sobre las invariantes de este documento, en especial el aislamiento entre tenants.

### 15.3 Cadena de suministro (CI/CD, repositorios, pipelines)

- **El pipeline es infraestructura crítica de producción:** quien controla el pipeline controla el producto. Acceso con las mismas exigencias que producción (MFA, mínimo privilegio, auditoría).
- **Nada llega a producción sin pasar por el pipeline.** No hay despliegue manual "de emergencia" sin rastro; la emergencia tiene su procedimiento auditado.
- **Integridad del código:** cambios solo por revisión de una segunda persona en ramas protegidas; identidad de quien escribe verificable; historia no reescribible en ramas de release.
- **Integridad del artefacto:** lo que se despliega es exactamente lo que se construyó (artefactos verificables desde la fuente hasta producción); las compilaciones se hacen en entornos efímeros y no privilegiados.
- **Los secretos del pipeline** siguen §14 y no pueden exfiltrarse mediante un cambio de código malicioso sin revisión (las ejecuciones sobre código no confiable —p. ej. contribuciones aún no revisadas— corren sin acceso a secretos).
- **Assume breach también aquí:** el compromiso de una dependencia o del pipeline se detecta por lo anómalo (artefactos que difieren de la fuente, egress inesperado del build) y se contiene por diseño (el build no tiene credenciales de producción amplias).

---

## 16. Infraestructura futura

Principios válidos hoy y cuando existan contenedores, orquestadores, CDN, balanceadores y multi-región:

1. **Inmutable y reconstruible.** La infraestructura se define declarativamente y se reconstruye desde definición; no se "arregla a mano". Un servidor comprometido se reemplaza, no se limpia.
2. **Cargas de trabajo de mínimo privilegio:** cada componente corre sin privilegios administrativos, sin capacidad de alcanzar lo que no necesita (segmentación de red por defecto-denegar entre servicios), y con identidad propia (§6.6).
3. **El borde absorbe la hostilidad:** todo tráfico de Z0 pasa por una capa de borde con filtrado, límites y protección anti-automatización antes de tocar aplicación. La aplicación nunca es alcanzable directamente.
4. **CDN y cachés compartidos jamás retienen contenido privado** (§8.5): la frontera de caché respeta la clasificación de datos.
5. **Multi-región con residencia consciente:** si algún día hay regiones, la ubicación de datos de un tenant es una decisión explícita y contractual (relevante para Habeas Data/GDPR), no un efecto colateral de balanceo.
6. **Disaster recovery como capacidad probada:** objetivos de recuperación por clase de dato (§10.3), ensayos periódicos de restauración total, y documentación ejecutable por alguien que no diseñó el sistema.
7. **Entornos separados de verdad:** producción, pruebas y desarrollo no comparten credenciales, secretos, redes ni datos (§14.5).

---

## 17. Escalabilidad de la seguridad

La arquitectura debe seguir siendo válida con miles de empresas, millones de documentos y cientos de millones de registros contables. Reglas para que la escala no erosione la seguridad:

1. **Las invariantes no se negocian por rendimiento** (§9.9). Si el aislamiento por tenant se vuelve costoso, se rediseña la partición de datos manteniendo la invariante — p. ej. mayor aislamiento físico para tenants grandes — nunca se relaja.
2. **El particionado natural es el tenant.** Toda estrategia futura de partición, sharding o archivado usa el tenant como primera dimensión; así el crecimiento refuerza el aislamiento en vez de amenazarlo.
3. **La auditoría escala como los datos:** su volumen crecerá más rápido que el negocio; su diseño (append-only, particionado, con archivado a almacenamiento frío verificable) debe soportarlo sin tentar jamás la opción "auditar menos".
4. **El equipo escala con guardarraíles:** con decenas de desarrolladores, la seguridad no puede depender de que todos recuerden las reglas — depende de que las rutas inseguras no existan (§5.2.3) y de verificación automática de invariantes en el pipeline (pruebas que intentan cruzar tenants, escalar privilegios, editar evidencia — y deben fallar).
5. **Los límites por tenant (§5.2.7) son también protección de escala:** el abuso de uno no puede convertirse en denegación de servicio de todos.

---

## 18. IA, agentes y automatizaciones

Cuando existan asistentes, agentes, automatizaciones y herramientas externas conectadas:

1. **Un agente de IA es un usuario no confiable con iniciativa.** Tiene identidad propia, permisos propios de mínimo privilegio acotados a tenant y acción, sesiones revocables y auditoría de cada acción (§13.2). Jamás opera con permisos del sistema ni hereda silenciosamente los del usuario que lo invocó: actúa **en nombre de** un usuario, con la **intersección** de los permisos del usuario y los del agente.
2. **Todo contenido que un agente lee es entrada hostil** (inyección de instrucciones en documentos, correos, campos de texto). Las instrucciones legítimas y los datos que el agente procesa se mantienen separados por diseño; ningún dato leído puede elevar lo que el agente tiene permitido hacer.
3. **Capacidades irreversibles requieren confirmación humana.** Un agente puede preparar un cierre contable, una exportación masiva o un envío a la autoridad tributaria; ejecutarlo exige aprobación de una identidad humana autorizada.
4. **Salida de datos hacia IA externa gobernada por clasificación (§10.1):** qué clases de datos pueden enviarse a qué proveedores es una política explícita por tenant; datos Restringidos no salen sin base contractual y consentimiento del tenant.
5. **Las integraciones de herramientas externas (tipo MCP u otros protocolos) son fronteras ZX:** cada herramienta conectada se inventaría, se le asigna alcance mínimo, y sus respuestas se tratan como entrada hostil.
6. **Cuotas y detección de anomalías específicas:** los agentes operan más rápido que humanos; sus límites de tasa y sus patrones de alerta son propios, no los de usuarios humanos.

---

## 19. Observabilidad

1. **Tres flujos con reglas distintas:** telemetría técnica (rendimiento, errores), logs de seguridad (autenticación, autorización, anomalías) y auditoría de negocio (§13). Se pueden correlacionar; nunca se confunden — la auditoría tiene garantías que la telemetría no necesita.
2. **Trazabilidad de extremo a extremo:** toda petición porta un identificador de correlación que atraviesa capas y sobrevive a colas y jobs; ante un incidente debe poder reconstruirse la historia completa de una acción en minutos, no días.
3. **Los logs respetan la clasificación de datos:** nunca credenciales, nunca contenido Restringido (§10.1); el log es un almacén más que puede filtrarse.
4. **Alertas orientadas a las invariantes:** intentos de cruce de tenant, ráfagas de denegaciones de autorización, enumeración de identificadores, exportaciones anómalas, uso de cuentas privilegiadas fuera de patrón, escrituras rechazadas sobre evidencia, fallos de verificación de integridad. Cada invariante de §21 tiene su señal de violación intentada.
5. **La detección asume brecha:** no solo se vigila el perímetro; se vigila el comportamiento interno (un servicio que consulta datos que nunca consulta, un volumen de lectura anómalo por identidad).
6. **Retención diferenciada:** los logs de seguridad se retienen lo suficiente para investigar incidentes descubiertos tarde; la telemetría técnica puede ser efímera.
7. **Respuesta a incidentes como capacidad:** roles definidos, capacidad de revocar credenciales/sesiones/integraciones en minutos, preservación de evidencia, y obligaciones de notificación (tenants y autoridad de protección de datos) contempladas de antemano.

---

## 20. Riesgos

### 20.1 Actuales

| Riesgo                      | Vector                                                       | Mitigación arquitectónica                                                |
| --------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Fuga entre tenants          | Consulta sin ámbito, endpoint transversal, caché compartida  | §5 (doble imposición, imposible por construcción), pruebas de invariante |
| Escalamiento de privilegios | Auto-concesión, confusión plataforma/tenant, mass-assignment | §5.3, §6.5, §7.3                                                         |
| Robo de sesión              | XSS, terceros en el frontend                                 | §8.3, §8.7, revocación §6.3                                              |
| Manipulación contable       | Edición de asientos, reapertura informal                     | §12, inmutabilidad Z5                                                    |
| Fuga de documentos          | Enlaces públicos, almacén navegable                          | §11.1–11.2                                                               |
| Compromiso de dependencia   | Paquete malicioso o vulnerado                                | §15                                                                      |
| Error interno humano        | Un solo desarrollador puede introducir ruta insegura         | Revisión obligatoria §15.3, guardarraíles §17.4                          |

### 20.2 Futuros y de crecimiento

- **Escala:** erosión del aislamiento por optimización, auditoría inabarcable, noisy neighbors → §17.
- **Equipo:** conocimiento de seguridad concentrado en pocas personas; módulos nuevos que ignoran el modelo central → §9 (reglas obligatorias), verificación automática de invariantes, este ADR como contrato.
- **Organizacionales:** presión comercial por excepciones ("este cliente grande necesita acceso especial"), soporte con acceso permanente por comodidad, secretos compartidos por urgencia → las invariantes de §21 existen precisamente para resistir esta presión; toda excepción exige ADR.
- **Tecnológicos:** cambio de proveedor de identidad, de base de datos o de nube → el modelo (identidad central, autorización declarativa, clasificación de datos, evidencia append-only) es independiente del proveedor; migrar es reimplementar mecanismos, no rediseñar garantías.
- **Terceros:** compromiso del proveedor de identidad, de correo o de la pasarela → ZX con assume breach: credenciales revocables, mínimo dato compartido, verificación de lo recibido.
- **Regulatorios:** nuevas exigencias DIAN, evolución de Habeas Data, futuras certificaciones → la clasificación de datos, la auditoría completa y la segregación de deberes son los cimientos que esas normas van a pedir; §22 reserva ADRs específicos.
- **IA:** agentes con exceso de permiso, inyección de instrucciones, fuga hacia modelos externos → §18.

---

## 21. Invariantes arquitectónicas de seguridad

Estas invariantes rigen durante toda la vida del producto. Ningún módulo, optimización, urgencia comercial o cambio de stack puede violarlas. Cambiar una exige un ADR que reemplace a este, con análisis de impacto completo.

| #   | Invariante                                                                                                                                                                                                      |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | **Aislamiento absoluto de tenant:** ningún dato, metadato ni señal de un tenant es accesible o inferible por otro tenant, por ninguna vía, en ninguna capa.                                                     |
| S2  | **Denegar por defecto:** todo acceso no concedido explícitamente está denegado; ante error o ambigüedad de un control, el sistema deniega (fail secure).                                                        |
| S3  | **Autorización en el servidor, en cada operación**, contra el estado actual de permisos, con el tenant derivado del contexto autenticado — jamás de un parámetro del cliente ni de la interfaz.                 |
| S4  | **Toda garantía crítica se impone en al menos dos capas independientes** (defensa en profundidad).                                                                                                              |
| S5  | **La evidencia es append-only:** auditoría, comprobantes contabilizados, períodos cerrados y documentos emitidos no se editan ni se borran dentro de su retención; la corrección es compensatoria y encadenada. |
| S6  | **Todo evento crítico queda auditado o la acción no ocurre.** Ningún rol puede alterar la auditoría.                                                                                                            |
| S7  | **Ninguna identidad se eleva a sí misma;** toda elevación la concede otra identidad con autoridad y queda registrada. Permisos de plataforma y de tenant son disjuntos.                                         |
| S8  | **Cero secretos fuera del inventario gobernado:** nunca en código, repositorio, artefacto, configuración versionada ni cliente; todo secreto es rotable y de ámbito mínimo.                                     |
| S9  | **Toda entrada externa es hostil hasta validarse; toda salida es una proyección mínima deliberada.** Ninguna instrucción dinámica se compone con datos del usuario.                                             |
| S10 | **Todo dato está clasificado** y su clase gobierna cifrado, acceso, logs, retención y salida a terceros o IA. Datos Restringidos nunca aparecen en logs, URLs ni clientes más allá de la vista autorizada.      |
| S11 | **Ninguna identidad individual ejecuta de extremo a extremo un flujo crítico irreversible** (segregación de deberes; dos personas para lo catastrófico).                                                        |
| S12 | **Nada llega a producción fuera del pipeline gobernado,** sin revisión de segunda persona y sin artefacto verificable.                                                                                          |
| S13 | **Los backups incluyen al menos una copia fuera del alcance de las credenciales de producción, y la restauración se ensaya periódicamente.**                                                                    |
| S14 | **Los agentes automáticos y de IA actúan con identidad propia, mínimo privilegio, en nombre de un humano cuando corresponde, y nunca ejecutan acciones irreversibles sin aprobación humana.**                   |
| S15 | **El acceso de la plataforma (soporte/operación) a datos de un tenant es excepcional, justificado, acotado en tiempo y visible para el tenant.**                                                                |

**Verificabilidad:** cada invariante debe tener, en el pipeline, pruebas que intenten violarla y fallen (intentos de cruce de tenant, de edición de evidencia, de auto-elevación). Una invariante sin prueba es una aspiración, no una invariante.

---

## 22. Fuera de alcance — futuros ADR de seguridad

Este documento fija el marco; los siguientes temas requieren ADR propio, subordinado a las invariantes de §21. El **ADR-SEC-002** (inventario del estado implementado actual) queda subordinado a este marco: donde contradiga estas invariantes (p. ej. su renuncia explícita a certificaciones), prevalece este documento y aquel deberá revisarse como ADR de implementación/hoja de ruta.

| ADR futuro         | Tema                                                                                                                             |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| ADR-SEC-002 (rev.) | Estado actual e implementación: brechas frente a este marco y hoja de ruta de hardening                                          |
| ADR-SEC-003        | Diseño del subsistema de auditoría: esquema de eventos, encadenamiento, retención y archivado                                    |
| ADR-SEC-004        | Ciclo de vida de sesiones e identidad: expiraciones, step-up, revocación, MFA, recuperación de cuentas                           |
| ADR-SEC-005        | Seguridad del almacén documental: versionado, firmas, huellas de integridad, análisis de contenido, retención legal              |
| ADR-SEC-006        | Gestión de claves y cifrado: jerarquía de claves, separación por tenant, rotación                                                |
| ADR-SEC-007        | Nómina electrónica y facturación electrónica: custodia de certificados de firma, evidencia de transmisión, contingencias DIAN    |
| ADR-SEC-008        | Plan de respuesta a incidentes y notificación de brechas (tenants, SIC/Habeas Data)                                              |
| ADR-SEC-009        | Continuidad y disaster recovery: objetivos por clase de dato, ensayos, multi-región si aplica                                    |
| ADR-SEC-010        | Seguridad de integraciones de IA y protocolos de herramientas externas (agentes, MCP): alcances, aprobaciones, cuotas            |
| ADR-SEC-011        | Programa de gestión de vulnerabilidades y divulgación responsable                                                                |
| ADR-SEC-012        | APIs públicas para terceros: ciclo de vida de credenciales de integración, scopes, cuotas comerciales                            |
| ADR-SEC-013        | Cumplimiento y certificaciones: mapeo de este marco contra ASVS, ISO 27001, SOC 2 cuando se emprendan                            |
| ADR-SEC-014        | Retención y supresión de datos personales: matriz finalidad/retención por tipo de dato (Habeas Data), incluidos datos de menores |
| ADR-SEC-015        | Modelo de autorización detallado: catálogo de roles, permisos, sedes, delegación y flujo de aprobación de elevaciones            |

---

## 23. Consecuencias

**Positivas**

- Todo módulo futuro tiene un contrato de seguridad claro antes de escribirse (§9), lo que reduce revisiones tardías y retrabajos.
- Las auditorías externas y certificaciones futuras encuentran los cimientos que exigen (clasificación, auditoría inmutable, segregación de deberes, gestión de vulnerabilidades) ya en la arquitectura.
- El cambio de cualquier tecnología del stack no invalida el modelo: las garantías están definidas por responsabilidad, no por herramienta.
- La presión comercial u operativa por excepciones se resuelve contra invariantes escritas, no contra opiniones.

**Costos aceptados**

- Fricción deliberada en flujos irreversibles (segunda aprobación, step-up) — es el precio de la integridad.
- La doble imposición del aislamiento y la auditoría obligatoria consumen rendimiento y almacenamiento — se acepta y se planifica (§17).
- Todo acceso de soporte a datos de tenants es más lento por diseño — se acepta: la alternativa es una puerta trasera permanente.

**Aprobación:** este ADR queda en estado _Propuesto_. Ninguna implementación derivada debe iniciarse hasta su aprobación explícita.
