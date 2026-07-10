'use client';

import { useEffect, useRef } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Link2Off, Loader2, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { Alert } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import { useResetPassword } from '@/features/auth/hooks/use-auth';
import { authCopy, mapResetError } from '@/features/auth/services/auth-copy';
import { resetSchema, type ResetFormValues } from '@/features/auth/schemas/auth-schemas';
import { cn } from '@/lib/utils';
import { AuthField } from './auth-field';
import { PasswordInput } from './password-input';

export function ResetForm({ token }: { token: string }) {
  const reset = useResetPassword();
  const terminalRef = useRef<HTMLDivElement | null>(null);

  const form = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { newPassword: '' },
  });

  const resetError = reset.isError ? mapResetError(reset.error) : null;

  // Enlace ausente/malformado, o rechazado por el backend como inválido/vencido/usado
  // → estado terminal §7.3 (nunca un formulario que fallará al enviar).
  const showTerminal = !token || (resetError?.invalidToken ?? false);

  useEffect(() => {
    if (showTerminal) terminalRef.current?.focus();
  }, [showTerminal]);

  if (showTerminal) {
    return (
      <div className="flex w-full flex-col items-center">
        <div className="inline-flex items-center rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted-foreground shadow-(--shadow-inset-hi)">
          Acceso privado
        </div>

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
            <span
              className="mx-auto flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground"
              aria-hidden="true"
            >
              <Link2Off className="size-5" />
            </span>
            <h1 className="mt-5 text-2xl font-semibold tracking-[-0.02em] text-foreground">
              {authCopy.linkExpiredTitle}
            </h1>
            <p className="mx-auto mt-3 max-w-sm text-pretty text-sm leading-6 text-muted-foreground">
              {authCopy.linkExpiredBody}
            </p>

            <div className="mt-7 flex flex-col gap-3">
              <Link href="/recuperar" className={cn(buttonVariants({ size: 'lg' }), 'w-full')}>
                {authCopy.linkExpiredAction}
              </Link>
              <Link
                href="/login"
                className="rounded-md text-sm font-medium text-muted-foreground underline-offset-4 transition-colors duration-150 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {authCopy.resetBackToLogin}
              </Link>
            </div>
          </div>
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
        {authCopy.resetTitle}
      </h1>

      {/* Zona de avisos: error de red/servicio (el token inválido es terminal, no aviso) */}
      {resetError && !resetError.invalidToken ? (
        <div className="mt-6 w-full max-w-md">
          <Alert variant="destructive">{resetError.message}</Alert>
        </div>
      ) : null}

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
            onSubmit={form.handleSubmit((values) => reset.mutate({ token, ...values }))}
          >
            <AuthField
              label="Contraseña nueva"
              htmlFor="newPassword"
              error={form.formState.errors.newPassword}
              hint={authCopy.passwordHint}
            >
              <PasswordInput
                id="newPassword"
                autoComplete="new-password"
                placeholder="Mínimo 8 caracteres…"
                autoFocus
                {...form.register('newPassword')}
              />
            </AuthField>

            {/* Aviso permanente de revocación de sesiones (§7.0b, semántica info) */}
            <p className="flex items-start gap-2 text-xs leading-5 text-info">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>{authCopy.resetNotice}</span>
            </p>

            <Button className="w-full" size="lg" type="submit" disabled={reset.isPending}>
              {reset.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              {authCopy.resetAction}
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
          {authCopy.resetBackToLogin}
        </Link>
      </p>
    </div>
  );
}
