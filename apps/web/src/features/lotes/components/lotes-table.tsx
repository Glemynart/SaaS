import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { LoteSummary, LoteEstado } from '../services/lotes-api';

const ESTADO_STYLE: Record<LoteEstado, string> = {
  PENDIENTE: 'bg-amber-50 text-amber-700 border-amber-200',
  EN_PROCESO: 'bg-blue-50 text-blue-700 border-blue-200',
  COMPLETADO: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  COMPLETADO_CON_ERRORES: 'bg-orange-50 text-orange-700 border-orange-200',
  FALLIDO: 'bg-red-50 text-red-700 border-red-200',
};

const ESTADO_LABEL: Record<LoteEstado, string> = {
  PENDIENTE: 'Pendiente',
  EN_PROCESO: 'En proceso',
  COMPLETADO: 'Completado',
  COMPLETADO_CON_ERRORES: 'Con errores',
  FALLIDO: 'Fallido',
};

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function LotesTable({ lotes, isLoading }: { lotes: LoteSummary[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (lotes.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
        No se encontraron lotes.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border bg-surface/50 text-muted-foreground">
          <tr>
            <th className="px-6 py-3 font-medium">Nombre</th>
            <th className="px-6 py-3 font-medium">Estado</th>
            <th className="px-6 py-3 font-medium">Plantilla</th>
            <th className="px-6 py-3 font-medium">Progreso</th>
            <th className="px-6 py-3 font-medium">Sede</th>
            <th className="px-6 py-3 font-medium">Creado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {lotes.map((l) => {
            const done = l.procesados + l.fallidos;
            return (
              <tr key={l.id} className="transition-colors hover:bg-muted/40">
                <td className="px-6 py-3">
                  <Link
                    href={`/contratos/lotes/${l.id}`}
                    className="font-medium text-foreground hover:underline"
                  >
                    {l.nombreLote}
                  </Link>
                </td>
                <td className="px-6 py-3">
                  <Badge className={ESTADO_STYLE[l.estado]}>
                    {ESTADO_LABEL[l.estado] ?? l.estado}
                  </Badge>
                </td>
                <td className="px-6 py-3 text-muted-foreground">{l.documentTemplate.nombre}</td>
                <td className="px-6 py-3 text-muted-foreground">
                  {done}/{l.total}
                  {l.fallidos > 0 && <span className="ml-1 text-red-600">({l.fallidos} err)</span>}
                </td>
                <td className="px-6 py-3 text-muted-foreground">{l.sede?.nombre ?? '—'}</td>
                <td className="px-6 py-3 text-muted-foreground">{formatDate(l.createdAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
