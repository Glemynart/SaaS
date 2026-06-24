'use client';

import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft, Layers, Play, RotateCcw } from 'lucide-react';
import {
  useLote,
  useLoteProgress,
  useProcessLote,
  useRetryLote,
} from '@/features/lotes/hooks/use-lotes';
import { LoteProgressBar } from '@/features/lotes/components/lote-progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { LoteEstado, LoteErrorEntry } from '@/features/lotes/services/lotes-api';

const ESTADO_STYLE: Record<LoteEstado, string> = {
  PENDIENTE: 'bg-amber-50 text-amber-700',
  EN_PROCESO: 'bg-blue-50 text-blue-700',
  COMPLETADO: 'bg-emerald-50 text-emerald-700',
  COMPLETADO_CON_ERRORES: 'bg-orange-50 text-orange-700',
  FALLIDO: 'bg-red-50 text-red-700',
};

const ESTADO_LABEL: Record<LoteEstado, string> = {
  PENDIENTE: 'Pendiente',
  EN_PROCESO: 'En proceso',
  COMPLETADO: 'Completado',
  COMPLETADO_CON_ERRORES: 'Con errores',
  FALLIDO: 'Fallido',
};

const TIPO_LABELS: Record<string, string> = {
  TERMINO_FIJO: 'Término Fijo',
  TERMINO_INDEFINIDO: 'Término Indefinido',
  OBRA_LABOR: 'Obra o Labor',
  APRENDIZAJE: 'Aprendizaje',
  PRESTACION_SERVICIOS: 'Prestación Servicios',
};

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
  const isMutating = processMutation.isPending || retryMutation.isPending;
  const mutationError = processMutation.error ?? retryMutation.error;

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
          <Badge className={ESTADO_STYLE[lote.estado]}>
            {ESTADO_LABEL[lote.estado] ?? lote.estado}
          </Badge>
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
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
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
            <p className="text-sm font-medium">{lote.documentTemplate.nombre}</p>
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

      <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted-foreground">Total empleados</dt>
            <dd className="font-medium">{lote.total}</dd>
            <dt className="text-muted-foreground">Procesados</dt>
            <dd className="font-medium text-emerald-600">{activeProgress.procesados}</dd>
            <dt className="text-muted-foreground">Fallidos</dt>
            <dd className="font-medium text-red-600">{activeProgress.fallidos}</dd>
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
          <div className="overflow-hidden rounded-xl border border-red-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-red-100 bg-red-50/50 text-red-700">
                <tr>
                  <th className="px-4 py-2 font-medium">Cédula</th>
                  <th className="px-4 py-2 font-medium">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-100">
                {errors.map((err, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2 text-muted-foreground">{err.cedula}</td>
                    <td className="px-4 py-2 text-red-600">{err.error}</td>
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
