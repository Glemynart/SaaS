# FASE 7 — Certificaciones Laborales

**Estado:** Propuesta arquitectónica para aprobación  
**Alcance:** emisión de certificaciones laborales mediante el flujo documental existente.  
**Fuera de alcance:** agregado `CertificaciónLaboral`, snapshot estructurado paralelo, firma electrónica o certificada, certificados salariales, DOCX, carga manual, autoservicio de empleados, envío por correo, revocación, reemplazo y recursos externos en el renderer.

## Decisión ejecutiva

Una certificación laboral es un documento emitido para un empleado; no es un agregado de dominio independiente. La arquitectura reutiliza exclusivamente los modelos documentales ya aprobados:

```text
Empleado → DocumentTemplate (CERTIFICATION) → GeneratedDocument → PDF → ExpedienteDoc
```

`GeneratedDocument` es la identidad de la emisión. `contenidoFinal` es el único snapshot canónico y la única fuente de contenido que se renderiza. `ExpedienteDoc` sólo indexa el mismo PDF dentro del expediente; no conserva otro contenido, no crea una emisión y no duplica el archivo.

Cada solicitud explícita de certificación crea un nuevo `GeneratedDocument`. Un reintento técnico recupera el mismo `GeneratedDocument` ya creado y completa únicamente el paso que falte. Una solicitud posterior, incluso para el mismo empleado, constituye una emisión distinta y crea otro documento.

---

## 1. Objetivo y alcance

La Fase 7 permite emitir una certificación laboral trazable para un empleado del tenant activo, usando una plantilla activa de tipo `CERTIFICATION`, materializarla como PDF canónico y publicarla en el expediente digital bajo categoría `CERTIFICADO`.

El MVP cubre:

- Selección explícita de empleado y plantilla `CERTIFICATION`.
- Validación de tenant, autorización y estado del empleado antes de emitir.
- Sustitución de variables una sola vez al crear el documento.
- Conservación inmutable del contenido final emitido.
- Materialización idempotente del PDF canónico.
- Publicación idempotente del índice `ExpedienteDoc`.
- Auditoría de emisión, recuperación y reparación técnica.
- Consulta del mismo documento desde la superficie documental y el expediente.

La fase no crea una entidad `CertificaciónLaboral`, no agrega ciclos de aprobación y no modifica contratos para emitir una certificación.

---

## 2. Modelo de dominio

| Entidad             | Responsabilidad                                                                                                                                | No es responsable de                                                                            |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `Empleado`          | Aportar los datos vigentes y la pertenencia al tenant en el instante anterior a la emisión.                                                    | Conservar evidencia histórica, renderizar o publicar documentos.                                |
| `DocumentTemplate`  | Aportar la estructura textual y placeholders permitidos de tipo `CERTIFICATION`.                                                               | Alterar documentos emitidos o resolver datos después de la emisión.                             |
| `GeneratedDocument` | Representar una emisión concreta; conservar plantilla de procedencia, empleado, tenant, tipo, `contenidoFinal` y la identidad técnica del PDF. | Recalcular datos laborales, interpretar reglas del expediente o duplicar la evidencia.          |
| `ExpedienteDoc`     | Indexar el PDF publicado por empleado y categoría `CERTIFICADO`, enlazado al `GeneratedDocument` de origen.                                    | Ser fuente de contenido, crear emisiones, renderizar o almacenar una ruta distinta al PDF real. |

Relaciones conceptuales:

```text
Tenant 1 — N Empleado 1 — N GeneratedDocument 1 — 0..1 ExpedienteDoc
DocumentTemplate 1 — N GeneratedDocument
```

Un empleado puede tener múltiples documentos `CERTIFICATION`. Cada uno es una emisión independiente identificada por su propio `GeneratedDocument`. La proyección de expediente se identifica por `generatedDocumentId`.

---

## 3. Flujo funcional oficial

