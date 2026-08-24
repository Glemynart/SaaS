'use client';

import { Building2, Menu } from 'lucide-react';
import { useMe } from '@/features/auth/hooks/use-auth';
import { Breadcrumbs } from './breadcrumbs';
import { getUserInitials, UserMenu } from './user-menu';

interface HeaderProps {
  onOpenDrawer: () => void;
}

/**
 * Topbar (APP-SHELL.md §5): botón de drawer móvil, breadcrumbs, indicador de
 * empresa activa (no interactivo, H1/AS-D8) y menú de usuario. Sin título de
 * página (H6, lo posee PageHeader) ni badges de rol/MVP (NAV-06).
 */
export function Header({ onOpenDrawer }: HeaderProps) {
  const me = useMe();
  const user = me.data?.user;
  const tenantNombre = user?.tenantNombre;

  return (
    <header className="sticky top-0 z-(--z-sticky) flex h-14 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur sm:px-6">
      <button
        type="button"
        onClick={onOpenDrawer}
        aria-label="Abrir navegación"
        className="flex size-9 shrink-0 items-center justify-center rounded-(--radius-control) text-muted-foreground transition-colors duration-(--duration-fast) hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:hidden"
      >
        <Menu className="size-5" aria-hidden="true" />
      </button>

      <Breadcrumbs />

      <div className="flex-1" />

      {tenantNombre && (
        <div className="hidden min-w-0 items-center gap-2 rounded-(--radius-control) border border-border bg-surface px-3 py-1.5 md:flex">
          <Building2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span
            className="max-w-[10rem] truncate text-xs font-medium text-foreground"
            translate="no"
          >
            {tenantNombre}
          </span>
        </div>
      )}

      <UserMenu
        align="bottom"
        renderTrigger={({ triggerProps }) => (
          <button
            type="button"
            {...triggerProps}
            aria-label="Menú de usuario"
            className="grid size-8 shrink-0 place-items-center rounded-full border border-border bg-surface text-xs font-semibold text-foreground transition-colors duration-(--duration-fast) hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {getUserInitials(user)}
          </button>
        )}
      />
    </header>
  );
}
