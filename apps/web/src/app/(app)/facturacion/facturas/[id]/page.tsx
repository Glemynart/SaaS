'use client';

import { use } from 'react';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  useCreateCustomerReceipt,
  useInvoice,
  useInvoiceReceiptApplications,
  useReverseCustomerReceipt,
} from '@/features/billing/hooks/use-billing';
import { useMe } from '@/features/auth/hooks/use-auth';
import { ArrowLeft, FileText } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { toast } from '@/components/ui/toast';
import type { CustomerReceiptMethod } from '@/features/billing/services/billing-api';

function cop(n: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(n);
}

function localToday() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function calendarDate(value: string) {
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(value));
}

export default function FacturaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: inv, isLoading } = useInvoice(id);
  const { data: receiptApplications = [] } = useInvoiceReceiptApplications(
    id,
    inv?.status === 'ISSUED',
  );
  const { data: me } = useMe();
  const createReceipt = useCreateCustomerReceipt();
  const reverseReceipt = useReverseCustomerReceipt();
  const [monto, setMonto] = useState('');
  const [fechaRecibo, setFechaRecibo] = useState('');
  const [medio, setMedio] = useState<CustomerReceiptMethod>('TRANSFERENCIA');
  const [referencia, setReferencia] = useState('');
  const requestKey = useRef<{ signature: string; key: string } | null>(null);

  useEffect(() => {
    setFechaRecibo((current) => current || localToday());
  }, []);

  async function submitReceipt(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!inv) return;
    const amount = Number(monto);
    const saldoPendiente = Number(inv.saldoPendiente ?? inv.total);
    if (!Number.isFinite(amount) || amount <= 0 || amount > saldoPendiente) {
      toast.error(`Ingrese un valor mayor que cero y no superior a ${cop(saldoPendiente)}.`);
      return;
    }
    const payload = {
      customerId: inv.customerId,
      fechaRecibo,
      medio,
      referencia: referencia.trim() || undefined,
      monto: amount,
      aplicaciones: [{ invoiceId: inv.id, amount }],
    };
    const signature = JSON.stringify(payload);
    if (requestKey.current?.signature !== signature) {
      requestKey.current = { signature, key: crypto.randomUUID() };
    }
    try {
      await createReceipt.mutateAsync({
        ...payload,
        idempotencyKey: requestKey.current.key,
      });
      requestKey.current = null;
      setMonto('');
      setReferencia('');
      toast.success('Recaudo registrado y contabilizado en el Ledger.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo registrar el recaudo.');
    }
  }

  async function reverse(receiptId: string) {
    const reason = window.prompt('Motivo para reversar el recaudo:')?.trim();
    if (!reason) return;
    try {
      await reverseReceipt.mutateAsync({ id: receiptId, reason });
      toast.success('Recaudo reversado. El saldo pendiente fue actualizado.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo reversar el recaudo.');
    }
  }

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
      <div className="mb-6 rounded-lg border bg-surface/50 p-5 grid gap-3 sm:grid-cols-3">
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
        <div>
          <span className="text-xs text-muted-foreground">Vencimiento</span>
          <p className="text-sm">
            {inv.fechaVencimiento
              ? calendarDate(inv.fechaVencimiento)
              : 'Sin vencimiento registrado'}
          </p>
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
      {inv.status === 'ISSUED' && (
        <section
          className="mb-6 rounded-lg border bg-surface/50 p-5"
          aria-labelledby="receipts-title"
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="receipts-title" className="text-sm font-semibold">
                Cartera y recaudos
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Abonos aplicados y saldo calculados desde los recaudos registrados.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-x-5 gap-y-1 text-right text-sm">
              <span className="text-muted-foreground">Abonado</span>
              <strong>{cop(Number(inv.totalPagado ?? 0))}</strong>
              <span className="text-muted-foreground">Pendiente</span>
              <strong>{cop(Number(inv.saldoPendiente ?? inv.total))}</strong>
              {inv.fechaVencimiento && Number(inv.saldoPendiente ?? 0) > 0 && (
                <>
                  <span className="text-muted-foreground">Estado</span>
                  <strong
                    className={
                      inv.fechaVencimiento.slice(0, 10) < localToday()
                        ? 'text-destructive'
                        : 'text-foreground'
                    }
                  >
                    {inv.fechaVencimiento.slice(0, 10) < localToday() ? 'Vencida' : 'Al día'}
                  </strong>
                </>
              )}
            </div>
          </div>
          {!inv.comprobanteContable ? (
            <p
              role="status"
              className="mt-4 rounded-md border border-warning/25 bg-warning/8 p-3 text-sm text-warning"
            >
              Esta factura no tiene un comprobante de emisión activo; no se puede aplicar cartera
              retroactivamente.
            </p>
          ) : Number(inv.saldoPendiente ?? inv.total) > 0 &&
            ['ADMIN', 'OPERADOR'].includes(me?.user.rol ?? '') ? (
            <form onSubmit={submitReceipt} className="mt-5 grid gap-3 border-t pt-4 sm:grid-cols-2">
              <label className="grid gap-1 text-xs font-medium">
                Valor recibido (COP)
                <input
                  type="number"
                  min="0.01"
                  max={Number(inv.saldoPendiente ?? inv.total)}
                  step="0.01"
                  required
                  value={monto}
                  onChange={(event) => setMonto(event.target.value)}
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                />
              </label>
              <label className="grid gap-1 text-xs font-medium">
                Fecha de recepción
                <input
                  type="date"
                  required
                  value={fechaRecibo}
                  onChange={(event) => setFechaRecibo(event.target.value)}
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                />
              </label>
              <label className="grid gap-1 text-xs font-medium">
                Medio
                <select
                  value={medio}
                  onChange={(event) => setMedio(event.target.value as CustomerReceiptMethod)}
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                >
                  <option value="TRANSFERENCIA">Transferencia</option>
                  <option value="EFECTIVO">Efectivo</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs font-medium">
                Referencia (opcional)
                <input
                  maxLength={120}
                  value={referencia}
                  onChange={(event) => setReferencia(event.target.value)}
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                />
              </label>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={createReceipt.isPending || !fechaRecibo}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  {createReceipt.isPending ? 'Registrando…' : 'Registrar recaudo'}
                </button>
              </div>
            </form>
          ) : Number(inv.saldoPendiente ?? inv.total) <= 0 ? (
            <p className="mt-4 border-t pt-4 text-sm text-success">Factura sin saldo pendiente.</p>
          ) : null}
          <div className="mt-4 border-t pt-3">
            <h3 className="text-xs font-semibold">Historial de recaudos</h3>
            {receiptApplications.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Todavía no hay recaudos aplicados.
              </p>
            ) : (
              <ul className="mt-2 divide-y">
                {receiptApplications.map((application) => {
                  const receipt = application.receipt;
                  const reversed = receipt.reversal !== null;
                  return (
                    <li
                      key={application.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-3 text-xs"
                    >
                      <div>
                        <p className="font-medium">
                          {calendarDate(receipt.fechaRecibo)} ·{' '}
                          {receipt.medio === 'EFECTIVO' ? 'Efectivo' : 'Transferencia'} ·{' '}
                          {cop(Number(application.amount))}
                        </p>
                        <p className="text-muted-foreground">
                          {receipt.referencia ? `Ref. ${receipt.referencia} · ` : ''}
                          {reversed
                            ? 'Reversado'
                            : `Comprobante ${application.comprobanteContable?.numero ?? '—'}`}
                        </p>
                      </div>
                      {!reversed && me?.user.rol === 'ADMIN' && (
                        <button
                          type="button"
                          disabled={reverseReceipt.isPending}
                          onClick={() => void reverse(receipt.id)}
                          className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
                        >
                          Reversar
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
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
