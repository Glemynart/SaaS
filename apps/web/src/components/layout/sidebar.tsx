'use client';

import { PanelLeftClose, PanelLeftOpen, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useMe } from '@/features/auth/hooks/use-auth';
import { cn } from '@/lib/utils';
import { SidebarNav } from './sidebar-nav';
import { getUserInitials, UserMenu } from './user-menu';

interface SidebarProps {
  collapsed: boolean;
  /** Ausente en el drawer móvil: no muestra el disparador de colapso (§6.4 — mismo contenido expandido). */
  onToggleCollapsed?: () => void;
  onNavigate?: () => void;
}

/**
 * Contenido del sidebar (APP-SHELL.md §4): marca, navegación, disparador de
 * colapso y tarjeta de usuario. Un solo componente reutilizado por el sidebar
 * fijo (desktop) y el drawer móvil.
 */
export function Sidebar({ collapsed, onToggleCollapsed, onNavigate }: SidebarProps) {
  const me = useMe();

  return (
    <div className="flex h-full flex-col bg-canvas">
      <div
        className={cn(
          'flex h-14 shrink-0 items-center gap-3 border-b border-border px-5',
          collapsed && 'justify-center px-0',
        )}
      >
        <div className="brand-mark brand-mark-compact shrink-0" aria-hidden="true">
          <span>1</span>
        </div>
        {!collapsed && (
          <p className="truncate text-sm font-semibold tracking-[-0.01em]" translate="no">
            Dusema Gestión
          </p>
        )}
      </div>

      <SidebarNav collapsed={collapsed} role={me.data?.user.rol} onNavigate={onNavigate} />

      {onToggleCollapsed && (
        <div className="shrink-0 border-t border-border-soft px-3 py-2">
          <button
            type="button"
            onClick={onToggleCollapsed}
            title="Atajo de teclado: ["
            aria-label={collapsed ? 'Expandir navegación' : 'Colapsar navegación'}
            className={cn(
              'flex h-9 w-full items-center gap-3 rounded-[--radius-control] px-3 text-sm text-muted-foreground transition-colors duration-[--duration-fast] hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
              collapsed && 'justify-center px-0',
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4" aria-hidden="true" />
            ) : (
              <PanelLeftClose className="size-4" aria-hidden="true" />
            )}
            {!collapsed && 'Colapsar'}
          </button>
        </div>
      )}

      <div className="shrink-0 border-t border-border p-3">
        <SidebarUserCard collapsed={collapsed} />
      </div>
    </div>
  );
}

function SidebarUserCard({ collapsed }: { collapsed: boolean }) {
  const me = useMe();
  const user = me.data?.user;

  if (me.isLoading) {
    return (
      <div className={cn('flex items-center gap-2.5', collapsed && 'justify-center')}>
        <Skeleton className="size-8 shrink-0 rounded-full" />
        {!collapsed && (
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
        )}
      </div>
    );
  }

  if (me.isError) {
    return (
      <div className={cn('flex items-center gap-2', collapsed ? 'flex-col' : 'justify-between')}>
        {!collapsed && <p className="text-xs text-muted-foreground">Error de sesión</p>}
        <Button
          variant="outline"
          size="sm"
          className={collapsed ? 'h-8 w-8 p-0' : undefined}
          onClick={() => me.refetch()}
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          <span className={collapsed ? 'sr-only' : undefined}>Reintentar</span>
        </Button>
      </div>
    );
  }

  return (
    <UserMenu
      align="top"
      renderTrigger={({ open, triggerProps }) => (
        <button
          type="button"
          {...triggerProps}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-[--radius-control] p-1.5 text-left transition-colors duration-[--duration-fast] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
            collapsed && 'justify-center',
            open && 'bg-muted',
          )}
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-full border border-border bg-surface text-xs font-semibold text-foreground">
            {getUserInitials(user)}
          </span>
          {!collapsed && (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-foreground">
                {user?.nombre ? `${user.nombre} ${user.apellido ?? ''}`.trim() : user?.email}
              </span>
              <span className="block truncate text-xs text-muted-foreground">{user?.email}</span>
            </span>
          )}
        </button>
      )}
    />
  );
}
