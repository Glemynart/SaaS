import { Skeleton } from '@/components/ui/skeleton';

/**
 * Skeleton que imita la anatomía de la pantalla (§9, AS §8.8): encabezado +
 * filas con la silueta de fila (indicador + dos líneas + acción). Sin spinner
 * central y sin entrada escalonada (DB-D9).
 */
export function BandejaSkeleton() {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8 space-y-2">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="rounded-(--radius-card) border border-border bg-surface shadow-(--shadow-card)">
        <div className="space-y-2 p-4">
          <Skeleton className="h-3 w-32" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-3">
              <Skeleton className="size-8 shrink-0 rounded-(--radius-control)" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-3/5" />
                <Skeleton className="h-3 w-2/5" />
              </div>
              <Skeleton className="h-8 w-24 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
