'use client';

import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, RefreshCw, type LucideProps } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { toast } from '@/components/ui/toast';
import { useMe } from '@/features/auth/hooks/use-auth';
import { cn } from '@/lib/utils';
import {
  useBandejaSources,
  useInvalidateBandeja,
  useRefreshBandeja,
  useResolverItem,
} from '../hooks/use-bandeja';
import {
  buildAlertItems,
  buildFacturaItems,
  buildLoteItems,
  buildNominaItems,
  componerBandeja,
  type BandejaItem,
} from '../lib/bandeja';
import { BandejaRow } from './bandeja-row';
import { BandejaSkeleton } from './bandeja-skeleton';
import { QuickActions } from './quick-actions';

/** Duración del colapso-al-resolver (= --duration-base, §11). */
const COLLAPSE_MS = 200;

/** Check discreto en `text-success` para el vacío afirmativo (§9), sin tocar EmptyState. */
const CheckSereno = forwardRef<SVGSVGElement, LucideProps>(function CheckSereno(props, ref) {
  return <CheckCircle2 ref={ref} {...props} className={cn(props.className, 'text-success')} />;
});

function formatFrescura(ts: number, ahora: number): string {
  const min = Math.floor((ahora - ts) / 60_000);
  if (min < 1) return 'Actualizado hace un momento';
  if (min < 60) return `Actualizado hace ${min} min`;
  const horas = Math.floor(min / 60);
  return `Actualizado hace ${horas} h`;
}

const SOURCE_ERROR_LABELS = {
  alerts: 'No se pudieron cargar las alertas.',
  lotes: 'No se pudieron cargar los lotes.',
  payroll: 'No se pudieron cargar los períodos de nómina.',
  billing: 'No se pudieron cargar las facturas.',
} as const;

