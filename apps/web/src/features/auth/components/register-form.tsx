'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRegister } from '@/features/auth/hooks/use-auth';
import { registerSchema, type RegisterFormValues } from '@/features/auth/schemas/auth-schemas';
import { authCopy, mapRegisterError } from '@/features/auth/services/auth-copy';
import { AuthField } from './auth-field';
import { PasswordInput } from './password-input';

export function RegisterForm() {
  const register = useRegister();
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      nombreTenant: '',
      nit: '',
      digitoVerif: '',
      razonSocial: '',
      email: '',
      passwordPlain: '',
      nombre: '',
      apellido: '',
    },
  });

  const registerError = register.error ? mapRegisterError(register.error) : null;

  return (
    <div className="flex w-full flex-col items-center">
      {/* Encabezado editorial, fuera del folio */}
      <div className="inline-flex items-center rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted-foreground shadow-(--shadow-inset-hi)">
        Nueva oficina
      </div>
      <h1 className="mt-5 text-balance text-center text-3xl font-semibold tracking-[-0.03em] text-foreground sm:text-4xl">
        {authCopy.registerTitle}
      </h1>
      <p className="mt-3 max-w-md text-pretty text-center text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
        {authCopy.registerDescription}
      </p>

      {registerError ? (
        <div className="mt-6 w-full max-w-2xl">
          <Alert variant="destructive">
            {registerError.message}
            {registerError.nitTaken ? (
              <>
                {' '}
                Si es la tuya,{' '}
                <Link
                  className="font-medium underline underline-offset-4 hover:no-underline"
                  href="/login"
                >
                  inicia sesión
                </Link>
                .
              </>
            ) : null}
          </Alert>
        </div>
      ) : null}

      {/* Folio de fundación: dos páginas (empresa | administrador) */}
      <div className="relative mt-8 w-full max-w-3xl">
        <div
          className="absolute inset-0 translate-x-5 translate-y-5 rounded-(--radius-panel) border border-border-soft bg-[color-mix(in_oklch,var(--surface)_48%,var(--canvas))]"
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 translate-x-2.5 translate-y-2.5 rounded-(--radius-panel) border border-border-soft bg-[color-mix(in_oklch,var(--surface)_72%,var(--canvas))]"
          aria-hidden="true"
        />

        <form
          className="product-frame relative"
          onSubmit={form.handleSubmit((values) => register.mutate(values))}
        >
          <div className="grid md:grid-cols-2 md:divide-x md:divide-border-soft">
            <div role="group" aria-labelledby="grupo-empresa" className="space-y-4 p-6 sm:p-8">
              <h2 id="grupo-empresa" className="pb-1 text-base font-semibold text-foreground">
                {authCopy.registerGroupCompany}
              </h2>

              <div className="grid gap-4 sm:grid-cols-[1fr_104px]">
                <AuthField
                  label="NIT"
                  htmlFor="nit"
                  error={form.formState.errors.nit}
                  hint={authCopy.registerNitHint}
                >
                  <Input
                    id="nit"
                    inputMode="numeric"
                    placeholder="900123456…"
                    autoFocus
                    {...form.register('nit')}
                  />
                </AuthField>
                <AuthField
                  label="Dígito"
                  htmlFor="digitoVerif"
                  error={form.formState.errors.digitoVerif}
                >
                  <Input
                    id="digitoVerif"
                    inputMode="numeric"
                    placeholder="7…"
                    aria-describedby="digitoVerif-hint"
                    {...form.register('digitoVerif')}
                  />
                </AuthField>
              </div>
              <p id="digitoVerif-hint" className="-mt-2 text-xs text-muted-foreground">
                {authCopy.registerDigitHint}
              </p>

              <AuthField
                label="Nombre comercial"
                htmlFor="nombreTenant"
                error={form.formState.errors.nombreTenant}
                hint={authCopy.registerCommercialNameHint}
              >
                <Input
                  id="nombreTenant"
                  placeholder="Colegio Norte SAS…"
                  {...form.register('nombreTenant')}
                />
              </AuthField>

              <AuthField
                label="Razón social"
                htmlFor="razonSocial"
                error={form.formState.errors.razonSocial}
                hint={authCopy.registerLegalNameHint}
              >
                <Input
                  id="razonSocial"
                  placeholder="Colegio Norte S.A.S…"
                  {...form.register('razonSocial')}
                />
              </AuthField>
            </div>

            <div
              role="group"
              aria-labelledby="grupo-administrador"
              className="space-y-4 border-t border-border-soft p-6 sm:p-8 md:border-t-0"
            >
              <h2 id="grupo-administrador" className="pb-1 text-base font-semibold text-foreground">
                {authCopy.registerGroupAdmin}
              </h2>

              <div className="grid gap-4 sm:grid-cols-2">
                <AuthField
                  label="Nombre administrador"
                  htmlFor="nombre"
                  error={form.formState.errors.nombre}
                >
                  <Input
                    id="nombre"
                    autoComplete="given-name"
                    placeholder="Laura…"
                    {...form.register('nombre')}
                  />
                </AuthField>
                <AuthField
                  label="Apellido"
                  htmlFor="apellido"
                  error={form.formState.errors.apellido}
                >
                  <Input
                    id="apellido"
                    autoComplete="family-name"
                    placeholder="Gómez…"
                    {...form.register('apellido')}
                  />
                </AuthField>
              </div>

              <AuthField
                label="Correo administrador"
                htmlFor="email"
                error={form.formState.errors.email}
                hint={authCopy.registerEmailHint}
              >
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="admin@empresa.com…"
                  spellCheck={false}
                  {...form.register('email')}
                />
              </AuthField>

              <AuthField
                label="Contraseña"
                htmlFor="passwordPlain"
                error={form.formState.errors.passwordPlain}
                hint={authCopy.passwordHint}
              >
                <PasswordInput
                  id="passwordPlain"
                  autoComplete="new-password"
                  placeholder="Mínimo 8 caracteres…"
                  {...form.register('passwordPlain')}
                />
              </AuthField>
            </div>
          </div>

          {/* Pie del folio: la firma de fundación */}
          <div className="border-t border-border-soft p-6 sm:px-8">
            <Button className="w-full" type="submit" disabled={register.isPending}>
              {register.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              {authCopy.registerAction}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </form>
      </div>

      <p className="mt-12 text-sm text-muted-foreground">
        {authCopy.registerToLoginPrompt}{' '}
        <Link
          className="font-medium text-foreground underline-offset-4 hover:underline"
          href="/login"
        >
          {authCopy.registerToLoginAction}
        </Link>
      </p>
    </div>
  );
}
