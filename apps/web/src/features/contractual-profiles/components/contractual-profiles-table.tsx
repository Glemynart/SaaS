'use client';

import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { type ContractualProfile } from '../services/contractual-profiles-api';

interface ContractualProfilesTableProps {
  profiles: ContractualProfile[];
  isLoading: boolean;
  onEdit: (profile: ContractualProfile) => void;
  onToggleStatus: (profile: ContractualProfile) => void;
  empty?: ReactNode;
}

export function ContractualProfilesTable({
  profiles,
  isLoading,
  onEdit,
  onToggleStatus,
  empty,
}: ContractualProfilesTableProps) {
  const columns: DataTableColumn<ContractualProfile>[] = [
    {
      key: 'codigo',
      header: 'Código',
      render: (profile) => <span className="font-mono font-medium">{profile.codigo}</span>,
    },
    {
      key: 'nombre',
      header: 'Perfil',
      render: (profile) => (
        <div className="min-w-0">
          <p className="font-medium text-foreground">{profile.nombre}</p>
          {profile.descripcion && (
            <p className="truncate text-xs text-muted-foreground">{profile.descripcion}</p>
          )}
        </div>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (profile) => (
        <Badge variant={profile.activo ? 'success' : 'neutral'}>
          {profile.activo ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    {
      key: 'acciones',
      header: 'Acciones',
      headerClassName: 'text-right',
      cellClassName: 'text-right',
      render: (profile) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => onEdit(profile)}>
            Editar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            onClick={() => onToggleStatus(profile)}
          >
            {profile.activo ? 'Desactivar' : 'Activar'}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={profiles}
      rowKey={(profile) => profile.id}
      isLoading={isLoading}
      empty={empty}
    />
  );
}
