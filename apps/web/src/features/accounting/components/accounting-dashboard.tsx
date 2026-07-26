import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { ACCOUNTING_SECTIONS } from '../lib/accounting-nav';

const dashboardSections = ACCOUNTING_SECTIONS.filter((section) => section.id !== 'dashboard');

export function AccountingDashboard() {
  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold text-foreground">Base del módulo</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Accesos principales para operar catálogos, períodos, comprobantes y reportes contables.
        </p>
      </section>

      <section
        aria-label="Accesos de contabilidad"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      >
        {dashboardSections.map((section) => {
          const Icon = section.icon;

          return (
            <Link
              key={section.href}
              href={section.href}
              className="group rounded-lg border border-border bg-surface p-5 shadow-sm transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-muted-foreground">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-foreground">{section.label}</h3>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {section.description}
                    </p>
                  </div>
                </div>
                <ArrowRight
                  className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
                  aria-hidden="true"
                />
              </div>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
