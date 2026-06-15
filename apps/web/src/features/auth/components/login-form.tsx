'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLogin } from '@/features/auth/hooks/use-auth';
import { authCopy } from '@/features/auth/services/auth-copy';
import { loginSchema, type LoginFormValues } from '@/features/auth/schemas/auth-schemas';
import { AuthField } from './auth-field';

export function LoginForm() {
  const searchParams = useSearchParams();
  const login = useLogin();
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      tenantNit: '',
      email: '',
      passwordPlain: '',
    },
  });

  return (
    <div className="auth-panel">
      <div className="auth-panel-brandline" translate="no">
        <span className="auth-panel-mark">1</span>
        <span>La Oficina Nítida</span>
      </div>
      <div className="space-y-3">
        <div className="auth-kicker">Acceso privado</div>
        <div className="space-y-2">
          <h1 className="text-[1.72rem] font-semibold leading-tight tracking-[-0.028em] text-foreground text-balance">
            {authCopy.loginTitle}
          </h1>
          <p className="text-sm leading-6 text-muted-foreground text-pretty">
            {authCopy.loginDescription}
          </p>
        </div>
      </div>

      {searchParams.get('registered') ? (
        <Alert variant="success">Empresa registrada. Ahora puedes iniciar sesion.</Alert>
      ) : null}

      {login.error ? <Alert variant="destructive">{login.error.message}</Alert> : null}

      <form className="space-y-4" onSubmit={form.handleSubmit((values) => login.mutate(values))}>
        <AuthField
          label="NIT de la empresa"
          htmlFor="tenantNit"
          error={form.formState.errors.tenantNit}
        >
          <Input
            id="tenantNit"
            autoComplete="organization"
            inputMode="numeric"
            placeholder="900123456…"
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

        <AuthField
          label="Contraseña"
          htmlFor="passwordPlain"
          error={form.formState.errors.passwordPlain}
        >
          <Input
            id="passwordPlain"
            type="password"
            autoComplete="current-password"
            placeholder="Tu contraseña…"
            {...form.register('passwordPlain')}
          />
        </AuthField>

        <Button className="w-full" type="submit" disabled={login.isPending}>
          {login.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          Entrar
          <ArrowRight className="size-4" aria-hidden="true" />
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        ¿Aun no tienes empresa?{' '}
        <Link
          className="font-medium text-foreground underline-offset-4 hover:underline"
          href="/registro"
        >
          Crear cuenta
        </Link>
      </p>
    </div>
  );
}
