'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  useCustomers,
  useCreateCustomer,
  useUpdateCustomer,
  useDeleteCustomer,
} from '@/features/billing/hooks/use-billing';
import { useTerceros } from '@/features/accounting/hooks/use-accounting-configuration';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Loader2, Pencil, Trash2 } from 'lucide-react';

export default function ClientesPage() {
  const [search, setSearch] = useState('');
  const { data: customers, isLoading } = useCustomers(search || undefined);
  const createMutation = useCreateCustomer();
  const updateMutation = useUpdateCustomer();
  const deleteMutation = useDeleteCustomer();
  const {
    data: terceros,
    isLoading: isLoadingTerceros,
    isError: isTercerosError,
  } = useTerceros({ esCliente: true, activo: true });
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    razonSocial: '',
    nit: '',
    email: '',
    telefono: '',
    direccion: '',
    terceroId: '',
  });

  const reset = () => {
    setForm({ razonSocial: '', nit: '', email: '', telefono: '', direccion: '', terceroId: '' });
    setEditId(null);
  };
  const handleSubmit = useCallback(() => {
    const payload = { ...form, terceroId: form.terceroId || null };
    if (editId) {
      updateMutation.mutate(
        { id: editId, data: payload },
        {
          onSuccess: () => {
            setShowForm(false);
            reset();
          },
        },
      );
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => {
          setShowForm(false);
          reset();
        },
      });
    }
  }, [form, editId, createMutation, updateMutation]);

  const startEdit = (c: typeof customers extends (infer T)[] | null | undefined ? T : never) => {
    setForm({
      razonSocial: c.razonSocial,
      nit: c.nit,
      email: c.email ?? '',
      telefono: c.telefono ?? '',
      direccion: c.direccion ?? '',
      terceroId: c.terceroId ?? '',
    });
    setEditId(c.id);
    setShowForm(true);
  };

  const editingCustomer = editId
    ? (customers ?? []).find((customer) => customer.id === editId)
    : null;
  const activeThirdPartyIds = new Set((terceros ?? []).map((tercero) => tercero.id));
  const linkedTerceroOption =
    form.terceroId && !activeThirdPartyIds.has(form.terceroId) ? editingCustomer?.tercero : null;
  const linkedTerceroName = linkedTerceroOption
    ? linkedTerceroOption.razonSocial ||
      [linkedTerceroOption.primerNombre, linkedTerceroOption.primerApellido]
        .filter(Boolean)
        .join(' ') ||
      linkedTerceroOption.nombreComercial ||
      'Tercero'
    : null;

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
          <h1 className="text-lg font-semibold text-foreground">Clientes</h1>
          <p className="mt-1 text-sm text-muted-foreground">CRUD de clientes para facturación.</p>
        </div>
        <Button
          size="sm"
          className="gap-1.5"
          onClick={() => {
            reset();
            setShowForm(!showForm);
          }}
        >
          <Plus className="size-4" />
          Nuevo
        </Button>
      </div>
      {showForm && (
        <div className="mb-6 rounded-xl border bg-surface p-5 shadow-sm grid gap-3 sm:grid-cols-3">
          <div>
            <Label>Razón social</Label>
            <Input
              value={form.razonSocial}
              onChange={(e) => setForm({ ...form, razonSocial: e.target.value })}
            />
          </div>
          <div>
            <Label>NIT</Label>
            <Input value={form.nit} onChange={(e) => setForm({ ...form, nit: e.target.value })} />
          </div>
          <div>
            <Label>Email</Label>
            <Input
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <Label>Teléfono</Label>
            <Input
              value={form.telefono}
              onChange={(e) => setForm({ ...form, telefono: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Dirección</Label>
            <Input
              value={form.direccion}
              onChange={(e) => setForm({ ...form, direccion: e.target.value })}
            />
          </div>
          <div className="sm:col-span-3">
            <Label htmlFor="billing-customer-tercero">Tercero contable</Label>
            <select
              id="billing-customer-tercero"
              aria-label="Tercero contable"
              value={form.terceroId}
              onChange={(event) => setForm({ ...form, terceroId: event.target.value })}
              className="h-10 w-full rounded-md border px-3 text-sm"
            >
              <option value="">Sin vincular</option>
              {linkedTerceroOption && (
                <option value={linkedTerceroOption.id} disabled>
                  {linkedTerceroOption.tipoDocumento} {linkedTerceroOption.numeroDocumento} —{' '}
                  {linkedTerceroName} (inactivo o sin rol de cliente)
                </option>
              )}
              {form.terceroId && isLoadingTerceros && !linkedTerceroOption && (
                <option value={form.terceroId}>Cargando tercero vinculado…</option>
              )}
              {form.terceroId &&
                !isLoadingTerceros &&
                !linkedTerceroOption &&
                !activeThirdPartyIds.has(form.terceroId) && (
                  <option value={form.terceroId}>Tercero vinculado no disponible</option>
                )}
              {(terceros ?? []).map((tercero) => (
                <option key={tercero.id} value={tercero.id}>
                  {tercero.tipoDocumento} {tercero.numeroDocumento} —{' '}
                  {tercero.razonSocial ||
                    [tercero.primerNombre, tercero.primerApellido].filter(Boolean).join(' ') ||
                    tercero.nombreComercial ||
                    'Tercero'}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              El vínculo se elige manualmente; no se asigna por coincidencia de NIT.{' '}
              <Link href="/contabilidad/terceros" className="text-primary underline">
                Gestionar terceros
              </Link>
            </p>
            {isTercerosError && (
              <p className="mt-1 text-xs text-destructive">
                No se pudo cargar la lista de terceros activos.
              </p>
            )}
          </div>
          <div className="flex items-end gap-2 sm:col-span-3">
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending ||
                (updateMutation.isPending && <Loader2 className="mr-1 size-3 animate-spin" />)}
              {editId ? 'Guardar' : 'Crear'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
      <div className="mb-6">
        <Input
          placeholder="Buscar cliente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>
      <div className="overflow-hidden rounded-xl border bg-surface">
        <div className="divide-y">
          {(customers ?? []).map((c) => (
            <div key={c.id} className="flex items-center justify-between px-5 py-3.5">
              <div>
                <p className="text-sm font-medium">{c.razonSocial}</p>
                <p className="text-xs text-muted-foreground">NIT: {c.nit}</p>
                <p className="text-xs text-muted-foreground">
                  {c.tercero
                    ? `Tercero contable: ${c.tercero.tipoDocumento} ${c.tercero.numeroDocumento}`
                    : 'Sin tercero contable vinculado'}
                </p>
                <div className="mt-1 flex gap-2">
                  <Badge>{c.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}</Badge>
                  {c.email && <span className="text-xs text-muted-foreground">{c.email}</span>}
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => startEdit(c)}>
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => {
                    if (confirm('¿Eliminar?')) deleteMutation.mutate(c.id);
                  }}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