| Paso               | Operación                                                                                                       | Resultado y responsable                                              |
| ------------------ | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 1. Solicitud       | Un usuario autorizado solicita una certificación para un empleado del tenant.                                   | Se trata como una nueva emisión documental explícita.                |
| 2. Validación      | Se valida empleado no eliminado, pertenencia al tenant, plantilla activa no eliminada y tipo `CERTIFICATION`.   | No se emite con referencias inválidas, inactivas o intertenant.      |
| 3. Congelación     | Se resuelven los datos permitidos del empleado y del tenant una única vez; se aplica la plantilla seleccionada. | Se crea un nuevo `GeneratedDocument` con `contenidoFinal` inmutable. |
| 4. Materialización | El motor renderiza exclusivamente `contenidoFinal` y guarda el PDF bajo una clave canónica determinista.        | Existe un artefacto físico recuperable.                              |
| 5. Publicación     | Una transacción registra los metadatos del PDF, asegura el `ExpedienteDoc` `CERTIFICADO` y registra auditoría.  | El expediente apunta al mismo PDF; no hay estado DB parcial.         |
| 6. Consulta        | El expediente y la consulta documental acceden a las relaciones del mismo documento.                            | Dos vistas de una única emisión, sin sincronización ni copias.       |

Los bytes se escriben antes de la transacción de base de datos porque storage no participa en la transacción de PostgreSQL. Si la transacción falla puede quedar un huérfano físico, pero la clave determinista permite que un reintento lo reutilice y la base de datos permanezca consistente.

---

## 4. Snapshot canónico e inmutabilidad

`GeneratedDocument.contenidoFinal` es el único snapshot canónico de una certificación. No se crea ni mantiene un snapshot estructurado paralelo.

Al crear el documento se congelan, solamente dentro del contenido final, los valores que la plantilla incorpore, incluidos cuando correspondan:

- Nombre completo y documento del empleado.
- Fecha de ingreso.
- Estado laboral y fechas históricas aplicables a la redacción.
- Cargo, dependencia, sede y tipo de contrato.
- Razón social, NIT y datos del emisor incorporados por la plantilla.
- Fecha de emisión mostrada en el documento.
- Texto y estructura de la plantilla seleccionada.

Después de crear `GeneratedDocument`, nunca se recalculan para alterar esa emisión:

- Datos actuales o posteriores del empleado.
- Cargo, sede, dependencia, tipo de contrato, fecha de ingreso o fecha de retiro modificados después.
- Datos posteriores del tenant, branding o representante.
- Plantilla editada, inactivada o eliminada lógicamente después de la emisión.
- Fecha de emisión, contenido final, PDF canónico o clave física publicada.

Una corrección posterior de datos no muta un documento emitido. Una nueva certificación requiere una nueva solicitud explícita y un nuevo `GeneratedDocument`.

---

## 5. Idempotencia y concurrencia

1. La identidad de una emisión es `GeneratedDocument.id`.
2. Cada solicitud explícita crea un nuevo `GeneratedDocument`; no se deduplica globalmente por empleado, plantilla o fecha.
3. Un reintento técnico posterior a la creación recupera el mismo `GeneratedDocument`; no crea una emisión adicional.
4. La materialización es idempotente sobre una clave de storage derivada de tenant y `GeneratedDocument.id`, nunca de timestamps o valores aleatorios.
5. La identidad de la proyección de expediente es `generatedDocumentId`; sólo puede existir un `ExpedienteDoc` para el documento publicado.
6. Si existe documento pero falta PDF, el reintento materializa el mismo contenido final.
7. Si existe PDF pero falta el índice, el reintento publica únicamente lo faltante.
8. Ante una carrera concurrente, se relee la fila ganadora y se devuelve el resultado alcanzado; no se crea otro PDF lógico ni otra proyección.
9. La auditoría diferencia emisión creada, recuperación y reparación. Un reintento no registra una segunda emisión.

No existe una identidad adicional de `CertificaciónLaboral`: introducirla duplicaría la identidad de emisión sin aportar una regla de negocio independiente en este MVP.

---

## 6. Recuperación ante fallos

| Punto de fallo                             | Estado permitido                                                | Recuperación                                                                     |
| ------------------------------------------ | --------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Antes de crear `GeneratedDocument`         | No hay emisión durable.                                         | La solicitud se procesa como una nueva emisión.                                  |
| Después de crear documento, antes del PDF  | Existe contenido final sin artefacto físico.                    | Se materializa el mismo documento sin volver a consultar datos vivos.            |
| Después de escribir PDF, antes de publicar | Puede existir un objeto físico sin metadatos o expediente.      | Se reutiliza la clave determinista y se completa la publicación.                 |
| Durante la transacción de publicación      | La base de datos revierte metadatos, índice y auditoría juntos. | El reintento reconcilia desde el documento y el PDF existentes.                  |
| En concurrencia                            | Otra ejecución puede publicar la misma identidad primero.       | Se relee el documento e índice ganadores y se devuelve el resultado idempotente. |

