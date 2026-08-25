# Checklist operativo para desbloquear M1 de GOAL-01

Este checklist contiene únicamente tareas operativas que deben realizarse fuera
del código. No implementa funcionalidades, no requiere una rama y no debe
convertirse en un PR de producto.

Estado esperado mientras esté incompleto:

- GOAL-01: `ACTIVO`; la implementación de M1 está bloqueada selectivamente y la
  arquitectura/preparación continúa disponible.
- M1: `BLOQUEADO POR INFRAESTRUCTURA EXTERNA`.

## 1. Dominio y DNS

- [ ] Comprar o confirmar la titularidad del dominio que se usará para staging y producción.
- [ ] Confirmar acceso administrativo al registrador y registrar quién será responsable de la cuenta.
- [ ] Configurar en el registrador los nameservers de Cloudflare.
- [ ] Confirmar que la zona del dominio aparece activa en Cloudflare.
- [ ] Definir los hostnames de staging para web y API, y documentarlos sin incluir secretos.
- [ ] Crear los registros DNS necesarios para web, API, verificación de correo y cualquier servicio operativo.
- [ ] Esperar propagación y validar que los registros resuelven desde redes externas.
- [ ] Confirmar que no existen registros antiguos, comodines o redirecciones que envíen tráfico al entorno equivocado.

## 2. Cloudflare y certificados

- [ ] Configurar en Cloudflare los registros de staging con el modo de proxy definido para cada servicio.
- [ ] Mantener sin proxy los servicios que no deban exponerse mediante el proxy HTTP de Cloudflare.
- [ ] Configurar SSL/TLS en modo `Full (strict)` cuando el certificado del origen esté instalado.
- [ ] Emitir o instalar el certificado válido del origen para los hostnames de staging.
- [ ] Verificar la cadena de certificados, la renovación automática y la fecha de expiración.
- [ ] Confirmar que HTTP redirige a HTTPS y que no quedan endpoints operativos accesibles sólo por HTTP.
- [ ] Validar desde una red externa el hostname web y el hostname API mediante HTTPS.

## 3. Cloudflare R2

- [ ] Crear el bucket de R2 para staging y separar los datos de producción en otro bucket o cuenta según la política operativa.
- [ ] Crear credenciales de acceso con mínimo privilegio y alcance sólo al bucket correspondiente.
- [ ] Registrar de forma segura el endpoint S3-compatible, el bucket y el identificador de cuenta; no registrar valores secretos en documentos.
- [ ] Definir el bucket como privado para documentos de tenants.
- [ ] Revisar CORS y cualquier URL pública para que no permita acceso anónimo a documentos privados.
- [ ] Probar operativamente subida, lectura autorizada, existencia y eliminación de un objeto de prueba.
- [ ] Confirmar que un tenant no puede leer objetos de otro tenant usando las rutas y credenciales del entorno desplegado.
- [ ] Definir retención, versionado, respaldo y procedimiento de recuperación según la política de operación.

## 4. OCI Email Delivery

- [ ] Crear o habilitar el servicio de OCI Email Delivery en la cuenta y región operativa.
- [ ] Registrar y verificar el dominio o sender aprobado para el envío.
- [ ] Publicar y validar el registro SPF indicado por OCI.
- [ ] Publicar y validar los registros DKIM indicados por OCI.
- [ ] Publicar un registro DMARC con una política inicial aprobada y una dirección de informes controlada.
- [ ] Crear credenciales de envío con mínimo privilegio y almacenarlas únicamente en el gestor de secretos.
- [ ] Definir el remitente, nombre visible y dirección de respuesta que usará el entorno.
- [ ] Confirmar límites, región, cuotas, rebotes, quejas y procedimiento de rotación de credenciales.
- [ ] Enviar un mensaje de prueba a un buzón externo y comprobar entrega, SPF, DKIM y DMARC.
- [ ] Verificar el recorrido de invitación y recuperación de acceso cuando el entorno de staging esté disponible.

> El código actual utiliza Nodemailer con OCI SMTP mediante `EMAIL_SMTP_HOST`,
> `EMAIL_SMTP_PORT`, `EMAIL_SMTP_USER`, `EMAIL_SMTP_PASSWORD`,
> `EMAIL_SMTP_SECURE`, `EMAIL_SMTP_REQUIRE_TLS`, `EMAIL_FROM`,
> `EMAIL_FROM_NAME` y `REQUIRE_REAL_EMAIL`. No se deben inventar ni copiar
> credenciales en este checklist.

## 5. Secretos y variables de entorno

