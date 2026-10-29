# ADR-010 — Validación previa de tokens de recuperación

| Campo           | Valor                                                                                                            |
| --------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Estado**      | Propuesto; requiere aprobación de Producto, Arquitectura y Seguridad                                             |
| **Fecha**       | 2026-10-29                                                                                                       |
| **Ámbito**      | GOAL-01 · M2 · E2.3 · recuperación de contraseña                                                                 |
| **Relacionado** | [GOAL-01](../goals/GOAL-01-primer-cliente-operando.md), [AUTH-EXPERIENCE](../design/AUTH-EXPERIENCE.md), PR #129 |

## Contexto

La especificación de autenticación establece dos condiciones simultáneas:

- el enlace inválido, vencido o usado debe mostrar el estado terminal antes de
  que la persona complete el formulario (§7.3);
- la recuperación consume las rutas existentes y no agrega endpoints (hallazgo
  H3 y §10).

El código no puede cumplir ambas condiciones. `ResetForm` conoce si hay un token,
pero solo recibe la respuesta de validez después de enviar la contraseña a
`POST /auth/reset-password`. Ese endpoint compara el secreto, reclama el token
de forma atómica, cambia la contraseña y revoca las sesiones. No es seguro
usarlo como una consulta previa. PR #129 traslada los tokens a fragmentos URL,
pero no cambia esta limitación de validación.

Por tanto, E2.3 no puede satisfacer el estado de enlace especificado sin elegir
entre cambiar la experiencia aceptada o ampliar el contrato del API.

## Decisión requerida

Elegir una de estas alternativas antes de implementar E2.3:

### Opción A — Conservar el API existente

Actualizar AUTH-EXPERIENCE para permitir que se muestre el formulario antes de
validar el token. El API comprobará el token al recibir la nueva contraseña; si
no es válido, la pantalla pasará al estado terminal después del envío.

Esta opción no agrega superficie de API, pero permite que una persona complete
el formulario antes de saber que el enlace expiró o ya fue usado.

### Opción B — Agregar validación de solo lectura (recomendada)

Agregar `POST /auth/validate-reset-token`, que reciba el token en el cuerpo y
devuelva únicamente `{ "valid": boolean }`. El endpoint comprobará que el
secreto corresponde al token no usado y aún vigente, sin cambiar contraseñas,
consumir el token, devolver datos de usuario ni incluir el token en una URL.
La pantalla mostrará el formulario solo después de una respuesta válida.

La ruta final `POST /auth/reset-password` repetirá la validación y reclamará el
token atómicamente. Si vence o se consume entre ambas solicitudes, el endpoint
final rechazará el envío y la UI mostrará el estado terminal.

Controles requeridos para esta opción:

- limitar intentos de validación;
- no registrar el token ni cuerpos de solicitud que lo contengan;
- responder de forma uniforme, sin revelar correo, usuario o tenant;
- mantener el token en el fragmento del navegador y transmitirlo solo en el
  cuerpo HTTPS;
- cubrir tokens malformados, secretos incorrectos, expirados, usados y válidos.

## Recomendación

Se recomienda la opción B porque conserva la experiencia aprobada en §7.3 y
permite que la persona sepa que el enlace funciona antes de invertir esfuerzo en
el formulario. Esta decisión modifica la regla actual de “cero endpoints
nuevos”; la nueva ruta deberá quedar explícitamente documentada si se aprueba.

## Consecuencias y alcance posterior

Hasta que se apruebe una alternativa, no se implementará un endpoint ni se
cambiará la experiencia existente. Una vez aprobada la opción B, su Epic deberá
incluir el servicio de validación, el endpoint y su limitación de intentos, la
ruta BFF, la validación previa en la UI, las pruebas API y browser, y la
actualización de AUTH-EXPERIENCE. La aceptación en staging seguirá requiriendo
entrega y recepción reales del correo de recuperación.

Si se aprueba la opción A, se actualizará la especificación antes de cerrar
E2.3 para que refleje explícitamente la validación posterior al envío.
