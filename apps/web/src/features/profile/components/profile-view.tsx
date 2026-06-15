'use client';

import { Building2, KeyRound, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useMe } from '@/features/auth/hooks/use-auth';

export function ProfileView() {
  const me = useMe();
  const user = me.data?.user;

  if (me.isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }

  if (me.isError || !user) {
    return <Alert variant="destructive">No se pudo cargar el perfil autenticado.</Alert>;
  }

  const fullName = `${user.nombre ?? ''} ${user.apellido ?? ''}`.trim() || 'Usuario autenticado';
  const initials = fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <section className="profile-hero">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="profile-avatar" aria-hidden="true">
              {initials || <UserRound className="size-5" />}
            </div>
            <div className="min-w-0">
              <Badge className="mb-3">Credencial activa</Badge>
              <h1 className="text-[2rem] font-semibold leading-tight tracking-[-0.035em] text-foreground text-balance">
                {fullName}
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground text-pretty">
                Esta credencial confirma quien opera, en que empresa trabaja y que nivel de acceso
                tiene dentro de la oficina.
              </p>
            </div>
          </div>
          <div className="profile-role-card">
            <span>Rol</span>
            <strong>{user.rol}</strong>
          </div>
        </div>
      </section>

      <section className="profile-board">
        <div className="profile-board-header">
          <div>
            <h2 className="text-base font-semibold text-foreground">Contexto de trabajo</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Información visible para orientar la operación diaria sin exponer controles técnicos.
            </p>
          </div>
          <Badge>Sesión segura</Badge>
        </div>
        <div className="profile-grid">
          <ProfileRow
            icon={Mail}
            label="Correo de acceso"
            value={user.email}
            detail="Identidad de ingreso"
          />
          <ProfileRow
            icon={Building2}
            label="Empresa activa"
            value={user.tenantNombre ?? user.tenantId}
            detail="Oficina aislada"
          />
          <ProfileRow icon={ShieldCheck} label="Permisos" value={user.rol} detail="Rol operativo" />
          <ProfileRow
            icon={KeyRound}
            label="Sesión"
            value="Renovable"
            detail="Protegida por cookie HTTP-only"
          />
        </div>
      </section>
    </div>
  );
}

function ProfileRow({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="profile-row">
      <div className="grid size-9 place-items-center rounded-md border border-border bg-background">
        <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 truncate text-sm font-medium text-foreground">{value}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}
