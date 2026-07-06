import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  /** Plural noun for the counted item, e.g. "empleados", "contratos". */
  itemLabel?: string;
  onPageChange: (page: number) => void;
  className?: string;
}

/**
 * Pagination — canoniza el patrón ya correcto de Lotes (DESIGN-SYSTEM.md §6.6).
 * Se oculta a sí misma cuando no hay más de una página.
 */
export function Pagination({
  page,
  totalPages,
  total,
  itemLabel = 'resultados',
  onPageChange,
  className,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div
      className={cn('flex items-center justify-between text-sm text-muted-foreground', className)}
    >
      <span>
        Página {page} de {totalPages} ({total} {itemLabel})
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Anterior
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Siguiente
        </Button>
      </div>
    </div>
  );
}
