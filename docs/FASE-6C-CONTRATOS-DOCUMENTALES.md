# Fase 6C — Contratos Documentales

**Estado:** Propuesta para aprobación  
**Fecha:** 2026-07-28  
**Alcance:** contrato laboral → PDF → expediente digital.  
**Fuera de alcance:** DOCX, R2, firma electrónica/certificada, carga manual, renovaciones automáticas, endpoints nuevos y microservicios.

## Decisión ejecutiva

La Fase 6C materializa el contrato laboral ya creado en un único documento canónico por contrato. El flujo sigue en el monolito:

```text
Empleado → Contrato (snapshot laboral) → GeneratedDocument (snapshot textual) → PDF → ExpedienteDoc
```

Contrato es la fuente de verdad laboral. `GeneratedDocument` conserva el contenido final inmutable. `ExpedienteDoc` indexa el mismo artefacto dentro del expediente; no duplica archivos, contenido ni reglas de generación.

El MVP conserva la restricción actual: un documento generado por contrato. Un reintento técnico completa o devuelve esa misma identidad; no produce una versión nueva. La sustitución semántica y la firma quedan para fases posteriores.

---

## 1. Modelo de dominio

### Contrato

Representa el acuerdo laboral administrado por el tenant: tipo, cargo, salario, vigencia, sede y ciclo de vida contractual (`VIGENTE`, `VENCIDO`, `TERMINADO`, `RENOVADO`). Sus datos laborales y `variablesSnapshot` son el contexto histórico del que se genera el documento.

Responsabilidades:

- Fuente de verdad de la relación laboral y su ciclo de vida.
- Conservar los valores usados al contratar aunque empleado, sede o tenant cambien.
- Autorizar o bloquear la materialización documental.
- Relacionar el acto laboral con su documento, sin manejar bytes, rutas ni expediente.

No es responsable de renderizar PDF, almacenar objetos, clasificar el expediente ni probar una firma.

### Documento generado

`GeneratedDocument` es una instancia documental concreta, con procedencia en una `DocumentTemplate`, empleador/empleado y, en 6C, un contrato. `contenidoFinal` es el snapshot textual definitivo y la única fuente de contenido que se renderiza.

Responsabilidades:

- Conservar plantilla elegida, contrato/empleado de origen y contenido final.
- Identificar el PDF canónico y sus metadatos técnicos.
- Ser la identidad estable para reintentos y para la entrada del expediente.

El vínculo con plantilla es de procedencia: editar, inactivar o eliminar lógicamente una plantilla después no altera el documento. Tampoco debe volver a interpolar datos actuales del empleado o del tenant.

### Documento firmado — futuro, fuera del MVP

Es un derivado inmutable y probatorio de un `GeneratedDocument` específico: PDF firmado, fecha, firmantes, proveedor y evidencia. Nunca sobrescribe el PDF generado ni muta `contenidoFinal`.

Por ello 6C no usa un booleano, una URL alternativa ni una categoría de expediente para simular firma. La fase futura deberá introducir un agregado de evidencia de firma y, si se publica como artefacto separado, su vínculo explícito con `ExpedienteDoc`.

### ExpedienteDoc

Es el índice documental del expediente digital del empleado. Indica pertenencia a tenant/empleado, clasifica como `CONTRATO`, localiza el artefacto y enlaza su procedencia con `GeneratedDocument` y `Contrato`.

Responsabilidades:

- Organización y consulta por empleado/categoría.
- Referencia única al archivo real, con metadatos de almacenamiento.
- Integración de consultas del expediente y alertas.

No genera PDF, no decide elegibilidad contractual, no recompone variables y no almacena una ruta lógica distinta al archivo real. Es el único modelo activo del expediente: no se reintroduce `EmployeeFile`.

---

## 2. Flujo funcional oficial

