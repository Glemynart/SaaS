import { expect, test } from '@playwright/test';

test('crea, edita, desactiva y reactiva un usuario desde la UI', async ({ page }, testInfo) => {
  const suffix = `${Date.now().toString().slice(-7)}${testInfo.retry}`;
  const nit = `5${suffix}`;
  const adminEmail = `users-admin-${suffix}@example.test`;
  const operatorEmail = `users-operator-${suffix}@example.test`;
  const invitedEmail = `users-invited-${suffix}@example.test`;
  const adminPassword = 'E2e-password-123!';
  const operatorPassword = 'Operator-password-123!';
  const invitePassword = 'Invited-password-123!';
  const invitations: Array<{
    id: string;
    createdAt: string;
    email: string;
    nombre: string;
    apellido: string;
    rol: 'ADMIN' | 'OPERADOR';
    expiresAt: string;
    lastSentAt: string;
  }> = [];
  let resendCount = 0;

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

  await page.route(/\/api\/users\/invitations(?:\/.*)?$/, async (route) => {
    const request = route.request();
    const requestUrl = new URL(request.url());
    if (request.method() === 'GET' && requestUrl.pathname === '/api/users/invitations') {
      await route.fulfill({ json: invitations });
      return;
    }

    if (request.method() === 'POST' && requestUrl.pathname === '/api/users/invitations') {
      const payload = JSON.parse(request.postData() ?? '{}') as unknown as {
        email: string;
        nombre: string;
        apellido: string;
        rol: 'ADMIN' | 'OPERADOR';
      };
      const sentAt = new Date().toISOString();
      const invitation = {
        id: 'invitation-e2e-1',
        createdAt: sentAt,
        email: payload.email.toLowerCase(),
        nombre: payload.nombre,
        apellido: payload.apellido,
        rol: payload.rol,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        lastSentAt: sentAt,
      };
      invitations.push(invitation);
      await route.fulfill({ status: 201, json: invitation });
      return;
    }

    const invitationId = requestUrl.pathname.split('/').at(-2);
    const invitationIndex = invitations.findIndex(({ id }) => id === invitationId);
    if (invitationIndex < 0) {
      await route.fulfill({ status: 404, json: { message: 'Invitación no encontrada.' } });
      return;
    }
    if (requestUrl.pathname.endsWith('/resend')) {
      resendCount += 1;
      invitations[invitationIndex]!.lastSentAt = new Date().toISOString();
      await route.fulfill({ status: 200, json: invitations[invitationIndex] });
      return;
    }
    if (requestUrl.pathname.endsWith('/revoke')) {
      invitations.splice(invitationIndex, 1);
      await route.fulfill({ status: 200, json: { message: 'Invitación revocada.' } });
      return;
    }
    await route.continue();
  });

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
  await invitationRow().getByRole('button', { name: 'Reenviar' }).click();
  await expect.poll(() => resendCount).toBe(1);
  await invitationRow().getByRole('button', { name: 'Revocar' }).click();
  const revokeDialog = page.getByRole('alertdialog', { name: 'Revocar invitación' });
  await revokeDialog.getByRole('button', { name: 'Revocar invitación' }).click();
  await expect(invitationRow()).toHaveCount(0);

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

  const menuTriggers = page.getByRole('button', { name: 'Menú de usuario' });
  await menuTriggers.last().click();
  await page.getByRole('menuitem', { name: /Cerrar sesi.n/ }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.route('**/api/auth/accept-invitation', async (route) => {
    const payload = JSON.parse(route.request().postData() ?? '{}') as unknown as {
      token: string;
      newPassword: string;
    };
    expect(payload).toEqual({
      token: 'e2e-invitation-token',
      newPassword: invitePassword,
    });
    await route.fulfill({
      status: 200,
      json: {
        message: 'Tu cuenta quedó activada. Ya puedes iniciar sesión.',
        tenantNit: nit,
        tenantName: 'Usuarios E2E',
      },
    });
  });
  await page.goto('/aceptar-invitacion#token=e2e-invitation-token');
  await page.getByLabel('Contraseña nueva').fill(invitePassword);
  await page.getByLabel('Confirma la contraseña').fill(invitePassword);
  await page.getByRole('button', { name: 'Activar cuenta' }).click();
  await expect(page.getByRole('heading', { name: 'Tu acceso está listo' })).toBeVisible();
  await page.getByRole('link', { name: 'Iniciar sesión' }).click();
  await expect(page.getByLabel('NIT de la empresa')).toHaveValue(nit);

  await page.getByLabel('NIT de la empresa').fill(nit);
  await page.getByLabel('Correo').fill(operatorEmail);
  await page.getByRole('textbox', { name: /Contrase.a/ }).fill(operatorPassword);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText(/Hola, Mateo Editado\./)).toBeVisible();
});
