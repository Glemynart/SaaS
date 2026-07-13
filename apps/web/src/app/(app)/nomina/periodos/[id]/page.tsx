'use client';

import { use } from 'react';
import Link from 'next/link';
import {
  useExcludePayrollBlock,
  usePayrollBlocks,
  usePayrollPeriod,
} from '@/features/payroll/hooks/use-payroll';
import { ArrowLeft } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatNombreCompleto } from '@saas/types';

function cop(n: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(n);
}

export default function PeriodDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isLoading } = usePayrollPeriod(id);
  const { data: blocks } = usePayrollBlocks(id);
  const excludeMutation = useExcludePayrollBlock();

  if (isLoading)
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  if (!data)
    return <div className="py-10 text-center text-muted-foreground">Periodo no encontrado.</div>;

  const { period, runs, totals } = data;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/nomina/periodos"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-foreground">{period.nombre}</h1>
        </div>
        <StatusBadge domain="nominaN2" estado={period.status} />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <p className="text-2xs text-muted-foreground">Total devengos</p>
          <p className="mt-1 text-xl font-semibold text-success">{cop(totals.totalDevengos)}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <p className="text-2xs text-muted-foreground">Total deducciones</p>
          <p className="mt-1 text-xl font-semibold text-destructive">
            {cop(totals.totalDeducciones)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <p className="text-2xs text-muted-foreground">Total neto</p>
          <p className="mt-1 text-xl font-semibold text-info">{cop(totals.totalNeto)}</p>
        </div>
      </div>

      {(blocks ?? []).length > 0 && (
        <div className="mb-6 overflow-hidden rounded-xl border border-border bg-surface">
          <div className="divide-y divide-border">
            {(blocks ?? []).map((block) => (
              <div key={block.id} className="flex items-start justify-between gap-4 px-5 py-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">
                      {formatNombreCompleto(block.employee)}
                    </p>
                    <StatusBadge domain="payrollBlock" estado={block.status} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{block.message}</p>
                  {block.excludedBy && (
                    <p className="mt-1 text-2xs text-muted-foreground/70">
                      Excluido por {block.excludedBy.nombre} {block.excludedBy.apellido}
                    </p>
                  )}
                </div>
                {block.status === 'ACTIVE' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => excludeMutation.mutate({ blockId: block.id })}
                    disabled={excludeMutation.isPending}
                  >
                    Excluir
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {runs.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
          Sin liquidaciones. Usa Generar desde la lista de periodos.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <div className="divide-y divide-border">
            {runs.map((r) => (
              <div key={r.id} className="px-5 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {formatNombreCompleto(r.employee)}
                    </p>
                    <p className="text-xs text-muted-foreground">{r.employee.cargo}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-foreground">{cop(r.netoPagar)}</p>
                    <div className="flex gap-2 text-2xs">
                      <span className="text-success">+{cop(r.totalDevengos)}</span>
                      <span className="text-destructive">-{cop(r.totalDeducciones)}</span>
                    </div>
                  </div>
                </div>
                {r.concepts.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {r.concepts.map((c) => (
                      <span key={c.id} className="inline-flex">
                        <Badge variant={c.tipo === 'EARNING' ? 'success' : 'danger'}>
                          {c.nombre}: {cop(c.valor)}
                        </Badge>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
