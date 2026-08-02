# GOAL-01 — Primer Cliente Operando

## Resultado de negocio

Un operador educativo real puede ser incorporado en producción, configurar su organización y usuarios, cargar su planta de personal y completar el ciclo contratación → documento → expediente → seguimiento con seguridad, trazabilidad y soporte operativo suficientes para usar La Oficina Nítida comercialmente.

La evidencia final será un primer cliente que complete y acepte el recorrido principal en producción.

## Estado

`ACTIVO`

**Pausa selectiva:** GOAL-01 permanece `ACTIVO` y M1 continúa `BLOQUEADO POR
INFRAESTRUCTURA EXTERNA`. Las Epics que requieran dominio, DNS, Cloudflare, R2,
OCI Email Delivery, variables de producción o staging permanecen detenidas. E4.2
quedó fusionada por un camino independiente sin esas dependencias. El
desbloqueo operativo de M1 se controla con el [checklist de infraestructura](GOAL-01-M1-infrastructure-checklist.md).

## Estrategia que lo justifica

- **Cliente objetivo:** operadores educativos colombianos con alta carga laboral y documental.
- **Problema:** operación fragmentada entre Excel, Word, carpetas y herramientas desconectadas.
- **Resultado esperado:** operación laboral y documental centralizada, verificable y recuperable.
- **Razón para priorizarlo:** el código está más cerca de entregar esta promesa que facturación electrónica, nómina electrónica o una suite financiera completa.

Este Goal solo puede redefinirse si cambia la estrategia del producto. Nuevas ideas, módulos o mejoras se clasifican y van al Backlog cuando no son necesarias para incorporar al primer cliente.

## Evidencia inicial verificada en `main`

### Capacidades base existentes

- autenticación, recuperación de contraseña y aislamiento tenant en las superficies principales;
- empleados, importación XLSX, sedes e identidad corporativa con backend y frontend;
- plantillas HTML, documentos generados, PDF, storage y certificaciones laborales;
- contratos y lotes manuales con infraestructura documental;
- perfiles contractuales, vínculos precontractuales, resolución y confirmación inteligente en backend;
- expediente para documentos publicados y alertas generables manualmente;
- motores avanzados de nómina y contabilidad que no definen el alcance comercial activo.

### Rupturas comprobadas

- no existe administración de usuarios, invitaciones ni UI de roles;
- la UI no puede crear, resolver ni confirmar campañas inteligentes;
- E4.2 ya procesa planes confirmados; E4.3, E4.4 y E4.6 están fusionadas; E5.1 está en implementación para habilitar la subida manual al expediente;
- la generación basada en planes no completa todavía todos los casos de contrato, snapshots y expediente;
- la generación documental del contrato individual no está expuesta desde su UI;
- el expediente no permite subida manual ni clasificación operativa;
- las alertas requieren generación manual y no tienen scheduler;
- no hay suite browser end-to-end para el recorrido comercial;
- no existe deployment productivo reproducible ni evidencia de Go Live;
- el formulario público de demo simula el envío sin persistir ni notificar el lead;
- la base local auditada estaba doce migraciones detrás de `main`.

### Divergencias documentales

- documentación histórica presenta facturación electrónica como MVP, mientras el código solo ofrece facturación interna sin DIAN;
- documentación histórica afirma capacidades completas por PR o fase que no siempre son utilizables end-to-end;
- “multiempresa” implementa aislamiento por tenant, no acceso de un mismo usuario a varias organizaciones.

## Alcance

- deployment verificable y operación productiva;
- onboarding de organización y gestión de usuarios;
- preparación de información laboral necesaria para contratar;
- contratación individual e inteligente end-to-end;
- expediente digital operativo;
- alertas y seguimiento automático;
- seguridad, auditoría, recuperación y soporte necesarios para el primer cliente;
- alineación documental de las capacidades incluidas.

## Exclusiones y Backlog

- facturación electrónica DIAN y Matías API;
- nómina electrónica, PILA y transmisión regulatoria;
- definición comercial de la suite financiera/contable;
- firma electrónica;
- portal de empleados o clientes;
- inteligencia artificial;
- integraciones bancarias;
- escalabilidad anticipada sin evidencia de carga;
- mejoras cosméticas que no bloqueen la operación del primer cliente.

