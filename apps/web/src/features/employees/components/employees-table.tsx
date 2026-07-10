'use client';

import { useState, type ReactNode } from 'react';
import { type Employee } from '../services/employees-api';
import { formatNombreCompleto } from '@saas/types';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { EmployeeStatusBadge } from './employee-status-badge';

interface EmployeesTableProps {
  employees: Employee[];
  isLoading: boolean;
  onEdit: (employee: Employee) => void;
  onDelete: (id: string) => void;
  empty?: ReactNode;
}

export function EmployeesTable({
  employees,
  isLoading,
  onEdit,
  onDelete,
  empty,
}: EmployeesTableProps) {
  const [pendingDelete, setPendingDelete] = useState<Employee | null>(null);

  const columns: DataTableColumn<Employee>[] = [
    {
      key: 'empleado',
      header: 'Empleado',
      render: (emp) => (
        <div className="min-w-0">
          <p className="font-medium text-foreground">{formatNombreCompleto(emp)}</p>
          {emp.email && <p className="truncate text-xs text-muted-foreground">{emp.email}</p>}
        </div>
      ),
    },
    {
      key: 'documento',
      header: 'Documento',
      render: (emp) => (
        <span className="text-muted-foreground">
          {emp.tipoDocumento} <span className="font-mono">{emp.cedula}</span>
        </span>
      ),
    },
    {
      key: 'cargo',
      header: 'Cargo',
      render: (emp) => (
        <div className="min-w-0">
          <p className="text-foreground">{emp.cargo}</p>
          {emp.dependencia && (
            <p className="truncate text-xs text-muted-foreground">{emp.dependencia}</p>
          )}
        </div>
      ),
    },
    {
      key: 'sede',
      header: 'Sede',
      render: (emp) => <span className="text-muted-foreground">{emp.sedeRef?.nombre ?? '—'}</span>,
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (emp) => <EmployeeStatusBadge estado={emp.estado} />,
    },
    {
      key: 'acciones',
      header: 'Acciones',
      headerClassName: 'text-right',
      cellClassName: 'text-right',
      render: (emp) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => onEdit(emp)}>
            Editar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-destructive hover:bg-destructive/8 hover:text-destructive"
            onClick={() => setPendingDelete(emp)}
          >
            Desactivar
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={employees}
        rowKey={(emp) => emp.id}
        isLoading={isLoading}
        rowHref={(emp) => `/empleados/${emp.id}`}
        rowHrefLabel={(emp) => `Ver detalle de ${formatNombreCompleto(emp)}`}
        empty={empty}
      />

      <ConfirmDialog
        level={1}
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Desactivar empleado"
        description={
          pendingDelete
            ? `${formatNombreCompleto(pendingDelete)} dejará de aparecer entre los empleados activos. Podrás reactivarlo editando su estado.`
            : ''
        }
        confirmLabel="Desactivar empleado"
        onConfirm={() => {
          if (pendingDelete) onDelete(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </>
  );
}
