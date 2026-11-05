'use client';

import { useEffect, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  Building2,
  History,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useCreateElectronicInvoiceRange,
  useDeactivateElectronicInvoiceRange,
  useElectronicInvoiceConfiguration,
  useRecentElectronicInvoiceTransmissions,
  useUpsertElectronicInvoiceProfile,
} from '@/features/electronic-invoicing/hooks/use-electronic-invoicing';
import type {
  ElectronicInvoiceAttemptResultStatus,
  ElectronicInvoiceStatus,
  ElectronicInvoiceNumberingRange,
  IssuerEnvironment,
  NumberingRangeStatus,
  RecentElectronicInvoiceTransmission,
} from '@/features/electronic-invoicing/services/electronic-invoicing-api';

const ENVIRONMENTS: { value: IssuerEnvironment; label: string }[] = [
  { value: 'HABILITACION', label: 'Habilitación' },
  { value: 'PRODUCCION', label: 'Producción' },
];

const STATUS_LABEL: Record<NumberingRangeStatus, string> = {
  INACTIVO: 'Inactivo',
  AGOTADO: 'Agotado',
  FUTURO: 'Aún no vigente',
  VENCIDO: 'Vencido',
  VIGENTE: 'Vigente',
};

const INVOICE_STATUS_LABEL: Record<ElectronicInvoiceStatus, string> = {
  BORRADOR: 'Borrador',
  LISTA_PARA_EMITIR: 'Lista para emitir',
  EN_COLA: 'En cola',
  EN_TRANSMISION: 'En transmisión',
  PENDIENTE_CONCILIACION: 'Pendiente de conciliación',
  ACEPTADA: 'Aceptada por el proveedor',
  RECHAZADA: 'Rechazada por el proveedor',
  ERROR_TECNICO: 'Error técnico',
};

const ATTEMPT_RESULT_LABEL: Record<ElectronicInvoiceAttemptResultStatus, string> = {
  ACEPTADO: 'Aceptado por el proveedor',
  RECHAZADO: 'Rechazado por el proveedor',
  PENDIENTE: 'Pendiente',
  DESCONOCIDO: 'Resultado desconocido',
  ERROR_TECNICO: 'Error técnico',
};

function TransmissionRow({ transmission }: { transmission: RecentElectronicInvoiceTransmission }) {
  const invoiceNumber = transmission.invoice.number
    ? `${transmission.invoice.prefix ?? ''}${transmission.invoice.number}`
    : 'Sin número';
  const attempt = transmission.latestAttempt;

  return (
    <article className="rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Factura {invoiceNumber}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Registrada {formatDate(transmission.createdAt)} · Proveedor {transmission.providerId} ·
            contrato {transmission.contractVersion}
          </p>
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
          {INVOICE_STATUS_LABEL[transmission.invoice.status]}
        </span>
      </div>
      <p className="mt-3 text-sm">
        {!attempt
          ? 'Sin intento de proveedor registrado.'
          : `${attempt.type === 'ENVIO' ? 'Envío' : 'Conciliación'} #${attempt.number}: ${
              attempt.result
                ? ATTEMPT_RESULT_LABEL[attempt.result.status]
                : 'resultado pendiente de registrar'
            }`}
      </p>
      {attempt?.result?.errorCode && (
        <p className="mt-1 text-xs text-muted-foreground">
          Código técnico: {attempt.result.errorCode}
        </p>
      )}
    </article>
  );
}

type RangeForm = {
  numeroAutorizacion: string;
  fechaAutorizacion: string;
  vigenciaDesde: string;
  vigenciaHasta: string;
  prefijo: string;
  numeroDesde: string;
  numeroHasta: string;
  motivo: string;
};

const EMPTY_RANGE: RangeForm = {
  numeroAutorizacion: '',
  fechaAutorizacion: '',
  vigenciaDesde: '',
  vigenciaHasta: '',
  prefijo: '',
  numeroDesde: '',
  numeroHasta: '',
  motivo: '',
};

function ErrorMessage({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <Alert className="mt-3 border-destructive/30 py-2 text-sm text-destructive">
      <AlertTriangle className="size-4" />
      {message}
    </Alert>
  );
}

function asErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : undefined;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(value),
  );
}

