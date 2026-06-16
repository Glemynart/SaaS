import { useEffect } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { sedeSchema, type SedeFormData } from '../schemas/sede-schemas';
import { type Sede } from '../services/sedes-api';
import { useMunicipios } from '../hooks/use-municipios';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

interface SedeFormProps {
  initialData?: Sede;
  onSubmit: (data: SedeFormData) => void;
  isLoading?: boolean;
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="nombre">Nombre</Label>
          <Input id="nombre" {...register('nombre')} />
          {errors.nombre && <span className="text-xs text-red-500">{errors.nombre.message}</span>}
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="municipioId">Municipio</Label>
          <select
            id="municipioId"
            {...register('municipioId')}
            disabled={isLoadingMunicipios}
            className="flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">
              {isLoadingMunicipios ? 'Cargando municipios...' : 'Selecciona un municipio'}
            </option>
            {municipios?.map((municipio) => (
              <option key={municipio.id} value={municipio.id}>
                {municipio.nombre} — {municipio.departamento}
              </option>
            ))}
          </select>
          {errors.municipioId && (
            <span className="text-xs text-red-500">{errors.municipioId.message}</span>
          )}
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="direccion">Dirección</Label>
          <Input id="direccion" {...register('direccion')} />
          {errors.direccion && (
            <span className="text-xs text-red-500">{errors.direccion.message}</span>
          )}
        </div>
      </div>
      <div className="flex justify-end border-t border-gray-100 pt-6">
        <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
          {isLoading ? 'Guardando...' : initialData ? 'Guardar Cambios' : 'Crear Sede'}
        </Button>
      </div>
    </form>
  );
}
