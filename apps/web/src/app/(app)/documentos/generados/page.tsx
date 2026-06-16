'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { GeneratedDocsTable } from '@/features/generated-documents/components/generated-docs-table';
import {
  useGeneratedDocuments,
  useDeleteGeneratedDocument,
} from '@/features/generated-documents/hooks/use-generated-documents';
import type { GetGeneratedDocumentsParams } from '@/features/generated-documents/services/generated-documents-api';

export default function GeneradosPage() {
  const router = useRouter();
  const [filters, setFilters] = useState<GetGeneratedDocumentsParams>({ page: 1, limit: 20 });
  const [search, setSearch] = useState('');

  const { data, isLoading } = useGeneratedDocuments(filters);
  const deleteMutation = useDeleteGeneratedDocument();

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    setFilters((prev) => ({ ...prev, search: value || undefined, page: 1 }));
  }, []);

  const handleView = useCallback(
    (id: string) => {
      router.push(`/documentos/generados/${id}`);
    },
    [router],
  );

  const handleDelete = useCallback(
    (id: string) => {
      deleteMutation.mutate(id);
    },
    [deleteMutation],
  );

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8">
        <h1 className="text-lg font-semibold tracking-[-0.018em] text-foreground">
          Documentos generados
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Historial de documentos generados a partir de plantillas y empleados.
        </p>
      </div>

      <div className="mb-6">
        <Input
          placeholder="Buscar documentos..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <GeneratedDocsTable
        documents={data?.data ?? []}
        isLoading={isLoading}
        onView={handleView}
        onDelete={handleDelete}
      />
    </div>
  );
}
