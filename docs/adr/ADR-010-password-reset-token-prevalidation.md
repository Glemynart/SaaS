# ADR-010 — Validación previa de tokens de recuperación

| Campo           | Valor                                                                                                            |
| --------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Estado**      | Aceptado                                                                                                         |
| **Fecha**       | 2026-10-29                                                                                                       |
| **Ámbito**      | GOAL-01 · M2 · E2.3 · recuperación de contraseña                                                                 |
| **Relacionado** | [GOAL-01](../goals/GOAL-01-primer-cliente-operando.md), [AUTH-EXPERIENCE](../design/AUTH-EXPERIENCE.md), PR #129 |

## Contexto

La especificación de autenticación establece dos condiciones simultáneas:

- el enlace inválido, vencido o usado debe mostrar el estado terminal antes de
  que la persona complete el formulario (§7.3);
- la recuperación consumía las rutas existentes y no tenía un endpoint de
  prevalidación (hallazgo H3 y §9.5).

El código no puede cumplir ambas condiciones. `ResetForm` conoce si hay un token,
pero solo recibe la respuesta de validez después de enviar la contraseña a
`POST /auth/reset-password`. Ese endpoint compara el secreto, reclama el token
de forma atómica, cambia la contraseña y revoca las sesiones. No es seguro
usarlo como una consulta previa. PR #129 traslada los tokens a fragmentos URL,
pero no cambia esta limitación de validación.

Por tanto, E2.3 no podía satisfacer el estado de enlace especificado sin elegir
entre cambiar la experiencia aceptada o ampliar el contrato del API.

## Decisión

Se acepta la opción B: agregar `POST /auth/validate-reset-token` como consulta
de solo lectura. Recibe `{ "token": string }` en el cuerpo y devuelve solo
`{ "valid": boolean }`. Tokens malformados, inexistentes, usados, vencidos o
con secreto incorrecto producen la misma respuesta `{ "valid": false }`.

La comprobación busca el registro por el identificador aleatorio del token,
comprueba su vigencia y uso, y compara el secreto con el hash almacenado. No
escribe en la base de datos, no consume el token y no devuelve identidad, correo,
empresa ni estado interno. El endpoint usa un límite de cinco solicitudes por
IP cada quince minutos y un límite de 256 caracteres para la entrada.

La UI enviará el token desde el fragmento del navegador al BFF en el cuerpo de
una solicitud POST sin caché. La API registra la ruta fija y metadatos HTTP, no
el cuerpo. El formulario aparece únicamente tras `{ "valid": true }`. Un error
transitorio muestra una salida de reintento y no revela mensajes crudos.

`POST /auth/reset-password` conserva su validación final y reclamación atómica.
Si el token vence o se consume después de la consulta previa, el reset final lo
rechaza y la UI presenta el estado terminal.

## Alternativa descartada

La opción A cambiaba la experiencia para permitir llenar el formulario antes de
validar el enlace. Se descarta porque contradice el requisito vigente de §7.3 y
traslada el costo de enlaces expirados o usados a la persona usuaria.

## Consecuencias y riesgos

- Se añade una ruta pública de solo lectura, con validación de entrada y
  limitación de intentos; no requiere migración de datos ni modifica el modelo
  de tokens.
- La vigencia puede cambiar entre validación y envío; el endpoint de reset
  mantiene la autoridad final y la reclamación transaccional.
- La limitación se basa en la IP observada por el API. La configuración de
  proxies confiables debe revisarse antes del despliegue para evitar agrupar a
  muchos clientes bajo una sola dirección.
- No se reenviarán enlaces antiguos con token en query. Los nuevos enlaces usan
  fragmento; la UI migra enlaces legados en el navegador y solo transmite el
  token en el cuerpo.
- La reversión debe retirar conjuntamente la ruta, su BFF y la validación previa
  de la UI; la experiencia documentada debe volver a alinearse en el mismo
  cambio. La aceptación operativa de E2.3 aún exige correo real y validación en
  staging.
