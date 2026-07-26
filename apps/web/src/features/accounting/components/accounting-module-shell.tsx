'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { cn } from '@/lib/utils';
import { ACCOUNTING_SECTIONS } from '../lib/accounting-nav';

export function AccountingModuleShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <PageHeader
      title="Contabilidad"
      description="Operación contable manual, cierre y reportes derivados del Ledger."
      width="wide"
    >
      <nav
        aria-label="Navegación secundaria de contabilidad"
        className="mb-6 overflow-x-auto border-b border-border"
      >
        <ul className="flex min-w-max gap-1">
          {ACCOUNTING_SECTIONS.map((section) => {
            const Icon = section.icon;
            const active =
              pathname === section.href ||
              (section.href !== '/contabilidad' && pathname.startsWith(`${section.href}/`));

            return (
              <li key={section.href}>
                <Link
                  href={section.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex h-10 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors',
                    active
                      ? 'border-primary text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  <span>{section.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div>{children}</div>
    </PageHeader>
  );
}
