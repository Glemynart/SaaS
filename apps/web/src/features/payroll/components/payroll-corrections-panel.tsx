'use client';

import { useState, type FormEvent } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { useMe } from '@/features/auth/hooks/use-auth';
import { useCentrosCosto } from '@/features/accounting/hooks/use-accounting-configuration';
import {
  useCreatePayrollCorrection,
  usePayrollCorrectionAction,
  usePayrollCorrections,
} from '@/features/payroll/hooks/use-payroll';
import type {
  PayrollCorrection,
  PayrollCorrectionAction,
  PayrollCorrectionIntentPayload,
  PayrollCorrectionTarget,
} from '@/features/payroll/services/payroll-api';
import { formatNombreCompleto } from '@saas/types';
import { toast } from 'sonner';

type CorrectionInput = Extract<
  PayrollCorrectionIntentPayload,
  { kind: 'SET_CALCULATION_INPUT' }
>['input'];
type CorrectionKind = CorrectionInput | 'MOVE_COST_CENTER';
type Confirmation = {
  action: 'aprobar' | 'rechazar' | 'contabilizar';
  correctionId: string;
} | null;
type CorrectionIntentSummary =
  | {
      kind: 'SET_CALCULATION_INPUT';
      snapshotId: string;
      input: CorrectionInput;
      targetAmount: number;
    }
  | { kind: 'MOVE_COST_CENTER'; snapshotId: string; targetCostCenterId: string };

function cop(amount: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(amount);
}

function friendlyError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function getEntries(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const entries = (value as { entries?: unknown }).entries;
  if (!Array.isArray(entries)) return [];
  return entries.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const candidate = entry as {
      employeeId?: unknown;
      centroCostoId?: unknown;
      concept?: { codigo?: unknown };
      delta?: unknown;
    };
    if (
      typeof candidate.employeeId !== 'string' ||
      typeof candidate.concept?.codigo !== 'string' ||
      typeof candidate.delta !== 'number'
    ) {
      return [];
    }
    return [
      {
        employeeId: candidate.employeeId,
        centroCostoId: typeof candidate.centroCostoId === 'string' ? candidate.centroCostoId : null,
        codigo: candidate.concept.codigo,
        delta: candidate.delta,
      },
    ];
  });
}

function getIntents(value: unknown): CorrectionIntentSummary[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const intents = (value as { intents?: unknown }).intents;
  if (!Array.isArray(intents)) return [];
  return intents.flatMap<CorrectionIntentSummary>((intent): CorrectionIntentSummary[] => {
    if (!intent || typeof intent !== 'object' || Array.isArray(intent)) return [];
    const candidate = intent as Record<string, unknown>;
    if (typeof candidate.snapshotId !== 'string') return [];
    if (
      candidate.kind === 'SET_CALCULATION_INPUT' &&
      (candidate.input === 'SALARIO_BASE' ||
        candidate.input === 'BONUS' ||
        candidate.input === 'OVERTIME') &&
      typeof candidate.targetAmount === 'number'
    ) {
      return [
        {
          kind: 'SET_CALCULATION_INPUT' as const,
          snapshotId: candidate.snapshotId,
          input: candidate.input,
          targetAmount: candidate.targetAmount,
        },
      ];
    }
    if (candidate.kind === 'MOVE_COST_CENTER' && typeof candidate.targetCostCenterId === 'string') {
      return [
        {
          kind: 'MOVE_COST_CENTER' as const,
          snapshotId: candidate.snapshotId,
          targetCostCenterId: candidate.targetCostCenterId,
        },
      ];
    }
    return [];
  });
}

function correctionInputLabel(input: CorrectionInput) {
  const labels: Record<CorrectionInput, string> = {
    SALARIO_BASE: 'Nuevo salario base',
    BONUS: 'Nueva bonificación',
    OVERTIME: 'Nuevo valor de horas extra',
  };
  return labels[input];
}

