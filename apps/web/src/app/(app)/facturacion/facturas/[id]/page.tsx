'use client';

import { use } from 'react';
import Link from 'next/link';
import { useInvoice } from '@/features/billing/hooks/use-billing';
import { ArrowLeft, FileText } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

function cop(n: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(n);
}

export default function FacturaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: inv, isLoading } = useInvoice(id);

  if (isLoading)
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Skeleton className="h-96 w-full" />
      </div>
    );
  if (!inv)
    return <div className="text-center py-10 text-muted-foreground">Factura no encontrada.</div>;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/facturacion/facturas"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <FileText className="size-5 text-muted-foreground" />
        <h1 className="text-lg font-semibold">Factura {inv.numero}</h1>
        <Badge
          className={
            inv.status === 'DRAFT'
              ? 'bg-amber-50 text-amber-700'
              : inv.status === 'ISSUED'
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-gray-100'
          }
        >
          {inv.status}
        </Badge>
      </div>
      <div className="mb-6 rounded-lg border bg-surface/50 p-5 grid gap-3 sm:grid-cols-2">
        <div>
          <span className="text-xs text-muted-foreground">Cliente</span>
          <p className="text-sm font-medium">{inv.customer?.razonSocial}</p>
          <p className="text-xs text-muted-foreground">NIT: {inv.customer?.nit}</p>
        </div>
        <div>
          <span className="text-xs text-muted-foreground">Fecha</span>
          <p className="text-sm">{new Date(inv.fechaEmision).toLocaleDateString('es-CO')}</p>
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="border-b bg-surface/50 text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Descripción</th>
              <th className="px-4 py-3 text-right font-medium">Cant</th>
              <th className="px-4 py-3 text-right font-medium">V. Unit</th>
              <th className="px-4 py-3 text-right font-medium">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(inv.items ?? []).map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3">{item.descripcion}</td>
                <td className="px-4 py-3 text-right">{item.cantidad}</td>
                <td className="px-4 py-3 text-right">{cop(item.valorUnitario)}</td>
                <td className="px-4 py-3 text-right">{cop(item.subtotal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t bg-surface/30 font-medium">
            <tr>
              <td colSpan={3} className="px-4 py-2 text-right text-xs text-muted-foreground">
                Subtotal
              </td>
              <td className="px-4 py-2 text-right">{cop(inv.subtotal)}</td>
            </tr>
            <tr>
              <td colSpan={3} className="px-4 py-2 text-right text-xs text-muted-foreground">
                IVA (19%)
              </td>
              <td className="px-4 py-2 text-right">{cop(inv.impuestos)}</td>
            </tr>
            <tr className="text-base">
              <td colSpan={3} className="px-4 py-3 text-right font-semibold">
                Total
              </td>
              <td className="px-4 py-3 text-right font-semibold text-blue-600">{cop(inv.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
