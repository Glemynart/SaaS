'use client';

import { useState } from 'react';
import { FileText, Plus } from 'lucide-react';
import { useMe } from '@/features/auth/hooks/use-auth';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { SideSheet } from '@/components/ui/side-sheet';
import { toast } from '@/components/ui/toast';
import {
  useCentrosCosto,
  useCuentasContables,
  usePeriodosContables,
  useRegistrarComprobante,
  useTerceros,
  useTiposComprobante,
  useAnularComprobante,
} from '../hooks/use-accounting-configuration';
import type { ManualJournalLine, ManualJournalResult } from '../services/accounting-api';

type DraftLine = ManualJournalLine & { key: string };
const blankLine = (): DraftLine => ({
  key: crypto.randomUUID(),
  cuentaId: '',
  terceroId: '',
  centroCostoId: '',
  debito: 0,
  credito: 0,
  baseGravable: undefined,
  descripcion: '',
});

export function ManualJournalManagement() {
  const [open, setOpen] = useState(false);
  const [tipoComprobanteId, setTipoComprobanteId] = useState('');
  const [periodoId, setPeriodoId] = useState('');
  const [fecha, setFecha] = useState('');
  const [concepto, setConcepto] = useState('');
  const [lineas, setLineas] = useState<DraftLine[]>([blankLine()]);
  const [result, setResult] = useState<ManualJournalResult | null>(null);
  const [voidOpen, setVoidOpen] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [confirmVoid, setConfirmVoid] = useState(false);
  const { data: user } = useMe();
  const canManage = user?.user.rol === 'ADMIN';
  const { data: tipos } = useTiposComprobante();
  const { data: periodos } = usePeriodosContables({ estado: 'ABIERTO' });
  const { data: cuentas } = useCuentasContables({ imputable: true, activa: true });
  const { data: terceros } = useTerceros({ activo: true });
  const { data: centros } = useCentrosCosto({ activo: true });
  const register = useRegistrarComprobante();
  const voidMutation = useAnularComprobante();
  const updateLine = (key: string, patch: Partial<DraftLine>) =>
    setLineas((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    register.mutate(
      {
        tipoComprobanteId,
        periodoId,
        fecha,
        concepto,
        lineas: lineas.map((line) => ({
          cuentaId: line.cuentaId,
          terceroId: line.terceroId || undefined,
          centroCostoId: line.centroCostoId || undefined,
          debito: line.debito,
          credito: line.credito,
          baseGravable: line.baseGravable,
          descripcion: line.descripcion || undefined,
        })),
      },
      {
        onSuccess: (data) => {
          setOpen(false);
          setResult(data);
          toast.success('Comprobante registrado.');
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };
  const executeVoid = async () => {
    if (!result) return;
    try {
      setResult(await voidMutation.mutateAsync({ id: result.id, motivo }));
      setConfirmVoid(false);
      setVoidOpen(false);
      toast.success('Operación de anulación procesada.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo anular el comprobante.');
    }
  };
  const reset = () => {
    setTipoComprobanteId('');
    setPeriodoId('');
    setFecha('');
    setConcepto('');
    setLineas([blankLine()]);
    setOpen(true);
  };
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h2 className="text-base font-semibold text-foreground">Comprobante manual</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Registra comprobantes mediante la operación existente del Ledger.
          </p>
        </div>
        {canManage && (
          <Button size="sm" onClick={reset}>
            <Plus className="size-4" aria-hidden="true" />
            Nuevo comprobante
          </Button>
        )}
      </div>
      <EmptyState
        icon={FileText}
        title="La consulta de comprobantes no está disponible."
        description="El contrato actual expone registro y anulación, pero no listado ni detalle."
        action={
          canManage ? (
            <Button size="sm" onClick={reset}>
              Registrar comprobante
            </Button>
          ) : undefined
        }
      />
      <SideSheet
        open={open}
        onOpenChange={setOpen}
        title="Nuevo comprobante manual"
        description="El Ledger valida las líneas y reglas contables al registrar."
      >
        <form onSubmit={submit} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Tipo de comprobante" required>
              <Select
                value={tipoComprobanteId}
                onChange={(event) => setTipoComprobanteId(event.target.value)}
                required
              >
                <option value="">Selecciona un tipo</option>
                {tipos?.map((tipo) => (
                  <option key={tipo.id} value={tipo.id}>
                    {tipo.codigo} — {tipo.nombre}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Período" required>
              <Select
                value={periodoId}
                onChange={(event) => setPeriodoId(event.target.value)}
                required
              >
                <option value="">Selecciona un período abierto</option>
                {periodos?.map((periodo) => (
                  <option key={periodo.id} value={periodo.id}>
                    {periodo.anio}-{String(periodo.mes).padStart(2, '0')}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Fecha" required>
              <Input
                type="date"
                value={fecha}
                onChange={(event) => setFecha(event.target.value)}
                required
              />
            </FormField>
            <FormField label="Concepto" required>
              <Input
                value={concepto}
                onChange={(event) => setConcepto(event.target.value)}
                required
              />
            </FormField>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Líneas</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setLineas((current) => [...current, blankLine()])}
              >
                Agregar línea
              </Button>
            </div>
            {lineas.map((line, index) => (
              <div
                key={line.key}
                className="space-y-3 rounded-[--radius-card] border border-border p-3"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">Línea {index + 1}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={lineas.length === 1}
                    onClick={() =>
                      setLineas((current) => current.filter((item) => item.key !== line.key))
                    }
                  >
                    Eliminar
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Select
                    value={line.cuentaId}
                    onChange={(event) => updateLine(line.key, { cuentaId: event.target.value })}
                    required
                  >
                    <option value="">Cuenta</option>
                    {cuentas?.map((cuenta) => (
                      <option key={cuenta.id} value={cuenta.id}>
                        {cuenta.codigo} — {cuenta.nombre}
                      </option>
                    ))}
                  </Select>
                  <Select
                    value={line.terceroId ?? ''}
                    onChange={(event) => updateLine(line.key, { terceroId: event.target.value })}
                  >
                    <option value="">Sin tercero</option>
                    {terceros?.map((tercero) => (
                      <option key={tercero.id} value={tercero.id}>
                        {tercero.numeroDocumento} —{' '}
                        {tercero.razonSocial ||
                          `${tercero.primerNombre ?? ''} ${tercero.primerApellido ?? ''}`}
                      </option>
                    ))}
                  </Select>
                  <Select
                    value={line.centroCostoId ?? ''}
                    onChange={(event) =>
                      updateLine(line.key, { centroCostoId: event.target.value })
                    }
                  >
                    <option value="">Sin centro de costo</option>
                    {centros?.map((centro) => (
                      <option key={centro.id} value={centro.id}>
                        {centro.codigo} — {centro.nombre}
                      </option>
                    ))}
                  </Select>
                  <Input
                    placeholder="Descripción"
                    value={line.descripcion ?? ''}
                    onChange={(event) => updateLine(line.key, { descripcion: event.target.value })}
                  />
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Débito"
                    value={line.debito}
                    onChange={(event) =>
                      updateLine(line.key, { debito: Number(event.target.value) })
                    }
                  />
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Crédito"
                    value={line.credito}
                    onChange={(event) =>
                      updateLine(line.key, { credito: Number(event.target.value) })
                    }
                  />
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Base gravable"
                    value={line.baseGravable ?? ''}
                    onChange={(event) =>
                      updateLine(line.key, {
                        baseGravable: event.target.value ? Number(event.target.value) : undefined,
                      })
                    }
                  />
                </div>
              </div>
            ))}
          </div>
          {register.error && <Alert variant="destructive">{register.error.message}</Alert>}
          <div className="flex justify-end border-t border-border-soft pt-5">
            <Button type="submit" disabled={register.isPending}>
              {register.isPending ? 'Registrando…' : 'Registrar comprobante'}
            </Button>
          </div>
        </form>
      </SideSheet>
      <SideSheet
        open={result !== null}
        onOpenChange={(next) => {
          if (!next) setResult(null);
        }}
        title="Resultado del comprobante"
        description="Respuesta devuelta por el Ledger."
      >
        {result && (
          <div className="space-y-5">
            <pre className="overflow-x-auto rounded-md border border-border bg-canvas p-3 text-xs text-foreground">
              {JSON.stringify(result, null, 2)}
            </pre>
            {canManage && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setMotivo('');
                  setVoidOpen(true);
                }}
              >
                Anular comprobante
              </Button>
            )}
          </div>
        )}
      </SideSheet>
      <SideSheet
        open={voidOpen}
        onOpenChange={setVoidOpen}
        title="Motivo de anulación"
        description="El motivo será enviado al mecanismo de anulación existente."
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setConfirmVoid(true);
          }}
          className="space-y-6"
        >
          <FormField label="Motivo" required>
            <Input value={motivo} onChange={(event) => setMotivo(event.target.value)} required />
          </FormField>
          <div className="flex justify-end border-t border-border-soft pt-5">
            <Button type="submit" disabled={!motivo.trim()}>
              Continuar
            </Button>
          </div>
        </form>
      </SideSheet>
      {confirmVoid && (
        <ConfirmDialog
          open
          onOpenChange={(next) => {
            if (!next) setConfirmVoid(false);
          }}
          title="Anular comprobante"
          description="La anulación utilizará el mecanismo aprobado por el Ledger."
          confirmLabel="Anular comprobante"
          level={1}
          onConfirm={executeVoid}
        />
      )}
    </div>
  );
}
