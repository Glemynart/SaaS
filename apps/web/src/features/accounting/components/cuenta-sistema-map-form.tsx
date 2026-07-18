'use client';

import { useEffect } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import {
  cuentaSistemaMapSchema,
  type CuentaSistemaMapFormData,
} from '../schemas/accounting-configuration-schemas';
import type { CuentaContable, CuentaSistemaMap } from '../services/accounting-api';

interface CuentaSistemaMapFormProps {
  initialData?: CuentaSistemaMap;
  cuentas: CuentaContable[];
  onSubmit: (data: CuentaSistemaMapFormData) => void;
  isLoading?: boolean;
}

export function CuentaSistemaMapForm({
  initialData,
  cuentas,
  onSubmit,
  isLoading,
}: CuentaSistemaMapFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CuentaSistemaMapFormData>({
    resolver: zodResolver(cuentaSistemaMapSchema) as unknown as Resolver<CuentaSistemaMapFormData>,
    defaultValues: { rol: '', cuentaId: '', descripcion: '', activo: true },
  });

  useEffect(() => {
    reset(
      initialData
        ? {
            rol: initialData.rol,
            cuentaId: initialData.cuentaId,
            descripcion: initialData.descripcion ?? '',
            activo: initialData.activo,
          }
        : { rol: '', cuentaId: '', descripcion: '', activo: true },
    );
  }, [initialData, reset]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-7">
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-foreground">Asignación</legend>
        <FormField
          label="Evento del sistema"
          required
          error={errors.rol?.message}
          hint="Código estable usado por los módulos que originan el evento."
        >
          <Input
            placeholder="SALARIOS_POR_PAGAR"
            disabled={Boolean(initialData)}
            {...register('rol')}
          />
        </FormField>
        <FormField label="Cuenta asociada" required error={errors.cuentaId?.message}>
          <Select {...register('cuentaId')}>
            <option value="">Selecciona una cuenta imputable</option>
            {cuentas.map((cuenta) => (
              <option key={cuenta.id} value={cuenta.id}>
                {cuenta.codigo} — {cuenta.nombre}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Descripción" error={errors.descripcion?.message}>
          <Input placeholder="Obligación por nómina" {...register('descripcion')} />
        </FormField>
      </fieldset>
      <div className="flex items-center gap-3 border-t border-border-soft pt-5">
        <Input
          id="map-activo"
          type="checkbox"
          className="size-4 accent-primary"
          {...register('activo')}
        />
        <Label htmlFor="map-activo">Mapeo activo</Label>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
          {isLoading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {initialData ? 'Guardar cambios' : 'Crear mapeo'}
        </Button>
      </div>
    </form>
  );
}