| Paso               | Operación                                                                                                                   | Resultado y responsable                                                                |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 1. Empleado        | Se selecciona un empleado activo del tenant.                                                                                | Aporta identidad al contrato; no vuelve a ser fuente de datos del documento histórico. |
| 2. Contrato        | Se crea contrato con snapshot, normalmente `VIGENTE`. El lote crea o recupera el contrato de cada empleado.                 | `Contrato` es el origen laboral; todavía no hay artefacto.                             |
| 3. Selección       | Se valida una plantilla activa de tipo `CONTRACT`. En lote se usa obligatoriamente la plantilla fijada en el lote.          | Procedencia documental explícita.                                                      |
| 4. Generación      | Contratos valida el snapshot, sustituye variables sólo desde él y crea o recupera el `GeneratedDocument` único.             | `contenidoFinal` inmutable.                                                            |
| 5. Materialización | El motor documental renderiza ese contenido a PDF y lo guarda mediante la abstracción de storage.                           | PDF en clave canónica, con tamaño real.                                                |
| 6. Expediente      | Una transacción registra la referencia del PDF, asegura el `ExpedienteDoc` `CONTRATO` y registra auditoría del acto lógico. | El expediente apunta al mismo PDF; no hay estado DB parcial.                           |
| 7. Consulta        | Contrato y expediente consultan sus relaciones al mismo artefacto.                                                          | Dos vistas de un hecho, sin sincronizaciones ni copias.                                |

Los bytes se escriben antes de la transacción de base de datos porque el storage no es transaccionable con PostgreSQL. Si esa transacción falla puede quedar un huérfano físico, pero la clave determinista permite que el reintento lo sobrescriba y la base de datos permanece consistente.

---

## 3. Estados

Contrato y documento tienen ciclos distintos; no se agregan estados documentales al enum de `Contrato`.

| Estado conceptual documental | Condición                                                       | ¿Se persiste en MVP? | Decisión                                             |
| ---------------------------- | --------------------------------------------------------------- | -------------------- | ---------------------------------------------------- |
| Pendiente                    | No hay `GeneratedDocument` para el contrato.                    | No                   | Es derivable desde el contrato.                      |
| En materialización           | Hay identidad documental, pero no publicación completa.         | No                   | Es transitorio técnico y recuperable.                |
| Generado                     | Existen PDF canónico y `ExpedienteDoc` único.                   | No                   | Es derivable y evita una fuente de verdad adicional. |
| Firmado                      | Existe evidencia de firma válida.                               | No                   | Fuera de 6C.                                         |
| Reemplazado                  | Existe una versión semántica posterior con cadena de reemplazo. | No                   | Requiere gobernanza y versionado aprobados.          |
| Archivado                    | Aplican política de retención/solo lectura.                     | No                   | Política no definida.                                |

No se crea `BORRADOR` documental: el contrato pendiente de materializar ya cubre ese punto. Un `GeneratedDocument` incompleto representa una recuperación técnica, no una decisión humana.

---

## 4. Reglas de negocio e idempotencia

