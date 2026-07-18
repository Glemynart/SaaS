'use client';

import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import type { CuentaContable } from '../services/accounting-api';

interface CuentasContablesTableProps {
  cuentas: CuentaContable[];
  isLoading: boolean;
  canManage: boolean;
  onDetail: (cuenta: CuentaContable) => void;
  onEdit: (cuenta: CuentaContable) => void;
  onToggle: (cuenta: CuentaContable) => void;
  empty?: ReactNode;
}

const CLASE_LABEL: Record<CuentaContable['claseContable'], string> = {
  ACTIVO: 'Activo',
  PASIVO: 'Pasivo',
  PATRIMONIO: 'Patrimonio',
  INGRESOS: 'Ingresos',
  GASTOS: 'Gastos',
  COSTOS_VENTAS: 'Costos ventas',
  COSTOS_PRODUCCION: 'Costos producción',
  CUENTAS_ORDEN_DEUDORAS: 'Orden deudoras',
  CUENTAS_ORDEN_ACREEDORAS: 'Orden acreedoras',
};

export function CuentasContablesTable({
  cuentas,
  isLoading,
  canManage,
  onDetail,
  onEdit,
  onToggle,
  empty,
}: CuentasContablesTableProps) {
  const columns: DataTableColumn<CuentaContable>[] = [
    {
      key: 'cuenta',
      header: 'Cuenta',
      render: (cuenta) => (
        <div
          className="min-w-52"
          style={{ paddingLeft: `${Math.max(0, cuenta.nivel - 1) * 12}px` }}
        >
          <p className="font-mono text-xs text-muted-foreground">{cuenta.codigo}</p>
          <p className="font-medium text-foreground">{cuenta.nombre}</p>
        </div>
      ),
    },
    {
      key: 'clasificacion',
      header: 'Clasificación',
      render: (cuenta) => (
        <div>
          <p className="text-foreground">{CLASE_LABEL[cuenta.claseContable]}</p>
          <p className="text-xs text-muted-foreground">
            {cuenta.naturaleza === 'DEBITO' ? 'Débito' : 'Crédito'} · Nivel {cuenta.nivel}
          </p>
        </div>
      ),
    },
    {
      key: 'control',
      header: 'Control',
      render: (cuenta) => (
        <div className="flex flex-wrap gap-1">
          {cuenta.imputable && <Badge variant="info">Imputable</Badge>}
          {cuenta.esCuentaSistema && <Badge variant="neutral">Sistema</Badge>}
          {!cuenta.imputable && !cuenta.esCuentaSistema && (
            <span className="text-muted-foreground">—</span>
          )}
        </div>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (cuenta) => (
        <Badge variant={cuenta.activa ? 'success' : 'neutral'}>
          {cuenta.activa ? 'Activa' : 'Inactiva'}
        </Badge>
      ),
    },
    {
      key: 'acciones',
      header: 'Acciones',
      headerClassName: 'text-right',
      cellClassName: 'text-right',
      render: (cuenta) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => onDetail(cuenta)}>
            Detalle
          </Button>
          {canManage && (
            <>
              <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => onEdit(cuenta)}>
                Editar
              </Button>
              {!cuenta.esCuentaSistema && (
                <Button
                  variant="ghost"
                  size="sm"
                  className={
                    cuenta.activa
                      ? 'h-8 px-2 text-destructive hover:bg-destructive/8 hover:text-destructive'
                      : 'h-8 px-2 text-success hover:bg-success/8 hover:text-success'
                  }
                  onClick={() => onToggle(cuenta)}
                >
                  {cuenta.activa ? 'Desactivar' : 'Activar'}
                </Button>
              )}
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={cuentas}
      rowKey={(cuenta) => cuenta.id}
      isLoading={isLoading}
      empty={empty}
    />
  );
}
