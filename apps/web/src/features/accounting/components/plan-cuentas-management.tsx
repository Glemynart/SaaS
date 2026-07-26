'use client';

import { useCallback, useState } from 'react';
import { AlertTriangle, BookOpen, Plus } from 'lucide-react';
import { useMe } from '@/features/auth/hooks/use-auth';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { SideSheet } from '@/components/ui/side-sheet';
import { toast } from '@/components/ui/toast';
import {
  useCreateCuentaContable,
  useCuentasContables,
  useUpdateCuentaContable,
} from '../hooks/use-accounting-configuration';
import type { CuentaContableFilters, CuentaContable } from '../services/accounting-api';
import type { CuentaContableFormData } from '../schemas/accounting-configuration-schemas';
import { CuentaContableDetail } from './cuenta-contable-detail';
import { CuentaContableForm } from './cuenta-contable-form';
import { CuentasContablesTable } from './cuentas-contables-table';

const CLASES = [
  ['ACTIVO', 'Activo'],
  ['PASIVO', 'Pasivo'],
  ['PATRIMONIO', 'Patrimonio'],
  ['INGRESOS', 'Ingresos'],
  ['GASTOS', 'Gastos'],
  ['COSTOS_VENTAS', 'Costos de ventas'],
  ['COSTOS_PRODUCCION', 'Costos de producción'],
  ['CUENTAS_ORDEN_DEUDORAS', 'Cuentas de orden deudoras'],
  ['CUENTAS_ORDEN_ACREEDORAS', 'Cuentas de orden acreedoras'],
] as const;

export function PlanCuentasManagement() {
  const [filters, setFilters] = useState<CuentaContableFilters>({});
  const [editing, setEditing] = useState<CuentaContable | undefined>();
  const [detail, setDetail] = useState<CuentaContable | undefined>();
  const [formOpen, setFormOpen] = useState(false);
  const { data: user } = useMe();
  const canManage = user?.user.rol === 'ADMIN';
  const { data: cuentas, isLoading, isError, refetch } = useCuentasContables(filters);
  const createMutation = useCreateCuentaContable();
  const updateMutation = useUpdateCuentaContable();
  const hasFilters = Boolean(
    filters.search ||
    filters.claseContable ||
    filters.imputable !== undefined ||
    filters.activa !== undefined,
  );

  const updateFilters = useCallback((next: Partial<CuentaContableFilters>) => {
    setFilters((current) => ({ ...current, ...next }));
  }, []);

  const openCreate = () => {
    setEditing(undefined);
    setFormOpen(true);
  };
  const openEdit = (cuenta: CuentaContable) => {
    setEditing(cuenta);
    setFormOpen(true);
  };

  const submit = (data: CuentaContableFormData) => {
    if (editing) {
      const update = editing.esCuentaSistema
        ? { nombre: data.nombre }
        : {
            nombre: data.nombre,
            imputable: data.imputable,
            requiereTercero: data.requiereTercero,
            requiereCentroCosto: data.requiereCentroCosto,
            requiereBase: data.requiereBase,
            activa: data.activa,
          };
      updateMutation.mutate(
        { id: editing.id, data: update },
        {
          onSuccess: () => {
            setFormOpen(false);
            toast.success('Cuenta actualizada.');
          },
        },
      );
      return;
    }
    createMutation.mutate(
      { ...data, cuentaPadreId: data.cuentaPadreId || undefined },
      {
        onSuccess: () => {
          setFormOpen(false);
          toast.success('Cuenta creada.');
        },
      },
    );
  };

  const toggle = (cuenta: CuentaContable) => {
    updateMutation.mutate(
      { id: cuenta.id, data: { activa: !cuenta.activa } },
      {
        onSuccess: () => toast.success(cuenta.activa ? 'Cuenta desactivada.' : 'Cuenta activada.'),
        onError: (error) => toast.error(error.message),
      },
    );
  };

  const mutationError = (editing ? updateMutation : createMutation).error;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h2 className="text-base font-semibold text-foreground">Plan de cuentas</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Consulta y administra el catálogo PUC de tu organización.
          </p>
        </div>
        {canManage && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-4" aria-hidden="true" />
            Nueva cuenta
          </Button>
        )}
      </div>

      <div className="grid gap-3 rounded-[--radius-card] border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          aria-label="Buscar cuentas"
          placeholder="Buscar por código o nombre"
          value={filters.search ?? ''}
          onChange={(event) => updateFilters({ search: event.target.value || undefined })}
        />
        <Select
          aria-label="Filtrar por clase contable"
          value={filters.claseContable ?? ''}
          onChange={(event) =>
            updateFilters({
              claseContable: (event.target.value ||
                undefined) as CuentaContableFilters['claseContable'],
            })
          }
        >
          <option value="">Todas las clases</option>
          {CLASES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filtrar por tipo de cuenta"
          value={filters.imputable === undefined ? '' : String(filters.imputable)}
          onChange={(event) =>
            updateFilters({
              imputable: event.target.value === '' ? undefined : event.target.value === 'true',
            })
          }
        >
          <option value="">Todas las cuentas</option>
          <option value="true">Imputables</option>
          <option value="false">Agrupadoras</option>
        </Select>
        <Select
          aria-label="Filtrar por estado"
          value={filters.activa === undefined ? '' : String(filters.activa)}
          onChange={(event) =>
            updateFilters({
              activa: event.target.value === '' ? undefined : event.target.value === 'true',
            })
          }
        >
          <option value="">Todos los estados</option>
          <option value="true">Activas</option>
          <option value="false">Inactivas</option>
        </Select>
      </div>

      {isError ? (
        <EmptyState
          icon={AlertTriangle}
          title="No pudimos cargar el plan de cuentas."
          description="Revisa tu conexión e inténtalo nuevamente."
          action={
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Reintentar
            </Button>
          }
        />
      ) : (
        <CuentasContablesTable
          cuentas={cuentas ?? []}
          isLoading={isLoading}
          canManage={canManage}
          onDetail={setDetail}
          onEdit={openEdit}
          onToggle={toggle}
          empty={
            hasFilters ? (
              <EmptyState
                title="Sin resultados para estos filtros."
                description="Ajusta la búsqueda o los filtros para ver otras cuentas."
              />
            ) : (
              <EmptyState
                icon={BookOpen}
                title="Aún no hay cuentas configuradas."
                description="Crea una cuenta para comenzar a estructurar el PUC."
                action={
                  canManage ? (
                    <Button size="sm" onClick={openCreate}>
                      <Plus className="size-4" aria-hidden="true" />
                      Nueva cuenta
                    </Button>
                  ) : undefined
                }
              />
            )
          }
        />
      )}

      <SideSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editing ? 'Editar cuenta' : 'Nueva cuenta'}
        description={
          editing
            ? 'Solo se pueden cambiar los campos permitidos por el contrato contable.'
            : 'Registra una cuenta dentro del PUC de tu organización.'
        }
      >
        {mutationError && (
          <Alert variant="destructive" className="mb-4">
            {mutationError.message}
          </Alert>
        )}
        <CuentaContableForm
          initialData={editing}
          onSubmit={submit}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      </SideSheet>
      <SideSheet
        open={Boolean(detail)}
        onOpenChange={(open) => {
          if (!open) setDetail(undefined);
        }}
        title="Detalle de cuenta"
        description="Información derivada del catálogo PUC."
      >
        {detail && <CuentaContableDetail cuenta={detail} />}
      </SideSheet>
    </div>
  );
}
