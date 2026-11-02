'use client';

import { useState, type FormEvent } from 'react';
import { Loader2, MapPin, Plus } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useMunicipios } from '@/features/sedes/hooks/use-municipios';
import { toast } from '@/components/ui/toast';
import { getUserFacingError } from '@/lib/error-message';
import {
  useClosePilaWorkLocation,
  useCreatePilaWorkLocation,
  usePilaWorkLocations,
} from '../hooks/use-employees';

function formatDate(value: string | null) {
  if (!value) return 'Sin fecha final';
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`).toLocaleDateString('es-CO', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  });
}

export function EmployeePilaWorkLocationPanel({ employeeId }: { employeeId: string }) {
  const { data: locations = [], isLoading, isError, error } = usePilaWorkLocations(employeeId);
  const { data: municipalities = [], isLoading: municipalitiesLoading } = useMunicipios();
  const createLocation = useCreatePilaWorkLocation();
  const closeLocation = useClosePilaWorkLocation();
  const [municipioId, setMunicipioId] = useState('');
  const [vigenteDesde, setVigenteDesde] = useState('');
  const [closingId, setClosingId] = useState<string | null>(null);
  const [closeDate, setCloseDate] = useState('');

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    createLocation.mutate(
      {
        employeeId,
        data: { municipioId, vigenteDesde, vigenteHasta: null, confirmacionAportante: true },
      },
      {
        onSuccess: () => {
          setMunicipioId('');
          setVigenteDesde('');
          toast.success('Ubicación laboral PILA registrada y confirmada.');
        },
        onError: (mutationError) =>
          toast.error(getUserFacingError(mutationError, 'No se pudo registrar la ubicación.')),
      },
    );
  };

  const close = (event: FormEvent<HTMLFormElement>, locationId: string) => {
    event.preventDefault();
    closeLocation.mutate(
      { employeeId, locationId, vigenteHasta: closeDate },
      {
        onSuccess: () => {
          setClosingId(null);
          setCloseDate('');
          toast.success('Se cerró la vigencia de la ubicación PILA.');
        },
        onError: (mutationError) =>
          toast.error(getUserFacingError(mutationError, 'No se pudo cerrar la ubicación.')),
      },
    );
  };

  return (
    <section className="mt-6 space-y-4 rounded-(--radius-card) border border-border bg-surface p-5 shadow-(--shadow-card)">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <MapPin className="size-4 text-muted-foreground" aria-hidden="true" />
            <h2 className="text-base font-semibold text-foreground">Ubicación laboral PILA</h2>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Registra el municipio donde trabaja realmente la persona, confirmado por el aportante.
            Es independiente de la sede contractual y del centro declarado a la ARL.
          </p>
        </div>
      </div>

      <Alert>
        El dato se conservará con su vigencia para futuros snapshots. No se completa desde la sede
        ni modifica contratos, sedes o centros ARL. La exportación PILA todavía requiere
        validaciones normativas adicionales.
      </Alert>

      <form
        className="grid gap-3 rounded-md border border-border-soft p-4 sm:grid-cols-2"
        onSubmit={submit}
      >
        <FormField label="Municipio de trabajo declarado" required>
          <Select
            required
            value={municipioId}
            onChange={(event) => setMunicipioId(event.target.value)}
            disabled={municipalitiesLoading}
          >
            <option value="">
              {municipalitiesLoading ? 'Cargando municipios…' : 'Selecciona un municipio'}
            </option>
            {municipalities.map((municipality) => (
              <option key={municipality.id} value={municipality.id}>
                {municipality.nombre} — {municipality.departamento} ({municipality.codigo})
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Vigente desde" required>
          <Input
            required
            type="date"
            value={vigenteDesde}
            onChange={(event) => setVigenteDesde(event.target.value)}
          />
        </FormField>
        <label className="flex items-start gap-2 text-sm text-foreground sm:col-span-2">
          <input type="checkbox" required className="mt-1" />
          Confirmo que este es el municipio donde el empleado ejecuta su actividad laboral para
          PILA.
        </label>
        <div className="sm:col-span-2">
          <Button
            type="submit"
            size="sm"
            disabled={createLocation.isPending || municipalitiesLoading}
          >
            {createLocation.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Plus className="size-4" aria-hidden="true" />
            )}
            Registrar ubicación
          </Button>
        </div>
      </form>

      {isError && (
        <Alert variant="destructive">
          {getUserFacingError(error, 'No se pudo cargar el historial de ubicaciones PILA.')}
        </Alert>
      )}
      {isLoading ? (
        <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Cargando historial…
        </div>
      ) : locations.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
          No hay una ubicación laboral PILA declarada para este empleado.
        </p>
      ) : (
        <ul className="space-y-3">
          {locations.map((location) => (
            <li
              key={location.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border-soft p-4"
            >
              <div>
                <p className="text-sm font-medium text-foreground">
                  {location.municipio.nombre} — {location.municipio.departamento} (
                  {location.municipio.codigo})
                </p>
                <p className="text-xs text-muted-foreground">
                  Vigente {formatDate(location.vigenteDesde)} – {formatDate(location.vigenteHasta)}{' '}
                  · declarada por el aportante
                </p>
              </div>
              {location.vigenteHasta === null && closingId !== location.id && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setClosingId(location.id)}
                >
                  Cerrar vigencia
                </Button>
              )}
              {closingId === location.id && (
                <form
                  className="flex flex-wrap items-end gap-2"
                  onSubmit={(event) => close(event, location.id)}
                >
                  <FormField label="Vigente hasta" required>
                    <Input
                      required
                      type="date"
                      value={closeDate}
                      onChange={(event) => setCloseDate(event.target.value)}
                    />
                  </FormField>
                  <Button type="submit" size="sm" disabled={closeLocation.isPending}>
                    Guardar
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
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
