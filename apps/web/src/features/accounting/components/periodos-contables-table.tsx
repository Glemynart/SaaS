'use client';

import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import type { PeriodoContable } from '../services/accounting-api';

interface PeriodosContablesTableProps {
  periodos: PeriodoContable[];
  isLoading: boolean;
  isOperating: boolean;
  canManage: boolean;
  onValidar: (periodo: PeriodoContable) => void;
  onCerrar: (periodo: PeriodoContable) => void;
  onReabrir: (periodo: PeriodoContable) => void;
  onCerrarAnio: (periodo: PeriodoContable) => void;
  empty?: ReactNode;
}

const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function PeriodosContablesTable({
  periodos,
  isLoading,
  isOperating,
  canManage,
  onValidar,
  onCerrar,
  onReabrir,
  onCerrarAnio,
  empty,
}: PeriodosContablesTableProps) {
  const columns: DataTableColumn<PeriodoContable>[] = [
    {
      key: 'periodo',
      header: 'Período',
      render: (periodo) => (
        <div>
          <p className="font-medium text-foreground">
            {MESES[periodo.mes - 1]} {periodo.anio}
          </p>
          <p className="text-xs text-muted-foreground">
            {periodo.anio}-{String(periodo.mes).padStart(2, '0')}
          </p>
        </div>
      ),
    },
    {
      key: 'vigencia',
      header: 'Vigencia',
      render: (periodo) => (
        <span className="text-muted-foreground">
          {formatDate(periodo.fechaInicio)} — {formatDate(periodo.fechaFin)}
        </span>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (periodo) => (
        <Badge variant={periodo.estado === 'ABIERTO' ? 'success' : 'neutral'}>
          {periodo.estado === 'ABIERTO' ? 'Abierto' : 'Cerrado'}
        </Badge>
      ),
    },
    {
      key: 'cerrado',
      header: 'Fecha de cierre',
      render: (periodo) => (
        <span className="text-muted-foreground">{formatDate(periodo.cerradoAt)}</span>
      ),
    },
    {
      key: 'acciones',
      header: 'Acciones',
      headerClassName: 'text-right',
      cellClassName: 'text-right',
      render: (periodo) => (
        <div className="flex items-center justify-end gap-1">
          {canManage && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                disabled={isOperating}
                onClick={() => onValidar(periodo)}
              >
                Validar
              </Button>
              {periodo.estado === 'ABIERTO' ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2"
                  disabled={isOperating}
                  onClick={() => onCerrar(periodo)}
                >
                  Cerrar
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2"
                  disabled={isOperating}
                  onClick={() => onReabrir(periodo)}
                >
                  Reabrir
                </Button>
              )}
              {periodo.mes === 12 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-destructive hover:bg-destructive/8 hover:text-destructive"
                  disabled={isOperating}
                  onClick={() => onCerrarAnio(periodo)}
                >
                  Cierre anual
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
      data={periodos}
      rowKey={(periodo) => periodo.id}
      isLoading={isLoading}
      empty={empty}
    />
  );
}
