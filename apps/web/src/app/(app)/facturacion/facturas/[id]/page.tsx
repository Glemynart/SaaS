'use client';

import { use } from 'react';
import Link from 'next/link';
import { useInvoice } from '@/features/billing/hooks/use-billing';
import { ArrowLeft, BookOpenCheck, FileText } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';

function cop(n: number | string) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(Number(n));
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
        <StatusBadge
          domain="factura"
          estado={
            inv.status === 'DRAFT' ? 'BORRADOR' : inv.status === 'ISSUED' ? 'EMITIDA' : 'ANULADA'
          }
        />
      </div>
      <div className="mb-6 rounded-lg border bg-surface/50 p-5 grid gap-3 sm:grid-cols-2">
        <div>
          <span className="text-xs text-muted-foreground">Cliente</span>
          <p className="text-sm font-medium">{inv.customer?.razonSocial}</p>
          <p className="text-xs text-muted-foreground">NIT: {inv.customer?.nit}</p>
        </div>
        <div>
          <span className="text-xs text-muted-foreground">Fecha</span>
          <p className="text-sm">
            {new Date(inv.fechaEmision).toLocaleDateString('es-CO', {
              timeZone: 'America/Bogota',
            })}
          </p>
        </div>
      </div>
      <section className="mb-6 rounded-lg border bg-surface p-5">
        <div className="flex items-center gap-2">
          <BookOpenCheck className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Contabilidad</h2>
        </div>
        {inv.comprobanteContable ? (
          <div className="mt-3 space-y-2 text-sm">
            <p>
              Comprobante {inv.comprobanteContable.numero ?? 'sin número'} —{' '}
              {inv.comprobanteContable.estado === 'CONTABILIZADO' ? 'contabilizado' : 'anulado'}
            </p>
            <p className="text-xs text-muted-foreground">
              Débito {cop(inv.comprobanteContable.totalDebito)} · Crédito{' '}
              {cop(inv.comprobanteContable.totalCredito)}
            </p>
            {inv.comprobanteContable.reversos?.map((reverso) => (
              <p key={reverso.id}>
                Reverso {reverso.numero ?? 'sin número'} —{' '}
                {reverso.estado === 'CONTABILIZADO' ? 'contabilizado' : 'anulado'}
              </p>
            ))}
            <Link
              href="/contabilidad/comprobantes"
              className="inline-flex text-xs text-primary hover:underline"
            >
              Abrir comprobantes contables
            </Link>
          </div>
        ) : inv.status === 'ISSUED' ? (
          <p className="mt-3 text-sm text-warning">
            Esta factura emitida no tiene un comprobante asociado y requiere revisión contable.
          </p>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            La factura se contabiliza al emitirla. Los borradores cancelados no generan asiento.
          </p>
        )}
      </section>
      <div className="overflow-hidden rounded-xl border bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b bg-surface/50 text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Descripción</th>
              <th className="px-4 py-3 text-right font-medium">Cant</th>
              <th className="px-4 py-3 text-right font-medium">V. Unit</th>
              <th className="px-4 py-3 text-right font-medium">Tasa %</th>
              <th className="px-4 py-3 text-right font-medium">Valor calculado</th>
              <th className="px-4 py-3 text-right font-medium">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(inv.items ?? []).map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3">{item.descripcion}</td>
                <td className="px-4 py-3 text-right">{Number(item.cantidad)}</td>
                <td className="px-4 py-3 text-right">{cop(item.valorUnitario)}</td>
                <td className="px-4 py-3 text-right">
                  {item.impuestoTarifa === null ? '—' : `${item.impuestoTarifa}%`}
                </td>
                <td className="px-4 py-3 text-right">
                  {item.impuestoValor === null ? '—' : cop(item.impuestoValor)}
                </td>
                <td className="px-4 py-3 text-right">{cop(item.subtotal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t bg-surface/30 font-medium">
            <tr>
              <td colSpan={5} className="px-4 py-2 text-right text-xs text-muted-foreground">
                Subtotal
              </td>
              <td className="px-4 py-2 text-right">{cop(inv.subtotal)}</td>
            </tr>
            <tr>
              <td colSpan={5} className="px-4 py-2 text-right text-xs text-muted-foreground">
                Impuestos calculados por línea
              </td>
              <td className="px-4 py-2 text-right">{cop(inv.impuestos)}</td>
            </tr>
            <tr className="text-base">
              <td colSpan={5} className="px-4 py-3 text-right font-semibold">
                Total
              </td>
              <td className="px-4 py-3 text-right font-semibold text-primary">{cop(inv.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {(inv.items ?? []).some(
        (item) => item.impuestoTarifa === null || item.impuestoValor === null,
      ) && (
        <p className="mt-3 text-xs text-muted-foreground">
          Esta factura histórica no conserva snapshot de impuesto por línea.
        </p>
      )}
    </div>
  );
}
