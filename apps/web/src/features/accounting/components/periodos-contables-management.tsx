'use client';

import { useState } from 'react';
import { AlertTriangle, CalendarDays, Plus } from 'lucide-react';
import { useMe } from '@/features/auth/hooks/use-auth';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { SideSheet } from '@/components/ui/side-sheet';
import { toast } from '@/components/ui/toast';
import {
  useCerrarAnioContable,
  useCerrarPeriodo,
  useCreatePeriodoContable,
  useGenerarAnioContable,
  usePeriodosContables,
  useReabrirPeriodo,
  useValidarCierrePeriodo,
} from '../hooks/use-accounting-configuration';
import type { PeriodoContable, PeriodoContableFilters } from '../services/accounting-api';
import { PeriodosContablesTable } from './periodos-contables-table';

type PendingAction =
  | { type: 'cerrar'; periodo: PeriodoContable }
  | { type: 'reabrir'; periodo: PeriodoContable; motivo: string }
  | { type: 'anual'; periodo: PeriodoContable };

interface Feedback {
  title: string;
  result: unknown;
}

export function PeriodosContablesManagement() {
  const [filters, setFilters] = useState<PeriodoContableFilters>({});
  const [form, setForm] = useState<'periodo' | 'anio' | null>(null);
  const [newAnio, setNewAnio] = useState('');
  const [newMes, setNewMes] = useState('');
  const [reopenPeriod, setReopenPeriod] = useState<PeriodoContable | undefined>();
  const [motivo, setMotivo] = useState('');
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const { data: user } = useMe();
  const canManage = user?.user.rol === 'ADMIN';
  const { data: periodos, isLoading, isError, refetch } = usePeriodosContables(filters);
  const createMutation = useCreatePeriodoContable();
  const generarAnioMutation = useGenerarAnioContable();
  const validarMutation = useValidarCierrePeriodo();
  const cerrarMutation = useCerrarPeriodo();
  const reabrirMutation = useReabrirPeriodo();
  const cerrarAnioMutation = useCerrarAnioContable();
  const isOperating =
    cerrarMutation.isPending ||
    reabrirMutation.isPending ||
    cerrarAnioMutation.isPending ||
    validarMutation.isPending;
  const formError = form === 'periodo' ? createMutation.error : generarAnioMutation.error;

  const openForm = (next: 'periodo' | 'anio') => {
    setNewAnio('');
    setNewMes('');
    setForm(next);
  };
  const createPeriodo = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    createMutation.mutate(
      { anio: Number(newAnio), mes: Number(newMes) },
      {
        onSuccess: () => {
          setForm(null);
          toast.success('Período creado.');
        },
      },
    );
  };
  const generarAnio = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    generarAnioMutation.mutate(Number(newAnio), {
      onSuccess: () => {
        setForm(null);
        toast.success('Año generado.');
      },
    });
  };
  const validar = async (periodo: PeriodoContable) => {
    try {
      setFeedback({
        title: `Validación de ${periodo.anio}-${String(periodo.mes).padStart(2, '0')}`,
        result: await validarMutation.mutateAsync(periodo.id),
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo validar el período.');
    }
  };
  const executePendingAction = async () => {
    if (!pendingAction) return;
    try {
      if (pendingAction.type === 'cerrar') {
        const result = await cerrarMutation.mutateAsync(pendingAction.periodo.id);
        setFeedback({
          title: `Resultado de cierre ${pendingAction.periodo.anio}-${String(pendingAction.periodo.mes).padStart(2, '0')}`,
          result,
        });
      } else if (pendingAction.type === 'reabrir') {
        const result = await reabrirMutation.mutateAsync({
          periodoId: pendingAction.periodo.id,
          motivo: pendingAction.motivo,
        });
        setFeedback({
          title: `Resultado de reapertura ${pendingAction.periodo.anio}-${String(pendingAction.periodo.mes).padStart(2, '0')}`,
          result,
        });
      } else {
        const result = await cerrarAnioMutation.mutateAsync(pendingAction.periodo.anio);
        setFeedback({ title: `Resultado de cierre anual ${pendingAction.periodo.anio}`, result });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo completar la operación.');
    } finally {
      setPendingAction(null);
    }
  };
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h2 className="text-base font-semibold text-foreground">Períodos contables</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Consulta el estado y solicita las operaciones de cierre disponibles.
          </p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isOperating}
              onClick={() => openForm('anio')}
            >
              Generar año
            </Button>
            <Button size="sm" disabled={isOperating} onClick={() => openForm('periodo')}>
              <Plus className="size-4" aria-hidden="true" />
              Nuevo período
            </Button>
          </div>
        )}
      </div>
      <div className="grid gap-3 rounded-[--radius-card] border border-border bg-surface p-4 sm:grid-cols-2">
        <Input
          aria-label="Filtrar por año"
          type="number"
          min="2000"
          max="2100"
          placeholder="Año"
          value={filters.anio ?? ''}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              anio: event.target.value ? Number(event.target.value) : undefined,
            }))
          }
        />
        <Select
          aria-label="Filtrar por estado"
          value={filters.estado ?? ''}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              estado: (event.target.value || undefined) as PeriodoContableFilters['estado'],
            }))
          }
        >
          <option value="">Todos los estados</option>
          <option value="ABIERTO">Abiertos</option>
          <option value="CERRADO">Cerrados</option>
        </Select>
      </div>
      {isError ? (
        <EmptyState
          icon={AlertTriangle}
          title="No pudimos cargar los períodos."
          description="Revisa tu conexión e inténtalo nuevamente."
          action={
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Reintentar
            </Button>
          }
        />
      ) : (
        <PeriodosContablesTable
          periodos={periodos ?? []}
          isLoading={isLoading}
          isOperating={isOperating}
          canManage={canManage}
          onValidar={validar}
          onCerrar={(periodo) => setPendingAction({ type: 'cerrar', periodo })}
          onReabrir={(periodo) => {
            setMotivo('');
            setReopenPeriod(periodo);
          }}
          onCerrarAnio={(periodo) => setPendingAction({ type: 'anual', periodo })}
          empty={
            <EmptyState
              icon={CalendarDays}
              title="Aún no hay períodos contables."
              description="Genera un año o crea un período para iniciar la gestión."
              action={
                canManage ? (
                  <Button size="sm" disabled={isOperating} onClick={() => openForm('anio')}>
                    Generar año
                  </Button>
                ) : undefined
              }
            />
          }
        />
      )}
      <SideSheet
        open={form !== null}
        onOpenChange={(open) => {
          if (!open) setForm(null);
        }}
        title={form === 'anio' ? 'Generar períodos del año' : 'Nuevo período'}
        description={
          form === 'anio'
            ? 'La operación usa la generación anual existente.'
            : 'Registra un período con el contrato existente.'
        }
      >
        {formError && (
          <Alert variant="destructive" className="mb-4">
            {formError.message}
          </Alert>
        )}
        <form onSubmit={form === 'anio' ? generarAnio : createPeriodo} className="space-y-6">
          <FormField label="Año" required>
            <Input
              type="number"
              min="2000"
              max="2100"
              value={newAnio}
              onChange={(event) => setNewAnio(event.target.value)}
              required
            />
          </FormField>
          {form === 'periodo' && (
            <FormField label="Mes" required>
              <Select value={newMes} onChange={(event) => setNewMes(event.target.value)} required>
                <option value="">Selecciona un mes</option>
                {Array.from({ length: 12 }, (_, index) => (
                  <option key={index + 1} value={index + 1}>
                    {index + 1}
                  </option>
                ))}
              </Select>
            </FormField>
          )}
          <div className="flex justify-end border-t border-border-soft pt-5">
            <Button
              type="submit"
              disabled={createMutation.isPending || generarAnioMutation.isPending || isOperating}
            >
              {form === 'anio' ? 'Generar año' : 'Crear período'}
            </Button>
          </div>
        </form>
      </SideSheet>
      <SideSheet
        open={Boolean(reopenPeriod)}
        onOpenChange={(open) => {
          if (!open) setReopenPeriod(undefined);
        }}
        title="Motivo de reapertura"
        description="El motivo será enviado al servicio de cierre existente."
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (reopenPeriod) {
              setPendingAction({ type: 'reabrir', periodo: reopenPeriod, motivo });
              setReopenPeriod(undefined);
            }
          }}
          className="space-y-6"
        >
          <FormField label="Motivo" required>
            <Input value={motivo} onChange={(event) => setMotivo(event.target.value)} required />
          </FormField>
          <div className="flex justify-end border-t border-border-soft pt-5">
            <Button type="submit" disabled={!motivo.trim() || isOperating}>
              Continuar
            </Button>
          </div>
        </form>
      </SideSheet>
      <SideSheet
        open={feedback !== null}
        onOpenChange={(open) => {
          if (!open) setFeedback(null);
        }}
        title={feedback?.title ?? 'Resultado'}
        description="Respuesta devuelta por el backend."
      >
        {feedback && (
          <pre className="overflow-x-auto rounded-md border border-border bg-canvas p-3 text-xs text-foreground">
            {JSON.stringify(feedback.result, null, 2)}
          </pre>
        )}
      </SideSheet>
      {pendingAction?.type === 'anual' ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setPendingAction(null);
          }}
          title="Cierre anual"
          description="Esta es una operación de alto impacto para el año seleccionado."
          correction="El resultado y cualquier bloqueo serán informados por el servicio de cierre anual."
          confirmLabel="Ejecutar cierre anual"
          level={2}
          onConfirm={executePendingAction}
        />
      ) : pendingAction ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setPendingAction(null);
          }}
          title={pendingAction.type === 'cerrar' ? 'Cerrar período' : 'Reabrir período'}
          description={
            pendingAction.type === 'cerrar'
              ? 'Esta operación impedirá nuevos movimientos sobre el período.'
              : 'El período volverá a permitir registros contables.'
          }
          confirmLabel={pendingAction.type === 'cerrar' ? 'Cerrar período' : 'Reabrir período'}
          level={1}
          onConfirm={executePendingAction}
        />
      ) : null}
    </div>
  );
}
