import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  ACCOUNTING_SECTIONS,
  getAccountingSection,
  type AccountingSectionId,
} from '../lib/accounting-nav';

interface AccountingPlaceholderProps {
  sectionId: AccountingSectionId;
}

export function AccountingPlaceholder({ sectionId }: AccountingPlaceholderProps) {
  const section = getAccountingSection(sectionId);
  if (!section) return null;

  const Icon = section.icon;
  const related = ACCOUNTING_SECTIONS.filter(
    (item) => item.id !== 'dashboard' && item.id !== sectionId,
  ).slice(0, 3);

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-surface p-6 shadow-sm">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-muted-foreground">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-foreground">{section.label}</h2>
                <Badge variant="neutral">Base navegable</Badge>
              </div>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                {section.description}
              </p>
            </div>
          </div>

          <Link
            href="/contabilidad"
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Dashboard
          </Link>
        </div>
      </section>

      <section aria-label="Otras vistas contables" className="grid gap-3 sm:grid-cols-3">
        {related.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group flex min-h-24 items-start justify-between gap-3 rounded-lg border border-border bg-surface p-4 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{item.label}</p>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                {item.description}
              </p>
            </div>
            <ArrowRight
              className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
              aria-hidden="true"
            />
          </Link>
        ))}
      </section>
    </div>
  );
}
