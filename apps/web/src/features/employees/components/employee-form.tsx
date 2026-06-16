import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { employeeSchema, type EmployeeFormData } from '../schemas/employee-schemas';
import { type Employee } from '../services/employees-api';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

interface EmployeeFormProps {
  initialData?: Employee;
  onSubmit: (data: EmployeeFormData) => void;
  isLoading?: boolean;
}

import { type Resolver } from 'react-hook-form';

export function EmployeeForm({ initialData, onSubmit, isLoading }: EmployeeFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeSchema) as unknown as Resolver<EmployeeFormData>,
    defaultValues: {
      tipoDocumento: 'CC',
      cedula: '',
      nombre: '',
      apellido: '',
      email: '',
      telefono: '',
      cargo: '',
      salario: 0,
      tipoContrato: 'TERMINO_FIJO',
      fechaIngreso: new Date().toISOString().split('T')[0],
      estado: 'ACTIVO',
      municipioExpedicionDocId: '',
      salarioIntegral: false,
      jornadaLaboral: undefined,
      fechaRetiro: '',
      motivoRetiro: undefined,
    },
  });

  useEffect(() => {
    if (initialData) {
      reset({
        ...initialData,
        email: initialData.email || '',
        telefono: initialData.telefono || '',
        fechaIngreso: initialData.fechaIngreso
          ? new Date(initialData.fechaIngreso).toISOString().split('T')[0]
          : '',
        tipoContrato: initialData.tipoContrato as EmployeeFormData['tipoContrato'],
        estado: initialData.estado as EmployeeFormData['estado'],
        municipioExpedicionDocId: initialData.municipioExpedicionDocId || '',
        salarioIntegral: initialData.salarioIntegral ?? false,
        jornadaLaboral:
          (initialData.jornadaLaboral as EmployeeFormData['jornadaLaboral']) ?? undefined,
        fechaRetiro: initialData.fechaRetiro
          ? new Date(initialData.fechaRetiro).toISOString().split('T')[0]
          : '',
        motivoRetiro: (initialData.motivoRetiro as EmployeeFormData['motivoRetiro']) ?? undefined,
      });
    } else {
      reset({
        tipoDocumento: 'CC',
        cedula: '',
        nombre: '',
        apellido: '',
        email: '',
        telefono: '',
        cargo: '',
        salario: 0,
        tipoContrato: 'TERMINO_FIJO',
        fechaIngreso: new Date().toISOString().split('T')[0],
        estado: 'ACTIVO',
      });
    }
  }, [initialData, reset]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="tipoDocumento">Tipo Documento</Label>
          <select
            id="tipoDocumento"
            {...register('tipoDocumento')}
            className="flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="CC">Cédula de Ciudadanía</option>
            <option value="CE">Cédula de Extranjería</option>
            <option value="TI">Tarjeta de Identidad</option>
            <option value="PA">Pasaporte</option>
            <option value="NIT">NIT</option>
            <option value="PEP">Permiso Especial de Permanencia</option>
            <option value="PPT">Permiso por Protección Temporal</option>
          </select>
          {errors.tipoDocumento && (
            <span className="text-xs text-red-500">{errors.tipoDocumento.message}</span>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="cedula">Número Documento</Label>
          <Input id="cedula" {...register('cedula')} />
          {errors.cedula && <span className="text-xs text-red-500">{errors.cedula.message}</span>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="nombre">Nombres</Label>
          <Input id="nombre" {...register('nombre')} />
          {errors.nombre && <span className="text-xs text-red-500">{errors.nombre.message}</span>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="apellido">Apellidos</Label>
          <Input id="apellido" {...register('apellido')} />
          {errors.apellido && (
            <span className="text-xs text-red-500">{errors.apellido.message}</span>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Correo Electrónico</Label>
          <Input id="email" type="email" {...register('email')} />
          {errors.email && <span className="text-xs text-red-500">{errors.email.message}</span>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="telefono">Teléfono</Label>
          <Input id="telefono" {...register('telefono')} />
          {errors.telefono && (
            <span className="text-xs text-red-500">{errors.telefono.message}</span>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="cargo">Cargo</Label>
          <Input id="cargo" {...register('cargo')} />
          {errors.cargo && <span className="text-xs text-red-500">{errors.cargo.message}</span>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="salario">Salario (Requerido)</Label>
          <Input id="salario" type="number" step="0.01" {...register('salario')} />
          {errors.salario && <span className="text-xs text-red-500">{errors.salario.message}</span>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="tipoContrato">Tipo Contrato</Label>
          <select
            id="tipoContrato"
            {...register('tipoContrato')}
            className="flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="TERMINO_FIJO">Término Fijo</option>
            <option value="TERMINO_INDEFINIDO">Término Indefinido</option>
            <option value="OBRA_LABOR">Obra o Labor</option>
            <option value="APRENDIZAJE">Aprendizaje</option>
            <option value="PRESTACION_SERVICIOS">Prestación de Servicios</option>
          </select>
          {errors.tipoContrato && (
            <span className="text-xs text-red-500">{errors.tipoContrato.message}</span>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="fechaIngreso">Fecha de Ingreso</Label>
          <Input id="fechaIngreso" type="date" {...register('fechaIngreso')} />
          {errors.fechaIngreso && (
            <span className="text-xs text-red-500">{errors.fechaIngreso.message}</span>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="jornadaLaboral">Jornada Laboral</Label>
          <select
            id="jornadaLaboral"
            {...register('jornadaLaboral')}
            className="flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">Sin especificar</option>
            <option value="COMPLETA">Jornada Completa</option>
            <option value="MEDIA">Media Jornada</option>
            <option value="POR_HORAS">Por Horas</option>
          </select>
        </div>
        <div className="flex items-center space-x-3 pt-2">
          <input
            id="salarioIntegral"
            type="checkbox"
            {...register('salarioIntegral')}
            className="h-4 w-4 rounded border-gray-300"
          />
          <Label htmlFor="salarioIntegral">Salario Integral</Label>
        </div>
        {initialData && (
          <>
            <div className="space-y-2">
              <Label htmlFor="fechaRetiro">Fecha de Retiro</Label>
              <Input id="fechaRetiro" type="date" {...register('fechaRetiro')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="motivoRetiro">Motivo de Retiro</Label>
              <select
                id="motivoRetiro"
                {...register('motivoRetiro')}
                className="flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-950 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Sin especificar</option>
                <option value="RENUNCIA">Renuncia</option>
                <option value="TERMINACION_CONTRATO">Terminación de Contrato</option>
                <option value="MUTUO_ACUERDO">Mutuo Acuerdo</option>
                <option value="JUSTA_CAUSA">Justa Causa</option>
                <option value="FALLECIMIENTO">Fallecimiento</option>
                <option value="OTRO">Otro</option>
              </select>
            </div>
          </>
        )}
        {initialData && (
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="estado">Estado</Label>
            <select
              id="estado"
              {...register('estado')}
              className="flex h-10 w-full max-w-sm rounded-md border border-gray-200 bg-white px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-950 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="ACTIVO">Activo</option>
              <option value="INACTIVO">Inactivo</option>
              <option value="SUSPENDIDO">Suspendido</option>
              <option value="RETIRADO">Retirado</option>
            </select>
          </div>
        )}
      </div>
      <div className="flex justify-end border-t border-gray-100 pt-6">
        <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
          {isLoading ? 'Guardando...' : initialData ? 'Guardar Cambios' : 'Crear Empleado'}
        </Button>
      </div>
    </form>
  );
}
