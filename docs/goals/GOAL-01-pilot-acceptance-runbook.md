# GOAL-01 — Guía operativa de onboarding y aceptación del piloto

**Estado:** plantilla preparada; no acredita que una sesión, despliegue o aceptación hayan ocurrido.

Esta guía convierte E7.4 y los criterios del [Goal activo](GOAL-01-primer-cliente-operando.md) en una sesión verificable. Completarla no sustituye la certificación de M1, la recuperación de E7.1, ni el monitoreo y soporte de E7.2.

## Puerta de entrada

No iniciar una sesión con escrituras de cliente hasta que:

- [ ] El propietario haya identificado al cliente y autorizado el piloto y el uso de sus datos.
- [ ] El entorno objetivo y su API/base de datos estén identificados; el aislamiento respecto de otros tenants esté verificado.
- [ ] M1 esté certificado para ese entorno, incluidos HTTPS, migraciones, rollback, R2 privado, correo real y smoke autenticado, según el [checklist de M1](GOAL-01-M1-infrastructure-checklist.md).
- [ ] E7.1 tenga evidencia de restauración de PostgreSQL **y** de archivos subidos.
- [ ] E7.2 tenga responsables, canal de alertamiento y ruta de soporte definidos.
- [ ] El envío de correo esté limitado a buzones de prueba autorizados durante la validación.

Mientras estas condiciones falten, solo se pueden hacer recorridos con datos ficticios en un entorno cuya separación esté demostrada. No escribir en el entorno compartido actual ni usar `staging.dusema.com` mientras su backend o destino Production no estén resueltos.

## Registro de la sesión

Guardar este registro y las referencias en el repositorio operativo aprobado, con acceso restringido. No guardar evidencias con datos personales en Git. No incluir contraseñas, tokens, direcciones personales, documentos, contenido de archivos ni filas de empleados.

| Campo                                          | Valor |
| ---------------------------------------------- | ----- |
| Identificador de sesión                        |       |
| Cliente autorizado / referencia interna        |       |
| Fecha y zona horaria                           |       |
| URL Web y URL API del entorno                  |       |
| Commit Web / deployment ID                     |       |
| Commit API / digest de imagen                  |       |
| Referencia del tenant (sin nombre de personas) |       |
| Responsable operador / referencia del ADMIN    |       |
| Ubicación restringida de evidencias            |       |
| Responsable y canal de soporte confirmados     |       |

## Recorrido del operador

Registrar para cada paso el resultado, una referencia de evidencia sanitizada y cualquier incidencia. No copiar datos de negocio a este archivo.

1. **Acceso y organización:** el ADMIN inicia sesión con su cuenta individual, revisa identidad y sedes, crea o valida una cuenta OPERADOR separada y comprueba que ambos accesos funcionan sin compartir credenciales.
2. **Planta de personal:** el operador crea o importa el conjunto autorizado. Registrar únicamente totales de filas aceptadas y rechazadas y la referencia del reporte de errores restringido. Confirmar que los rechazos son comprensibles y que el operador puede corregirlos.
3. **Contratación:** preparar perfiles y documentos requeridos. En una campaña inteligente, revisar el preview y las exclusiones antes de confirmar; procesar y conciliar los totales. Completar además una contratación individual. Registrar referencias de operación, no nombres ni identificaciones.
4. **Documento:** generar el documento desde cada contrato, comprobar que conserva el snapshot contractual esperado y que el PDF se puede abrir. No adjuntar el PDF como evidencia.
5. **Expediente:** encontrar cada documento en el expediente del empleado correcto, comprobar versión, tamaño no vacío y descarga autorizada. Verificar que un actor sin permiso no puede descargarlo. Subir solamente los documentos incluidos en el alcance acordado para el piloto.
6. **Seguimiento:** comprobar que las alertas automáticas aparecen para el caso aplicable, ejecutar la acción del operador y confirmar que el estado, actor y fecha quedan trazables. No fabricar vencimientos ni cambiar fechas reales solo para forzar una alerta.
7. **Cierre de sesión y soporte:** cerrar las sesiones de prueba, registrar incidencias con referencias sanitizadas y comprobar que el operador conoce el canal y responsable de soporte acordados.

## Matriz de aceptación

Marcar cada fila solo con evidencia revisable. `No evaluado` no equivale a aprobado.

| Criterio del Goal                                                           | Estado (no evaluado / aprobado / rechazado) | Referencia de evidencia | Revisor |
| --------------------------------------------------------------------------- | ------------------------------------------- | ----------------------- | ------- |
| Cliente identificado y autorizado                                           |                                             |                         |         |
| ADMIN y OPERADOR con accesos individuales                                   |                                             |                         |         |
| Planta registrada/importada y errores atendidos                             |                                             |                         |         |
| Contratación individual y campaña inteligente completadas                   |                                             |                         |         |
| Snapshots contractuales y PDFs canónicos comprobados                        |                                             |                         |         |
| Documentos en el expediente correcto y descarga autorizada                  |                                             |                         |         |
| Documentos operativos del piloto acordados y probados                       |                                             |                         |         |
| Alertas automáticas y acción trazable verificadas                           |                                             |                         |         |
| Aislamiento tenant, auditoría y accesos privados verificados                |                                             |                         |         |
| Deployment, migraciones, backup, restauración, monitoreo y soporte probados |                                             |                         |         |
| Browser E2E contra el entorno de producción completado                      |                                             |                         |         |
| Cliente piloto acepta el resultado para operación real                      |                                             |                         |         |
| Código y documentación describen la misma capacidad                         |                                             |                         |         |
| PRs requeridas fusionadas en `main`                                         |                                             |                         |         |

## Detener la sesión

Detener nuevas operaciones y avisar al responsable acordado si el entorno no coincide con el registro, aparece información de otro tenant, falla una descarga o el contenido/tamaño del PDF no coincide, se pierde un archivo, falla una dependencia crítica o se registra información sensible. Conservar solo identificadores de ejecución y evidencia sanitizada. No reparar datos directamente en la base ni borrar archivos para continuar.

## Decisión de aceptación

La aceptación requiere que el operador educativo complete el recorrido, confirme que el resultado sirve para su operación y deje constancia en el canal aprobado. La referencia de aceptación debe mantenerse restringida fuera del repositorio. Registrar aquí solo su identificador:

- Referencia de aceptación:
- Fecha:
- Decisión: `pendiente / aceptado / rechazado`
- Bloqueos o acciones siguientes:

No marcar E7.4, M7 ni GOAL-01 completos hasta que la evidencia requerida por el Goal exista y se haya revisado.
