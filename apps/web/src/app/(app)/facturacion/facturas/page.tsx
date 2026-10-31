'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
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
import { useMe } from '@/features/auth/hooks/use-auth';
import { Plus, Loader2, Eye, CheckCircle, XCircle } from 'lucide-react';

function cop(n: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(n);
}

export default function FacturasPage() {
  const me = useMe();
  const canManageInvoiceStatus = me.data?.user.rol === 'ADMIN';
  const [statusFilter, setStatusFilter] = useState('');
  const { data: invoices, isLoading } = useInvoices(statusFilter || undefined);
  const { data: customers } = useCustomers();
  const { data: products } = useProducts();
  const createMutation = useCreateInvoice();
  const updateStatusMutation = useUpdateInvoiceStatus();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    customerId: '',
    numero: '',
    items: [
      {
        descripcion: '',
        cantidad: 1,
        valorUnitario: 0,
        productServiceId: '',
        porcentajeImpuesto: '' as number | '',
      },
    ],
  });

  const addItem = () =>
    setForm({
      ...form,
      items: [
        ...form.items,
        {
          descripcion: '',
          cantidad: 1,
          valorUnitario: 0,
          productServiceId: '',
          porcentajeImpuesto: '' as number | '',
        },
      ],
    });
  const removeItem = (i: number) =>
    setForm({ ...form, items: form.items.filter((_, idx) => idx !== i) });
  const updateItem = (i: number, f: Partial<(typeof form.items)[0]>) => {
    const items = [...form.items];
    items[i] = { ...items[i], ...f };
    if (f.productServiceId !== undefined) {
      const prod = (products ?? []).find((p) => p.id === f.productServiceId);
      if (prod) {
        items[i] = {
          ...items[i],
          descripcion: prod.nombre,
          valorUnitario: Number(prod.precio),
          porcentajeImpuesto: Number(prod.impuesto),
        };
      } else if (!f.productServiceId) {
        items[i] = { ...items[i], porcentajeImpuesto: '' };
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
      porcentajeImpuesto: Number(i.porcentajeImpuesto),
    }));
    createMutation.mutate(
      { customerId: form.customerId, numero: form.numero, items: cleanItems },
      { onSuccess: () => setShowForm(false) },
    );
  }, [form, createMutation]);

  const cancelInvoice = (id: string) => {
    const motivo = window.prompt('Indica el motivo para cancelar esta factura:');
    if (!motivo?.trim()) return;
    updateStatusMutation.mutate({ id, status: 'CANCELLED', motivo: motivo.trim() });
  };

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
          <p className="text-xs text-muted-foreground">
            Factura interna para demo contable; no es factura electrónica DIAN. La tasa de cada
            línea queda congelada al crear el borrador.
          </p>
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
                    placeholder="Cant"
                    value={item.cantidad}
                    onChange={(e) => updateItem(i, { cantidad: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label className="text-xs">IVA %</Label>
                  <select
                    value={item.porcentajeImpuesto}
                    disabled={Boolean(item.productServiceId)}
                    onChange={(e) =>
                      updateItem(i, {
                        porcentajeImpuesto: e.target.value === '' ? '' : Number(e.target.value),
                      })
                    }
                    className="h-10 w-full rounded-md border px-2 text-sm disabled:bg-muted"
                  >
                    <option value="">Seleccionar</option>
                    <option value={0}>0%</option>
                    <option value={5}>5%</option>
                    <option value={19}>19%</option>
                  </select>
                </div>
                <div>
                  <Input
                    type="number"
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
                form.items.some((item) => item.porcentajeImpuesto === '')
              }
            >
              {createMutation.isPending && <Loader2 className="mr-1 size-3 animate-spin" />}Crear
              factura
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
          </div>
          {createMutation.error instanceof Error && (
            <p className="text-sm text-destructive">{createMutation.error.message}</p>
          )}
        </div>
      )}

      {updateStatusMutation.error instanceof Error && (
        <p className="mb-4 text-sm text-destructive">{updateStatusMutation.error.message}</p>
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
                    {inv.customerRazonSocialSnapshot ?? inv.customer?.razonSocial} —{' '}
                    {cop(inv.total)}
                  </p>
                  {!canManageInvoiceStatus && inv.status === 'DRAFT' && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      La emisión o cancelación requiere un usuario ADMIN.
                    </p>
                  )}
                  {!canManageInvoiceStatus && inv.status === 'ISSUED' && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      La reversión requiere un usuario ADMIN.
                    </p>
                  )}
                </div>
                <div className="flex gap-1">
                  <Link
                    href={`/facturacion/facturas/${inv.id}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                  >
                    <Eye className="size-3.5" />
                  </Link>
                  {canManageInvoiceStatus && inv.status === 'DRAFT' && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-success"
                        onClick={() =>
                          updateStatusMutation.mutate({ id: inv.id, status: 'ISSUED' })
                        }
                      >
                        <CheckCircle className="size-3.5" /> Emitir
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-destructive"
                        onClick={() => cancelInvoice(inv.id)}
                      >
                        <XCircle className="size-3.5" /> Cancelar
                      </Button>
                    </>
                  )}
                  {canManageInvoiceStatus && inv.status === 'ISSUED' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-destructive"
                      disabled={updateStatusMutation.isPending}
                      onClick={() => cancelInvoice(inv.id)}
                    >
                      <XCircle className="size-3.5" /> Revertir
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
