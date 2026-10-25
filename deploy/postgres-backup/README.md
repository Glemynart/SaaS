# Respaldos PostgreSQL de Dusema

Esta carpeta contiene los artefactos locales para un backup lógico cifrado de PostgreSQL 17. Una inspección SSH de solo lectura del 23 de octubre de 2026 encontró `dusema-postgres-backup.timer` habilitado y activo; el servicio tuvo última ejecución ese día a las 07:00:11 UTC, terminó con `Result=success` y código 0, y la siguiente estaba prevista para el 24 de octubre a las 07:00 UTC. El journal de esa ejecución informó la carga del objeto y la verificación de checksum. La unidad y el script instalados en el VPS no se compararon byte a byte con estos archivos locales; este directorio no prueba qué revisión exacta está instalada.

Una inspección SSH de solo lectura del 24 de octubre confirmó una ejecución programada a las 07:00:04 UTC; `dusema-postgres-backup.service` terminó a las 07:00:05 UTC con `Result=success` y estado 0. El journal informó la carga de `postgres/dusema-oficina_nitida-20261024T020004-0500-yGA63y.dump.gpg`, SHA-256 `844e36ff4d8a1979a4fbd507214d069e82a610fa36bd449b41f9668c7627f067`, aceptación de OCI y verificación de checksum por el script. No se comprobó la accesibilidad actual del objeto ni se revisó evidencia independiente de restauración.

Una comparación SSH de solo lectura posterior, también del 24 de octubre, confirmó que el ejecutable y ambas unidades instaladas coinciden byte a byte con estos archivos locales: se compararon sus SHA-256 y los tres pares fueron iguales. Systemd muestra los archivos bajo `/etc/systemd/system/`, sin drop-ins; el timer está habilitado y activo, tuvo su última activación a las 07:00:04 UTC del 24 y la siguiente está prevista para las 07:00 UTC del 25. El servicio informa `Result=success`, código 0 y ejecución de 07:00:04 a 07:00:05 UTC. Esto acredita la identidad de los artefactos y el estado observado del timer/servicio, pero no el acceso actual al objeto ni una restauración independiente.

Una inspección SSH de solo lectura del 25 de octubre de 2026 confirmó el timer habilitado y activo: `LastTriggerUSec=2026-10-25 07:00:11 UTC` y `NextElapseUSecRealtime=2026-10-26 07:00:00 UTC`. El servicio inició a las 07:00:11 y terminó a las 07:00:13 UTC con `Result=success`, `ExecMainStatus=0`. El journal registró la carga de `postgres/dusema-oficina_nitida-20261025T020011-0500-OpRYGz.dump.gpg`, SHA-256 `d14e3e392a0050b986e2c8e560fe1a64cb5f4703f1984d4ca1a65f7631dc450a`, y el evento `complete`. En esta misma inspección, el SHA-256 del ejecutable `/usr/local/sbin/dusema-postgres-backup` y de las unidades activas bajo `/etc/systemd/system/` coincidió con los tres artefactos versionados en este directorio; ambos servicios no tienen drop-ins. Dado que el script instalado coincidente registra `complete` solo después de que OCI acepta el objeto, `--verify-checksum` termina correctamente y se eliminan los temporales, esto confirma la ejecución programada y la verificación de checksum durante la carga. No confirma que el objeto siga accesible ahora ni una restauración independiente; tampoco cubre uploads.

El operador reportó que el 23 de octubre descargó el objeto cifrado de esa ejecución, verificó su SHA-256, lo descifró y lo restauró manualmente en PostgreSQL 17 local: la restauración terminó con código 0, produjo 52 tablas y ocupó aproximadamente 12 MB. Este es un resultado reportado por el operador y no fue repetido ni inspeccionado independientemente durante la actualización de este documento. La restauración de PostgreSQL no verifica la recuperación de uploads.

Revalidación SSH de solo lectura del 2026-10-25, aproximadamente 22:03 UTC: el directorio `/home/ubuntu/la-oficina-nitida/staging/uploads` tiene propietario `opc:opc`, modo `0750` y está en `/dev/sda1`. Un conteo agregado con `sudo -n find` no encontró entradas; `du -sb` informó 0 bytes. En ese momento, el filesystem tenía 33,641,213,952 bytes libres. La consulta no mostró nombres ni leyó contenidos. Es una medición puntual: no demuestra que snapshots u otro backup cubran la ruta ni que una restauración de uploads sea posible. E7.1 sigue pendiente de evidencia de cobertura y recuperación.

## Configuración y evidencia disponible

Los valores históricos siguientes proceden de las inspecciones de solo lectura del 22 al 25 de octubre de 2026. El 24 y el 25 de octubre se compararon por SHA-256 el script y las dos unidades instaladas con estos archivos locales; los hashes coincidieron. Revalidar las rutas y la configuración efectiva antes de cambiar o reinstalar el proceso.

| Elemento                                     | Valor / estado                                                                                                                |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Contenedor PostgreSQL                        | `postgres` (nombre observado)                                                                                                 |
| Base                                         | `oficina_nitida` (nombre observado)                                                                                           |
| Rol solicitado por el dump                   | `oficina`; rol y permisos efectivos no se verificaron                                                                         |
| PostgreSQL / `pg_dump`                       | PostgreSQL 17.10 observado; el script exige que `pg_dump` en el contenedor sea de major 17                                    |
| Formato                                      | Custom, sin owner ni ACL (`--no-owner --no-privileges`)                                                                       |
| Namespace / bucket / región                  | `axfelzrsklz7` / `dusema-backups-prod` / `sa-bogota-1`                                                                        |
| Prefijo                                      | `postgres/`                                                                                                                   |
| Autenticación OCI prevista                   | Instance principal; acceso efectivo de lectura/escritura no se verificó con este artefacto                                    |
| Clave GPG pública prevista                   | `/home/ubuntu/.gnupg`; ID largo de la subclave de cifrado fijado en el script                                                 |
| Clave privada de recuperación                | Debe permanecer fuera del VPS; no la requiere el proceso de backup                                                            |
| Frecuencia observada                         | El timer estaba habilitado/activo; última activación 2026-10-25 07:00:11 UTC; siguiente 2026-10-26 07:00:00 UTC               |
| Último servicio observado                    | `Result=success`, `ExecMainStatus=0`; ejecución 2026-10-25 07:00:11–07:00:13 UTC                                              |
| SHA-256 del script instalado/local           | `bf8b20301c0fe451f3d731473e61fc289cf9f00f9eafa76c1c400356a22ebadb` (coincide)                                                 |
| SHA-256 de la unidad service instalada/local | `117a6a09951ef1ac0053e5c1511b7c836108453fb285b3240c81dac409eb17f7` (coincide)                                                 |
| SHA-256 de la unidad timer instalada/local   | `e740350347328206a641be0f2a4c9d48aaa07fa055edcdde040d0c94ce1663b0` (coincide)                                                 |
| Objeto informado                             | `postgres/dusema-oficina_nitida-20261025T020011-0500-OpRYGz.dump.gpg`                                                         |
| SHA-256 informado                            | `d14e3e392a0050b986e2c8e560fe1a64cb5f4703f1984d4ca1a65f7631dc450a`                                                            |
| Restauración manual                          | Reportada por el operador el 2026-10-23: PostgreSQL 17 local, código 0, 52 tablas, aprox. 12 MB; no repetida en esta revisión |
| Uploads                                      | No incluidos en el dump; su recuperación sigue sin verificarse                                                                |
| Directorio de estado                         | `/var/lib/dusema-postgres-backup`, observado `0700`, propietario/grupo `ubuntu:ubuntu`                                        |
| Directorio temporal                          | `/var/lib/dusema-postgres-backup/tmp`, observado `0700`, propietario/grupo `ubuntu:ubuntu`                                    |

