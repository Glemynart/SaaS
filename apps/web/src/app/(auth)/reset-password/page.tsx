import { ResetForm } from '@/features/auth/components/reset-form';

/**
 * Alias de compatibilidad para enlaces de recuperación anteriores.
 * ResetForm migra el token de query a fragmento en el navegador, sin reflejarlo
 * en una redirección ni en las props serializadas de un componente servidor.
 */
export default function ResetPasswordAliasPage() {
  return <ResetForm />;
}
