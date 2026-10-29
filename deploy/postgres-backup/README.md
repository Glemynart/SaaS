# Respaldos PostgreSQL de Dusema

Esta carpeta contiene los artefactos locales para un backup lógico cifrado de PostgreSQL 17. Una inspección SSH de solo lectura del 23 de octubre de 2026 encontró `dusema-postgres-backup.timer` habilitado y activo; el servicio tuvo última ejecución ese día a las 07:00:11 UTC, terminó con `Result=success` y código 0, y la siguiente estaba prevista para el 24 de octubre a las 07:00 UTC. El journal de esa ejecución informó la carga del objeto y la verificación de checksum. La unidad y el script instalados en el VPS no se compararon byte a byte con estos archivos locales; este directorio no prueba qué revisión exacta está instalada.

Una inspección SSH de solo lectura del 24 de octubre confirmó una ejecución programada a las 07:00:04 UTC; `dusema-postgres-backup.service` terminó a las 07:00:05 UTC con `Result=success` y estado 0. El journal informó la carga de `postgres/dusema-oficina_nitida-20261024T020004-0500-yGA63y.dump.gpg`, SHA-256 `844e36ff4d8a1979a4fbd507214d069e82a610fa36bd449b41f9668c7627f067`, aceptación de OCI y verificación de checksum por el script. No se comprobó la accesibilidad actual del objeto ni se revisó evidencia independiente de restauración.

Una comparación SSH de solo lectura posterior, también del 24 de octubre, confirmó que el ejecutable y ambas unidades instaladas coinciden byte a byte con estos archivos locales: se compararon sus SHA-256 y los tres pares fueron iguales. Systemd muestra los archivos bajo `/etc/systemd/system/`, sin drop-ins; el timer está habilitado y activo, tuvo su última activación a las 07:00:04 UTC del 24 y la siguiente está prevista para las 07:00 UTC del 25. El servicio informa `Result=success`, código 0 y ejecución de 07:00:04 a 07:00:05 UTC. Esto acredita la identidad de los artefactos y el estado observado del timer/servicio, pero no el acceso actual al objeto ni una restauración independiente.

Una inspección SSH de solo lectura del 25 de octubre de 2026 confirmó el timer habilitado y activo: `LastTriggerUSec=2026-10-25 07:00:11 UTC` y `NextElapseUSecRealtime=2026-10-26 07:00:00 UTC`. El servicio inició a las 07:00:11 y terminó a las 07:00:13 UTC con `Result=success`, `ExecMainStatus=0`. El journal registró la carga de `postgres/dusema-oficina_nitida-20261025T020011-0500-OpRYGz.dump.gpg`, SHA-256 `d14e3e392a0050b986e2c8e560fe1a64cb5f4703f1984d4ca1a65f7631dc450a`, y el evento `complete`. En esta misma inspección, el SHA-256 del ejecutable `/usr/local/sbin/dusema-postgres-backup` y de las unidades activas bajo `/etc/systemd/system/` coincidió con los tres artefactos versionados en este directorio; ambos servicios no tienen drop-ins. Dado que el script instalado coincidente registra `complete` solo después de que OCI acepta el objeto, `--verify-checksum` termina correctamente y se eliminan los temporales, esto confirma la ejecución programada y la verificación de checksum durante la carga. No confirma que el objeto siga accesible ahora ni una restauración independiente; tampoco cubre uploads.

Una inspección SSH de solo lectura del 26 de octubre de 2026 a las 08:47 UTC observó `LastTriggerUSec=2026-10-26 07:00:10 UTC` y `NextElapseUSecRealtime=2026-10-27 07:00:00 UTC`; el timer seguía habilitado y activo. `dusema-postgres-backup.service` inició a las 07:00:10 y terminó a las 07:00:12 UTC con `Result=success` y `ExecMainStatus=0`. El journal registró la carga de `postgres/dusema-oficina_nitida-20261026T020010-0500-ANQ9JZ.dump.gpg`, SHA-256 `cf123f4ec03da98363597fb75b55d5b947ea006a6996398556c62289f1796f84`, seguido por `complete: OCI accepted the encrypted object and upload checksum verification passed; temporary files removed`. Esto confirma la activación programada, el resultado del servicio y lo informado por el journal durante la carga. No se comprobó el acceso actual al objeto con una identidad de lectura, el checksum mediante una descarga independiente, la descifrabilidad ni una restauración. En esta inspección no se volvió a comparar por SHA-256 el ejecutable ni las unidades instaladas. El backup tampoco cubre uploads.

