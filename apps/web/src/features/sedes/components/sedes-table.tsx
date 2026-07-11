'use client';

import { useState, type ReactNode } from 'react';
import { type Sede } from '../services/sedes-api';
import { useUpdateSede } from '../hooks/use-sedes';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { toast } from '@/components/ui/toast';

interface SedesTableProps {
  sedes: Sede[];
  isLoading: boolean;
  onEdit: (sede: Sede) => void;
  empty?: ReactNode;
}

export function SedesTable({ sedes, isLoading, onEdit, empty }: SedesTableProps) {
  const updateMutation = useUpdateSede();
  const [pendingDeactivate, setPendingDeactivate] = useState<Sede | null>(null);

  const setActivo = (sede: Sede, activo: boolean) => {
    updateMutation.mutate(
      { id: sede.id, data: { activo } },
      {
        onSuccess: () => toast.success(activo ? 'Sede activada.' : 'Sede desactivada.'),
        onError: () => toast.error('No se pudo actualizar la sede. Inténtalo de nuevo.'),
      },
    );
  };

  const columns: DataTableColumn<Sede>[] = [
    {
      key: 'nombre',
      header: 'Nombre',
      render: (sede) => <p className="font-medium text-foreground">{sede.nombre}</p>,
    },
    {
      key: 'municipio',
      header: 'Municipio',
      render: (sede) =>
        sede.municipio ? (
          <div className="min-w-0">
            <p className="text-foreground">{sede.municipio.nombre}</p>
            <p className="truncate text-xs text-muted-foreground">{sede.municipio.departamento}</p>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'direccion',
      header: 'Dirección',
      render: (sede) => <span className="text-muted-foreground">{sede.direccion || '—'}</span>,
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (sede) => <StatusBadge domain="sede" estado={sede.activo ? 'ACTIVA' : 'INACTIVA'} />,
    },
    {
      key: 'acciones',
      header: 'Acciones',
      headerClassName: 'text-right',
      cellClassName: 'text-right',
      render: (sede) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => onEdit(sede)}>
            Editar
          </Button>
          {sede.activo ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-destructive hover:bg-destructive/8 hover:text-destructive"
              disabled={updateMutation.isPending}
              onClick={() => setPendingDeactivate(sede)}
            >
              Desactivar
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-success hover:bg-success/8 hover:text-success"
              disabled={updateMutation.isPending}
              onClick={() => setActivo(sede, true)}
            >
              Activar
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={sedes}
        rowKey={(sede) => sede.id}
        isLoading={isLoading}
        empty={empty}
      />

      <ConfirmDialog
        level={1}
        open={pendingDeactivate !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeactivate(null);
        }}
        title="Desactivar sede"
        description={
          pendingDeactivate
            ? `${pendingDeactivate.nombre} dejará de aparecer entre las sedes activas. Podrás reactivarla desde este listado.`
            : ''
        }
        confirmLabel="Desactivar sede"
        onConfirm={() => {
          if (pendingDeactivate) setActivo(pendingDeactivate, false);
          setPendingDeactivate(null);
        }}
      />
    </>
  );
}
