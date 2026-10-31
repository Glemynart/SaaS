'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  useInvoices,
  useCreateInvoice,
  useUpdateInvoiceStatus,
  useCustomers,
  useProducts,
} from '@/features/billing/hooks/use-billing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/components/ui/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Loader2, Eye, CheckCircle, XCircle } from 'lucide-react';

function cop(n: number | string) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(Number(n));
}

export default function FacturasPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [invoiceToCancel, setInvoiceToCancel] = useState<{ id: string; numero: string } | null>(
    null,
  );
  const [cancellationReason, setCancellationReason] = useState('');
  const { data: invoices, isLoading } = useInvoices(statusFilter || undefined);
  const { data: customers } = useCustomers();
  const { data: products } = useProducts();
  const createMutation = useCreateInvoice();
  const updateStatusMutation = useUpdateInvoiceStatus();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    customerId: '',
    numero: '',
    items: [{ descripcion: '', cantidad: 1, valorUnitario: 0, productServiceId: '', impuesto: '' }],
  });

  const addItem = () =>
    setForm({
      ...form,
      items: [
        ...form.items,
        { descripcion: '', cantidad: 1, valorUnitario: 0, productServiceId: '', impuesto: '' },
      ],
    });
  const removeItem = (i: number) =>
    setForm({ ...form, items: form.items.filter((_, idx) => idx !== i) });
  const updateItem = (i: number, f: Partial<(typeof form.items)[0]>) => {
    const items = [...form.items];
    items[i] = { ...items[i], ...f };
    if (Object.prototype.hasOwnProperty.call(f, 'productServiceId')) {
      const productServiceId = f.productServiceId ?? '';
      const prod = (products ?? []).find((p) => p.id === productServiceId);
      if (prod) {
        items[i] = {
          ...items[i],
          productServiceId,
          descripcion: prod.nombre,
          valorUnitario: Number(prod.precio),
          impuesto: prod.impuesto.toString(),
        };
      } else {
        items[i] = { ...items[i], productServiceId: '', impuesto: '' };
      }
    }
    setForm({ ...form, items });
  };

  const handleCreate = useCallback(() => {
    const cleanItems = form.items.map((i) => ({
      descripcion: i.descripcion || 'Sin descripción',
      cantidad: i.cantidad,
      valorUnitario: i.valorUnitario,
      productServiceId: i.productServiceId || undefined,
      impuesto: i.productServiceId ? undefined : Number(i.impuesto),
    }));
    createMutation.mutate(
      { customerId: form.customerId, numero: form.numero, items: cleanItems },
      { onSuccess: () => setShowForm(false) },
    );
  }, [form, createMutation]);

  const changeInvoiceStatus = (id: string, status: 'ISSUED' | 'CANCELLED', motivo?: string) => {
    updateStatusMutation.mutate(
      { id, status, motivo },
      {
        onSuccess: () => {
          if (status === 'ISSUED') toast.success('Factura emitida y contabilizada.');
          if (status === 'CANCELLED') {
            toast.success('Factura cancelada y comprobante anulado.');
            setInvoiceToCancel(null);
            setCancellationReason('');
          }
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  const tasasManualesValidas = form.items.every(
    (item) =>
      item.productServiceId !== '' ||
      (item.impuesto.trim() !== '' &&
        Number.isFinite(Number(item.impuesto)) &&
        Number(item.impuesto) >= 0 &&
        Number(item.impuesto) <= 100 &&
        (item.impuesto.split('.')[1]?.length ?? 0) <= 2),
  );

  if (isLoading)
    return (
      <div className="mx-auto max-w-4xl">
        <Skeleton className="h-64 w-full" />
      </div>
    );

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Facturas</h1>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="size-4" />
          Nueva
        </Button>
      </div>

      {showForm && (
        <div className="mb-6 rounded-xl border bg-surface p-5 shadow-sm space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>Cliente</Label>
              <select
                value={form.customerId}
                onChange={(e) => setForm({ ...form, customerId: e.target.value })}
                className="w-full h-10 rounded-md border px-3 text-sm"
              >
                <option value="">Seleccionar...</option>
                {(customers ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.razonSocial}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Número</Label>
              <Input
                value={form.numero}
                onChange={(e) => setForm({ ...form, numero: e.target.value })}
                placeholder="FAC-001"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Items</Label>
            {form.items.map((item, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-7 items-end border rounded-lg p-3">
                <div className="sm:col-span-2">
                  <select
                    value={item.productServiceId}
                    onChange={(e) => updateItem(i, { productServiceId: e.target.value })}
                    className="w-full h-9 rounded-md border px-2 text-xs"
                  >
                    <option value="">Manual</option>
                    {(products ?? []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <Input
                    placeholder="Descripción"
                    value={item.descripcion}
                    onChange={(e) => updateItem(i, { descripcion: e.target.value })}
                  />
                </div>
                <div>
                  <Input
                    type="number"
                    min={0.001}
                    step="0.001"
                    placeholder="Cant"
                    value={item.cantidad}
                    onChange={(e) => updateItem(i, { cantidad: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    placeholder="Tasa %"
                    aria-label={`Tasa configurada de la línea ${i + 1}`}
                    value={item.impuesto}
                    readOnly={item.productServiceId !== ''}
                    onChange={(e) => updateItem(i, { impuesto: e.target.value })}
                  />
                </div>
                <div>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="V. Unit"
                    value={item.valorUnitario}
                    onChange={(e) => updateItem(i, { valorUnitario: Number(e.target.value) })}
                  />
                </div>
                {form.items.length > 1 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeItem(i)}
                    className="text-destructive text-xs"
                  >
                    X
                  </Button>
                )}
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={addItem}>
              + Agregar item
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={
                createMutation.isPending ||
                !form.customerId ||
                !form.numero.trim() ||
                !tasasManualesValidas
              }
            >
              {createMutation.isPending && <Loader2 className="mr-1 size-3 animate-spin" />}Crear
              factura
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <div className="mb-6 flex gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 rounded-md border px-3 text-sm"
        >
          <option value="">Todos</option>
          <option value="DRAFT">Borrador</option>
          <option value="ISSUED">Emitida</option>
          <option value="CANCELLED">Cancelada</option>
        </select>
      </div>

      {(invoices ?? []).length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
          No hay facturas.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-surface">
          <div className="divide-y">
            {(invoices ?? []).map((inv) => (
              <div key={inv.id} className="flex items-center justify-between px-5 py-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/facturacion/facturas/${inv.id}`}
                      className="text-sm font-medium hover:underline"
                    >
                      {inv.numero}
                    </Link>
                    <StatusBadge
                      domain="factura"
                      estado={
                        inv.status === 'DRAFT'
                          ? 'BORRADOR'
                          : inv.status === 'ISSUED'
                            ? 'EMITIDA'
                            : 'ANULADA'
                      }
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {inv.customer?.razonSocial} — {cop(inv.total)}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Link
                    href={`/facturacion/facturas/${inv.id}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                  >
                    <Eye className="size-3.5" />
                  </Link>
                  {inv.status === 'DRAFT' && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-success"
                        onClick={() => changeInvoiceStatus(inv.id, 'ISSUED')}
                      >
                        <CheckCircle className="size-3.5" /> Emitir
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-destructive"
                        onClick={() => {
                          setInvoiceToCancel({ id: inv.id, numero: inv.numero });
                          setCancellationReason('');
                        }}
                      >
                        <XCircle className="size-3.5" /> Cancelar
                      </Button>
                    </>
                  )}
                  {inv.status === 'ISSUED' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-destructive"
                      onClick={() => {
                        setInvoiceToCancel({ id: inv.id, numero: inv.numero });
                        setCancellationReason('');
                      }}
                    >
                      <XCircle className="size-3.5" /> Anular
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {invoiceToCancel && (
        <div className="fixed inset-0 z-(--z-overlay) flex items-center justify-center bg-(--overlay) p-4">
          <section
            aria-labelledby="cancel-invoice-title"
            aria-modal="true"
            className="w-full max-w-md rounded-xl border border-border bg-surface p-5 shadow-(--shadow-overlay)"
            role="alertdialog"
          >
            <h2 id="cancel-invoice-title" className="text-base font-semibold text-foreground">
              {invoices?.find((invoice) => invoice.id === invoiceToCancel.id)?.status === 'ISSUED'
                ? `Anular factura ${invoiceToCancel.numero}`
                : `Cancelar borrador ${invoiceToCancel.numero}`}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {invoices?.find((invoice) => invoice.id === invoiceToCancel.id)?.status === 'ISSUED'
                ? 'La anulación conserva el comprobante y registra su corrección contable.'
                : 'El borrador se cancelará sin crear un asiento contable.'}
            </p>
            <label htmlFor="invoice-cancellation-reason" className="mt-4 block text-sm font-medium">
              Motivo
            </label>
            <textarea
              id="invoice-cancellation-reason"
              className="mt-1 min-h-24 w-full rounded-md border border-input bg-control px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
              maxLength={500}
              onChange={(event) => setCancellationReason(event.target.value)}
              required
              value={cancellationReason}
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setInvoiceToCancel(null)}
                disabled={updateStatusMutation.isPending}
              >
                Volver
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={!cancellationReason.trim() || updateStatusMutation.isPending}
                onClick={() =>
                  changeInvoiceStatus(invoiceToCancel.id, 'CANCELLED', cancellationReason.trim())
                }
              >
                {invoices?.find((invoice) => invoice.id === invoiceToCancel.id)?.status === 'ISSUED'
                  ? 'Anular factura'
                  : 'Cancelar borrador'}
              </Button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