El operador reportó que el 23 de octubre descargó el objeto cifrado de esa ejecución, verificó su SHA-256, lo descifró y lo restauró manualmente en PostgreSQL 17 local: la restauración terminó con código 0, produjo 52 tablas y ocupó aproximadamente 12 MB. Este es un resultado reportado por el operador y no fue repetido ni inspeccionado independientemente durante la actualización de este documento. La restauración de PostgreSQL no verifica la recuperación de uploads.

Revalidación SSH de solo lectura del 2026-10-25, aproximadamente 22:03 UTC: el directorio `/home/ubuntu/la-oficina-nitida/staging/uploads` tiene propietario `opc:opc`, modo `0750` y está en `/dev/sda1`. Un conteo agregado con `sudo -n find` no encontró entradas; `du -sb` informó 0 bytes. En ese momento, el filesystem tenía 33,641,213,952 bytes libres. La consulta no mostró nombres ni leyó contenidos. Es una medición puntual: no demuestra que snapshots u otro backup cubran la ruta ni que una restauración de uploads sea posible. E7.1 sigue pendiente de evidencia de cobertura y recuperación.

## Configuración y evidencia disponible

Los valores observados siguientes proceden de las inspecciones de solo lectura del 22 al 26 de octubre de 2026. El 24 y el 25 de octubre se compararon por SHA-256 el script y las dos unidades instaladas con estos archivos locales; los hashes coincidieron. Revalidar las rutas y la configuración efectiva antes de cambiar o reinstalar el proceso.

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
| Frecuencia observada                         | El timer estaba habilitado/activo; última activación 2026-10-26 07:00:10 UTC; siguiente 2026-10-27 07:00:00 UTC               |
| Último servicio observado                    | `Result=success`, `ExecMainStatus=0`; ejecución 2026-10-26 07:00:10–07:00:12 UTC                                              |
| SHA-256 del script instalado/local           | `bf8b20301c0fe451f3d731473e61fc289cf9f00f9eafa76c1c400356a22ebadb` (coincide)                                                 |
| SHA-256 de la unidad service instalada/local | `117a6a09951ef1ac0053e5c1511b7c836108453fb285b3240c81dac409eb17f7` (coincide)                                                 |
| SHA-256 de la unidad timer instalada/local   | `e740350347328206a641be0f2a4c9d48aaa07fa055edcdde040d0c94ce1663b0` (coincide)                                                 |
| Objeto informado                             | `postgres/dusema-oficina_nitida-20261026T020010-0500-ANQ9JZ.dump.gpg`                                                         |
| SHA-256 informado                            | `cf123f4ec03da98363597fb75b55d5b947ea006a6996398556c62289f1796f84`                                                            |
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

## Archivos de aplicación no cubiertos por el backup PostgreSQL

La inspección del 23 de octubre de 2026 confirmó el bind mount `/home/ubuntu/la-oficina-nitida/staging/uploads` → `/app/uploads`, modo `0750` y propietario/grupo numéricos `1000:1000`. `du -sh` reportó 4 KiB, pero el usuario SSH recibió `Permission denied` al recorrer la carpeta; por tanto, en esa inspección no se confirmó si contenía archivos ni su tamaño. Una inspección anterior del 22 de octubre había reportado cero entradas en ese momento, lo cual no demuestra el estado posterior.

