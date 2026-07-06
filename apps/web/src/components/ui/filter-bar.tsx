import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface FilterBarProps {
  /** Típicamente un Input de búsqueda. */
  search?: ReactNode;
  /** Selects u otros filtros de colección. */
  children?: ReactNode;
  /** Acciones de colección (exportar, nuevo, etc.), alineadas a la derecha. */
  actions?: ReactNode;
  className?: string;
}

/**
 * FilterBar — canoniza el toolbar ya usado en Lotes/Plantillas
 * (búsqueda + filtros + acciones, DESIGN-SYSTEM.md §6.6, APP-SHELL §8.3).
 */
export function FilterBar({ search, children, actions, className }: FilterBarProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      {search && <div className="min-w-0 flex-1 sm:max-w-sm">{search}</div>}
      {children && <div className="flex flex-wrap items-center gap-3">{children}</div>}
      {actions && <div className="flex items-center gap-2 sm:ml-auto">{actions}</div>}
    </div>
  );
}
