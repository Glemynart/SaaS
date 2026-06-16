'use client';

import Link from 'next/link';
import { usePayrollDashboard } from '@/features/payroll/hooks/use-payroll';
import { Skeleton } from '@/components/ui/skeleton';
import { Calculator, Users, Wallet, ArrowDown, ArrowUp } from 'lucide-react';

function cop(n: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(n);
}

export default function NominaPage() {
  const { data: dash, isLoading } = usePayrollDashboard();

  if (isLoading)
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-[-0.018em] text-foreground">Nómina</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Motor interno de cálculo y gestión de nómina.
          </p>
        </div>
        <Link
          href="/nomina/periodos"
          className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/92"
        >
          <Calculator className="size-4" /> Períodos
        </Link>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Calculator className="size-3.5" /> Períodos
          </div>
          <p className="mt-1 text-2xl font-semibold text-foreground">{dash?.totalPeriodos ?? 0}</p>
        </div>
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Users className="size-3.5" /> Empleados liquidados
          </div>
          <p className="mt-1 text-2xl font-semibold text-foreground">
            {dash?.empleadosLiquidados ?? 0}
          </p>
        </div>
      </div>

      {dash?.ultimoPeriodo && (
        <div className="mb-6 rounded-xl border border-border bg-surface/50 p-5">
          <p className="text-xs font-medium text-muted-foreground">
            Resumen del último período:{' '}
            <span className="text-foreground">{dash.ultimoPeriodo}</span>
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-border bg-white p-3">
              <div className="flex items-center gap-1.5 text-[0.65rem] font-medium text-muted-foreground">
                <ArrowUp className="size-3 text-emerald-500" /> Devengos
              </div>
              <p className="mt-0.5 text-lg font-semibold text-emerald-600">
                {cop(dash.totalDevengos)}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-white p-3">
              <div className="flex items-center gap-1.5 text-[0.65rem] font-medium text-muted-foreground">
                <ArrowDown className="size-3 text-red-500" /> Deducciones
              </div>
              <p className="mt-0.5 text-lg font-semibold text-red-600">
                {cop(dash.totalDeducciones)}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-white p-3">
              <div className="flex items-center gap-1.5 text-[0.65rem] font-medium text-muted-foreground">
                <Wallet className="size-3 text-blue-500" /> Neto
              </div>
              <p className="mt-0.5 text-lg font-semibold text-blue-600">{cop(dash.totalNeto)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
