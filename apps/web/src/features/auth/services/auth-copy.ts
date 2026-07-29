/**
 * Diccionario único de la superficie de entrada (AUTH-EXPERIENCE.md §10).
 * La interfaz nunca imprime mensajes crudos del backend: todo error
 * pasa por el mapeo de §9.2 con fallback genérico.
 */
export const authCopy = {
  loginTitle: 'Entra a tu oficina',
  loginDescription: 'Accede con el NIT de la empresa y tu correo.',
  loginAction: 'Entrar',
  loginToRegisterPrompt: '¿Aún no tienes empresa?',
  loginToRegisterAction: 'Crear cuenta',
  loginRegisteredNotice: 'Tu empresa quedó registrada. Inicia sesión para entrar a tu oficina.',
  loginResetNotice: 'Tu contraseña se actualizó. Inicia sesión con la nueva contraseña.',
  loginForgotPassword: '¿Olvidaste tu contraseña?',

  recoverTitle: 'Recupera tu acceso',
  recoverDescription: 'Te enviaremos un enlace a tu correo para definir una contraseña nueva.',
  recoverAction: 'Enviar enlace de recuperación',
  recoverBackToLogin: 'Volver a iniciar sesión',
  recoverConfirmTitle: 'Revisa tu correo',
  recoverRetry: '¿Datos incorrectos? Intentar de nuevo',

  resetTitle: 'Define tu nueva contraseña',
  resetNotice: 'Por seguridad, se cerrarán las sesiones abiertas en otros dispositivos.',
  resetAction: 'Guardar y continuar',
  resetBackToLogin: 'Volver a iniciar sesión',

  linkExpiredTitle: 'Este enlace ya no es válido',
  linkExpiredBody: 'Los enlaces vencen después de 1 hora o al usarse una vez.',
  linkExpiredAction: 'Solicitar un enlace nuevo',

  registerTitle: 'Registra tu empresa',
  registerDescription: 'Crea el espacio de tu empresa y la cuenta del administrador.',
  registerGroupCompany: 'Tu empresa',
  registerGroupAdmin: 'La cuenta del administrador',
  registerAction: 'Crear empresa',
  registerToLoginPrompt: '¿Ya tienes cuenta?',
  registerToLoginAction: 'Iniciar sesión',

  nitHint: 'El NIT con el que se registró la empresa, sin dígito de verificación.',
  registerNitHint: 'Sin puntos ni dígito de verificación.',
  registerDigitHint: 'El dígito de verificación que acompaña al NIT (aparece en el RUT).',
  registerCommercialNameHint:
    'Como se conoce a tu organización. Así aparecerá dentro de la plataforma.',
  registerLegalNameHint:
    'El nombre legal exacto, como aparece en el RUT. Se usará en tus documentos.',
  registerEmailHint: 'A este correo llegarán los enlaces de recuperación de la cuenta.',
  passwordHint: 'Mínimo 8 caracteres.',
};

/** Mensajes normativos de error en pantalla (AUTH-EXPERIENCE.md §9.2). */
export const authErrors = {
  invalidCredentials:
    'Los datos no coinciden con una cuenta activa. Revisa el NIT, el correo y la contraseña.',
  tooManyAttempts: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
  network: 'No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.',
  service: 'El servicio no está disponible en este momento. Inténtalo de nuevo en unos minutos.',
  nitTaken: 'Ya existe una empresa registrada con este NIT.',
};

/**
 * Mapeo backend → interfaz (§9.2). Los fallos de autenticación siempre caen
 * al mismo mensaje para no revelar el estado de empresa o usuario.
 * Nunca se retorna el texto crudo de la excepción.
 */
export function mapLoginError(error: unknown): string {
  if (error instanceof TypeError) {
    // fetch falló antes de llegar al servidor (sin conexión / DNS)
    return authErrors.network;
  }

  const raw = error instanceof Error ? error.message : '';

  if (/too many requests|throttler/i.test(raw)) return authErrors.tooManyAttempts;
  if (/problema inesperado|internal server|no se pudo completar/i.test(raw)) {
    return authErrors.service;
  }

  return authErrors.invalidCredentials;
}

/** Mapeo de errores del registro (§6.3): NIT duplicado con salida doble. */
export function mapRegisterError(error: unknown): { message: string; nitTaken: boolean } {
  if (error instanceof TypeError) {
    return { message: authErrors.network, nitTaken: false };
  }

  const raw = error instanceof Error ? error.message : '';

  if (/nit/i.test(raw) && /(registrad|exist|duplicad|uso)/i.test(raw)) {
    return { message: authErrors.nitTaken, nitTaken: true };
  }
  if (/too many requests|throttler/i.test(raw)) {
    return { message: authErrors.tooManyAttempts, nitTaken: false };
  }
  return { message: authErrors.service, nitTaken: false };
}

/**
 * Confirmación genérica de recuperación (AX-D7). Idéntica exista o no la cuenta;
 * nunca afirma que el correo salió — solo "si los datos corresponden" (§9.3).
 */
export function recoverConfirmationBody(email: string): string {
  return `Si los datos corresponden a una cuenta activa, enviamos un enlace a ${email}. El enlace vence en 1 hora y solo puede usarse una vez. Si no lo encuentras, revisa la carpeta de spam.`;
}

/** Mapeo de errores de recuperación (§7.0/§7.7): sin estado "cuenta no encontrada". */
export function mapForgotError(error: unknown): string {
  if (error instanceof TypeError) return authErrors.network;
  const raw = error instanceof Error ? error.message : '';
  if (/too many requests|throttler/i.test(raw)) return authErrors.tooManyAttempts;
  return authErrors.service;
}

/**
 * Mapeo de errores de restablecimiento (§7.3/§7.7). `invalidToken` conmuta a la
 * pantalla terminal de enlace vencido; el resto son avisos inline del formulario.
 */
export function mapResetError(error: unknown): { message: string; invalidToken: boolean } {
  if (error instanceof TypeError) {
    return { message: authErrors.network, invalidToken: false };
  }
  const raw = error instanceof Error ? error.message : '';
  if (/too many requests|throttler/i.test(raw)) {
    return { message: authErrors.tooManyAttempts, invalidToken: false };
  }
  if (/inválid|invalid|expirad|token/i.test(raw)) {
    return { message: '', invalidToken: true };
  }
  return { message: authErrors.service, invalidToken: false };
}
