'use client';

import { useEffect, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Loader2, MailCheck } from 'lucide-react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { Alert } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useForgotPassword } from '@/features/auth/hooks/use-auth';
import {
  authCopy,
  mapForgotError,
  recoverConfirmationBody,
} from '@/features/auth/services/auth-copy';
import { recoverSchema, type RecoverFormValues } from '@/features/auth/schemas/auth-schemas';
import { cn } from '@/lib/utils';
import { AuthField } from './auth-field';

export function RecoverForm() {
  const forgot = useForgotPassword();
  const [sentTo, setSentTo] = useState('');
  const confirmationRef = useRef<HTMLDivElement | null>(null);
  const [confirmationVisible, setConfirmationVisible] = useState(false);

  const form = useForm<RecoverFormValues>({
    resolver: zodResolver(recoverSchema),
    defaultValues: { tenantNit: '', email: '' },
  });

  // Al confirmar, se revela el panel (crossfade §8.4) y el foco viaja al aviso
  // para que los lectores de pantalla lo anuncien (§11).
  useEffect(() => {
    if (forgot.isSuccess) {
      setConfirmationVisible(true);
      confirmationRef.current?.focus();
    }
  }, [forgot.isSuccess]);

  // Vuelve al formulario conservando los valores escritos (AX-D7).
  function retry() {
    setConfirmationVisible(false);
    forgot.reset();
  }

  if (forgot.isSuccess) {
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
            ref={confirmationRef}
            tabIndex={-1}
            role="status"
            aria-live="polite"
            className={cn(
              'product-frame relative p-6 text-center outline-none transition-opacity duration-300 ease-out motion-reduce:transition-none sm:p-8',
              confirmationVisible ? 'opacity-100' : 'opacity-0',
            )}
          >
            <span
              className="mx-auto flex size-11 items-center justify-center rounded-full bg-primary/8 text-primary"
              aria-hidden="true"
            >
              <MailCheck className="size-5" />
            </span>
            <h1 className="mt-5 text-2xl font-semibold tracking-[-0.02em] text-foreground">
              {authCopy.recoverConfirmTitle}
            </h1>
            <p className="mx-auto mt-3 max-w-sm text-pretty text-sm leading-6 text-muted-foreground">
              {recoverConfirmationBody(sentTo)}
            </p>

            <div className="mt-7 flex flex-col gap-3">
              <Link href="/login" className={cn(buttonVariants({ size: 'lg' }), 'w-full')}>
                {authCopy.recoverBackToLogin}
              </Link>
              <button
                type="button"
                onClick={retry}
                className="rounded-md text-sm font-medium text-muted-foreground underline-offset-4 transition-colors duration-150 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {authCopy.recoverRetry}
              </button>
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
        {authCopy.recoverTitle}
      </h1>
      <p className="mt-3 max-w-md text-pretty text-center text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
        {authCopy.recoverDescription}
      </p>

      {/* Zona de avisos: solo error de red/servicio (§7.0 no tiene "cuenta no encontrada") */}
      {forgot.isError ? (
        <div className="mt-6 w-full max-w-md">
          <Alert variant="destructive">{mapForgotError(forgot.error)}</Alert>
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
            onSubmit={form.handleSubmit((values) => {
              setSentTo(values.email);
              forgot.mutate(values);
            })}
          >
            <AuthField
              label="NIT de la empresa"
              htmlFor="tenantNit"
              error={form.formState.errors.tenantNit}
              hint={authCopy.nitHint}
            >
              <Input
                id="tenantNit"
                autoComplete="organization"
                inputMode="numeric"
                placeholder="900123456…"
                autoFocus
                {...form.register('tenantNit')}
              />
            </AuthField>

            <AuthField label="Correo" htmlFor="email" error={form.formState.errors.email}>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="admin@empresa.com…"
                spellCheck={false}
                {...form.register('email')}
              />
            </AuthField>

            <Button className="w-full" size="lg" type="submit" disabled={forgot.isPending}>
              {forgot.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              {authCopy.recoverAction}
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
          {authCopy.recoverBackToLogin}
        </Link>
      </p>
    </div>
  );
}
