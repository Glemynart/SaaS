'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';
import { cn } from '@/lib/utils';
import { findActiveEntry, flattenNavTree } from './nav-tree';

// Segmentos literales de ruta que no son parámetros dinámicos (H7) y tienen
// una etiqueta de presentación fija — no requieren nombre publicado por la página.
const STATIC_SEGMENT_LABELS: Record<string, string> = {
  expediente: 'Expediente',
};

interface Crumb {
  label: string;
  href: string;
}

// Sin mecanismo de publicación de nombre de entidad desde la página (ver nota
// de alcance del PR): para segmentos dinámicos ([id]) se muestra el segmento
// de ruta real, truncado, en vez de un nombre inventado o un skeleton sin
// productor. Se reemplaza módulo a módulo en F2 cuando cada pantalla adopte
// el mecanismo de PageHeader (APP-SHELL.md §5.2).
function humanizeDynamicSegment(segment: string): string {
  const decoded = decodeURIComponent(segment);
  return decoded.length > 10 ? `${decoded.slice(0, 8)}…` : decoded;
}

function buildCrumbs(pathname: string): Crumb[] {
  if (pathname === '/dashboard') return [{ label: 'Inicio', href: '/dashboard' }];

  const entry = findActiveEntry(pathname, flattenNavTree());

  if (!entry) {
    const segments = pathname.split('/').filter(Boolean);
    const last = segments[segments.length - 1] ?? '';
    const label = last ? last.charAt(0).toUpperCase() + last.slice(1) : 'Inicio';
    return [{ label, href: pathname }];
  }

  const crumbs: Crumb[] = [];
  if (entry.parent) crumbs.push({ label: entry.parent.label, href: entry.parent.href });
  crumbs.push({ label: entry.label, href: entry.href });

  const remaining = pathname.slice(entry.href.length).split('/').filter(Boolean);
  let cumulative = entry.href;
  for (const segment of remaining) {
    cumulative = `${cumulative}/${segment}`;
    crumbs.push({
      label: STATIC_SEGMENT_LABELS[segment] ?? humanizeDynamicSegment(segment),
      href: cumulative,
    });
  }

  return crumbs;
}

/**
 * Breadcrumbs derivados del nav-tree (APP-SHELL.md §5.2, AS-D7). Prioridad de
 * supervivencia en anchos menores (§6.2): en `<md` solo se muestra el último
 * segmento.
 */
export function Breadcrumbs() {
  const pathname = usePathname();
  const crumbs = React.useMemo(() => buildCrumbs(pathname), [pathname]);

  return (
    <nav aria-label="Ruta de navegación" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-sm">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <li
              key={crumb.href}
              className={cn('flex min-w-0 items-center gap-1.5', !isLast && 'hidden md:flex')}
            >
              {isLast ? (
                <span className="truncate font-medium text-foreground" aria-current="page">
                  {crumb.label}
                </span>
              ) : (
                <>
                  <Link
                    href={crumb.href}
                    className="truncate text-muted-foreground transition-colors duration-(--duration-fast) hover:text-foreground"
                  >
                    {crumb.label}
                  </Link>
                  <ChevronRight
                    className="size-3.5 shrink-0 text-muted-foreground/60"
                    aria-hidden="true"
                  />
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
