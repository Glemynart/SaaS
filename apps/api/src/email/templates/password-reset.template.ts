import { baseLayout } from './base-layout.template';

export function passwordResetTemplate(params: {
  userName: string;
  resetUrl: string;
  expiresInHours: number;
  fromName: string;
}): string {
  const { userName, resetUrl, expiresInHours, fromName } = params;

  const body = `
    <p>Hola${userName ? ` ${userName}` : ''},</p>
    <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta.</p>
    <p style="text-align:center;">
      <a href="${resetUrl}" class="btn">Restablecer contraseña</a>
    </p>
    <p>Este enlace expira en <strong>${expiresInHours} hora${expiresInHours !== 1 ? 's' : ''}</strong>.</p>
    <p>Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
    <p class="link-fallback">${resetUrl}</p>
    <p>Si no solicitaste restablecer tu contraseña, puedes ignorar este mensaje. Tu contraseña no cambiará.</p>
  `;

  return baseLayout({
    title: 'Restablece tu contraseña',
    preheader: 'Enlace para restablecer tu contraseña — expira pronto.',
    body,
    fromName,
  });
}
