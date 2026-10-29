'use client';

import { useState, type FormEvent } from 'react';
import { AlertTriangle, MailPlus, Plus, RotateCw, UserCog } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { SideSheet } from '@/components/ui/side-sheet';
import { toast } from '@/components/ui/toast';
import { useMe } from '@/features/auth/hooks/use-auth';
import {
  useCreateUser,
  useCreateUserInvitation,
  useResendUserInvitation,
  useRevokeUserInvitation,
  useUpdateUser,
  useUserInvitations,
  useUsers,
} from '@/features/users/hooks/use-users';
import type {
  ManagedUser,
  ManagedUserRole,
  UserInvitationSummary,
} from '@/features/users/services/users-api';
import { getUserFacingError } from '@/lib/error-message';

type UserForm = {
  email: string;
  nombre: string;
  apellido: string;
  passwordPlain: string;
  rol: ManagedUserRole;
};

type InvitationForm = Omit<UserForm, 'passwordPlain'>;

const EMPTY_FORM: UserForm = {
  email: '',
  nombre: '',
  apellido: '',
  passwordPlain: '',
  rol: 'OPERADOR',
};

const EMPTY_INVITATION: InvitationForm = {
  email: '',
  nombre: '',
  apellido: '',
  rol: 'OPERADOR',
};

