'use client';

import { useEffect, type ReactNode } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { sedeSchema, type SedeFormData } from '../schemas/sede-schemas';
import { type Sede } from '../services/sedes-api';
import { useMunicipios } from '../hooks/use-municipios';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

interface SedeFormProps {
  initialData?: Sede;
  onSubmit: (data: SedeFormData) => void;
  isLoading?: boolean;
}

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <legend className="text-sm font-semibold text-foreground">{title}</legend>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

export function SedeForm({ initialData, onSubmit, isLoading }: SedeFormProps) {
  const { data: municipios, isLoading: isLoadingMunicipios } = useMunicipios();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SedeFormData>({
    resolver: zodResolver(sedeSchema) as unknown as Resolver<SedeFormData>,
    defaultValues: {
      nombre: '',
      municipioId: '',
      direccion: '',
      activo: true,
    },
  });

  useEffect(() => {
    if (initialData) {
      reset({
        nombre: initialData.nombre,
        municipioId: initialData.municipioId ?? '',
        direccion: initialData.direccion ?? '',
        activo: initialData.activo,
      });
    } else {
      reset({
        nombre: '',
        municipioId: '',
        direccion: '',
        activo: true,
      });
    }
  }, [initialData, reset]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      <FormSection title="Identificación">
        <FormField label="Nombre" required error={errors.nombre?.message} className="sm:col-span-2">
          <Input placeholder="Sede principal…" {...register('nombre')} />
        </FormField>
      </FormSection>

      <FormSection title="Ubicación">
        <FormField
          label="Municipio"
          required
          error={errors.municipioId?.message}
          className="sm:col-span-2"
        >
          <Select {...register('municipioId')} disabled={isLoadingMunicipios}>
            <option value="">
              {isLoadingMunicipios ? 'Cargando municipios…' : 'Selecciona un municipio'}
            </option>
            {municipios?.map((municipio) => (
              <option key={municipio.id} value={municipio.id}>
                {municipio.nombre} — {municipio.departamento}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField
          label="Dirección"
          error={errors.direccion?.message}
          hint="Opcional. Ayuda a ubicar la sede en documentos y reportes."
          className="sm:col-span-2"
        >
          <Input placeholder="Cra. 10 # 20-30…" {...register('direccion')} />
        </FormField>
      </FormSection>

      <div className="flex justify-end border-t border-border-soft pt-6">
        <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
          {isLoading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {initialData ? 'Guardar cambios' : 'Crear sede'}
        </Button>
      </div>
    </form>
  );
}