La inspección anterior encontró `/usr/bin/docker`, `/usr/bin/gpg` y `/home/ubuntu/bin/oci`. El archivo de unidad local coloca primero las rutas de sistema en `PATH` y `/home/ubuntu/bin` al final para que los ejecutables de usuario no suplanten herramientas del sistema. Antes de cambiar o reinstalar el proceso, el operador debe comprobar las rutas efectivas de `docker`, `gpg`, `oci`, `date`, `mktemp`, `sha256sum`, `flock`, `mkdir`, `chmod` y `rm`, además de la propiedad y permisos de los directorios. No todas esas rutas se han confirmado.

## Autenticación PostgreSQL, alcance y registro

El script local ejecuta `pg_dump` dentro del contenedor con el usuario de sistema `postgres`, el rol de base `oficina`, la base `oficina_nitida` y `--no-password`. Revalidación de solo lectura por SSH del 2026-10-25, aprox. 22:30 UTC: la unidad systemd corre como `ubuntu` con grupo suplementario `docker`; `pg_roles` confirma que `oficina` puede iniciar sesión y es `SUPERUSER`, `CREATEDB`, `CREATEROLE`, `REPLICATION` y `BYPASSRLS`. Dentro del contenedor no están definidas `PGHOST`, `PGHOSTADDR`, `PGSERVICE`, `PGSERVICEFILE`, `PGPASSWORD` ni `PGPASSFILE`; el comando no pasa un host y usa el socket local por defecto. `pg_hba_file_rules` muestra `trust` para conexiones locales. La ejecución programada, por tanto, usa autenticación local sin contraseña como rol PostgreSQL superusuario `oficina`. Esto describe la autorización efectiva del dump, no una credencial copiada o expuesta. La identidad `ubuntu` también puede acceder al daemon Docker y ejecutar comandos dentro del contenedor. No se cambian aquí la autenticación, los roles ni los permisos.

Riesgo y siguiente revisión DBA: el servicio de backup tiene capacidad de lectura equivalente a superusuario para `oficina_nitida`, aunque solo ejecute `pg_dump`. Evaluar un rol de backup dedicado con permisos mínimos para las tablas, secuencias y objetos que deban respaldarse; comprobar que el dump preserve la cobertura actual, incluidas secuencias y objetos grandes si existen, y que futuros objetos sigan siendo legibles. No crear el rol ni cambiar la HBA o ACL sin la revisión y autorización DBA. La regla `trust` local y el acceso Docker también significan que el aislamiento no protege frente a un operador con privilegios Docker en el VPS.

El script:

1. Toma un lock con `flock`; una segunda ejecución termina con código `75`.
2. Comprueba que el contenedor ofrece `pg_dump` PostgreSQL 17.
3. Envía el dump custom por una tubería directamente a GPG; el dump sin cifrar no se escribe a disco.
4. Guarda solo el archivo cifrado dentro de un directorio temporal privado, calcula su SHA-256 y envía ese archivo a un nombre único bajo `postgres/`.
5. Usa `--verify-checksum` y `--no-overwrite` en OCI. `--verify-checksum` compara el checksum del objeto subido con el archivo local durante el upload; no descarga el objeto ni demuestra una lectura/restauración posterior. `--no-overwrite` evita sobrescribir un objeto con el mismo nombre.
6. Elimina exclusivamente el directorio `run-*` creado por esa ejecución. Si la limpieza falla después de otro error, conserva el código original; si solo falla la limpieza, devuelve `70`. El evento `complete` se registra únicamente después de una limpieza correcta.
7. Registra fases, categorías/códigos de error, nombre de objeto y SHA-256 del artefacto cifrado. No imprime stderr de las herramientas auxiliares; el stderr de Docker, GPG y OCI se mantiene en el temporal privado durante la ejecución.

Si falla la limpieza, el directorio de esa ejecución puede quedar bajo `/var/lib/dusema-postgres-backup/tmp` con un artefacto cifrado parcial y archivos stderr. Conserva modo privado previsto `0700`; el servicio devuelve error y no informa `complete`. Un operador debe comprobar primero que el servicio ya no está activo, investigar la causa sin copiar stderr a un canal compartido y retirar únicamente ese `run-*` después de autorizar la limpieza. La limpieza automática no toca otros temporales ni respaldos.

Códigos de salida definidos: `20` cliente/versión `pg_dump`, `21` dump, `31` cifrado, `40` SHA-256, `51` upload OCI, `64` ejecutable/configuración ausente, `70` preparación o limpieza y `75` lock ocupado. Los mensajes externos se reducen a una categoría y, cuando corresponde, un código numérico del proceso; el mensaje arbitrario de la herramienta no llega al journal.

El script invoca OCI CLI una vez y no implementa un ciclo de reintento propio. No se debe describir eso como “sin reintentos”: la documentación oficial de OCI CLI 3.95.1 indica hasta siete intentos para la mayoría de comandos y desactiva retries para operaciones con cuerpos binarios. `object put --file` puede usar upload simple o multipart según el tamaño, de modo que la conducta efectiva depende de la versión instalada y de las llamadas de cada ejecución. Se debe revalidar `oci --version` en el VPS. Un fallo de respuesta no demuestra que no se haya creado el objeto. Cada corrida genera un nombre distinto y `--no-overwrite` protege una repetición accidental con el mismo nombre.