La recuperación jamás recompone `contenidoFinal` desde el empleado, tenant o plantilla actuales.

---

## 7. Integración de responsabilidades

### Empleado

Es fuente de datos sólo antes de generar el documento. No conserva ni modifica certificaciones históricas.

### Plantilla documental

Debe ser de tipo `CERTIFICATION`, activa, no eliminada y seleccionada explícitamente. Su relación con el documento es de procedencia: cambios posteriores no afectan `contenidoFinal`.

### GeneratedDocument

Es dueño de la identidad de emisión, el contenido final inmutable y la referencia técnica al PDF. El renderer recibe sólo ese contenido y no consulta modelos vivos para completar la certificación.

### ExpedienteDoc

Es dueño de la clasificación y consulta en expediente. Su `storageKey` debe identificar exactamente el PDF del `GeneratedDocument`; no puede apuntar a una copia, ruta lógica alternativa ni objeto distinto.

### Auditoría y seguridad

El actor, el instante y el resultado se registran en auditoría sobre la emisión documental. Tenant, empleado, plantilla, documento, expediente y descarga se validan dentro del mismo tenant. La clave de storage no concede acceso por sí sola.

El renderer contractual endurecido se adopta como regla para certificaciones: no permite recursos, scripts, fuentes, imágenes ni navegaciones externas.

---

## 8. Casos fuera del MVP

- Certificaciones salariales, bancarias, migratorias o con texto normativo especial.
- Firma electrónica, firma certificada, sellado de tiempo o evidencia de firma.
- Solicitud, aprobación o entrega por parte del empleado.
- Envío por correo, enlaces públicos, QR o verificación por terceros.
- DOCX, cambio de proveedor de storage o carga manual.
- Revocación, reemplazo, anulación o versionado semántico.
- Consecutivos documentales regulados, vigencias y expiraciones.
- Flujos de aprobación, propósito obligatorio o trazabilidad de recepción.

Si alguno de estos casos requiere un ciclo de vida propio, podrá evaluarse una abstracción documental genérica en una fase futura. No se anticipa ahora una entidad exclusiva de certificaciones.

---

## 9. Plan de implementación en PRs pequeños y reversibles

1. **7.1 — Invariantes de emisión `CERTIFICATION`.** Definir reglas de plantilla, snapshot canónico, identidad de emisión e inmutabilidad sobre el flujo documental existente. Gate: no se introduce un agregado adicional.
2. **7.2 — Creación documental y contenido final.** Incorporar el caso de uso de emisión con datos resueltos una sola vez. Gate: cambios posteriores no alteran el contenido final.
3. **7.3 — Materialización PDF recuperable.** Aplicar clave canónica, renderizado aislado y retry técnico sobre el mismo documento. Gate: no se crean documentos ni PDFs lógicos duplicados.
4. **7.4 — Publicación en expediente y auditoría.** Asegurar índice `CERTIFICADO`, metadata y auditoría en una sola transacción. Gate: no existe estado parcial en base de datos.
5. **7.5 — Consulta autorizada.** Integrar consulta y descarga usando la superficie documental y de expediente existente. Gate: mismo tenant, roles y artefacto físico en ambas vistas.
6. **7.6 — Cierre de seguridad y concurrencia.** Validar aislamiento tenant, idempotencia, recuperación, inmutabilidad y renderer sin recursos externos. Gate: los reintentos convergen y la evidencia no se recalcula.

## Criterios de aceptación arquitectónicos

- Una solicitud explícita crea un nuevo `GeneratedDocument` de tipo `CERTIFICATION`.
- Un reintento técnico recupera el mismo `GeneratedDocument` y no crea una nueva emisión.
- `contenidoFinal` es el único snapshot canónico de la certificación.
- El PDF se renderiza sólo desde `contenidoFinal`.
- `ExpedienteDoc` sólo indexa el mismo PDF bajo categoría `CERTIFICADO`.
- Una publicación completa tiene un único documento, un único PDF lógico y un único índice de expediente.
- Cambios posteriores en empleado, tenant o plantilla no alteran la evidencia emitida.
- No existe agregado ni snapshot paralelo de `CertificaciónLaboral`.
