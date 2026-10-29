'use client';

import { Loader2, LogOut, UserRound } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { useLogout, useMe } from '@/features/auth/hooks/use-auth';
import { useFocusTrap } from '@/hooks/use-focus-trap';
import { cn } from '@/lib/utils';
import type { AuthUser } from '@/types/auth';

const MENU_ITEM_SELECTOR = 'a[role="menuitem"], button[role="menuitem"]:not([disabled])';

/** Iniciales del avatar — compartidas por el header y la tarjeta del sidebar. */
export function getUserInitials(user: AuthUser | undefined): string {
  if (user?.nombre) return `${user.nombre[0]}${user.apellido?.[0] ?? ''}`.toUpperCase();
  return user?.email?.[0]?.toUpperCase() ?? '?';
}

interface UserMenuProps {
  /** 'bottom' = el header (avatar), abre hacia abajo. 'top' = tarjeta del sidebar, abre hacia arriba. */
  align: 'top' | 'bottom';
  renderTrigger: (props: {
    open: boolean;
    toggle: () => void;
    triggerProps: {
      'aria-haspopup': 'menu';
      'aria-expanded': boolean;
      onClick: () => void;
    };
  }) => React.ReactNode;
}

/**
 * Menú de usuario único (APP-SHELL.md §5.4), compartido por el avatar del
 * header y la tarjeta del sidebar. Contrato de popover: focus trap + retorno
 * de foco (reutiliza `useFocusTrap`, ya probado por SideSheet/ConfirmDialog),
 * flechas para navegar entre ítems, Esc y click-fuera cierran.
 */
export function UserMenu({ align, renderTrigger }: UserMenuProps) {
  const [open, setOpen] = React.useState(false);
  const me = useMe();
  const logout = useLogout();
  const user = me.data?.user;
  const panelRef = useFocusTrap(open);

  const close = React.useCallback(() => setOpen(false), []);

  React.useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        close();
        return;
      }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      const container = panelRef.current;
      if (!container) return;
      const items = Array.from(container.querySelectorAll<HTMLElement>(MENU_ITEM_SELECTOR));
      if (items.length === 0) return;
      event.preventDefault();
      const currentIndex = items.indexOf(document.activeElement as HTMLElement);
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      const nextIndex = (currentIndex + delta + items.length) % items.length;
      items[nextIndex]?.focus();
    }

    function handlePointerDown(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) close();
    }

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [open, close, panelRef]);

  const fullName = user?.nombre ? `${user.nombre} ${user.apellido ?? ''}`.trim() : user?.email;

  return (
    <div className="relative">
      {renderTrigger({
        open,
        toggle: () => setOpen((prev) => !prev),
        triggerProps: {
          'aria-haspopup': 'menu',
          'aria-expanded': open,
          onClick: () => setOpen((prev) => !prev),
        },
      })}

      {open && (
        <div
          ref={panelRef}
          role="menu"
          aria-label="Menú de usuario"
          className={cn(
            'absolute z-(--z-overlay) w-60 rounded-(--radius-card) border border-border bg-surface p-1.5 shadow-(--shadow-overlay)',
            align === 'bottom'
              ? 'right-0 top-[calc(100%+0.5rem)]'
              : 'bottom-[calc(100%+0.5rem)] left-0',
          )}
        >
          <div className="px-2.5 py-2">
            <p className="truncate text-sm font-medium text-foreground">{fullName ?? 'Cargando'}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
            {user?.rol && (
              <Badge variant="neutral" className="mt-2">
                {user.rol}
              </Badge>
            )}
          </div>

          <div className="my-1 h-px bg-border" role="separator" />

          <Link
            role="menuitem"
            href="/perfil"
            onClick={close}
            className="flex h-9 items-center gap-2.5 rounded-(--radius-control) px-2.5 text-sm text-foreground transition-colors duration-(--duration-fast) hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            <UserRound className="size-4 text-muted-foreground" aria-hidden="true" />
            Perfil
          </Link>

          <button
            role="menuitem"
            type="button"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
            className="flex h-9 w-full items-center gap-2.5 rounded-(--radius-control) px-2.5 text-left text-sm text-foreground transition-colors duration-(--duration-fast) hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-50"
          >
            {logout.isPending ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />
            ) : (
              <LogOut className="size-4 text-muted-foreground" aria-hidden="true" />
            )}
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}
