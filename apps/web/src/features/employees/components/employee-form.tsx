'use client';

import { useEffect, type ReactNode } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { employeeSchema, type EmployeeFormData } from '../schemas/employee-schemas';
import { type Employee } from '../services/employees-api';
import { useSedes } from '@/features/sedes/hooks/use-sedes';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { COLOMBIA_DANE_DEPARTMENTS } from '@saas/types';

const emptyInitialPilaAffiliation = {
  epsCodigo: '',
  epsNombre: '',
  fondoPensionCodigo: '',
  fondoPensionNombre: '',
  estadoAfiliacionPensional: '',
  indicadorTarifaEspecialPensiones: '',
  arlCodigo: '',
  arlNombre: '',
  arlClaseRiesgo: '',
  cajaCompensacionCodigo: '',
  cajaCompensacionNombre: '',
  cajaCompensacionDepartamentoCodigo: '',
  extranjeroNoObligadoPension: '',
  colombianoEnElExterior: '',
  vigenteDesde: '',
  vigenteHasta: '',
};

interface EmployeeFormProps {
  initialData?: Employee;
  onSubmit: (data: EmployeeFormData) => void;
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

export function EmployeeForm({ initialData, onSubmit, isLoading }: EmployeeFormProps) {
  const { data: sedes } = useSedes({ activo: true });
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, dirtyFields },
  } = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeSchema) as unknown as Resolver<EmployeeFormData>,
    defaultValues: {
      tipoDocumento: 'CC',
      cedula: '',
      primerNombre: '',
      segundoNombre: '',
      primerApellido: '',
      segundoApellido: '',
      email: '',
      telefono: '',
      cargo: '',
      salario: 0,
      tipoContrato: 'TERMINO_FIJO',
      fechaIngreso: new Date().toISOString().split('T')[0],
      estado: 'ACTIVO',
      municipioExpedicionDocId: '',
      sedeId: '',
      tipoSalarioPila: null,
      jornadaLaboral: undefined,
      fechaRetiro: '',
      motivoRetiro: undefined,
      registrarAfiliacionPilaInicial: false,
      afiliacionPilaInicial: emptyInitialPilaAffiliation,
    },
  });

  useEffect(() => {
    if (initialData) {
      reset({
        ...initialData,
        primerNombre: initialData.primerNombre ?? '',
        segundoNombre: initialData.segundoNombre ?? undefined,
        primerApellido: initialData.primerApellido ?? '',
        segundoApellido: initialData.segundoApellido ?? undefined,
        email: initialData.email || '',
        telefono: initialData.telefono || '',
        fechaIngreso: initialData.fechaIngreso
          ? new Date(initialData.fechaIngreso).toISOString().split('T')[0]
          : '',
        tipoContrato: initialData.tipoContrato as EmployeeFormData['tipoContrato'],
        estado: initialData.estado as EmployeeFormData['estado'],
        municipioExpedicionDocId: initialData.municipioExpedicionDocId || '',
        sedeId: initialData.sedeId || '',
        tipoSalarioPila: initialData.tipoSalarioPila ?? (initialData.salarioIntegral ? 'X' : null),
        jornadaLaboral:
          (initialData.jornadaLaboral as EmployeeFormData['jornadaLaboral']) ?? undefined,
        fechaRetiro: initialData.fechaRetiro
          ? new Date(initialData.fechaRetiro).toISOString().split('T')[0]
          : '',
        motivoRetiro: (initialData.motivoRetiro as EmployeeFormData['motivoRetiro']) ?? undefined,
        registrarAfiliacionPilaInicial: false,
        afiliacionPilaInicial: emptyInitialPilaAffiliation,
      });
    } else {
      reset({
        tipoDocumento: 'CC',
        cedula: '',
        primerNombre: '',
        segundoNombre: '',
        primerApellido: '',
        segundoApellido: '',
        email: '',
        telefono: '',
        cargo: '',
        salario: 0,
        tipoContrato: 'TERMINO_FIJO',
        fechaIngreso: new Date().toISOString().split('T')[0],
        estado: 'ACTIVO',
        tipoSalarioPila: null,
        registrarAfiliacionPilaInicial: false,
        afiliacionPilaInicial: emptyInitialPilaAffiliation,
      });
    }
  }, [initialData, reset]);

  useEffect(() => {
    const assignedSedeId = initialData?.sedeId;
    if (
      !assignedSedeId ||
      dirtyFields.sedeId ||
      !sedes?.some((sede) => sede.id === assignedSedeId)
    ) {
      return;
    }

    setValue('sedeId', assignedSedeId);
  }, [dirtyFields.sedeId, initialData?.sedeId, sedes, setValue]);

  const registerInitialPila = watch('registrarAfiliacionPilaInicial');
  const employeeDocumentType = watch('tipoDocumento');

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      <FormSection title="Identidad">
        <FormField label="Tipo de documento" required error={errors.tipoDocumento?.message}>
          <Select {...register('tipoDocumento')}>
            <option value="CC">Cédula de Ciudadanía</option>
            <option value="CE">Cédula de Extranjería</option>
            <option value="TI">Tarjeta de Identidad</option>
            <option value="PA">Pasaporte</option>
            <option value="NIT">NIT</option>
            <option value="PEP">Permiso Especial de Permanencia</option>
            <option value="PPT">Permiso por Protección Temporal</option>
            <option value="PC">PEP-TUTOR (representante o custodio)</option>
          </Select>
        </FormField>
        <FormField label="Número de documento" required error={errors.cedula?.message}>
          <Input inputMode="numeric" placeholder="1023456789…" {...register('cedula')} />
        </FormField>
        <FormField label="Primer nombre" required error={errors.primerNombre?.message}>
          <Input autoComplete="given-name" {...register('primerNombre')} />
        </FormField>
        <FormField label="Segundo nombre" error={errors.segundoNombre?.message}>
          <Input {...register('segundoNombre')} />
        </FormField>
        <FormField label="Primer apellido" required error={errors.primerApellido?.message}>
          <Input autoComplete="family-name" {...register('primerApellido')} />
        </FormField>
        <FormField label="Segundo apellido" error={errors.segundoApellido?.message}>
          <Input {...register('segundoApellido')} />
        </FormField>
      </FormSection>

      <FormSection title="Contacto">
        <FormField label="Correo electrónico" error={errors.email?.message}>
          <Input
            type="email"
            autoComplete="email"
            spellCheck={false}
            placeholder="nombre@empresa.com…"
            {...register('email')}
          />
        </FormField>
        <FormField label="Teléfono" error={errors.telefono?.message}>
          <Input type="tel" inputMode="tel" placeholder="300 123 4567…" {...register('telefono')} />
        </FormField>
      </FormSection>

      <FormSection title="Información laboral">
        <FormField label="Cargo" required error={errors.cargo?.message}>
          <Input placeholder="Docente de primaria…" {...register('cargo')} />
        </FormField>
        <FormField
          label="Sede"
          required
          error={errors.sedeId?.message}
          hint="La sede se asigna a este empleado y se usará al crear contratos por lote."
        >
          <Select required {...register('sedeId')}>
            <option value="">Seleccionar sede...</option>
            {(sedes ?? []).map((sede) => (
              <option key={sede.id} value={sede.id}>
                {sede.nombre}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField
          label="Salario"
          required
          error={errors.salario?.message}
          hint="Valor mensual en pesos colombianos."
        >
          <Input type="number" step="0.01" min="0" {...register('salario')} />
        </FormField>
        <FormField label="Tipo de contrato" required error={errors.tipoContrato?.message}>
          <Select {...register('tipoContrato')}>
            <option value="TERMINO_FIJO">Término fijo</option>
            <option value="TERMINO_INDEFINIDO">Término indefinido</option>
            <option value="OBRA_LABOR">Obra o labor</option>
            <option value="APRENDIZAJE">Aprendizaje</option>
            <option value="PRESTACION_SERVICIOS">Prestación de servicios</option>
          </Select>
        </FormField>
        <FormField label="Fecha de ingreso" required error={errors.fechaIngreso?.message}>
          <Input type="date" {...register('fechaIngreso')} />
        </FormField>
        <FormField label="Jornada laboral" error={errors.jornadaLaboral?.message}>
          <Select {...register('jornadaLaboral')}>
            <option value="">Sin especificar</option>
            <option value="COMPLETA">Jornada completa</option>
            <option value="MEDIA">Media jornada</option>
            <option value="POR_HORAS">Por horas</option>
          </Select>
        </FormField>
        <FormField
          label="Tipo de salario para PILA"
          error={errors.tipoSalarioPila?.message}
          hint="Registra el tipo confirmado por la empresa. Si queda sin especificar, el empleado no podrá incluirse en una exportación PILA."
        >
          <Select {...register('tipoSalarioPila')}>
            <option value="">Sin especificar</option>
            <option value="F">Salario fijo (F)</option>
            <option value="V">Salario variable (V)</option>
            <option value="X">Salario integral (X)</option>
          </Select>
        </FormField>
      </FormSection>

      {!initialData && (
        <fieldset className="space-y-4 rounded-md border border-border-soft p-4">
          <legend className="px-1 text-sm font-semibold text-foreground">
            Afiliación PILA inicial (opcional)
          </legend>
          <label className="flex items-start gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-primary"
              {...register('registrarAfiliacionPilaInicial')}
            />
            Registrar afiliación PILA inicial
          </label>
          {registerInitialPila && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Solo para contratos laborales estándar, cotizante dependiente 01 y subtipo 00.
                Confirma los datos con la constancia de afiliación; los códigos de las
                administradoras no se validan contra catálogos oficiales.
              </p>
              <FormSection title="Administradoras y vigencia">
                <FormField
                  label="Código EPS"
                  required
                  error={errors.afiliacionPilaInicial?.epsCodigo?.message}
                >
                  <Input maxLength={6} {...register('afiliacionPilaInicial.epsCodigo')} />
                </FormField>
                <FormField
                  label="Nombre EPS"
                  required
                  error={errors.afiliacionPilaInicial?.epsNombre?.message}
                >
                  <Input maxLength={120} {...register('afiliacionPilaInicial.epsNombre')} />
                </FormField>
                <FormField
                  label="Código Fondo de pensión"
                  required
                  error={errors.afiliacionPilaInicial?.fondoPensionCodigo?.message}
                >
                  <Input maxLength={6} {...register('afiliacionPilaInicial.fondoPensionCodigo')} />
                </FormField>
                <FormField
                  label="Nombre Fondo de pensión"
                  required
                  error={errors.afiliacionPilaInicial?.fondoPensionNombre?.message}
                >
                  <Input
                    maxLength={120}
                    {...register('afiliacionPilaInicial.fondoPensionNombre')}
                  />
                </FormField>
                <FormField
                  label="Transición pensional (campo 5)"
                  hint="Registra S o N tal como aparece en el soporte vigente: S indica transición y N indica que no está en transición. Si no tienes el soporte, déjalo sin confirmar. Este dato por sí solo no habilita los campos FSP de PILA."
                >
                  <Select {...register('afiliacionPilaInicial.estadoAfiliacionPensional')}>
                    <option value="">Sin confirmar</option>
                    <option value="S">S — En transición</option>
                    <option value="N">N — Sin transición</option>
                  </Select>
                </FormField>
                <FormField
                  label="Tarifa de pensiones (campo 79)"
                  hint="Confirma la tarifa en el soporte vigente. Las tarifas especiales están fuera de esta etapa y bloquean la exportación PILA."
                >
                  <Select {...register('afiliacionPilaInicial.indicadorTarifaEspecialPensiones')}>
                    <option value="">Sin confirmar</option>
                    <option value="NORMAL">Normal (blanco en el archivo)</option>
                    <option value="1">1 · Actividades de alto riesgo</option>
                    <option value="2">2 · Senadores</option>
                    <option value="3">3 · CTI</option>
                    <option value="4">4 · Aviadores</option>
                  </Select>
                </FormField>
                <FormField
                  label="Código ARL"
                  required
                  error={errors.afiliacionPilaInicial?.arlCodigo?.message}
                >
                  <Input maxLength={6} {...register('afiliacionPilaInicial.arlCodigo')} />
                </FormField>
                <FormField
                  label="Nombre ARL"
                  required
                  error={errors.afiliacionPilaInicial?.arlNombre?.message}
                >
                  <Input maxLength={120} {...register('afiliacionPilaInicial.arlNombre')} />
                </FormField>
                <FormField
                  label="Clase de riesgo ARL"
                  required
                  error={errors.afiliacionPilaInicial?.arlClaseRiesgo?.message}
                >
                  <Select {...register('afiliacionPilaInicial.arlClaseRiesgo')}>
                    <option value="">Selecciona una clase</option>
                    {[1, 2, 3, 4, 5].map((riskClass) => (
                      <option key={riskClass} value={riskClass}>
                        {riskClass}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField
                  label="Código Caja de compensación"
                  required
                  error={errors.afiliacionPilaInicial?.cajaCompensacionCodigo?.message}
                >
                  <Input
                    maxLength={6}
                    {...register('afiliacionPilaInicial.cajaCompensacionCodigo')}
                  />
                </FormField>
                <FormField
                  label="Nombre Caja de compensación"
                  required
                  error={errors.afiliacionPilaInicial?.cajaCompensacionNombre?.message}
                >
                  <Input
                    maxLength={120}
                    {...register('afiliacionPilaInicial.cajaCompensacionNombre')}
                  />
                </FormField>
                <FormField
                  label="Departamento de la CCF"
                  required
                  error={errors.afiliacionPilaInicial?.cajaCompensacionDepartamentoCodigo?.message}
                  hint="Se guarda con código DIVIPOLA de dos dígitos."
                >
                  <Select {...register('afiliacionPilaInicial.cajaCompensacionDepartamentoCodigo')}>
                    <option value="">Selecciona un departamento</option>
                    {COLOMBIA_DANE_DEPARTMENTS.map(({ codigo, nombre }) => (
                      <option key={codigo} value={codigo}>
                        {codigo} · {nombre}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField
                  label="Vigente desde"
                  required
                  error={errors.afiliacionPilaInicial?.vigenteDesde?.message}
                >
                  <Input type="date" {...register('afiliacionPilaInicial.vigenteDesde')} />
                </FormField>
                <FormField
                  label="Vigente hasta"
                  error={errors.afiliacionPilaInicial?.vigenteHasta?.message}
                  hint="Déjalo vacío si la afiliación sigue vigente."
                >
                  <Input type="date" {...register('afiliacionPilaInicial.vigenteHasta')} />
                </FormField>
                {(employeeDocumentType === 'CC' || employeeDocumentType === 'TI') && (
                  <FormField
                    label="¿Es colombiano en el exterior?"
                    required
                    error={errors.afiliacionPilaInicial?.colombianoEnElExterior?.message}
                  >
                    <Select {...register('afiliacionPilaInicial.colombianoEnElExterior')}>
                      <option value="">Confirma la declaración</option>
                      <option value="SI">Sí</option>
                      <option value="NO">No</option>
                    </Select>
                  </FormField>
                )}
                {(employeeDocumentType === 'CE' || employeeDocumentType === 'PA') && (
                  <FormField
                    label="¿Está exento de cotizar a pensión?"
                    required
                    error={errors.afiliacionPilaInicial?.extranjeroNoObligadoPension?.message}
                  >
                    <Select {...register('afiliacionPilaInicial.extranjeroNoObligadoPension')}>
                      <option value="">Confirma la declaración</option>
                      <option value="SI">Sí</option>
                      <option value="NO">No</option>
                    </Select>
                  </FormField>
                )}
              </FormSection>
            </div>
          )}
        </fieldset>
      )}

      {initialData && (
        <FormSection title="Estado y retiro">
          <FormField
            label="Estado"
            error={errors.estado?.message}
            hint="Un empleado inactivo deja de aparecer en los listados activos."
          >
            <Select {...register('estado')}>
              <option value="ACTIVO">Activo</option>
              <option value="INACTIVO">Inactivo</option>
              <option value="SUSPENDIDO">Suspendido</option>
              <option value="RETIRADO">Retirado</option>
            </Select>
          </FormField>
          <FormField label="Fecha de retiro" error={errors.fechaRetiro?.message}>
            <Input type="date" {...register('fechaRetiro')} />
          </FormField>
          <FormField label="Motivo de retiro" error={errors.motivoRetiro?.message}>
            <Select {...register('motivoRetiro')}>
              <option value="">Sin especificar</option>
              <option value="RENUNCIA">Renuncia</option>
              <option value="TERMINACION_CONTRATO">Terminación de contrato</option>
              <option value="MUTUO_ACUERDO">Mutuo acuerdo</option>
              <option value="JUSTA_CAUSA">Justa causa</option>
              <option value="FALLECIMIENTO">Fallecimiento</option>
              <option value="OTRO">Otro</option>
            </Select>
          </FormField>
        </FormSection>
      )}

      <div className="flex justify-end border-t border-border-soft pt-6">
        <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
          {isLoading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {initialData ? 'Guardar cambios' : 'Crear empleado'}
        </Button>
      </div>
    </form>
  );
}