function RangeRow({
  range,
  environment,
  onDeactivate,
  isPending,
}: {
  range: ElectronicInvoiceNumberingRange;
  environment: IssuerEnvironment;
  onDeactivate: (id: string, reason: string) => void;
  isPending: boolean;
}) {
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const statusClass =
    range.estadoOperativo === 'VIGENTE'
      ? 'bg-success/10 text-success'
      : range.estadoOperativo === 'INACTIVO' || range.estadoOperativo === 'VENCIDO'
        ? 'bg-muted text-muted-foreground'
        : 'bg-warning/10 text-warning';

  return (
    <article className="rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">
              {range.prefijo ? `${range.prefijo} · ` : 'Sin prefijo · '}
              {range.numeroDesde}–{range.numeroHasta}
            </h3>
            <span className={`rounded-full px-2 py-0.5 text-xs ${statusClass}`}>
              {STATUS_LABEL[range.estadoOperativo]}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Autorización {range.numeroAutorizacion} ·{' '}
            {environment === 'HABILITACION' ? 'Habilitación' : 'Producción'}
          </p>
        </div>
        {range.estado === 'ACTIVO' && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setConfirming((value) => !value)}
          >
            {confirming ? 'Cancelar' : 'Inactivar'}
          </Button>
        )}
      </div>
      <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">Autorización DIAN</dt>
          <dd>{formatDate(range.fechaAutorizacion)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Vigencia</dt>
          <dd>
            {formatDate(range.vigenciaDesde)} a {formatDate(range.vigenciaHasta)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Último asignado / siguiente</dt>
          <dd>
            {range.ultimoNumeroAsignado < range.numeroDesde
              ? 'Ninguno'
              : range.ultimoNumeroAsignado}{' '}
            / {range.siguienteNumero ?? 'Sin disponibles'}
          </dd>
        </div>
      </dl>
      {confirming && (
        <form
          className="mt-4 flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            onDeactivate(range.id, reason);
          }}
        >
          <div className="flex-1 space-y-1.5">
            <Label htmlFor={`deactivate-${range.id}`}>Motivo de inactivación</Label>
            <Input
              id={`deactivate-${range.id}`}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              minLength={8}
              maxLength={500}
              required
            />
          </div>
          <Button
            type="submit"
            variant="destructive"
            disabled={isPending || reason.trim().length < 8}
          >
            Inactivar rango
          </Button>
        </form>
      )}
    </article>
  );
}

