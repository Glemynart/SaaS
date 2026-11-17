'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  ArrowDownToLine,
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  FileCheck2,
  FileClock,
  FileSearch,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { useMe } from '@/features/auth/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useAttachEmployeeDisbursementSupport,
  useCancelEmployeeDisbursement,
  useCreateEmployeeDisbursement,
  useDisbursementObligations,
  useDisbursementSummary,
  usePendingDisbursements,
  useReconcileEmployeeDisbursements,
  useReverseEmployeeDisbursement,
  useVerifyEmployeeDisbursement,
} from '../hooks/use-employee-disbursements';
import { payrollApi } from '../services/payroll-api';
import type {
  DisbursementObligation,
  EmployeeDisbursement,
  EmployeeDisbursementMethod,
  EmployeeDisbursementSourceType,
  EmployeeDisbursementReconciliationReport,
  PendingEmployeeDisbursement,
} from '../services/payroll-api';

type View = 'obligations' | 'pending';

const methodLabels: Record<EmployeeDisbursementMethod, string> = {
  BANK_TRANSFER: 'Transferencia bancaria',
  CASH: 'Efectivo',
  CHECK: 'Cheque',
  OTHER: 'Otro medio',
};

const statusLabels: Record<EmployeeDisbursement['status'], string> = {
  DECLARED: 'Declarado',
  SUPPORTED: 'Soportado · pendiente de revisión',
  VERIFIED: 'Verificado administrativamente',
  CANCELLED: 'Cancelado',
};

function money(value: string | number | null | undefined) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

function dateLabel(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('es-CO', { timeZone: 'UTC' });
}

function todayInBogota() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function statusClass(status: EmployeeDisbursement['status']) {
  switch (status) {
    case 'VERIFIED':
      return 'border-success/25 bg-success/8 text-success';
    case 'SUPPORTED':
      return 'border-warning/25 bg-warning/8 text-warning';
    case 'CANCELLED':
      return 'border-border bg-muted text-muted-foreground';
    default:
      return 'border-info/25 bg-info/8 text-info';
  }
}

