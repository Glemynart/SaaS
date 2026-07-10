import { redirect } from 'next/navigation';

/**
 * Alias de compatibilidad: el correo de recuperación del backend (7A) enlaza a
 * `/reset-password?token=…`, pero la ruta canónica de la experiencia es
 * `/restablecer` (AUTH-EXPERIENCE §2.1). Redirige preservando el token, sin
 * tocar el backend.
 */
export default async function ResetPasswordAliasPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  redirect(token ? `/restablecer?token=${encodeURIComponent(token)}` : '/restablecer');
}