El journal de éxito registra un hash, pero su retención y exportación fuera del VPS no están confirmadas. Para el objeto listado arriba, el operador reportó una descarga y comparación SHA-256 satisfactorias; no se repitió ni se revisaron los archivos de evidencia aquí. La identidad instance principal de backup no tenía permisos de lectura según la inspección de política anterior; el acceso de lectura usado por el operador no se identificó ni se verificó en esta revisión.

Este dump cubre una base; no incluye roles globales, tablespaces, Redis ni uploads. PostgreSQL genera una exportación consistente de la base. Los archivos subidos no se coordinan ni se incluyen en este artefacto; deben protegerse por separado. `--no-owner --no-privileges` implica que la restauración debe preparar los roles y permisos destino por separado.

## Espacio, timeout y programación

La inspección del 23 de octubre observó aproximadamente 33 GiB libres en el VPS. No se midieron el tamaño lógico del dump ni la duración de la ejecución programada; los aproximadamente 12 MB reportados corresponden al tamaño de la base restaurada localmente, no al tamaño del dump. El archivo cifrado queda temporalmente en el filesystem local hasta que OCI termine el upload. Un filesystem lleno puede afectar otros servicios.

Systemd reporta `TimeoutStartUSec=6h`, que coincide con la unidad instalada verificada por SHA-256. Seis horas sigue siendo un límite provisional, no una duración garantizada ni respaldada por mediciones. Si se modifica el proceso, medir dump y upload en una corrida aprobada y validar la respuesta de systemd al timeout. Los handlers INT/TERM/HUP del script local están presentes, pero la limpieza bajo señales y el ciclo de terminación de la unidad instalada no se han validado en Ubuntu.

La comparación de SHA-256 del 24 de octubre confirmó que el timer instalado corresponde al archivo local. Systemd reportó `Persistent=no`, `AccuracyUSec=1min`, `RandomizedDelayUSec=0`, el timer habilitado/activo y la próxima activación a las 07:00 UTC del 25 de octubre. La inspección de solo lectura encontró `DropInPaths` vacío para timer y servicio. La hora de activación observada también coincide con la línea de tiempo de la tabla.

El servicio deja resultados en journald. No se confirmó ningún canal de alerta externo; por ello no se afirma que haya notificación ante fallos. Definir y probar una alerta requiere una decisión operativa posterior.

## Descarga y restauración aislada

La identidad instance principal prevista para crear objetos no puede leerlos según la política observada. La descarga y la restauración deben hacerlas operadores autorizados en una estación o entorno de recuperación aislado con una identidad OCI de solo lectura ya configurada. No se debe añadir esa identidad de lectura ni la clave privada GPG al VPS.

El flujo de referencia, con nombres concretos de objeto y rutas proporcionados por el operador autorizado, es:

```bash
# En la estación de recuperación, con perfil/identidad OCI de solo lectura autorizado.
oci os object head \
  --namespace-name axfelzrsklz7 \
  --bucket-name dusema-backups-prod \
  --name "$OBJECT_NAME" \
  --region sa-bogota-1

oci os object get \
  --namespace-name axfelzrsklz7 \
  --bucket-name dusema-backups-prod \
  --name "$OBJECT_NAME" \
  --file "$CIPHERTEXT_FILE" \
  --region sa-bogota-1

sha256sum -- "$CIPHERTEXT_FILE"
# Comparar con el hash del evento journal conservado por el operador.

gpg --batch --no-tty --homedir "$RECOVERY_GNUPGHOME" \
  --output "$DUMP_FILE" --decrypt "$CIPHERTEXT_FILE"
pg_restore --list "$DUMP_FILE" >/dev/null
```

El comando `head` permite revisar metadata y ETag; estos archivos no publican un metadata SHA adicional. Si no se conserva el SHA del journal, no se puede hacer esa comparación independiente y debe registrarse como brecha. El paso GPG requiere acceso autorizado al material de descifrado, mantenido fuera del VPS; nunca se debe pegar ni registrar la clave privada. `pg_restore --list` comprueba que el archivo se puede leer como archive, pero no prueba que la base pueda arrancar correctamente.

La restauración reportada el 23 de octubre se hizo en una instancia PostgreSQL local y terminó con código 0; el operador informó 52 tablas y aproximadamente 12 MB. No se verificaron en esta actualización el aislamiento de esa instancia, la salida detallada de `pg_restore` ni artefactos de la prueba. Para validar futuras copias, conservar evidencia sanitizada del destino aislado y del resultado, sin conexión de aplicación ni envío de correos reales. La recuperación de uploads requiere un procedimiento y una prueba separados.

La limpieza del script se limita al directorio temporal de la ejecución local. No borra objetos remotos. La retención OCI/lifecycle es una operación separada que requiere visibilidad de la política completa del bucket, revisión de versionado/retention rules y aprobación del propietario. Una regla remota no sustituye la limpieza local, y la limpieza local no elimina versiones remotas.

## Retención remota propuesta, no aplicada

La política IAM observada para la instancia permite crear objetos bajo `postgres/*`, pero no listarlos, leerlos ni eliminarlos. La retención remota debe resolverse mediante una regla de lifecycle de Object Storage administrada por el propietario autorizado del bucket. Antes de proponer/aplicar esa regla, el propietario debe revisar la política completa actual, el versionado y cualquier retención/legal hold. Reemplazar la lifecycle policy puede sustituir su conjunto de reglas, por lo que se deben conservar y volver a incluir las reglas existentes. En buckets con versionado, borrar la versión vigente crea un delete marker; una purga efectiva puede requerir una regla adicional para versiones anteriores. La regla candidata debe limitarse al prefijo `postgres/`, usar 30 días y revisarse contra todas las reglas actuales. No se incluye comando de aplicación ni se ejecuta cambio alguno.

