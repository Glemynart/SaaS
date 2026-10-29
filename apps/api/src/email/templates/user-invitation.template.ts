import { baseLayout } from './base-layout.template';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function userInvitationTemplate(params: {
  userName: string;
  tenantName: string;
  tenantNit: string;
  roleName: string;
  invitationUrl: string;
  expiresInDays: number;
  fromName: string;
}): string {
  const userName = escapeHtml(params.userName);
  const tenantName = escapeHtml(params.tenantName);
  const tenantNit = escapeHtml(params.tenantNit);
  const roleName = escapeHtml(params.roleName);
  const invitationUrl = escapeHtml(params.invitationUrl);

  const body =
    '<p>Hola' +
    (userName ? ' ' + userName : '') +
    ',</p>' +
    '<p>Te invitaron a operar <strong>' +
    tenantName +
    '</strong> en La Oficina Nítida.</p>' +
    '<p>Tu rol será <strong>' +
    roleName +
    '</strong>. El NIT de la organización es <strong>' +
    tenantNit +
    '</strong>; lo necesitarás para iniciar sesión.</p>' +
    '<p style="text-align:center;"><a href="' +
    invitationUrl +
    '" class="btn">Aceptar invitación</a></p>' +
    '<p>Este enlace expira en <strong>' +
    String(params.expiresInDays) +
    ' días</strong> y solo se puede usar una vez.</p>' +
    '<p>Si el botón no funciona, copia y pega este enlace en tu navegador:</p>' +
    '<p class="link-fallback">' +
    invitationUrl +
    '</p>' +
    '<p>Si no esperabas esta invitación, puedes ignorar este mensaje.</p>';

  return baseLayout({
    title: 'Invitación a La Oficina Nítida',
    preheader: 'Configura tu acceso personal a la organización.',
    body,
    fromName: params.fromName,
  });
}