Estas exclusiones son limitaciones temporales del roadmap. No se numerarán como Goals futuros hasta ser priorizadas.

## Dependencias y decisiones

| Dependencia o decisión                        | Tipo                   | Estado            | Acción                                          |
| --------------------------------------------- | ---------------------- | ----------------- | ----------------------------------------------- |
| Alcance laboral-documental del primer cliente | Estrategia de producto | APROBADO          | Gobierna GOAL-01.                               |
| Perfil contractual como evidencia histórica   | Arquitectura           | APROBADO          | Respetar ADR-004.                               |
| E4.2 — Procesamiento de planes confirmados    | Trabajo entregado      | CERRADO           | PR #90 fusionada y verificada.                  |
| E4.3 — Perfil y snapshots históricos          | Trabajo entregado      | CERRADO           | PR #92 fusionada y verificada.                  |
| E4.4 — PDF canónico y expediente              | Trabajo entregado      | CERRADO           | PR #93 fusionada y verificada.                  |
| E4.6 — Contratación individual desde la UI    | Trabajo entregado      | CERRADO           | PR #94 fusionada y verificada.                  |
| E5.1 — Subida manual y validación de archivos | Trabajo en curso       | EN IMPLEMENTACIÓN | Epic independiente de M1 y de Epics fusionadas. |
| Superficie comercial de contabilidad          | Decisión de producto   | FUERA DEL GOAL    | Resolver antes de priorizar un Goal futuro.     |
| Infraestructura productiva                    | Dependencia técnica    | ABIERTO           | Resolver en M1.                                 |

## Milestones y Epics

### M1 — Deployment verificable

**Resultado verificable:** la aplicación se despliega desde cero en un ambiente representativo y completa un smoke test autenticado.

**Estado del Milestone:** `BLOQUEADO POR INFRAESTRUCTURA EXTERNA` por una dependencia operativa verificable:
no existe todavía una URL de staging, secretos de entorno ni un workflow de despliegue
disponible en el repositorio o en GitHub. Este estado pertenece a M1; no convierte al
Goal en bloqueado. GOAL-01 permanece `ACTIVO`.

- [ ] E1.1 — Staging reproducible, configuración y secretos.
- [x] E1.2 — Migraciones, seed y rol PostgreSQL runtime no privilegiado.
- [ ] E1.3 — R2, correo real y health/readiness checks.
- [x] E1.4 — CI, observabilidad y base de pruebas browser end-to-end.

E1.4 se fusionó en `main` como PR #81, con los checks de CI y Browser E2E
verdes y auditoría `APROBADO PARA MERGE`. E1.3 también está fusionada y sus
rutas `/health` y `/readiness` son la base de los smoke tests. La verificación
real de R2 y correo de E1.3, junto con la validación de staging reproducible de
E1.1, sigue siendo evidencia operativa pendiente y no se declara cerrada por
la sola existencia del código. M1 no desbloquea el camino de M2 que requiere
deployment y correo, pero esta dependencia no bloquea los caminos independientes
del Goal.

La investigación de `main` no encontró una URL de staging, secretos de entorno
ni un workflow de despliegue disponible en el repositorio o en GitHub. Esta es
una dependencia operativa externa pendiente, no una decisión de arquitectura.
La prioridad se reevalúa como un grafo de dependencias: M3 puede avanzar sin
staging, R2, correo ni una decisión de dominio pendiente.

### M2 — Gestión de Organizaciones y Usuarios

**Resultado verificable:** un cliente opera con varias personas sin compartir credenciales.

- [ ] E2.1 — Administración e invitación/creación de usuarios.
- [ ] E2.2 — Activación, desactivación y roles ADMIN/OPERADOR.
- [ ] E2.3 — Recuperación de acceso real por correo.
- [ ] E2.4 — Sedes, identidad y promesa multiempresa coherente con el producto real.

### M3 — Preparación de la Operación Laboral

**Resultado verificable:** el operador prepara desde la interfaz todos los datos necesarios para contratar.

**Estado del Milestone:** `COMPLETADO`.

M3 fue el Milestone desbloqueado mientras M1 esperaba evidencia externa. La
decisión evitó bloquear el Goal completo por un único camino operativo. E3.1,
E3.2, E3.3 y E3.4 están fusionadas; sus recorridos preparan el siguiente flujo
sin requerir staging, R2, correo ni una nueva decisión de dominio.

