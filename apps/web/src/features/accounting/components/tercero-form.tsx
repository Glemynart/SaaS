'use client';

import { useEffect } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useMunicipios } from '@/features/sedes/hooks/use-municipios';
import { AccountingCheckboxField } from './accounting-checkbox-field';
import { terceroSchema, type TerceroFormData } from '../schemas/accounting-configuration-schemas';
import type { Tercero } from '../services/accounting-api';

interface TerceroFormProps {
  initialData?: Tercero;
  onSubmit: (data: TerceroFormData) => void;
  isLoading?: boolean;
}

function emptyValues(): TerceroFormData {
  return {
    tipoDocumento: 'CC',
    numeroDocumento: '',
    digitoVerificacion: '',
    tipoPersona: 'NATURAL',
    razonSocial: '',
    primerNombre: '',
    segundoNombre: '',
    primerApellido: '',
    segundoApellido: '',
    nombreComercial: '',
    esCliente: false,
    esProveedor: false,
    esEmpleado: false,
    esEntidadGubernamental: false,
    esBanco: false,
    responsabilidadesFiscales: '',
    regimenSimple: false,
    granContribuyente: false,
    email: '',
    telefono: '',
    direccion: '',
    municipioId: '',
    activo: true,
  };
}

export function TerceroForm({ initialData, onSubmit, isLoading }: TerceroFormProps) {
  const { data: municipios, isLoading: isLoadingMunicipios } = useMunicipios();
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<TerceroFormData>({
    resolver: zodResolver(terceroSchema) as unknown as Resolver<TerceroFormData>,
    defaultValues: emptyValues(),
  });
  const tipoPersona = watch('tipoPersona');

  useEffect(() => {
    reset(
      initialData
        ? {
            tipoDocumento: initialData.tipoDocumento,
            numeroDocumento: initialData.numeroDocumento,
            digitoVerificacion: initialData.digitoVerificacion ?? '',
            tipoPersona: initialData.tipoPersona,
            razonSocial: initialData.razonSocial ?? '',
            primerNombre: initialData.primerNombre ?? '',
            segundoNombre: initialData.segundoNombre ?? '',
            primerApellido: initialData.primerApellido ?? '',
            segundoApellido: initialData.segundoApellido ?? '',
            nombreComercial: initialData.nombreComercial ?? '',
            esCliente: initialData.esCliente,
            esProveedor: initialData.esProveedor,
            esEmpleado: initialData.esEmpleado,
            esEntidadGubernamental: initialData.esEntidadGubernamental,
            esBanco: initialData.esBanco,
            responsabilidadesFiscales: initialData.responsabilidadesFiscales.join(', '),
            regimenSimple: initialData.regimenSimple,
            granContribuyente: initialData.granContribuyente,
            email: initialData.email ?? '',
            telefono: initialData.telefono ?? '',
            direccion: initialData.direccion ?? '',
            municipioId: initialData.municipioId ?? '',
            activo: initialData.activo,
          }
        : emptyValues(),
    );
  }, [initialData, reset]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-7">
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-foreground">Identificación</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Tipo de documento" required error={errors.tipoDocumento?.message}>
            <Select disabled={Boolean(initialData)} {...register('tipoDocumento')}>
              <option value="CC">Cédula de ciudadanía</option>
              <option value="CE">Cédula de extranjería</option>
              <option value="TI">Tarjeta de identidad</option>
              <option value="PA">Pasaporte</option>
              <option value="NIT">NIT</option>
              <option value="PEP">PEP</option>
              <option value="PPT">PPT</option>
              <option value="PC">PEP-TUTOR</option>
            </Select>
          </FormField>
          <FormField label="Número de documento" required error={errors.numeroDocumento?.message}>
            <Input disabled={Boolean(initialData)} {...register('numeroDocumento')} />
          </FormField>
          <FormField label="Dígito de verificación" error={errors.digitoVerificacion?.message}>
            <Input {...register('digitoVerificacion')} />
          </FormField>
          <FormField label="Tipo de persona" required error={errors.tipoPersona?.message}>
            <Select {...register('tipoPersona')}>
              <option value="NATURAL">Persona natural</option>
              <option value="JURIDICA">Persona jurídica</option>
            </Select>
          </FormField>
        </div>
      </fieldset>

      {tipoPersona === 'JURIDICA' ? (
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-foreground">Razón social</legend>
          <FormField label="Razón social" required error={errors.razonSocial?.message}>
            <Input {...register('razonSocial')} />
          </FormField>
          <FormField label="Nombre comercial" error={errors.nombreComercial?.message}>
            <Input {...register('nombreComercial')} />
          </FormField>
        </fieldset>
      ) : (
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-foreground">Nombre</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Primer nombre" required error={errors.primerNombre?.message}>
              <Input {...register('primerNombre')} />
            </FormField>
            <FormField label="Segundo nombre" error={errors.segundoNombre?.message}>
              <Input {...register('segundoNombre')} />
            </FormField>
            <FormField label="Primer apellido" required error={errors.primerApellido?.message}>
              <Input {...register('primerApellido')} />
            </FormField>
            <FormField label="Segundo apellido" error={errors.segundoApellido?.message}>
              <Input {...register('segundoApellido')} />
            </FormField>
            <FormField
              label="Nombre comercial"
              error={errors.nombreComercial?.message}
              className="sm:col-span-2"
            >
              <Input {...register('nombreComercial')} />
            </FormField>
          </div>
        </fieldset>
      )}

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-foreground">Roles y responsabilidades</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <AccountingCheckboxField id="esCliente" label="Es cliente" {...register('esCliente')} />
          <AccountingCheckboxField
            id="esProveedor"
            label="Es proveedor"
            {...register('esProveedor')}
          />
          <AccountingCheckboxField
            id="esEmpleado"
            label="Es empleado"
            {...register('esEmpleado')}
          />
          <AccountingCheckboxField
            id="esEntidadGubernamental"
            label="Entidad gubernamental"
            {...register('esEntidadGubernamental')}
          />
          <AccountingCheckboxField id="esBanco" label="Es banco" {...register('esBanco')} />
          <AccountingCheckboxField
            id="regimenSimple"
            label="Régimen simple"
            {...register('regimenSimple')}
          />
          <AccountingCheckboxField
            id="granContribuyente"
            label="Gran contribuyente"
            {...register('granContribuyente')}
          />
        </div>
        <FormField
          label="Responsabilidades fiscales"
          error={errors.responsabilidadesFiscales?.message}
          hint="Separa los códigos con comas."
        >
          <Input placeholder="O-13, O-15" {...register('responsabilidadesFiscales')} />
        </FormField>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-foreground">Contacto</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Correo electrónico" error={errors.email?.message}>
            <Input type="email" {...register('email')} />
          </FormField>
          <FormField label="Teléfono" error={errors.telefono?.message}>
            <Input {...register('telefono')} />
          </FormField>
          <FormField label="Dirección" error={errors.direccion?.message} className="sm:col-span-2">
            <Input {...register('direccion')} />
          </FormField>
          <FormField
            label="Municipio"
            error={errors.municipioId?.message}
            className="sm:col-span-2"
          >
            <Select disabled={isLoadingMunicipios} {...register('municipioId')}>
              <option value="">Sin municipio</option>
              {municipios?.map((municipio) => (
                <option key={municipio.id} value={municipio.id}>
                  {municipio.nombre} — {municipio.departamento}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
      </fieldset>

      <div className="flex items-center gap-3 border-t border-border-soft pt-5">
        <AccountingCheckboxField
          id="tercero-activo"
          label="Tercero activo"
          {...register('activo')}
        />
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
          {isLoading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {initialData ? 'Guardar cambios' : 'Crear tercero'}
        </Button>
      </div>
    </form>
  );
}