- [ ] Crear un conjunto separado de secretos y variables para staging; no reutilizar valores de producción.
- [ ] Configurar `NODE_ENV` con el modo de ejecución del entorno.
- [ ] Configurar `DATABASE_URL` con una base de staging y un rol runtime no privilegiado, sin superusuario ni `BYPASSRLS`.
- [ ] Mantener separada y protegida cualquier credencial de migración (`DATABASE_URL_MIGRATION`) y usarla sólo durante el despliegue de migraciones.
- [ ] Generar y almacenar un `JWT_SECRET` largo, aleatorio y exclusivo del entorno.
- [ ] Configurar `JWT_ACCESS_EXPIRES_IN` y `JWT_REFRESH_EXPIRES_IN` según la política aprobada.
- [ ] Configurar `PORT`, `FRONTEND_URL`, `BACKEND_URL` y `ALLOWED_ORIGINS` con los hostnames HTTPS reales.
- [ ] Configurar `API_URL`, `NEXT_PUBLIC_API_URL` y `NEXT_PUBLIC_SITE_URL` con los hostnames correctos; confirmar que ninguna variable pública contiene secretos.
- [ ] Configurar `STORAGE_PROVIDER` y, si corresponde, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` y `R2_BUCKET`.
- [ ] Configurar las credenciales SMTP OCI y el remitente que requiere el adaptador desplegado: `EMAIL_SMTP_HOST`, `EMAIL_SMTP_PORT`, `EMAIL_SMTP_USER`, `EMAIL_SMTP_PASSWORD`, `EMAIL_SMTP_SECURE`, `EMAIL_SMTP_REQUIRE_TLS`, `EMAIL_FROM`, `EMAIL_FROM_NAME` y `REQUIRE_REAL_EMAIL`.
- [ ] Configurar `REDIS_URL` sólo si el entorno lo requiere y validar que apunta al servicio de staging correcto.
- [ ] Configurar `MATIAS_API_URL` y `MATIAS_API_KEY` únicamente si una capacidad del entorno las utiliza.
- [ ] Guardar secretos en el gestor de secretos de la plataforma; no incluir valores en GitHub, imágenes, logs, capturas o tickets.
- [ ] Confirmar rotación, responsables y fecha de expiración de cada secreto.

## 6. Entorno de staging

- [ ] Provisionar el runtime de staging para API y Web en la plataforma operativa elegida.
- [ ] Provisionar una base PostgreSQL de staging y validar conectividad privada o restringida.
- [ ] Configurar el despliegue desde `main` con una fuente reproducible y un mecanismo de rollback.
- [ ] Ejecutar las migraciones con la credencial de migración y comprobar que la aplicación usa después el rol runtime no privilegiado.
- [ ] Ejecutar el seed sólo con el procedimiento aprobado para staging y verificar que es idempotente.
- [ ] Configurar las variables y secretos del apartado anterior en los servicios correctos.
- [ ] Configurar los hostnames, certificados y reglas de red para API y Web.
- [ ] Habilitar logs, métricas y alertas operativas sin registrar contraseñas, tokens, secretos ni URLs sensibles.
- [ ] Confirmar que el despliegue puede repetirse desde cero y que existe un procedimiento de rollback probado.
- [ ] Registrar la URL HTTPS de staging, el commit desplegado, la fecha y el identificador de ejecución.

## 7. Validaciones operativas y evidencia

- [ ] Comprobar `GET /health` con respuesta exitosa desde la URL pública de staging.
- [ ] Comprobar `GET /readiness` con respuesta exitosa y dependencias operativas disponibles.
- [ ] Completar registro, inicio de sesión, renovación de sesión y cierre de sesión con un usuario de prueba.
- [ ] Verificar aislamiento tenant con dos tenants y usuarios de prueba independientes.
- [ ] Verificar subida, lectura autorizada y eliminación de un documento de prueba en R2.
- [ ] Verificar que un documento privado no es accesible sin autenticación ni autorización.
- [ ] Verificar envío y recepción de un correo real desde el entorno, incluyendo una invitación o recuperación de acceso cuando aplique.
- [ ] Ejecutar el browser smoke contra la URL desplegada, no contra localhost.
- [ ] Comprobar migración desde una base limpia y una redeploy sin pérdida de datos de prueba.
- [ ] Probar rollback y recuperación del servicio según el procedimiento operativo.
- [ ] Revisar logs y confirmar que no exponen secretos, tokens, contraseñas, contenido privado o datos de otro tenant.
- [ ] Guardar evidencia reproducible: URL, commit, fecha/hora, identificadores de ejecución, resultados de health/readiness, pruebas browser y capturas/logs sanitizados.

## Criterio para solicitar el desbloqueo de M1

M1 puede pasar de `BLOQUEADO POR INFRAESTRUCTURA EXTERNA` a validación operativa
únicamente cuando exista evidencia de todos estos puntos:

- staging accesible por HTTPS con DNS y certificado válidos;
- despliegue reproducible desde `main`, migraciones y rollback verificados;
- variables y secretos configurados de forma separada y segura;
- R2 operativo con acceso privado y pruebas de autorización satisfactorias;
- OCI Email Delivery verificado y con entrega real satisfactoria;
- `/health` y `/readiness` exitosos;
- smoke autenticado y Browser E2E ejecutados contra staging;
- evidencia operativa conservada sin valores secretos.

Hasta entonces permanecen detenidas únicamente las rutas que dependan de esta
infraestructura. El estado de GOAL-01 sigue siendo `ACTIVO`: las rutas
independientes y el trabajo de arquitectura, planificación, investigación o
preparación se evalúan mediante el grafo de dependencias del Goal.
