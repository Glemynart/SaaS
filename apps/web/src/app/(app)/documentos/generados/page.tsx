'use client';

import { useState, useCallback, useEffect } from 'react';
import { AlertTriangle, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterBar } from '@/components/ui/filter-bar';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { GeneratedDocsTable } from '@/features/generated-documents/components/generated-docs-table';
import {
  useGeneratedDocuments,
  useDeleteGeneratedDocument,
} from '@/features/generated-documents/hooks/use-generated-documents';
import type { GetGeneratedDocumentsParams } from '@/features/generated-documents/services/generated-documents-api';
import { DOCUMENT_TEMPLATE_TYPE_LABELS } from '@/features/document-templates/schemas/document-template-schemas';

export default function GeneradosPage() {
  const [filters, setFilters] = useState<GetGeneratedDocumentsParams>({ page: 1, limit: 20 });
  const [search, setSearch] = useState('');

  const { data, isLoading, isError, refetch } = useGeneratedDocuments(filters);
  const deleteMutation = useDeleteGeneratedDocument();

  const hasFilters = Boolean(filters.search || filters.tipo);

  // Debounce search — cambiar un filtro regresa a la primera página.
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) => ({ ...prev, search: search || undefined, page: 1 }));
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const handleTipoFilter = useCallback((tipo: string) => {
    setFilters((prev) => ({ ...prev, tipo: tipo || undefined, page: 1 }));
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      deleteMutation.mutate(id, {
        onSuccess: () => toast.success('Documento eliminado.'),
        onError: () => toast.error('No se pudo eliminar el documento. Inténtalo de nuevo.'),
      });
    },
    [deleteMutation],
  );

  return (
    <PageHeader
      title="Documentos generados"
      description="Historial de documentos generados a partir de plantillas y empleados."
      width="wide"
    >
      <FilterBar
        className="mb-6"
        search={
          <Input
            type="search"
            placeholder="Buscar documentos…"
            aria-label="Buscar documentos generados"
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
          title="No pudimos cargar los documentos."
          description="Revisa tu conexión e inténtalo de nuevo."
          action={
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Reintentar
            </Button>
          }
        />
      ) : (
        <>
          <GeneratedDocsTable
            documents={data?.data ?? []}
            isLoading={isLoading}
            onDelete={handleDelete}
            empty={
              hasFilters ? (
                <EmptyState
                  title="Sin resultados para esta búsqueda."
                  description="Ajusta la búsqueda o el filtro de tipo para ver más documentos."
                />
              ) : (
                <EmptyState
                  icon={FileText}
                  title="Aún no hay documentos generados."
                  description="Genera documentos desde la ficha de un empleado; aparecerán aquí."
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
              itemLabel="documentos"
              onPageChange={handlePageChange}
            />
          )}
        </>
      )}
    </PageHeader>
  );
}