export default function ElectronicInvoiceConfigurationPage() {
  const configuration = useElectronicInvoiceConfiguration();
  const transmissions = useRecentElectronicInvoiceTransmissions();
  const upsertProfile = useUpsertElectronicInvoiceProfile();
  const createRange = useCreateElectronicInvoiceRange();
  const deactivateRange = useDeactivateElectronicInvoiceRange();
  const [environment, setEnvironment] = useState<IssuerEnvironment>('HABILITACION');
  const [responsibilities, setResponsibilities] = useState('');
  const [profileReason, setProfileReason] = useState('');
  const [rangeForm, setRangeForm] = useState<RangeForm>(EMPTY_RANGE);
  const [success, setSuccess] = useState('');

  const profile = configuration.data?.perfiles.find((item) => item.ambiente === environment);
  const activeRanges = profile?.rangos ?? [];

  useEffect(() => {
    setResponsibilities(profile?.responsabilidadesTributarias.join(', ') ?? '');
  }, [profile?.id, profile?.responsabilidadesTributarias]);

  if (configuration.isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-5">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  }

  const identity = configuration.data?.identidadFiscal;
  const profileError = asErrorMessage(upsertProfile.error);
  const rangeError = asErrorMessage(createRange.error ?? deactivateRange.error);

  function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccess('');
    upsertProfile.mutate(
      {
        ambiente: environment,
        responsabilidadesTributarias: responsibilities
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        motivo: profileReason,
      },
      {
        onSuccess: () => {
          setProfileReason('');
          setSuccess('Perfil guardado y auditado.');
        },
      },
    );
  }

  function saveRange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccess('');
    createRange.mutate(
      {
        ambiente: environment,
        numeroAutorizacion: rangeForm.numeroAutorizacion,
        fechaAutorizacion: rangeForm.fechaAutorizacion,
        vigenciaDesde: rangeForm.vigenciaDesde,
        vigenciaHasta: rangeForm.vigenciaHasta,
        prefijo: rangeForm.prefijo,
        numeroDesde: Number(rangeForm.numeroDesde),
        numeroHasta: Number(rangeForm.numeroHasta),
        motivo: rangeForm.motivo,
      },
      {
        onSuccess: () => {
          setRangeForm(EMPTY_RANGE);
          setSuccess('Rango guardado y auditado.');
        },
      },
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-lg font-semibold text-foreground">
          Configuración de facturación electrónica
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Administra los datos del emisor y los rangos de numeración autorizados por ambiente.
        </p>
      </header>

      <Alert className="border-warning/30 bg-warning/5 text-sm">
        <AlertTriangle className="size-4 text-warning" />
        Esta pantalla registra configuración interna. Todavía no emite ni transmite facturas a la
        DIAN y no valida la aceptación de un operador.
      </Alert>

      <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <History className="size-4 text-muted-foreground" />
              Seguimiento de transmisiones
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Muestra las últimas 50 transmisiones y su intento más reciente. Un estado registrado
              por el proveedor no sustituye la validación de aceptación DIAN.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void transmissions.refetch()}
            disabled={transmissions.isFetching}
          >
            {transmissions.isFetching ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 size-4" />
            )}
            Actualizar
          </Button>
        </div>
        <ErrorMessage message={asErrorMessage(transmissions.error)} />
        {transmissions.isLoading ? (
          <Skeleton className="mt-4 h-24 w-full rounded-lg" />
        ) : transmissions.data?.items.length ? (
          <div className="mt-4 space-y-3">
            {transmissions.data.items.map((transmission) => (
              <TransmissionRow key={transmission.id} transmission={transmission} />
            ))}
          </div>
        ) : !transmissions.error ? (
          <p className="mt-4 rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">
            No hay transmisiones registradas para esta empresa.
          </p>
        ) : null}
      </section>
      <ErrorMessage message={asErrorMessage(configuration.error)} />
      <ErrorMessage message={profileError} />
      <ErrorMessage message={rangeError} />
      {success && (
        <Alert className="border-success/30 bg-success/5 text-sm">
          <ShieldCheck className="size-4 text-success" />
          {success}
        </Alert>
      )}

      <div
        className="flex flex-wrap gap-2"
        role="tablist"
        aria-label="Ambiente de facturación electrónica"
      >
        {ENVIRONMENTS.map((item) => (
          <Button
            key={item.value}
            type="button"
            variant={environment === item.value ? 'default' : 'outline'}
            role="tab"
            aria-selected={environment === item.value}
            onClick={() => {
              setEnvironment(item.value);
              setSuccess('');
            }}
          >
            {item.label}
          </Button>
        ))}
      </div>

      <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <Building2 className="size-4 text-muted-foreground" />
          Identidad fiscal de la empresa
        </h2>
        <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">Razón social</dt>
            <dd>{identity?.razonSocial || identity?.nombre || 'No definida'}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">NIT</dt>
            <dd>
              {identity?.nit || 'No definido'}-{identity?.digitoVerif || '?'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Dirección</dt>
            <dd>{identity?.direccion || 'No definida'}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Municipio</dt>
            <dd>
              {[identity?.ciudad, identity?.departamento].filter(Boolean).join(', ') ||
                'No definido'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Contacto</dt>
            <dd>{identity?.email || identity?.telefono || 'No definido'}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          Estos valores se leen de la ficha de empresa; edítalos desde Identidad corporativa para
          conservar una sola fuente de verdad.
        </p>
      </section>

      <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
        <h2 className="text-sm font-semibold">
          Perfil emisor · {ENVIRONMENTS.find((item) => item.value === environment)?.label}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Escribe las responsabilidades tributarias tal como aparecen en el RUT. Aquí no se valida
          el catálogo DIAN.
        </p>
        <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={saveProfile}>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="responsabilidades">Responsabilidades tributarias</Label>
            <Input
              id="responsabilidades"
              value={responsibilities}
              onChange={(event) => setResponsibilities(event.target.value)}
              placeholder="Ejemplo: códigos separados por coma"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="profile-reason">Motivo del cambio</Label>
            <Input
              id="profile-reason"
              value={profileReason}
              onChange={(event) => setProfileReason(event.target.value)}
              minLength={8}
              maxLength={500}
              required
            />
          </div>
          <div className="sm:col-span-2">
            <Button
              type="submit"
              disabled={upsertProfile.isPending || profileReason.trim().length < 8}
            >
              {upsertProfile.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              {profile ? 'Guardar cambios' : 'Crear perfil'}
            </Button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
        <h2 className="text-sm font-semibold">Autorización y rango de numeración</h2>
        {!profile ? (
          <p className="mt-3 rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">
            Guarda primero el perfil emisor de este ambiente.
          </p>
        ) : (
          <>
            <form className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" onSubmit={saveRange}>
              <div className="space-y-1.5">
                <Label htmlFor="authorization">Número de autorización DIAN</Label>
                <Input
                  id="authorization"
                  value={rangeForm.numeroAutorizacion}
                  onChange={(event) =>
                    setRangeForm({ ...rangeForm, numeroAutorizacion: event.target.value })
                  }
                  maxLength={50}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="authorization-date">Fecha de autorización</Label>
                <Input
                  id="authorization-date"
                  type="date"
                  value={rangeForm.fechaAutorizacion}
                  onChange={(event) =>
                    setRangeForm({ ...rangeForm, fechaAutorizacion: event.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="prefix">Prefijo (hasta 4 caracteres)</Label>
                <Input
                  id="prefix"
                  value={rangeForm.prefijo}
                  onChange={(event) =>
                    setRangeForm({ ...rangeForm, prefijo: event.target.value.toUpperCase() })
                  }
                  pattern="[A-Za-z0-9]{0,4}"
                  maxLength={4}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="valid-from">Vigencia desde</Label>
                <Input
                  id="valid-from"
                  type="date"
                  value={rangeForm.vigenciaDesde}
                  onChange={(event) =>
                    setRangeForm({ ...rangeForm, vigenciaDesde: event.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="valid-until">Vigencia hasta</Label>
                <Input
                  id="valid-until"
                  type="date"
                  value={rangeForm.vigenciaHasta}
                  onChange={(event) =>
                    setRangeForm({ ...rangeForm, vigenciaHasta: event.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="range-from">Número inicial</Label>
                <Input
                  id="range-from"
                  type="number"
                  min={1}
                  step={1}
                  value={rangeForm.numeroDesde}
                  onChange={(event) =>
                    setRangeForm({ ...rangeForm, numeroDesde: event.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="range-until">Número final</Label>
                <Input
                  id="range-until"
                  type="number"
                  min={1}
                  step={1}
                  value={rangeForm.numeroHasta}
                  onChange={(event) =>
                    setRangeForm({ ...rangeForm, numeroHasta: event.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2 lg:col-span-2">
                <Label htmlFor="range-reason">Motivo de registro</Label>
                <Input
                  id="range-reason"
                  value={rangeForm.motivo}
                  onChange={(event) => setRangeForm({ ...rangeForm, motivo: event.target.value })}
                  minLength={8}
                  maxLength={500}
                  required
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <Button
                  type="submit"
                  disabled={createRange.isPending || rangeForm.motivo.trim().length < 8}
                >
                  <Plus className="mr-2 size-4" />
                  {createRange.isPending ? 'Guardando…' : 'Registrar rango'}
                </Button>
              </div>
            </form>
            <div className="mt-6 space-y-3">
              <h3 className="text-sm font-medium">Rangos registrados</h3>
              {activeRanges.length === 0 ? (
                <p className="rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">
                  Todavía no hay rangos para este ambiente.
                </p>
              ) : (
                activeRanges.map((range) => (
                  <RangeRow
                    key={range.id}
                    range={range}
                    environment={environment}
                    onDeactivate={(id, reason) => {
                      setSuccess('');
                      deactivateRange.mutate(
                        { id, motivo: reason },
                        {
                          onSuccess: () =>
                            setSuccess('Rango inactivado; su historial se conservó.'),
                        },
                      );
                    }}
                    isPending={deactivateRange.isPending}
                  />
                ))
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