function CorrectionForm({
  snapshots,
  costCenters,
  isPending,
  onCancel,
  onSubmit,
}: {
  snapshots: PayrollCorrectionTarget[];
  costCenters: Array<{ id: string; codigo: string; nombre: string }>;
  isPending: boolean;
  onCancel: () => void;
  onSubmit: (payload: {
    descripcion: string;
    intents: PayrollCorrectionIntentPayload[];
  }) => Promise<void>;
}) {
  const [descripcion, setDescripcion] = useState('');
  const [snapshotId, setSnapshotId] = useState('');
  const [kind, setKind] = useState<CorrectionKind>('SALARIO_BASE');
  const [targetAmount, setTargetAmount] = useState('');
  const [targetCostCenterId, setTargetCostCenterId] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selectedSnapshot = snapshots.find((snapshot) => snapshot.id === snapshotId);
    if (!selectedSnapshot || !descripcion.trim()) return;

    const intent: PayrollCorrectionIntentPayload =
      kind === 'MOVE_COST_CENTER'
        ? { kind, snapshotId, targetCostCenterId }
        : {
            kind: 'SET_CALCULATION_INPUT',
            snapshotId,
            input: kind,
            targetAmount: Number(targetAmount),
          };
    await onSubmit({ descripcion: descripcion.trim(), intents: [intent] });
  }

  const movesCostCenter = kind === 'MOVE_COST_CENTER';
  const validAmount = Number.isSafeInteger(Number(targetAmount)) && Number(targetAmount) >= 0;
  const validInput = movesCostCenter ? !!targetCostCenterId : validAmount;

  return (
    <form
      onSubmit={submit}
      className="mt-4 space-y-4 rounded-lg border border-border bg-muted/20 p-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Descripción de la corrección" required>
          <Input
            value={descripcion}
            onChange={(event) => setDescripcion(event.target.value)}
            required
            maxLength={300}
            placeholder="Ej. Ajuste de salario base de marzo"
          />
        </FormField>
        <FormField label="Empleado de la nómina aprobada" required>
          <Select
            value={snapshotId}
            onChange={(event) => setSnapshotId(event.target.value)}
            required
          >
            <option value="">Selecciona un empleado</option>
            {snapshots.map((snapshot) => (
              <option key={snapshot.id} value={snapshot.id}>
                {formatNombreCompleto(snapshot.employee)}
                {snapshot.centroCosto
                  ? ` — ${snapshot.centroCosto.codigo} ${snapshot.centroCosto.nombre}`
                  : ''}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Dato que se corrige" required>
          <Select value={kind} onChange={(event) => setKind(event.target.value as CorrectionKind)}>
            <option value="SALARIO_BASE">Salario base</option>
            <option value="BONUS">Bonificación</option>
            <option value="OVERTIME">Horas extra</option>
            <option value="MOVE_COST_CENTER">Centro de costo</option>
          </Select>
        </FormField>
        {movesCostCenter ? (
          <FormField
            label="Centro de costo destino"
            required
            hint={costCenters.length === 0 ? 'No hay centros de costo activos.' : undefined}
          >
            <Select
              value={targetCostCenterId}
              onChange={(event) => setTargetCostCenterId(event.target.value)}
              required
            >
              <option value="">Selecciona un centro de costo</option>
              {costCenters.map((center) => (
                <option key={center.id} value={center.id}>
                  {center.codigo} — {center.nombre}
                </option>
              ))}
            </Select>
          </FormField>
        ) : (
          <FormField
            label="Nuevo valor en pesos"
            required
            hint="Se recalculará la diferencia contra el snapshot aprobado. Usa pesos enteros."
          >
            <Input
              type="number"
              min={kind === 'SALARIO_BASE' ? 1 : 0}
              step={1}
              value={targetAmount}
              onChange={(event) => setTargetAmount(event.target.value)}
              required
            />
          </FormField>
        )}
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={isPending}>
          Cancelar
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={
            isPending ||
            !descripcion.trim() ||
            !snapshotId ||
            !validInput ||
            (kind === 'SALARIO_BASE' && Number(targetAmount) < 1)
          }
        >
          Crear corrección
        </Button>
      </div>
    </form>
  );
}

function CorrectionVoucher({ correction }: { correction: PayrollCorrection }) {
  const voucher = correction.accountingVoucher;
  if (!voucher) return null;
  return (
    <div className="mt-3 rounded-lg border border-border bg-surface p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-foreground">
          Ajuste contabilizado · Comprobante {voucher.numero ?? 'sin número'}
        </p>
        <Badge variant="success">
          {voucher.estado === 'CONTABILIZADO' ? 'Contabilizado' : voucher.estado}
        </Badge>
      </div>
      <p className="mt-1 text-2xs text-muted-foreground">
        Débitos {cop(voucher.totalDebito)} · Créditos {cop(voucher.totalCredito)} · ID {voucher.id}
      </p>
      <div className="mt-2 divide-y divide-border border-t border-border">
        {voucher.movimientos.map((movement) => (
          <div key={movement.linea} className="flex flex-wrap justify-between gap-2 py-2 text-2xs">
            <span className="font-medium text-foreground">
              {movement.cuentaCodigo} · {movement.cuentaNombre}
              {movement.centroCostoNombre ? ` · ${movement.centroCostoNombre}` : ''}
            </span>
            <span className="text-muted-foreground">
              Débito {cop(movement.debito)} · Crédito {cop(movement.credito)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PayrollCorrectionsPanel({
  periodId,
  periodStatus,
  snapshots,
}: {
  periodId: string;
  periodStatus: string;
  snapshots: PayrollCorrectionTarget[];
}) {
  const eligible = periodStatus === 'APROBADA' || periodStatus === 'CAUSADA';
  const { data: corrections, isLoading, error } = usePayrollCorrections(periodId, eligible);
  const { data: me } = useMe();
  const createMutation = useCreatePayrollCorrection();
  const actionMutation = usePayrollCorrectionAction();
  const { data: costCenters } = useCentrosCosto({ activo: true }, eligible);
  const [formOpen, setFormOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const isAdmin = me?.user.rol === 'ADMIN';
  const canOperate = isAdmin || me?.user.rol === 'OPERADOR';
  const snapshotByEmployee = new Map(
    snapshots.map((snapshot) => [snapshot.employeeId, formatNombreCompleto(snapshot.employee)]),
  );
  const snapshotById = new Map(
    snapshots.map((snapshot) => [snapshot.id, formatNombreCompleto(snapshot.employee)]),
  );
  const costCenterById = new Map((costCenters ?? []).map((center) => [center.id, center]));

  async function createCorrection(payload: {
    descripcion: string;
    intents: PayrollCorrectionIntentPayload[];
  }) {
    try {
      await createMutation.mutateAsync({ periodId, payload });
      setFormOpen(false);
      toast.success('Corrección creada como borrador.');
    } catch (mutationError) {
      toast.error(friendlyError(mutationError, 'No se pudo crear la corrección.'));
    }
  }

  async function runAction(correctionId: string, action: PayrollCorrectionAction, motivo?: string) {
    try {
      const result = await actionMutation.mutateAsync({ correctionId, action, motivo });
      if ('comprobanteId' in result) {
        toast.success(`Ajuste contabilizado. Comprobante ${result.comprobanteId}.`);
      } else {
        const messages: Record<Exclude<PayrollCorrectionAction, 'contabilizar'>, string> = {
          'enviar-revision': 'Corrección enviada a revisión.',
          aprobar: 'Corrección aprobada y materializada.',
          rechazar: 'Corrección rechazada.',
          cancelar: 'Corrección cancelada.',
        };
        if (action !== 'contabilizar') toast.success(messages[action]);
      }
      setConfirmation(null);
      setReasons((current) => ({ ...current, [correctionId]: '' }));
    } catch (mutationError) {
      toast.error(friendlyError(mutationError, 'No se pudo actualizar la corrección.'));
    }
  }

  async function confirmAction() {
    if (!confirmation) return;
    await runAction(
      confirmation.correctionId,
      confirmation.action,
      confirmation.action === 'rechazar' ? reasons[confirmation.correctionId] : undefined,
    );
  }

  return (
    <section className="mb-6 rounded-xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Correcciones de nómina</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Cada corrección conserva la nómina aprobada y genera una versión de ajuste trazable.
          </p>
        </div>
        {eligible && canOperate && snapshots.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFormOpen((open) => !open)}
            disabled={createMutation.isPending}
          >
            {formOpen ? 'Cerrar formulario' : 'Nueva corrección'}
          </Button>
        )}
      </div>

      {!eligible ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Las correcciones estarán disponibles después de aprobar el período.
        </p>
      ) : snapshots.length === 0 ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Este período no tiene snapshots aprobados para corregir.
        </p>
      ) : null}

      {formOpen && (
        <CorrectionForm
          snapshots={snapshots}
          costCenters={costCenters ?? []}
          isPending={createMutation.isPending}
          onCancel={() => setFormOpen(false)}
          onSubmit={createCorrection}
        />
      )}

      {error ? (
        <p
          className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive"
          role="alert"
        >
          {friendlyError(error, 'No se pudieron consultar las correcciones.')}
        </p>
      ) : isLoading ? (
        <p className="mt-4 text-xs text-muted-foreground">Cargando correcciones…</p>
      ) : (corrections ?? []).length === 0 ? (
        <p className="mt-4 text-xs text-muted-foreground">No hay correcciones para este período.</p>
      ) : (
        <div className="mt-4 divide-y divide-border overflow-hidden rounded-lg border border-border">
          {corrections?.map((correction) => {
            const entries = getEntries(correction.materialization);
            const intents = getIntents(correction.intent);
            const canDraftActions = correction.status === 'BORRADOR' && canOperate;
            const canReviewActions = correction.status === 'EN_REVISION';
            const canAccount =
              correction.status === 'APROBADA' && isAdmin && !correction.accountingVoucher;

            return (
              <article key={correction.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-medium text-foreground">
                        {correction.descripcion}
                      </h3>
                      <StatusBadge domain="payrollCorrection" estado={correction.status} />
                    </div>
                    <p className="mt-1 text-2xs text-muted-foreground">
                      Creada{' '}
                      {new Intl.DateTimeFormat('es-CO').format(new Date(correction.createdAt))}
                    </p>
                  </div>
                  {canDraftActions && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={actionMutation.isPending}
                        onClick={() => void runAction(correction.id, 'enviar-revision')}
                      >
                        Enviar a revisión
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={actionMutation.isPending}
                        onClick={() => void runAction(correction.id, 'cancelar')}
                      >
                        Cancelar borrador
                      </Button>
                    </div>
                  )}
                  {canReviewActions && canOperate && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={actionMutation.isPending}
                      onClick={() => void runAction(correction.id, 'cancelar')}
                    >
                      Cancelar revisión
                    </Button>
                  )}
                </div>

                {intents.length > 0 && (
                  <ul className="mt-3 space-y-1 rounded-md border border-border bg-surface p-3 text-xs">
                    {intents.map((intent, index) => (
                      <li
                        key={`${intent.snapshotId}-${intent.kind}-${index}`}
                        className="flex flex-wrap justify-between gap-2"
                      >
                        <span className="text-foreground">
                          {snapshotById.get(intent.snapshotId) ?? 'Empleado'} ·{' '}
                          {intent.kind === 'SET_CALCULATION_INPUT'
                            ? correctionInputLabel(intent.input)
                            : 'Centro de costo destino'}
                        </span>
                        <span className="text-muted-foreground">
                          {intent.kind === 'SET_CALCULATION_INPUT'
                            ? cop(intent.targetAmount)
                            : (() => {
                                const center = costCenterById.get(intent.targetCostCenterId);
                                return center
                                  ? `${center.codigo} · ${center.nombre}`
                                  : intent.targetCostCenterId;
                              })()}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {entries.length > 0 && (
                  <ul className="mt-3 space-y-1 rounded-md bg-muted/30 p-3 text-xs">
                    {entries.map((entry, index) => (
                      <li
                        key={`${entry.employeeId}-${entry.codigo}-${index}`}
                        className="flex flex-wrap justify-between gap-2"
                      >
                        <span className="text-foreground">
                          {snapshotByEmployee.get(entry.employeeId) ?? 'Empleado'} · {entry.codigo}
                        </span>
                        <span className={entry.delta < 0 ? 'text-destructive' : 'text-success'}>
                          {entry.delta > 0 ? '+' : ''}
                          {cop(entry.delta)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {canReviewActions && isAdmin && (
                  <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
                    <FormField label="Motivo de rechazo">
                      <Input
                        value={reasons[correction.id] ?? ''}
                        onChange={(event) =>
                          setReasons((current) => ({
                            ...current,
                            [correction.id]: event.target.value,
                          }))
                        }
                        placeholder="Explica por qué se rechaza"
                      />
                    </FormField>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={actionMutation.isPending}
                      onClick={() =>
                        setConfirmation({ action: 'aprobar', correctionId: correction.id })
                      }
                    >
                      Aprobar corrección
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={actionMutation.isPending || !(reasons[correction.id] ?? '').trim()}
                      onClick={() =>
                        setConfirmation({ action: 'rechazar', correctionId: correction.id })
                      }
                    >
                      Rechazar
                    </Button>
                  </div>
                )}

                {canAccount && (
                  <div className="mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={actionMutation.isPending}
                      onClick={() =>
                        setConfirmation({ action: 'contabilizar', correctionId: correction.id })
                      }
                    >
                      Contabilizar ajuste
                    </Button>
                  </div>
                )}
                <CorrectionVoucher correction={correction} />
              </article>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        level={2}
        open={confirmation !== null}
        onOpenChange={(open) => !open && setConfirmation(null)}
        title={
          confirmation?.action === 'aprobar'
            ? 'Aprobar corrección de nómina'
            : confirmation?.action === 'rechazar'
              ? 'Rechazar corrección de nómina'
              : 'Contabilizar ajuste de nómina'
        }
        description={
          confirmation?.action === 'aprobar'
            ? 'La corrección se materializará como un nuevo acto, tomando como base el snapshot original y las correcciones aprobadas anteriores.'
            : confirmation?.action === 'rechazar'
              ? `La corrección quedará rechazada con este motivo: ${reasons[confirmation.correctionId] ?? ''}`
              : 'Se registrará un comprobante de ajuste balanceado en Ledger para esta corrección. La operación es idempotente.'
        }
        correction={
          confirmation?.action === 'rechazar'
            ? 'El rechazo queda auditado; si el dato sigue requiriendo ajuste, se registra un nuevo borrador. El snapshot original no se altera.'
            : 'El snapshot y el comprobante original no se editan. Cualquier diferencia posterior requiere otra corrección trazable.'
        }
        confirmLabel={
          confirmation?.action === 'aprobar'
            ? 'Aprobar corrección'
            : confirmation?.action === 'rechazar'
              ? 'Rechazar corrección'
              : 'Contabilizar ajuste'
        }
        confirmVariant={confirmation?.action === 'rechazar' ? 'destructive' : 'default'}
        onConfirm={confirmAction}
      />
    </section>
  );
}
