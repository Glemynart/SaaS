import { expect, test } from '@playwright/test';

test('crea, edita, desactiva y reactiva un usuario desde la UI', async ({ page }, testInfo) => {
  const suffix = `${Date.now().toString().slice(-7)}${testInfo.retry}`;
  const nit = `5${suffix}`;
  const adminEmail = `users-admin-${suffix}@example.test`;
  const operatorEmail = `users-operator-${suffix}@example.test`;
  const invitedEmail = `users-invited-${suffix}@example.test`;
  const revokedEmail = `users-revoked-${suffix}@example.test`;
  const adminPassword = 'E2e-password-123!';
  const operatorPassword = 'Operator-password-123!';
  const invitePassword = 'Invited-password-123!';

  async function capturedInvitationMessages(email: string) {
    const response = await fetch(`http://127.0.0.1:8025/messages?to=${encodeURIComponent(email)}`);
    expect(response.ok).toBeTruthy();
    const body = (await response.json()) as {
      messages: Array<{ raw: string }>;
    };
    return body.messages;
  }

  function invitationToken(rawMessage: string) {
    const decoded = rawMessage
      .replace(/=\r?\n/g, '')
      .replace(/=([0-9a-f]{2})/gi, (_, hex: string) =>
        String.fromCharCode(Number.parseInt(hex, 16)),
      );
    const link = decoded.match(/href=["']([^"']*\/aceptar-invitacion#token=[^"']+)["']/i)?.[1];
    expect(link, 'invitation email contains an acceptance link').toBeTruthy();
    return new URL(link!).hash.slice('#token='.length);
  }

  await page.goto('/registro');
  await page.getByLabel('NIT', { exact: true }).fill(nit);
  await page.getByLabel(/D.gito/).fill('1');
  await page.getByLabel('Nombre comercial').fill('Usuarios E2E');
  await page.getByLabel(/Raz.n social/).fill('Usuarios E2E S.A.S.');
  await page.getByLabel('Nombre administrador').fill('Laura');
  await page.getByLabel(/Apellido/).fill('Gomez');
  await page.getByLabel('Correo administrador').fill(adminEmail);
  await page.getByRole('textbox', { name: /Contrase.a/ }).fill(adminPassword);
  await page.getByRole('button', { name: 'Crear empresa' }).click();

  await expect(page).toHaveURL(/\/login\?registered=1$/);
  await page.getByLabel('NIT de la empresa').fill(nit);
  await page.getByLabel('Correo').fill(adminEmail);
  await page.getByRole('textbox', { name: /Contrase.a/ }).fill(adminPassword);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto('/usuarios');
  await expect(page.getByRole('heading', { name: 'Usuarios' })).toBeVisible();
  await page.getByRole('button', { name: 'Invitar usuario', exact: true }).click();
  const inviteDialog = page.getByRole('dialog', { name: 'Invitar usuario' });
  await inviteDialog.getByLabel('Correo').fill(invitedEmail);
  await inviteDialog.getByLabel('Nombre').fill('Sofía');
  await inviteDialog.getByLabel('Apellido').fill('Invitada');
  await inviteDialog.getByLabel('Rol').selectOption('OPERADOR');
  await inviteDialog.getByRole('button', { name: 'Enviar invitación' }).click();

  const invitationRow = () => page.getByRole('row').filter({ hasText: invitedEmail });
  await expect(invitationRow()).toContainText('Sofía Invitada');
  await expect(invitationRow()).toContainText('Operador');
  await expect.poll(async () => (await capturedInvitationMessages(invitedEmail)).length).toBe(1);
  const initialToken = invitationToken((await capturedInvitationMessages(invitedEmail))[0]!.raw);
  await invitationRow().getByRole('button', { name: 'Reenviar' }).click();
  await expect.poll(async () => (await capturedInvitationMessages(invitedEmail)).length).toBe(2);
  const resentToken = invitationToken((await capturedInvitationMessages(invitedEmail))[1]!.raw);
  expect(resentToken).not.toBe(initialToken);

  await page.getByRole('button', { name: 'Invitar usuario', exact: true }).click();
  const revokedInviteDialog = page.getByRole('dialog', { name: 'Invitar usuario' });
  await revokedInviteDialog.getByLabel('Correo').fill(revokedEmail);
  await revokedInviteDialog.getByLabel('Nombre').fill('Invitado');
  await revokedInviteDialog.getByLabel('Apellido').fill('Revocado');
  await revokedInviteDialog.getByLabel('Rol').selectOption('OPERADOR');
  await revokedInviteDialog.getByRole('button', { name: 'Enviar invitación' }).click();
  const revokedInvitationRow = () => page.getByRole('row').filter({ hasText: revokedEmail });
  await expect(revokedInvitationRow()).toContainText('Invitado Revocado');
  await revokedInvitationRow().getByRole('button', { name: 'Revocar' }).click();
  const revokeDialog = page.getByRole('alertdialog', { name: 'Revocar invitación' });
  await revokeDialog.getByRole('button', { name: 'Revocar invitación' }).click();
  await expect(revokedInvitationRow()).toHaveCount(0);

  await page.getByRole('button', { name: 'Nuevo usuario', exact: true }).first().click();

  const createDialog = page.getByRole('dialog', { name: 'Nuevo usuario' });
  await createDialog.getByLabel('Correo').fill(operatorEmail);
  await createDialog.getByLabel('Nombre').fill('Mateo');
  await createDialog.getByLabel('Apellido').fill('Operador');
  await createDialog.getByLabel('Contraseña inicial').fill(operatorPassword);
  await createDialog.getByLabel('Rol').selectOption('OPERADOR');
  await createDialog.getByRole('button', { name: 'Crear usuario', exact: true }).click();

  const userRow = () => page.getByRole('row').filter({ hasText: operatorEmail });
  await expect(userRow()).toContainText('Mateo Operador');
  await expect(userRow()).toContainText('Operador');
  await expect(userRow()).toContainText('Activo');

  await userRow().getByRole('button', { name: 'Editar', exact: true }).click();
  const editDialog = page.getByRole('dialog', { name: 'Editar usuario' });
  await editDialog.getByLabel('Nombre').fill('Mateo Editado');
  await editDialog.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await expect(userRow()).toContainText('Mateo Editado');

  await userRow().getByRole('button', { name: 'Desactivar', exact: true }).click();
  const confirmDialog = page.getByRole('alertdialog', { name: 'Desactivar usuario' });
  await confirmDialog.getByRole('button', { name: 'Desactivar usuario', exact: true }).click();
  await expect(userRow()).toContainText('Inactivo');

  await userRow().getByRole('button', { name: 'Activar', exact: true }).click();
  await expect(userRow()).toContainText('Activo');

  const invitedMenuTriggers = page.getByRole('button', { name: 'Menú de usuario' });
  await invitedMenuTriggers.last().click();
  await page.getByRole('menuitem', { name: /Cerrar sesi.n/ }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto(`/aceptar-invitacion#token=${encodeURIComponent(resentToken)}`);
  await page.getByLabel('Contraseña nueva').fill(invitePassword);
  await page.getByLabel('Confirma la contraseña').fill(invitePassword);
  await page.getByRole('button', { name: 'Activar cuenta' }).click();
  await expect(page.getByRole('heading', { name: 'Tu acceso está listo' })).toBeVisible();
  await page.getByRole('link', { name: 'Iniciar sesión' }).click();
  await expect(page.getByLabel('NIT de la empresa')).toHaveValue(nit);

  await page.getByLabel('NIT de la empresa').fill(nit);
  await page.getByLabel('Correo').fill(invitedEmail);
  await page.getByRole('textbox', { name: /Contrase.a/ }).fill(invitePassword);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText(/Hola, Sofía\. Todo al día\./)).toBeVisible();

  const menuTriggers = page.getByRole('button', { name: 'Menú de usuario' });
  await menuTriggers.last().click();
  await page.getByRole('menuitem', { name: /Cerrar sesi.n/ }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel('NIT de la empresa').fill(nit);
  await page.getByLabel('Correo').fill(operatorEmail);
  await page.getByRole('textbox', { name: /Contrase.a/ }).fill(operatorPassword);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText(/Hola, Mateo Editado\./)).toBeVisible();
});
