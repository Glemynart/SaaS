# ADR-009 — Conjuntos coordinados de backup PostgreSQL y uploads

| Campo           | Valor                                                                                                                |
| --------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Estado**      | Aceptado para implementación aislada; uso operativo externo pendiente                                                |
| **Fecha**       | 2026-10-29                                                                                                           |
| **Decisores**   | Producto · Arquitectura · DBA · Operación de infraestructura                                                         |
| **Ámbito**      | GOAL-01 · E7.1 · backup y restauración en entornos aislados                                                          |
| **Relacionado** | [GOAL-01](../goals/GOAL-01-primer-cliente-operando.md), [runbook de backups](../../deploy/postgres-backup/README.md) |
| **Reemplaza**   | —                                                                                                                    |

## Contexto

La rama de E7.1 contiene un backup PostgreSQL diario con destino y base de datos
fijos, un restaurador PostgreSQL aislado y scripts independientes para crear y
restaurar un artefacto de uploads local. Los dos artefactos no comparten un
identificador impuesto, no publican un marcador durable de conjunto y no prueban
que sus datos pertenezcan al mismo punto de consistencia. El VPS observado
comparte `oficina_nitida`; ninguno de estos scripts debe ejecutarse allí como
prueba de staging.

Una suma de verificación de cada carga OCI valida la transferencia según la CLI,
pero no demuestra que el objeto sea legible después. Un manifiesto tampoco puede
probar por sí solo que se detuvieron todos los escritores ni que DB y filesystem
representen el mismo instante. La aceptación de E7.1 requiere restaurar ambos
artefactos aislados y cotejar referencias documentales con conteos agregados.

## Decisión

Adoptar un conjunto de dos objetos cifrados e inmutables y un manifiesto final
cifrado que actúe como marcador de finalización. Se autoriza implementar y
probar el coordinador únicamente con datos sintéticos y destinos simulados. Esta
decisión no autoriza ejecutar backups reales ni cambiar la tarea diaria
instalada.

1. Un runner separado, habilitado únicamente para staging cuya base y storage
   estén verificados como aislados, genera un `BACKUP_SET_ID` UTC único sin
   nombres de tenants ni personas. Exige la etiqueta de contenedor
   `dusema.backup.environment=staging` y rechaza el destino compartido conocido
   `postgres/oficina_nitida`. No modifica los destinos fijos del servicio diario
   de PostgreSQL.
2. El artefacto PostgreSQL y el de uploads usan el mismo ID y el prefijo común
   `backup-sets/<BACKUP_SET_ID>/`. El coordinador recibe el bucket y la región
   por configuración explícita; el propietario de OCI debe aprobarlos, junto
   con la retención, antes de cualquier uso real.
3. El operador mantiene una barrera de escritura durante ambas capturas y
   registra la hora UTC de inicio/fin, commit de aplicación, proveedor de storage
   y la atestación de quiescencia. No se declara que la aplicación imponga esta
   barrera automáticamente.
4. El runner sube ambos artefactos con nombres nuevos, `--no-overwrite` y
   verificación de checksum. Si falla cualquiera de las dos cargas, no publica
   el marcador. El resultado de `put` no sustituye la prueba de lectura posterior.
5. Solo después de ambas cargas, publica con `--no-overwrite` un manifiesto
   `manifest.json.gpg` cifrado para la clave pública de recuperación. La versión
   inicial contiene únicamente el ID, intervalo UTC, referencia no sensible al
   entorno, commit de aplicación, proveedor y referencia del object store y,
   para cada artefacto, clave OCI, tamaño y SHA-256 del ciphertext. No contiene
   nombres de archivos internos, tenant IDs, credenciales ni filas de base de
   datos.
6. Una recuperación solo acepta un manifiesto descifrable cuyos dos objetos
   compartan el ID esperado y cuyos tamaños y hashes coincidan. Restaura la base
   en PostgreSQL temporal sin red y uploads en un directorio nuevo privado; no
   conecta ninguno a la aplicación. Ejecuta el cotejo agregado de referencias
   descrito en el runbook.
7. La retención cubre el manifiesto y los dos objetos como una unidad. No se
   elimina un artefacto individual para resolver una retención parcial.

La publicación del manifiesto solo significa que ambas cargas informaron éxito
y que el runner publicó el marcador. La disponibilidad de lectura, el punto de
consistencia real y la restauración correcta siguen requiriendo evidencia
operativa independiente.

## Alternativas consideradas

### Mantener dos backups independientes y relacionarlos en un registro manual

- **Ventaja:** no requiere modificar el flujo actual ni definir un formato.
- **Desventaja:** una restauración podría combinar objetos de ejecuciones
  distintas o considerar completo un conjunto al que le falta un componente.
- **Por qué no:** no permite rechazar de forma mecánica un conjunto incompleto.

### Empaquetar DB y uploads en un solo archivo

- **Ventaja:** reduce el emparejamiento a un objeto.
- **Desventaja:** duplica el dump cifrado existente, dificulta restaurar un solo
  componente y mezcla formatos y tamaños con ciclos de retención distintos.
- **Por qué no:** aumenta el acoplamiento sin resolver la quiescencia de
  escrituras.

### Modificar el servicio diario PostgreSQL para producir el marcador

- **Ventaja:** reutiliza el proceso de backup ya instalado.
- **Desventaja:** el script tiene destinos productivos fijos y opera sobre
  `oficina_nitida`; un cambio de staging podría alterar la copia diaria.
- **Por qué no:** el flujo aislado de E7.1 debe permanecer separado del servicio
  productivo existente.

## Consecuencias

### Positivas

- Un conjunto sin cualquiera de sus tres objetos no se presenta como completo.
- La restauración comprueba que los artefactos pertenecen al mismo ID y coteja
  sus referencias en un entorno desconectado.
- El servicio diario PostgreSQL permanece intacto mientras se prepara staging.

### Riesgos y limitaciones

- La quiescencia sigue siendo una atestación hasta que exista una barrera
  verificable de aplicación.
- Una respuesta OCI fallida durante el `put` final puede ser ambigua: el servicio
  podría haber creado el objeto aunque el cliente no confirme la respuesta. El
  runner devuelve error y no declara el conjunto completo; se debe verificar el
  manifiesto con una identidad `OBJECT_READ` ya autorizada antes de reintentar.
- El marcador no prueba lectura ni compatibilidad de retención; se necesita una
  identidad `OBJECT_READ` ya autorizada y una restauración revisable.
- La clave pública cifra, pero no autentica el autor del manifiesto. El control
  de escritura OCI y la verificación de los hashes registrados deben revisarse
  como parte de la operación.
- La retención, el prefijo y la autorización de lectura continúan pendientes del
  propietario y DBA; no se ejecutan cambios de IAM, lifecycle ni producción.

## Migración y reversión

Tras aprobar esta ADR, se implementaría el runner como una capacidad separada y
se verificaría con datos sintéticos y mocks antes de usar staging aislado. Una
reversión consiste en dejar de publicar conjuntos y conservar los artefactos
inmutables ya creados conforme a la política aprobada. No modifica ni requiere
revertir el servicio diario PostgreSQL.

## Requisitos operativos pendientes

Antes de usar el coordinador en staging, el propietario operativo debe aprobar
el bucket y la región, la identidad autorizada de lectura y la retención; además
debe demostrar la base y el storage aislados y aportar una barrera de escritura
operativa. La implementación no configura IAM, lifecycle ni servicios reales.
Mientras falte esa evidencia, E7.1 no se declara completo aunque el recorrido
sintético funcione.
