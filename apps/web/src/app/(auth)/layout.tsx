import type { ReactNode } from 'react';
import { FileText, LockKeyhole, Rows3, ShieldCheck } from 'lucide-react';

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
              <p className="text-4xl font-semibold leading-[1.05] tracking-[-0.035em] text-foreground text-balance">
                Cada empresa entra a una oficina separada, clara y verificable.
              </p>
              <p className="max-w-[34rem] text-sm leading-6 text-muted-foreground text-pretty">
                Entra con el NIT de tu empresa y tu correo. Todo lo que hagas queda dentro de tu
                oficina: tus empleados, tus contratos y tus documentos.
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

          <div className="grid gap-3">
            {signals.map(({ icon: Icon, title, detail }) => (
              <div
                key={title}
                className="rounded-[10px] border border-border bg-surface p-3.5 shadow-[--shadow-inset-hi]"
              >
                <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                  {title}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
              </div>
            ))}
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
        </section>
      </div>
    </main>
  );
}
