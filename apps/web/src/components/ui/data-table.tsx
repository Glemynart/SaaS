import type { ReactNode } from 'react';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  headerClassName?: string;
  cellClassName?: string;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  rowKey: (row: T) => string;
  isLoading?: boolean;
  /** Si se define, la fila entera navega a esta ruta (resuelve EMP-04). */
  rowHref?: (row: T) => string;
  /** Nombre accesible de la fila navegable; por defecto "Ver detalle". */
  rowHrefLabel?: (row: T) => string;
  empty?: ReactNode;
  skeletonRows?: number;
  density?: 'comfortable' | 'compact';
  className?: string;
}

const CELL_PADDING = {
  comfortable: 'px-6 py-4',
  compact: 'px-4 py-2.5',
};

/**
 * DataTable — encabezados, densidad, hover de fila, celda de acciones y
 * empty/loading integrados (DESIGN-SYSTEM.md §6.6, APP-SHELL §8.1).
 *
 * Fila navegable (`rowHref`): se implementa con un `<Link>` real absolutamente
 * posicionado dentro de la primera celda, usando la fila (`position: relative`)
 * como contenedor — un "stretched link" semánticamente correcto (foco y
 * teclado nativos de un enlace real), en lugar de `role="button"` sobre `<tr>`
 * (que anidaría interactivo-en-interactivo con los botones de la celda de
 * acciones). La última columna se eleva con `z-10` para que sus controles
 * sigan siendo clicables por encima del enlace de fila (§8.1: "acciones nunca
 * solo-hover").
 */
export function DataTable<T>({
  columns,
  data,
  rowKey,
  isLoading = false,
  rowHref,
  rowHrefLabel,
  empty,
  skeletonRows = 5,
  density = 'comfortable',
  className,
}: DataTableProps<T>) {
  const padding = CELL_PADDING[density];
  const lastColumnIndex = columns.length - 1;

  return (
    <div
      className={cn(
        'overflow-hidden rounded-(--radius-card) border border-border bg-surface shadow-(--shadow-card)',
        className,
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-canvas text-muted-foreground">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={cn(padding, 'font-medium', col.headerClassName)}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-soft">
            {isLoading &&
              Array.from({ length: skeletonRows }).map((_, i) => (
                <tr key={i}>
                  {columns.map((col) => (
                    <td key={col.key} className={padding}>
                      <Skeleton className="h-4 w-full max-w-[12rem]" />
                    </td>
                  ))}
                </tr>
              ))}

            {!isLoading &&
              data.map((row) => {
                const href = rowHref?.(row);
                return (
                  <tr
                    key={rowKey(row)}
                    className={cn('relative transition-colors', href && 'hover:bg-muted/40')}
                  >
                    {columns.map((col, i) => (
                      <td
                        key={col.key}
                        className={cn(
                          padding,
                          'text-foreground',
                          i === lastColumnIndex && href && 'relative z-10',
                          col.cellClassName,
                        )}
                      >
                        {i === 0 && href && (
                          <Link
                            href={href}
                            className="absolute inset-0 z-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                          >
                            <span className="sr-only">{rowHrefLabel?.(row) ?? 'Ver detalle'}</span>
                          </Link>
                        )}
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {!isLoading && data.length === 0 && (
        <div className="p-2">{empty ?? <EmptyState title="No se encontraron resultados." />}</div>
      )}
    </div>
  );
}
