'use client';

import { useEffect } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useCuentasContables } from '../hooks/use-accounting-configuration';
import {
  cuentaContableSchema,
  type CuentaContableFormData,
} from '../schemas/accounting-configuration-schemas';
import type { CuentaContable } from '../services/accounting-api';
import { AccountingCheckboxField } from './accounting-checkbox-field';

const CLASES = [
  ['ACTIVO', 'Activo'],
  ['PASIVO', 'Pasivo'],
  ['PATRIMONIO', 'Patrimonio'],
  ['INGRESOS', 'Ingresos'],
  ['GASTOS', 'Gastos'],
  ['COSTOS_VENTAS', 'Costos de ventas'],
  ['COSTOS_PRODUCCION', 'Costos de producción'],
  ['CUENTAS_ORDEN_DEUDORAS', 'Cuentas de orden deudoras'],
  ['CUENTAS_ORDEN_ACREEDORAS', 'Cuentas de orden acreedoras'],
] as const;

interface CuentaContableFormProps {
  initialData?: CuentaContable;
  onSubmit: (data: CuentaContableFormData) => void;
  isLoading?: boolean;
}

export function CuentaContableForm({ initialData, onSubmit, isLoading }: CuentaContableFormProps) {
  const { data: cuentasPadre, isLoading: isLoadingCuentasPadre } = useCuentasContables({
    activa: true,
  });
  const isProtected = initialData?.esCuentaSistema ?? false;
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CuentaContableFormData>({
    resolver: zodResolver(cuentaContableSchema) as unknown as Resolver<CuentaContableFormData>,
    defaultValues: {
      codigo: '',
      nombre: '',
      claseContable: 'ACTIVO',
      naturaleza: 'DEBITO',
      nivel: 1,
      cuentaPadreId: '',
      imputable: false,
      requiereTercero: false,
      requiereCentroCosto: false,
      requiereBase: false,
      activa: true,
    },
  });

  useEffect(() => {
    if (!initialData) {
      reset({
        codigo: '',
        nombre: '',
        claseContable: 'ACTIVO',
        naturaleza: 'DEBITO',
        nivel: 1,
        cuentaPadreId: '',
        imputable: false,
        requiereTercero: false,
        requiereCentroCosto: false,
        requiereBase: false,
        activa: true,
      });
      return;
    }
    reset({
      codigo: initialData.codigo,
      nombre: initialData.nombre,
      claseContable: initialData.claseContable,
      naturaleza: initialData.naturaleza,
      nivel: initialData.nivel,
      cuentaPadreId: initialData.cuentaPadreId ?? '',
      imputable: initialData.imputable,
      requiereTercero: initialData.requiereTercero,
      requiereCentroCosto: initialData.requiereCentroCosto,
      requiereBase: initialData.requiereBase,
      activa: initialData.activa,
    });
  }, [initialData, reset]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-7">
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-foreground">Identificación</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Código PUC" required error={errors.codigo?.message}>
            <Input placeholder="110505" disabled={Boolean(initialData)} {...register('codigo')} />
          </FormField>
          <FormField label="Nivel" required error={errors.nivel?.message}>
            <Input
              type="number"
              min="1"
              max="5"
              disabled={Boolean(initialData)}
              {...register('nivel')}
            />
          </FormField>
          <FormField
            label="Nombre"
            required
            error={errors.nombre?.message}
            className="sm:col-span-2"
          >
            <Input placeholder="Caja general" {...register('nombre')} />
          </FormField>
          <FormField label="Clase contable" required error={errors.claseContable?.message}>
            <Select disabled={Boolean(initialData)} {...register('claseContable')}>
              {CLASES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Naturaleza" required error={errors.naturaleza?.message}>
            <Select disabled={Boolean(initialData)} {...register('naturaleza')}>
              <option value="DEBITO">Débito</option>
              <option value="CREDITO">Crédito</option>
            </Select>
          </FormField>
          <FormField
            label="Cuenta padre"
            error={errors.cuentaPadreId?.message}
            className="sm:col-span-2"
          >
            <Select
              disabled={Boolean(initialData) || isLoadingCuentasPadre}
              {...register('cuentaPadreId')}
            >
              <option value="">Sin cuenta padre</option>
              {cuentasPadre?.map((cuenta) => (
                <option key={cuenta.id} value={cuenta.id}>
                  {cuenta.codigo} — {cuenta.nombre}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-foreground">Control operativo</legend>
        {isProtected && (
          <p className="text-xs leading-5 text-muted-foreground">
            Esta es una cuenta de sistema. Solo puede modificarse su nombre.
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <AccountingCheckboxField
            id="imputable"
            label="Cuenta imputable"
            disabled={isProtected}
            {...register('imputable')}
          />
          <AccountingCheckboxField
            id="activa"
            label="Cuenta activa"
            disabled={isProtected}
            {...register('activa')}
          />
          <AccountingCheckboxField
            id="requiereTercero"
            label="Requiere tercero"
            disabled={isProtected}
            {...register('requiereTercero')}
          />
          <AccountingCheckboxField
            id="requiereCentroCosto"
            label="Requiere centro de costo"
            disabled={isProtected}
            {...register('requiereCentroCosto')}
          />
          <AccountingCheckboxField
            id="requiereBase"
            label="Requiere base gravable"
            disabled={isProtected}
            {...register('requiereBase')}
          />
        </div>
      </fieldset>

      <div className="flex justify-end border-t border-border-soft pt-6">
        <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
          {isLoading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {initialData ? 'Guardar cambios' : 'Crear cuenta'}
        </Button>
      </div>
    </form>
  );
}
