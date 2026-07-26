'use client';

import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import type { Sede } from '@/features/sedes/services/sedes-api';
import type { CentroCosto } from '../services/accounting-api';

interface CentrosCostoTableProps {
  centros: CentroCosto[];
  sedes: Sede[];
  isLoading: boolean;
  canManage: boolean;
  onDetail: (centro: CentroCosto) => void;
  onEdit: (centro: CentroCosto) => void;
  onToggle: (centro: CentroCosto) => void;
  empty?: ReactNode;
}

export function CentrosCostoTable({
  centros,
  sedes,
  isLoading,
  canManage,
  onDetail,
  onEdit,
  onToggle,
  empty,
}: CentrosCostoTableProps) {
  const columns: DataTableColumn<CentroCosto>[] = [
    {
      key: 'codigo',
      header: 'Código',
      render: (centro) => (
        <span className="font-mono text-sm text-muted-foreground">{centro.codigo}</span>
      ),
    },
    {
      key: 'nombre',
      header: 'Nombre',
      render: (centro) => <span className="font-medium text-foreground">{centro.nombre}</span>,
    },
    {
      key: 'sede',
      header: 'Sede',
      render: (centro) => (
        <span className="text-muted-foreground">
          {sedes.find((sede) => sede.id === centro.sedeId)?.nombre ?? '—'}
        </span>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (centro) => (
        <Badge variant={centro.activo ? 'success' : 'neutral'}>
          {centro.activo ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    {
      key: 'acciones',
      header: 'Acciones',
      headerClassName: 'text-right',
      cellClassName: 'text-right',
      render: (centro) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => onDetail(centro)}>
            Detalle
          </Button>
          {canManage && (
            <>
              <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => onEdit(centro)}>
                Editar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={
                  centro.activo
                    ? 'h-8 px-2 text-destructive hover:bg-destructive/8 hover:text-destructive'
                    : 'h-8 px-2 text-success hover:bg-success/8 hover:text-success'
                }
                onClick={() => onToggle(centro)}
              >
                {centro.activo ? 'Desactivar' : 'Activar'}
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
      data={centros}
      rowKey={(centro) => centro.id}
      isLoading={isLoading}
      empty={empty}
    />
  );
}
