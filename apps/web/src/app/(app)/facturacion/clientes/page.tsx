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
  const { data: terceros } = useTerceros({ esCliente: true, activo: true });
  const createMutation = useCreateCustomer();
  const updateMutation = useUpdateCustomer();
  const deleteMutation = useDeleteCustomer();
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
    if (editId) {
      updateMutation.mutate(
        { id: editId, data: { ...form, terceroId: form.terceroId || null } },
        {
          onSuccess: () => {
            setShowForm(false);
            reset();
          },
        },
      );
    } else {
      createMutation.mutate(
        { ...form, terceroId: form.terceroId || null },
        {
          onSuccess: () => {
            setShowForm(false);
            reset();
          },
        },
      );
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
            <Label>Tercero contable</Label>
            <select
              value={form.terceroId}
              onChange={(e) => setForm({ ...form, terceroId: e.target.value })}
              className="h-10 w-full rounded-md border px-3 text-sm"
            >
              <option value="">Sin vincular</option>
              {(terceros ?? [])
                .filter((tercero) => tercero.tipoDocumento === 'NIT')
                .map((tercero) => (
                  <option key={tercero.id} value={tercero.id}>
                    {tercero.razonSocial ??
                      `${tercero.primerNombre ?? ''} ${tercero.primerApellido ?? ''}`.trim()}{' '}
                    — NIT {tercero.numeroDocumento}
                    {tercero.digitoVerificacion ? `-${tercero.digitoVerificacion}` : ''}
                  </option>
                ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              El NIT debe coincidir. Vincular el tercero es requisito para emitir y contabilizar.{' '}
              <Link href="/contabilidad/terceros" className="underline underline-offset-2">
                Gestionar terceros contables
              </Link>
            </p>
          </div>
          <div className="flex items-end gap-2 sm:col-span-3">
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="mr-1 size-3 animate-spin" />
              )}
              {editId ? 'Guardar' : 'Crear'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
      {(createMutation.error ?? updateMutation.error ?? deleteMutation.error) instanceof Error && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {(createMutation.error ?? updateMutation.error ?? deleteMutation.error)?.message}
        </p>
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
                <div className="mt-1 flex gap-2">
                  <Badge>{c.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}</Badge>
                  <Badge>{c.terceroId ? 'Tercero vinculado' : 'Sin tercero'}</Badge>
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
