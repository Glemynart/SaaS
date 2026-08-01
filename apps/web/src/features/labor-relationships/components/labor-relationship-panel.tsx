'use client';

import { useEffect, useState } from 'react';
import { Loader2, Link2 } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { useContractualProfiles } from '@/features/contractual-profiles/hooks/use-contractual-profiles';
import {
  useCreateLaborRelationship,
  useLaborRelationships,
  useUpdateLaborRelationship,
} from '../hooks/use-labor-relationships';

interface LaborRelationshipPanelProps {
  employeeId: string;
}

interface LaborRelationshipFormValues {
  perfilContractualId: string;
  vigenteDesde: string;
  vigenteHasta: string;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function inputDate(value: string | null | undefined) {
  return value ? value.slice(0, 10) : '';
}

export function LaborRelationshipPanel({ employeeId }: LaborRelationshipPanelProps) {
  const relationshipsQuery = useLaborRelationships({ empleadoId: employeeId, activo: true });
  const profilesQuery = useContractualProfiles();
  const createMutation = useCreateLaborRelationship();
  const updateMutation = useUpdateLaborRelationship();
  const relationship = relationshipsQuery.data?.[0];
  const [values, setValues] = useState<LaborRelationshipFormValues>({
    perfilContractualId: '',
    vigenteDesde: today(),
    vigenteHasta: '',
  });

  useEffect(() => {
    if (relationship) {
      setValues({
        perfilContractualId: relationship.perfilContractualId,
        vigenteDesde: inputDate(relationship.vigenteDesde),
        vigenteHasta: inputDate(relationship.vigenteHasta),
      });
      return;
    }

    if (!relationshipsQuery.isLoading) {
      setValues((current) => ({
        ...current,
        perfilContractualId: '',
        vigenteDesde: current.vigenteDesde || today(),
        vigenteHasta: '',
      }));
    }
  }, [relationship, relationshipsQuery.isLoading]);

  function update(field: keyof LaborRelationshipFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function submit() {
    const data = {
      perfilContractualId: values.perfilContractualId,
      vigenteDesde: values.vigenteDesde,
      ...(values.vigenteHasta && { vigenteHasta: values.vigenteHasta }),
    };

    if (relationship) {
      updateMutation.mutate(
        { id: relationship.id, data },
        {
          onSuccess: () => toast.success('Vínculo laboral actualizado.'),
          onError: (error) => toast.error(error.message),
        },
      );
      return;
    }

    createMutation.mutate(
      { empleadoId: employeeId, ...data },
      {
        onSuccess: () => toast.success('Vínculo laboral creado.'),
        onError: (error) => toast.error(error.message),
      },
    );
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const profiles = profilesQuery.data ?? [];
  const error = relationshipsQuery.error ?? profilesQuery.error;

  return (
    <section className="mt-4 rounded-[--radius-card] border border-border bg-surface p-5 shadow-[--shadow-card]">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-md bg-primary/10 p-2 text-primary">
          <Link2 className="size-4" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">Vínculo laboral</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Define el perfil contractual precontractual y su vigencia para este empleado.
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mt-4">
          No pudimos cargar el vínculo laboral o los perfiles contractuales.
        </Alert>
      )}

      {!error && profiles.length === 0 && !profilesQuery.isLoading ? (
        <Alert className="mt-4">
          Crea primero un perfil contractual para poder asignar un vínculo laboral.
        </Alert>
      ) : (
        <form
          className="mt-5 grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <FormField label="Perfil contractual" required>
            <Select
              value={values.perfilContractualId}
              onChange={(event) => update('perfilContractualId', event.target.value)}
              disabled={profilesQuery.isLoading || isSaving}
              required
            >
              <option value="">Selecciona un perfil</option>
              {profiles.map((profile) => (
                <option
                  key={profile.id}
                  value={profile.id}
                  disabled={!profile.activo && profile.id !== relationship?.perfilContractualId}
                >
                  {profile.nombre} ({profile.codigo}){!profile.activo ? ' — inactivo' : ''}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Vigente desde" required>
            <Input
              type="date"
              value={values.vigenteDesde}
              onChange={(event) => update('vigenteDesde', event.target.value)}
              disabled={isSaving}
              required
            />
          </FormField>

          <FormField
            label="Vigente hasta"
            hint="Opcional. Déjalo vacío si no tiene fecha de finalización."
          >
            <Input
              type="date"
              value={values.vigenteHasta}
              onChange={(event) => update('vigenteHasta', event.target.value)}
              disabled={isSaving}
            />
          </FormField>

          <div className="flex items-end justify-end sm:col-span-2">
            <Button type="submit" disabled={isSaving || !values.perfilContractualId}>
              {isSaving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {relationship ? 'Actualizar vínculo' : 'Guardar vínculo'}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