Una inspección SSH de solo lectura con privilegios de lectura el 25 de octubre de 2026 confirmó que la ruta está en el filesystem raíz (`/`, `/dev/sda1`, ext4), con modo `0750` y propietario/grupo numéricos `1000:1000`. La búsqueda contó cero archivos regulares y 0 bytes en ese momento. Es una medición puntual: no garantiza que el directorio siga vacío ni constituye un respaldo. El backup lógico de PostgreSQL no incluye esta ruta; aún no se ha verificado la recuperación de un objeto operativo desde su destino independiente. Aunque el filesystem raíz parece corresponder al volumen de arranque, no se verificó independientemente desde OCI la cobertura de esta ruta por una copia específica ni se probó su recuperación aislada.

### Artefactos de uploads: implementación local y límites del conjunto

El backup PostgreSQL no incluye `/app/uploads`; su cobertura operativa sigue pendiente. Antes de usar estos scripts, confirmar en staging aislado el proveedor y origen efectivos, el destino privado e independiente, el perfil OCI aprobado y la retención. No reutilizar el bucket PostgreSQL ni ejecutar sobre el VPS actual: la API comparte `oficina_nitida`.

Para almacenamiento local, `backup-uploads-artifact.sh` produce un manifiesto privado de clave relativa, tamaño y SHA-256; archiva el árbol, valida cada contenido del tar contra el manifiesto, vuelve a comparar el origen, cifra el archivo con la clave pública de recuperación y sube el ciphertext usando `--verify-checksum` y `--no-overwrite`. Requiere `UPLOADS_ROOT`, `UPLOADS_QUIESCED=true`, `TMP_PARENT`, `BACKUP_SET_ID`, `GNUPGHOME`, `RECOVERY_RECIPIENT_FINGERPRINT`, `OCI_NAMESPACE`, `OCI_BUCKET`, `OCI_REGION`, `OCI_OBJECT_PREFIX` y `OCI_UPLOAD_PROFILE`. `OCI_CLI` es opcional. `TMP_PARENT` debe ser almacenamiento cifrado o `tmpfs`, con espacio libre estimado de al menos dos veces el tamaño agregado más 64 MiB; los scripts rechazan padres compartidos con escritura sin sticky bit.

`UPLOADS_QUIESCED=true` es una confirmación del operador, no prueba que hayan cesado todos los escritores. La verificación del árbol detecta cambios observados durante el archivo, pero no coordina con el dump PostgreSQL. El mismo `BACKUP_SET_ID` en el nombre del objeto no crea un marcador de conjunto recuperable ni demuestra que DB y archivos correspondan al mismo punto de consistencia.

Para recuperar, una identidad OCI autorizada de solo lectura debe descargar el objeto y registrar su SHA-256. `restore-uploads-artifact.sh` verifica ese hash, descifra, valida rutas, tipos y contenido de cada archivo, comprueba espacio libre y restaura únicamente en una carpeta nueva bajo `RESTORE_PARENT` con modo `0700`. Requiere `ENCRYPTED_BACKUP_FILE`, `EXPECTED_CIPHERTEXT_SHA256`, `RECOVERY_GNUPGHOME`, `RESTORE_PARENT` y un `RESTORE_DIR_NAME` nuevo con prefijo `dusema-uploads-restored-`; `RESTORE_WORK_PARENT` es opcional. `RESTORE_PARENT` y `RESTORE_WORK_PARENT` deben ser directorios controlados; el temporal de recuperación también debe estar en almacenamiento cifrado o `tmpfs`. Mantener la carpeta restaurada desconectada de la aplicación y no restaurar sobre `/app/uploads`.

Para almacenamiento R2, el objeto primario no cuenta por sí solo como copia recuperable. El migrador `pnpm --filter @saas/api storage:migrate-local-to-r2` verifica tamaño/SHA-256 al releer, pero su reporte contiene claves y errores; cualquier ejecución futura debe realizarse desde un entorno aislado autorizado y guardarse en un canal privado. No elimina LocalDisk. `r2-migration` tampoco es escritura dual, y no existe migrador inverso verificado.

