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
    <div className="auth-panel auth-panel-wide">
      <div className="auth-panel-brandline" translate="no">
        <span className="auth-panel-mark">1</span>
        <span>La Oficina Nítida</span>
      </div>
      <div className="space-y-3">
        <div className="auth-kicker">Nueva oficina</div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold leading-tight tracking-[-0.028em] text-foreground text-balance">
            {authCopy.registerTitle}
          </h1>
          <p className="text-sm leading-6 text-muted-foreground text-pretty">
            {authCopy.registerDescription}
          </p>
        </div>
      </div>

      {registerError ? (
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
      ) : null}

      <form className="space-y-6" onSubmit={form.handleSubmit((values) => register.mutate(values))}>
        <fieldset className="space-y-4">
          <legend>
            <h2 className="text-base font-semibold text-foreground">
              {authCopy.registerGroupCompany}
            </h2>
          </legend>

          <div className="grid gap-4 sm:grid-cols-[1fr_116px]">
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
        </fieldset>

        <fieldset className="space-y-4">
          <legend>
            <h2 className="text-base font-semibold text-foreground">
              {authCopy.registerGroupAdmin}
            </h2>
          </legend>

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
            <AuthField label="Apellido" htmlFor="apellido" error={form.formState.errors.apellido}>
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
        </fieldset>

        <Button className="w-full" type="submit" disabled={register.isPending}>
          {register.isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : null}
          {authCopy.registerAction}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
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
