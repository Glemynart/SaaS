'use client';

import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SafeDocumentHtml } from '@/components/security/safe-document-html';
import { Select } from '@/components/ui/select';
import { SideSheet } from '@/components/ui/side-sheet';
import { RichTextEditor } from './rich-text-editor';
import {
  documentTemplateSchema,
  type DocumentTemplateFormValues,
  DOCUMENT_TEMPLATE_TYPE_LABELS,
} from '../schemas/document-template-schemas';
import type { DocumentTemplate } from '../services/document-templates-api';

function renderHtmlWithVariables(html: string) {
  if (!html) return '<span class="text-muted">Sin contenido</span>';
  return html.replace(/\{\{([A-Z_]+)\}\}/g, '<span data-document-variable="true">{{$1}}</span>');
}

interface TemplateFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: DocumentTemplateFormValues) => void;
  isSubmitting?: boolean;
  defaultValues?: DocumentTemplate;
}

export function TemplateForm({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting = false,
  defaultValues,
}: TemplateFormProps) {
  const [showPreview, setShowPreview] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<DocumentTemplateFormValues>({
    resolver: zodResolver(documentTemplateSchema),
    defaultValues: {
      nombre: defaultValues?.nombre ?? '',
      descripcion: defaultValues?.descripcion ?? '',
      tipo: defaultValues?.tipo ?? 'CONTRACT',
      contenido: defaultValues?.contenido ?? '',
    },
  });

  // Al abrir, sincroniza el formulario con la plantilla en edición (o lo
  // limpia para crear) — mismo patrón reset-on-open de Empleados/Sedes.
  useEffect(() => {
    if (!open) return;
    setShowPreview(false);
    reset({
      nombre: defaultValues?.nombre ?? '',
      descripcion: defaultValues?.descripcion ?? '',
      tipo: defaultValues?.tipo ?? 'CONTRACT',
      contenido: defaultValues?.contenido ?? '',
    });
  }, [open, defaultValues, reset]);

  const contenido = watch('contenido');
  const isEditing = !!defaultValues;

  return (
    <SideSheet
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? 'Editar plantilla' : 'Nueva plantilla'}
      description="Usa el editor enriquecido e inserta variables dinámicas."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex h-full flex-col">
        <div className="flex-1 space-y-5">
          <FormField label="Nombre" required error={errors.nombre?.message}>
            <Input placeholder="Contrato laboral estándar…" {...register('nombre')} />
          </FormField>

          <FormField
            label="Descripción"
            error={errors.descripcion?.message}
            hint="Opcional. Ayuda a identificar la plantilla en el listado."
          >
            <Input placeholder="Describe brevemente esta plantilla…" {...register('descripcion')} />
          </FormField>

          <FormField label="Tipo de documento" required error={errors.tipo?.message}>
            <Select {...register('tipo')}>
              {Object.entries(DOCUMENT_TEMPLATE_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </FormField>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Contenido del documento</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowPreview(!showPreview)}
                className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <Eye className="size-3" aria-hidden="true" />
                {showPreview ? 'Editar' : 'Vista previa'}
              </Button>
            </div>

            {showPreview ? (
              <div className="document-preview min-h-[16rem] rounded-[--radius-card] border border-border bg-surface p-6 shadow-[--shadow-card]">
                {contenido ? (
                  <SafeDocumentHtml
                    className="text-sm leading-relaxed text-foreground"
                    html={renderHtmlWithVariables(contenido)}
                  />
                ) : (
                  <span className="text-sm italic text-muted-foreground">Sin contenido</span>
                )}
              </div>
            ) : (
              <Controller
                name="contenido"
                control={control}
                render={({ field }) => (
                  <RichTextEditor
                    content={field.value}
                    onChange={(html) => setValue('contenido', html, { shouldDirty: true })}
                    placeholder="Escribe el contenido del documento… Usa el selector + Variable para insertar datos dinámicos."
                  />
                )}
              />
            )}
            {errors.contenido && (
              <p className="text-xs text-destructive">{errors.contenido.message}</p>
            )}
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3 border-t border-border pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button type="submit" className="flex-1" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {isEditing ? 'Guardar cambios' : 'Crear plantilla'}
          </Button>
        </div>
      </form>
    </SideSheet>
  );
}
