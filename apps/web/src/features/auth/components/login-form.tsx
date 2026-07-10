'use client';

import { useEffect, useRef } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Loader2, LockKeyhole, Rows3, ShieldCheck } from 'lucide-react';
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

const signals = [
  {
    icon: ShieldCheck,
    title: 'Cada empresa, su propia oficina',
    detail: 'Tus datos nunca se mezclan con otros.',
  },
  {
    icon: LockKeyhole,
    title: 'Sesión protegida',
    detail: 'Se renueva sola mientras trabajas y se cierra por seguridad al dejar de usarla.',
  },
  {
    icon: Rows3,
    title: 'Acceso por permisos',
    detail: 'Cada persona ve solo lo que le corresponde.',
  },
];

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
    <div className="flex w-full flex-col items-center">
      {/* Encabezado editorial, fuera del folio */}
      <div className="inline-flex items-center rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted-foreground shadow-(--shadow-inset-hi)">
        Acceso privado
      </div>
      <h1 className="mt-5 text-balance text-center text-3xl font-semibold tracking-[-0.03em] text-foreground sm:text-4xl">
        {authCopy.loginTitle}
      </h1>
      <p className="mt-3 max-w-md text-pretty text-center text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
        {authCopy.loginDescription}
      </p>

      {/* Zona de avisos (una sola; error > éxito) */}
      {login.error ? (
        <div className="mt-6 w-full max-w-md">
          <Alert variant="destructive">{mapLoginError(login.error)}</Alert>
        </div>
      ) : searchParams.get('registered') ? (
        <div className="mt-6 w-full max-w-md">
          <Alert variant="success">{authCopy.loginRegisteredNotice}</Alert>
        </div>
      ) : null}

      {/* Folio del formulario, con profundidad física detrás */}
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
            onSubmit={form.handleSubmit((values) => login.mutate(values))}
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

            <Button className="w-full" size="lg" type="submit" disabled={login.isPending}>
              {login.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              {authCopy.loginAction}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </form>
        </div>
      </div>

      {/* Señales de confianza */}
      <div className="mt-16 grid w-full max-w-2xl gap-6 sm:grid-cols-3 sm:gap-8">
        {signals.map(({ icon: Icon, title, detail }) => (
          <div key={title}>
            <p className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              {title}
            </p>
            <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{detail}</p>
          </div>
        ))}
      </div>

      <p className="mt-12 text-sm text-muted-foreground">
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
