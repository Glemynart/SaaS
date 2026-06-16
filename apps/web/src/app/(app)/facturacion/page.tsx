'use client';

import Link from 'next/link';
import { useBillingDashboard } from '@/features/billing/hooks/use-billing';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, FileText, ClipboardList, DollarSign } from 'lucide-react';

function cop(n: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(n);
}

export default function FacturacionPage() {
  const { data: dash, isLoading } = useBillingDashboard();
  if (isLoading)
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8">
        <h1 className="text-lg font-semibold text-foreground">Facturación</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Dominio interno de clientes, productos y facturas.
        </p>
      </div>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Users className="size-3.5" />
            Clientes activos
          </div>
          <p className="mt-1 text-2xl font-semibold">{dash?.clientesActivos ?? 0}</p>
        </div>
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <FileText className="size-3.5" />
            Emitidas
          </div>
          <p className="mt-1 text-2xl font-semibold text-emerald-600">
            {dash?.facturasEmitidas ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ClipboardList className="size-3.5" />
            Borrador
          </div>
          <p className="mt-1 text-2xl font-semibold text-amber-600">
            {dash?.facturasBorrador ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <DollarSign className="size-3.5" />
            Total facturado
          </div>
          <p className="mt-1 text-2xl font-semibold text-blue-600">
            {cop(dash?.totalFacturado ?? 0)}
          </p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Link
          href="/facturacion/clientes"
          className="rounded-xl border border-border bg-white p-5 shadow-sm text-sm font-medium hover:bg-muted/40 transition-colors"
        >
          Clientes →
        </Link>
        <Link
          href="/facturacion/productos"
          className="rounded-xl border border-border bg-white p-5 shadow-sm text-sm font-medium hover:bg-muted/40 transition-colors"
        >
          Productos →
        </Link>
        <Link
          href="/facturacion/facturas"
          className="rounded-xl border border-border bg-white p-5 shadow-sm text-sm font-medium hover:bg-muted/40 transition-colors"
        >
          Facturas →
        </Link>
      </div>
    </div>
  );
}