function StatusPill({ status }: { status: EmployeeDisbursement['status'] }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(status)}`}
    >
      {statusLabels[status]}
    </span>
  );
}

export function EmployeeDisbursementsWorkspace() {
  const me = useMe();
  const isAdmin = me.data?.user.rol === 'ADMIN';
  const [view, setView] = useState<View>('obligations');
  const [sourceType, setSourceType] = useState<EmployeeDisbursementSourceType>('PAYROLL_RUN');
  const [page, setPage] = useState(1);
  const [pendingPage, setPendingPage] = useState(1);
  const [selected, setSelected] = useState<DisbursementObligation | null>(null);
  const obligations = useDisbursementObligations(sourceType, page);
  const pending = usePendingDisbursements(pendingPage);
  const summary = useDisbursementSummary(selected?.sourceType ?? null, selected?.sourceId ?? null);
  const createMutation = useCreateEmployeeDisbursement();
  const attachMutation = useAttachEmployeeDisbursementSupport();
  const verifyMutation = useVerifyEmployeeDisbursement();
  const cancelMutation = useCancelEmployeeDisbursement();
  const reverseMutation = useReverseEmployeeDisbursement();
  const reconcileMutation = useReconcileEmployeeDisbursements();

  const [amount, setAmount] = useState('');
  const [paidAt, setPaidAt] = useState(todayInBogota);
  const [method, setMethod] = useState<EmployeeDisbursementMethod>('BANK_TRANSFER');
  const [reference, setReference] = useState('');
  const [createAttempt, setCreateAttempt] = useState<{
    sourceType: EmployeeDisbursementSourceType;
    sourceId: string;
    amount: string;
    paidAt: string;
    method: EmployeeDisbursementMethod;
    reference?: string;
    idempotencyKey: string;
  } | null>(null);
  const [cancelDrafts, setCancelDrafts] = useState<Record<string, string>>({});
  const [cancelOpenId, setCancelOpenId] = useState<string | null>(null);
  const [reverseDrafts, setReverseDrafts] = useState<
    Record<string, { amount: string; reason: string; idempotencyKey: string | null }>
  >({});
  const [reverseOpenId, setReverseOpenId] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
    setSelected((current) => (current?.sourceType === sourceType ? current : null));
  }, [sourceType]);

  useEffect(() => {
    if (!selected && obligations.data?.data[0]) {
      setSelected(obligations.data.data[0]);
    }
  }, [obligations.data, selected]);

  async function submitDeclaration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const payload = createAttempt ?? {
      sourceType: selected.sourceType,
      sourceId: selected.sourceId,
      amount: amount.trim(),
      paidAt,
      method,
      ...(reference.trim() ? { reference: reference.trim() } : {}),
      idempotencyKey: globalThis.crypto.randomUUID(),
    };
    setCreateAttempt(payload);
    try {
      const created = await createMutation.mutateAsync(payload);
      setCreateAttempt(null);
      setAmount('');
      setReference('');
      toast.success('Desembolso declarado. Adjunta el soporte para solicitar su revisión.');
      setSelected({ ...selected, sourceId: created.sourceId });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo confirmar el registro.');
    }
  }

  async function attachSupport(id: string, file: File | undefined) {
    if (!file) return;
    try {
      await attachMutation.mutateAsync({ id, file });
      toast.success('Soporte privado adjuntado; el desembolso queda pendiente de revisión.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo adjuntar el soporte.');
    }
  }

  async function verifyPayment(payment: EmployeeDisbursement) {
    try {
      await verifyMutation.mutateAsync(payment.id);
      toast.success(
        'Soporte verificado administrativamente. Esto no confirma la transferencia bancaria.',
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo verificar el soporte.');
    }
  }

  async function cancelPayment(payment: EmployeeDisbursement) {
    const reason = cancelDrafts[payment.id]?.trim();
    if (!reason) return;
    try {
      await cancelMutation.mutateAsync({ id: payment.id, reason });
      setCancelOpenId(null);
      setCancelDrafts((current) => ({ ...current, [payment.id]: '' }));
      toast.success('Declaración cancelada. El historial se conserva.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo cancelar la declaración.');
    }
  }

  async function reversePayment(payment: EmployeeDisbursement) {
    const draft = reverseDrafts[payment.id];
    if (!draft?.amount.trim() || !draft.reason.trim()) return;
    const idempotencyKey = draft.idempotencyKey ?? globalThis.crypto.randomUUID();
    setReverseDrafts((current) => ({
      ...current,
      [payment.id]: { ...draft, idempotencyKey },
    }));
    try {
      await reverseMutation.mutateAsync({
        id: payment.id,
        amount: draft.amount.trim(),
        reason: draft.reason.trim(),
        idempotencyKey,
      });
      setReverseOpenId(null);
      setReverseDrafts((current) => ({
        ...current,
        [payment.id]: { amount: '', reason: '', idempotencyKey: null },
      }));
      toast.success('Reverso registrado como un hecho separado del desembolso original.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo registrar el reverso.');
    }
  }

  async function downloadSupport(payment: EmployeeDisbursement) {
    try {
      const blob = await payrollApi.downloadDisbursementSupport(payment.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      const extension =
        payment.support?.mimeType === 'application/pdf'
          ? 'pdf'
          : payment.support?.mimeType === 'image/jpeg'
            ? 'jpg'
            : payment.support?.mimeType === 'image/png'
              ? 'png'
              : 'webp';
      anchor.download = `soporte-desembolso-${payment.id}.${extension}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo descargar el soporte.');
    }
  }

  async function runReconciliation() {
    try {
      await reconcileMutation.mutateAsync();
      toast.success('Diagnóstico completado. No se modificaron ni eliminaron archivos.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo completar el diagnóstico.');
    }
  }

  function openObligation(obligation: DisbursementObligation) {
    setSourceType(obligation.sourceType);
    setSelected(obligation);
    setView('obligations');
    setCreateAttempt(null);
    setAmount('');
    setReference('');
  }

  function openFromPending(payment: PendingEmployeeDisbursement) {
    openObligation({
      sourceType: payment.sourceType,
      sourceId: payment.sourceId,
      label: payment.sourceLabel,
      status: payment.status,
      amountDue: payment.amountDue ?? payment.amount,
      periodStart: payment.periodStart ?? payment.paidAt,
      periodEnd: payment.periodEnd ?? payment.paidAt,
      employee: payment.employee,
    });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/nomina/periodos"
            className="mb-3 inline-flex min-h-10 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Volver a nómina
          </Link>
          <h1 className="text-xl font-semibold tracking-[-0.018em] text-foreground">
            Desembolsos a empleados
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Registra la evidencia de pago para obligaciones aprobadas. La revisión es
            administrativa; no se consulta ni confirma el banco.
          </p>
        </div>
        {isAdmin && (
          <Button
            variant="outline"
            className="min-h-11 shrink-0"
            onClick={runReconciliation}
            disabled={reconcileMutation.isPending}
          >
            {reconcileMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileSearch className="size-4" />
            )}
            Diagnosticar soportes
          </Button>
        )}
      </div>

      <div
        className="flex flex-wrap gap-2 border-b border-border pb-3"
        role="tablist"
        aria-label="Vistas de desembolsos"
      >
        <button
          type="button"
          role="tab"
          aria-selected={view === 'obligations'}
          onClick={() => setView('obligations')}
          className={`min-h-11 rounded-md px-4 text-sm font-medium ${view === 'obligations' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground hover:bg-muted/70'}`}
        >
          Obligaciones
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'pending'}
          onClick={() => setView('pending')}
          className={`inline-flex min-h-11 items-center gap-2 rounded-md px-4 text-sm font-medium ${view === 'pending' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground hover:bg-muted/70'}`}
        >
          Pendientes de verificación
          {pending.data?.meta.total ? (
            <span className="rounded-full bg-background/20 px-2 py-0.5 text-xs">
              {pending.data.meta.total}
            </span>
          ) : null}
        </button>
      </div>

      {view === 'obligations' ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <section className="space-y-4" aria-label="Obligaciones">
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={sourceType === 'PAYROLL_RUN' ? 'default' : 'outline'}
                onClick={() => setSourceType('PAYROLL_RUN')}
              >
                Nómina
              </Button>
              <Button
                size="sm"
                variant={sourceType === 'LIQUIDATION' ? 'default' : 'outline'}
                onClick={() => setSourceType('LIQUIDATION')}
              >
                Liquidaciones
              </Button>
            </div>
            {obligations.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : obligations.isError ? (
              <ErrorPanel message={obligations.error.message} />
            ) : obligations.data?.data.length ? (
              <>
                <div className="space-y-3">
                  {obligations.data.data.map((item) => (
                    <button
                      key={item.sourceId}
                      type="button"
                      onClick={() => openObligation(item)}
                      className={`w-full rounded-xl border p-4 text-left transition-colors ${selected?.sourceId === item.sourceId && selected.sourceType === item.sourceType ? 'border-primary bg-primary/5' : 'border-border bg-surface hover:bg-muted/40'}`}
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {item.employee.name}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {item.employee.document} · {item.label}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {dateLabel(item.periodStart)} – {dateLabel(item.periodEnd)} ·{' '}
                            {item.status}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold text-foreground">
                          {money(item.amountDue)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
                <Pagination
                  page={page}
                  totalPages={obligations.data.meta.totalPages}
                  onChange={setPage}
                />
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                No hay obligaciones aprobadas disponibles para esta categoría.
              </div>
            )}
          </section>

          <section className="min-w-0" aria-label="Detalle de obligación">
            {!selected ? (
              <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
                Selecciona una obligación para ver su historial.
              </div>
            ) : summary.isLoading ? (
              <Skeleton className="h-72 w-full" />
            ) : summary.isError ? (
              <ErrorPanel message={summary.error.message} />
            ) : summary.data ? (
              <div className="space-y-5 rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-6">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {selected.label}
                  </p>
                  <h2 className="mt-1 text-base font-semibold text-foreground">
                    {selected.employee.name}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {selected.employee.document} · {dateLabel(selected.periodStart)} –{' '}
                    {dateLabel(selected.periodEnd)}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <AmountCard label="Importe exigible" value={summary.data.amountDue} />
                  <AmountCard label="Declarado" value={summary.data.declaredAmount} />
                  <AmountCard label="Soportado" value={summary.data.supportedAmount} />
                  <AmountCard label="Verificado bruto" value={summary.data.verifiedAmount} />
                  <AmountCard label="Reversado" value={summary.data.reversedAmount} />
                  <AmountCard label="Verificado neto" value={summary.data.netVerifiedAmount} />
                  <AmountCard
                    label="Saldo pendiente"
                    value={summary.data.outstandingAmount}
                    emphasis
                  />
                  <AmountCard
                    label="Disponible para declarar"
                    value={summary.data.availableToDeclare}
                  />
                </div>

                <div className="flex gap-3 rounded-lg border border-info/25 bg-info/8 p-3 text-sm text-info">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0" />
                  <p>
                    “Verificado” significa que un ADMIN revisó el soporte. No confirma que el banco
                    haya liquidado o recibido una transferencia.
                  </p>
                </div>

                {Number(summary.data.availableToDeclare) > 0 && (
                  <form
                    className="space-y-4 rounded-lg border border-border p-4"
                    onSubmit={submitDeclaration}
                  >
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        Registrar desembolso
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Este paso declara el pago y reserva saldo; no lo considera cubierto hasta
                        adjuntar soporte y completar la verificación.
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="disbursement-amount">Importe del desembolso (COP)</Label>
                        <Input
                          id="disbursement-amount"
                          inputMode="decimal"
                          value={amount}
                          disabled={!!createAttempt || createMutation.isPending}
                          onChange={(event) => setAmount(event.target.value)}
                          required
                          placeholder="250000"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="disbursement-date">Fecha del desembolso</Label>
                        <Input
                          id="disbursement-date"
                          type="date"
                          value={paidAt}
                          disabled={!!createAttempt || createMutation.isPending}
                          onChange={(event) => setPaidAt(event.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="disbursement-method">Medio</Label>
                        <select
                          id="disbursement-method"
                          className="h-10 w-full rounded-md border border-input bg-control px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
                          value={method}
                          disabled={!!createAttempt || createMutation.isPending}
                          onChange={(event) =>
                            setMethod(event.target.value as EmployeeDisbursementMethod)
                          }
                        >
                          {Object.entries(methodLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="disbursement-reference">Referencia (opcional)</Label>
                        <Input
                          id="disbursement-reference"
                          maxLength={128}
                          value={reference}
                          disabled={!!createAttempt || createMutation.isPending}
                          onChange={(event) => setReference(event.target.value)}
                          placeholder="Referencia interna o bancaria"
                        />
                      </div>
                    </div>
                    {createAttempt && (
                      <p className="text-xs text-warning">
                        No se confirmó el resultado. Reintenta con los mismos datos y la misma clave
                        para evitar duplicados. Si prefieres editar, consulta primero el historial
                        para descartar que se haya registrado.
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="submit"
                        className="min-h-11"
                        disabled={createMutation.isPending || (!createAttempt && !amount.trim())}
                      >
                        {createMutation.isPending ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <FileClock className="size-4" />
                        )}
                        {createAttempt ? 'Reintentar registro' : 'Registrar declaración'}
                      </Button>
                      {createAttempt && (
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-11"
                          onClick={() => setCreateAttempt(null)}
                        >
                          Consultar y editar
                        </Button>
                      )}
                    </div>
                  </form>
                )}

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-foreground">
                      Historial de desembolsos
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      {summary.data.payments.length} registros
                    </span>
                  </div>
                  {summary.data.payments.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
                      Aún no hay desembolsos declarados.
                    </p>
                  ) : (
                    summary.data.payments.map((payment) => (
                      <PaymentHistoryCard
                        key={payment.id}
                        payment={payment}
                        isAdmin={isAdmin}
                        cancelOpen={cancelOpenId === payment.id}
                        cancelReason={cancelDrafts[payment.id] ?? ''}
                        reverseOpen={reverseOpenId === payment.id}
                        reverseDraft={reverseDrafts[payment.id]}
                        busy={
                          attachMutation.isPending ||
                          verifyMutation.isPending ||
                          cancelMutation.isPending ||
                          reverseMutation.isPending
                        }
                        onAttach={(file) => attachSupport(payment.id, file)}
                        onDownload={() => downloadSupport(payment)}
                        onVerify={() => verifyPayment(payment)}
                        onToggleCancel={() =>
                          setCancelOpenId(cancelOpenId === payment.id ? null : payment.id)
                        }
                        onCancelReasonChange={(value) =>
                          setCancelDrafts((current) => ({ ...current, [payment.id]: value }))
                        }
                        onCancel={() => cancelPayment(payment)}
                        onToggleReverse={() =>
                          setReverseOpenId(reverseOpenId === payment.id ? null : payment.id)
                        }
                        onReverseDraftChange={(value) =>
                          setReverseDrafts((current) => ({
                            ...current,
                            [payment.id]: {
                              amount: value.amount,
                              reason: value.reason,
                              idempotencyKey: current[payment.id]?.idempotencyKey ?? null,
                            },
                          }))
                        }
                        onReverse={() => reversePayment(payment)}
                      />
                    ))
                  )}
                </div>
              </div>
            ) : null}
          </section>
        </div>
      ) : (
        <section className="space-y-4" aria-label="Desembolsos pendientes de verificación">
          <div className="flex gap-3 rounded-lg border border-warning/25 bg-warning/8 p-3 text-sm text-warning">
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            <p>
              Verifica el soporte antes de marcar el desembolso como verificado. La acción registra
              revisión administrativa y no una confirmación bancaria.
            </p>
          </div>
          {pending.isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : pending.isError ? (
            <ErrorPanel message={pending.error.message} />
          ) : pending.data?.data.length ? (
            <div className="space-y-3">
              {pending.data.data.map((payment) => (
                <PendingCard
                  key={payment.id}
                  payment={payment}
                  onOpen={() => openFromPending(payment)}
                  onDownload={() => downloadSupport(payment)}
                />
              ))}
              <Pagination
                page={pending.data.meta.page}
                totalPages={pending.data.meta.totalPages}
                onChange={setPendingPage}
              />
            </div>
          ) : (
            <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-border text-center">
              <FileCheck2 className="mb-2 size-6 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">No hay soportes pendientes</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Los desembolsos con soporte aparecerán aquí hasta su revisión.
              </p>
            </div>
          )}
        </section>
      )}

      {isAdmin && reconcileMutation.data && <ReconciliationPanel report={reconcileMutation.data} />}
    </div>
  );
}

function AmountCard({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${emphasis ? 'border-primary/40 bg-primary/5' : 'border-border bg-background'}`}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-foreground">{money(value)}</p>
    </div>
  );
}

function PaymentHistoryCard({
  payment,
  isAdmin,
  cancelOpen,
  cancelReason,
  reverseOpen,
  reverseDraft,
  busy,
  onAttach,
  onDownload,
  onVerify,
  onToggleCancel,
  onCancelReasonChange,
  onCancel,
  onToggleReverse,
  onReverseDraftChange,
  onReverse,
}: {
  payment: EmployeeDisbursement;
  isAdmin: boolean;
  cancelOpen: boolean;
  cancelReason: string;
  reverseOpen: boolean;
  reverseDraft: { amount: string; reason: string; idempotencyKey: string | null } | undefined;
  busy: boolean;
  onAttach: (file: File | undefined) => void;
  onDownload: () => void;
  onVerify: () => void;
  onToggleCancel: () => void;
  onCancelReasonChange: (value: string) => void;
  onCancel: () => void;
  onToggleReverse: () => void;
  onReverseDraftChange: (value: { amount: string; reason: string }) => void;
  onReverse: () => void;
}) {
  const reverseRemaining = Math.max(0, Number(payment.amount) - Number(payment.reversedAmount));
  return (
    <article className="rounded-lg border border-border p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <StatusPill status={payment.status} />
          <p className="text-sm font-semibold text-foreground">
            {money(payment.amount)} · {dateLabel(payment.paidAt)}
          </p>
          <p className="text-xs text-muted-foreground">
            {methodLabels[payment.method]}
            {payment.reference ? ` · Ref. ${payment.reference}` : ''}
          </p>
          <p className="break-all text-xs text-muted-foreground">
            Registró: {payment.registeredByUserId}
          </p>
          {payment.verifiedAt && (
            <p className="break-all text-xs text-muted-foreground">
              Verificó: {payment.verifiedByUserId} · {dateLabel(payment.verifiedAt)}
            </p>
          )}
          {payment.cancellationReason && (
            <p className="text-xs text-muted-foreground">
              Motivo de cancelación: {payment.cancellationReason}
            </p>
          )}
          {payment.support && (
            <p className="text-xs text-muted-foreground">
              Soporte privado · {payment.support.sizeBytes?.toLocaleString('es-CO')} bytes · SHA-256
              registrado
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {payment.support && (
            <Button size="sm" variant="outline" className="min-h-10" onClick={onDownload}>
              <ArrowDownToLine className="size-4" />
              Abrir soporte
            </Button>
          )}
          {payment.status === 'DECLARED' && (
            <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-border px-3 text-xs font-medium hover:bg-muted">
              <Upload className="size-4" />
              Adjuntar soporte
              <input
                className="sr-only"
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                disabled={busy}
                onChange={(event) => onAttach(event.currentTarget.files?.[0])}
              />
            </label>
          )}
          {payment.status === 'SUPPORTED' && isAdmin && (
            <Button size="sm" className="min-h-10" disabled={busy} onClick={onVerify}>
              <Check className="size-4" />
              Verificar soporte revisado
            </Button>
          )}
          {['DECLARED', 'SUPPORTED'].includes(payment.status) && (
            <Button
              size="sm"
              variant="outline"
              className="min-h-10"
              disabled={busy}
              onClick={onToggleCancel}
            >
              Cancelar declaración
            </Button>
          )}
          {payment.status === 'VERIFIED' && isAdmin && reverseRemaining > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="min-h-10"
              disabled={busy}
              onClick={onToggleReverse}
            >
              <RotateCcw className="size-4" />
              Registrar reverso
            </Button>
          )}
        </div>
      </div>

      {payment.status === 'SUPPORTED' && !isAdmin && (
        <p className="mt-3 text-xs text-muted-foreground">
          Solo un ADMIN puede verificar este soporte.
        </p>
      )}

      {cancelOpen && (
        <div className="mt-4 space-y-2 rounded-md border border-warning/25 bg-warning/8 p-3">
          <Label htmlFor={`cancel-reason-${payment.id}`}>
            Motivo para cancelar esta declaración
          </Label>
          <Input
            id={`cancel-reason-${payment.id}`}
            minLength={3}
            maxLength={512}
            value={cancelReason}
            onChange={(event) => onCancelReasonChange(event.target.value)}
            placeholder="Describe el dato que debe corregirse"
          />
          <p className="text-xs text-warning">
            La cancelación es terminal; conserva el historial. Para corregir el dato, registra un
            nuevo desembolso.
          </p>
          <Button
            size="sm"
            variant="destructive"
            className="min-h-10"
            disabled={busy || cancelReason.trim().length < 3}
            onClick={onCancel}
          >
            Confirmar cancelación
          </Button>
        </div>
      )}

      {reverseOpen && (
        <div className="mt-4 space-y-3 rounded-md border border-border bg-background p-3">
          <p className="text-sm font-medium">Reversar hasta {money(reverseRemaining)}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`reverse-amount-${payment.id}`}>Importe (COP)</Label>
              <Input
                id={`reverse-amount-${payment.id}`}
                inputMode="decimal"
                max={reverseRemaining}
                value={reverseDraft?.amount ?? ''}
                onChange={(event) =>
                  onReverseDraftChange({
                    amount: event.target.value,
                    reason: reverseDraft?.reason ?? '',
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`reverse-reason-${payment.id}`}>Motivo</Label>
              <Input
                id={`reverse-reason-${payment.id}`}
                maxLength={512}
                value={reverseDraft?.reason ?? ''}
                onChange={(event) =>
                  onReverseDraftChange({
                    amount: reverseDraft?.amount ?? '',
                    reason: event.target.value,
                  })
                }
              />
            </div>
          </div>
          {reverseDraft?.idempotencyKey && (
            <p className="text-xs text-warning">
              Si el resultado queda incierto, repite exactamente los mismos datos para conservar
              idempotencia.
            </p>
          )}
          <Button
            size="sm"
            variant="destructive"
            className="min-h-10"
            disabled={busy || !(Number(reverseDraft?.amount) > 0) || !reverseDraft?.reason.trim()}
            onClick={onReverse}
          >
            Confirmar reverso
          </Button>
        </div>
      )}

      {payment.reversals.length > 0 && (
        <details className="mt-4 rounded-md bg-muted/40 p-3">
          <summary className="min-h-8 cursor-pointer text-xs font-medium text-foreground">
            Ver {payment.reversals.length} reverso(s) · {money(payment.reversedAmount)}
          </summary>
          <ul className="mt-3 space-y-2">
            {payment.reversals.map((reversal) => (
              <li
                key={reversal.id}
                className="border-t border-border pt-2 text-xs text-muted-foreground"
              >
                {money(reversal.amount)} · {dateLabel(reversal.createdAt)} · {reversal.reason} ·
                registró {reversal.createdByUserId}
              </li>
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}

function PendingCard({
  payment,
  onOpen,
  onDownload,
}: {
  payment: PendingEmployeeDisbursement;
  onOpen: () => void;
  onDownload: () => void;
}) {
  return (
    <article className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-semibold text-foreground">{payment.employee.name}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {payment.employee.document} · {payment.sourceLabel} · {dateLabel(payment.periodStart)} –{' '}
          {dateLabel(payment.periodEnd)}
        </p>
        <p className="mt-1 text-sm font-medium text-foreground">
          {money(payment.amount)} · {dateLabel(payment.paidAt)}
        </p>
        <p className="mt-1 text-xs text-warning">
          Soporte pendiente de verificación administrativa
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="min-h-10" onClick={onOpen}>
          Ver obligación
        </Button>
        {payment.support && (
          <Button size="sm" variant="outline" className="min-h-10" onClick={onDownload}>
            <ArrowDownToLine className="size-4" />
            Ver soporte
          </Button>
        )}
      </div>
    </article>
  );
}

function ReconciliationPanel({ report }: { report: EmployeeDisbursementReconciliationReport }) {
  return (
    <section
      className="space-y-3 rounded-xl border border-border bg-surface p-4 sm:p-5"
      aria-label="Resultado del diagnóstico de soportes"
    >
      <div className="flex items-start gap-3">
        <FileSearch className="mt-0.5 size-5 text-primary" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-foreground">
            Diagnóstico de soportes privados
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {new Date(report.checkedAt).toLocaleString('es-CO', { timeZone: 'America/Bogota' })} ·{' '}
            {report.scannedDisbursements} registros · {report.scannedObjects} objetos · huella{' '}
            {report.fingerprint.slice(0, 16)} · auditoría{' '}
            {report.auditRecorded ? 'registrada' : 'ya existente'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Este proceso solo leyó los objetos del tenant y sus registros. No realizó reparaciones
            ni eliminaciones.
          </p>
        </div>
      </div>
      {report.findings.length === 0 ? (
        <p className="rounded-md bg-success/8 p-3 text-sm text-success">
          No se encontraron diferencias.
        </p>
      ) : (
        <div className="max-h-96 space-y-2 overflow-auto">
          {report.findings.map((finding, index) => (
            <div
              key={`${finding.code}-${finding.disbursementId ?? finding.storageKey ?? index}`}
              className="rounded-md border border-warning/25 bg-warning/8 p-3 text-xs text-warning"
            >
              <p className="font-semibold">{finding.code.replaceAll('_', ' ')}</p>
              {finding.disbursementId && <p>Desembolso: {finding.disbursementId}</p>}
              {finding.disbursementIds && <p>Referencias: {finding.disbursementIds.join(', ')}</p>}
              {finding.storageKey && <p className="break-all">Objeto: {finding.storageKey}</p>}
              {finding.storageKeys && (
                <p className="break-all">Objetos: {finding.storageKeys.join(', ')}</p>
              )}
              {(finding.expectedBytes !== undefined || finding.observedBytes !== undefined) && (
                <p>
                  Tamaño: esperado {finding.expectedBytes ?? 'sin dato'} bytes; observado{' '}
                  {finding.observedBytes ?? 'sin dato'} bytes.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-surface p-2">
      <Button
        size="sm"
        variant="ghost"
        className="min-h-10"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        <ChevronLeft className="size-4" />
        Anterior
      </Button>
      <span className="text-xs text-muted-foreground">
        Página {page} de {totalPages}
      </span>
      <Button
        size="sm"
        variant="ghost"
        className="min-h-10"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        <ChevronRight className="size-4" />
        Siguiente
      </Button>
    </div>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
    >
      {message}
    </div>
  );
}
