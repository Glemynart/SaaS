'use client';

import { useUpdatePilaFspSourceScope } from '../hooks/use-payroll';
import type { PayrollPeriodStatus, PayrollRun } from '../services/payroll-api';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { formatNombreCompleto } from '@saas/types';
import { toast } from 'sonner';

const scopeLabels: Record<PayrollRun['pilaFspSourceScope'], string> = {
  UNCONFIRMED: 'Pendiente de confirmación',
  SINGLE_SOURCE_CONFIRMED: 'Una fuente confirmada',
  MULTIPLE_SOURCES: 'Múltiples fuentes',
};

export function PayrollPilaFspSourceScopePanel({
  periodId,
  periodStatus,
  runs,
}: {
  periodId: string;
  periodStatus: PayrollPeriodStatus;
  runs: PayrollRun[];
}) {
  const mutation = useUpdatePilaFspSourceScope(periodId);
  if (runs.length === 0) return null;

  const canEdit = ['CALCULADA', 'EN_REVISION'].includes(periodStatus);

  async function update(runId: string, sourceScope: PayrollRun['pilaFspSourceScope']) {
    try {
      await mutation.mutateAsync({ runId, sourceScope });
      toast.success('Se guardó la declaración de ingresos pensionales.');
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'No se pudo guardar la declaración de ingresos pensionales.',
      );
    }
  }

  return (
    <section
      className="mb-6 rounded-xl border border-border bg-surface p-5"
      aria-labelledby="pila-fsp-source-scope-title"
    >
      <h2 id="pila-fsp-source-scope-title" className="font-semibold">
        Alcance de ingresos pensionales para PILA
      </h2>
      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
        Confirma por empleado si esta nómina es su única fuente de ingreso pensional durante el
        período. La confirmación no cambia los valores liquidados. Si hay varias fuentes o no se
        puede confirmar el alcance, los campos 51 y 52 seguirán bloqueados.
      </p>

      <Alert className="mt-3">
        Marca “Una fuente confirmada” únicamente después de verificarlo para el empleado y este
        período. Una relación laboral única en el tenant no constituye por sí sola esa confirmación.
      </Alert>

      {!canEdit && (
        <p className="mt-3 text-xs text-muted-foreground">
          La declaración quedó congelada al aprobar la nómina y ahora se muestra solo para consulta.
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
                {run.employee.cedula} · {scopeLabels[run.pilaFspSourceScope]}
                {run.pilaFspSourceScopeUpdatedAt &&
                  ` · ${new Date(run.pilaFspSourceScopeUpdatedAt).toLocaleString('es-CO')}`}
              </p>
            </div>
            {canEdit && (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={
                    run.pilaFspSourceScope === 'SINGLE_SOURCE_CONFIRMED' ? 'default' : 'outline'
                  }
                  disabled={
                    mutation.isPending || run.pilaFspSourceScope === 'SINGLE_SOURCE_CONFIRMED'
                  }
                  onClick={() => update(run.id, 'SINGLE_SOURCE_CONFIRMED')}
                >
                  Confirmar una fuente
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={
                    run.pilaFspSourceScope === 'MULTIPLE_SOURCES' ? 'destructive' : 'outline'
                  }
                  disabled={mutation.isPending || run.pilaFspSourceScope === 'MULTIPLE_SOURCES'}
                  onClick={() => update(run.id, 'MULTIPLE_SOURCES')}
                >
                  Marcar varias fuentes
                </Button>
                {run.pilaFspSourceScope !== 'UNCONFIRMED' && (
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