1. Sólo se documenta un `Contrato` existente del tenant, con empleado no eliminado y estado `VIGENTE`.
2. No se genera por primera vez para `VENCIDO`, `TERMINADO` o `RENOVADO`: el documento debe existir antes de la transición. Así no se presenta como contemporánea una emisión tardía.
3. Se exige plantilla `CONTRACT`, activa y no eliminada. Varias candidatas exigen selección explícita; en lote se usa `LoteContrato.documentTemplateId`, nunca selección implícita.
4. Un `variablesSnapshot` legado o inválido bloquea la generación. No se repara leyendo el empleado actual.
5. Cambiar empleado, sede, tenant, logo, representante, plantilla o salario después de la generación no cambia ni regenera el documento. La representación contractual se compone desde snapshots antes de renderizar; el renderizador no añade datos laborales o branding leídos en vivo.
6. Un cambio laboral posterior se representa mediante nuevo contrato, adición u otro acto futuro. No se muta el snapshot de un contrato documentado.
7. La identidad de documento contractual es `(tenantId, contratoId)` y la restricción parcial única por `contratoId` sigue siendo la garantía ante concurrencia.
8. La identidad de la proyección de expediente es `generatedDocumentId`; la restricción única existente evita dos `ExpedienteDoc` del mismo documento generado.
9. Repetir la operación funcional devuelve el mismo resultado. No crea otro PDF, expediente ni evento de emisión. El mensaje de conflicto «ya existe» no es la semántica idempotente esperada.
10. Si existe documento pero falta PDF o expediente, el caso de uso reconcilia sólo lo faltante. En carrera, relee la fila ganadora y devuelve el resultado alcanzado.
11. La clave del objeto se deriva de tenant y `GeneratedDocument.id`; jamás de timestamps o valores aleatorios. Es segura de sobrescribir en retry.
12. Referencia PDF, `ExpedienteDoc` y auditoría de éxito se confirman en una sola transacción de DB. El audit debe distinguir `creado`, `recuperado` y `reparado`; reintento idempotente no genera una nueva emisión.
13. En MVP sólo hay regeneración técnica del mismo documento. No hay borrado/regeneración semántica desde UI.
14. Reemplazo queda diferido: requerirá nueva versión, relación `reemplaza/reemplazadoPor`, motivo, actor y retención de la versión previa. Tras firma nunca será sobrescritura.

---

## 5. Modelo de datos

Relaciones objetivo:

```text
Tenant 1 ─ N Empleado 1 ─ N Contrato 1 ─ 0..1 GeneratedDocument 1 ─ 0..1 ExpedienteDoc
DocumentTemplate 1 ─ N GeneratedDocument
```

| Entidad                | Cambio conceptual para 6C                                                                              | Impacto esperado                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `GeneratedDocument`    | Añadir clave canónica del PDF, por ejemplo `pdfStorageKey`, y tamaño real al materializar.             | La identidad física deja de depender de `pdfUrl`; prepara el cambio futuro de proveedor. |
| `GeneratedDocument`    | Mantener `pdfUrl` sólo como locator de presentación mientras haya consumidores.                        | Se separa acceso HTTP de almacenamiento.                                                 |
| `ExpedienteDoc`        | `storageKey` debe ser exactamente la clave del PDF generado; `tamanoBytes` toma metadata del provider. | El expediente deja de apuntar a una ruta ficticia.                                       |
| Restricciones actuales | Conservar unicidad parcial por `contratoId` y por `generatedDocumentId`.                               | Un documento contractual y un índice de expediente por identidad, bajo concurrencia.     |
| `Contrato`             | Sin campos documentales nuevos; conserva `variablesSnapshot`.                                          | Evita duplicar PDF, estado o plantilla en el agregado equivocado.                        |
| Firma futura           | Entidad propia vinculada a documento base, no un campo rápido.                                         | Evidencia legal separada de la generación básica.                                        |

No se agregan ahora estados de documento, DOCX, R2, campos de firma ni soporte de reemplazos. No se escriben migraciones en esta especificación.

---

## 6. Integración sin duplicar responsabilidades

### Contratos

Es dueño del caso de uso «asegurar documento contractual»: elegibilidad, plantilla, snapshot, contenido e idempotencia. En lotes, el motor sólo coordina progreso y delega este caso de uso usando la plantilla congelada en el lote. Contratos no escribe bytes ni inserta directamente el expediente.

### Motor documental

`GeneratedDocuments`, PDF y Storage son dueños de convertir contenido final a PDF, guardarlo y persistir su referencia técnica. El motor genérico puede seguir atendiendo documentos no contractuales, pero no resuelve de nuevo reglas o variables contractuales.

### ExpedienteDoc

Es dueño de asegurar la proyección por `GeneratedDocument`: recibe identidad, metadata y clave ya calculadas, clasifica y vincula. No llama renderizadores ni decide reintentos contractuales.

