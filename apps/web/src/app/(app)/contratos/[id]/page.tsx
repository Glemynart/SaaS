'use client';

import { use, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';
import { useContract, useUpdateContractStatus } from '@/features/contracts/hooks/use-contracts';
import { formatNombreCompleto } from '@saas/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const TIPO_LABELS: Record<string, string> = {
  TERMINO_FIJO: 'Término Fijo',
  TERMINO_INDEFINIDO: 'Término Indefinido',
  OBRA_LABOR: 'Obra o Labor',
  APRENDIZAJE: 'Aprendizaje',
  PRESTACION_SERVICIOS: 'Prestación Servicios',
};

function estadoBadge(estado: string) {
  const m: Record<string, string> = {
    VIGENTE: 'bg-emerald-50 text-emerald-700',
    VENCIDO: 'bg-red-50 text-red-700',
    TERMINADO: 'bg-gray-100 text-gray-600',
    RENOVADO: 'bg-blue-50 text-blue-700',
  };
  return m[estado] ?? '';
}

const VALID_TRANSITIONS: Record<string, { label: string; estado: string }[]> = {
  VIGENTE: [
    { label: 'Vencido', estado: 'VENCIDO' },
    { label: 'Terminado', estado: 'TERMINADO' },
    { label: 'Renovado', estado: 'RENOVADO' },
  ],
  VENCIDO: [{ label: 'Renovado', estado: 'RENOVADO' }],
};

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
function cop(n: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(n);
}

export default function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: contract, isLoading } = useContract(id);
  const statusMutation = useUpdateContractStatus();

  const handleStatus = useCallback(
    (estado: string) => {
      if (confirm(`¿Cambiar estado a ${estado}?`)) {
        statusMutation.mutate({ id, estado });
      }
    },
    [id, statusMutation],
  );

  if (isLoading)
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  if (!contract)
    return <div className="py-10 text-center text-muted-foreground">Contrato no encontrado.</div>;

  const transitions = VALID_TRANSITIONS[contract.estado] ?? [];

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/contratos"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <FileText className="size-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Contrato</h1>
          <Badge className={estadoBadge(contract.estado)}>{contract.estado}</Badge>
        </div>
        {transitions.length > 0 && (
          <div className="flex gap-1">
            {transitions.map((t) => (
              <Button
                key={t.estado}
                variant="outline"
                size="sm"
                onClick={() => handleStatus(t.estado)}
                disabled={statusMutation.isPending}
              >
                {t.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      <div className="mb-6 rounded-lg border border-border bg-surface/50 p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <span className="text-xs text-muted-foreground">Empleado</span>
            <p className="text-sm font-medium">{formatNombreCompleto(contract.empleado)}</p>
            <p className="text-xs text-muted-foreground">
              {contract.empleado.tipoDocumento ?? ''} {contract.empleado.cedula}
            </p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Sede</span>
            <p className="text-sm">{contract.sede?.nombre ?? '—'}</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted-foreground">Tipo</dt>
            <dd className="font-medium">{TIPO_LABELS[contract.tipo] ?? contract.tipo}</dd>
            <dt className="text-muted-foreground">Cargo</dt>
            <dd className="font-medium">{contract.cargo}</dd>
            <dt className="text-muted-foreground">Salario</dt>
            <dd className="font-medium">{cop(contract.salario)}</dd>
            <dt className="text-muted-foreground">Inicio</dt>
            <dd>{formatDate(contract.fechaInicio)}</dd>
            <dt className="text-muted-foreground">Fin</dt>
            <dd>{contract.fechaFin ? formatDate(contract.fechaFin) : 'Indefinido'}</dd>
          </div>
          <div className="space-y-3">
            <div>
              <span className="text-xs text-muted-foreground">Plantilla</span>
              <p className="text-sm">{contract.plantilla?.nombre ?? '—'}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Lote</span>
              <p className="text-sm">{contract.lote ? `${contract.lote.estado}` : 'Individual'}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Creado</span>
              <p className="text-sm">{formatDate(contract.createdAt)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
