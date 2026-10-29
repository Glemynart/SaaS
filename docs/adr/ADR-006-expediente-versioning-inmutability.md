# ADR-006: Modelo de versionado e inmutabilidad del Expediente Digital

**Fecha**: 2026-08-02
**Estado**: accepted
**Decisores**: Producto y arquitectura

## Contexto

`ExpedienteDoc` ya contiene un campo `version` y una clave de almacenamiento que
incluye la versión, pero el modelo actual no define qué documentos pertenecen a
la misma familia documental ni cuándo una nueva carga es una revisión o un
documento distinto. Las cargas manuales se crean actualmente como documentos
independientes y los documentos generados conservan su propio snapshot y su
identidad de emisión.

La ambigüedad afecta al Expediente Digital y también a Contratación Inteligente,
Nómina Electrónica, Facturación Electrónica y futuras capacidades que necesiten
conservar evidencia histórica. La semántica debe definirse antes de implementar
E5.2, E5.3 o E5.4.

La decisión se contrasta con estas reglas ya existentes:

- La identidad del documento contractual generado es `(tenantId, contratoId)`;
- `GeneratedDocument.contenidoFinal` es un snapshot inmutable de una emisión;
- una solicitud explícita de certificación crea una nueva emisión, mientras que
  un retry técnico recupera la misma;
- `Liquidation` y `PayrollSnapshot` congelan resultados aprobados y no deben
  sobrescribirse;
- `ExpedienteDoc` no es la fuente del contenido generado: indexa y clasifica la
  evidencia publicada.

## Decisión

Adoptamos un modelo append-only de familias documentales y revisiones
inmutables. Una revisión conserva la identidad del mismo acto documental; un
nuevo acto, emisión, período, propósito o identificador crea un documento
diferente.

Solo puede existir **una revisión vigente por familia documental**. Las
revisiones anteriores se conservan como evidencia histórica, pero dejan de ser
vigentes cuando se publica una revisión posterior.

Una revisión **nunca puede cambiar de familia documental**. Si una carga fue
clasificada incorrectamente, se corrige la clasificación mediante una operación
auditada que no fusiona familias ni reescribe el historial; la revisión se
mantiene vinculada a su familia original y el documento correcto se crea en la
familia destino cuando corresponda.

La numeración `ADR-006` evita colisionar con `ADR-005`, que está siendo propuesto
por la PR abierta #75 para arquitectura de facturación electrónica.

### Definiciones normativas

Una **familia documental** representa un mismo propósito y acto documental para
un empleado dentro de un tenant.

Una **nueva revisión** debe cumplir simultáneamente estas condiciones:

1. conserva la misma identidad documental y el mismo acto;
2. sustituye o corrige su representación sin crear un nuevo acto jurídico,
   emisión, obligación o período;
3. conserva las revisiones anteriores;
4. publica nuevos bytes bajo una clave de almacenamiento inmutable;
5. registra actor, motivo y relación con la revisión anterior;
6. pasa a ser la única revisión vigente de su familia.

No constituye una nueva revisión:

- reintentar técnicamente la misma operación;
- regenerar el mismo PDF desde el mismo snapshot;
- reparar una publicación incompleta;
- editar un borrador que todavía no se ha publicado;
- mover una revisión a otra familia documental.

Un **documento diferente** existe cuando cambia el acto, propósito, período,
identificador externo, emisión, obligación jurídica o snapshot de negocio. Un
documento diferente puede mantener una relación `derivaDe`, `reemplaza` o
`corrige` con el anterior, pero no lo sobrescribe.

### Semántica por dominio

