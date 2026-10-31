'use client';

import { useState, useCallback } from 'react';
import {
  useProducts,
  useCreateProduct,
  useUpdateProduct,
} from '@/features/billing/hooks/use-billing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Loader2, Pencil } from 'lucide-react';

function cop(n: number | string) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(Number(n));
}

export default function ProductosPage() {
  const [search, setSearch] = useState('');
  const { data: products, isLoading } = useProducts(search || undefined);
  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ nombre: '', descripcion: '', precio: 0, impuesto: '' });
  const tasaDecimalPlaces = form.impuesto.split('.')[1]?.length ?? 0;
  const tasaValida =
    form.impuesto.trim() !== '' &&
    Number.isFinite(Number(form.impuesto)) &&
    Number(form.impuesto) >= 0 &&
    Number(form.impuesto) <= 100 &&
    tasaDecimalPlaces <= 2;

  const reset = () => {
    setForm({ nombre: '', descripcion: '', precio: 0, impuesto: '' });
    setEditId(null);
  };
  const handleSubmit = useCallback(() => {
    if (!tasaValida || !form.nombre.trim()) return;
    const payload = { ...form, impuesto: Number(form.impuesto) };
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
  }, [form, editId, tasaValida, createMutation, updateMutation]);

  const startEdit = (p: NonNullable<typeof products>[number]) => {
    setForm({
      nombre: p.nombre,
      descripcion: p.descripcion ?? '',
      precio: Number(p.precio),
      impuesto: p.impuesto.toString(),
    });
    setEditId(p.id);
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
          <h1 className="text-lg font-semibold text-foreground">Productos y servicios</h1>
          <p className="mt-1 text-sm text-muted-foreground">Catálogo para facturación.</p>
        </div>
        <Button
          size="sm"
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
        <div className="mb-6 rounded-xl border bg-surface p-5 shadow-sm grid gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <Label>Nombre</Label>
            <Input
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            />
          </div>
          <div>
            <Label>Precio</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={form.precio}
              onChange={(e) => setForm({ ...form, precio: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label>Tasa configurada (%)</Label>
            <Input
              type="number"
              required
              min={0}
              max={100}
              step="0.01"
              value={form.impuesto}
              onChange={(e) => setForm({ ...form, impuesto: e.target.value })}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Valor para cálculos internos, sin definir el tratamiento tributario.
            </p>
          </div>
          <div className="sm:col-span-4 flex gap-2">
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={
                createMutation.isPending ||
                updateMutation.isPending ||
                !tasaValida ||
                !form.nombre.trim()
              }
            >
              {createMutation.isPending && <Loader2 className="mr-1 size-3 animate-spin" />}
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
          placeholder="Buscar..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>
      <div className="overflow-hidden rounded-xl border bg-surface">
        <div className="divide-y">
          {(products ?? []).map((p) => (
            <div key={p.id} className="flex items-center justify-between px-5 py-3.5">
              <div>
                <p className="text-sm font-medium">{p.nombre}</p>
                <p className="text-xs text-muted-foreground">
                  {cop(p.precio)} — Tasa {p.impuesto}%
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => startEdit(p)}>
                <Pencil className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
