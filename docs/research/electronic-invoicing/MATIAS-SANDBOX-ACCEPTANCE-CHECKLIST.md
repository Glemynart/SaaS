# Validación contractual de MATIAS Sandbox

**Estado:** preparación documental; ninguna llamada al sandbox se ha ejecutado.
**Consultado:** 2026-11-05. La documentación oficial mostraba MATIAS API v3.9.2.
**Alcance:** futura prueba de contrato para factura electrónica sintética. No
acredita transmisión a DIAN, aceptación normativa ni compatibilidad productiva.

## Hechos publicados por el proveedor

- El sandbox usa una cuenta independiente y el host
  `https://sandbox-api.matias-api.com/api/ubl2.1`. La cuenta requiere verificar
  su correo. El token persistente se crea después del login; MATIAS advierte que
  el PAT se muestra una sola vez.
- La emisión unitaria se hace con `POST /invoice`. La documentación recomienda
  enviar un `uuid` propio y estable: reintentar el mismo número con el mismo
  `uuid` no crea otro documento; reutilizar ese `uuid` para otro documento
  produce conflicto. El documento se puede consultar por `GET /documents/{uuid}`.
- Un HTTP exitoso no basta para clasificar la factura: se deben interpretar
  `response.IsValid` y `response.StatusCode`. La documentación describe
  `DOCUMENT_POSSIBLY_SENT` para resultados ambiguos y exige consultar el estado
  antes de retransmitir. También describe `StatusCode 98` como procesamiento
  transitorio, no como rechazo.
- `X-Sandbox-Force-Status` puede simular rechazo (`ERROR_REJECTED`) y timeout
  (`ERROR_TIMEOUT`). Las respuestas sandbox incluyen
  `X-MATIAS-Environment: sandbox`. El proveedor declara que las respuestas
  DIAN son simuladas y que el sandbox no transmite documentos fiscales reales.

Fuentes oficiales consultadas:

- [Quickstart oficial de MATIAS Sandbox](https://docs.matias-api.com/docs/sandbox/quickstart/)
- [Campos y UUID de documentos](https://docs.matias-api.com/docs/billing-fields/)
- [Respuestas, conflictos y envíos ambiguos](https://docs.matias-api.com/docs/response-json/)

## Matriz de aceptación pendiente

| Caso                      | Preparación                                                                         | Resultado que debe verificarse                                                                                                                   |
| ------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Guard de entorno          | Configurar exclusivamente el host sandbox                                           | La solicitud no puede dirigirse a producción; exigir la cabecera de respuesta `X-MATIAS-Environment: sandbox` antes de aceptar la prueba.        |
| Autenticación             | Cuenta sandbox con correo verificado y PAT vigente, inyectado fuera del repositorio | El PAT nunca aparece en código, logs, errores ni artefactos de CI.                                                                               |
| Emisión aceptada simulada | Payload sintético válido y `uuid` estable                                           | El adaptador traduce el resultado usando los campos de estado DIAN publicados por el proveedor; conserva referencia y evidencia saneada.         |
| Rechazo simulado          | Repetir con `X-Sandbox-Force-Status: ERROR_REJECTED`                                | Se registra rechazo normalizado y sus códigos permitidos, sin marcar la factura como aceptada ni contabilizar otra vez.                          |
| Timeout ambiguo           | Ejecutar `ERROR_TIMEOUT`                                                            | No hay retransmisión automática. Se consulta por el mismo `uuid`/estado y se registra el resultado como pendiente o desconocido hasta conciliar. |
| Reintento idempotente     | Reenviar el mismo número y `uuid`                                                   | Se confirma la conducta publicada y no se crea una identidad de evento distinta en la plataforma.                                                |
| Colisión de UUID          | Usar el mismo `uuid` para otro documento sintético                                  | El conflicto se traduce sin sobrescribir el intento ni la evidencia originales.                                                                  |
| Evidencia y privacidad    | Recuperar respuesta y archivos de prueba                                            | XML/PDF/respuestas se conservan como evidencia privada tenant-scoped; tokens y datos sensibles se excluyen de los logs.                          |

Al guardar evidencia de ejecución, registrar fecha, versión de documentación,
versión del adaptador, host efectivo, status HTTP, resultado normalizado,
referencias y hashes. Eliminar cabeceras de autorización y cualquier secreto.
Usar únicamente una empresa y documentos sintéticos del sandbox.

## Límites y siguiente paso

- La prueba sigue pendiente: no hay resultado de cuenta sandbox, autenticación
  ni request/response obtenido por este repositorio.
- El `uuid` documentado mejora la estrategia de reintento del proveedor, pero
  no reemplaza la conciliación interna exigida por ADR-020 ni autoriza repetir
  una emisión ambigua a ciegas.
- No escribir ni habilitar el adaptador MATIAS real hasta completar esta matriz
  contra el sandbox. La resolución tenant-scoped de credenciales y la
  observabilidad del worker también siguen pendientes en ADR-020.
- La validación sandbox solo comprobará el contrato publicado por MATIAS. No
  equivale a aceptación de DIAN ni a validación de producción.
