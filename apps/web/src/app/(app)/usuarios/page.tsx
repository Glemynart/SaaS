'use client';

import { useState, type FormEvent } from 'react';
import { AlertTriangle, Plus, UserCog } from 'lucide-react';
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
import { useCreateUser, useUpdateUser, useUsers } from '@/features/users/hooks/use-users';
import type { ManagedUser, ManagedUserRole } from '@/features/users/services/users-api';
import { getUserFacingError } from '@/lib/error-message';

type UserForm = {
  email: string;
  nombre: string;
  apellido: string;
  passwordPlain: string;
  rol: ManagedUserRole;
};

const EMPTY_FORM: UserForm = {
  email: '',
  nombre: '',
  apellido: '',
  passwordPlain: '',
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
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ManagedUser | null>(null);
  const [pendingStatus, setPendingStatus] = useState<ManagedUser | null>(null);
  const [form, setForm] = useState<UserForm>(EMPTY_FORM);

  const currentUserId = me.data?.user.id;
  const mutationError = createMutation.error ?? updateMutation.error;
  const users = data ?? [];

  function openCreate() {
    setSelectedUser(null);
    setForm(EMPTY_FORM);
    setSheetOpen(true);
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
        <Button size="sm" onClick={openCreate}>
          <Plus className="size-4" aria-hidden="true" />
          Nuevo usuario
        </Button>
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
            <Button size="sm" onClick={openCreate}>
              <Plus className="size-4" aria-hidden="true" />
              Nuevo usuario
            </Button>
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

      <SideSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title={selectedUser ? 'Editar usuario' : 'Nuevo usuario'}
        description={
          selectedUser
            ? 'Actualiza los datos y el rol de la cuenta.'
            : 'Crea una cuenta directamente. Las invitaciones por correo pertenecen a otra Epic.'
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
    </PageHeader>
  );
}
