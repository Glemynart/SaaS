'use client';

import { useState, type ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import { type GeneratedDocument } from '../services/generated-documents-api';
import { formatNombreCompleto } from '@saas/types';
import { DOCUMENT_TEMPLATE_TYPE_LABELS } from '@/features/document-templates/schemas/document-template-schemas';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';

interface GeneratedDocsTableProps {
  documents: GeneratedDocument[];
  isLoading: boolean;
  onDelete: (id: string) => void;
  empty?: ReactNode;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function GeneratedDocsTable({
  documents,
  isLoading,
  onDelete,
  empty,
}: GeneratedDocsTableProps) {
  const [pendingDelete, setPendingDelete] = useState<GeneratedDocument | null>(null);

  const columns: DataTableColumn<GeneratedDocument>[] = [
    {
      key: 'documento',
      header: 'Documento',
      render: (doc) => (
        <div className="min-w-0">
          <p className="font-medium text-foreground">{doc.nombre}</p>
          <p className="truncate text-xs text-muted-foreground">
            {formatNombreCompleto(doc.employee)} — {doc.employee.cargo}
          </p>
        </div>
      ),
    },
    {
      key: 'tipo',
      header: 'Tipo',
      render: (doc) => <Badge>{DOCUMENT_TEMPLATE_TYPE_LABELS[doc.tipo] ?? doc.tipo}</Badge>,
    },
    {
      key: 'pdf',
      header: 'PDF',
      render: (doc) => (
        <StatusBadge
          domain="documentoGenerado"
          estado={doc.pdfUrl ? 'PDF_DISPONIBLE' : 'SIN_PDF'}
        />
      ),
    },
    {
      key: 'generado',
      header: 'Generado',
      render: (doc) => <span className="text-muted-foreground">{formatDate(doc.createdAt)}</span>,
    },
    {
      key: 'acciones',
      header: 'Acciones',
      headerClassName: 'text-right',
      cellClassName: 'text-right',
      render: (doc) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-destructive hover:bg-destructive/8 hover:text-destructive"
            onClick={() => setPendingDelete(doc)}
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
            <span className="sr-only">Eliminar {doc.nombre}</span>
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={documents}
        rowKey={(doc) => doc.id}
        isLoading={isLoading}
        rowHref={(doc) => `/documentos/generados/${doc.id}`}
        rowHrefLabel={(doc) => `Ver documento ${doc.nombre}`}
        empty={empty}
      />

      <ConfirmDialog
        level={1}
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Eliminar documento generado"
        description={
          pendingDelete
            ? `"${pendingDelete.nombre}" se eliminará del historial. Si estaba en el expediente del empleado, también dejará de aparecer allí.`
            : ''
        }
        confirmLabel="Eliminar documento"
        onConfirm={() => {
          if (pendingDelete) onDelete(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </>
  );
}
