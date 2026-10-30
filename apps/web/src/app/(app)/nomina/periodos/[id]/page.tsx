'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import {
  useContabilizarPayrollPeriod,
  useExcludePayrollBlock,
  usePayrollBlocks,
  usePayrollPeriod,
} from '@/features/payroll/hooks/use-payroll';
import { ArrowLeft, BookOpenCheck } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useMe } from '@/features/auth/hooks/use-auth';
import { toast } from 'sonner';
import { formatNombreCompleto } from '@saas/types';
import { PayrollCorrectionsPanel } from '@/features/payroll/components/payroll-corrections-panel';

function cop(n: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(n);
}

export default function PeriodDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [confirmAccounting, setConfirmAccounting] = useState(false);
  const { data, isLoading } = usePayrollPeriod(id);
  const { data: blocks } = usePayrollBlocks(id);
  const { data: me } = useMe();
  const excludeMutation = useExcludePayrollBlock();
  const accountingMutation = useContabilizarPayrollPeriod();

  if (isLoading)
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  if (!data)
    return <div className="py-10 text-center text-muted-foreground">Periodo no encontrado.</div>;

  const { period, runs, totals } = data;
  const voucher = data.accountingVoucher;
  const preflightError =
    accountingMutation.data?.status === 'PREFLIGHT_ERROR'
      ? accountingMutation.data.preflight
      : null;
  const isAdmin = me?.user.rol === 'ADMIN';

  async function confirmAccrual() {
    try {
      const result = await accountingMutation.mutateAsync(id);
      setConfirmAccounting(false);
      if (result.status === 'PREFLIGHT_ERROR') {
        toast.error('La nómina no se contabilizó. Revisa las validaciones contables.');
      } else {
        toast.success(
          result.status === 'YA_CAUSADA'
            ? 'La nómina ya tenía un comprobante contable.'
            : 'Nómina contabilizada en el Ledger.',
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo contabilizar la nómina.');
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/nomina/periodos"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-foreground">{period.nombre}</h1>
        </div>
        <StatusBadge domain="nominaN2" estado={period.status} />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <p className="text-2xs text-muted-foreground">Total devengos</p>
          <p className="mt-1 text-xl font-semibold text-success">{cop(totals.totalDevengos)}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <p className="text-2xs text-muted-foreground">Total deducciones</p>
          <p className="mt-1 text-xl font-semibold text-destructive">
            {cop(totals.totalDeducciones)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <p className="text-2xs text-muted-foreground">Total neto</p>
          <p className="mt-1 text-xl font-semibold text-info">{cop(totals.totalNeto)}</p>
        </div>
      </div>

      <section className="mb-6 rounded-xl border border-border bg-surface p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Contabilidad</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              El asiento se genera desde la nómina aprobada y conserva el snapshot histórico.
            </p>
          </div>
          {period.status === 'APROBADA' && !voucher && isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmAccounting(true)}
              disabled={accountingMutation.isPending}
            >
              <BookOpenCheck className="size-4" aria-hidden="true" />
              Contabilizar en Ledger
            </Button>
          )}
        </div>

        {preflightError && (
          <div
            className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4"
            role="alert"
          >
            <p className="text-sm font-medium text-foreground">
              La contabilización quedó pendiente por configuración contable.
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
              {preflightError.validations.map((validation) => (
                <li key={validation.code}>{validation.message}</li>
              ))}
            </ul>
          </div>
        )}

        {voucher ? (
          <div className="mt-4 overflow-hidden rounded-lg border border-border">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/40 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Comprobante {voucher.numero ?? 'sin número'}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {voucher.concepto} ·{' '}
                  {new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC' }).format(
                    new Date(voucher.fecha),
                  )}
                </p>
              </div>
              <Badge variant={voucher.vigente ? 'success' : 'warning'}>
                {voucher.vigente ? 'Contabilizado' : voucher.reversado ? 'Revertido' : 'Anulado'}
              </Badge>
            </div>
            <div className="grid gap-3 border-b border-border px-4 py-3 text-xs sm:grid-cols-2">
              <p className="text-muted-foreground">
                Débitos: <strong className="text-foreground">{cop(voucher.totalDebito)}</strong>
              </p>
              <p className="text-muted-foreground">
                Créditos: <strong className="text-foreground">{cop(voucher.totalCredito)}</strong>
              </p>
            </div>
            <div className="divide-y divide-border">
              {voucher.movimientos.map((movement) => (
                <div
                  key={movement.linea}
                  className="grid gap-1 px-4 py-3 text-xs sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-5"
                >
                  <div>
                    <p className="font-medium text-foreground">
                      {movement.cuentaCodigo} · {movement.cuentaNombre}
                    </p>
                    {(movement.descripcion || movement.centroCostoNombre) && (
                      <p className="mt-0.5 text-muted-foreground">
                        {[
                          movement.descripcion,
                          movement.centroCostoNombre &&
                            `Centro de costo: ${movement.centroCostoCodigo} · ${movement.centroCostoNombre}`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    )}
                  </div>
                  <p className="text-muted-foreground">
                    Débito <strong className="text-foreground">{cop(movement.debito)}</strong>
                  </p>
                  <p className="text-muted-foreground">
                    Crédito <strong className="text-foreground">{cop(movement.credito)}</strong>
                  </p>
                </div>
              ))}
            </div>
            <p className="border-t border-border px-4 py-3 text-2xs text-muted-foreground">
              ID de comprobante: {voucher.id}. Si se requiere corregir la nómina, se registra un
              ajuste separado; el comprobante original no se edita.
            </p>
            {!voucher.vigente && (
              <p
                className="border-t border-warning/25 bg-warning/8 px-4 py-3 text-xs text-warning"
                role="alert"
              >
                {voucher.reversado
                  ? 'Este comprobante fue revertido y ya no respalda la causación. La contabilización de ajustes queda bloqueada hasta revisar y regularizar el asiento.'
                  : 'Este comprobante fue anulado y ya no respalda la causación. La contabilización de ajustes queda bloqueada hasta revisar y regularizar el asiento.'}
              </p>
            )}
          </div>
        ) : period.status === 'CAUSADA' ? (
          <p
            className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
            role="alert"
          >
            El período figura como contabilizado, pero no se encontró su comprobante asociado. No se
            creó otro asiento.
          </p>
        ) : period.status === 'APROBADA' ? (
          <p className="mt-4 text-xs text-muted-foreground">
            {isAdmin
              ? 'La nómina está aprobada y lista para causar en el período contable abierto.'
              : 'La nómina está aprobada. Un usuario administrador puede contabilizarla.'}
          </p>
        ) : (
          <p className="mt-4 text-xs text-muted-foreground">
            La causación estará disponible cuando el período esté aprobado.
          </p>
        )}
      </section>

      <PayrollCorrectionsPanel
        periodId={id}
        periodStatus={period.status}
        hasPayrollVoucher={Boolean(voucher?.vigente)}
        payrollVoucherReversed={Boolean(voucher && !voucher.vigente)}
        snapshots={data.snapshots}
      />

      {(blocks ?? []).length > 0 && (
        <div className="mb-6 overflow-hidden rounded-xl border border-border bg-surface">
          <div className="divide-y divide-border">
            {(blocks ?? []).map((block) => (
              <div key={block.id} className="flex items-start justify-between gap-4 px-5 py-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">
                      {formatNombreCompleto(block.employee)}
                    </p>
                    <StatusBadge domain="payrollBlock" estado={block.status} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{block.message}</p>
                  {block.excludedBy && (
                    <p className="mt-1 text-2xs text-muted-foreground/70">
                      Excluido por {block.excludedBy.nombre} {block.excludedBy.apellido}
                    </p>
                  )}
                </div>
                {block.status === 'ACTIVE' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => excludeMutation.mutate({ blockId: block.id })}
                    disabled={excludeMutation.isPending}
                  >
                    Excluir
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {runs.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
          Sin liquidaciones. Usa Generar desde la lista de periodos.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <div className="divide-y divide-border">
            {runs.map((r) => (
              <div key={r.id} className="px-5 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {formatNombreCompleto(r.employee)}
                    </p>
                    <p className="text-xs text-muted-foreground">{r.employee.cargo}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-foreground">{cop(r.netoPagar)}</p>
                    <div className="flex gap-2 text-2xs">
                      <span className="text-success">+{cop(r.totalDevengos)}</span>
                      <span className="text-destructive">-{cop(r.totalDeducciones)}</span>
                    </div>
                  </div>
                </div>
                {r.concepts.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {r.concepts.map((c) => (
                      <span key={c.id} className="inline-flex">
                        <Badge variant={c.tipo === 'EARNING' ? 'success' : 'danger'}>
                          {c.nombre}: {cop(c.valor)}
                        </Badge>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <ConfirmDialog
        level={2}
        open={confirmAccounting}
        onOpenChange={setConfirmAccounting}
        title="Contabilizar nómina"
        description="Se registrará en el Ledger un comprobante balanceado para esta nómina y el período pasará a estado Contabilizada. La operación es idempotente."
        correction="La nómina aprobada y su snapshot se conservan inmutables; cualquier diferencia se registra como un ajuste separado."
        confirmLabel="Contabilizar nómina"
        confirmVariant="default"
        onConfirm={confirmAccrual}
      />
    </div>
  );
}
