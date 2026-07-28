'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FileText, Loader2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SideSheet } from '@/components/ui/side-sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { useDocumentTemplates } from '@/features/document-templates/hooks/use-document-templates';
import type { DocumentTemplateType } from '@/features/document-templates/services/document-templates-api';
import { DOCUMENT_TEMPLATE_TYPE_LABELS } from '@/features/document-templates/schemas/document-template-schemas';
import {
  generateDocumentSchema,
  type GenerateDocumentFormValues,
} from '../schemas/generated-document-schemas';
import type { Employee } from '@/features/employees/services/employees-api';
import { formatNombreCompleto } from '@saas/types';
import { cn } from '@/lib/utils';

interface GenerateDocumentFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee;
  onSubmit: (data: GenerateDocumentFormValues) => void;
  isSubmitting?: boolean;
  templateType?: DocumentTemplateType;
}

function EmployeeDataRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground">{value}</span>
    </>
  );
}

export function GenerateDocumentForm({
  open,
  onOpenChange,
  employee,
  onSubmit,
  isSubmitting = false,
  templateType,
}: GenerateDocumentFormProps) {
  const [selectedTemplateContent, setSelectedTemplateContent] = useState('');
  const { data: templatesData, isLoading: templatesLoading } = useDocumentTemplates({
    limit: 50,
    tipo: templateType,
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<GenerateDocumentFormValues>({
    resolver: zodResolver(generateDocumentSchema),
    defaultValues: {
      employeeId: employee.id,
      templateId: '',
      nombre:
        templateType === 'CERTIFICATION'
          ? `Certificación laboral — ${formatNombreCompleto(employee)}`
          : `Doc. ${formatNombreCompleto(employee)}`,
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
      title={
        templateType === 'CERTIFICATION' ? 'Emitir certificación laboral' : 'Generar documento'
      }
      description={`Empleado: ${formatNombreCompleto(employee)}`}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex h-full flex-col">
        <div className="flex-1 space-y-5">
          <section className="rounded-[--radius-card] border border-border bg-canvas p-4">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Datos del empleado
            </h3>
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <EmployeeDataRow
                label="Documento:"
                value={`${employee.tipoDocumento} ${employee.cedula}`}
              />
              <EmployeeDataRow label="Cargo:" value={employee.cargo} />
              <EmployeeDataRow
                label="Tipo contrato:"
                value={employee.tipoContrato.replace(/_/g, ' ')}
              />
              <EmployeeDataRow
                label="Salario:"
                value={new Intl.NumberFormat('es-CO', {
                  style: 'currency',
                  currency: 'COP',
                  minimumFractionDigits: 0,
                }).format(employee.salario)}
              />
              <EmployeeDataRow label="Sede:" value={employee.sedeRef?.nombre ?? '—'} />
            </div>
          </section>

          <FormField label="Nombre del documento" required error={errors.nombre?.message}>
            <Input
              placeholder={
                templateType === 'CERTIFICATION'
                  ? 'Certificación laboral — Juan Pérez'
                  : 'Contrato laboral 2026…'
              }
              {...register('nombre')}
            />
          </FormField>

          <div className="space-y-2">
            <Label>Seleccionar plantilla</Label>

            {templatesLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : templates.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-[--radius-card] border border-dashed border-border bg-canvas py-8 text-center">
                <FileText className="mb-2 size-6 text-muted-foreground" aria-hidden="true" />
                <p className="text-xs text-muted-foreground">No hay plantillas disponibles.</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Crea plantillas en Documentos → Plantillas.
                </p>
              </div>
            ) : (
              <div
                role="radiogroup"
                aria-label="Seleccionar plantilla"
                className="-mx-1 max-h-64 space-y-1 overflow-y-auto px-1"
              >
                {templates.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    role="radio"
                    aria-checked={watchTemplateId === tpl.id}
                    onClick={() => handleTemplateSelect(tpl.id, tpl.contenido)}
                    className={cn(
                      'w-full rounded-[--radius-card] border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      watchTemplateId === tpl.id
                        ? 'border-ring bg-primary/5'
                        : 'border-border hover:bg-muted/40',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-sm font-medium text-foreground">
                        {tpl.nombre}
                      </span>
                      <Badge>{DOCUMENT_TEMPLATE_TYPE_LABELS[tpl.tipo] ?? tpl.tipo}</Badge>
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
            {errors.templateId && (
              <p className="text-xs text-destructive">{errors.templateId.message}</p>
            )}
          </div>

          {selectedTemplateContent && (
            <div className="space-y-2">
              <Label>Vista previa de la plantilla</Label>
              <div className="max-h-40 overflow-y-auto rounded-[--radius-card] border border-border bg-surface p-4">
                <div className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                  {selectedTemplateContent.length > 600
                    ? selectedTemplateContent.slice(0, 600) + '…'
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
            {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {templateType === 'CERTIFICATION' ? 'Emitir certificación' : 'Generar documento'}
          </Button>
        </div>
      </form>
    </SideSheet>
  );
}