### Seguridad y auditoría

JWT, tenant activo y roles existentes permanecen en el borde. El tenant se obtiene de sesión, nunca de parámetros de negocio. Contrato, plantilla, documento, expediente y descarga se validan en el mismo tenant; la clave de storage no concede acceso por sí sola.

---

## 7. Riesgos y mitigaciones

| Tipo           | Riesgo                                                             | Mitigación                                                        |
| -------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------- |
| Funcional      | Generar desde datos actuales cambia documentos históricos.         | Resolver sólo desde `Contrato.variablesSnapshot`.                 |
| Funcional      | Lote usa otra plantilla activa.                                    | Pasar y validar `documentTemplateId` del lote.                    |
| Funcional      | Confundir generado con firmado.                                    | Estados separados; firma fuera de 6C.                             |
| Técnico        | `pdfUrl` y `ExpedienteDoc.storageKey` apuntan a objetos distintos. | Clave canónica compartida en documento y expediente.              |
| Técnico        | Retries duplican filas o fallan con P2002.                         | Reconciliación idempotente + restricciones DB + relectura.        |
| Técnico        | Archivo escrito con DB rollback.                                   | Aceptar sólo huérfano físico determinista; nunca DB parcial.      |
| Seguridad      | Acceso intertenant o descarga directa.                             | Filtros tenant, autorización de descarga y segregación de claves. |
| Seguridad      | HTML de plantilla carga código o recursos remotos al renderizar.   | Sanitización, allowlist de recursos y aislamiento del renderer.   |
| Seguridad      | Sin trazabilidad de emisión.                                       | Auditoría transaccional de acto lógico y actor.                   |
| Mantenibilidad | Dos resolutores de placeholders divergen.                          | Un único resolver contractual; motor recibe contenido final.      |
| Mantenibilidad | Expediente se vuelve fuente de contenido/estado.                   | Mantenerlo como índice y referencia.                              |

---

## 8. Plan de implementación en PRs reversibles

1. **6C.1 — Contrato de dominio y modelo.** Formalizar invariantes, acciones de auditoría y la evolución necesaria para la clave canónica/metadata. Gate: las restricciones 0..1 se preservan.
2. **6C.2 — Orquestación contractual.** Implementar elegibilidad, plantilla explícita, resolver de snapshot y creación segura. Gate: cambios posteriores no alteran `contenidoFinal`; carreras crean una identidad.
3. **6C.3 — Materialización PDF idempotente.** Renderizar sólo contenido final, persistir clave canónica/tamaño y recuperar fallos. Gate: retry no duplica ni publica estado parcial.
4. **6C.4 — Expediente y auditoría atómicos.** Asegurar proyección en la transacción de publicación y auditar la acción. Gate: rollback deja DB sin referencia PDF ni expediente; retry converge.
5. **6C.5 — Integración de lotes.** Delegar a la orquestación anterior con plantilla congelada. Gate: reprocesar lote sólo repara incompletos.
6. **6C.6 — Consulta sobre la UI existente.** Detalle de contrato y expediente exponen la misma referencia, sin duplicar listas ni diseñar nuevas superficies HTTP. Gate: mismo documento, roles y tenant correctos.
7. **6C.7 — Cierre de seguridad.** Pruebas de aislamiento, concurrencia, fallos, consistencia de claves, auditoría y sanitización. Gate: todos los caminos idempotentes y de rollback pasan.

## Criterios de aceptación arquitectónicos

- Un contrato válido llega a un único PDF visible en el expediente.
- El PDF y `ExpedienteDoc.storageKey` identifican el mismo objeto físico.
- Retry de usuario, lote o carrera concurrente converge a un documento y un expediente.
- Cambios posteriores de datos o plantilla no alteran la evidencia histórica.
- 6C no afirma firma, no crea DOCX, no usa R2 y no activa renovaciones automáticas.
