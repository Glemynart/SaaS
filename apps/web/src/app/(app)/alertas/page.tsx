'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Info,
  ShieldAlert,
  Loader2,
  RefreshCw,
  UserRound,
} from 'lucide-react';
import { formatNombreCompleto } from '@saas/types';
import {
  useAlerts,
  useResolveAlert,
  useGenerateContractAlerts,
  useGenerateMissingDocAlerts,
} from '@/features/alerts/hooks/use-alerts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

const SEVERITY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  INFO: Info,
  WARNING: AlertTriangle,
  CRITICAL: ShieldAlert,
};

const SEVERITY_COLORS: Record<string, string> = {
  INFO: 'bg-blue-50 text-blue-700 border-blue-200',
  WARNING: 'bg-amber-50 text-amber-700 border-amber-200',
  CRITICAL: 'bg-red-50 text-red-700 border-red-200',
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AlertasPage() {
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('OPEN');

  const { data, isLoading } = useAlerts({
    limit: 50,
    severity: severityFilter || undefined,
    status: statusFilter || undefined,
  });

  const resolveMutation = useResolveAlert();
  const genContractAlerts = useGenerateContractAlerts();
  const genMissingAlerts = useGenerateMissingDocAlerts();

  const alerts = data?.data ?? [];
  const stats = data?.stats;

  const handleResolve = useCallback(
    (id: string) => {
      resolveMutation.mutate(id);
    },
    [resolveMutation],
  );

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-[-0.018em] text-foreground">Alertas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Seguimiento del ciclo de vida contractual de tus empleados.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => genMissingAlerts.mutate()}
            disabled={genMissingAlerts.isPending}
          >
            {genMissingAlerts.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            Docs faltantes
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => genContractAlerts.mutate()}
            disabled={genContractAlerts.isPending}
          >
            {genContractAlerts.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            Contratos
          </Button>
        </div>
      </div>

      {stats && (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Bell className="size-3.5" /> Abiertas
            </div>
            <p className="mt-1 text-2xl font-semibold text-foreground">{stats.open}</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <ShieldAlert className="size-3.5" /> Críticas
            </div>
            <p className="mt-1 text-2xl font-semibold text-red-600">{stats.critical}</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <CheckCircle2 className="size-3.5" /> Resueltas
            </div>
            <p className="mt-1 text-2xl font-semibold text-emerald-600">{stats.resolved}</p>
          </div>
        </div>
      )}

      <div className="mb-6 flex items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 rounded-md border border-border bg-white px-3 py-2 text-sm text-muted-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        >
          <option value="OPEN">Abiertas</option>
          <option value="RESOLVED">Resueltas</option>
          <option value="">Todas</option>
        </select>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="h-10 rounded-md border border-border bg-white px-3 py-2 text-sm text-muted-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        >
          <option value="">Todas las severidades</option>
          <option value="INFO">Info</option>
          <option value="WARNING">Warning</option>
          <option value="CRITICAL">Crítica</option>
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-[5rem] w-full rounded-lg" />
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <div className="flex h-72 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface/30">
          <CheckCircle2 className="mb-3 size-8 text-emerald-400/50" />
          <p className="text-sm font-medium text-muted-foreground">No hay alertas activas</p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Usá los botones superiores para generar alertas automáticamente.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-white">
          <div className="divide-y divide-border">
            {alerts.map((alert) => {
              const SevIcon = SEVERITY_ICONS[alert.severity] ?? Info;
              return (
                <div
                  key={alert.id}
                  className={`group flex items-start gap-4 px-5 py-4 ${alert.status === 'RESOLVED' ? 'opacity-50' : ''}`}
                >
                  <div className="mt-0.5">
                    <SevIcon className="size-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{alert.titulo}</p>
                      <Badge className={SEVERITY_COLORS[alert.severity]}>{alert.severity}</Badge>
                      {alert.status === 'RESOLVED' && (
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
                          Resuelta
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{alert.descripcion}</p>
                    <div className="mt-1.5 flex items-center gap-3 text-[0.68rem] text-muted-foreground/60">
                      {alert.employee && (
                        <Link
                          href={`/empleados/${alert.employee.id}`}
                          className="inline-flex items-center gap-1 hover:text-foreground"
                        >
                          <UserRound className="size-3" /> {formatNombreCompleto(alert.employee)}
                        </Link>
                      )}
                      {alert.expedienteDoc && <span>{alert.expedienteDoc.nombre}</span>}
                      <span>{formatDate(alert.createdAt)}</span>
                    </div>
                  </div>
                  {alert.status === 'OPEN' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 text-xs text-muted-foreground hover:text-emerald-600"
                      onClick={() => handleResolve(alert.id)}
                      disabled={resolveMutation.isPending}
                    >
                      <CheckCircle2 className="size-3.5" /> Resolver
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
