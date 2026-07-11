'use client';

import { useState, type ReactNode } from 'react';
import { Copy, Pencil, Power, PowerOff, Trash2 } from 'lucide-react';
import { type DocumentTemplate } from '../services/document-templates-api';
import { DOCUMENT_TEMPLATE_TYPE_LABELS } from '../schemas/document-template-schemas';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';

interface TemplatesTableProps {
  templates: DocumentTemplate[];
  isLoading: boolean;
  onEdit: (template: DocumentTemplate) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onToggleActive: (id: string) => void;
  empty?: ReactNode;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function TemplatesTable({
  templates,
  isLoading,
  onEdit,
  onDelete,
  onDuplicate,
  onToggleActive,
  empty,
}: TemplatesTableProps) {
  const [pendingDelete, setPendingDelete] = useState<DocumentTemplate | null>(null);

  const columns: DataTableColumn<DocumentTemplate>[] = [
    {
      key: 'plantilla',
      header: 'Plantilla',
      render: (tpl) => (
        <div className="min-w-0">
          <p className="font-medium text-foreground">{tpl.nombre}</p>
          {tpl.descripcion && (
            <p className="truncate text-xs text-muted-foreground">{tpl.descripcion}</p>
          )}
        </div>
      ),
    },
    {
      key: 'tipo',
      header: 'Tipo',
      render: (tpl) => <Badge>{DOCUMENT_TEMPLATE_TYPE_LABELS[tpl.tipo] ?? tpl.tipo}</Badge>,
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (tpl) => (
        <StatusBadge domain="plantilla" estado={tpl.activo ? 'ACTIVA' : 'INACTIVA'} />
      ),
    },
    {
      key: 'actualizada',
      header: 'Actualizada',
      render: (tpl) => <span className="text-muted-foreground">{formatDate(tpl.updatedAt)}</span>,
    },
    {
      key: 'acciones',
      header: 'Acciones',
      headerClassName: 'text-right',
      cellClassName: 'text-right',
      render: (tpl) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-muted-foreground hover:text-foreground"
            onClick={() => onToggleActive(tpl.id)}
          >
            {tpl.activo ? (
              <PowerOff className="size-3.5" aria-hidden="true" />
            ) : (
              <Power className="size-3.5" aria-hidden="true" />
            )}
            <span className="sr-only">
              {tpl.activo ? `Desactivar ${tpl.nombre}` : `Activar ${tpl.nombre}`}
            </span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-muted-foreground hover:text-foreground"
            onClick={() => onDuplicate(tpl.id)}
          >
            <Copy className="size-3.5" aria-hidden="true" />
            <span className="sr-only">Duplicar {tpl.nombre}</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-muted-foreground hover:text-foreground"
            onClick={() => onEdit(tpl)}
          >
            <Pencil className="size-3.5" aria-hidden="true" />
            <span className="sr-only">Editar {tpl.nombre}</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-destructive hover:bg-destructive/8 hover:text-destructive"
            onClick={() => setPendingDelete(tpl)}
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
            <span className="sr-only">Eliminar {tpl.nombre}</span>
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={templates}
        rowKey={(tpl) => tpl.id}
        isLoading={isLoading}
        rowHref={(tpl) => `/documentos/plantillas/${tpl.id}`}
        rowHrefLabel={(tpl) => `Ver plantilla ${tpl.nombre}`}
        empty={empty}
      />

      <ConfirmDialog
        level={1}
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Eliminar plantilla"
        description={
          pendingDelete
            ? `"${pendingDelete.nombre}" dejará de estar disponible para generar documentos. Los documentos ya generados con ella no se ven afectados.`
            : ''
        }
        confirmLabel="Eliminar plantilla"
        onConfirm={() => {
          if (pendingDelete) onDelete(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </>
  );
}
