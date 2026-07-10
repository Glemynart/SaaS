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
  userDisabled:
    'Tu cuenta está deshabilitada. Contacta al administrador de tu empresa para reactivarla.',
  tenantSuspended: 'El acceso de esta empresa está suspendido. Escribe a soporte para reactivarlo.',
  tooManyAttempts: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
  network: 'No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.',
  service: 'El servicio no está disponible en este momento. Inténtalo de nuevo en unos minutos.',
  nitTaken: 'Ya existe una empresa registrada con este NIT.',
};

/**
 * Mapeo backend → interfaz (§9.2). Se detecta por el contenido del mensaje
 * que emite el backend actual; cualquier caso no reconocido cae al genérico.
 * Nunca se retorna el texto crudo de la excepción.
 */
export function mapLoginError(error: unknown): string {
  if (error instanceof TypeError) {
    // fetch falló antes de llegar al servidor (sin conexión / DNS)
    return authErrors.network;
  }

  const raw = error instanceof Error ? error.message : '';

  if (/usuario está inactivo/i.test(raw)) return authErrors.userDisabled;
  if (/empresa está inactiva/i.test(raw)) return authErrors.tenantSuspended;
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