function formatLastLogin(value: string | null) {
  return value
    ? new Date(value).toLocaleString('es-CO', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'Nunca';
}

export default function UsersPage() {
  const me = useMe();
  const { data, isLoading, isError, error, refetch } = useUsers();
  const invitationQuery = useUserInvitations();
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();
  const createInvitationMutation = useCreateUserInvitation();
  const resendInvitationMutation = useResendUserInvitation();
  const revokeInvitationMutation = useRevokeUserInvitation();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [invitationSheetOpen, setInvitationSheetOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ManagedUser | null>(null);
  const [pendingStatus, setPendingStatus] = useState<ManagedUser | null>(null);
  const [pendingInvitation, setPendingInvitation] = useState<UserInvitationSummary | null>(null);
  const [form, setForm] = useState<UserForm>(EMPTY_FORM);
  const [invitationForm, setInvitationForm] = useState<InvitationForm>(EMPTY_INVITATION);

  const currentUserId = me.data?.user.id;
  const mutationError = createMutation.error ?? updateMutation.error;
  const users = data ?? [];
  const invitations = invitationQuery.data ?? [];

  function openCreate() {
    setSelectedUser(null);
    setForm(EMPTY_FORM);
    setSheetOpen(true);
  }

  function openInvite() {
    setInvitationForm(EMPTY_INVITATION);
    setInvitationSheetOpen(true);
  }

  function openEdit(user: ManagedUser) {
    setSelectedUser(user);
    setForm({
      email: user.email,
      nombre: user.nombre,
      apellido: user.apellido,
      passwordPlain: '',
      rol: user.rol,
    });
    setSheetOpen(true);
  }

  function updateForm(field: keyof UserForm, value: string) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  function updateInvitationForm(field: keyof InvitationForm, value: string) {
    setInvitationForm((previous) => ({ ...previous, [field]: value }));
  }

  function submitInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createInvitationMutation.mutate(invitationForm, {
      onSuccess: () => {
        setInvitationSheetOpen(false);
        toast.success('Invitación enviada.');
      },
      onError: (mutationError) =>
        toast.error(
          getUserFacingError(
            mutationError,
            'No se pudo enviar la invitación. Revisa el correo transaccional e inténtalo de nuevo.',
          ),
        ),
    });
  }

  function resendInvitation(invitation: UserInvitationSummary) {
    resendInvitationMutation.mutate(invitation.id, {
      onSuccess: () => toast.success('Invitación reenviada.'),
      onError: (mutationError) =>
        toast.error(getUserFacingError(mutationError, 'No se pudo reenviar la invitación.')),
    });
  }

  function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedUser) {
      updateMutation.mutate(
        {
          id: selectedUser.id,
          data: {
            email: form.email,
            nombre: form.nombre,
            apellido: form.apellido,
            rol: form.rol,
          },
        },
        {
          onSuccess: () => {
            setSheetOpen(false);
            toast.success('Usuario actualizado.');
          },
          onError: (mutationError) =>
            toast.error(getUserFacingError(mutationError, 'No se pudo actualizar el usuario.')),
        },
      );
      return;
    }

    createMutation.mutate(form, {
      onSuccess: () => {
        setSheetOpen(false);
        toast.success('Usuario creado.');
      },
      onError: (mutationError) =>
        toast.error(getUserFacingError(mutationError, 'No se pudo crear el usuario.')),
    });
  }

  function toggleStatus(user: ManagedUser) {
    if (user.id === currentUserId) return;
    if (user.activo) {
      setPendingStatus(user);
      return;
    }
    updateMutation.mutate(
      { id: user.id, data: { activo: true } },
      {
        onSuccess: () => toast.success('Usuario activado.'),
        onError: (mutationError) =>
          toast.error(getUserFacingError(mutationError, 'No se pudo activar el usuario.')),
      },
    );
  }

  return (
    <PageHeader
      title="Usuarios"
      description="Administra las cuentas que pueden operar esta organización."
      width="wide"
      actions={
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={openInvite}>
            <MailPlus className="size-4" aria-hidden="true" />
            Invitar usuario
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-4" aria-hidden="true" />
            Nuevo usuario
          </Button>
        </div>
      }
    >
      {mutationError && (
        <Alert variant="destructive" className="mb-4">
          {getUserFacingError(mutationError, 'No se pudo completar la operación.')}
        </Alert>
      )}

      {isError ? (
        <EmptyState
          icon={AlertTriangle}
          title="No pudimos cargar los usuarios."
          description={getUserFacingError(error, 'Revisa tu conexión e inténtalo de nuevo.')}
          action={
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Reintentar
            </Button>
          }
        />
      ) : isLoading ? (
        <div className="rounded-xl border border-border bg-surface p-6 text-sm text-muted-foreground">
          Cargando usuarios...
        </div>
      ) : users.length === 0 ? (
        <EmptyState
          icon={UserCog}
          title="Aún no hay usuarios adicionales."
          description="Crea una cuenta para que otra persona opere la organización sin compartir credenciales."
          action={
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={openInvite}>
                <MailPlus className="size-4" aria-hidden="true" />
                Invitar usuario
              </Button>
              <Button size="sm" onClick={openCreate}>
                <Plus className="size-4" aria-hidden="true" />
                Nuevo usuario
              </Button>
            </div>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-surface/50 text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Usuario</th>
                <th className="px-5 py-3 font-medium">Rol</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3 font-medium">Último acceso</th>
                <th className="px-5 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-5 py-3">
                    <p className="font-medium text-foreground">
                      {user.nombre} {user.apellido}
                      {user.id === currentUserId && (
                        <span className="ml-2 text-xs text-muted-foreground">(tú)</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {user.rol === 'ADMIN' ? 'Administrador' : 'Operador'}
                  </td>
                  <td className="px-5 py-3">
                    <span className={user.activo ? 'text-success' : 'text-muted-foreground'}>
                      {user.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {formatLastLogin(user.lastLoginAt)}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(user)}>
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={user.id === currentUserId || updateMutation.isPending}
                        onClick={() => toggleStatus(user)}
                      >
                        {user.activo ? 'Desactivar' : 'Activar'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {invitationQuery.isError && (
        <Alert variant="destructive" className="mt-6">
          No pudimos cargar las invitaciones.{' '}
          <button
            type="button"
            className="font-medium underline underline-offset-2"
            onClick={() => invitationQuery.refetch()}
          >
            Reintentar
          </button>
        </Alert>
      )}

      {invitations.length > 0 && (
        <section className="mt-8 space-y-3" aria-labelledby="pending-invitations-title">
          <div>
            <h2 id="pending-invitations-title" className="text-base font-semibold">
              Invitaciones pendientes
            </h2>
            <p className="text-sm text-muted-foreground">
              Reenvía enlaces vencidos o revoca accesos que ya no necesitas.
            </p>
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-surface/50 text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Persona</th>
                  <th className="px-5 py-3 font-medium">Rol</th>
                  <th className="px-5 py-3 font-medium">Vencimiento</th>
                  <th className="px-5 py-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invitations.map((invitation) => {
                  const expired = new Date(invitation.expiresAt).getTime() <= Date.now();
                  return (
                    <tr key={invitation.id}>
                      <td className="px-5 py-3">
                        <p className="font-medium text-foreground">
                          {invitation.nombre} {invitation.apellido}
                        </p>
                        <p className="text-xs text-muted-foreground">{invitation.email}</p>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {invitation.rol === 'ADMIN' ? 'Administrador' : 'Operador'}
                      </td>
                      <td className="px-5 py-3">
                        <span className={expired ? 'text-destructive' : 'text-muted-foreground'}>
                          {expired ? 'Vencida' : 'Vence'}{' '}
                          {new Date(invitation.expiresAt).toLocaleDateString('es-CO', {
                            dateStyle: 'medium',
                          })}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={
                              resendInvitationMutation.isPending ||
                              revokeInvitationMutation.isPending
                            }
                            onClick={() => resendInvitation(invitation)}
                          >
                            <RotateCw className="size-3.5" aria-hidden="true" />
                            Reenviar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={
                              resendInvitationMutation.isPending ||
                              revokeInvitationMutation.isPending
                            }
                            onClick={() => setPendingInvitation(invitation)}
                          >
                            Revocar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <SideSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title={selectedUser ? 'Editar usuario' : 'Nuevo usuario'}
        description={
          selectedUser
            ? 'Actualiza los datos y el rol de la cuenta.'
            : 'Crea la cuenta con una contraseña inicial o envía una invitación personal por correo.'
        }
      >
        <form className="space-y-4" onSubmit={submitForm}>
          <div className="space-y-1.5">
            <Label htmlFor="user-email">Correo</Label>
            <Input
              id="user-email"
              type="email"
              value={form.email}
              onChange={(event) => updateForm('email', event.target.value)}
              required
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="user-nombre">Nombre</Label>
              <Input
                id="user-nombre"
                value={form.nombre}
                onChange={(event) => updateForm('nombre', event.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="user-apellido">Apellido</Label>
              <Input
                id="user-apellido"
                value={form.apellido}
                onChange={(event) => updateForm('apellido', event.target.value)}
                required
              />
            </div>
          </div>
          {!selectedUser && (
            <div className="space-y-1.5">
              <Label htmlFor="user-password">Contraseña inicial</Label>
              <Input
                id="user-password"
                type="password"
                minLength={8}
                value={form.passwordPlain}
                onChange={(event) => updateForm('passwordPlain', event.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">Mínimo 8 caracteres.</p>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="user-role">Rol</Label>
            <Select
              id="user-role"
              value={form.rol}
              onChange={(event) => updateForm('rol', event.target.value as ManagedUserRole)}
            >
              <option value="OPERADOR">Operador</option>
              <option value="ADMIN">Administrador</option>
            </Select>
          </div>
          <div className="flex gap-3 border-t border-border pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setSheetOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending
                ? 'Guardando...'
                : selectedUser
                  ? 'Guardar cambios'
                  : 'Crear usuario'}
            </Button>
          </div>
        </form>
      </SideSheet>

      <SideSheet
        open={invitationSheetOpen}
        onOpenChange={setInvitationSheetOpen}
        title="Invitar usuario"
        description="Enviaremos un enlace personal para que configure su contraseña y active su acceso."
      >
        <form className="space-y-4" onSubmit={submitInvitation}>
          <div className="space-y-1.5">
            <Label htmlFor="invitation-email">Correo</Label>
            <Input
              id="invitation-email"
              type="email"
              autoComplete="email"
              value={invitationForm.email}
              onChange={(event) => updateInvitationForm('email', event.target.value)}
              required
              maxLength={254}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="invitation-nombre">Nombre</Label>
              <Input
                id="invitation-nombre"
                value={invitationForm.nombre}
                onChange={(event) => updateInvitationForm('nombre', event.target.value)}
                required
                maxLength={100}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invitation-apellido">Apellido</Label>
              <Input
                id="invitation-apellido"
                value={invitationForm.apellido}
                onChange={(event) => updateInvitationForm('apellido', event.target.value)}
                required
                maxLength={100}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invitation-role">Rol</Label>
            <Select
              id="invitation-role"
              value={invitationForm.rol}
              onChange={(event) =>
                updateInvitationForm('rol', event.target.value as ManagedUserRole)
              }
            >
              <option value="OPERADOR">Operador</option>
              <option value="ADMIN">Administrador</option>
            </Select>
          </div>
          <div className="flex gap-3 border-t border-border pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setInvitationSheetOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={createInvitationMutation.isPending}>
              {createInvitationMutation.isPending ? 'Enviando...' : 'Enviar invitación'}
            </Button>
          </div>
        </form>
      </SideSheet>

      <ConfirmDialog
        level={1}
        open={pendingStatus !== null}
        onOpenChange={(open) => {
          if (!open) setPendingStatus(null);
        }}
        title="Desactivar usuario"
        description={
          pendingStatus
            ? `${pendingStatus.nombre} ${pendingStatus.apellido} no podrá iniciar nuevas sesiones. Sus datos históricos se conservan.`
            : ''
        }
        confirmLabel="Desactivar usuario"
        onConfirm={async () => {
          if (!pendingStatus) return;
          await updateMutation.mutateAsync({ id: pendingStatus.id, data: { activo: false } });
          setPendingStatus(null);
          toast.success('Usuario desactivado.');
        }}
      />

      <ConfirmDialog
        level={1}
        open={pendingInvitation !== null}
        onOpenChange={(open) => {
          if (!open) setPendingInvitation(null);
        }}
        title="Revocar invitación"
        description={
          pendingInvitation
            ? pendingInvitation.email +
              ' ya no podrá usar el enlace de invitación. Puedes enviar otra invitación más adelante.'
            : ''
        }
        confirmLabel="Revocar invitación"
        onConfirm={async () => {
          if (!pendingInvitation) return;
          try {
            await revokeInvitationMutation.mutateAsync(pendingInvitation.id);
            setPendingInvitation(null);
            toast.success('Invitación revocada.');
          } catch (mutationError) {
            toast.error(getUserFacingError(mutationError, 'No se pudo revocar la invitación.'));
          }
        }}
      />
    </PageHeader>
  );
}
