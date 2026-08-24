'use client';

import * as React from 'react';
import type { ReactNode } from 'react';
import { useSidebarCollapsed } from '@/hooks/use-sidebar-collapsed';
import { cn } from '@/lib/utils';
import { Header } from './header';
import { MobileDrawer } from './mobile-drawer';
import { Sidebar } from './sidebar';

/**
 * App Shell v2 (APP-SHELL.md) — contenedor maestro: sidebar fijo (colapsable
 * y persistente), drawer móvil, header con breadcrumbs, skip link. No conoce
 * páginas (principio 4): un módulo nuevo solo añade su entrada al nav-tree.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { collapsed, toggle } = useSidebarCollapsed();
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4 focus-visible:z-(--z-overlay) focus-visible:rounded-(--radius-control) focus-visible:bg-surface focus-visible:px-4 focus-visible:py-2 focus-visible:text-sm focus-visible:font-medium focus-visible:text-foreground focus-visible:shadow-(--shadow-overlay) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        Saltar al contenido
      </a>

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-(--z-shell) hidden border-r border-border transition-[width] duration-(--duration-base) ease-(--ease-out-ui) lg:block',
          collapsed ? 'w-16' : 'w-[17.5rem]',
        )}
      >
        <Sidebar collapsed={collapsed} onToggleCollapsed={toggle} />
      </aside>

      <MobileDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />

      <div
        className={cn(
          'transition-[padding-left] duration-(--duration-base) ease-(--ease-out-ui)',
          collapsed ? 'lg:pl-16' : 'lg:pl-[17.5rem]',
        )}
      >
        <Header onOpenDrawer={() => setDrawerOpen(true)} />
        <main id="main-content" className="px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
