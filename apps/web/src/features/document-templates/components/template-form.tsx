'use client';

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SideSheet } from '@/components/ui/side-sheet';
import { RichTextEditor } from './rich-text-editor';
import {
  documentTemplateSchema,
  type DocumentTemplateFormValues,
  DOCUMENT_TEMPLATE_TYPE_LABELS,
} from '../schemas/document-template-schemas';
import type { DocumentTemplate, DocumentTemplateType } from '../services/document-templates-api';
import { Eye, Loader2 } from 'lucide-react';

function renderHtmlWithVariables(html: string) {
  if (!html) return '<span class="text-muted">Sin contenido</span>';
  return html.replace(
    /\{\{([A-Z_]+)\}\}/g,
    '<span style="display:inline-block;border-radius:4px;background:var(--color-muted);padding:0 4px;font-family:monospace;font-size:0.75rem;font-weight:500;color:var(--color-primary)">{{$1}}</span>',
  );
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

  const contenido = watch('contenido');
  const isEditing = !!defaultValues;

  return (
    <SideSheet
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? 'Editar plantilla' : 'Nueva plantilla'}
      description="Usá el editor enriquecido e insertá variables dinámicas"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex h-full flex-col">
        <div className="flex-1 space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="nombre">Nombre</Label>
            <Input
              id="nombre"
              placeholder="Ej: Contrato laboral estándar"
              {...register('nombre')}
            />
            {errors.nombre && <p className="text-xs text-destructive">{errors.nombre.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="descripcion">Descripción</Label>
            <Input
              id="descripcion"
              placeholder="Describe brevemente esta plantilla"
              {...register('descripcion')}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tipo">Tipo de documento</Label>
            <Controller
              name="tipo"
              control={control}
              render={({ field }) => (
                <select
                  id="tipo"
                  value={field.value}
                  onChange={field.onChange}
                  className="flex h-10 w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  {(
                    Object.entries(DOCUMENT_TEMPLATE_TYPE_LABELS) as [
                      DocumentTemplateType,
                      string,
                    ][]
                  ).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              )}
            />
          </div>

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
                <Eye className="size-3" />
                {showPreview ? 'Editar' : 'Vista previa'}
              </Button>
            </div>

            {showPreview ? (
              <div className="document-preview min-h-[16rem] rounded-lg border border-border bg-white p-6 shadow-sm">
                {contenido ? (
                  <div
                    className="text-sm leading-relaxed text-foreground"
                    dangerouslySetInnerHTML={{ __html: renderHtmlWithVariables(contenido) }}
                  />
                ) : (
                  <span className="text-sm italic text-muted-foreground/50">Sin contenido</span>
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
                    placeholder="Escribí el contenido del documento... Usá el selector + Variable para insertar datos dinámicos."
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
            {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
            {isEditing ? 'Guardar cambios' : 'Crear plantilla'}
          </Button>
        </div>
      </form>
    </SideSheet>
  );
}
