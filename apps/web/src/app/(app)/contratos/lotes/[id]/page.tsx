'use client';

import { use } from 'react';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CalendarDays, Layers, Play, RotateCcw } from 'lucide-react';
import {
  useLote,
  useLoteProgress,
  useProcessLote,
  useRetryLote,
} from '@/features/lotes/hooks/use-lotes';
import {
  useConfirmDocumentResolution,
  usePreviewDocumentResolution,
} from '@/features/document-resolution/hooks/use-document-resolution';
import type { DocumentResolutionItem } from '@/features/document-resolution/services/document-resolution-api';
import { LoteProgressBar } from '@/features/lotes/components/lote-progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import type { LoteErrorEntry } from '@/features/lotes/services/lotes-api';
import { getUserFacingError } from '@/lib/error-message';

const TIPO_LABELS: Record<string, string> = {
  TERMINO_FIJO: 'Término Fijo',
  TERMINO_INDEFINIDO: 'Término Indefinido',
  OBRA_LABOR: 'Obra o Labor',
  APRENDIZAJE: 'Aprendizaje',
  PRESTACION_SERVICIOS: 'Prestación Servicios',
};

const RESOLUTION_REASON_LABELS: Record<string, string> = {
  EMPLEADO_INEXISTENTE_O_FUERA_DEL_TENANT: 'Empleado inexistente o fuera de la empresa',
  VINCULO_INEXISTENTE_O_FUERA_DE_VIGENCIA: 'No existe un vínculo laboral vigente',
  PERFIL_INACTIVO: 'El perfil contractual está inactivo',
  CONFIGURACION_O_PLANTILLA_NO_VIGENTE: 'No existe una configuración o plantilla vigente',
};

function employeeName(item: DocumentResolutionItem): string {
  const name = [
    item.empleado.primerNombre,
    item.empleado.segundoNombre,
    item.empleado.primerApellido,
    item.empleado.segundoApellido,
  ]
    .filter(Boolean)
    .join(' ');

  return name || item.empleado.id;
}

