# GOAL-01 — Primer Cliente Operando

## Resultado de negocio

Un operador educativo real puede ser incorporado en producción, configurar su organización y usuarios, cargar su planta de personal y completar el ciclo contratación → documento → expediente → seguimiento con seguridad, trazabilidad y soporte operativo suficientes para usar La Oficina Nítida comercialmente.

La evidencia final será un primer cliente que complete y acepte el recorrido principal en producción.

## Estado

`ACTIVO`

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
- el procesamiento inteligente está bloqueado deliberadamente hasta PR11.3;
- la generación basada en planes no completa todavía contrato, snapshots y expediente;
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

| Dependencia o decisión                        | Tipo                          | Estado         | Acción                                      |
| --------------------------------------------- | ----------------------------- | -------------- | ------------------------------------------- |
| Alcance laboral-documental del primer cliente | Estrategia de producto        | APROBADO       | Gobierna GOAL-01.                           |
| Perfil contractual como evidencia histórica   | Arquitectura                  | APROBADO       | Respetar ADR-004.                           |
| Procesamiento inteligente PR11.3              | Trabajo pendiente planificado | ABIERTO        | Completar en M4.                            |
| Superficie comercial de contabilidad          | Decisión de producto          | FUERA DEL GOAL | Resolver antes de priorizar un Goal futuro. |
| Infraestructura productiva                    | Dependencia técnica           | ABIERTO        | Resolver en M1.                             |

## Milestones y Epics

### M1 — Deployment verificable

**Resultado verificable:** la aplicación se despliega desde cero en un ambiente representativo y completa un smoke test autenticado.

**Estado del Milestone:** `BLOQUEADO` por una dependencia operativa externa verificable:
no existe todavía una URL de staging, secretos de entorno ni un workflow de despliegue
disponible en el repositorio o en GitHub. Este estado pertenece a M1; no cambia el
estado del Goal, que permanece `ACTIVO`.

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

M3 es el siguiente Milestone desbloqueado mientras M1 espera evidencia externa.
La decisión evita bloquear el Goal completo por un único camino operativo. E3.1,
E3.2 y E3.3 ya están fusionadas; E3.4 es la Epic activa porque mejora la
operabilidad de esas superficies sin requerir staging, R2, correo ni una nueva
decisión de dominio, y prepara el siguiente flujo sin adelantar M4.

