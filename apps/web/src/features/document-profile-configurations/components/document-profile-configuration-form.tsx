'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { ContractualProfile } from '@/features/contractual-profiles/services/contractual-profiles-api';
import {
  type DocumentTemplate,
  type DocumentTemplateType,
} from '@/features/document-templates/services/document-templates-api';
import { DOCUMENT_TEMPLATE_TYPE_LABELS } from '@/features/document-templates/schemas/document-template-schemas';
import type { DocumentProfileConfiguration } from '../services/document-profile-configurations-api';

export interface DocumentProfileConfigurationFormValues {
  perfilContractualId: string;
  tipoDocumental: DocumentTemplateType;
  plantillaId: string;
  vigenteDesde: string;
  vigenteHasta: string;
  activo: boolean;
}

interface DocumentProfileConfigurationFormProps {
  profiles: ContractualProfile[];
  templates: DocumentTemplate[];
  initialData?: DocumentProfileConfiguration;
  onSubmit: (values: DocumentProfileConfigurationFormValues) => void;
  isLoading?: boolean;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function inputDate(value: string | null | undefined) {
  return value ? value.slice(0, 10) : '';
}

export function DocumentProfileConfigurationForm({
  profiles,
  templates,
  initialData,
  onSubmit,
  isLoading = false,
}: DocumentProfileConfigurationFormProps) {
  const [values, setValues] = useState<DocumentProfileConfigurationFormValues>({
    perfilContractualId: '',
    tipoDocumental: 'CONTRACT',
    plantillaId: '',
    vigenteDesde: today(),
    vigenteHasta: '',
    activo: true,
  });

  useEffect(() => {
    setValues({
      perfilContractualId: initialData?.perfilContractualId ?? profiles[0]?.id ?? '',
      tipoDocumental: initialData?.tipoDocumental ?? 'CONTRACT',
      plantillaId: initialData?.plantillaId ?? '',
      vigenteDesde: inputDate(initialData?.vigenteDesde) || today(),
      vigenteHasta: inputDate(initialData?.vigenteHasta),
      activo: initialData?.activo ?? true,
    });
  }, [initialData, profiles]);

  const matchingTemplates = useMemo(
    () =>
      templates.filter(
        (template) =>
          template.tipo === values.tipoDocumental &&
          (template.activo || template.id === initialData?.plantillaId),
      ),
    [initialData?.plantillaId, templates, values.tipoDocumental],
  );

  function update(field: keyof DocumentProfileConfigurationFormValues, value: string | boolean) {
    setValues(
      (current) => ({ ...current, [field]: value }) as DocumentProfileConfigurationFormValues,
    );
  }

  function updateType(value: DocumentTemplateType) {
    setValues((current) => ({
      ...current,
      tipoDocumental: value,
      plantillaId:
        current.plantillaId &&
        templates.some((template) => template.id === current.plantillaId && template.tipo === value)
          ? current.plantillaId
          : '',
    }));
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(values);
      }}
    >
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-foreground">Regla documental</legend>

        <FormField
          label="Perfil contractual"
          required
          hint="La regla se aplica al vínculo precontractual vigente."
        >
          <Select
            value={values.perfilContractualId}
            onChange={(event) => update('perfilContractualId', event.target.value)}
            disabled={Boolean(initialData) || isLoading}
            required
          >
            <option value="">Selecciona un perfil</option>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.nombre} ({profile.codigo})
              </option>
            ))}
          </Select>
        </FormField>

        <FormField
          label="Tipo documental"
          required
          hint="Determina el tipo de plantilla compatible."
        >
          <Select
            value={values.tipoDocumental}
            onChange={(event) => updateType(event.target.value as DocumentTemplateType)}
            disabled={Boolean(initialData) || isLoading}
            required
          >
            {Object.entries(DOCUMENT_TEMPLATE_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="Plantilla" required>
          <Select
            value={values.plantillaId}
            onChange={(event) => update('plantillaId', event.target.value)}
            disabled={isLoading}
            required
          >
            <option value="">Selecciona una plantilla</option>
            {matchingTemplates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.nombre}
                {!template.activo ? ' — inactiva' : ''}
              </option>
            ))}
          </Select>
        </FormField>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-1 text-sm font-semibold text-foreground sm:col-span-2">
          Vigencia
        </legend>
        <FormField label="Vigente desde" required>
          <Input
            type="date"
            value={values.vigenteDesde}
            onChange={(event) => update('vigenteDesde', event.target.value)}
            disabled={isLoading}
            required
          />
        </FormField>
        <FormField label="Vigente hasta" hint="Déjalo vacío para una regla sin fecha final.">
          <Input
            type="date"
            value={values.vigenteHasta}
            onChange={(event) => update('vigenteHasta', event.target.value)}
            disabled={isLoading}
          />
        </FormField>
      </fieldset>

      <label className="flex items-start gap-3 rounded-md border border-border-soft bg-canvas p-3 text-sm">
        <input
          type="checkbox"
          checked={values.activo}
          onChange={(event) => update('activo', event.target.checked)}
          disabled={isLoading}
          className="mt-0.5 size-4 accent-[--accent]"
        />
        <span>
          <span className="block font-medium text-foreground">Regla activa</span>
          <span className="block text-xs text-muted-foreground">
            Solo las reglas activas y vigentes participan en la resolución documental.
          </span>
        </span>
      </label>

      <div className="flex justify-end border-t border-border-soft pt-5">
        <Button
          type="submit"
          disabled={
            isLoading ||
            !values.perfilContractualId ||
            !values.plantillaId ||
            matchingTemplates.length === 0
          }
        >
          {isLoading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {initialData ? 'Guardar configuración' : 'Crear configuración'}
        </Button>
      </div>
    </form>
  );
}