- [x] E3.1 — Empleados CRUD, búsqueda e importación XLSX verificadas (PR #83 fusionada).
- [x] E3.2 — Perfiles contractuales y vínculos laborales precontractuales (PR #84 fusionada).
- [x] E3.3 — Configuración perfil → tipo documental → plantilla (PR #86 fusionada y verificada por CI/Browser E2E).
- [x] E3.4 — Errores y bloqueos comprensibles para el operador (feedback accionable,
      reintentos de dependencias y enlaces a prerrequisitos existentes; PR #88 fusionada
      y verificada por CI/Browser E2E post-merge).

### Estado post-merge y siguiente Epic — E5.1 en implementación

Tras fusionar E4.3 en PR #92, `main` contiene la preservación de snapshots históricos
de contrato y documento. Los checks del PR fueron verdes; el Browser E2E post-merge
expuso un selector estricto frágil en `employees-smoke`, que esta rama corrige como
mantenimiento de estabilidad de CI. La revisión del estado real del repositorio
confirma que no existe evidencia operativa suficiente para cerrar M1, pero también
confirma que E5.1 no depende de ese entorno.

El backend tenant-aware y la superficie frontend/BFF de E4.1 conservan los contratos
de preview y confirmación, planes, exclusiones y snapshots históricos sin cambiar el
contrato de dominio. E4.2 procesa esos planes confirmados y deja fuera las
exclusiones, usando PostgreSQL, Puppeteer y la abstracción de storage existente. PR
#90 quedó fusionada en `main` con CI y Browser E2E verdes. PR #93 (E4.4) y PR
#94 (E4.6) quedaron fusionadas con CI y Browser E2E post-merge verdes, pero E5.1
no depende de ninguna de ellas: reutiliza el
modelo `ExpedienteDoc`, la abstracción `StorageService` y la autenticación tenant-aware
ya fusionadas.
E2.1 continúa pendiente porque su recorrido completo requiere invitaciones por
correo real; no se adelanta ni se modifica. La decisión de prioridad no desbloquea
M1: permitió avanzar primero E4.2 y luego E4.3 por caminos independientes. E5.1
continúa por otro camino independiente y no introduce retrabajo en E4.4, E4.6 ni
en las Epics posteriores del expediente.
La migración de las acciones de GitHub a Node 24 fue una tarea de mantenimiento
independiente ya fusionada y no cambia el estado del Goal.

E5.1 es el siguiente nodo desbloqueado del Goal. La Epic permite subir manualmente
un PDF o imagen al expediente de un empleado, valida bytes mágicos y extensión,
persiste el índice tenant-aware, audita la operación y limpia el objeto si falla la
persistencia. No requiere dominio, DNS, Cloudflare, R2 específico, OCI Email Delivery,
variables de producción ni staging; usa el proveedor local existente en desarrollo
y conserva E5.2 para descarga/versionado posterior.

### M4 — Contratación Inteligente End-to-End

**Resultado verificable:** campaña → resolución → confirmación → procesamiento → contrato → PDF → expediente se completa desde la UI.

- [x] E4.1 — Creación, preview y confirmación total/parcial desde frontend (PR #89 fusionada y verificada por CI/Browser E2E).
- [x] E4.2 — PR11.3 procesa únicamente planes confirmados y respeta exclusiones (PR #90 fusionada y verificada por CI/Browser E2E).
- [x] E4.3 — Perfil y snapshots preservados en contrato y documento (PR #92 fusionada y verificada por CI/Browser E2E del PR).
- [x] E4.4 — PDF canónico vinculado al contrato y publicado en expediente (PR #93 fusionada y verificada por CI/Browser E2E post-merge).
- [ ] E4.5 — Reintentos, idempotencia y errores parciales verificables.
- [x] E4.6 — Contratación individual completa como flujo alternativo (PR #94 fusionada y verificada por CI/Browser E2E post-merge).
- [ ] E4.7 — Prueba browser del caso exitoso, parcial y reintentado.

### M5 — Expediente Digital Operativo

**Resultado verificable:** el expediente sustituye la carpeta operativa básica del empleado.

- [ ] E5.1 — Subida manual y validación de archivos (en implementación en la rama actual).
- [ ] E5.2 — Clasificación, consulta, descarga e historial/versionado definido.
- [ ] E5.3 — Inmutabilidad de documentos publicados y permisos por rol.
- [ ] E5.4 — Auditoría e integración consistente con contratos y certificaciones.

### M6 — Seguimiento Operativo

**Resultado verificable:** el sistema detecta y presenta trabajo pendiente sin generación manual del usuario.

- [ ] E6.1 — Scheduler de vencimientos y documentos faltantes.
- [ ] E6.2 — Dashboard accionable y resolución trazable.
- [ ] E6.3 — Fallos, reintentos y auditoría visibles para operación.

### M7 — Go Live Comercial

**Resultado verificable:** el primer cliente completa y acepta el recorrido principal en producción.

- [ ] E7.1 — Backup y restauración probados.
- [ ] E7.2 — Monitoreo, alertamiento técnico y soporte operativo.
- [ ] E7.3 — Captura real de solicitudes de demo y promesas públicas alineadas.
- [ ] E7.4 — Onboarding y aceptación del cliente piloto con datos representativos.
- [ ] E7.5 — Primer tenant productivo listo para operación comercial sostenida.

## Criterios de aceptación del Goal

- [ ] existe un primer cliente identificado y autorizado para el piloto;
- [ ] usuarios ADMIN y OPERADOR acceden sin compartir credenciales;
- [ ] la planta de personal se registra o importa con manejo verificable de errores;
- [ ] se completa una contratación individual y una campaña inteligente;
- [ ] cada contrato conserva snapshots y produce un PDF canónico;
- [ ] el documento llega al expediente correcto y puede descargarse con autorización;
- [ ] el expediente admite los documentos operativos básicos definidos para el piloto;
- [ ] las alertas se generan automáticamente y conducen a una acción;
- [ ] aislamiento tenant, auditoría y accesos privados están verificados;
- [ ] deployment, migraciones, backup, restauración, monitoreo y soporte están probados;
- [ ] existe evidencia browser end-to-end del recorrido principal en producción;
- [ ] el cliente piloto acepta el resultado para operación real;
- [ ] documentación y código describen la misma capacidad;
- [ ] todos los PRs requeridos están fusionados en `main`.

## PRs asociados

| PR       | Epic  | Propósito                                                                 | Estado            | ¿Cierra capacidad?                                         |
| -------- | ----- | ------------------------------------------------------------------------- | ----------------- | ---------------------------------------------------------- |
| #78      | E1.1  | Imágenes reproducibles de staging para API y Web.                         | FUSIONADO         | No; E1.1 requiere verificación de staging.                 |
| #79      | E1.2  | Migraciones, seed y rol runtime PostgreSQL no privilegiado.               | FUSIONADO         | Sí; E1.2 verificada localmente y en DB limpia.             |
| #80      | E1.3  | R2, correo real y health/readiness checks.                                | FUSIONADO         | No; requiere verificación real en staging.                 |
| #81      | E1.4  | CI, observabilidad y base de pruebas browser end-to-end.                  | FUSIONADO         | Sí; CI y Browser E2E verificados; M1 aún requiere staging. |
| #83      | E3.1  | Verificación browser del CRUD, búsqueda e importación XLSX de empleados.  | FUSIONADO         | Sí; recorrido verificado browser.                          |
| #84      | E3.2  | Perfiles contractuales y vínculos laborales precontractuales desde la UI. | FUSIONADO         | Sí; recorrido verificado por CI y Browser E2E.             |
| #86      | E3.3  | Configuración perfil → tipo documental → plantilla desde UI.              | FUSIONADO         | Sí; CI/Browser E2E y checks post-merge verdes.             |
| #88      | E3.4  | Feedback accionable para errores, bloqueos y reintentos operativos.       | FUSIONADO         | Sí; CI/Browser E2E post-merge verdes.                      |
| #89      | E4.1  | Creación, preview y confirmación total/parcial desde frontend.            | FUSIONADO         | Sí; CI/Browser E2E post-merge verdes.                      |
| #90      | E4.2  | Procesamiento de planes confirmados y exclusiones desde la campaña.       | FUSIONADO         | Sí; CI/Browser E2E verdes.                                 |
| #92      | E4.3  | Perfil y snapshots confirmados preservados en contrato y documento.       | FUSIONADO         | Sí; CI y Browser E2E verdes.                               |
| #93      | E4.4  | PDF canónico vinculado al contrato y publicado en expediente.             | FUSIONADO         | Sí; CI y Browser E2E post-merge verdes.                    |
| #94      | E4.6  | Contratación individual completa desde la UI.                             | FUSIONADO         | Sí; CI y Browser E2E post-merge verdes.                    |
| (actual) | E5.1  | Subida manual y validación de archivos en expediente.                     | EN IMPLEMENTACIÓN | No; PR en preparación.                                     |
| #69–#76  | E3/E4 | Fundaciones de resolución, planes, generación y dominio inteligente.      | FUSIONADOS        | No; el recorrido inteligente sigue abierto.                |

Los siguientes PRs se incorporarán por Epic conforme se descubra el siguiente paso mínimo. El Goal no se organiza como una lista anticipada de implementaciones.

## Auditoría actual

**Pregunta:** ¿un cliente podría utilizar hoy la capacidad completa definida por GOAL-01?

**Estado de cierre:** `GOAL ACTIVO — NO COMPLETADO`

Motivo: existen slices funcionales importantes, pero permanecen abiertas la gestión de usuarios, contratación inteligente end-to-end, expediente operativo, automatización de alertas, deployment y aceptación productiva.

Las PR #78, #79, #80, #81, #83, #84, #86, #88, #89, #90 y #92 fueron fusionadas. #78 entregó el empaquetado de E1.1,
pero E1.1 aún requiere verificación de staging. #79 entregó y verificó E1.2
con migraciones, seed idempotente y rol runtime no privilegiado. #80 entregó las
comprobaciones de R2, correo real y readiness; su cierre requiere verificación
real en staging. #81 entregó E1.4, está fusionada y sus checks de CI y Browser
E2E están verdes. E3.4 fue fusionada en PR #88 y sus checks post-merge de `main`
están verdes. E4.1 fue fusionada en PR #89 y sus checks post-merge de `main` están
verdes. GOAL-01 permanece `ACTIVO`; M1 está `BLOQUEADO POR
INFRAESTRUCTURA EXTERNA` a la espera de la validación operativa de dominio, DNS,
Cloudflare, R2, correo, secretos, certificados y staging para E1.1 y E1.3. E3.1 entregó el recorrido
browser de empleados y quedó fusionada en PR #83; su recorrido usó únicamente
la autenticación, persistencia y frontera tenant ya existentes, sin requerir
staging, R2, correo ni una nueva decisión de dominio. E3.2 expuso el catálogo
y vínculo laboral del backend desde la interfaz, sin requerir staging, R2,
correo ni una nueva decisión de dominio, y quedó fusionada en PR #84 con CI y
Browser E2E verdes. E2.1 permanece pendiente porque su recorrido completo requiere
invitaciones por correo real. E4.1 ya fue implementada, auditada y fusionada en PR
#89; su recorrido de creación, preview y confirmación total/parcial quedó verificado
por CI y Browser E2E. E4.2 fue implementada, auditada y fusionada en PR #90:
el código de `main` rechazaba campañas inteligentes sin `documentTemplateId` y no
filtraba los empleados excluidos antes de crear contratos. La corrección usa sólo
los planes `CONFIRMADO`/`CONSUMIDO`, no requiere DNS, Cloudflare, R2 específico,

OCI Email Delivery ni staging, y no adelanta E4.5. E4.3 quedó implementada y
fusionada en PR #92; el fallo post-merge del Browser E2E fue un selector estricto
en `employees-smoke`, no una regresión funcional del producto. E4.4 quedó fusionada
en PR #93 y E4.6 en PR #94, ambas con checks post-merge verdes. E5.1 es la Epic
independiente que continúa ahora.

> La determinación vigente, actualizada después de E3.4, queda documentada en
> la sección post-merge: E4.3, E4.4 y E4.6 están fusionadas en PR #92, #93 y #94.
> GOAL-01 permanece `ACTIVO`; M1 sigue `BLOQUEADO POR INFRAESTRUCTURA EXTERNA` y
> E5.1 es la Epic independiente en implementación.
