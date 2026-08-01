'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { type ContractualProfile } from '../services/contractual-profiles-api';

export interface ContractualProfileFormData {
  codigo: string;
  nombre: string;
  descripcion: string;
}

interface ContractualProfileFormProps {
  initialData?: ContractualProfile;
  onSubmit: (data: ContractualProfileFormData) => void;
  isLoading?: boolean;
}

export function ContractualProfileForm({
  initialData,
  onSubmit,
  isLoading = false,
}: ContractualProfileFormProps) {
  const [values, setValues] = useState<ContractualProfileFormData>({
    codigo: '',
    nombre: '',
    descripcion: '',
  });

  useEffect(() => {
    setValues({
      codigo: initialData?.codigo ?? '',
      nombre: initialData?.nombre ?? '',
      descripcion: initialData?.descripcion ?? '',
    });
  }, [initialData]);

  function update(field: keyof ContractualProfileFormData, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  return (
    <form
      className="space-y-8"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(values);
      }}
    >
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-foreground">Identificación</legend>
        <FormField
          label="Código"
          required
          hint="Código estable que identifica el perfil dentro de la organización."
        >
          <Input
            name="codigo"
            value={values.codigo}
            onChange={(event) => update('codigo', event.target.value)}
            maxLength={64}
            disabled={Boolean(initialData) || isLoading}
            required
            placeholder="DOCENTE"
          />
        </FormField>
        <FormField label="Nombre" required>
          <Input
            name="nombre"
            value={values.nombre}
            onChange={(event) => update('nombre', event.target.value)}
            maxLength={160}
            disabled={isLoading}
            required
            placeholder="Docente"
          />
        </FormField>
        <FormField label="Descripción" hint="Opcional. Explica cuándo usar este perfil.">
          <textarea
            name="descripcion"
            value={values.descripcion}
            onChange={(event) => update('descripcion', event.target.value)}
            maxLength={1000}
            disabled={isLoading}
            rows={4}
            className="flex w-full resize-y rounded-md border border-input bg-control px-3 py-2 text-sm text-foreground transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Perfil para docentes vinculados a la organización."
          />
        </FormField>
      </fieldset>

      <div className="flex justify-end border-t border-border-soft pt-6">
        <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
          {isLoading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {initialData ? 'Guardar cambios' : 'Crear perfil'}
        </Button>
      </div>
    </form>
  );
}
