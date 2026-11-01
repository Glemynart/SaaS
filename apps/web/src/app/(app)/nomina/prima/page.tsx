'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, FileText, Loader2, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useApproveServicePremiumBatch,
  useCorrectServicePremiumBatch,
  useCreateServicePremiumBatch,
  useRetryServicePremiumBatch,
  useServicePremiumBatch,
  useServicePremiumBatches,
} from '@/features/payroll/hooks/use-payroll';
import type { ServicePremiumLine } from '@/features/payroll/services/payroll-api';

const COP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});
const STATUS_LABEL: Record<string, string> = {
  BORRADOR: 'Vista previa',
  APROBADO: 'Aprobado',
  PROCESANDO: 'Generando documentos',
  COMPLETADO: 'Completado',
  COMPLETADO_CON_BLOQUEOS: 'Completado con bloqueos',
  ERROR: 'Error',
  ANULADO: 'Anulado',
};
const LINE_LABEL: Record<string, string> = {
  LISTA: 'Lista para aprobar',
  BLOQUEADA: 'Bloqueada',
  NO_APLICA: 'No aplica',
  APROBADA: 'Aprobada',
  PROCESANDO: 'Generando PDF',
  DOCUMENTADA: 'PDF en expediente',
  ERROR: 'Error al generar PDF',
};

function amount(value: number | string | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
  return COP.format(Number(value));
}