La prueba de CI utiliza archivos sintéticos, GPG efímero y un mock de OCI. Comprueba carga simulada, restauración aislada, checksum, rechazo de traversal y corrupción de contenido con tamaño conservado; no accede a OCI ni acredita lectura de un objeto operativo. El manifiesto durable que empareje DB y uploads, la restauración conjunta, la verificación agregada de referencias y la retención aprobada continúan pendientes. Por tanto, E7.1 permanece abierta.
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

**Lectura y restauración aislada.** En una estación/entorno de recuperación aprobado, usa la identidad OCI de solo lectura ya autorizada. OBJECT_INSPECT permite consultar metadata y OBJECT_READ descargar el objeto; completa con el nombre y checksum registrados en la corrida. La metadata/head no sustituye el hash del contenido descargado. Después de comparar el SHA-256 descargado, ejecutar restore-uploads-artifact.sh con el archivo cifrado, su checksum, la clave de recuperación disponible fuera del VPS, RESTORE_PARENT aprobado y un RESTORE_DIR_NAME nuevo con prefijo dusema-uploads-restored-. RESTORE_ROOT será la carpeta nueva creada bajo RESTORE_PARENT. No restaurar sobre /app/uploads ni conectar esa carpeta a la aplicación durante la validación.
Para cotejar referencias, importar el TSV en una tabla temporal dentro de **esa base restaurada aislada** y ejecutar solo esta consulta agregada; no usarla contra `oficina_nitida`.

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
  SELECT "pdfKey", NULL::bigint FROM contratos
  UNION ALL
  SELECT "docxKey", NULL::bigint FROM contratos
  UNION ALL
  SELECT "xmlKey", NULL::bigint FROM facturas
  UNION ALL
  SELECT "pdfKey", NULL::bigint FROM facturas
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
bash -n deploy/postgres-backup/restore-postgres-backup.sh
bash -n deploy/postgres-backup/test-backup-restore-roundtrip.sh
bash deploy/postgres-backup/test-backup-postgres.sh
```

El modo POSIX efectivo de directorios y el comportamiento de systemd deben comprobarse en Ubuntu.

### Restauración PostgreSQL en un destino aislado

`restore-postgres-backup.sh` toma un archivo cifrado ya descargado con una identidad OCI de lectura autorizada, comprueba el SHA-256 registrado, lo descifra con `RECOVERY_GNUPGHOME` y restaura en una base nueva dentro de un contenedor PostgreSQL 17. Rechaza destinos que no estén en `network none`, publiquen puertos, tengan un bind mount del host o carezcan de la etiqueta `dusema.recovery=isolated`. La base usa el prefijo `dusema_recovery_` y nunca se sobrescribe; un fallo durante la restauración elimina solo la base parcial creada por este comando. El contenedor permanece disponible para inspección y no tiene una ruta de red a la aplicación.

Después de descargar el objeto con el nombre exacto de la ejecución y el perfil existente autorizado, conservar su SHA-256 y crear un destino efímero sin acceso de red:

```bash
RESTORE_CONTAINER_ID=$(docker run --detach --rm \
  --name "dusema-recovery-$(date -u +%Y%m%d%H%M%S)" \
  --network none \
  --label dusema.recovery=isolated \
  --env POSTGRES_HOST_AUTH_METHOD=trust \
  postgres:17)

