'use client';

import { useEffect, useRef } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLogin } from '@/features/auth/hooks/use-auth';
import { authCopy, mapLoginError } from '@/features/auth/services/auth-copy';
import { loginSchema, type LoginFormValues } from '@/features/auth/schemas/auth-schemas';
import { AuthField } from './auth-field';
import { PasswordInput } from './password-input';

export function LoginForm() {
  const searchParams = useSearchParams();
  const login = useLogin();
  const passwordRef = useRef<HTMLInputElement | null>(null);
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      tenantNit: '',
      email: '',
      passwordPlain: '',
    },
  });

  // Tras un error de credenciales: NIT y correo se conservan, la contraseña
  // se limpia y recibe el foco (AUTH-EXPERIENCE §5.3).
  useEffect(() => {
    if (login.isError) {
      form.resetField('passwordPlain');
      passwordRef.current?.focus();
    }
  }, [login.isError, form]);

  const passwordField = form.register('passwordPlain');

  return (
    <div className="auth-panel">
      <div className="auth-panel-brandline" translate="no">
        <span className="auth-panel-mark">1</span>
        <span>La Oficina Nítida</span>
      </div>
      <div className="space-y-3">
        <div className="auth-kicker">Acceso privado</div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold leading-tight tracking-[-0.028em] text-foreground text-balance">
            {authCopy.loginTitle}
          </h1>
          <p className="text-sm leading-6 text-muted-foreground text-pretty">
            {authCopy.loginDescription}
          </p>
        </div>
      </div>

      {login.error ? (
        <Alert variant="destructive">{mapLoginError(login.error)}</Alert>
      ) : searchParams.get('registered') ? (
        <Alert variant="success">{authCopy.loginRegisteredNotice}</Alert>
      ) : null}

      <form className="space-y-4" onSubmit={form.handleSubmit((values) => login.mutate(values))}>
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

        <AuthField
          label="Contraseña"
          htmlFor="passwordPlain"
          error={form.formState.errors.passwordPlain}
        >
          <PasswordInput
            id="passwordPlain"
            autoComplete="current-password"
            placeholder="Tu contraseña…"
            {...passwordField}
            ref={(node) => {
              passwordField.ref(node);
              passwordRef.current = node;
            }}
          />
        </AuthField>

        <Button className="w-full" type="submit" disabled={login.isPending}>
          {login.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {authCopy.loginAction}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        {authCopy.loginToRegisterPrompt}{' '}
        <Link
          className="font-medium text-foreground underline-offset-4 hover:underline"
          href="/registro"
        >
          {authCopy.loginToRegisterAction}
        </Link>
      </p>
    </div>
  );
}
