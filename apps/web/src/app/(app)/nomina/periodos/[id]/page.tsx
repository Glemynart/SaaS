'use client';

import { use } from 'react';
import Link from 'next/link';
import { usePayrollPeriod } from '@/features/payroll/hooks/use-payroll';
import { ArrowLeft } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

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

  if (isLoading)
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  if (!data)
    return <div className="text-center py-10 text-muted-foreground">Período no encontrado.</div>;

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
        <Badge
          className={
            period.status === 'CLOSED'
              ? 'bg-gray-100 text-gray-600'
              : 'bg-emerald-50 text-emerald-700'
          }
        >
          {period.status === 'CLOSED' ? 'Cerrado' : 'Borrador'}
        </Badge>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <p className="text-[0.68rem] text-muted-foreground">Total devengos</p>
          <p className="mt-1 text-xl font-semibold text-emerald-600">{cop(totals.totalDevengos)}</p>
        </div>
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <p className="text-[0.68rem] text-muted-foreground">Total deducciones</p>
          <p className="mt-1 text-xl font-semibold text-red-600">{cop(totals.totalDeducciones)}</p>
        </div>
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <p className="text-[0.68rem] text-muted-foreground">Total neto</p>
          <p className="mt-1 text-xl font-semibold text-blue-600">{cop(totals.totalNeto)}</p>
        </div>
      </div>

      {runs.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
          Sin liquidaciones. Usá &ldquo;Generar&rdquo; desde la lista de períodos.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-white">
          <div className="divide-y divide-border">
            {runs.map((r) => (
              <div key={r.id} className="px-5 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {r.employee.nombre} {r.employee.apellido}
                    </p>
                    <p className="text-xs text-muted-foreground">{r.employee.cargo}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-foreground">{cop(r.netoPagar)}</p>
                    <div className="flex gap-2 text-[0.65rem]">
                      <span className="text-emerald-600">+{cop(r.totalDevengos)}</span>
                      <span className="text-red-600">-{cop(r.totalDeducciones)}</span>
                    </div>
                  </div>
                </div>
                {r.concepts.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {r.concepts.map((c) => (
                      <span
                        key={c.id}
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[0.65rem] ${c.tipo === 'EARNING' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}
                      >
                        {c.nombre}: {cop(c.valor)}
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
