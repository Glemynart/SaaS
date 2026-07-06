'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { useAlerts } from '@/features/alerts/hooks/use-alerts';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/types/auth';
import {
  findActiveEntry,
  flattenNavTree,
  groupNavItems,
  isNavItemVisible,
  NAV_TREE,
  type NavItem,
} from './nav-tree';

// Ring en vez del truco de shadow arbitrario (mismo tratamiento visual que
// APP-SHELL.md §4.2, expresado con el token de borde vía `ring-*` en lugar de
// `shadow-[inset_...]`) — evita introducir una excepción DS-I1 nueva.
const ACTIVE_ITEM_CLASS = 'bg-surface text-foreground ring-1 ring-inset ring-border';

interface SidebarNavProps {
  collapsed: boolean;
  role?: UserRole;
  /** Cierra el drawer móvil al navegar (APP-SHELL.md §6.4); no aplica al sidebar fijo. */
  onNavigate?: () => void;
}

/**
 * Renderiza el árbol de navegación (grupos, ítems, subítems) para el sidebar
 * fijo y el drawer móvil. Cálculo de activo por regla única (§4.5); revelación
 * de subítems por auto-expansión de ruta + toggle manual recordado en sesión
 * (§4.4); colapsado muestra solo iconos con tooltip (§4.3).
 */
export function SidebarNav({ collapsed, role, onNavigate }: SidebarNavProps) {
  const pathname = usePathname();
  const flat = React.useMemo(() => flattenNavTree(), []);
  const activeEntry = React.useMemo(() => findActiveEntry(pathname, flat), [pathname, flat]);
  const [expandedOverrides, setExpandedOverrides] = React.useState<Record<string, boolean>>({});

  const alerts = useAlerts({ limit: 1 });
  const openCount = alerts.data?.stats.open ?? 0;
  const hasCritical = (alerts.data?.stats.critical ?? 0) > 0;

  const groups = React.useMemo(
    () => groupNavItems(NAV_TREE.filter((item) => isNavItemVisible(item, role))),
    [role],
  );

  function isAutoExpanded(item: NavItem): boolean {
    if (!activeEntry) return false;
    return (
      activeEntry.href === item.href ||
      (item.children?.some((c) => c.href === activeEntry.href) ?? false)
    );
  }

  return (
    <nav aria-label="Navegación principal" className="flex-1 overflow-y-auto px-3 py-4">
      {groups.map(({ group, items }, groupIndex) => (
        <div key={group ?? 'root'} className={groupIndex > 0 ? 'mt-6' : undefined}>
          {group && !collapsed && (
            <p className="mb-1.5 px-3 text-2xs font-medium uppercase tracking-wider text-muted-foreground/70">
              {group}
            </p>
          )}
          {group && collapsed && <div className="mx-2 mb-3 border-t border-border-soft" />}

          <ul className="space-y-1">
            {items.map((item) => {
              const active = activeEntry?.href === item.href;
              const hasChildren = !!item.children?.length;
              const expanded = expandedOverrides[item.href] ?? isAutoExpanded(item);
              const showBadge = item.badge === 'alerts-open-count' && openCount > 0;

              return (
                <li key={item.href}>
                  <div className="flex items-center gap-1">
                    <NavLink
                      item={item}
                      active={active || (hasChildren && isAutoExpanded(item) && !expanded)}
                      collapsed={collapsed}
                      showBadge={showBadge}
                      badgeCount={openCount}
                      badgeWarning={hasCritical}
                      onNavigate={onNavigate}
                    />
                    {hasChildren && !collapsed && (
                      <button
                        type="button"
                        className="flex size-7 shrink-0 items-center justify-center rounded-[--radius-control] text-muted-foreground transition-colors duration-[--duration-fast] hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                        aria-expanded={expanded}
                        aria-label={`${expanded ? 'Colapsar' : 'Expandir'} ${item.label}`}
                        onClick={() =>
                          setExpandedOverrides((prev) => ({ ...prev, [item.href]: !expanded }))
                        }
                      >
                        <ChevronRight
                          className={cn(
                            'size-4 transition-transform duration-[--duration-fast]',
                            expanded && 'rotate-90',
                          )}
                          aria-hidden="true"
                        />
                      </button>
                    )}
                  </div>

                  {hasChildren && !collapsed && (
                    <div
                      className={cn(
                        'grid transition-[grid-template-rows] duration-[--duration-base] ease-[--ease-out-ui]',
                        expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
                      )}
                    >
                      <div className="overflow-hidden">
                        <ul className="ml-[1.15rem] space-y-1 border-l border-border-soft py-1 pl-3">
                          {item
                            .children!.filter((child) => isNavItemVisible(child, role))
                            .map((child) => {
                              const childActive = activeEntry?.href === child.href;
                              return (
                                <li key={child.href}>
                                  <Link
                                    href={child.href}
                                    onClick={onNavigate}
                                    aria-current={childActive ? 'page' : undefined}
                                    className={cn(
                                      'flex h-8 items-center rounded-[--radius-control] px-2.5 text-sm transition-colors duration-[--duration-fast] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
                                      childActive
                                        ? ACTIVE_ITEM_CLASS
                                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                                    )}
                                  >
                                    {child.label}
                                  </Link>
                                </li>
                              );
                            })}
                        </ul>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

interface NavLinkProps {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  showBadge: boolean;
  badgeCount: number;
  badgeWarning: boolean;
  onNavigate?: () => void;
}

function NavLink({
  item,
  active,
  collapsed,
  showBadge,
  badgeCount,
  badgeWarning,
  onNavigate,
}: NavLinkProps) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={cn(
        'group relative flex h-9 flex-1 items-center gap-3 rounded-[--radius-control] px-3 text-sm transition-colors duration-[--duration-fast] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
        collapsed && 'justify-center px-0',
        active ? ACTIVE_ITEM_CLASS : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      <span className="relative shrink-0">
        <Icon className="size-4" aria-hidden="true" />
        {showBadge && collapsed && (
          <span
            className={cn(
              'absolute -right-0.5 -top-0.5 size-2 rounded-full border',
              badgeWarning ? 'border-warning/25 bg-warning/8' : 'border-border bg-muted',
            )}
            aria-hidden="true"
          />
        )}
      </span>

      {!collapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}

      {!collapsed && showBadge && (
        <Badge
          variant={badgeWarning ? 'warning' : 'neutral'}
          className="h-5 shrink-0 px-1.5 text-2xs"
        >
          {badgeCount}
        </Badge>
      )}

      {collapsed && (
        <span
          role="tooltip"
          className="pointer-events-none absolute left-full top-1/2 z-[--z-overlay] ml-2 -translate-y-1/2 whitespace-nowrap rounded-[--radius-control] border border-border bg-surface px-2 py-1 text-xs text-foreground opacity-0 shadow-[--shadow-overlay] transition-opacity duration-[--duration-fast] group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          {item.label}
        </span>
      )}
    </Link>
  );
}
