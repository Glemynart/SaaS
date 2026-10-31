'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { formatNombreCompleto } from '@saas/types';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useEmployees } from '@/features/employees/hooks/use-employees';
import {
  useCreatePayrollPilaEvent,
  useDeletePayrollPilaEvent,
  usePayrollPilaEvents,
} from '../hooks/use-payroll';
import type { PilaEventCode, PayrollPeriodStatus } from '../services/payroll-api';

const eventOptions: Array<{
  code: PilaEventCode;
  label: string;
  allowsEndDate: boolean;
  requiresEndDate: boolean;
}> = [
  { code: 'ING', label: 'Ingreso', allowsEndDate: false, requiresEndDate: false },
  { code: 'RET', label: 'Retiro', allowsEndDate: false, requiresEndDate: false },
  {
    code: 'VSP',
    label: 'Variación permanente de salario',
    allowsEndDate: false,
    requiresEndDate: false,
  },
  {
    code: 'VST',
    label: 'Variación transitoria de salario',
    allowsEndDate: false,
    requiresEndDate: false,
  },
  {
    code: 'SLN',
    label: 'Suspensión o licencia no remunerada',
    allowsEndDate: true,
    requiresEndDate: true,
  },
  { code: 'IGE', label: 'Incapacidad general', allowsEndDate: true, requiresEndDate: true },
  {
    code: 'LMA',
    label: 'Licencia de maternidad o paternidad',
    allowsEndDate: true,
    requiresEndDate: true,
  },
  {
    code: 'VAC_LR',
    label: 'Vacaciones o licencia remunerada',
    allowsEndDate: true,
    requiresEndDate: true,
  },
  {
    code: 'IRL',
    label: 'Incapacidad por riesgo laboral',
    allowsEndDate: true,
    requiresEndDate: true,
  },
  {
    code: 'VCT',
    label: 'Cambio de centro de trabajo',
    allowsEndDate: true,
    requiresEndDate: false,
  },
];

function employeeLabel(employee: {
  id: string;
  primerNombre: string;
  segundoNombre: string | null;
  primerApellido: string;
  segundoApellido: string | null;
  cedula: string;
}) {
  return `${formatNombreCompleto(employee)} · ${employee.cedula}`;
}

function eventDate(event: { fechaInicio: string; fechaFin: string | null }) {
  const start = event.fechaInicio.slice(0, 10);
  const end = event.fechaFin?.slice(0, 10) ?? null;
  return end && end !== start ? `${start} — ${end}` : start;
}

