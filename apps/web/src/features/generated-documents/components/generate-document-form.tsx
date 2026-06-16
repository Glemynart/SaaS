'use client';

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { SideSheet } from '@/components/ui/side-sheet';
import { useDocumentTemplates } from '@/features/document-templates/hooks/use-document-templates';
import { DOCUMENT_TEMPLATE_TYPE_LABELS } from '@/features/document-templates/schemas/document-template-schemas';
import {
  generateDocumentSchema,
  type GenerateDocumentFormValues,
} from '../schemas/generated-document-schemas';
import type { Employee } from '@/features/employees/services/employees-api';
import { FileText, Loader2 } from 'lucide-react';

interface GenerateDocumentFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee;
  onSubmit: (data: GenerateDocumentFormValues) => void;
  isSubmitting?: boolean;
}

export function GenerateDocumentForm({
  open,
  onOpenChange,
  employee,
  onSubmit,
  isSubmitting = false,
}: GenerateDocumentFormProps) {
  const [selectedTemplateContent, setSelectedTemplateContent] = useState('');
  const { data: templatesData, isLoading: templatesLoading } = useDocumentTemplates({
    limit: 50,
  });

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<GenerateDocumentFormValues>({
    resolver: zodResolver(generateDocumentSchema),
    defaultValues: {
      employeeId: employee.id,
      templateId: '',
      nombre: `Doc. ${employee.nombre} ${employee.apellido}`,
    },
  });

  const watchTemplateId = watch('templateId');

  const handleTemplateSelect = (templateId: string, content: string) => {
    setValue('templateId', templateId, { shouldValidate: true });
    setSelectedTemplateContent(content);
  };

  const templates = templatesData?.data ?? [];

  return (
    <SideSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Generar documento"
      description={`Empleado: ${employee.nombre} ${employee.apellido}`}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex h-full flex-col">
        <div className="flex-1 space-y-5">
          <div className="rounded-lg border border-border bg-surface/50 p-4">
            <span className="text-[0.68rem] font-medium uppercase tracking-wider text-muted-foreground">
              Datos del empleado
            </span>
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <span className="text-muted-foreground">Documento:</span>
              <span className="text-foreground">
                {employee.tipoDocumento} {employee.cedula}
              </span>
              <span className="text-muted-foreground">Cargo:</span>
              <span className="text-foreground">{employee.cargo}</span>
              <span className="text-muted-foreground">Tipo contrato:</span>
              <span className="text-foreground">{employee.tipoContrato.replace(/_/g, ' ')}</span>
              <span className="text-muted-foreground">Salario:</span>
              <span className="text-foreground">
                {new Intl.NumberFormat('es-CO', {
                  style: 'currency',
                  currency: 'COP',
                  minimumFractionDigits: 0,
                }).format(employee.salario)}
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nombre">Nombre del documento</Label>
            <Input id="nombre" {...register('nombre')} placeholder="Ej: Contrato laboral 2026" />
            {errors.nombre && <p className="text-xs text-destructive">{errors.nombre.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Seleccionar plantilla</Label>

            {templatesLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
                ))}
              </div>
            ) : templates.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-8 text-center">
                <FileText className="mb-2 size-6 text-muted-foreground/40" />
                <p className="text-xs text-muted-foreground">No hay plantillas disponibles</p>
                <p className="mt-1 text-[0.68rem] text-muted-foreground/60">
                  Creá plantillas en Documentos → Plantillas
                </p>
              </div>
            ) : (
              <Controller
                name="templateId"
                control={control}
                render={() => (
                  <div className="-mx-1 max-h-64 space-y-1 overflow-y-auto px-1">
                    {templates.map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => handleTemplateSelect(tpl.id, tpl.contenido)}
                        className={`w-full rounded-lg border p-3 text-left transition-colors ${
                          watchTemplateId === tpl.id
                            ? 'border-accent bg-accent/5'
                            : 'border-border hover:border-accent/40 hover:bg-muted/40'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-foreground">{tpl.nombre}</span>
                          <Badge className="text-[0.65rem]">
                            {DOCUMENT_TEMPLATE_TYPE_LABELS[tpl.tipo] ?? tpl.tipo}
                          </Badge>
                        </div>
                        {tpl.descripcion && (
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {tpl.descripcion}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              />
            )}
            {errors.templateId && (
              <p className="text-xs text-destructive">{errors.templateId.message}</p>
            )}
          </div>

          {selectedTemplateContent && (
            <div className="space-y-2">
              <Label>Vista previa de la plantilla</Label>
              <div className="max-h-40 overflow-y-auto rounded-lg border border-border bg-white p-4">
                <div className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                  {selectedTemplateContent.length > 600
                    ? selectedTemplateContent.slice(0, 600) + '...'
                    : selectedTemplateContent}
                </div>
              </div>
            </div>
          )}
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
            Generar documento
          </Button>
        </div>
      </form>
    </SideSheet>
  );
}
