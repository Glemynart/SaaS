'use client';

import { useUpdatePilaVoluntaryPensionStatus } from '../hooks/use-payroll';
import type { PayrollPeriodStatus, PayrollRun } from '../services/payroll-api';
import { useMe } from '@/features/auth/hooks/use-auth';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { formatNombreCompleto } from '@saas/types';
import { toast } from 'sonner';

const statusLabels: Record<PayrollRun['pilaVoluntaryPensionStatus'], string> = {
  UNCONFIRMED: 'Pendiente de confirmación',
  NONE_CONFIRMED: 'Sin aportes confirmados',
  PRESENT: 'Reportados; fuera del alcance actual',
};

export function PayrollPilaVoluntaryPensionStatusPanel({
  periodId,
  periodStatus,
  runs,
}: {
  periodId: string;
  periodStatus: PayrollPeriodStatus;
  runs: PayrollRun[];
}) {
  const mutation = useUpdatePilaVoluntaryPensionStatus(periodId);
  const { data: me } = useMe();
  if (runs.length === 0) return null;

  const canEditPeriod = ['CALCULADA', 'EN_REVISION'].includes(periodStatus);
  const canManage = me?.user.rol === 'ADMIN' || me?.user.rol === 'OPERADOR';
  const canEdit = canEditPeriod && canManage;

  async function update(runId: string, status: PayrollRun['pilaVoluntaryPensionStatus']) {
    try {
      await mutation.mutateAsync({ runId, status });
      toast.success('Se guardó la declaración de aportes voluntarios.');
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'No se pudo guardar la declaración de aportes voluntarios.',
      );
    }
  }

  return (
    <section
      className="mb-6 rounded-xl border border-border bg-surface p-5"
      aria-labelledby="pila-voluntary-pension-title"
    >
      <h2 id="pila-voluntary-pension-title" className="font-semibold">
        Aportes voluntarios a pensión para PILA
      </h2>
      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
        Confirma por empleado si en este período no hubo aportes voluntarios a pensión del
        trabajador ni del empleador. La declaración no modifica la liquidación de nómina.
      </p>

      <Alert className="mt-3">
        Confirma “Sin aportes” solo después de verificar ambos valores. Si hubo aportes, este MVP
        mantiene bloqueados sus campos hasta que exista captura de importes y retención.
      </Alert>

      {!canEditPeriod && (
        <p className="mt-3 text-xs text-muted-foreground">
          La declaración quedó congelada al aprobar la nómina y ahora se muestra solo para consulta.
        </p>
      )}
      {canEditPeriod && !canManage && (
        <p className="mt-3 text-xs text-muted-foreground">
          Solo ADMIN u OPERADOR puede registrar esta declaración antes de aprobar la nómina.
        </p>
      )}

      <div className="mt-4 divide-y divide-border rounded-lg border border-border">
        {runs.map((run) => (
          <div
            key={run.id}
            className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-sm font-medium text-foreground">
                {formatNombreCompleto(run.employee)}
              </p>
              <p className="text-xs text-muted-foreground">
                {run.employee.cedula} · {statusLabels[run.pilaVoluntaryPensionStatus]}
                {run.pilaVoluntaryPensionUpdatedAt &&
                  ` · ${new Date(run.pilaVoluntaryPensionUpdatedAt).toLocaleString('es-CO')}`}
              </p>
            </div>
            {canEdit && (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={
                    run.pilaVoluntaryPensionStatus === 'NONE_CONFIRMED' ? 'default' : 'outline'
                  }
                  disabled={
                    mutation.isPending || run.pilaVoluntaryPensionStatus === 'NONE_CONFIRMED'
                  }
                  onClick={() => update(run.id, 'NONE_CONFIRMED')}
                >
                  Confirmar sin aportes
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={run.pilaVoluntaryPensionStatus === 'PRESENT' ? 'destructive' : 'outline'}
                  disabled={mutation.isPending || run.pilaVoluntaryPensionStatus === 'PRESENT'}
                  onClick={() => update(run.id, 'PRESENT')}
                >
                  Marcar aportes presentes
                </Button>
                {run.pilaVoluntaryPensionStatus !== 'UNCONFIRMED' && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={mutation.isPending}
                    onClick={() => update(run.id, 'UNCONFIRMED')}
                  >
                    Quitar declaración
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
