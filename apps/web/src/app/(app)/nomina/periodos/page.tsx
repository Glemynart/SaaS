'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { Check, Loader2, Plus, Play, RotateCcw, Send, X } from 'lucide-react';
import {
  useAprobarPayrollPeriod,
  useCreatePeriod,
  useEnviarARevision,
  useGeneratePayroll,
  usePayrollPeriods,
  useReabrirPayrollPeriod,
  useRecalculatePayroll,
  useRechazarPayrollPeriod,
} from '@/features/payroll/hooks/use-payroll';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';

export default function PeriodosPage() {
  const { data: periods, isLoading } = usePayrollPeriods();
  const createMutation = useCreatePeriod();
  const generateMutation = useGeneratePayroll();
  const recalculateMutation = useRecalculatePayroll();
  const enviarRevisionMutation = useEnviarARevision();
  const aprobarMutation = useAprobarPayrollPeriod();
  const rechazarMutation = useRechazarPayrollPeriod();
  const reabrirMutation = useReabrirPayrollPeriod();
  const [showForm, setShowForm] = useState(false);
  const [nombre, setNombre] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [fechaPrevistaPagoPila, setFechaPrevistaPagoPila] = useState('');

  const handleCreate = useCallback(() => {
    if (!nombre || !fechaInicio || !fechaFin) return;
    createMutation.mutate(
      {
        nombre,
        fechaInicio,
        fechaFin,
        fechaPrevistaPagoPila: fechaPrevistaPagoPila || null,
      },
      {
        onSuccess: () => {
          setShowForm(false);
          setNombre('');
          setFechaInicio('');
          setFechaFin('');
          setFechaPrevistaPagoPila('');
        },
      },
    );
  }, [nombre, fechaInicio, fechaFin, fechaPrevistaPagoPila, createMutation]);

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
            Periodos de nomina
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestiona los periodos de liquidacion.
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setShowForm(!showForm)}>
          <Plus className="size-4" /> Nuevo periodo
        </Button>
      </div>

      {showForm && (
        <div className="mb-6 rounded-xl border border-border bg-surface p-5 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
            <div className="space-y-1.5">
              <Label htmlFor="fecha-prevista-pago-pila">
                Fecha prevista de pago de aportes PILA
              </Label>
              <Input
                id="fecha-prevista-pago-pila"
                type="date"
                value={fechaPrevistaPagoPila}
                onChange={(e) => setFechaPrevistaPagoPila(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Opcional. Orienta la versión normativa PILA; no es la fecha de pago del salario ni
                confirma que los aportes se hayan pagado.
              </p>
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
          No hay periodos creados.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <div className="divide-y divide-border">
            {(periods ?? []).map((p) => (
              <div key={p.id} className="flex items-center justify-between px-5 py-4">
                <Link href={`/nomina/periodos/${p.id}`} className="flex-1">
                  <p className="text-sm font-medium text-foreground">{p.nombre}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {new Date(p.fechaInicio).toLocaleDateString('es-CO')} -{' '}
                    {new Date(p.fechaFin).toLocaleDateString('es-CO')}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Pago PILA previsto:{' '}
                    {p.fechaPrevistaPagoPila
                      ? new Date(
                          `${p.fechaPrevistaPagoPila.slice(0, 10)}T00:00:00`,
                        ).toLocaleDateString('es-CO')
                      : 'sin definir'}
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <StatusBadge domain="nominaN2" estado={p.status} />
                    <span className="text-2xs text-muted-foreground/60">
                      {p.empleadosProcesados} empl.
                    </span>
                  </div>
                </Link>
                <div className="ml-4 flex flex-wrap justify-end gap-1">
                  {(p.status === 'BORRADOR' || p.status === 'DRAFT') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => generateMutation.mutate(p.id)}
                      disabled={generateMutation.isPending}
                    >
                      <Play className="size-3.5" /> Generar
                    </Button>
                  )}
                  {p.status === 'CALCULADA' && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => recalculateMutation.mutate(p.id)}
                        disabled={recalculateMutation.isPending}
                      >
                        <RotateCcw className="size-3.5" /> Recalcular
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => enviarRevisionMutation.mutate(p.id)}
                        disabled={enviarRevisionMutation.isPending}
                      >
                        <Send className="size-3.5" /> Enviar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => reabrirMutation.mutate(p.id)}
                        disabled={reabrirMutation.isPending}
                      >
                        <RotateCcw className="size-3.5" /> Reabrir
                      </Button>
                    </>
                  )}
                  {p.status === 'EN_REVISION' && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => aprobarMutation.mutate(p.id)}
                        disabled={aprobarMutation.isPending}
                      >
                        <Check className="size-3.5" /> Aprobar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => rechazarMutation.mutate({ id: p.id })}
                        disabled={rechazarMutation.isPending}
                      >
                        <X className="size-3.5" /> Rechazar
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
