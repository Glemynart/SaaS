'use client';

import { useState } from 'react';
import { ClipboardCheck, LoaderCircle } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { usePayrollPilaPreparation } from '../hooks/use-payroll';
import type {
  PilaDetailContributionCandidateStatus,
  PilaPreparationIssue,
  PayrollPeriodStatus,
} from '../services/payroll-api';

const recordLabels: Record<PilaPreparationIssue['record'], string> = {
  APORTANTE_TIPO_1: 'Archivo tipo 1, aportante',
  CABECERA_TIPO_2: 'Archivo tipo 2, cabecera',
  DETALLE_TIPO_2: 'Archivo tipo 2, cotizante',
  SNAPSHOT: 'Snapshot de nómina',
};

const contributionFieldLabels: Record<
  PilaDetailContributionCandidateStatus['fieldNumber'],
  string
> = {
  46: 'Tarifa de pensión',
  47: 'Cotización obligatoria a pensiones',
  54: 'Tarifa de salud',
  55: 'Cotización obligatoria a salud',
  61: 'Tarifa inicial de riesgos laborales',
  63: 'Aporte ARL',
  64: 'Tarifa CCF',
  65: 'Aporte a caja de compensación',
  66: 'Tarifa SENA',
  67: 'Aporte SENA',
  68: 'Tarifa ICBF',
  69: 'Aporte ICBF',
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

  const exportReadiness = query.data?.exportReadiness;

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
            Revisa los datos congelados en los snapshots aprobados frente a campos de AT2 v30 con
            fuente identificada. El mapeo y las reglas aplicables siguen en reconciliación; este
            informe no valida un archivo completo.
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
          {exportReadiness && (
            <section
              className="rounded-lg border border-border p-4"
              aria-labelledby="pila-export-readiness-title"
            >
              <h3 id="pila-export-readiness-title" className="font-medium">
                Estado de exportación PILA
              </h3>
              <dl className="mt-2 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Layout de registros</dt>
                  <dd>{exportReadiness.recordLayoutVersion.replace('_', ' ')}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Generación y descarga</dt>
                  <dd>
                    {exportReadiness.fileGenerationStatus === 'NOT_IMPLEMENTED'
                      ? 'No implementadas'
                      : 'Disponibles'}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Validación local</dt>
                  <dd>
                    {exportReadiness.localValidationStatus === 'PRELIMINARY'
                      ? 'Preliminar; no cubre el archivo completo'
                      : 'Completa'}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Aceptación del operador</dt>
                  <dd>
                    {exportReadiness.operatorAcceptanceStatus === 'NOT_VERIFIED'
                      ? 'No verificada'
                      : 'Verificada'}
                  </dd>
                </div>
              </dl>

              <ul className="mt-4 space-y-3">
                {exportReadiness.blockers.map((blocker) => (
                  <li key={blocker.code} className="rounded-md bg-muted/40 px-3 py-2">
                    <p className="text-sm font-medium">{blocker.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {blocker.scope === 'FILE_GENERATION'
                        ? 'Bloquea la generación del archivo.'
                        : 'Pendiente para declarar compatibilidad con un operador.'}{' '}
                      {blocker.message}
                    </p>
                    {blocker.fields.length > 0 && (
                      <ul className="mt-2 list-inside list-disc text-sm text-muted-foreground">
                        {blocker.fields.map(({ record, fieldNumbers }) => (
                          <li key={`${blocker.code}-${record}`}>
                            {recordLabels[record]}: campos {fieldNumbers.join(', ')}
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      Evidencia: {blocker.evidence}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section
            className="rounded-lg border border-border p-4"
            aria-labelledby="pila-contribution-candidates-title"
          >
            <h3 id="pila-contribution-candidates-title" className="font-medium">
              Candidatos parciales de aportes
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Estos conteos indican si el snapshot aporta un valor candidato para cada campo. No
              confirman que la planilla completa cumpla las reglas PILA ni habilitan su descarga.
            </p>
            <ul className="mt-3 space-y-3">
              {query.data.detailContributionCandidates.map((status) => (
                <li key={status.fieldNumber} className="rounded-md bg-muted/40 px-3 py-2">
                  <p className="text-sm font-medium">
                    Campo {status.fieldNumber} · {contributionFieldLabels[status.fieldNumber]}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Con candidato: {status.candidateEmployees}; pendientes:{' '}
                    {status.pendingEmployees}.
                  </p>
                  {status.pendingReasons.length > 0 && (
                    <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                      {status.pendingReasons.map(({ reason, affectedEmployees }, index) => (
                        <li key={`${status.fieldNumber}-${index}`}>
                          <p>{reason}</p>
                          {affectedEmployees.length > 0 && (
                            <details className="mt-1">
                              <summary className="cursor-pointer text-primary">
                                Ver {affectedEmployees.length} empleados afectados
                              </summary>
                              <ul className="mt-2 list-inside list-disc">
                                {affectedEmployees.map((name, employeeIndex) => (
                                  <li key={`${status.fieldNumber}-${index}-${employeeIndex}`}>
                                    {name}
                                  </li>
                                ))}
                              </ul>
                            </details>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </section>

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
