import type { ReactNode } from 'react';
import Link from 'next/link';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="entry-canvas min-h-[100dvh]">
      <div className="mx-auto flex min-h-[100dvh] max-w-5xl flex-col px-5 py-7 sm:px-8">
        <Link
          href="/"
          className="flex w-fit items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label="La Oficina Nítida — Inicio"
        >
          <div className="brand-mark brand-mark-compact" aria-hidden="true">
            <span>1</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">La Oficina Nítida</p>
            <p className="text-xs text-muted-foreground">Operación multiempresa sin ruido</p>
          </div>
        </Link>

        <div className="flex flex-1 flex-col items-center justify-center py-12">{children}</div>
      </div>
    </main>
  );
}
