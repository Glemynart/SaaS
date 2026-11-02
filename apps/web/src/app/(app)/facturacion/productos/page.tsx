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

function cop(n: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(n);
}

export default function ProductosPage() {
  const [search, setSearch] = useState('');
  const { data: products, isLoading } = useProducts(search || undefined);
  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<{
    nombre: string;
    descripcion: string;
    precio: number;
    impuesto: number | '';
  }>({ nombre: '', descripcion: '', precio: 0, impuesto: '' });

  const reset = () => {
    setForm({ nombre: '', descripcion: '', precio: 0, impuesto: '' });
    setEditId(null);
  };
  const handleSubmit = useCallback(() => {
    if (form.impuesto === '') return;
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
  }, [form, editId, createMutation, updateMutation]);

  const startEdit = (p: NonNullable<typeof products>[number]) => {
    setForm({
      nombre: p.nombre,
      descripcion: p.descripcion ?? '',
      precio: p.precio,
      impuesto: p.impuesto,
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
          <p className="mt-1 text-sm text-muted-foreground">Catálogo para facturación interna.</p>
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
              value={form.precio}
              onChange={(e) => setForm({ ...form, precio: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label>IVA configurado</Label>
            <select
              value={form.impuesto}
              onChange={(e) =>
                setForm({
                  ...form,
                  impuesto: e.target.value === '' ? '' : Number(e.target.value),
                })
              }
              className="h-10 w-full rounded-md border px-3 text-sm"
            >
              <option value="">Seleccionar tasa</option>
              <option value={0}>0% — sin IVA en asiento</option>
              <option value={5}>5%</option>
              <option value={19}>19%</option>
            </select>
          </div>
          <div className="sm:col-span-4 flex gap-2">
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={
                createMutation.isPending || updateMutation.isPending || form.impuesto === ''
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
      {(createMutation.error ?? updateMutation.error) instanceof Error && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {(createMutation.error ?? updateMutation.error)?.message}
        </p>
      )}
      <p className="mb-4 text-xs text-muted-foreground">
        Revisa la tasa según cada servicio. 0% solo omite IVA del asiento: no determina si la
        operación es exenta o excluida ni valida requisitos DIAN.
      </p>
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
                  {cop(p.precio)} — IVA {p.impuesto}%
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