function reasonLabel(reason: string | null): string {
  return reason ? (RESOLUTION_REASON_LABELS[reason] ?? reason) : '—';
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatDateTime(d: string): string {
  return new Date(d).toLocaleString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function LoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: lote, isLoading } = useLote(id);
  const { data: progress } = useLoteProgress(id, lote?.estado);
  const processMutation = useProcessLote();
  const retryMutation = useRetryLote();
  const previewMutation = usePreviewDocumentResolution();
  const confirmMutation = useConfirmDocumentResolution();
  const [fechaProceso, setFechaProceso] = useState('');
  const [confirmation, setConfirmation] = useState<{
    plans: Array<{ id: string }>;
    exclusions: Array<{ id: string }>;
  } | null>(null);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!lote) {
    return <div className="py-10 text-center text-muted-foreground">Lote no encontrado.</div>;
  }

  const canProcess = lote.estado === 'PENDIENTE' || lote.estado === 'COMPLETADO';
  const canRetry = lote.estado === 'FALLIDO' || lote.estado === 'COMPLETADO_CON_ERRORES';
  const isProcessing = lote.estado === 'EN_PROCESO';
  const isIntelligent = lote.proposito === 'CONTRATACION' && !lote.documentTemplate;
  const isMutating = processMutation.isPending || retryMutation.isPending;
  const mutationError = processMutation.error ?? retryMutation.error;
  const resolution = previewMutation.data ?? [];
  const resolvedCount = resolution.filter((item) => item.estado === 'RESUELTO').length;
  const blockedCount = resolution.filter((item) => item.estado === 'BLOQUEADO').length;
  const resolutionPayload = {
    loteId: id,
    ...(fechaProceso ? { fechaProceso } : {}),
  };

  const activeProgress = progress ?? {
    id: lote.id,
    estado: lote.estado,
    total: lote.total,
    procesados: lote.procesados,
    fallidos: lote.fallidos,
    iniciadoAt: lote.iniciadoAt,
    completadoAt: lote.completadoAt,
    erroresLog: lote.erroresLog,
    porcentaje:
      lote.total > 0 ? Math.round(((lote.procesados + lote.fallidos) / lote.total) * 100) : 0,
  };

  const errors: LoteErrorEntry[] = Array.isArray(lote.erroresLog)
    ? (lote.erroresLog as LoteErrorEntry[])
    : [];

  const previewResolution = () => {
    setConfirmation(null);
    previewMutation.mutate(resolutionPayload);
  };

  const confirmResolution = () => {
    confirmMutation.mutate(resolutionPayload, {
      onSuccess: (result) => setConfirmation(result),
    });
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/contratos/lotes"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <Layers className="size-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">{lote.nombreLote}</h1>
          <StatusBadge domain="lote" estado={lote.estado} />
        </div>
        <div className="flex gap-2">
          {canProcess && (
            <Button
              size="sm"
              onClick={() => processMutation.mutate(id)}
              disabled={isMutating}
              className="gap-1.5"
            >
              <Play className="size-4" />
              {processMutation.isPending ? 'Procesando...' : 'Procesar'}
            </Button>
          )}
          {canRetry && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => retryMutation.mutate(id)}
              disabled={isMutating}
              className="gap-1.5"
            >
              <RotateCcw className="size-4" />
              {retryMutation.isPending ? 'Reintentando...' : 'Reintentar'}
            </Button>
          )}
        </div>
      </div>

      {mutationError && (
        <div className="mb-6 rounded-md border border-destructive/25 bg-destructive/8 px-3 py-2 text-sm text-destructive">
          {mutationError.message}
        </div>
      )}

      {(isProcessing || activeProgress.porcentaje > 0) && (
        <div className="mb-6 rounded-lg border border-border bg-surface/50 p-5">
          <LoteProgressBar progress={activeProgress} />
          {isProcessing && (
            <p className="mt-2 text-xs text-muted-foreground">
              Actualizando automáticamente cada 5 segundos...
            </p>
          )}
        </div>
      )}

      <div className="mb-6 rounded-lg border border-border bg-surface/50 p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <span className="text-xs text-muted-foreground">Plantilla</span>
            <p className="text-sm font-medium">
              {lote.documentTemplate?.nombre ?? 'Se resolverá por configuración vigente'}
            </p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Sede</span>
            <p className="text-sm">{lote.sede?.nombre ?? '—'}</p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Creado por</span>
            <p className="text-sm font-medium">{lote.creadoPor.nombre}</p>
            <p className="text-xs text-muted-foreground">{lote.creadoPor.email}</p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Contratos generados</span>
            <p className="text-sm">{lote._count.contratos}</p>
          </div>
        </div>
      </div>

      {isIntelligent && (
        <section className="mb-6 rounded-xl border border-primary/30 bg-primary/5 p-6">
          <div className="flex items-start gap-3">
            <CalendarDays className="mt-0.5 size-5 text-primary" />
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-foreground">Resolución de campaña</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Previsualiza qué empleados tienen una configuración documental vigente y confirma
                todos los resultados válidos. Los bloqueados se conservan como exclusiones para una
                confirmación parcial.
              </p>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                <label className="space-y-1.5 text-sm">
                  <span className="block text-xs text-muted-foreground">
                    Fecha de proceso (opcional)
                  </span>
                  <input
                    aria-label="Fecha de proceso"
                    type="date"
                    value={fechaProceso}
                    onChange={(event) => setFechaProceso(event.target.value)}
                    className="h-10 rounded-md border border-input bg-control px-3 py-2 text-sm text-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </label>
                <Button
                  type="button"
                  variant="outline"
                  onClick={previewResolution}
                  disabled={previewMutation.isPending || confirmMutation.isPending}
                >
                  {previewMutation.isPending ? 'Previsualizando...' : 'Previsualizar resolución'}
                </Button>
              </div>

              {previewMutation.error && (
                <p className="mt-3 rounded-md border border-destructive/25 bg-destructive/8 px-3 py-2 text-sm text-destructive">
                  {getUserFacingError(
                    previewMutation.error,
                    'No se pudo previsualizar la resolución.',
                  )}
                </p>
              )}

              {resolution.length > 0 && (
                <div className="mt-5 space-y-4">
                  <div className="flex flex-wrap gap-3 text-sm">
                    <Badge variant="success">{resolvedCount} resueltos</Badge>
                    <Badge variant="warning">{blockedCount} bloqueados</Badge>
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-border bg-surface">
                    <table className="w-full min-w-[680px] text-left text-sm">
                      <thead className="border-b border-border bg-muted/30 text-muted-foreground">
                        <tr>
                          <th className="px-4 py-2 font-medium">Empleado</th>
                          <th className="px-4 py-2 font-medium">Perfil</th>
                          <th className="px-4 py-2 font-medium">Plantilla</th>
                          <th className="px-4 py-2 font-medium">Resultado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {resolution.map((item) => (
                          <tr key={item.empleado.id}>
                            <td className="px-4 py-3">{employeeName(item)}</td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {item.perfilContractual?.nombre ?? '—'}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {item.plantillaSeleccionada?.nombre ?? '—'}
                            </td>
                            <td className="px-4 py-3">
                              {item.estado === 'RESUELTO' ? (
                                <span className="text-success">Resuelto</span>
                              ) : (
                                <span className="text-warning">
                                  {reasonLabel(item.motivoBloqueo)}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {confirmMutation.error && (
                    <p className="rounded-md border border-destructive/25 bg-destructive/8 px-3 py-2 text-sm text-destructive">
                      {getUserFacingError(
                        confirmMutation.error,
                        'No se pudo confirmar la resolución.',
                      )}
                    </p>
                  )}

                  {confirmation ? (
                    <p className="rounded-md border border-success/25 bg-success/8 px-3 py-2 text-sm text-success">
                      Confirmación {confirmation.exclusions.length > 0 ? 'parcial' : 'total'}{' '}
                      guardada: {confirmation.plans.length} planes y{' '}
                      {confirmation.exclusions.length} exclusiones. Ya puedes procesar la campaña.
                    </p>
                  ) : (
                    <Button
                      type="button"
                      onClick={confirmResolution}
                      disabled={confirmMutation.isPending}
                    >
                      {confirmMutation.isPending ? 'Confirmando...' : 'Confirmar resolución'}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted-foreground">Total empleados</dt>
            <dd className="font-medium">{lote.total}</dd>
            <dt className="text-muted-foreground">Procesados</dt>
            <dd className="font-medium text-success">{activeProgress.procesados}</dd>
            <dt className="text-muted-foreground">Fallidos</dt>
            <dd className="font-medium text-destructive">{activeProgress.fallidos}</dd>
            <dt className="text-muted-foreground">Tipo contrato</dt>
            <dd>
              {lote.tipoContrato ? (TIPO_LABELS[lote.tipoContrato] ?? lote.tipoContrato) : '—'}
            </dd>
          </div>
          <div className="space-y-3">
            <div>
              <span className="text-xs text-muted-foreground">Fecha inicio contrato</span>
              <p className="text-sm">
                {lote.fechaInicioContrato ? formatDate(lote.fechaInicioContrato) : '—'}
              </p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Fecha fin contrato</span>
              <p className="text-sm">
                {lote.fechaFinContrato ? formatDate(lote.fechaFinContrato) : '—'}
              </p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Iniciado</span>
              <p className="text-sm">{lote.iniciadoAt ? formatDateTime(lote.iniciadoAt) : '—'}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Completado</span>
              <p className="text-sm">
                {lote.completadoAt ? formatDateTime(lote.completadoAt) : '—'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Errores ({errors.length})</h2>
          <div className="overflow-hidden rounded-xl border border-destructive/25 bg-surface">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-destructive/25 bg-destructive/8 text-destructive">
                <tr>
                  <th className="px-4 py-2 font-medium">Cédula</th>
                  <th className="px-4 py-2 font-medium">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {errors.map((err, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2 text-muted-foreground">{err.cedula}</td>
                    <td className="px-4 py-2 text-destructive">{err.error}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
