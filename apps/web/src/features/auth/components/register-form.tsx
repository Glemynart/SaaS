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
import { authCopy } from '@/features/auth/services/auth-copy';
import { AuthField } from './auth-field';

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

  return (
    <div className="auth-panel auth-panel-wide">
      <div className="auth-panel-brandline" translate="no">
        <span className="auth-panel-mark">1</span>
        <span>La Oficina Nítida</span>
      </div>
      <div className="space-y-3">
        <div className="auth-kicker">Nueva oficina</div>
        <div className="space-y-2">
          <h1 className="text-[1.72rem] font-semibold leading-tight tracking-[-0.028em] text-foreground text-balance">
            {authCopy.registerTitle}
          </h1>
          <p className="text-sm leading-6 text-muted-foreground text-pretty">
            {authCopy.registerDescription}
          </p>
        </div>
      </div>

      {register.error ? <Alert variant="destructive">{register.error.message}</Alert> : null}

      <form className="space-y-5" onSubmit={form.handleSubmit((values) => register.mutate(values))}>
        <div className="grid gap-4 sm:grid-cols-[1fr_116px]">
          <AuthField label="NIT" htmlFor="nit" error={form.formState.errors.nit}>
            <Input
              id="nit"
              inputMode="numeric"
              placeholder="900123456…"
              {...form.register('nit')}
            />
          </AuthField>
          <AuthField label="Digito" htmlFor="digitoVerif" error={form.formState.errors.digitoVerif}>
            <Input
              id="digitoVerif"
              inputMode="numeric"
              placeholder="7…"
              {...form.register('digitoVerif')}
            />
          </AuthField>
        </div>

        <AuthField
          label="Nombre comercial"
          htmlFor="nombreTenant"
          error={form.formState.errors.nombreTenant}
        >
          <Input
            id="nombreTenant"
            placeholder="Colegio Norte SAS…"
            {...form.register('nombreTenant')}
          />
        </AuthField>

        <AuthField
          label="Razon social"
          htmlFor="razonSocial"
          error={form.formState.errors.razonSocial}
        >
          <Input
            id="razonSocial"
            placeholder="Colegio Norte S.A.S…"
            {...form.register('razonSocial')}
          />
        </AuthField>

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

        <AuthField label="Correo administrador" htmlFor="email" error={form.formState.errors.email}>
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
        >
          <Input
            id="passwordPlain"
            type="password"
            autoComplete="new-password"
            placeholder="Mínimo 8 caracteres…"
            {...form.register('passwordPlain')}
          />
        </AuthField>

        <Button className="w-full" type="submit" disabled={register.isPending}>
          {register.isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : null}
          Crear empresa
          <ArrowRight className="size-4" aria-hidden="true" />
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        ¿Ya tienes cuenta?{' '}
        <Link
          className="font-medium text-foreground underline-offset-4 hover:underline"
          href="/login"
        >
          Iniciar sesion
        </Link>
      </p>
    </div>
  );
}
