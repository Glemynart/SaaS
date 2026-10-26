# GOAL-01 — Guía operativa de monitoreo, alertamiento y soporte

**Estado:** plantilla de preparación. No demuestra que haya un monitor, una alerta o un equipo de soporte operando.

Esta guía prepara E7.2 sin elegir ni configurar un proveedor. Completarla requiere verificar el entorno publicado y probar el canal con un evento controlado. No sustituye la certificación de M1 ni la recuperación de E7.1.

## Puerta de entrada

Antes de activar monitoreo del piloto:

- [ ] Identificar el entorno, sus URLs, commit Web, deployment ID, revisión API y digest de imagen.
- [ ] Verificar que el entorno y su base están aislados de otros clientes.
- [ ] Confirmar quién puede consultar métricas y logs y durante cuánto tiempo se retienen.
- [ ] Definir responsable primario, respaldo, horario de atención, canal de alerta y ruta de escalamiento.
- [ ] Seleccionar el proveedor y la ubicación de configuración de monitores, sin guardar credenciales en este repositorio.
- [ ] Acordar umbrales y ventanas de evaluación para cada señal.
- [ ] Confirmar que los eventos y reportes no contienen secretos, tokens, documentos, datos personales ni URLs con parámetros sensibles.

Mientras falte aislamiento confirmado, no ejecutar sondas funcionales ni pruebas con escritura contra el entorno compartido.

## Señales disponibles en el código

Estas son capacidades implementadas; no prueban que exista un monitor externo.

| Señal               | Comportamiento comprobable en el código                                                                                     | Límite                                                                                                                                                                        |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /health`       | `HealthService.getLiveness()` devuelve `status: ok` y `service: api`.                                                       | Solo indica que la API responde; no comprueba dependencias.                                                                                                                   |
| `GET /readiness`    | Reporta estados de base de datos, storage y correo. Devuelve HTTP 503 si una dependencia requerida no está disponible.      | El chequeo de storage no certifica autorización entre tenants ni un flujo completo de carga/descarga. El correo afecta readiness solo cuando está configurado como requerido. |
| Logs `HTTP_REQUEST` | Incluyen ID de solicitud, método, ruta plantilla, código HTTP y duración. 5xx se registra como error; 4xx como advertencia. | Son logs de solicitudes, no métricas agregadas ni alertas. No exponen cuerpos ni URLs completas en este middleware.                                                           |
| Alertas de dominio  | E6.1–E6.3 generan, presentan y permiten resolver alertas laborales con trazabilidad.                                        | Son trabajo operativo del tenant; no sustituyen alertas técnicas de disponibilidad o infraestructura.                                                                         |

## Matriz que debe completar el operador

Registrar el valor aprobado y una referencia a la configuración; no copiar secretos.

| Señal o evento                      | Fuente                                                 | Umbral/ventana aprobados          | Destinatario | Prueba controlada               | Evidencia |
| ----------------------------------- | ------------------------------------------------------ | --------------------------------- | ------------ | ------------------------------- | --------- |
| API no responde                     | Probe externo a `/health`                              |                                   |              |                                 |           |
| API no está lista                   | Probe externo a `/readiness`                           |                                   |              |                                 |           |
| Aumento de respuestas 5xx           | Logs o métricas HTTP del proveedor elegido             |                                   |              |                                 |           |
| Fallo del job de backup             | Scheduler y resultado del servicio realmente instalado |                                   |              |                                 |           |
| Capacidad de disco/host crítica     | Métricas del proveedor de infraestructura elegido      |                                   |              |                                 |           |
| Incidente de seguridad o integridad | Canal de soporte restringido                           | Inmediato según política aprobada |              | Simulación sin datos de cliente |           |

No rellenar una fila a partir de una prueba local o de que un endpoint responda manualmente. Registrar fecha, entorno y responsable que revisó cada evidencia.

## Atención de incidentes

### Prioridad inicial propuesta

La clasificación siguiente es operativa y debe ser confirmada por el propietario antes del piloto. Los tiempos de respuesta y disponibilidad comprometidos requieren decisión comercial.

- **Crítica:** indicio de acceso entre tenants, pérdida o corrupción de datos, exposición de secretos o documentos, o fallo de recuperación. Detener nuevas escrituras funcionales, conservar referencias de ejecución sanitizadas y escalar al responsable técnico y al propietario.
- **Alta:** `/readiness` permanece no disponible, fallan autenticación o descargas del flujo principal, o se acumulan errores 5xx. Confirmar alcance, commit/digest y hora; escalar al responsable técnico.
- **Normal:** problema acotado sin riesgo de datos ni interrupción del flujo principal. Registrar incidencia, pasos de reproducción sin PII y responsable de seguimiento.

No reiniciar servicios, revertir imágenes, ejecutar migraciones ni restaurar datos como parte de la clasificación. Esas acciones deben seguir el procedimiento autorizado de despliegue/rollback o recuperación del entorno.

### Registro mínimo de un incidente

Guardar en el canal aprobado y con acceso restringido:

- identificador y hora UTC;
- entorno y revisión desplegada;
- señal que disparó la alerta y referencia de ejecución;
- request ID, cuando aplique;
- impacto agregado y tenants afectados expresados por referencias internas no personales;
- responsable que recibió y reconoció la alerta;
- acciones tomadas y resultado;
- decisión de cierre y evidencia revisada.

No adjuntar dumps, documentos, tokens, contraseñas, direcciones personales ni capturas con datos de empleados. Para soporte funcional, solicitar un identificador de operación sanitizado y evitar pedir al cliente que envíe credenciales.

## Validación del alertamiento

Cuando exista un entorno aislado y un canal autorizado:

1. Registrar configuración, umbrales, destinatarios y responsables sin exponer valores sensibles.
2. Generar una condición controlada en ese entorno usando el procedimiento del proveedor; no degradar producción ni la base compartida.
3. Confirmar que el evento llega al canal previsto, identifica entorno y señal, y no incluye datos sensibles.
4. Confirmar reconocimiento por el responsable y el mecanismo de escalamiento.
5. Restablecer la condición mediante el procedimiento autorizado y confirmar que la alerta se resuelve o se marca recuperada.
6. Guardar referencias sanitizadas de la configuración, evento, recepción, reconocimiento y recuperación.

Una respuesta HTTP 200 aislada, un log local o un check de CI no satisfacen esta prueba.

## Criterios de aceptación de E7.2

- [ ] Hay monitores activos para disponibilidad, readiness y señales operativas acordadas.
- [ ] Se verificó mediante evento controlado que cada alerta llega al responsable y puede reconocerse y escalarse.
- [ ] Existe responsable primario y respaldo, horario de soporte y canal acordados.
- [ ] Las consultas y retención de logs están restringidas y revisadas para evitar datos sensibles.
- [ ] Los fallos del mecanismo de backup generan una alerta, además de tener una restauración probada conforme a E7.1.
- [ ] El procedimiento de incidente fue recorrido y la evidencia queda en una ubicación restringida.
- [ ] Las acciones de contención y rollback remiten a procedimientos autorizados y verificados.

No marcar E7.2 ni M7 completos hasta revisar evidencia operativa de todos los criterios aplicables en el entorno del piloto.
