'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { Download, FolderOpen, SearchX, Trash2 } from 'lucide-react';
import { useEmployee } from '@/features/employees/hooks/use-employees';
import {
  useExpedienteDocs,
  useDeleteExpedienteDoc,
} from '@/features/expediente-docs/hooks/use-expediente-docs';
import type { ExpedienteDoc } from '@/features/expediente-docs/services/expediente-docs-api';
import { generatedDocumentsApi } from '@/features/generated-documents/services/generated-documents-api';
import { formatNombreCompleto } from '@saas/types';
import { DOCUMENT_TEMPLATE_TYPE_LABELS } from '@/features/document-templates/schemas/document-template-schemas';
import { ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

const CATEGORY_LABELS: Record<string, string> = {
  CONTRATO: 'Contrato',
  CERTIFICADO: 'Certificación',
  AFILIACION: 'Afiliación',
  DOCUMENTO_PERSONAL: 'Documento personal',
  PREAVISO: 'Preaviso',
  TERMINACION: 'Terminación',
  OTRO: 'Otro',
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatSize(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StatTile({
  label,
  value,
  size = 'lg',
}: {
  label: string;
  value: string | number;
  /** 'sm' para valores largos (fechas) que no caben en cifra grande. */
  size?: 'lg' | 'sm';
}) {
  return (
    <div className="rounded-[--radius-card] border border-border bg-surface p-4 shadow-[--shadow-card]">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className={cn(
          'font-semibold text-foreground',
          size === 'lg' ? 'mt-1 text-2xl' : 'mt-2.5 text-sm',
        )}
      >
        {value}
      </p>
    </div>
  );
}

export default function ExpedientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: employee, isLoading: empLoading } = useEmployee(id);
  const { data: docsData, isLoading: docsLoading } = useExpedienteDocs(id);
  const deleteMutation = useDeleteExpedienteDoc();
  const [pendingDelete, setPendingDelete] = useState<ExpedienteDoc | null>(null);

  const isLoading = empLoading || docsLoading;
  const docs = docsData?.docs ?? [];
  const stats = docsData?.stats;

  const backLink = (
    <Link
      href={`/empleados/${id}`}
      className="mb-6 inline-flex items-center gap-2 rounded-md text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      Volver al empleado
    </Link>
  );

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl">
        {backLink}
        <div className="mb-8 space-y-2">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="mb-6 grid gap-4 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="mx-auto max-w-4xl">
        <Link
          href="/empleados"
          className="mb-6 inline-flex items-center gap-2 rounded-md text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Volver a empleados
        </Link>
        <EmptyState
          icon={SearchX}
          title="Empleado no encontrado."
          description="El empleado que buscas no existe o no tienes acceso."
          action={
            <Link
              href="/empleados"
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
            >
              Volver a empleados
            </Link>
          }
        />
      </div>
    );
  }

  const columns: DataTableColumn<ExpedienteDoc>[] = [
    {
      key: 'documento',
      header: 'Documento',
      render: (doc) => (
        <div className="min-w-0">
          <p className="font-medium text-foreground">{doc.nombre}</p>
          {doc.generatedDocument && (
            <p className="truncate text-xs text-muted-foreground">
              {DOCUMENT_TEMPLATE_TYPE_LABELS[doc.generatedDocument.tipo] ??
                doc.generatedDocument.tipo}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'categoria',
      header: 'Categoría',
      render: (doc) => <Badge>{CATEGORY_LABELS[doc.categoria] ?? doc.categoria}</Badge>,
    },
    {
      key: 'tamano',
      header: 'Tamaño',
      render: (doc) => <span className="text-muted-foreground">{formatSize(doc.tamanoBytes)}</span>,
    },
    {
      key: 'agregado',
      header: 'Agregado',
      render: (doc) => <span className="text-muted-foreground">{formatDate(doc.createdAt)}</span>,
    },
    {
      key: 'acciones',
      header: 'Acciones',
      headerClassName: 'text-right',
      cellClassName: 'text-right',
      render: (doc) => (
        <div className="flex items-center justify-end gap-1">
          {doc.generatedDocumentId && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-muted-foreground hover:text-foreground"
              onClick={() =>
                window.open(generatedDocumentsApi.getPdfUrl(doc.generatedDocumentId!), '_blank')
              }
            >
              <Download className="size-3.5" aria-hidden="true" />
              <span className="sr-only">Descargar {doc.nombre}</span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-destructive hover:bg-destructive/8 hover:text-destructive"
            onClick={() => setPendingDelete(doc)}
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
            <span className="sr-only">Quitar {doc.nombre} del expediente</span>
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      {backLink}

      <PageHeader
        title="Expediente digital"
        description={formatNombreCompleto(employee)}
        width="standard"
        className="max-w-none"
      >
        {stats && (
          <div className="mb-6 grid gap-4 sm:grid-cols-4">
            <StatTile label="Documentos" value={stats.total} />
            <StatTile label="Contratos" value={stats.byCategory.CONTRATO ?? 0} />
            <StatTile label="Certificaciones" value={stats.byCategory.CERTIFICADO ?? 0} />
            <StatTile
              label="Último"
              size="sm"
              value={stats.ultimoDocumento ? formatDate(stats.ultimoDocumento) : '—'}
            />
          </div>
        )}

        <DataTable
          columns={columns}
          data={docs}
          rowKey={(doc) => doc.id}
          empty={
            <EmptyState
              icon={FolderOpen}
              title="Expediente vacío."
              description="Genera documentos desde la ficha del empleado; se agregarán automáticamente al expediente."
            />
          }
        />
      </PageHeader>

      <ConfirmDialog
        level={1}
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Quitar documento del expediente"
        description={
          pendingDelete
            ? `"${pendingDelete.nombre}" dejará de aparecer en el expediente del empleado.`
            : ''
        }
        confirmLabel="Quitar documento"
        onConfirm={() => {
          if (pendingDelete) {
            deleteMutation.mutate(pendingDelete.id, {
              onSuccess: () => toast.success('Documento quitado del expediente.'),
              onError: () => toast.error('No se pudo quitar el documento. Inténtalo de nuevo.'),
            });
          }
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