function employeeName(line: ServicePremiumLine) {
  const employee = line.employee;
  return [
    employee.primerNombre,
    employee.segundoNombre,
    employee.primerApellido,
    employee.segundoApellido,
  ]
    .filter(Boolean)
    .join(' ');
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sourcePeriods(snapshot: unknown) {
  if (!isRecord(snapshot) || !Array.isArray(snapshot.snapshotPayloads)) return [];
  return snapshot.snapshotPayloads.flatMap((item) => {
    if (!isRecord(item) || !isRecord(item.payload)) return [];
    const period = item.payload.period;
    const concepts = Array.isArray(item.payload.concepts)
      ? item.payload.concepts.flatMap((concept) => {
          if (
            !isRecord(concept) ||
            typeof concept.codigo !== 'string' ||
            typeof concept.tipo !== 'string' ||
            typeof concept.valor !== 'number'
          ) {
            return [];
          }
          return [
            {
              code: concept.codigo,
              type: concept.tipo,
              value: concept.valor,
            },
          ];
        })
      : [];
    if (!isRecord(period)) return [];
    return [
      {
        id: typeof item.id === 'string' ? item.id : 'Snapshot',
        start: typeof period.fechaInicio === 'string' ? period.fechaInicio.slice(0, 10) : '—',
        end: typeof period.fechaFin === 'string' ? period.fechaFin.slice(0, 10) : '—',
        concepts,
      },
    ];
  });
}

export default function ServicePremiumPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [semester, setSemester] = useState(1);
  const [selectedId, setSelectedId] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const { data: batches, isLoading } = useServicePremiumBatches();
  const { data: selectedBatch, isLoading: isBatchLoading } = useServicePremiumBatch(selectedId);
  const create = useCreateServicePremiumBatch();
  const approve = useApproveServicePremiumBatch();
  const retry = useRetryServicePremiumBatch();
  const correct = useCorrectServicePremiumBatch();

  const readyLines = useMemo(
    () => selectedBatch?.lines?.filter((line) => line.status === 'LISTA').length ?? 0,
    [selectedBatch],
  );
  const failedLines = selectedBatch?.lines?.filter((line) => line.status === 'ERROR').length ?? 0;
  const blockedLines =
    selectedBatch?.lines?.filter((line) => line.status === 'BLOQUEADA').length ?? 0;
  const premiumLines = selectedBatch?.lines ?? [];
  const expectedPdfCount = premiumLines.filter(
    (line) => line.status !== 'BLOQUEADA' && line.status !== 'NO_APLICA',
  ).length;
  const publishedPdfCount = premiumLines.filter((line) => line.expedienteDoc !== null).length;
  const pendingPdfCount = premiumLines.filter(
    (line) => line.status === 'APROBADA' || line.status === 'PROCESANDO',
  ).length;
  const progressPercent =
    expectedPdfCount > 0 ? Math.round((publishedPdfCount / expectedPdfCount) * 100) : 0;

  function createPreview() {
    create.mutate({ year, semester }, { onSuccess: (batch) => setSelectedId(batch.id) });
  }

  function createCorrection() {
    if (!selectedId || correctionReason.trim().length < 15) return;
    correct.mutate(
      { id: selectedId, reason: correctionReason.trim() },
      {
        onSuccess: (batch) => {
          setCorrectionReason('');
          setSelectedId(batch.id);
        },
      },
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-[-0.018em] text-foreground">
            Prima de servicios
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Revisa el cálculo por empleado y genera un comprobante PDF inmutable en su Expediente
            Digital.
          </p>
        </div>
        <Link
          className="text-sm text-primary underline-offset-4 hover:underline"
          href="/nomina/periodos"
        >
          Ver períodos de nómina
        </Link>
      </header>

      <section className="flex gap-3 rounded-xl border border-warning/25 bg-warning/8 p-4 text-sm text-warning">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <p>
          La primera versión permite liquidar enero–junio. El segundo semestre aparece bloqueado
          hasta definir su corte y tratamiento de diciembre. Este comprobante documenta una
          liquidación; no acredita el pago ni crea un asiento contable.
        </p>
      </section>

      <p className="text-xs text-muted-foreground">
        Verifica el resultado con el responsable de nómina antes de usarlo para pagar una obligación
        laboral. Los casos no caracterizados se bloquean en lugar de estimarse.
      </p>

      <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-foreground">Preparar lote</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            La vista previa utiliza snapshots de nómina aprobados, no el salario actual del
            empleado.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="service-premium-year">Año</Label>
            <Input
              id="service-premium-year"
              type="number"
              min={2000}
              max={9999}
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
              className="w-32"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="service-premium-semester">Semestre</Label>
            <select
              id="service-premium-semester"
              value={semester}
              onChange={(event) => setSemester(Number(event.target.value))}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value={1}>Enero–junio</option>
              <option value={2}>Julio–diciembre (bloqueado)</option>
            </select>
          </div>
          <Button
            onClick={createPreview}
            disabled={create.isPending || !Number.isInteger(year) || year < 2000 || year > 9999}
          >
            {create.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <FileText className="mr-2 size-4" />
            )}
            Crear vista previa
          </Button>
        </div>
        {errorMessage(create.error) && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {errorMessage(create.error)}
          </p>
        )}
      </section>

      <section className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">Lotes anteriores</h2>
          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : batches?.length ? (
            <ul className="space-y-2">
              {batches.map((batch) => (
                <li key={batch.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(batch.id)}
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${selectedId === batch.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'}`}
                  >
                    <span className="block text-sm font-medium">
                      {batch.anio} · S{batch.semestre} · v{batch.version}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {STATUS_LABEL[batch.status] ?? batch.status} ·{' '}
                      {batch._count?.lines ?? batch.lines?.length ?? 0} empleados
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Aún no hay lotes.</p>
          )}
        </aside>

        <section className="min-w-0 rounded-xl border border-border bg-surface p-4 shadow-sm">
          {!selectedId ? (
            <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">
              Crea o selecciona un lote para ver su detalle.
            </div>
          ) : isBatchLoading || !selectedBatch ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold">
                    {selectedBatch.anio} · semestre {selectedBatch.semestre} · versión{' '}
                    {selectedBatch.version}
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Estado: {STATUS_LABEL[selectedBatch.status] ?? selectedBatch.status} · Fórmula v
                    {selectedBatch.formulaVersion}
                  </p>
                  {selectedBatch.correctionReason && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Corrección: {selectedBatch.correctionReason}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedBatch.status === 'BORRADOR' && readyLines > 0 && (
                    <Button
                      size="sm"
                      onClick={() => approve.mutate(selectedBatch.id)}
                      disabled={approve.isPending}
                    >
                      {approve.isPending ? (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="mr-2 size-4" />
                      )}
                      Aprobar y generar {readyLines} PDF{readyLines === 1 ? '' : 's'}
                    </Button>
                  )}
                  {['COMPLETADO', 'COMPLETADO_CON_BLOQUEOS'].includes(selectedBatch.status) && (
                    <div className="flex items-end gap-2">
                      {failedLines > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => retry.mutate(selectedBatch.id)}
                          disabled={retry.isPending}
                        >
                          <RefreshCw className="mr-2 size-4" /> Reintentar {failedLines}
                        </Button>
                      )}
                      <Input
                        aria-label="Razón de corrección"
                        value={correctionReason}
                        onChange={(event) => setCorrectionReason(event.target.value)}
                        placeholder="Razón (mínimo 15 caracteres)"
                        className="w-64"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={createCorrection}
                        disabled={correct.isPending || correctionReason.trim().length < 15}
                      >
                        Nueva versión
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              {(errorMessage(approve.error) ||
                errorMessage(retry.error) ||
                errorMessage(correct.error)) && (
                <p role="alert" className="mb-3 text-sm text-destructive">
                  {errorMessage(approve.error) ||
                    errorMessage(retry.error) ||
                    errorMessage(correct.error)}
                </p>
              )}
              {selectedBatch.status !== 'BORRADOR' && expectedPdfCount > 0 && (
                <section
                  aria-label="Avance de documentos del lote"
                  className="mb-3 rounded-lg border border-border bg-muted/20 p-3"
                >
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        PDF publicados en Expediente
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {publishedPdfCount} de {expectedPdfCount}
                      </p>
                    </div>
                    {failedLines > 0 && (
                      <Badge variant="danger">
                        {failedLines} PDF{failedLines === 1 ? '' : 's'} con error
                      </Badge>
                    )}
                  </div>
                  <div
                    role="progressbar"
                    aria-label="PDF publicados en Expediente"
                    aria-valuemin={0}
                    aria-valuemax={expectedPdfCount}
                    aria-valuenow={publishedPdfCount}
                    aria-valuetext={`${publishedPdfCount} de ${expectedPdfCount} PDF publicados`}
                    className="h-2 overflow-hidden rounded-full bg-muted"
                  >
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    {pendingPdfCount > 0 ? (
                      <>
                        <Clock3 className="size-3.5 shrink-0 text-primary" />
                        {pendingPdfCount} PDF{pendingPdfCount === 1 ? '' : 's'} en proceso. Puedes
                        cerrar la página; el servidor continuará y el avance se actualizará al
                        volver.
                      </>
                    ) : failedLines > 0 ? (
                      'Los documentos con error se pueden reintentar desde este lote.'
                    ) : (
                      'Todos los documentos aprobados están disponibles en Expediente.'
                    )}
                  </p>
                </section>
              )}
              {blockedLines > 0 && selectedBatch.status === 'BORRADOR' && (
                <p className="mb-3 text-sm text-warning">
                  {blockedLines} empleado(s) están bloqueados por datos fuente faltantes o ambiguos
                  y no recibirán PDF.
                </p>
              )}
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[970px] text-left text-xs">
                  <thead className="bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Empleado</th>
                      <th className="px-3 py-2">Salario fijo</th>
                      <th className="px-3 py-2">Variable prom.</th>
                      <th className="px-3 py-2">Auxilio prom.</th>
                      <th className="px-3 py-2">Días 30/360</th>
                      <th className="px-3 py-2">Prima</th>
                      <th className="px-3 py-2">Estado / detalle</th>
                      <th className="px-3 py-2">Fuentes y fórmula</th>
                      <th className="px-3 py-2">Expediente</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {selectedBatch.lines?.map((line) => (
                      <tr key={line.id} className="align-top">
                        <td className="px-3 py-3">
                          <span className="block font-medium text-foreground">
                            {employeeName(line)}
                          </span>
                          <span className="mt-0.5 block text-muted-foreground">
                            CC {line.employee.cedula}
                          </span>
                        </td>
                        <td className="px-3 py-3">{amount(line.salaryBase)}</td>
                        <td className="px-3 py-3">{amount(line.variableSalary)}</td>
                        <td className="px-3 py-3">{amount(line.transportAllowance)}</td>
                        <td className="px-3 py-3">{line.serviceDays360 ?? '—'}</td>
                        <td className="px-3 py-3 font-semibold">{amount(line.amount)}</td>
                        <td className="max-w-64 px-3 py-3">
                          <Badge
                            variant={
                              line.status === 'BLOQUEADA' || line.status === 'ERROR'
                                ? 'danger'
                                : 'neutral'
                            }
                          >
                            {LINE_LABEL[line.status] ?? line.status}
                          </Badge>
                          {line.blockReason && (
                            <p className="mt-1 text-muted-foreground">{line.blockReason}</p>
                          )}
                          {line.lastErrorCode && line.status === 'ERROR' && (
                            <p className="mt-1 text-muted-foreground">
                              Código: {line.lastErrorCode}
                            </p>
                          )}
                        </td>
                        <td className="max-w-80 px-3 py-3">
                          {line.sourceFingerprint ? (
                            <details>
                              <summary className="cursor-pointer text-primary">
                                Revisar períodos y conceptos
                              </summary>
                              <p className="mt-2 text-muted-foreground">
                                ({amount(line.salaryBase)} + {amount(line.variableSalary)} +{' '}
                                {amount(line.transportAllowance)}) × {line.serviceDays360} ÷ 360 ={' '}
                                {amount(line.amount)}
                              </p>
                              <ol className="mt-2 space-y-2">
                                {sourcePeriods(line.snapshot).map((source) => (
                                  <li key={source.id}>
                                    <span className="font-medium">
                                      {source.start} a {source.end}
                                    </span>
                                    <ul className="ml-3 list-disc">
                                      {source.concepts.map((concept, index) => (
                                        <li key={`${concept.code}-${index}`}>
                                          {concept.code} · {concept.type} · {amount(concept.value)}
                                        </li>
                                      ))}
                                    </ul>
                                  </li>
                                ))}
                              </ol>
                              <p
                                className="mt-2 text-muted-foreground"
                                title={line.sourceFingerprint}
                              >
                                Huella: {line.sourceFingerprint.slice(0, 12)}…
                              </p>
                            </details>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {line.expedienteDoc ? (
                            <Link
                              className="inline-flex items-center gap-1 text-primary hover:underline"
                              href={`/empleados/${line.employee.id}/expediente`}
                            >
                              <FileText className="size-3.5" /> Ver PDF
                            </Link>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </section>
    </div>
  );
}