export function DashboardBandeja() {
  const me = useMe();
  const sources = useBandejaSources();
  const refresh = useRefreshBandeja();
  const resolver = useResolverItem();
  const invalidateBandeja = useInvalidateBandeja();

  const [leavingIds, setLeavingIds] = useState<ReadonlySet<string>>(new Set());
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [enteringIds, setEnteringIds] = useState<ReadonlySet<string>>(new Set());
  const prevIdsRef = useRef<Set<string>>(new Set());
  const fadeNextRef = useRef(false);

  const user = me.data?.user;
  const nombre = user?.nombre ?? 'equipo';
  const rol = user?.rol ?? 'OPERADOR';

  const { alerts, lotes, payroll, billing } = sources;

  const items = useMemo<BandejaItem[]>(() => {
    const hoy = new Date();
    return [
      ...(alerts.data ? buildAlertItems(alerts.data.data, hoy) : []),
      ...(lotes.data ? buildLoteItems(lotes.data.data, hoy) : []),
      ...(payroll.data ? buildNominaItems(payroll.data, hoy) : []),
      ...(billing.data ? buildFacturaItems(billing.data, hoy) : []),
    ];
  }, [alerts.data, lotes.data, payroll.data, billing.data]);

  const bandas = useMemo(() => componerBandeja(items, new Date(), rol), [items, rol]);
  const total = items.length;

  // Crossfade de entrada solo para ítems nuevos tras Actualizar (§11, DB-D9).
  useEffect(() => {
    const ids = new Set(items.map((item) => item.id));
    if (fadeNextRef.current) {
      const nuevos = new Set([...ids].filter((id) => !prevIdsRef.current.has(id)));
      setEnteringIds(nuevos);
      fadeNextRef.current = false;
    }
    prevIdsRef.current = ids;
  }, [items]);

  const queries = [alerts, lotes, payroll, billing] as const;
  const cargando = me.isLoading || queries.some((q) => q.isPending);
  const errorTotal = queries.every((q) => q.isError);
  const fuentesCaidas = (
    [
      ['alerts', alerts],
      ['lotes', lotes],
      ['payroll', payroll],
      ['billing', billing],
    ] as const
  ).filter(([, q]) => q.isError);

  const frescuraTs = Math.max(...queries.map((q) => q.dataUpdatedAt), 0);

  const handleRefresh = () => {
    refresh.mutate(undefined, {
      onSuccess: () => {
        fadeNextRef.current = true;
      },
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : 'No se pudo actualizar la bandeja.');
      },
    });
  };

  const handleResolve = (alertId: string) => {
    setResolvingId(alertId);
    resolver.mutate(alertId, {
      onSuccess: () => {
        toast.success('Alerta resuelta.');
        const rowId = `alerta-${alertId}`;
        setLeavingIds((prev) => new Set(prev).add(rowId));
        window.setTimeout(() => {
          void invalidateBandeja().then(() => {
            setLeavingIds((prev) => {
              const next = new Set(prev);
              next.delete(rowId);
              return next;
            });
          });
        }, COLLAPSE_MS);
      },
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : 'No se pudo resolver la alerta.');
      },
      onSettled: () => {
        setResolvingId(null);
      },
    });
  };

  if (cargando) {
    return <BandejaSkeleton />;
  }

  const descripcion = errorTotal
    ? `Hola, ${nombre}.`
    : total === 0
      ? `Hola, ${nombre}. Todo al día.`
      : `Hola, ${nombre}. Tienes ${total} ${total === 1 ? 'asunto' : 'asuntos'} por atender hoy.`;

  // ¿0 alertas porque nunca se han generado? (deuda ALERT-01, §9)
  const nuncaGenerado =
    alerts.data !== undefined && alerts.data.stats.open + alerts.data.stats.resolved === 0;

  return (
    <PageHeader
      title="Inicio"
      description={descripcion}
      width="standard"
      actions={
        <>
          {frescuraTs > 0 && (
            <span className="text-2xs text-muted-foreground">
              {formatFrescura(frescuraTs, Date.now())}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refresh.isPending}>
            <RefreshCw
              className={cn('size-4', refresh.isPending && 'animate-spin')}
              aria-hidden="true"
            />
            Actualizar
          </Button>
        </>
      }
    >
      {/* Región viva: el conteo se anuncia tras Actualizar/Resolver (§10). */}
      <p aria-live="polite" className="sr-only">
        {total === 0
          ? 'No tienes asuntos pendientes.'
          : `Tienes ${total} ${total === 1 ? 'asunto' : 'asuntos'} por atender.`}
      </p>

      <div className="space-y-6">
        {errorTotal ? (
          <div className="rounded-[--radius-card] border border-border bg-surface px-6 py-10 text-center shadow-[--shadow-card]">
            <p role="alert" className="text-sm text-foreground">
              No se pudo cargar tu bandeja. Revisa tu conexión e inténtalo de nuevo.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => queries.forEach((q) => void q.refetch())}
            >
              Reintentar
            </Button>
          </div>
        ) : total === 0 && fuentesCaidas.length === 0 ? (
          <EmptyState
            icon={CheckSereno}
            title="Todo al día"
            description={
              'No tienes asuntos pendientes por ahora. Cuando un contrato esté por vencer o un lote necesite atención, aparecerá aquí.' +
              (nuncaGenerado
                ? ' ¿Esperabas ver alertas? Pulsa Actualizar para revisar vencimientos y documentos.'
                : '')
            }
          />
        ) : (
          <section
            aria-label="Bandeja del día"
            className="rounded-[--radius-card] border border-border bg-surface py-2 shadow-[--shadow-card]"
          >
            <div className="space-y-6">
              {bandas.map((banda) => (
                <section key={banda.id} aria-labelledby={`banda-${banda.id}`}>
                  <h2
                    id={`banda-${banda.id}`}
                    className="px-4 pt-2 text-2xs font-medium uppercase tracking-wider text-muted-foreground"
                  >
                    {banda.label} · {banda.items.length}
                  </h2>
                  <ul className="mt-1 divide-y divide-border-soft">
                    {banda.items.map((item) => (
                      <BandejaRow
                        key={item.id}
                        item={item}
                        entering={enteringIds.has(item.id)}
                        leaving={leavingIds.has(item.id)}
                        resolving={resolvingId !== null && item.alertaResolubleId === resolvingId}
                        onResolve={handleResolve}
                      />
                    ))}
                  </ul>
                </section>
              ))}

              {/* Degradación parcial (DB-D8): la fuente caída avisa sin tumbar el resto. */}
              {fuentesCaidas.length > 0 && (
                <div className="divide-y divide-border-soft border-t border-border-soft">
                  {fuentesCaidas.map(([key, query]) => (
                    <div
                      key={key}
                      role="alert"
                      className="flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <p className="text-xs text-muted-foreground">{SOURCE_ERROR_LABELS[key]}</p>
                      <Button variant="ghost" size="sm" onClick={() => void query.refetch()}>
                        Reintentar
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        <QuickActions rol={rol} />
      </div>
    </PageHeader>
  );
}