- [x] E3.1 — Empleados CRUD, búsqueda e importación XLSX verificadas (PR #83 fusionada).
- [x] E3.2 — Perfiles contractuales y vínculos laborales precontractuales (PR #84 fusionada).
- [x] E3.3 — Configuración perfil → tipo documental → plantilla (PR #86 fusionada y verificada por CI/Browser E2E).
- [ ] E3.4 — Errores y bloqueos comprensibles para el operador (feedback accionable,
      reintentos de dependencias y enlaces a prerrequisitos existentes).

### Estado post-merge — E3.3 y prioridad E3.4

Tras fusionar E3.3, la revisión del grafo de dependencias en `main` confirma
que E3.4 — errores y bloqueos comprensibles para el operador — es la siguiente
Epic segura. El backend tenant-aware ya expone mensajes de validación y motivos
de bloqueo; la Epic mejora su entrega en las superficies de preparación laboral,
sin cambiar el contrato de dominio ni iniciar la resolución/confirmación de M4.
No requiere staging, R2 ni correo. E2.1 sigue pendiente por invitaciones y
correo, mientras M1 sigue bloqueado por staging.
La PR de mantenimiento que migra las acciones de GitHub a Node 24 es
independiente y no bloquea GOAL-01. PR #86 entregó únicamente E3.3 y quedó
fusionada después de que sus checks y los checks post-merge de `main` terminaran
en verde. La dependencia de E3.4 ya desapareció; GOAL-01 vuelve a `ACTIVO`, M1
permanece `BLOQUEADO` por staging y E3.4 pasa a implementación como la Epic
activa de M3. La entrega se limita a feedback operativo y no adelanta E4.1.

### M4 — Contratación Inteligente End-to-End

**Resultado verificable:** campaña → resolución → confirmación → procesamiento → contrato → PDF → expediente se completa desde la UI.

- [ ] E4.1 — Creación, preview y confirmación total/parcial desde frontend.
- [ ] E4.2 — PR11.3 procesa únicamente planes confirmados y respeta exclusiones.
- [ ] E4.3 — Perfil y snapshots preservados en contrato y documento.
- [ ] E4.4 — PDF canónico vinculado al contrato y publicado en expediente.
- [ ] E4.5 — Reintentos, idempotencia y errores parciales verificables.
- [ ] E4.6 — Contratación individual completa como flujo alternativo.
- [ ] E4.7 — Prueba browser del caso exitoso, parcial y reintentado.

### M5 — Expediente Digital Operativo

**Resultado verificable:** el expediente sustituye la carpeta operativa básica del empleado.

- [ ] E5.1 — Subida manual y validación de archivos.
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

| PR      | Epic  | Propósito                                                                 | Estado     | ¿Cierra capacidad?                                         |
| ------- | ----- | ------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------- |
| #78     | E1.1  | Imágenes reproducibles de staging para API y Web.                         | FUSIONADO  | No; E1.1 requiere verificación de staging.                 |
| #79     | E1.2  | Migraciones, seed y rol runtime PostgreSQL no privilegiado.               | FUSIONADO  | Sí; E1.2 verificada localmente y en DB limpia.             |
| #80     | E1.3  | R2, correo real y health/readiness checks.                                | FUSIONADO  | No; requiere verificación real en staging.                 |
| #81     | E1.4  | CI, observabilidad y base de pruebas browser end-to-end.                  | FUSIONADO  | Sí; CI y Browser E2E verificados; M1 aún requiere staging. |
| #83     | E3.1  | Verificación browser del CRUD, búsqueda e importación XLSX de empleados.  | FUSIONADO  | Sí; recorrido verificado browser.                          |
| #84     | E3.2  | Perfiles contractuales y vínculos laborales precontractuales desde la UI. | FUSIONADO  | Sí; recorrido verificado por CI y Browser E2E.             |
| #69–#76 | E3/E4 | Fundaciones de resolución, planes, generación y dominio inteligente.      | FUSIONADOS | No; el recorrido inteligente sigue abierto.                |

Los siguientes PRs se incorporarán por Epic conforme se descubra el siguiente paso mínimo. El Goal no se organiza como una lista anticipada de implementaciones.

## Auditoría actual

**Pregunta:** ¿un cliente podría utilizar hoy la capacidad completa definida por GOAL-01?

**Estado de cierre:** `GOAL ACTIVO — NO COMPLETADO`

Motivo: existen slices funcionales importantes, pero permanecen abiertas la gestión de usuarios, contratación inteligente end-to-end, expediente operativo, automatización de alertas, deployment y aceptación productiva.

Las PR #78, #79, #80, #81 y #83 fueron fusionadas. #78 entregó el empaquetado de E1.1,
pero E1.1 aún requiere verificación de staging. #79 entregó y verificó E1.2
con migraciones, seed idempotente y rol runtime no privilegiado. #80 entregó las
comprobaciones de R2, correo real y readiness; su cierre requiere verificación
real en staging. #81 entregó E1.4, está fusionada y sus checks de CI y Browser
E2E están verdes. GOAL-01 permanece `ACTIVO`; M1 está `BLOQUEADO` a la espera
de la validación operativa de staging de E1.1 y E1.3. E3.1 entregó el recorrido
browser de empleados y quedó fusionada en PR #83; su recorrido usó únicamente
la autenticación, persistencia y frontera tenant ya existentes, sin requerir
staging, R2, correo ni una nueva decisión de dominio. E3.2 expuso el catálogo
y vínculo laboral del backend desde la interfaz, sin requerir staging, R2,
correo ni una nueva decisión de dominio, y quedó fusionada en PR #84 con CI y
Browser E2E verdes. E2.1 permanece pendiente porque su recorrido completo

> La determinación vigente, actualizada después de E3.3, queda documentada en
> la sección post-merge: E3.3 está fusionada en PR #86 y verificada por CI y
> Browser E2E. GOAL-01 permanece `ACTIVO`; E3.4 está en implementación,
> pendiente de merge y verificación post-merge.
