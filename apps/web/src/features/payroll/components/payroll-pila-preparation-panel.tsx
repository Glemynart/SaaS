'use client';

import { useState } from 'react';
import { ClipboardCheck, LoaderCircle } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { usePayrollPilaPreparation } from '../hooks/use-payroll';
import type { PilaPreparationIssue, PayrollPeriodStatus } from '../services/payroll-api';

const recordLabels: Record<PilaPreparationIssue['record'], string> = {
  APORTANTE_TIPO_1: 'Archivo tipo 1, aportante',
  CABECERA_TIPO_2: 'Archivo tipo 2, cabecera',
  DETALLE_TIPO_2: 'Archivo tipo 2, cotizante',
  SNAPSHOT: 'Snapshot de nómina',
};

export function PayrollPilaPreparationPanel({
  periodId,
  periodStatus,
}: {
  periodId: string;
  periodStatus: PayrollPeriodStatus;
}) {
  const [requested, setRequested] = useState(false);
  const query = usePayrollPilaPreparation(periodId, requested);

  if (periodStatus !== 'APROBADA' && periodStatus !== 'CAUSADA') return null;

  return (
    <section
      className="mb-6 rounded-xl border border-border bg-surface p-5"
      aria-labelledby="pila-preparation-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="pila-preparation-title" className="flex items-center gap-2 font-semibold">
            <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
            Preparación de datos PILA
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Revisa los datos congelados en los snapshots aprobados frente a los requisitos PILA
            identificados hasta ahora. La matriz normativa sigue en reconciliación.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={query.isFetching}
          onClick={() => setRequested(true)}
        >
          {query.isFetching && (
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
          )}
          {query.isFetching ? 'Revisando…' : query.data ? 'Actualizar revisión' : 'Revisar datos'}
        </Button>
      </div>

      {query.isError && (
        <Alert variant="destructive" className="mt-4">
          {query.error instanceof Error
            ? query.error.message
            : 'No se pudo revisar la preparación de datos PILA.'}
        </Alert>
      )}

      {query.data && (
        <div className="mt-4 space-y-4" aria-live="polite">
          <Alert>
            {query.data.mensaje} Período: {query.data.period.fechaInicio} a{' '}
            {query.data.period.fechaFin}. Fecha prevista de aportes:{' '}
            {query.data.period.fechaPrevistaPagoPila ?? 'sin registrar'}.
          </Alert>

          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <span>
              Snapshots revisados: <strong>{query.data.snapshotsRevisados}</strong>
            </span>
            <span>
              Con datos pendientes: <strong>{query.data.empleadosConDatosPendientes}</strong>
            </span>
            <span>
              Sin brechas detectadas: <strong>{query.data.empleadosSinBrechasDetectadas}</strong>
            </span>
          </div>

          {query.data.issues.length > 0 ? (
            <ul className="space-y-3">
              {query.data.issues.map((issue) => (
                <li
                  key={`${issue.record}-${issue.fieldNumber ?? 'snapshot'}-${issue.code}`}
                  className="rounded-lg border border-border px-4 py-3"
                >
                  <p className="text-sm font-medium">
                    {recordLabels[issue.record]}
                    {issue.fieldNumber !== null ? ` · campo ${issue.fieldNumber}` : ''}
                    {issue.affectedCount > 0 ? ` · ${issue.affectedCount} empleados` : ''}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{issue.message}</p>
                  {issue.affectedEmployees.length > 0 && (
                    <details className="mt-2 text-sm">
                      <summary className="cursor-pointer text-primary">
                        Ver empleados afectados
                      </summary>
                      <ul className="mt-2 list-inside list-disc text-muted-foreground">
                        {issue.affectedEmployees.map((name, index) => (
                          <li key={`${issue.code}-${index}`}>{name}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No se detectaron brechas en los campos incluidos en esta revisión.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