ENCRYPTED_BACKUP_FILE='/ruta/privada/postgres.dump.gpg' \
EXPECTED_CIPHERTEXT_SHA256='SHA256_CIFRADO_REGISTRADO' \
RECOVERY_GNUPGHOME='/ruta/privada/gnupg' \
RESTORE_CONTAINER_ID="$RESTORE_CONTAINER_ID" \
RESTORE_DATABASE="dusema_recovery_$(date -u +%Y%m%d%H%M%S)" \
bash deploy/postgres-backup/restore-postgres-backup.sh
```

El contenedor no publica puertos ni monta rutas del host. `POSTGRES_HOST_AUTH_METHOD=trust` solo se usa dentro de ese contenedor sin red; no reutilizarlo en un servicio publicado. Revisar únicamente los conteos y el tamaño agregados que imprime el comando. Tras aceptar la inspección, `docker stop "$RESTORE_CONTAINER_ID"` elimina el contenedor y su almacenamiento anónimo por la opción `--rm`. No ejecutar la restauración en la VPS actual ni en una base conectada a la aplicación.

CI ejecuta además `test-backup-restore-roundtrip.sh`: crea datos sintéticos en PostgreSQL 17, genera y cifra un dump con los mismos flags de producción, y llama al restaurador contra un segundo contenedor aislado. Comprueba igualdad del digest de filas y del estado de secuencia. Esta prueba no accede a OCI ni a datos operativos; el restaurador actual cubre PostgreSQL, no uploads. E7.1 continúa abierto hasta comprobar el objeto operativo, una restauración revisable y la recuperación de archivos subidos.

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

### Inspección de una corrida programada (solo lectura)

Definir una ventana UTC que cubra únicamente la hora esperada del timer. No
iniciar el servicio manualmente. `systemctl show` entrega estado y timestamps;
el filtro de journal imprime solo el evento de carga (nombre del objeto y
SHA-256 cifrado) y `complete`. Si no aparece alguno, registrar esa evidencia
como ausente; no interpretar una salida vacía como éxito. El evento `complete`
indica que el script recibió aceptación de OCI, verificó el checksum de subida
y limpió sus temporales; no demuestra que el objeto sea accesible ahora ni que
se pueda restaurar.

```bash
RUN_DATE='YYYY-MM-DD'
FROM_UTC="${RUN_DATE} 06:55:00 UTC"
TO_UTC="${RUN_DATE} 07:15:00 UTC"
sudo systemctl show dusema-postgres-backup.timer \
  -p LastTriggerUSec -p NextElapseUSecRealtime -p ActiveState -p SubState
sudo systemctl show dusema-postgres-backup.service \
  -p Result -p ExecMainStatus -p ExecMainStartTimestamp -p ExecMainExitTimestamp
sudo journalctl -u dusema-postgres-backup.service \
  --since "$FROM_UTC" --until "$TO_UTC" --utc --no-pager -o short-iso \
  | grep -F 'dusema-postgres-backup: upload: sending encrypted artifact object='
sudo journalctl -u dusema-postgres-backup.service \
  --since "$FROM_UTC" --until "$TO_UTC" --utc --no-pager -o short-iso \
  | grep -F 'dusema-postgres-backup: complete:'
