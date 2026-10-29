'use client';

import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { DOCUMENT_TEMPLATE_TYPE_LABELS } from '@/features/document-templates/schemas/document-template-schemas';
import type { DocumentProfileConfiguration } from '../services/document-profile-configurations-api';

interface DocumentProfileConfigurationsTableProps {
  configurations: DocumentProfileConfiguration[];
  isLoading: boolean;
  onEdit: (configuration: DocumentProfileConfiguration) => void;
  empty?: ReactNode;
}

function formatDate(value: string | null) {
  if (!value) return 'Sin fecha final';
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(
    new Date(`${value.slice(0, 10)}T00:00:00`),
  );
}

export function DocumentProfileConfigurationsTable({
  configurations,
  isLoading,
  onEdit,
  empty,
}: DocumentProfileConfigurationsTableProps) {
  const columns: DataTableColumn<DocumentProfileConfiguration>[] = [
    {
      key: 'perfil',
      header: 'Perfil contractual',
      render: (configuration) => (
        <div className="min-w-0">
          <p className="font-medium text-foreground">{configuration.perfilContractual.nombre}</p>
          <p className="font-mono text-xs text-muted-foreground">
            {configuration.perfilContractual.codigo}
          </p>
        </div>
      ),
    },
    {
      key: 'tipo',
      header: 'Tipo documental',
      render: (configuration) => DOCUMENT_TEMPLATE_TYPE_LABELS[configuration.tipoDocumental],
    },
    {
      key: 'plantilla',
      header: 'Plantilla',
      render: (configuration) => configuration.plantilla.nombre,
    },
    {
      key: 'vigencia',
      header: 'Vigencia',
      render: (configuration) => (
        <span className="text-xs text-muted-foreground">
          {formatDate(configuration.vigenteDesde)} — {formatDate(configuration.vigenteHasta)}
        </span>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (configuration) => (
        <Badge variant={configuration.activo ? 'success' : 'neutral'}>
          {configuration.activo ? 'Activa' : 'Inactiva'}
        </Badge>
      ),
    },
    {
      key: 'acciones',
      header: 'Acciones',
      headerClassName: 'text-right',
      cellClassName: 'text-right',
      render: (configuration) => (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          onClick={() => onEdit(configuration)}
        >
          Editar
        </Button>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={configurations}
      rowKey={(configuration) => configuration.id}
      isLoading={isLoading}
      empty={empty}
    />
  );
}
