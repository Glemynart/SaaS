'use client';

import { use } from 'react';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  useCustomerReceivableInvoices,
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
import type {
  CustomerReceiptMethod,
  InvoiceReceiptApplication,
} from '@/features/billing/services/billing-api';

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

function amountToCents(value: string): number | null {
  const normalized = value.trim();
  if (!normalized) return 0;
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ''] = normalized.split('.');
  const cents = BigInt(whole) * BigInt(100) + BigInt((fraction + '00').slice(0, 2));
  return cents <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(cents) : null;
}

export default function FacturaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: inv, isLoading } = useInvoice(id);
  const { data: receiptApplications = [] } = useInvoiceReceiptApplications(
    id,
    inv?.status === 'ISSUED',
  );
  const {
    data: receivableInvoices,
    isLoading: isLoadingReceivableInvoices,
    isError: hasReceivableInvoicesError,
  } = useCustomerReceivableInvoices(inv?.customerId ?? '', inv?.status === 'ISSUED');
  const { data: me } = useMe();
  const createReceipt = useCreateCustomerReceipt();
  const reverseReceipt = useReverseCustomerReceipt();
  const [aplicaciones, setAplicaciones] = useState<Record<string, string>>({});
  const [fechaRecibo, setFechaRecibo] = useState('');
  const [medio, setMedio] = useState<CustomerReceiptMethod>('TRANSFERENCIA');
  const [referencia, setReferencia] = useState('');
  const requestKey = useRef<{ signature: string; key: string } | null>(null);

  useEffect(() => {
    setFechaRecibo((current) => current || localToday());
  }, []);

  useEffect(() => {
    if (!receivableInvoices) return;
    setAplicaciones((current) =>
      Object.fromEntries(
        receivableInvoices.map((invoice) => [invoice.id, current[invoice.id] ?? '']),
      ),
    );
  }, [receivableInvoices]);

  const allocationLines = (receivableInvoices ?? []).map((invoice) => {
    const rawAmount = aplicaciones[invoice.id] ?? '';
    const amountCents = amountToCents(rawAmount);
    const balanceCents = amountToCents(String(invoice.saldoPendiente));
    return { invoice, rawAmount, amountCents, balanceCents };
  });
  const invalidAllocation = allocationLines.some(
    ({ rawAmount, amountCents, balanceCents }) =>
      rawAmount.trim() !== '' &&
      (amountCents === null || balanceCents === null || amountCents > balanceCents),
  );
  const selectedAllocations = allocationLines.filter(
    (line): line is typeof line & { amountCents: number } =>
      line.amountCents !== null && line.amountCents > 0,
  );
  const exactTotalReceiptCents = selectedAllocations.reduce(
    (total, line) => total + BigInt(line.amountCents),
    BigInt(0),
  );
  const totalReceiptCents =
    exactTotalReceiptCents <= BigInt(Number.MAX_SAFE_INTEGER)
      ? Number(exactTotalReceiptCents)
      : null;

  async function submitReceipt(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!inv) return;
    if (invalidAllocation) {
      toast.error('Revise que cada aplicación sea válida y no supere el saldo de su factura.');
      return;
    }
    if (selectedAllocations.length === 0 || totalReceiptCents === null || totalReceiptCents <= 0) {
      toast.error('Indique cuánto del recaudo se aplicará a una o más facturas.');
      return;
    }
    if (selectedAllocations.length > 100) {
      toast.error('Un recaudo puede aplicarse a un máximo de 100 facturas.');
      return;
    }
    const payload = {
      customerId: inv.customerId,
      fechaRecibo,
      medio,
      referencia: referencia.trim() || undefined,
      monto: totalReceiptCents / 100,
      aplicaciones: selectedAllocations.map(({ invoice, amountCents }) => ({
        invoiceId: invoice.id,
        amount: amountCents / 100,
      })),
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
      setAplicaciones({});
      setReferencia('');
      toast.success('Recaudo registrado y contabilizado en el Ledger.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo registrar el recaudo.');
    }
  }

  async function reverse(application: InvoiceReceiptApplication) {
    const receipt = application.receipt;
    const allocationSummary = receipt.aplicaciones
      .slice(0, 5)
      .map(({ numero, amount }) => `${numero}: ${cop(Number(amount))}`)
      .join('\n');
    const remainingCount = receipt.aplicaciones.length - 5;
    const more = remainingCount > 0 ? `\nY ${remainingCount} factura(s) más.` : '';
    const confirmed = window.confirm(
      `Este recaudo completo de ${cop(Number(receipt.monto))} está aplicado a ${receipt.aplicaciones.length} factura(s):\n${allocationSummary}${more}\n\nReversarlo liberará todos esos saldos y anulará su comprobante. ¿Desea continuar?`,
    );
    if (!confirmed) return;
    const reason = window.prompt('Motivo para reversar el recaudo:')?.trim();
    if (!reason) return;
    try {
      await reverseReceipt.mutateAsync({ id: receipt.id, reason });
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
          ) : ['ADMIN', 'OPERADOR'].includes(me?.user.rol ?? '') ? (
            isLoadingReceivableInvoices ? (
              <p className="mt-4 border-t pt-4 text-sm text-muted-foreground">
                Consultando facturas pendientes del cliente…
              </p>
            ) : hasReceivableInvoicesError ? (
              <p role="alert" className="mt-4 border-t pt-4 text-sm text-destructive">
                No se pudieron consultar las facturas pendientes. Recargue la página para intentar
                de nuevo.
              </p>
            ) : !receivableInvoices || receivableInvoices.length === 0 ? (
              <p className="mt-4 border-t pt-4 text-sm text-success">
                El cliente no tiene facturas emitidas con saldo disponible para recibir pagos.
              </p>
            ) : (
              <form
                onSubmit={submitReceipt}
                className="mt-5 grid gap-3 border-t pt-4 sm:grid-cols-2"
              >
                <div className="grid gap-2 sm:col-span-2">
                  <p className="text-xs text-muted-foreground">
                    Distribuya el valor recibido entre facturas emitidas de este cliente. El total
                    del recaudo se calcula con las aplicaciones indicadas.
                  </p>
                  <div className="grid max-h-72 gap-3 overflow-y-auto rounded-md border p-3">
                    {receivableInvoices.map((invoice) => (
                      <label
                        key={invoice.id}
                        className="grid gap-1 text-xs font-medium sm:grid-cols-2"
                      >
                        <span>
                          Factura {invoice.numero}
                          <span className="ml-2 font-normal text-muted-foreground">
                            Pendiente {cop(Number(invoice.saldoPendiente))}
                            {invoice.fechaVencimiento
                              ? ` · vence ${calendarDate(invoice.fechaVencimiento)}`
                              : ' · sin vencimiento'}
                          </span>
                        </span>
                        <input
                          type="number"
                          min="0"
                          max={Number(invoice.saldoPendiente)}
                          step="0.01"
                          inputMode="decimal"
                          aria-label={`Aplicar a ${invoice.numero} (COP)`}
                          value={aplicaciones[invoice.id] ?? ''}
                          onChange={(event) =>
                            setAplicaciones((current) => ({
                              ...current,
                              [invoice.id]: event.target.value,
                            }))
                          }
                          className="h-10 rounded-md border bg-background px-3 text-sm"
                        />
                      </label>
                    ))}
                  </div>
                  <p className="text-sm font-medium">
                    Total recibido:{' '}
                    {totalReceiptCents === null
                      ? 'excede el máximo numérico seguro'
                      : cop(totalReceiptCents / 100)}{' '}
                    · aplicado a {selectedAllocations.length} factura(s)
                  </p>
                  {totalReceiptCents === null && (
                    <p role="alert" className="text-xs text-destructive">
                      Reduzca los valores para que el total pueda enviarse exactamente.
                    </p>
                  )}
                  {selectedAllocations.length > 100 && (
                    <p role="alert" className="text-xs text-destructive">
                      Un recaudo puede aplicarse a un máximo de 100 facturas.
                    </p>
                  )}
                </div>
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
                <label className="grid gap-1 text-xs font-medium sm:col-span-2">
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
                    disabled={
                      createReceipt.isPending ||
                      !fechaRecibo ||
                      invalidAllocation ||
                      totalReceiptCents === null ||
                      totalReceiptCents <= 0 ||
                      selectedAllocations.length > 100
                    }
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                  >
                    {createReceipt.isPending ? 'Registrando…' : 'Registrar recaudo'}
                  </button>
                </div>
              </form>
            )
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
                  const receiptInvoiceNames = receipt.aplicaciones.map(({ numero }) => numero);
                  const visibleInvoiceNames = receiptInvoiceNames.slice(0, 3).join(', ');
                  const moreInvoiceCount = receiptInvoiceNames.length - 3;
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
                          {receipt.aplicaciones.length > 1 &&
                            `Recaudo total ${cop(Number(receipt.monto))} aplicado a ${receipt.aplicaciones.length} facturas: ${visibleInvoiceNames}${moreInvoiceCount > 0 ? ` y ${moreInvoiceCount} más` : ''} · `}
                          {reversed
                            ? 'Reversado'
                            : `Comprobante ${application.comprobanteContable?.numero ?? '—'}`}
                        </p>
                      </div>
                      {!reversed && me?.user.rol === 'ADMIN' && (
                        <button
                          type="button"
                          disabled={reverseReceipt.isPending}
                          onClick={() => void reverse(application)}
                          className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
                        >
                          Reversar recaudo completo
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