Referencias oficiales: [Lifecycle Management de OCI](https://docs.oracle.com/en-us/iaas/Content/Object/Tasks/usinglifecyclepolicies.htm), [versionado de Object Storage](https://docs.oracle.com/en-us/iaas/Content/Object/Tasks/usingversioning.htm), [edición de lifecycle policies](https://docs.oracle.com/en-us/iaas/Content/Object/Tasks/usinglifecyclepolicies_topic-To_edit_a_lifecycle_policy_rule.htm), [OCI CLI `object put`](https://docs.oracle.com/en-us/iaas/tools/oci-cli/latest/oci_cli_docs/cmdref/os/object/put.html), [OCI CLI global retry options](https://docs.oracle.com/en-us/iaas/tools/oci-cli/latest/oci_cli_docs/oci.html), [OCI CLI `object head`](https://docs.oracle.com/en-us/iaas/tools/oci-cli/latest/oci_cli_docs/cmdref/os/object/head.html).

## Archivos de la aplicación fuera de alcance

La inspección del 23 de octubre de 2026 confirmó el bind mount `/home/ubuntu/la-oficina-nitida/staging/uploads` → `/app/uploads`, modo `0750` y propietario/grupo numéricos `1000:1000`. `du -sh` reportó 4 KiB, pero el usuario SSH recibió `Permission denied` al recorrer la carpeta; por tanto, en esa inspección no se confirmó si contenía archivos ni su tamaño. Una inspección anterior del 22 de octubre había reportado cero entradas en ese momento, lo cual no demuestra el estado posterior.

Una inspección SSH de solo lectura con privilegios de lectura el 25 de octubre de 2026 confirmó que la ruta está en el filesystem raíz (`/`, `/dev/sda1`, ext4), con modo `0750` y propietario/grupo numéricos `1000:1000`. La búsqueda contó cero archivos regulares y 0 bytes en ese momento. Es una medición puntual: no garantiza que el directorio siga vacío ni constituye un respaldo. El backup lógico de PostgreSQL no incluye esta ruta; la recuperación de uploads continúa sin verificarse. Aunque el filesystem raíz parece corresponder al volumen de arranque, no se verificó independientemente desde OCI la cobertura de esta ruta por una copia específica ni se probó su recuperación aislada.

### Procedimiento propuesto de recuperación de uploads (no implementado)

Antes de respaldar, confirmar el proveedor efectivo y su origen en el staging ya aislado. La ruta local observada no prueba que siga siendo el almacenamiento activo. El destino debe ser privado e independiente del VPS; no se ha confirmado que el bucket PostgreSQL existente ni su identidad IAM sean adecuados para uploads, por lo que no se deben reutilizar sin revisión y aprobación del propietario.

Para almacenamiento local, coordinar el dump PostgreSQL y los archivos en un mismo punto de consistencia. En staging aislado, pausar temporalmente las operaciones que crean, reemplazan o eliminan archivos y sus referencias, o demostrar que los snapshots de base y filesystem corresponden al mismo punto. Empaquetar la ruta bajo un directorio temporal privado, cifrar el archivo y el manifiesto con la clave pública de recuperación y subirlos con nombre único a un destino aprobado. El manifiesto debe registrar clave relativa, tamaño y SHA-256; como las claves pueden revelar identificadores de tenant o empleado, el manifiesto debe quedar cifrado y nunca imprimirse en logs o reportes compartidos. La identidad de carga debe limitarse al destino aprobado y no poder borrar copias retenidas. La retención requiere aprobación; no está configurada por este procedimiento.

Para almacenamiento R2, el objeto primario no cuenta por sí solo como copia recuperable. Se necesita una copia independiente y privada con acceso y retención revisados. El migrador existente `pnpm --filter @saas/api storage:migrate-local-to-r2` escribe en R2 sin sobrescribir y compara tamaño/SHA-256 al releer, pero su reporte contiene claves y errores; cualquier ejecución futura debe hacerse solo desde un entorno aislado autorizado y guardar el reporte en un canal privado. El migrador no elimina LocalDisk. `r2-migration` tampoco es escritura dual: una vez que se aceptan escrituras en R2, cambiar a `local` puede ocultar objetos nuevos; no existe migrador inverso verificado. No cambiar el proveedor hasta completar y revisar la copia, su lectura y el rollback aplicable.

La prueba de recuperación debe restaurar el artefacto en un directorio nuevo, vacío y restrictivo de un host/entorno aislado, nunca sobre `/app/uploads` ni sobre la ruta activa. Verificar el SHA-256 del artefacto cifrado antes del descifrado, validar la lectura del archivo, y comparar en privado cantidad, bytes y SHA-256 por clave con el manifiesto. Con el dump PostgreSQL restaurado en el mismo entorno aislado, comparar mediante conteos agregados las referencias documentales con los objetos restaurados y reportar solo totales de faltantes/extras; no imprimir claves, nombres ni contenidos. Conservar evidencia sanitizada del destino, timestamp, checksum y resultado. No retirar origen ni temporales hasta que el propietario acepte la prueba y confirme que la copia independiente es accesible.

**Criterio de aceptación:** proveedor y origen identificados; punto de consistencia documentado; artefacto cifrado accesible con una identidad autorizada de lectura; checksum y descifrado correctos; todos los archivos restaurados coinciden con el manifiesto; conteos agregados de referencias/objetos sin faltantes inexplicados; restauración aislada revisable; y retención/permisos aprobados. Hasta entonces, la cobertura de uploads y E7.1/M7 continúan pendientes.

### Secuencia operativa reproducible (preparada, no ejecutada)

Esta secuencia es exclusivamente para un staging cuya base y storage ya estén aislados. No ejecutarla en el VPS actual: la API comparte `oficina_nitida`, y el servicio PostgreSQL documentado en este directorio respalda precisamente esa base. La copia de DB y uploads debe pertenecer al mismo `RUN_ID` y al mismo intervalo sin escrituras de documentos; el backup diario existente no se presume coordinado con una copia de archivos. Un DBA debe confirmar el destino de la DB aislada y el operador debe aprobar el directorio temporal, destino privado, retención y perfiles OCI antes de empezar.

**Crear artefacto local y manifiesto.** Ejecutar en el host aislado con GNU tar, `python3`, GPG y OCI CLI ya instalados. El manifiesto es información sensible: la carpeta temporal debe estar en almacenamiento cifrado o `tmpfs`, con capacidad libre comprobada de al menos dos veces el tamaño de uploads. No activar `set -x`, no imprimir el manifiesto y no usar valores de credenciales en argumentos.

```bash
set -Eeuo pipefail
umask 077
: "${UPLOADS_ROOT:?ruta absoluta confirmada del storage local aislado}"
: "${TMP_PARENT:?directorio temporal cifrado aprobado}"
: "${RUN_ID:?identificador UTC único sin datos de tenant/personas}"
: "${RECOVERY_RECIPIENT_FINGERPRINT:?fingerprint pública verificada}"
: "${OCI_NAMESPACE:?namespace confirmado por el operador}"
: "${OCI_BUCKET:?bucket privado aprobado}"
: "${OCI_OBJECT:?nombre único bajo el prefijo aprobado}"
: "${OCI_UPLOAD_PROFILE:?perfil ya configurado para cargar en el destino aprobado}"
[[ "$RUN_ID" =~ ^[A-Za-z0-9][A-Za-z0-9Tz._-]{0,63}$ ]]
[[ "$RECOVERY_RECIPIENT_FINGERPRINT" =~ ^[A-Fa-f0-9]{40,64}$ ]]

test -d "$UPLOADS_ROOT"
test ! -L "$UPLOADS_ROOT"
test ! -e "$UPLOADS_ROOT/.dusema-backup-meta"
test -d "$TMP_PARENT" && test -w "$TMP_PARENT"
case "$UPLOADS_ROOT" in /*) ;; *) echo 'Abortado: UPLOADS_ROOT debe ser absoluto.' >&2; exit 1 ;; esac
case "$TMP_PARENT" in /*) ;; *) echo 'Abortado: TMP_PARENT debe ser absoluto.' >&2; exit 1 ;; esac
UPLOADS_ROOT=$(realpath -e -- "$UPLOADS_ROOT")
TMP_PARENT=$(realpath -e -- "$TMP_PARENT")
case "$TMP_PARENT/" in "$UPLOADS_ROOT/"*) echo 'Abortado: el temporal no puede estar dentro de uploads.' >&2; exit 1 ;; esac
SOURCE_BYTES=$(du -sb -- "$UPLOADS_ROOT" | cut -f1)
AVAILABLE_BYTES=$(df -B1 --output=avail "$TMP_PARENT" | tail -n1 | tr -d ' ')
if [ "$AVAILABLE_BYTES" -lt $((SOURCE_BYTES * 2 + 67108864)) ]; then
  echo 'Abortado: espacio temporal insuficiente.' >&2
  exit 1
fi
WORK=$(mktemp -d "$TMP_PARENT/dusema-uploads-$RUN_ID.XXXXXX")
chmod 0700 "$WORK"

build_manifest() {
  python3 - "$1" "$2" <<'PY'
import csv, hashlib, os, stat, sys
root, destination = map(os.path.realpath, sys.argv[1:])
root_device = os.stat(root).st_dev
rows = []
def fail_walk(error):
    raise error
try:
    for current, dirs, files in os.walk(root, topdown=True, onerror=fail_walk, followlinks=False):
        dirs.sort()
        for name in dirs:
            info = os.lstat(os.path.join(current, name))
            if not stat.S_ISDIR(info.st_mode) or info.st_dev != root_device:
                raise ValueError
        if current == root:
            dirs[:] = [name for name in dirs if name != '.dusema-backup-meta']
        for name in sorted(files):
            path = os.path.join(current, name)
            info = os.lstat(path)
            if not stat.S_ISREG(info.st_mode) or info.st_dev != root_device:
                raise ValueError
            key = os.path.relpath(path, root).replace(os.sep, '/')
            digest = hashlib.sha256()
            with open(path, 'rb') as source:
                for chunk in iter(lambda: source.read(1024 * 1024), b''):
                    digest.update(chunk)
            rows.append((digest.hexdigest(), str(info.st_size), key))
    with open(destination, 'x', encoding='utf-8', newline='') as output:
        writer = csv.writer(output, delimiter='\t', lineterminator='\n')
        writer.writerows(rows)
except Exception:
    print('Manifest abortado; revisar el árbol solo en el entorno autorizado.', file=sys.stderr)
    raise SystemExit(1)
PY
}

validate_archive() {
  python3 - "$1" <<'PY'
import sys, tarfile
seen = set()
manifest_seen = False
try:
    with tarfile.open(sys.argv[1], 'r:') as archive:
        for member in archive:
            raw = member.name
            if raw.startswith('/'):
                raise ValueError
            parts = raw.split('/')
            if any(part == '..' for part in parts):
                raise ValueError
            name = '/'.join(part for part in parts if part not in ('', '.'))
            if not name:
                if not member.isdir():
                    raise ValueError
                continue
            if name in seen or not (member.isfile() or member.isdir()):
                raise ValueError
            if name == '.dusema-backup-meta/manifest.tsv':
                if not member.isfile():
                    raise ValueError
                manifest_seen = True
            elif name == '.dusema-backup-meta':
                if not member.isdir():
                    raise ValueError
            elif name.startswith('.dusema-backup-meta/'):
                raise ValueError
            seen.add(name)
    if not manifest_seen:
        raise ValueError
except Exception:
    print('Validación del archivo abortada; revisar el artefacto en el entorno autorizado.', file=sys.stderr)
    raise SystemExit(1)
PY
}

build_manifest "$UPLOADS_ROOT" "$WORK/manifest.tsv"
if ! tar --create --one-file-system --file="$WORK/uploads.tar" \
  --directory="$UPLOADS_ROOT" . 2>"$WORK/tar-create.log"; then
  echo 'Abortado: tar no pudo leer el árbol de uploads.' >&2
  exit 1
fi
if ! tar --append --file="$WORK/uploads.tar" \
  --transform='s|^manifest.tsv$|.dusema-backup-meta/manifest.tsv|' \
  --directory="$WORK" manifest.tsv 2>"$WORK/tar-append.log"; then
  echo 'Abortado: no se pudo añadir el manifiesto al archivo.' >&2
  exit 1
fi
validate_archive "$WORK/uploads.tar"
build_manifest "$UPLOADS_ROOT" "$WORK/source-after-archive.tsv"
cmp --silent "$WORK/manifest.tsv" "$WORK/source-after-archive.tsv"
gpg --batch --no-tty --trust-model always \
  --recipient "${RECOVERY_RECIPIENT_FINGERPRINT}!" --encrypt \
  --output "$WORK/uploads.tar.gpg" "$WORK/uploads.tar"
UPLOADS_SHA256=$(sha256sum -- "$WORK/uploads.tar.gpg" | cut -d' ' -f1)
oci os object put --namespace "$OCI_NAMESPACE" --bucket-name "$OCI_BUCKET" \
  --name "$OCI_OBJECT" --file "$WORK/uploads.tar.gpg" \
  --verify-checksum --no-overwrite --profile "$OCI_UPLOAD_PROFILE"
```

Guardar `RUN_ID`, nombre de objeto, bytes agregados, SHA-256 cifrado, perfil usado (solo su nombre) y resultado fuera del VPS, en un registro operativo privado. No guardar el manifiesto ni listar sus claves. El comando de arriba no toma el dump de PostgreSQL: generar el dump de la **base aislada correcta** durante la misma ventana sin escrituras mediante un procedimiento revisado para esa base. No reutilizar el servicio actual mientras apunte a `oficina_nitida`.

### Emparejamiento de PostgreSQL y uploads

**Estado: diseño propuesto; no aprobado ni probado como conjunto recuperable.**
El requisito de usar el mismo `RUN_ID` y la misma ventana sin escrituras no está
impuesto por los artefactos actuales: el servicio diario de PostgreSQL genera
su propio nombre de objeto, mientras que el bloque de uploads recibe
`OCI_OBJECT` por separado. El registro operativo privado ayuda a relacionar una
ejecución, pero no es un marcador durable que permita rechazar un conjunto
incompleto o mezclar por error artefactos de ejecuciones distintas.

El mecanismo candidato es un manifiesto privado de conjunto publicado **al
final**. Hasta que el propietario, DBA y operador aprueben la ventana de captura,
su ubicación y retención, estos pasos son una propuesta y no autorizan una
ejecución:

1. Después de demostrar que staging usa su propia base y storage, generar un
   `BACKUP_SET_ID` UTC único sin nombres de tenants ni personas. Ponerlo en los
   nombres de ambos objetos y del manifiesto bajo un prefijo común candidato,
   por ejemplo `backup-sets/<BACKUP_SET_ID>/`. Validar el prefijo y la regla de
   retención con el operador; no asumir que esta ruta o política ya existe. No
   reutilizar directamente el nombre independiente del timer actual como
   identificador común.
2. Activar una barrera de escritura que afecte únicamente a staging aislado.
   Mantenerla durante el dump y el archivo de uploads, incluyendo procesos
   asíncronos que puedan cambiar referencias o archivos. Registrar inicio y fin
   UTC, y comprobar que las escrituras y trabajos en vuelo terminaron antes de
   empezar. El VPS actual no cumple esta precondición porque la API llamada
   staging comparte `oficina_nitida`.
3. Con la barrera activa, producir el dump lógico de la base exclusiva de
   staging y el archivo cifrado de uploads. Mantener el manifiesto por archivo
   dentro del archivo cifrado; no copiar sus claves a logs ni al manifiesto
   externo. Calcular y registrar por separado SHA-256 cifrado y tamaño de cada
   artefacto.
4. Subir ambos artefactos con nombres únicos y `--no-overwrite`. No publicar aún
   el marcador del conjunto si cualquiera de las dos cargas o verificaciones
   falla. `--verify-checksum` durante `put` confirma la carga según la CLI, pero
   no demuestra que el objeto pueda leerse después.
5. Publicar el manifiesto del conjunto solo después de que existan ambos
   objetos. Debe contener únicamente versión del formato, `BACKUP_SET_ID`,
   intervalo de captura, referencia no sensible al entorno/base, proveedor de
   storage, revisión de aplicación, claves de los dos objetos, tamaños y hashes
   SHA-256 cifrados. No incluir credenciales, filas, nombres de archivos ni el
   manifiesto interno de uploads. Si no existe el manifiesto final, la ejecución
   se considera incompleta y no constituye un punto de recuperación.
6. Para certificar accesibilidad, consultar metadata con una identidad que ya
   tenga `OBJECT_INSPECT`; para confirmar los hashes de contenido, descargar
   ambos objetos con una identidad que ya tenga `OBJECT_READ` a un destino
   privado aprobado y comparar SHA-256. No ampliar permisos para completar esta
   prueba. Aplicar retención al conjunto completo: manifiesto y ambos objetos
   deben conservarse o expirar juntos.
7. Restaurar solo conjuntos cuyo manifiesto vincule los dos objetos y cuyos
   hashes coincidan. Usar una base temporal sin ruta de red al servidor y un
   directorio uploads vacío. Ejecutar la validación del archivo y el cotejo
   agregado de referencias descritos abajo contra esa base restaurada; no contra
   `oficina_nitida`.

Este diseño deja el manifiesto externo como marcador de finalización, no como
sustituto de la verificación criptográfica ni de la restauración. La secuencia
de uploads documentada debajo no crea todavía el dump de staging, el manifiesto
de conjunto ni un mecanismo coordinador; por tanto, aún no acredita una captura
consistente de ambos tipos de datos.

**Lectura y restauración aislada.** En una estación/entorno de recuperación aprobado, con la identidad OCI de solo lectura existente, `OBJECT_INSPECT` permite consultar metadata y `OBJECT_READ` permite descargar el objeto. Completar con el nombre y checksum registrados en la corrida; no solicitar permisos nuevos. La metadata/head no sustituye el hash del contenido descargado.

```bash
set -Eeuo pipefail
umask 077
: "${OCI_NAMESPACE:?}"
: "${OCI_BUCKET:?}"
: "${OCI_OBJECT:?nombre exacto obtenido del registro de la corrida}"
: "${OCI_READ_PROFILE:?perfil preexistente autorizado para leer el objeto}"
: "${EXPECTED_CIPHERTEXT_SHA256:?checksum registrado al crear el objeto}"
: "${RECOVERY_GNUPGHOME:?GnuPG home con clave privada de recuperación ya disponible}"
: "${RESTORE_PARENT:?directorio temporal aislado aprobado}"
[[ "$EXPECTED_CIPHERTEXT_SHA256" =~ ^[A-Fa-f0-9]{64}$ ]]

test -d "$RESTORE_PARENT" && test -w "$RESTORE_PARENT"
case "$RESTORE_PARENT" in /*) ;; *) echo 'Abortado: RESTORE_PARENT debe ser absoluto.' >&2; exit 1 ;; esac
RESTORE_PARENT=$(realpath -e -- "$RESTORE_PARENT")
WORK=$(mktemp -d "$RESTORE_PARENT/dusema-upload-recovery.XXXXXX")
chmod 0700 "$WORK"
RESTORE_ROOT=$(mktemp -d "$RESTORE_PARENT/dusema-upload-restore.XXXXXX")
chmod 0700 "$RESTORE_ROOT"
OBJECT_BYTES=$(oci os object head --namespace "$OCI_NAMESPACE" --bucket-name "$OCI_BUCKET" \
  --name "$OCI_OBJECT" --profile "$OCI_READ_PROFILE" \
  --query '"content-length"' --raw-output)
case "$OBJECT_BYTES" in ''|*[!0-9]*) echo 'Abortado: metadata de tamaño inválida.' >&2; exit 1 ;; esac
AVAILABLE_BYTES=$(df -B1 --output=avail "$RESTORE_PARENT" | tail -n1 | tr -d ' ')
if [ "$AVAILABLE_BYTES" -lt $((OBJECT_BYTES * 3 + 67108864)) ]; then
  echo 'Abortado: espacio de recuperación insuficiente.' >&2
  exit 1
fi
oci os object get --namespace "$OCI_NAMESPACE" --bucket-name "$OCI_BUCKET" \
  --name "$OCI_OBJECT" --file "$WORK/uploads.tar.gpg" --profile "$OCI_READ_PROFILE"
printf '%s  %s\n' "$EXPECTED_CIPHERTEXT_SHA256" "$WORK/uploads.tar.gpg" \
  | sha256sum --check --status
gpg --batch --no-tty --homedir "$RECOVERY_GNUPGHOME" \
  --output "$WORK/uploads.tar" --decrypt "$WORK/uploads.tar.gpg"
validate_archive "$WORK/uploads.tar"
if ! tar --extract --file="$WORK/uploads.tar" --directory="$RESTORE_ROOT" \
  --no-same-owner --no-same-permissions 2>"$WORK/tar-extract.log"; then
  echo 'Abortado: no se pudo extraer el archivo cifrado validado.' >&2
  exit 1
fi
build_manifest "$RESTORE_ROOT" "$WORK/restored-manifest.tsv"
cmp --silent "$RESTORE_ROOT/.dusema-backup-meta/manifest.tsv" \
  "$WORK/restored-manifest.tsv"
```

En el entorno de recuperación, copiar exactamente las funciones `build_manifest` y `validate_archive` del bloque anterior antes de ejecutar estos comandos. `cmp --silent` no muestra claves: cualquier diferencia falla la prueba. Mantener el directorio restaurado desconectado de la aplicación y del VPS original. Restaurar también el dump emparejado en una instancia temporal sin ruta de red al servidor productivo. Para cotejar referencias, importar el TSV en una tabla temporal dentro de **esa base restaurada aislada** y ejecutar solo esta consulta agregada; no usarla contra `oficina_nitida`.

```sql
BEGIN;
CREATE TEMP TABLE restored_upload_manifest (
  sha256 text NOT NULL,
  size_bytes bigint NOT NULL,
  storage_key text PRIMARY KEY
);
\copy restored_upload_manifest (sha256,size_bytes,storage_key) FROM '<RESTORE_ROOT>/.dusema-backup-meta/manifest.tsv' WITH (FORMAT csv, DELIMITER E'\t')
WITH refs AS (
  SELECT COALESCE("pdfStorageKey", CASE WHEN "pdfUrl" LIKE '/uploads/%'
    THEN substring("pdfUrl" FROM '^/uploads/(.*)$') END) AS storage_key,
    "pdfSizeBytes"::bigint AS expected_bytes
    FROM generated_documents
  UNION ALL
  SELECT "storageKey", "tamanoBytes"::bigint FROM expediente_docs
  UNION ALL
  SELECT "storageKey", NULL::bigint FROM plantillas
  UNION ALL
  SELECT "zipKey", NULL::bigint FROM lotes_contrato
  UNION ALL
  SELECT substring("logoUrl" FROM '^/uploads/(.*)$'), NULL::bigint
    FROM tenants WHERE "logoUrl" LIKE '/uploads/%'
  UNION ALL
  SELECT substring("firmaRepresentanteUrl" FROM '^/uploads/(.*)$'), NULL::bigint
    FROM tenants WHERE "firmaRepresentanteUrl" LIKE '/uploads/%'
), ref_keys AS (
  SELECT storage_key, max(expected_bytes) AS expected_bytes,
    count(DISTINCT expected_bytes) FILTER (WHERE expected_bytes IS NOT NULL) AS size_versions
    FROM refs WHERE storage_key IS NOT NULL GROUP BY storage_key
), reference_metrics AS (
  SELECT count(*) FILTER (WHERE m.storage_key IS NULL) AS missing_references,
    count(*) FILTER (WHERE m.storage_key IS NOT NULL AND r.expected_bytes IS NOT NULL
      AND m.size_bytes <> r.expected_bytes) AS size_mismatches,
    count(*) FILTER (WHERE r.size_versions > 1) AS database_size_conflicts
    FROM ref_keys r LEFT JOIN restored_upload_manifest m USING (storage_key)
), orphan_metrics AS (
  SELECT count(*) AS unreferenced_objects FROM restored_upload_manifest m
    LEFT JOIN ref_keys r USING (storage_key) WHERE r.storage_key IS NULL
)
SELECT * FROM reference_metrics CROSS JOIN orphan_metrics;
ROLLBACK;
```

La secuencia solo pasa si el checksum cifrado coincide, GPG y tar terminan correctamente, `cmp` coincide y la consulta retorna cero faltantes, desajustes de tamaño y conflictos; cualquier objeto no referenciado debe quedar explicado sin imprimir sus claves. Capturar únicamente timestamps, identificadores de corrida, hash, conteos y códigos de resultado. No limpiar temporales ni retirar fuentes hasta aceptación del propietario y confirmación de una copia independiente accesible. Si el proveedor efectivo resulta ser R2, detener este procedimiento local: el repositorio no contiene un exportador/restaurador de R2 verificado y se necesita definirlo antes de probar ese camino.

## Pruebas locales

El test crea un entorno temporal aislado y sustituye Docker, GPG, OCI, `flock`, `mkdir`, `chmod` y `rm` con mocks. Comprueba los argumentos clave de `pg_dump`, GPG y OCI, `--no-overwrite`, conflicto de nombre, errores de preparación, que errores/raw stderr y contenido marcador no llegan a logs, que no se intenta subir si falla dump o cifrado, que un fallo de limpieza posterior al éxito no registra `complete`, que un fallo de limpieza conserva el código original y que artefactos preexistentes permanecen intactos. No valida llamadas OCI, PostgreSQL, GPG, systemd o la restauración reales. Las señales están manejadas por el script, pero no tienen una prueba determinista en este harness Windows; hay que probar ese ciclo en Linux antes de instalar/activar el timer.

```bash
bash -n deploy/postgres-backup/backup-postgres.sh
bash -n deploy/postgres-backup/test-backup-postgres.sh
bash deploy/postgres-backup/test-backup-postgres.sh
```

El modo POSIX efectivo de directorios y el comportamiento de systemd deben comprobarse en Ubuntu.

## Instalación para un host nuevo (no ejecutar en la VPS actual)

La VPS actual ya tiene el timer habilitado y una ejecución programada exitosa
observada. Los comandos de esta sección son solo una plantilla para un host
nuevo después de una autorización operativa; no deben repetirse en la VPS
existente ni usarse para volver a habilitar el timer. La ruta del checkout en el
servidor no se confirmó. La correspondencia entre estos artefactos y el
ejecutable/unidades instalados sí se confirmó por SHA-256 el 24 de octubre; sus
hashes están registrados en la tabla.

Primero un operador debe elegir y verificar cómo transferir este directorio al VPS. La ruta remota del checkout/paquete no se confirmó. Antes de instalar debe volver a comprobar, sin revelar valores sensibles: identidad del servidor; rutas actuales de Compose/servicios y contenedor; versión de OCI CLI y existencia de `--no-overwrite`; rutas/propietarios/permisos de herramientas y directorios; espacio libre; versión `pg_dump`; autenticación local no interactiva; rol/permisos; clave GPG pública y fingerprint; política de permisos de OCI; y procedimiento de rollback de los archivos instalados. La identidad IAM debe tener solo lo necesario para subir a `postgres/*` y no debe poder borrar copias retenidas.

Una vez que `REPO_DIR` apunte a ese checkout verificado en el VPS, desde una shell Bash:

```bash
cd "$REPO_DIR"
sudo install -o root -g ubuntu -m 0750 deploy/postgres-backup/backup-postgres.sh /usr/local/sbin/dusema-postgres-backup
sudo install -o root -g root -m 0644 deploy/postgres-backup/dusema-postgres-backup.service /etc/systemd/system/dusema-postgres-backup.service
sudo install -o root -g root -m 0644 deploy/postgres-backup/dusema-postgres-backup.timer /etc/systemd/system/dusema-postgres-backup.timer
sudo systemd-analyze verify /etc/systemd/system/dusema-postgres-backup.service /etc/systemd/system/dusema-postgres-backup.timer
sudo systemctl daemon-reload
```

En un host nuevo, la verificación e instalación no habilitan el timer. En la
VPS actual ya existe una ejecución programada; no iniciar el servicio para
repetirla como parte de esta guía. Si se autoriza una futura ejecución manual,
su journal debe revisarse sin imprimir stderr/secretos y el objeto resultante
debe verificarse con una identidad de lectura autorizada:

```bash
sudo systemctl start dusema-postgres-backup.service
sudo systemctl --no-pager --full status dusema-postgres-backup.service
sudo journalctl -u dusema-postgres-backup.service --since today --no-pager
```

Para habilitar la programación en otro host se requiere aprobación explícita,
revisión del objeto, retención, alertas y capacidad. El timer de la VPS actual
ya está habilitado; no ejecutar aquí:

```bash
sudo systemctl enable --now dusema-postgres-backup.timer
systemctl list-timers dusema-postgres-backup.timer
```

Detener la programación o el servicio en cualquier host requiere aprobación
operativa explícita. Estos comandos no forman parte de una validación rutinaria
y no deben ejecutarse en la VPS actual sin esa autorización:

```bash
sudo systemctl disable --now dusema-postgres-backup.timer
sudo systemctl stop dusema-postgres-backup.service
```

La retirada de archivos de unidad o ejecutable requiere una decisión de operador. No se debe borrar `/var/lib/dusema-postgres-backup` sin comprobar que solo contiene lock/temporales propios y que no hay un backup en ejecución.

## Decisiones y verificaciones pendientes

- La comparación SSH de solo lectura del 24 y 25 de octubre encontró que el script y ambas unidades instaladas coinciden por SHA-256 con los tres artefactos de este directorio. Repetir esa comparación antes de reinstalar o cambiar las unidades.
- Conservar fuera de la VPS evidencia sanitizada de las ejecuciones del 23, 24 y 25 de octubre (journal, SHA-256 y resultado), sin incluir secretos.
- El 25 de octubre, `oci os object head` desde la VPS con la identidad instance principal devolvió `Forbidden`; la CLI OCI no está disponible en el equipo local inspeccionado. Este rechazo no demuestra que el objeto no exista. El operador reportó una descarga, verificación SHA-256, descifrado y restauración manual el 23 de octubre, pero no se revisaron independientemente artefactos de esa restauración. Obtener metadatos del objeto con una identidad de lectura ya autorizada y conservar evidencia revisable de la restauración, sin ampliar permisos ni descargar/descifrar todavía.
- Revalidación OCI de solo lectura el 2026-10-25 19:33–19:34 UTC, usando `/home/ubuntu/bin/oci` y la identidad instance principal: `object head` del objeto del 25 de octubre devolvió HTTP 404; `object list` con el prefijo exacto devolvió `BucketNotFound` y especificó que el bucket puede no existir o que el solicitante no está autorizado. Es una respuesta ambigua y no demuestra ausencia del objeto o del bucket. No se descargó ni descifró el artefacto. Para confirmar metadatos, usar una identidad ya autorizada con `OBJECT_INSPECT` limitada al bucket/objeto; la descarga requiere además `OBJECT_READ`.
- Proteger uploads con un mecanismo recuperable independiente y probar su restauración. La medición SSH del 25 de octubre encontró cero archivos regulares (0 bytes) en la ruta; no demuestra cobertura ni recuperación. El backup PostgreSQL no los incluye.
- Revisar la lifecycle policy/versionado y aprobar retención de 30 días antes de cualquier cambio externo.
- Confirmar autenticación y permisos efectivos del rol usado por el dump sin exponer secretos ni crear roles, si se cambia o vuelve a certificar el procedimiento.
- Revalidar herramientas, rutas, OCI CLI y soporte de `--no-overwrite` antes de modificar el proceso.
- Definir un canal de alertas de fallos; ninguno está confirmado.
- Comparar la unidad efectiva del timer con la fuente local antes de afirmar que sus valores `Persistent` y `AccuracySec` coinciden.
- Determinar si Redis contiene estado que requiera respaldo antes de tratarlo como dato recuperable.
