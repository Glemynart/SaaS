'use client';

import { useState, useCallback, useEffect } from 'react';
import { AlertTriangle, FileText, Loader2, Plus, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterBar } from '@/components/ui/filter-bar';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
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

export default function PlantillasPage() {
  const [filters, setFilters] = useState<GetDocumentTemplatesParams>({ page: 1, limit: 30 });
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<DocumentTemplate | undefined>(undefined);
  const [seedConfirmOpen, setSeedConfirmOpen] = useState(false);

  const { data, isLoading, isError, refetch } = useDocumentTemplates(filters);
  const createMutation = useCreateDocumentTemplate();
  const updateMutation = useUpdateDocumentTemplate();
  const deleteMutation = useDeleteDocumentTemplate();
  const duplicateMutation = useDuplicateDocumentTemplate();
  const toggleMutation = useToggleDocumentTemplate();
  const seedMutation = useSeedDefaultTemplates();

  const hasFilters = Boolean(filters.search || filters.tipo);

  // Debounce search — cambiar un filtro regresa a la primera página.
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) => ({ ...prev, search: search || undefined, page: 1 }));
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const handleTipoFilter = useCallback((tipo: string) => {
    setFilters((prev) => ({
      ...prev,
      tipo: tipo ? (tipo as GetDocumentTemplatesParams['tipo']) : undefined,
      page: 1,
    }));
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  }, []);

  const handleCreate = useCallback(() => {
    setEditingTemplate(undefined);
    setDrawerOpen(true);
  }, []);

  const handleEdit = useCallback((template: DocumentTemplate) => {
    setEditingTemplate(template);
    setDrawerOpen(true);
  }, []);

  const handleDelete = useCallback(
    (id: string) =>
      deleteMutation.mutate(id, {
        onSuccess: () => toast.success('Plantilla eliminada.'),
        onError: () => toast.error('No se pudo eliminar la plantilla. Inténtalo de nuevo.'),
      }),
    [deleteMutation],
  );

  const handleDuplicate = useCallback(
    (id: string) =>
      duplicateMutation.mutate(
        { id },
        {
          onSuccess: () => toast.success('Plantilla duplicada.'),
          onError: () => toast.error('No se pudo duplicar la plantilla. Inténtalo de nuevo.'),
        },
      ),
    [duplicateMutation],
  );

  const handleToggleActive = useCallback(
    (id: string) =>
      toggleMutation.mutate(id, {
        onError: () => toast.error('No se pudo cambiar el estado de la plantilla.'),
      }),
    [toggleMutation],
  );

  const handleSeed = useCallback(() => {
    seedMutation.mutate(undefined, {
      onSuccess: (result) => toast.success(result.message ?? 'Plantillas base creadas.'),
      onError: () => toast.error('No se pudieron crear las plantillas base.'),
    });
  }, [seedMutation]);

  const handleSubmit = useCallback(
    (formData: DocumentTemplateFormValues) => {
      if (editingTemplate) {
        updateMutation.mutate(
          { id: editingTemplate.id, data: formData },
          {
            onSuccess: () => {
              setDrawerOpen(false);
              toast.success('Cambios guardados.');
            },
            onError: () => toast.error('No se pudieron guardar los cambios. Inténtalo de nuevo.'),
          },
        );
      } else {
        createMutation.mutate(formData, {
          onSuccess: () => {
            setDrawerOpen(false);
            toast.success('Plantilla creada.');
          },
          onError: () => toast.error('No se pudo crear la plantilla. Inténtalo de nuevo.'),
        });
      }
    },
    [editingTemplate, createMutation, updateMutation],
  );

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <PageHeader
      title="Plantillas de documentos"
      description="Editor enriquecido con variables dinámicas para contratos, certificaciones, cartas y memorandos."
      width="wide"
      actions={
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSeedConfirmOpen(true)}
            disabled={seedMutation.isPending}
          >
            {seedMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="size-4" aria-hidden="true" />
            )}
            Plantillas base
          </Button>
          <Button size="sm" onClick={handleCreate}>
            <Plus className="size-4" aria-hidden="true" />
            Nueva plantilla
          </Button>
        </>
      }
    >
      <FilterBar
        className="mb-6"
        search={
          <Input
            type="search"
            placeholder="Buscar plantillas…"
            aria-label="Buscar plantillas"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        }
      >
        <Select
          aria-label="Filtrar por tipo"
          value={filters.tipo ?? ''}
          onChange={(e) => handleTipoFilter(e.target.value)}
          className="sm:w-44"
        >
          <option value="">Todos los tipos</option>
          {Object.entries(DOCUMENT_TEMPLATE_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </FilterBar>

      {isError ? (
        <EmptyState
          icon={AlertTriangle}
          title="No pudimos cargar las plantillas."
          description="Revisa tu conexión e inténtalo de nuevo."
          action={
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Reintentar
            </Button>
          }
        />
      ) : (
        <>
          <TemplatesTable
            templates={data?.data ?? []}
            isLoading={isLoading}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onDuplicate={handleDuplicate}
            onToggleActive={handleToggleActive}
            empty={
              hasFilters ? (
                <EmptyState
                  title="Sin resultados para esta búsqueda."
                  description="Ajusta la búsqueda o el filtro de tipo para ver más plantillas."
                />
              ) : (
                <EmptyState
                  icon={FileText}
                  title="Aún no hay plantillas."
                  description="Crea tu primera plantilla o usa las plantillas base sugeridas."
                  action={
                    <Button size="sm" onClick={handleCreate}>
                      <Plus className="size-4" aria-hidden="true" />
                      Nueva plantilla
                    </Button>
                  }
                />
              )
            }
          />

          {data?.meta && (
            <Pagination
              className="mt-4"
              page={data.meta.page}
              totalPages={data.meta.totalPages}
              total={data.meta.total}
              itemLabel="plantillas"
              onPageChange={handlePageChange}
            />
          )}
        </>
      )}

      <TemplateForm
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        defaultValues={editingTemplate}
      />

      <ConfirmDialog
        level={1}
        open={seedConfirmOpen}
        onOpenChange={setSeedConfirmOpen}
        title="Crear plantillas base"
        description="Se crearán las 4 plantillas base sugeridas: Contrato, Certificación, Carta y Memorando. Podrás editarlas o eliminarlas después."
        confirmLabel="Crear plantillas base"
        confirmVariant="default"
        onConfirm={() => {
          handleSeed();
          setSeedConfirmOpen(false);
        }}
      />
    </PageHeader>
  );
}
