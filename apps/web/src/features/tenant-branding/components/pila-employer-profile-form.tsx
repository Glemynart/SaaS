'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import {
  useTenantPilaEmployerProfile,
  useUpdatePilaEmployerProfile,
} from '@/features/tenant-branding/hooks/use-tenant-branding';
import type { PilaEmployerProfile } from '@/features/tenant-branding/services/tenant-branding-api';

type PilaEmployerForm = {
  claseAportante: string;
  tipoDocumentoAportante: string;
  naturalezaJuridica: string;
  tipoPersona: string;
  formaPresentacion: string;
  codigoSucursal: string;
  nombreSucursal: string;
  codigoActividadEconomica: string;
  codigoArlAportante: string;
  tipoAportante: string;
  fax: string;
  representanteTipoDocumento: string;
  representanteNumeroDocumento: string;
  representantePrimerApellido: string;
  representanteSegundoApellido: string;
  representantePrimerNombre: string;
  representanteSegundoNombre: string;
  fechaMatriculaMercantil: string;
  beneficioLey1429: string;
  beneficioCcfLey1429: string;
  exoneracionConfirmada: boolean;
  sinAccionEspecial: string;
};

const EMPTY_FORM: PilaEmployerForm = {
  claseAportante: '',
  tipoDocumentoAportante: '',
  naturalezaJuridica: '',
  tipoPersona: '',
  formaPresentacion: '',
  codigoSucursal: '',
  nombreSucursal: '',
  codigoActividadEconomica: '',
  codigoArlAportante: '',
  tipoAportante: '',
  fax: '',
  representanteTipoDocumento: '',
  representanteNumeroDocumento: '',
  representantePrimerApellido: '',
  representanteSegundoApellido: '',
  representantePrimerNombre: '',
  representanteSegundoNombre: '',
  fechaMatriculaMercantil: '',
  beneficioLey1429: '',
  beneficioCcfLey1429: '',
  exoneracionConfirmada: false,
  sinAccionEspecial: '',
};

function toForm(branding: PilaEmployerProfile): PilaEmployerForm {
  const exoneracionConfirmada =
    branding.pilaAportesExoneradosConfirmado !== null &&
    branding.pilaAportesExoneradosConfirmado === branding.aportesExonerados;

  return {
    claseAportante: branding.pilaClaseAportante ?? '',
    tipoDocumentoAportante: branding.pilaTipoDocumentoAportante ?? '',
    naturalezaJuridica: branding.pilaNaturalezaJuridica ?? '',
    tipoPersona: branding.pilaTipoPersona ?? '',
    formaPresentacion: branding.pilaFormaPresentacion ?? '',
    codigoSucursal: branding.pilaCodigoSucursal ?? '',
    nombreSucursal: branding.pilaNombreSucursal ?? '',
    codigoActividadEconomica: branding.pilaCodigoActividadEconomica ?? '',
    codigoArlAportante: branding.pilaCodigoArlAportante ?? '',
    tipoAportante: branding.pilaTipoAportante ?? '',
    fax: branding.pilaFax ?? '',
    representanteTipoDocumento: branding.pilaRepresentanteTipoDocumento ?? '',
    representanteNumeroDocumento: branding.pilaRepresentanteNumeroDocumento ?? '',
    representantePrimerApellido: branding.pilaRepresentantePrimerApellido ?? '',
    representanteSegundoApellido: branding.pilaRepresentanteSegundoApellido ?? '',
    representantePrimerNombre: branding.pilaRepresentantePrimerNombre ?? '',
    representanteSegundoNombre: branding.pilaRepresentanteSegundoNombre ?? '',
    fechaMatriculaMercantil: branding.pilaFechaMatriculaMercantil?.slice(0, 10) ?? '',
    beneficioLey1429:
      branding.pilaBeneficioLey1429 === null ? '' : String(branding.pilaBeneficioLey1429),
    beneficioCcfLey1429:
      branding.pilaBeneficioCcfLey1429 === null ? '' : String(branding.pilaBeneficioCcfLey1429),
    exoneracionConfirmada,
    sinAccionEspecial:
      branding.pilaSinAccionEspecial === null ? '' : String(branding.pilaSinAccionEspecial),
  };
}

