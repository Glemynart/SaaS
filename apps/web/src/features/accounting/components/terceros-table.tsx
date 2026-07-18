'use client';

import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { terceroNombre, terceroRoles } from '../lib/accounting-formatters';
import type { Tercero } from '../services/accounting-api';

interface TercerosTableProps {
  terceros: Tercero[];
  isLoading: boolean;
  canManage: boolean;
  onDetail: (tercero: Tercero) => void;
  onEdit: (tercero: Tercero) => void;
  onToggle: (tercero: Tercero) => void;
  empty?: ReactNode;
}

export function TercerosTable({
  terceros,
  isLoading,
  canManage,
  onDetail,
  onEdit,
  onToggle,
  empty,
}: TercerosTableProps) {
  const columns: DataTableColumn<Tercero>[] = [
    {
      key: 'tercero',
      header: 'Tercero',
      render: (tercero) => (
        <div>
          <p className="font-medium text-foreground">{terceroNombre(tercero)}</p>
          {tercero.nombreComercial && tercero.nombreComercial !== terceroNombre(tercero) && (
            <p className="text-xs text-muted-foreground">{tercero.nombreComercial}</p>
          )}
        </div>
      ),
    },
    {
      key: 'documento',
      header: 'Documento',
      render: (tercero) => (
        <span className="font-mono text-sm text-muted-foreground">
          {tercero.tipoDocumento} {tercero.numeroDocumento}
          {tercero.digitoVerificacion ? `-${tercero.digitoVerificacion}` : ''}
        </span>
      ),
    },
    {
      key: 'roles',
      header: 'Roles',
      render: (tercero) => (
        <div className="flex flex-wrap gap-1">
          {terceroRoles(tercero).length ? (
            terceroRoles(tercero).map((rol) => (
              <Badge key={rol} variant="neutral">
                {rol}
              </Badge>
            ))
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </div>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (tercero) => (
        <Badge variant={tercero.activo ? 'success' : 'neutral'}>
          {tercero.activo ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    {
      key: 'acciones',
      header: 'Acciones',
      headerClassName: 'text-right',
      cellClassName: 'text-right',
      render: (tercero) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => onDetail(tercero)}>
            Detalle
          </Button>
          {canManage && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() => onEdit(tercero)}
              >
                Editar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={
                  tercero.activo
                    ? 'h-8 px-2 text-destructive hover:bg-destructive/8 hover:text-destructive'
                    : 'h-8 px-2 text-success hover:bg-success/8 hover:text-success'
                }
                onClick={() => onToggle(tercero)}
              >
                {tercero.activo ? 'Desactivar' : 'Activar'}
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];
  return (
    <DataTable
      columns={columns}
      data={terceros}
      rowKey={(tercero) => tercero.id}
      isLoading={isLoading}
      empty={empty}
    />
  );
}
