'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  Calculator,
  FileText,
  Layers,
  Loader2,
  Receipt,
  type LucideIcon,
} from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';
import type { BandejaBadge, BandejaItem, BandejaTipo } from '../lib/bandeja';

/** El icono identifica el tipo, monocromo; la urgencia no viaja aquí (§4.4). */
const TIPO_ICON: Record<BandejaTipo, LucideIcon> = {
  contrato: FileText,
  alerta: AlertCircle,
  lote: Layers,
  nomina: Calculator,
  factura: Receipt,
};

/** Puente tipado hacia el StatusBadge genérico (el mapeo semántico vive en DS §7). */
function ItemBadge({ badge }: { badge: BandejaBadge }) {
  switch (badge.domain) {
    case 'contrato':
      return <StatusBadge domain="contrato" estado={badge.estado} />;
    case 'alertaSeverity':
      return <StatusBadge domain="alertaSeverity" estado={badge.estado} />;
    case 'lote':
      return <StatusBadge domain="lote" estado={badge.estado} />;
    case 'nominaN2':
      return <StatusBadge domain="nominaN2" estado={badge.estado} />;
    case 'factura':
      return <StatusBadge domain="factura" estado={badge.estado} />;
  }
}

interface BandejaRowProps {
  item: BandejaItem;
  /** Entrada con crossfade tras Actualizar (§11); nunca en la carga inicial (DB-D9). */
  entering?: boolean;
  /** Colapso en altura + desvanecido al resolver (§11). */
  leaving?: boolean;
  resolving?: boolean;
  onResolve?: (alertId: string) => void;
}

export function BandejaRow({ item, entering, leaving, resolving, onResolve }: BandejaRowProps) {
  const [faded, setFaded] = useState(!entering);

  useEffect(() => {
    if (faded) return;
    const raf = requestAnimationFrame(() => setFaded(true));
    return () => cancelAnimationFrame(raf);
  }, [faded]);

  const Icon = TIPO_ICON[item.tipo];

  return (
    <li
      className={cn(
        'grid transition-[grid-template-rows,opacity] duration-200 ease-[var(--ease-out-ui)]',
        leaving ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr]',
      )}
    >
      <div className="overflow-hidden">
        <div
          className={cn(
            'flex flex-col gap-3 px-4 py-3.5 transition-[background-color,opacity] duration-150 hover:bg-muted/40 md:flex-row md:items-center md:gap-4',
            faded ? 'opacity-100' : 'opacity-0',
          )}
        >
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span
              className="grid size-8 shrink-0 place-items-center rounded-[--radius-control] border border-border bg-surface"
              aria-hidden="true"
            >
              <Icon className="size-4 text-muted-foreground" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {item.href ? (
                  <Link
                    href={item.href}
                    className="rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    {item.asunto}
                  </Link>
                ) : (
                  item.asunto
                )}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs text-muted-foreground">
                <ItemBadge badge={item.badge} />
                <span>
                  {item.fraseTemporal}
                  {item.meta ? ` · ${item.meta}` : ''}
                </span>
              </p>
            </div>
          </div>

          {/* Acciones siempre visibles, nunca solo-hover (EXP-03, DB-D5). */}
          <div className="flex shrink-0 items-center gap-2 pl-11 md:pl-0">
            {item.href && item.accionLabel && (
              <Link
                href={item.href}
                aria-label={item.accionNombreAccesible ?? item.accionLabel}
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                {item.accionLabel}
              </Link>
            )}
            {item.alertaResolubleId && onResolve && (
              <Button
                variant="ghost"
                size="sm"
                disabled={resolving || leaving}
                aria-label={item.nombreResoluble ?? 'Resolver'}
                onClick={() => onResolve(item.alertaResolubleId!)}
              >
                {resolving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                Resolver
              </Button>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
