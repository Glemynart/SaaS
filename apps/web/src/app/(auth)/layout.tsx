import type { ReactNode } from 'react';
import { Check, FileText, LockKeyhole, Rows3, ShieldCheck } from 'lucide-react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-[100dvh] overflow-x-hidden bg-background">
      <div className="mx-auto grid min-h-[100dvh] max-w-7xl grid-cols-1 lg:grid-cols-[minmax(420px,0.86fr)_minmax(520px,1.14fr)]">
        <section className="auth-brand-panel hidden border-r border-border px-10 py-10 lg:flex lg:flex-col lg:justify-between xl:px-12">
          <div className="space-y-10">
            <div className="flex items-center gap-3">
              <div className="brand-mark" aria-hidden="true">
                <span>1</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">La Oficina Nítida</p>
                <p className="text-xs text-muted-foreground">Operación multiempresa sin ruido</p>
              </div>
            </div>

            <div className="max-w-[30rem] space-y-5">
              <p className="text-[2.65rem] font-semibold leading-[1.02] tracking-[-0.035em] text-foreground text-balance">
                Cada empresa entra a una oficina separada, clara y verificable.
              </p>
              <p className="max-w-[34rem] text-sm leading-6 text-muted-foreground text-pretty">
                La sesion empieza con el NIT, confirma el usuario y mantiene el trabajo dentro del
                tenant correcto. Sin menus contables, sin ruido operativo.
              </p>
            </div>

            <div className="folio-stack" aria-hidden="true">
              <div className="folio folio-main">
                <div className="folio-topline">
                  <span />
                  <span />
                </div>
                <div className="folio-row strong" />
                <div className="folio-row" />
                <div className="folio-row short" />
                <div className="folio-grid">
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
              </div>
              <div className="folio folio-back" />
              <div className="folio folio-shadow" />
            </div>
          </div>

          <div className="grid gap-3 text-sm text-muted-foreground">
            <div className="auth-signal">
              <span className="flex items-center gap-2">
                <ShieldCheck className="size-4" aria-hidden="true" />
                Tenant
              </span>
              <strong>Separado por NIT</strong>
            </div>
            <div className="auth-signal">
              <span className="flex items-center gap-2">
                <LockKeyhole className="size-4" aria-hidden="true" />
                Sesión
              </span>
              <strong>Refresh protegido</strong>
            </div>
            <div className="auth-signal">
              <span className="flex items-center gap-2">
                <Rows3 className="size-4" aria-hidden="true" />
                Roles
              </span>
              <strong>ADMIN y OPERADOR</strong>
            </div>
          </div>
        </section>

        <section className="auth-form-stage flex min-h-[100dvh] flex-col px-5 py-5 sm:px-8 lg:px-10">
          <div className="mb-8 flex items-center justify-between lg:hidden">
            <div className="flex items-center gap-3">
              <div className="brand-mark brand-mark-compact" aria-hidden="true">
                <span>1</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">La Oficina Nítida</p>
                <p className="text-xs text-muted-foreground">Acceso seguro</p>
              </div>
            </div>
            <FileText className="size-4 text-muted-foreground" aria-hidden="true" />
          </div>

          <div className="flex flex-1 items-center justify-center">{children}</div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Check className="size-3.5 text-success" aria-hidden="true" />
              Cookie HTTP-only
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="size-3.5 text-success" aria-hidden="true" />
              Roles activos
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="size-3.5 text-success" aria-hidden="true" />
              Tenant aislado
            </span>
          </div>
        </section>
      </div>
    </main>
  );
}