function nullableString(value: string) {
  return value.trim() || null;
}

function nullableBoolean(value: string): boolean | null {
  return value === '' ? null : value === 'true';
}

export function PilaEmployerProfileForm() {
  const { data: branding, isLoading, error } = useTenantPilaEmployerProfile();
  const updateMutation = useUpdatePilaEmployerProfile();
  const [form, setForm] = useState<PilaEmployerForm>(EMPTY_FORM);

  useEffect(() => {
    if (branding) setForm(toForm(branding));
  }, [branding]);

  function update<K extends keyof PilaEmployerForm>(key: K, value: PilaEmployerForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function save() {
    if (!branding) return;
    updateMutation.mutate({
      pilaClaseAportante: nullableString(form.claseAportante),
      pilaTipoDocumentoAportante: nullableString(form.tipoDocumentoAportante),
      pilaNaturalezaJuridica: nullableString(form.naturalezaJuridica),
      pilaTipoPersona: nullableString(form.tipoPersona),
      pilaFormaPresentacion: nullableString(form.formaPresentacion),
      pilaCodigoSucursal:
        form.formaPresentacion === 'S' ? nullableString(form.codigoSucursal) : null,
      pilaNombreSucursal:
        form.formaPresentacion === 'S' ? nullableString(form.nombreSucursal) : null,
      pilaCodigoActividadEconomica: nullableString(form.codigoActividadEconomica),
      pilaCodigoArlAportante: nullableString(form.codigoArlAportante),
      pilaTipoAportante: nullableString(form.tipoAportante),
      pilaFax: nullableString(form.fax),
      pilaRepresentanteTipoDocumento: nullableString(form.representanteTipoDocumento),
      pilaRepresentanteNumeroDocumento: nullableString(form.representanteNumeroDocumento),
      pilaRepresentantePrimerApellido: nullableString(form.representantePrimerApellido),
      pilaRepresentanteSegundoApellido: nullableString(form.representanteSegundoApellido),
      pilaRepresentantePrimerNombre: nullableString(form.representantePrimerNombre),
      pilaRepresentanteSegundoNombre: nullableString(form.representanteSegundoNombre),
      pilaFechaMatriculaMercantil: nullableString(form.fechaMatriculaMercantil),
      pilaBeneficioLey1429: nullableBoolean(form.beneficioLey1429),
      pilaBeneficioCcfLey1429: nullableBoolean(form.beneficioCcfLey1429),
      pilaAportesExoneradosConfirmado: form.exoneracionConfirmada
        ? branding.aportesExonerados
        : null,
      pilaSinAccionEspecial: nullableBoolean(form.sinAccionEspecial),
    });
  }

  const fields = 'grid gap-4 sm:grid-cols-2';
  const field = 'space-y-1.5';

  if (isLoading) {
    return <div className="h-72 animate-pulse rounded-xl border border-border bg-surface" />;
  }

  if (!branding) {
    return (
      <Alert className="py-3 text-sm">
        {error?.message ?? 'No se pudieron cargar los datos del aportante para PILA.'}
      </Alert>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <div className="mb-5">
        <h2 className="text-sm font-semibold text-foreground">Datos del aportante para PILA</h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Registra los datos confirmados por la empresa para el archivo de aportante. Se congelan al
          liquidar y aprobar nómina. Un dato guardado no significa que el formato esté validado ni
          que un operador acepte el archivo.
        </p>
      </div>

      <div className="space-y-5">
        <div className={fields}>
          <SelectField
            id="pila-clase-aportante"
            label="Clase de aportante"
            value={form.claseAportante}
            onChange={(value) => update('claseAportante', value)}
            options={[
              ['', 'Sin declarar'],
              ['A', 'A — 200 o más cotizantes'],
              ['B', 'B — menos de 200 cotizantes'],
              ['C', 'C — clase especial, pendiente de validar'],
              ['D', 'D — beneficio Ley 1429, pendiente de validar'],
            ]}
          />
          <div className={field}>
            <Label htmlFor="pila-tipo-documento">Documento del aportante</Label>
            <Select
              id="pila-tipo-documento"
              value={form.tipoDocumentoAportante}
              onChange={(event) => update('tipoDocumentoAportante', event.target.value)}
            >
              <option value="">Sin confirmar</option>
              <option value="NI">NIT</option>
            </Select>
          </div>
          <div className={field}>
            <Label htmlFor="pila-tipo-aportante">Tipo de aportante</Label>
            <Select
              id="pila-tipo-aportante"
              value={form.tipoAportante}
              onChange={(event) => update('tipoAportante', event.target.value)}
            >
              <option value="">Sin confirmar</option>
              <option value="1">Empleador</option>
            </Select>
          </div>
          <div className={field}>
            <Label htmlFor="pila-naturaleza">Naturaleza jurídica</Label>
            <Select
              id="pila-naturaleza"
              value={form.naturalezaJuridica}
              onChange={(event) => update('naturalezaJuridica', event.target.value)}
            >
              <option value="">Sin declarar</option>
              <option value="1">Pública</option>
              <option value="2">Privada</option>
              <option value="3">Mixta</option>
              <option value="4">Organismo multilateral</option>
              <option value="5">Entidad pública no sometida a legislación colombiana</option>
            </Select>
          </div>
          <div className={field}>
            <Label htmlFor="pila-tipo-persona">Tipo de persona</Label>
            <Select
              id="pila-tipo-persona"
              value={form.tipoPersona}
              onChange={(event) => update('tipoPersona', event.target.value)}
            >
              <option value="">Sin declarar</option>
              <option value="J">Jurídica</option>
              <option value="N">Natural</option>
            </Select>
          </div>
          <div className={field}>
            <Label htmlFor="pila-presentacion">Forma de presentación</Label>
            <Select
              id="pila-presentacion"
              value={form.formaPresentacion}
              onChange={(event) => update('formaPresentacion', event.target.value)}
            >
              <option value="">Sin declarar</option>
              <option value="U">Única</option>
              <option value="S">Por sucursal</option>
            </Select>
          </div>
          <div className={field}>
            <Label htmlFor="pila-ciiu">Actividad económica CIIU (4 dígitos)</Label>
            <Input
              id="pila-ciiu"
              inputMode="numeric"
              maxLength={4}
              value={form.codigoActividadEconomica}
              onChange={(event) => update('codigoActividadEconomica', event.target.value)}
              placeholder="Según RUT"
            />
          </div>
          <div className={field}>
            <Label htmlFor="pila-arl-aportante">Código ARL del aportante</Label>
            <Input
              id="pila-arl-aportante"
              maxLength={16}
              value={form.codigoArlAportante}
              onChange={(event) => update('codigoArlAportante', event.target.value)}
            />
          </div>
          <div className={field}>
            <Label htmlFor="pila-fax">Fax (opcional)</Label>
            <Input
              id="pila-fax"
              inputMode="numeric"
              maxLength={10}
              value={form.fax}
              onChange={(event) => update('fax', event.target.value)}
            />
          </div>
          {form.formaPresentacion === 'S' && (
            <>
              <div className={field}>
                <Label htmlFor="pila-sucursal-codigo">Código PILA de sucursal</Label>
                <Input
                  id="pila-sucursal-codigo"
                  maxLength={10}
                  value={form.codigoSucursal}
                  onChange={(event) => update('codigoSucursal', event.target.value)}
                />
              </div>
              <div className={field}>
                <Label htmlFor="pila-sucursal-nombre">Nombre PILA de sucursal</Label>
                <Input
                  id="pila-sucursal-nombre"
                  maxLength={40}
                  value={form.nombreSucursal}
                  onChange={(event) => update('nombreSucursal', event.target.value)}
                />
              </div>
            </>
          )}
        </div>

        {form.tipoPersona === 'J' && (
          <div className="border-t border-border pt-5">
            <h3 className="mb-3 text-xs font-semibold text-foreground">
              Representante legal para PILA
            </h3>
            <div className={fields}>
              <div className={field}>
                <Label htmlFor="pila-rep-tipo-doc">Tipo de documento</Label>
                <Input
                  id="pila-rep-tipo-doc"
                  maxLength={2}
                  value={form.representanteTipoDocumento}
                  onChange={(event) =>
                    update('representanteTipoDocumento', event.target.value.toUpperCase())
                  }
                  placeholder="Ej. CC"
                />
              </div>
              <TextField
                id="pila-rep-documento"
                label="Número de documento"
                value={form.representanteNumeroDocumento}
                maxLength={16}
                onChange={(value) => update('representanteNumeroDocumento', value)}
              />
              <TextField
                id="pila-rep-primer-apellido"
                label="Primer apellido"
                value={form.representantePrimerApellido}
                maxLength={20}
                onChange={(value) => update('representantePrimerApellido', value)}
              />
              <TextField
                id="pila-rep-segundo-apellido"
                label="Segundo apellido"
                value={form.representanteSegundoApellido}
                maxLength={30}
                onChange={(value) => update('representanteSegundoApellido', value)}
              />
              <TextField
                id="pila-rep-primer-nombre"
                label="Primer nombre"
                value={form.representantePrimerNombre}
                maxLength={20}
                onChange={(value) => update('representantePrimerNombre', value)}
              />
              <TextField
                id="pila-rep-segundo-nombre"
                label="Segundo nombre"
                value={form.representanteSegundoNombre}
                maxLength={30}
                onChange={(value) => update('representanteSegundoNombre', value)}
              />
            </div>
          </div>
        )}

        <div className="grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
          <SelectField
            id="pila-ley-1429"
            label="¿Aplica el beneficio de Ley 1429?"
            value={form.beneficioLey1429}
            onChange={(value) => update('beneficioLey1429', value)}
            options={[
              ['', 'Sin declarar'],
              ['false', 'No'],
              ['true', 'Sí'],
            ]}
          />
          {form.beneficioLey1429 === 'true' && (
            <div className={field}>
              <Label htmlFor="pila-fecha-matricula">Fecha de matrícula mercantil</Label>
              <Input
                id="pila-fecha-matricula"
                type="date"
                value={form.fechaMatriculaMercantil}
                onChange={(event) => update('fechaMatriculaMercantil', event.target.value)}
              />
            </div>
          )}
          <SelectField
            id="pila-ccf-ley-1429"
            label="Beneficio CCF de Ley 1429"
            value={form.beneficioCcfLey1429}
            onChange={(value) => update('beneficioCcfLey1429', value)}
            options={[
              ['', 'Sin declarar'],
              ['false', 'No'],
              ['true', 'Sí'],
            ]}
          />
          <SelectField
            id="pila-accion-especial"
            label="¿Hay acción especial del aportante?"
            value={form.sinAccionEspecial}
            onChange={(value) => update('sinAccionEspecial', value)}
            options={[
              ['', 'Sin declarar'],
              ['true', 'No aplica; confirmar código 0'],
              ['false', 'Sí aplica; exportación aún no soportada'],
            ]}
          />
          <label className="flex items-start gap-2 text-xs leading-5 text-muted-foreground sm:col-span-2">
            <input
              type="checkbox"
              checked={form.exoneracionConfirmada}
              onChange={(event) => update('exoneracionConfirmada', event.target.checked)}
              className="mt-0.5"
            />
            Confirmo el dato actual de nómina sobre exoneración de salud patronal, SENA e ICBF:{' '}
            {branding.aportesExonerados ? 'exonerado' : 'no exonerado'}.
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={save} disabled={updateMutation.isPending}>
            {updateMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Guardar datos PILA
          </Button>
          {updateMutation.isSuccess && (
            <span className="flex items-center gap-1.5 text-xs text-success">
              <CheckCircle2 className="size-4" /> Datos guardados.
            </span>
          )}
          {updateMutation.error && (
            <Alert className="py-2 text-xs">{updateMutation.error.message}</Alert>
          )}
        </div>
      </div>
    </section>
  );
}

function TextField({
  id,
  label,
  value,
  maxLength,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  maxLength: number;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function SelectField({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue || 'empty'} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </Select>
    </div>
  );
}
