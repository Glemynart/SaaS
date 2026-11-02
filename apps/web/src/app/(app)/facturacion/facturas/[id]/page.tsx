'use client';

import { use } from 'react';
import Link from 'next/link';
import { useInvoice } from '@/features/billing/hooks/use-billing';
import { ArrowLeft, FileText } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';

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
          <p className="text-sm font-medium">
            {inv.customerRazonSocialSnapshot ?? inv.customer?.razonSocial}
          </p>
          <p className="text-xs text-muted-foreground">
            NIT: {inv.customerNitSnapshot ?? inv.customer?.nit}
          </p>
        </div>
        <div>
          <span className="text-xs text-muted-foreground">Fecha</span>
          <p className="text-sm">{new Date(inv.fechaEmision).toLocaleDateString('es-CO')}</p>
        </div>
      </div>
      {inv.status === 'ISSUED' && !inv.comprobanteContable && (
        <p
          role="status"
          className="mb-6 rounded-md border border-warning/25 bg-warning/8 p-3 text-sm text-warning"
        >
          Esta factura se emitió antes de la integración con el Ledger y no tiene comprobante
          contable. No se contabiliza retroactivamente; cree una factura nueva para registrar el
          asiento.
        </p>
      )}
      {inv.comprobanteContable && (
        <section className="mb-6 rounded-lg border bg-surface/50 p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold">Contabilización interna</h2>
              <p className="text-xs text-muted-foreground">
                {inv.comprobanteContable.tipoComprobante.nombre} N.º{' '}
                {inv.comprobanteContable.numero ?? '—'} · {inv.comprobanteContable.estado}
              </p>
              {inv.terceroRazonSocialSnapshot && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Tercero: {inv.terceroRazonSocialSnapshot} · {inv.terceroNumeroDocumentoSnapshot}
                </p>
              )}
            </div>
            <p className="text-xs font-medium">
              Débitos {cop(Number(inv.comprobanteContable.totalDebito))} · Créditos{' '}
              {cop(Number(inv.comprobanteContable.totalCredito))}
            </p>
          </div>
          <div className="mt-3 divide-y border-t">
            {inv.comprobanteContable.movimientos.map((movimiento) => (
              <div
                key={movimiento.linea}
                className="flex items-center justify-between gap-3 py-2 text-xs"
              >
                <span>
                  {movimiento.cuenta.codigo} · {movimiento.cuenta.nombre}
                </span>
                <span className="whitespace-nowrap">
                  D {cop(Number(movimiento.debito))} / C {cop(Number(movimiento.credito))}
                </span>
              </div>
            ))}
          </div>
          {inv.comprobanteContable.reversos.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              Reversos:{' '}
              {inv.comprobanteContable.reversos
                .map((r) => `N.º ${r.numero ?? '—'} (${r.estado})`)
                .join(', ')}
            </p>
          )}
        </section>
      )}
      <div className="overflow-hidden rounded-xl border bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b bg-surface/50 text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Descripción</th>
              <th className="px-4 py-3 text-right font-medium">Cant</th>
              <th className="px-4 py-3 text-right font-medium">V. Unit</th>
              <th className="px-4 py-3 text-right font-medium">Subtotal</th>
              <th className="px-4 py-3 text-right font-medium">IVA %</th>
              <th className="px-4 py-3 text-right font-medium">IVA</th>
              <th className="px-4 py-3 text-right font-medium">Total línea</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(inv.items ?? []).map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3">{item.descripcion}</td>
                <td className="px-4 py-3 text-right">{item.cantidad}</td>
                <td className="px-4 py-3 text-right">{cop(item.valorUnitario)}</td>
                <td className="px-4 py-3 text-right">{cop(item.subtotal)}</td>
                <td className="px-4 py-3 text-right">
                  {item.porcentajeImpuesto === null ? '—' : `${item.porcentajeImpuesto}%`}
                </td>
                <td className="px-4 py-3 text-right">
                  {item.valorImpuesto === null ? '—' : cop(item.valorImpuesto)}
                </td>
                <td className="px-4 py-3 text-right">
                  {item.valorImpuesto === null
                    ? '—'
                    : cop(Number(item.subtotal) + Number(item.valorImpuesto))}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t bg-surface/30 font-medium">
            <tr>
              <td colSpan={6} className="px-4 py-2 text-right text-xs text-muted-foreground">
                Subtotal
              </td>
              <td className="px-4 py-2 text-right">{cop(inv.subtotal)}</td>
            </tr>
            <tr>
              <td colSpan={6} className="px-4 py-2 text-right text-xs text-muted-foreground">
                Impuestos según tasas congeladas en las líneas
              </td>
              <td className="px-4 py-2 text-right">{cop(inv.impuestos)}</td>
            </tr>
            <tr className="text-base">
              <td colSpan={6} className="px-4 py-3 text-right font-semibold">
                Total
              </td>
              <td className="px-4 py-3 text-right font-semibold text-primary">{cop(inv.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
