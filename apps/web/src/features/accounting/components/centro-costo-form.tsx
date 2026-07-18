'use client';

import { useEffect } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useSedes } from '@/features/sedes/hooks/use-sedes';
import { AccountingCheckboxField } from './accounting-checkbox-field';
import {
  centroCostoSchema,
  type CentroCostoFormData,
} from '../schemas/accounting-configuration-schemas';
import type { CentroCosto } from '../services/accounting-api';

interface CentroCostoFormProps {
  initialData?: CentroCosto;
  onSubmit: (data: CentroCostoFormData) => void;
  isLoading?: boolean;
}

export function CentroCostoForm({ initialData, onSubmit, isLoading }: CentroCostoFormProps) {
  const { data: sedes, isLoading: isLoadingSedes } = useSedes({});
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CentroCostoFormData>({
    resolver: zodResolver(centroCostoSchema) as unknown as Resolver<CentroCostoFormData>,
    defaultValues: { codigo: '', nombre: '', sedeId: '', activo: true },
  });
  useEffect(() => {
    reset(
      initialData
        ? {
            codigo: initialData.codigo,
            nombre: initialData.nombre,
            sedeId: initialData.sedeId ?? '',
            activo: initialData.activo,
          }
        : { codigo: '', nombre: '', sedeId: '', activo: true },
    );
  }, [initialData, reset]);
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-7">
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-foreground">Identificación</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Código" required error={errors.codigo?.message}>
            <Input disabled={Boolean(initialData)} {...register('codigo')} />
          </FormField>
          <FormField label="Nombre" required error={errors.nombre?.message}>
            <Input {...register('nombre')} />
          </FormField>
          <FormField label="Sede" error={errors.sedeId?.message} className="sm:col-span-2">
            <Select disabled={isLoadingSedes} {...register('sedeId')}>
              <option value="">Sin sede asociada</option>
              {sedes?.map((sede) => (
                <option key={sede.id} value={sede.id}>
                  {sede.nombre}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
      </fieldset>
      <div className="border-t border-border-soft pt-5">
        <AccountingCheckboxField
          id="centro-activo"
          label="Centro de costo activo"
          {...register('activo')}
        />
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
          {isLoading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {initialData ? 'Guardar cambios' : 'Crear centro de costo'}
        </Button>
      </div>
    </form>
  );
}