| Tipo documental                        | Identidad lógica                                                                                                                                                                                  | Nueva versión                                                                                                                                  | Documento diferente                                                                                                                                                                                                                                                                   |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Contrato**                           | `tenantId + Contrato.id`; representa un acto contractual concreto.                                                                                                                                | Corrección o reemplazo de la representación del mismo contrato, sin crear un nuevo acto jurídico. Un retry técnico conserva la misma revisión. | Renovación, nuevo contrato, cambio formal de condiciones o modificación mediante otrosí. Un contrato publicado o firmado no se sobrescribe.                                                                                                                                           |
| **Otrosí**                             | Un acto de modificación concreto vinculado a un contrato padre, con su propio identificador, fecha y contenido.                                                                                   | Corrección de la representación del mismo otrosí antes de su publicación definitiva, sin alterar su significado jurídico.                      | Otro acto modificatorio, otro número o fecha, nuevas condiciones o una modificación posterior del contrato. Nunca es una versión del contrato padre.                                                                                                                                  |
| **Certificación laboral**              | Una solicitud/emisión explícita, identificada por `GeneratedDocument.id`.                                                                                                                         | En el MVP no hay revisiones semánticas: los retries y reparaciones técnicas reutilizan la misma emisión.                                       | Cada nueva solicitud, fecha de emisión o snapshot laboral genera una certificación diferente, incluso para el mismo empleado.                                                                                                                                                         |
| **Cédula**                             | El ejemplar de identidad definido por tipo, número y acto de expedición.                                                                                                                          | Nueva digitalización, escaneo o copia legible de la misma cédula, con el mismo número y expedición.                                            | Renovación, duplicado, cambio de número o un ejemplar expedido nuevamente. Se relaciona con el anterior, pero no es su versión.                                                                                                                                                       |
| **Documento manual**                   | Tipo o propósito explícito, empleado, emisor, identificador externo y/o período.                                                                                                                  | Nuevo archivo del mismo documento externo, por ejemplo reemplazar un PDF ilegible de una certificación bancaria del mismo período.             | Distinto propósito, emisor, identificador, período o acto. La categoría `OTRO` o el nombre del archivo no bastan para inferir identidad. Si el sistema no puede identificar inequívocamente la familia, crea una familia nueva y nunca fusiona automáticamente documentos existentes. |
| **Liquidación**                        | La liquidación aprobada como acto para empleado, período/tipo y contrato aplicable. En nómina puede corresponder a `PayrollRun + período + empleado`; en liquidación laboral, a `Liquidation.id`. | Nueva representación del mismo resultado aprobado, sin alterar el snapshot. El cálculo en estado `DRAFT` no crea revisiones.                   | Otra liquidación, período, empleado, tipo, corrección, ajuste, anulación o reverso. Una corrección es un acto relacionado, no una sobrescritura.                                                                                                                                      |
| **Documento generado automáticamente** | El evento de negocio y la emisión concreta (`GeneratedDocument.id`), no la plantilla, categoría o empleado aislados.                                                                              | Solo una sustitución autorizada de la representación del mismo acto. La regeneración técnica idempotente conserva la misma revisión.           | Nueva emisión, nuevo snapshot, nuevo evento de negocio o nueva solicitud explícita.                                                                                                                                                                                                   |

### Reglas transversales

1. `version` pertenece a una familia documental, nunca a toda la categoría del
   empleado.
2. Solo existe una revisión vigente por familia; las anteriores permanecen
   disponibles como historial inmutable.
3. Una revisión no puede cambiar de familia documental.
4. El sistema no deduce familias únicamente por nombre, categoría, tamaño o
   similitud del archivo.
5. Si una carga manual no puede asociarse inequívocamente a una familia, se crea
   una nueva familia; nunca se fusiona automáticamente con documentos
   existentes.
6. Las revisiones publicadas son append-only y sus bytes no se sobrescriben.
7. Un cambio en datos laborales actuales no modifica documentos históricos.
8. Los cambios jurídicos o económicos se expresan como nuevos actos
   documentales relacionados.
9. `ExpedienteDoc` indexa y clasifica; la fuente histórica sigue siendo el
   agregado o `GeneratedDocument` correspondiente.
