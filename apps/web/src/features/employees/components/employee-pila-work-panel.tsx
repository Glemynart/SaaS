'use client';

import { useState, type FormEvent } from 'react';
import { CalendarCheck, Loader2, MapPin, Plus, ShieldCheck } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { getUserFacingError } from '@/lib/error-message';
import { useSedes } from '@/features/sedes/hooks/use-sedes';
import {
  useClosePilaWorkAssignment,
  useCreatePilaWorkAssignment,
  useCreatePilaWorkCenter,
  usePilaWorkAssignments,
  usePilaWorkCenters,
} from '../hooks/use-employees';

type CenterForm = {
  arlCodigo: string;
  codigoCentro: string;
  nombre: string;
  sedeId: string;
};

type AssignmentForm = {
  centroTrabajoId: string;
  codigoActividadEconomica: string;
  vigenteDesde: string;
  vigenteHasta: string;
};

const emptyCenter: CenterForm = {
  arlCodigo: '',
  codigoCentro: '',
  nombre: '',
  sedeId: '',
};

const emptyAssignment: AssignmentForm = {
  centroTrabajoId: '',
  codigoActividadEconomica: '',
  vigenteDesde: '',
  vigenteHasta: '',
};

function formatDate(value: string | null) {
  if (!value) return 'Sin fecha final';
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`).toLocaleDateString('es-CO', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  });
}

export function EmployeePilaWorkPanel({ employeeId }: { employeeId: string }) {
  const {
    data: centers = [],
    isLoading: centersLoading,
    isError: centersError,
  } = usePilaWorkCenters();
  const {
    data: assignments = [],
    isLoading: assignmentsLoading,
    isError: assignmentsError,
    error: assignmentsLoadError,
  } = usePilaWorkAssignments(employeeId);
  const { data: sites = [] } = useSedes({ activo: true });
  const createCenter = useCreatePilaWorkCenter();
  const createAssignment = useCreatePilaWorkAssignment();
  const closeAssignment = useClosePilaWorkAssignment();
  const [isAddingCenter, setIsAddingCenter] = useState(false);
  const [centerForm, setCenterForm] = useState(emptyCenter);
  const [assignmentForm, setAssignmentForm] = useState(emptyAssignment);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [closeDate, setCloseDate] = useState('');

  const submitCenter = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    createCenter.mutate(
      { ...centerForm, sedeId: centerForm.sedeId || null },
      {
        onSuccess: (center) => {
          setCenterForm(emptyCenter);
          setIsAddingCenter(false);
          setAssignmentForm((current) => ({ ...current, centroTrabajoId: center.id }));
          toast.success('Centro de trabajo PILA registrado.');
        },
        onError: (error) =>
          toast.error(getUserFacingError(error, 'No se pudo registrar el centro.')),
      },
    );
  };

  const submitAssignment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    createAssignment.mutate(
      {
        employeeId,
        data: {
          centroTrabajoId: assignmentForm.centroTrabajoId,
          codigoActividadEconomica: assignmentForm.codigoActividadEconomica,
          vigenteDesde: assignmentForm.vigenteDesde,
          vigenteHasta: assignmentForm.vigenteHasta || null,
        },
      },
      {
        onSuccess: () => {
          setAssignmentForm(emptyAssignment);
          toast.success('Se agregó la asignación de centro y actividad PILA.');
        },
        onError: (error) =>
          toast.error(getUserFacingError(error, 'No se pudo registrar la asignación PILA.')),
      },
    );
  };

  const close = (event: FormEvent<HTMLFormElement>, assignmentId: string) => {
    event.preventDefault();
    closeAssignment.mutate(
      { employeeId, assignmentId, vigenteHasta: closeDate },
      {
        onSuccess: () => {
          setClosingId(null);
          setCloseDate('');
          toast.success('Se cerró la vigencia de la asignación PILA.');
        },
        onError: (error) =>
          toast.error(getUserFacingError(error, 'No se pudo cerrar la vigencia PILA.')),
      },
    );
  };

  return (
    <section className="mt-6 space-y-4 rounded-(--radius-card) border border-border bg-surface p-5 shadow-(--shadow-card)">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <MapPin className="size-4 text-muted-foreground" aria-hidden="true" />
            <h2 className="text-base font-semibold text-foreground">
              Centro de trabajo y actividad PILA
            </h2>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Guarda el centro asignado por la ARL y la actividad de riesgos con su vigencia. La sede
            es una referencia opcional y no reemplaza el código de la ARL.
          </p>
        </div>
        {!isAddingCenter && (
          <Button type="button" size="sm" variant="outline" onClick={() => setIsAddingCenter(true)}>
            <Plus className="size-4" aria-hidden="true" />
            Crear centro ARL
          </Button>
        )}
      </div>

      <Alert>
        Registra los datos tal como aparecen en la constancia o comunicación de la ARL. La actividad
        se valida contra el catálogo versionado del Decreto 768 de 2022. El sistema conserva las
        vigencias y no convierte los campos heredados del empleado.
      </Alert>

      {isAddingCenter && (
        <form
          className="space-y-3 rounded-md border border-border-soft p-4"
          onSubmit={submitCenter}
        >
          <h3 className="text-sm font-semibold text-foreground">Nuevo centro declarado a la ARL</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Código ARL" required>
              <Input
                required
                maxLength={6}
                value={centerForm.arlCodigo}
                onChange={(event) =>
                  setCenterForm((current) => ({ ...current, arlCodigo: event.target.value }))
                }
              />
            </FormField>
            <FormField label="Código del centro" required>
              <Input
                required
                maxLength={40}
                value={centerForm.codigoCentro}
                onChange={(event) =>
                  setCenterForm((current) => ({ ...current, codigoCentro: event.target.value }))
                }
              />
            </FormField>
            <FormField label="Nombre del centro" required>
              <Input
                required
                maxLength={120}
                value={centerForm.nombre}
                onChange={(event) =>
                  setCenterForm((current) => ({ ...current, nombre: event.target.value }))
                }
              />
            </FormField>
            <FormField label="Sede relacionada (opcional)">
              <Select
                value={centerForm.sedeId}
                onChange={(event) =>
                  setCenterForm((current) => ({ ...current, sedeId: event.target.value }))
                }
              >
                <option value="">Sin sede relacionada</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.nombre}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={createCenter.isPending}>
              {createCenter.isPending && (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              )}
              Guardar centro
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setCenterForm(emptyCenter);
                setIsAddingCenter(false);
              }}
            >
              Cancelar
            </Button>
          </div>
        </form>
      )}

      {centersError && (
        <Alert variant="destructive">No se pudo cargar el catálogo de centros PILA.</Alert>
      )}

      {centers.length === 0 && !centersLoading && !isAddingCenter && (
        <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
          Aún no hay centros ARL. Registra uno con los datos de la ARL para poder asignarlo al
          empleado.
        </p>
      )}

      <form
        className="space-y-3 rounded-md border border-border-soft p-4"
        onSubmit={submitAssignment}
      >
        <h3 className="text-sm font-semibold text-foreground">
          Asignar centro y actividad al empleado
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Centro de trabajo ARL" required>
            <Select
              required
              value={assignmentForm.centroTrabajoId}
              onChange={(event) =>
                setAssignmentForm((current) => ({
                  ...current,
                  centroTrabajoId: event.target.value,
                }))
              }
              disabled={centersLoading || centers.length === 0}
            >
              <option value="">Selecciona un centro</option>
              {centers.map((center) => (
                <option key={center.id} value={center.id}>
                  {center.nombre} · {center.arlCodigo} / {center.codigoCentro}
                  {center.sede ? ` · ${center.sede.nombre}` : ''}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Actividad económica de riesgos" required>
            <Input
              required
              inputMode="numeric"
              minLength={7}
              maxLength={7}
              pattern="[1-5][0-9]{6}"
              value={assignmentForm.codigoActividadEconomica}
              onChange={(event) =>
                setAssignmentForm((current) => ({
                  ...current,
                  codigoActividadEconomica: event.target.value,
                }))
              }
              aria-describedby="pila-activity-help"
            />
          </FormField>
          <FormField label="Vigente desde" required>
            <Input
              required
              type="date"
              value={assignmentForm.vigenteDesde}
              onChange={(event) =>
                setAssignmentForm((current) => ({ ...current, vigenteDesde: event.target.value }))
              }
            />
          </FormField>
          <FormField label="Vigente hasta (opcional)">
            <Input
              type="date"
              value={assignmentForm.vigenteHasta}
              onChange={(event) =>
                setAssignmentForm((current) => ({ ...current, vigenteHasta: event.target.value }))
              }
            />
          </FormField>
        </div>
        <p id="pila-activity-help" className="text-xs text-muted-foreground">
          Escribe los siete dígitos exactamente como los confirmó la ARL. El primer dígito indica la
          clase de riesgo.
        </p>
        <Button
          type="submit"
          size="sm"
          disabled={createAssignment.isPending || centersLoading || centers.length === 0}
        >
          {createAssignment.isPending && (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          )}
          Guardar asignación
        </Button>
      </form>

      {assignmentsError && (
        <Alert variant="destructive">
          {getUserFacingError(assignmentsLoadError, 'No se pudo cargar el historial PILA.')}
        </Alert>
      )}

      {assignmentsLoading ? (
        <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Cargando historial…
        </div>
      ) : assignments.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
          El empleado aún no tiene una asignación de centro/actividad PILA.
        </p>
      ) : (
        <ol className="space-y-3">
          {assignments.map((assignment) => (
            <li key={assignment.id} className="rounded-md border border-border-soft p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">
                  {formatDate(assignment.vigenteDesde)} – {formatDate(assignment.vigenteHasta)}
                </p>
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                  Riesgo {assignment.codigoActividadEconomica[0]} ·{' '}
                  {assignment.formatoNormativoVersion}
                </span>
              </div>
              <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted-foreground">Centro ARL</dt>
                  <dd className="font-medium text-foreground">
                    {assignment.centroTrabajo.nombre} · {assignment.centroTrabajo.arlCodigo} /{' '}
                    {assignment.centroTrabajo.codigoCentro}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Actividad económica de riesgos</dt>
                  <dd className="font-medium text-foreground">
                    {assignment.codigoActividadEconomica}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Sede relacionada</dt>
                  <dd className="font-medium text-foreground">
                    {assignment.centroTrabajo.sede?.nombre ?? 'Sin sede relacionada'}
                  </dd>
                </div>
              </dl>
              {assignment.vigenteHasta === null && (
                <div className="mt-3">
                  {closingId === assignment.id ? (
                    <form
                      className="flex flex-wrap items-end gap-2"
                      onSubmit={(event) => close(event, assignment.id)}
                    >
                      <FormField label="Válida hasta" required className="min-w-48">
                        <Input
                          type="date"
                          required
                          value={closeDate}
                          onChange={(event) => setCloseDate(event.target.value)}
                        />
                      </FormField>
                      <Button type="submit" size="sm" disabled={closeAssignment.isPending}>
                        {closeAssignment.isPending && (
                          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                        )}
                        Guardar fecha
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setClosingId(null)}
                      >
                        Cancelar
                      </Button>
                    </form>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setClosingId(assignment.id);
                        const today = new Date().toISOString().slice(0, 10);
                        const starts = assignment.vigenteDesde.slice(0, 10);
                        setCloseDate(today < starts ? starts : today);
                      }}
                    >
                      <CalendarCheck className="size-4" aria-hidden="true" />
                      Finalizar vigencia
                    </Button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="size-3.5" aria-hidden="true" />
        Los cambios se guardan con auditoría y no modifican snapshots ya aprobados.
      </div>
    </section>
  );
}
