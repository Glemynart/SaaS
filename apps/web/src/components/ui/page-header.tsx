import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type PageWidth = 'detail' | 'standard' | 'wide';

const WIDTH_CLASS: Record<PageWidth, string> = {
  detail: 'max-w-3xl',
  standard: 'max-w-4xl',
  wide: 'max-w-6xl',
};

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Arquetipo de ancho de la página completa (DESIGN-SYSTEM.md §3.6). */
  width?: PageWidth;
  /** Acciones del PageHeader — una primaria (`Button` default) por página, el resto outline/ghost (§8.4 App Shell). */
  actions?: ReactNode;
  /** Resto de la anatomía de página (zona de resumen, FilterBar, contenido, Pagination — APP-SHELL §7). */
  children?: ReactNode;
  className?: string;
}

/**
 * PageHeader — única fuente del h1 de la página (DESIGN-SYSTEM.md §6.6,
 * resuelve NAV-04/TR-06). Materializa el arquetipo de ancho para toda la
 * página (§3.6): por eso envuelve también `children`, no solo el título.
 *
 * No publica breadcrumbs ni nombre de entidad al App Shell — ese mecanismo
 * es del App Shell (APP-SHELL.md §5.2) y queda fuera de este PR.
 */
export function PageHeader({
  title,
  description,
  width = 'standard',
  actions,
  children,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('mx-auto', WIDTH_CLASS[width], className)}>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-[-0.018em] text-foreground">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
