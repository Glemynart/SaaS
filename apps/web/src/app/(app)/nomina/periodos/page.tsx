'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { Plus, Lock, Play, Loader2 } from 'lucide-react';
import {
  usePayrollPeriods,
  useCreatePeriod,
  useGeneratePayroll,
  useClosePeriod,
} from '@/features/payroll/hooks/use-payroll';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

export default function PeriodosPage() {
  const { data: periods, isLoading } = usePayrollPeriods();
  const createMutation = useCreatePeriod();
  const generateMutation = useGeneratePayroll();
  const closeMutation = useClosePeriod();
  const [showForm, setShowForm] = useState(false);
  const [nombre, setNombre] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');

  const handleCreate = useCallback(() => {
    if (!nombre || !fechaInicio || !fechaFin) return;
    createMutation.mutate(
      { nombre, fechaInicio, fechaFin },
      {
        onSuccess: () => {
          setShowForm(false);
          setNombre('');
          setFechaInicio('');
          setFechaFin('');
        },
      },
    );
  }, [nombre, fechaInicio, fechaFin, createMutation]);

  if (isLoading)
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <Skeleton className="h-64 w-full" />
      </div>
    );

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-[-0.018em] text-foreground">
            Períodos de nómina
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestioná los períodos de liquidación.
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setShowForm(!showForm)}>
          <Plus className="size-4" /> Nuevo período
        </Button>
      </div>

      {showForm && (
        <div className="mb-6 rounded-xl border border-border bg-white p-5 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Nombre</Label>
              <Input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Octubre 2026"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Inicio</Label>
              <Input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Fin</Label>
              <Input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button size="sm" onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="mr-1 size-3 animate-spin" />}Crear
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {(periods ?? []).length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
          No hay períodos creados.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-white">
          <div className="divide-y divide-border">
            {(periods ?? []).map((p) => (
              <div key={p.id} className="flex items-center justify-between px-5 py-4">
                <Link href={`/nomina/periodos/${p.id}`} className="flex-1">
                  <p className="text-sm font-medium text-foreground">{p.nombre}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {new Date(p.fechaInicio).toLocaleDateString('es-CO')} →{' '}
                    {new Date(p.fechaFin).toLocaleDateString('es-CO')}
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <Badge
                      className={
                        p.status === 'CLOSED'
                          ? 'bg-gray-100 text-gray-600'
                          : 'bg-emerald-50 text-emerald-700'
                      }
                    >
                      {p.status === 'CLOSED' ? 'Cerrado' : 'Borrador'}
                    </Badge>
                    <span className="text-[0.68rem] text-muted-foreground/60">
                      {p.empleadosProcesados} empl.
                    </span>
                  </div>
                </Link>
                <div className="ml-4 flex gap-1">
                  {p.status === 'DRAFT' && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => generateMutation.mutate(p.id)}
                        disabled={generateMutation.isPending}
                      >
                        <Play className="size-3.5" /> Generar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          if (confirm('¿Cerrar este período?')) closeMutation.mutate(p.id);
                        }}
                        disabled={closeMutation.isPending}
                      >
                        <Lock className="size-3.5" /> Cerrar
                      </Button>
                    </>
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
