'use client';

import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import type { CuentaContable, CuentaSistemaMap } from '../services/accounting-api';

interface CuentaSistemaMapsTableProps {
  maps: CuentaSistemaMap[];
  cuentas: CuentaContable[];
  isLoading: boolean;
  canManage: boolean;
  onEdit: (map: CuentaSistemaMap) => void;
  empty?: ReactNode;
}

export function CuentaSistemaMapsTable({
  maps,
  cuentas,
  isLoading,
  canManage,
  onEdit,
  empty,
}: CuentaSistemaMapsTableProps) {
  const columns: DataTableColumn<CuentaSistemaMap>[] = [
    {
      key: 'rol',
      header: 'Evento del sistema',
      render: (map) => (
        <span className="font-mono text-sm font-medium text-foreground">{map.rol}</span>
      ),
    },
    {
      key: 'cuenta',
      header: 'Cuenta asociada',
      render: (map) => (
        <div>
          <p className="font-mono text-xs text-muted-foreground">{map.cuenta.codigo}</p>
          <p className="text-foreground">{map.cuenta.nombre}</p>
        </div>
      ),
    },
    {
      key: 'naturaleza',
      header: 'Naturaleza',
      render: (map) => {
        const cuenta = cuentas.find((item) => item.id === map.cuentaId);
        return (
          <span className="text-muted-foreground">
            {cuenta?.naturaleza === 'DEBITO'
              ? 'Débito'
              : cuenta?.naturaleza === 'CREDITO'
                ? 'Crédito'
                : '—'}
          </span>
        );
      },
    },
    {
      key: 'descripcion',
      header: 'Descripción',
      render: (map) => <span className="text-muted-foreground">{map.descripcion || '—'}</span>,
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (map) => (
        <Badge variant={map.activo ? 'success' : 'neutral'}>
          {map.activo ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    {
      key: 'acciones',
      header: 'Acciones',
      headerClassName: 'text-right',
      cellClassName: 'text-right',
      render: (map) =>
        canManage ? (
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => onEdit(map)}>
            Editar
          </Button>
        ) : null,
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={maps}
      rowKey={(map) => map.id}
      isLoading={isLoading}
      empty={empty}
    />
  );
}
