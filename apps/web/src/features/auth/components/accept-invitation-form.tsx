'use client';

import { useEffect, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Link2Off, Loader2, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { Alert } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import { useAcceptInvitation } from '@/features/auth/hooks/use-auth';
import {
  acceptInvitationSchema,
  type AcceptInvitationFormValues,
} from '@/features/auth/schemas/auth-schemas';
import { cn } from '@/lib/utils';
import { AuthField } from './auth-field';
import { PasswordInput } from './password-input';

export function AcceptInvitationForm() {
  const [token, setToken] = useState<string | null>(null);
  const acceptInvitation = useAcceptInvitation();
  const terminalRef = useRef<HTMLDivElement | null>(null);
  const form = useForm<AcceptInvitationFormValues>({
    resolver: zodResolver(acceptInvitationSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  useEffect(() => {
    const tokenFromLink = new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '';
    setToken(tokenFromLink);
    window.history.replaceState(
      window.history.state,
      '',
      window.location.pathname + window.location.search,
    );
  }, []);

  useEffect(() => {
    if (token === '') terminalRef.current?.focus();
  }, [token]);

  if (token === null) {
    return (
      <div
        role="status"
        className="product-frame w-full max-w-md p-6 text-center text-sm text-muted-foreground"
      >
        Cargando invitación...
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex w-full flex-col items-center">
        <div className="relative mt-8 w-full max-w-md">
          <div
            className="absolute inset-0 translate-x-5 translate-y-5 rounded-(--radius-panel) border border-border-soft bg-[color-mix(in_oklch,var(--surface)_48%,var(--canvas))]"
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 translate-x-2.5 translate-y-2.5 rounded-(--radius-panel) border border-border-soft bg-[color-mix(in_oklch,var(--surface)_72%,var(--canvas))]"
            aria-hidden="true"
          />
          <div
            ref={terminalRef}
            tabIndex={-1}
            role="status"
            className="product-frame relative p-6 text-center outline-none sm:p-8"
          >
            <Link2Off className="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
            <h1 className="mt-5 text-2xl font-semibold text-foreground">
              Falta el enlace de invitación
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Abre el enlace completo que recibiste por correo o pide al administrador que lo
              reenvíe.
            </p>
            <Link className={cn(buttonVariants({ size: 'lg' }), 'mt-7 w-full')} href="/login">
              Ir a iniciar sesión
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (acceptInvitation.data) {
    const loginHref = '/login?invited=1&nit=' + encodeURIComponent(acceptInvitation.data.tenantNit);
    return (
      <div className="flex w-full flex-col items-center">
        <div className="inline-flex items-center rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted-foreground shadow-(--shadow-inset-hi)">
          Acceso privado
        </div>
        <h1 className="mt-5 text-balance text-center text-3xl font-semibold tracking-[-0.03em] text-foreground sm:text-4xl">
          Tu acceso está listo
        </h1>
        <div className="product-frame mt-8 w-full max-w-md p-6 text-center sm:p-8">
          <p className="text-sm leading-6 text-muted-foreground">
            {acceptInvitation.data.message} Organización: {acceptInvitation.data.tenantName}.
          </p>
          <Link className={cn(buttonVariants({ size: 'lg' }), 'mt-7 w-full')} href={loginHref}>
            Iniciar sesión
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col items-center">
      <div className="inline-flex items-center rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted-foreground shadow-(--shadow-inset-hi)">
        Acceso privado
      </div>
      <h1 className="mt-5 text-balance text-center text-3xl font-semibold tracking-[-0.03em] text-foreground sm:text-4xl">
        Activa tu acceso
      </h1>
      <p className="mt-3 max-w-md text-pretty text-center text-sm leading-6 text-muted-foreground">
        Elige una contraseña personal para completar tu invitación.
      </p>

      {acceptInvitation.error && (
        <div className="mt-6 w-full max-w-md">
          <Alert variant="destructive">{acceptInvitation.error.message}</Alert>
        </div>
      )}

      <div className="relative mt-8 w-full max-w-md">
        <div
          className="absolute inset-0 translate-x-5 translate-y-5 rounded-(--radius-panel) border border-border-soft bg-[color-mix(in_oklch,var(--surface)_48%,var(--canvas))]"
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 translate-x-2.5 translate-y-2.5 rounded-(--radius-panel) border border-border-soft bg-[color-mix(in_oklch,var(--surface)_72%,var(--canvas))]"
          aria-hidden="true"
        />
        <div className="product-frame relative p-6 sm:p-8">
          <form
            className="space-y-5"
            onSubmit={form.handleSubmit((values) =>
              acceptInvitation.mutate({
                token,
                newPassword: values.newPassword,
              }),
            )}
          >
            <AuthField
              label="Contraseña nueva"
              htmlFor="newPassword"
              error={form.formState.errors.newPassword}
              hint="Usa al menos 8 caracteres."
            >
              <PasswordInput
                id="newPassword"
                autoComplete="new-password"
                placeholder="Mínimo 8 caracteres…"
                autoFocus
                {...form.register('newPassword')}
              />
            </AuthField>
            <AuthField
              label="Confirma la contraseña"
              htmlFor="confirmPassword"
              error={form.formState.errors.confirmPassword}
            >
              <PasswordInput
                id="confirmPassword"
                autoComplete="new-password"
                placeholder="Escribe la contraseña de nuevo…"
                {...form.register('confirmPassword')}
              />
            </AuthField>
            <p className="flex items-start gap-2 text-xs leading-5 text-info">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>
                Este enlace es de un solo uso. La contraseña será personal para tu cuenta.
              </span>
            </p>
            <Button
              className="w-full"
              size="lg"
              type="submit"
              disabled={acceptInvitation.isPending}
            >
              {acceptInvitation.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              Activar cuenta
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </form>
        </div>
      </div>
      <p className="mt-12 text-sm text-muted-foreground">
        <Link
          className="font-medium text-foreground underline-offset-4 hover:underline"
          href="/login"
        >
          Volver a iniciar sesión
        </Link>
      </p>
    </div>
  );
}