export function PayrollPilaEventsPanel({
  periodId,
  periodStatus,
  fechaInicio,
}: {
  periodId: string;
  periodStatus: PayrollPeriodStatus;
  fechaInicio: string;
}) {
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [codigo, setCodigo] = useState<PilaEventCode>('ING');
  const [eventStart, setEventStart] = useState(fechaInicio.slice(0, 10));
  const [eventEnd, setEventEnd] = useState('');
  const [irlDays, setIrlDays] = useState('');
  const { data: events, isLoading, isError } = usePayrollPilaEvents(periodId);
  const employeesQuery = useEmployees({
    page: 1,
    limit: 100,
    search: employeeSearch || undefined,
    estado: 'ACTIVO',
  });
  const createEvent = useCreatePayrollPilaEvent();
  const deleteEvent = useDeletePayrollPilaEvent(periodId);
  const selectedOption = useMemo(
    () => eventOptions.find((option) => option.code === codigo) ?? eventOptions[0],
    [codigo],
  );
  const canEdit = periodStatus === 'BORRADOR';

  useEffect(() => {
    setEventStart(fechaInicio.slice(0, 10));
  }, [fechaInicio]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!employeeId) {
      toast.error('Selecciona un empleado.');
      return;
    }

    try {
      await createEvent.mutateAsync({
        periodId,
        payload: {
          employeeId,
          codigo,
          fechaInicio: eventStart,
          ...(selectedOption.allowsEndDate && eventEnd ? { fechaFin: eventEnd } : {}),
          ...(codigo === 'IRL' ? { dias: Number(irlDays) } : {}),
        },
      });
      setEventEnd('');
      setIrlDays('');
      toast.success('Novedad PILA agregada al período.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar la novedad PILA.');
    }
  }

  async function removeEvent(eventId: string) {
    try {
      await deleteEvent.mutateAsync(eventId);
      toast.success('Novedad PILA eliminada.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo eliminar la novedad PILA.');
    }
  }

  return (
    <section className="mb-6 rounded-xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Novedades de seguridad social</h2>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
            Cada registro queda asociado a este período y se conserva en su snapshot de nómina.
            Revisa los períodos siguientes cuando un evento los atraviese; todavía no se replica
            automáticamente. Los días y las bases por evento deben quedar validados antes de
            exportar la planilla.
          </p>
        </div>
        <Badge variant={canEdit ? 'warning' : 'success'}>
          {canEdit ? 'Edición abierta' : 'Snapshot protegido'}
        </Badge>
      </div>

      {canEdit ? (
        <form onSubmit={submit} className="mt-5 grid gap-3 rounded-lg border border-border p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pila-event-employee-search">Buscar empleado</Label>
              <Input
                id="pila-event-employee-search"
                value={employeeSearch}
                onChange={(event) => {
                  setEmployeeSearch(event.target.value);
                  setEmployeeId('');
                }}
                placeholder="Nombre o documento"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pila-event-employee">Empleado</Label>
              <Select
                id="pila-event-employee"
                value={employeeId}
                onChange={(event) => setEmployeeId(event.target.value)}
                required
              >
                <option value="">Seleccionar empleado</option>
                {(employeesQuery.data?.data ?? []).map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employeeLabel(employee)}
                  </option>
                ))}
              </Select>
              {employeesQuery.data && employeesQuery.data.meta.total > 100 && (
                <p className="text-2xs text-muted-foreground">
                  Escribe para buscar entre los {employeesQuery.data.meta.total} empleados.
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="pila-event-code">Novedad</Label>
              <Select
                id="pila-event-code"
                value={codigo}
                onChange={(event) => {
                  setCodigo(event.target.value as PilaEventCode);
                  setEventEnd('');
                  setIrlDays('');
                }}
              >
                {eventOptions.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.label} ({option.code.replace('_', '-')})
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pila-event-start">Fecha inicial</Label>
              <Input
                id="pila-event-start"
                type="date"
                value={eventStart}
                onChange={(event) => setEventStart(event.target.value)}
                required
              />
            </div>
            {selectedOption.allowsEndDate && (
              <div className="space-y-1.5">
                <Label htmlFor="pila-event-end">
                  Fecha final{selectedOption.requiresEndDate ? '' : ' (opcional)'}
                </Label>
                <Input
                  id="pila-event-end"
                  type="date"
                  value={eventEnd}
                  onChange={(event) => setEventEnd(event.target.value)}
                  required={selectedOption.requiresEndDate}
                />
              </div>
            )}
            {codigo === 'IRL' && (
              <div className="space-y-1.5">
                <Label htmlFor="pila-event-irl-days">Días IRL</Label>
                <Input
                  id="pila-event-irl-days"
                  type="number"
                  min={1}
                  max={30}
                  step={1}
                  value={irlDays}
                  onChange={(event) => setIrlDays(event.target.value)}
                  required
                />
              </div>
            )}
          </div>
          {employeesQuery.isError && (
            <p className="text-xs text-destructive" role="alert">
              No se pudo cargar la lista de empleados.
            </p>
          )}
          <div>
            <Button
              type="submit"
              size="sm"
              disabled={createEvent.isPending || employeesQuery.isLoading}
            >
              <Plus className="size-4" aria-hidden="true" />
              Agregar novedad
            </Button>
          </div>
        </form>
      ) : (
        <p className="mt-4 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          {periodStatus === 'CALCULADA'
            ? 'Para corregir estas novedades, reabre el período y reliquida la nómina.'
            : 'Las novedades están bloqueadas en este estado. Los snapshots ya aprobados conservan sus datos históricos; las correcciones posteriores siguen el flujo de corrección de nómina.'}
        </p>
      )}

      <div className="mt-4 overflow-hidden rounded-lg border border-border">
        {isLoading ? (
          <p className="px-4 py-6 text-center text-xs text-muted-foreground">
            Cargando novedades PILA...
          </p>
        ) : isError ? (
          <p className="px-4 py-6 text-center text-xs text-destructive" role="alert">
            No se pudieron cargar las novedades PILA.
          </p>
        ) : !events?.length ? (
          <p className="px-4 py-6 text-center text-xs text-muted-foreground">
            No hay novedades PILA registradas en este período.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {events.map((pilaEvent) => {
              const option = eventOptions.find((item) => item.code === pilaEvent.codigo);
              return (
                <div
                  key={pilaEvent.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {formatNombreCompleto(pilaEvent.employee)}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {option?.label ?? pilaEvent.codigo} · {eventDate(pilaEvent)}
                      {pilaEvent.dias !== null ? ` · ${pilaEvent.dias} días` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="neutral">{pilaEvent.codigo.replace('_', '-')}</Badge>
                    {canEdit && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Eliminar novedad de ${formatNombreCompleto(pilaEvent.employee)}`}
                        disabled={deleteEvent.isPending}
                        onClick={() => removeEvent(pilaEvent.id)}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
