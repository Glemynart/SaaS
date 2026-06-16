'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TemplatesTable } from '@/features/document-templates/components/templates-table';
import { TemplateForm } from '@/features/document-templates/components/template-form';
import {
  useDocumentTemplates,
  useCreateDocumentTemplate,
  useUpdateDocumentTemplate,
  useDeleteDocumentTemplate,
  useDuplicateDocumentTemplate,
  useToggleDocumentTemplate,
  useSeedDefaultTemplates,
} from '@/features/document-templates/hooks/use-document-templates';
import type {
  DocumentTemplate,
  GetDocumentTemplatesParams,
} from '@/features/document-templates/services/document-templates-api';
import type { DocumentTemplateFormValues } from '@/features/document-templates/schemas/document-template-schemas';
import { DOCUMENT_TEMPLATE_TYPE_LABELS } from '@/features/document-templates/schemas/document-template-schemas';
import { Loader2 } from 'lucide-react';

export default function PlantillasPage() {
  const router = useRouter();
  const [filters, setFilters] = useState<GetDocumentTemplatesParams>({ page: 1, limit: 30 });
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<DocumentTemplate | undefined>(undefined);

  const { data, isLoading } = useDocumentTemplates(filters);
  const createMutation = useCreateDocumentTemplate();
  const updateMutation = useUpdateDocumentTemplate();
  const deleteMutation = useDeleteDocumentTemplate();
  const duplicateMutation = useDuplicateDocumentTemplate();
  const toggleMutation = useToggleDocumentTemplate();
  const seedMutation = useSeedDefaultTemplates();

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    setFilters((prev) => ({ ...prev, search: value || undefined, page: 1 }));
  }, []);

  const handleTipoFilter = useCallback((tipo: string) => {
    setFilters((prev) => ({
      ...prev,
      tipo: tipo ? (tipo as GetDocumentTemplatesParams['tipo']) : undefined,
      page: 1,
    }));
  }, []);

  const handleCreate = useCallback(() => {
    setEditingTemplate(undefined);
    setDrawerOpen(true);
  }, []);

  const handleEdit = useCallback((template: DocumentTemplate) => {
    setEditingTemplate(template);
    setDrawerOpen(true);
  }, []);

  const handleDelete = useCallback((id: string) => deleteMutation.mutate(id), [deleteMutation]);

  const handleView = useCallback(
    (id: string) => router.push(`/documentos/plantillas/${id}`),
    [router],
  );

  const handleDuplicate = useCallback(
    (id: string) => duplicateMutation.mutate({ id }),
    [duplicateMutation],
  );

  const handleToggleActive = useCallback(
    (id: string) => toggleMutation.mutate(id),
    [toggleMutation],
  );

  const handleSeed = useCallback(() => {
    if (
      confirm('¿Crear las 4 plantillas base sugeridas (Contrato, Certificación, Carta, Memorando)?')
    ) {
      seedMutation.mutate();
    }
  }, [seedMutation]);

  const handleSubmit = useCallback(
    (formData: DocumentTemplateFormValues) => {
      if (editingTemplate) {
        updateMutation.mutate(
          { id: editingTemplate.id, data: formData },
          { onSuccess: () => setDrawerOpen(false) },
        );
      } else {
        createMutation.mutate(formData, { onSuccess: () => setDrawerOpen(false) });
      }
    },
    [editingTemplate, createMutation, updateMutation],
  );

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8">
        <h1 className="text-lg font-semibold tracking-[-0.018em] text-foreground">
          Plantillas de documentos
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Editor enriquecido con variables dinámicas para contratos, certificaciones, cartas y
          memorandos.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Input
          placeholder="Buscar plantillas..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="max-w-[14rem]"
        />

        <select
          value={filters.tipo ?? ''}
          onChange={(e) => handleTipoFilter(e.target.value)}
          className="flex h-10 rounded-md border border-border bg-white px-3 py-2 text-sm text-muted-foreground transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        >
          <option value="">Todos los tipos</option>
          {Object.entries(DOCUMENT_TEMPLATE_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <div className="flex-1" />

        <Button
          variant="outline"
          size="sm"
          onClick={handleSeed}
          disabled={seedMutation.isPending}
          className="gap-1.5 text-xs"
        >
          {seedMutation.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Sparkles className="size-3.5" />
          )}
          Plantillas base
        </Button>

        <Button onClick={handleCreate} className="gap-1.5" size="sm">
          <Plus className="size-4" />
          Nueva plantilla
        </Button>
      </div>

      <TemplatesTable
        templates={data?.data ?? []}
        isLoading={isLoading}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onView={handleView}
        onDuplicate={handleDuplicate}
        onToggleActive={handleToggleActive}
      />

      <TemplateForm
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        defaultValues={editingTemplate}
      />
    </div>
  );
}