```

Un error de `journalctl` debe investigarse por separado sin volcar el journal
completo. Tras identificar el nombre exacto, comprobar metadata con una
identidad que ya tenga `OBJECT_INSPECT`; el checksum del contenido requiere
`OBJECT_READ` y una descarga a un destino privado aprobado. No ampliar permisos.

### Revalidación SSH de solo lectura — 2026-10-26

A las 10:46 UTC, el timer seguía habilitado y activo. `LastTriggerUSec` fue
2026-10-26 07:00:10 UTC y `NextElapseUSecRealtime` quedó para el 27 de octubre
a las 07:00 UTC. El servicio inició a las 07:00:10, terminó a las 07:00:12,
reportó `Result=success` y `ExecMainStatus=0`. El journal de esa ventana registró
`postgres/dusema-oficina_nitida-20261026T020010-0500-ANQ9JZ.dump.gpg`, SHA-256
`cf123f4ec03da98363597fb75b55d5b947ea006a6996398556c62289f1796f84` y el evento
`complete`. Esto confirma la ejecución programada y la verificación de checksum
durante la carga informada por el script; no confirma acceso actual al objeto,
una descarga independiente ni una restauración.

A las 10:50 UTC, una medición sin listar nombres ni leer contenidos encontró
`/home/ubuntu/la-oficina-nitida/staging/uploads` con propietario `opc:opc`, modo
`0750`, 43.787 bytes y 3 archivos regulares. Docker confirma que la ruta es un
bind mount hacia `/app/uploads`; `findmnt` la ubica en `/dev/sda1` (`ext4`), el
filesystem raíz del VPS. La observación del 25 de octubre que encontró 0 bytes
era una medición anterior y ya no describe el estado actual. No hay evidencia de
que el backup PostgreSQL o una copia recuperable cubran estos archivos.

La CLI no está en el `PATH` de la sesión SSH, pero `/home/ubuntu/bin/oci` existe
y reporta versión 3.95.1; la CLI OCI no está instalada en la estación local
inspeccionada. A las 11:01 UTC se consultó `object head` para el objeto del 26
de octubre usando la identidad instance principal; OCI respondió HTTP 404. Como
no se verificó que esa identidad tenga `OBJECT_INSPECT`, la respuesta no permite
distinguir entre objeto ausente y falta de autorización. No se descargó el
objeto ni se identificó una identidad de lectura ya autorizada.

Una consulta `findmnt` a las 11:01 UTC ubicó `/opt/la-oficina-nitida/postgres/data`,
`/opt/la-oficina-nitida/redis/data` y el directorio de uploads en el mismo
filesystem raíz `/dev/sda1` (`ext4`). Por tanto, si las copias OCI confirmadas
por el propietario corresponden al volumen de arranque que respalda `/`, esas
copias incluyen los tres paths a nivel de bloques; esta cobertura es una
inferencia pendiente de validar con los metadatos del volumen/snapshot y una
restauración aislada. El snapshot también puede incluir configuración sensible,
por lo que requiere control de acceso adecuado.

## Decisiones y verificaciones pendientes

- La comparación SSH de solo lectura del 24 y 25 de octubre encontró que el script y ambas unidades instaladas coinciden por SHA-256 con los tres artefactos de este directorio. Repetir esa comparación antes de reinstalar o cambiar las unidades.
- Conservar fuera de la VPS evidencia sanitizada de las ejecuciones del 23, 24, 25 y 26 de octubre (journal, SHA-256 y resultado), sin incluir secretos.
- El 25 de octubre, `oci os object head` desde la VPS con la identidad instance principal devolvió `Forbidden`; la CLI OCI no está disponible en el equipo local inspeccionado. Este rechazo no demuestra que el objeto no exista. El operador reportó una descarga, verificación SHA-256, descifrado y restauración manual el 23 de octubre, pero no se revisaron independientemente artefactos de esa restauración. Obtener metadatos del objeto con una identidad de lectura ya autorizada y conservar evidencia revisable de la restauración, sin ampliar permisos ni descargar/descifrar todavía.
- Revalidación OCI de solo lectura el 2026-10-25 19:33–19:34 UTC, usando `/home/ubuntu/bin/oci` y la identidad instance principal: `object head` del objeto del 25 de octubre devolvió HTTP 404; `object list` con el prefijo exacto devolvió `BucketNotFound` y especificó que el bucket puede no existir o que el solicitante no está autorizado. Es una respuesta ambigua y no demuestra ausencia del objeto o del bucket. No se descargó ni descifró el artefacto. Para confirmar metadatos, usar una identidad ya autorizada con `OBJECT_INSPECT` limitada al bucket/objeto; la descarga requiere además `OBJECT_READ`.
- Proteger uploads con un mecanismo recuperable independiente y probar su restauración. La medición SSH del 26 de octubre encontró 3 archivos regulares y 43.787 bytes en la ruta; no demuestra cobertura ni recuperación. El backup PostgreSQL no los incluye.
- Revisar la lifecycle policy/versionado y aprobar retención de 30 días antes de cualquier cambio externo.
- Confirmar autenticación y permisos efectivos del rol usado por el dump sin exponer secretos ni crear roles, si se cambia o vuelve a certificar el procedimiento.
- Revalidar herramientas, rutas, OCI CLI y soporte de `--no-overwrite` antes de modificar el proceso.
- Definir un canal de alertas de fallos; ninguno está confirmado.
- Comparar la unidad efectiva del timer con la fuente local antes de afirmar que sus valores `Persistent` y `AccuracySec` coinciden.
- Determinar si Redis contiene estado que requiera respaldo antes de tratarlo como dato recuperable.