10. Todo cambio de revisión, publicación, retiro, descarga o reparación queda
    auditado.
11. La reparación técnica debe converger a la misma revisión lógica aunque el
    proveedor de almacenamiento requiera un nuevo objeto físico auxiliar; nunca
    se sobrescribe el objeto original.

### Implicaciones para otros contextos

- **Contratación Inteligente**: el snapshot confirmado define el acto
  contractual. Reintentar no crea documento nuevo; un nuevo contrato u otrosí
  sí.
- **Nómina Electrónica**: retransmitir el mismo período y evento es un retry;
  una corrección o ajuste es un nuevo documento relacionado.
- **Facturación Electrónica**: reenviar la misma factura conserva su identidad;
  una nota crédito, nota débito o factura corregida es un documento diferente,
  no una versión de la factura original.
- **Expediente Digital**: la implementación deberá almacenar la familia
  documental, la revisión vigente y la relación entre revisiones; la categoría
  por sí sola no es suficiente.

## Alternativas consideradas

### Mantener únicamente `ExpedienteDoc.version`

- **Pros**: no requiere una relación adicional.
- **Contras**: no define la familia documental ni evita asociar documentos
  diferentes del mismo empleado y categoría.
- **Por qué no**: el número de versión sin identidad de familia no tiene
  semántica verificable.

### Inferir la familia por categoría y nombre del archivo

- **Pros**: no añade campos ni interacción adicional.
- **Contras**: mezcla documentos distintos y depende de datos no confiables.
- **Por qué no**: produciría historiales incorrectos y no es auditable.

### Crear siempre un documento nuevo

- **Pros**: evita sobrescrituras.
- **Contras**: pierde la relación entre revisiones y genera duplicados ante
  retries o reemplazos del mismo documento.
- **Por qué no**: no permite distinguir una emisión nueva de una reparación
  técnica ni consultar la historia de una familia.

## Consecuencias

### Positivas

- La historia documental es consultable y auditable.
- Se conserva la evidencia de contratos, certificaciones y resultados de
  nómina.
- Los retries son idempotentes y no crean duplicados.
- Las futuras integraciones pueden distinguir correcciones de nuevas
  emisiones.

### Negativas

- E5.2 requerirá identidad de familia, relación de revisiones y metadatos de
  clasificación explícitos.
- Las cargas manuales necesitarán una regla de asociación o deberán crear una
  familia nueva por defecto.
- Será necesaria una migración de los documentos existentes como revisión
  inicial.
- Retirar un documento no equivale a destruir su evidencia histórica.

### Riesgos y mitigaciones

| Riesgo                                               | Mitigación                                                                               |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Asociar una carga manual a la familia equivocada     | No inferir por nombre/categoría; exigir selección explícita o crear familia nueva.       |
| Confundir retry con nueva emisión                    | Usar la identidad del evento y claves idempotentes antes de crear revisión.              |
| Alterar documentos históricos al cambiar datos vivos | Renderizar únicamente desde snapshots inmutables.                                        |
| Crear una revisión para un cambio jurídico           | Modelar el cambio como contrato, otrosí, corrección o ajuste diferente.                  |
| Crear dos revisiones vigentes por carrera            | Aplicar una restricción transaccional de unicidad sobre la revisión vigente por familia. |
| Romper integraciones futuras por falta de identidad  | Mantener relaciones explícitas entre documento, revisión y acto de origen.               |

## Límites de esta decisión

Este ADR no implementa firma electrónica, consecutivos regulatorios, revocación,
retención legal, envío por correo ni un catálogo completo de tipos documentales.
Esos temas pueden requerir decisiones adicionales. Sí establece la semántica
obligatoria que deberán respetar.

## Estado de aprobación

La semántica fue aprobada para gobernar E5.2, E5.3 y E5.4. La implementación de
esas Epics no comienza hasta que este ADR esté fusionado en `main`.
