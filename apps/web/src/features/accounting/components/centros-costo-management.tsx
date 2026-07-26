'use client';

import { useCallback, useState } from 'react';
import { AlertTriangle, Building2, Plus } from 'lucide-react';
import { useMe } from '@/features/auth/hooks/use-auth';
import { useSedes } from '@/features/sedes/hooks/use-sedes';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { SideSheet } from '@/components/ui/side-sheet';
import { toast } from '@/components/ui/toast';
import {
  useCentrosCosto,
  useCreateCentroCosto,
  useUpdateCentroCosto,
} from '../hooks/use-accounting-configuration';
import type { CentroCosto, CentroCostoFilters } from '../services/accounting-api';
import type { CentroCostoFormData } from '../schemas/accounting-configuration-schemas';
import { CentroCostoDetail } from './centro-costo-detail';
import { CentroCostoForm } from './centro-costo-form';
import { CentrosCostoTable } from './centros-costo-table';

export function CentrosCostoManagement() {
  const [filters, setFilters] = useState<CentroCostoFilters>({});
  const [editing, setEditing] = useState<CentroCosto | undefined>();
  const [detail, setDetail] = useState<CentroCosto | undefined>();
  const [formOpen, setFormOpen] = useState(false);
  const { data: user } = useMe();
  const { data: sedes } = useSedes({});
  const canManage = user?.user.rol === 'ADMIN';
  const { data: centros, isLoading, isError, refetch } = useCentrosCosto(filters);
  const createMutation = useCreateCentroCosto();
  const updateMutation = useUpdateCentroCosto();
  const hasFilters = Boolean(filters.search || filters.activo !== undefined);
  const updateFilters = useCallback(
    (next: Partial<CentroCostoFilters>) => setFilters((current) => ({ ...current, ...next })),
    [],
  );
  const openCreate = () => {
    setEditing(undefined);
    setFormOpen(true);
  };
  const openEdit = (centro: CentroCosto) => {
    setEditing(centro);
    setFormOpen(true);
  };
  const submit = (data: CentroCostoFormData) => {
    const payload = { ...data, sedeId: data.sedeId || undefined };
    if (editing) {
      const update = { ...payload };
      Reflect.deleteProperty(update, 'codigo');
      updateMutation.mutate(
        { id: editing.id, data: update },
        {
          onSuccess: () => {
            setFormOpen(false);
            toast.success('Centro de costo actualizado.');
          },
        },
      );
      return;
    }
    createMutation.mutate(payload, {
      onSuccess: () => {
        setFormOpen(false);
        toast.success('Centro de costo creado.');
      },
    });
  };
  const toggle = (centro: CentroCosto) =>
    updateMutation.mutate(
      { id: centro.id, data: { activo: !centro.activo } },
      {
        onSuccess: () =>
          toast.success(
            centro.activo ? 'Centro de costo desactivado.' : 'Centro de costo activado.',
          ),
        onError: (error) => toast.error(error.message),
      },
    );
  const mutationError = (editing ? updateMutation : createMutation).error;
  const sedeNombre = detail?.sedeId
    ? sedes?.find((sede) => sede.id === detail.sedeId)?.nombre
    : undefined;
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h2 className="text-base font-semibold text-foreground">Centros de costo</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Administra la dimensión operativa disponible para clasificar movimientos.
          </p>
        </div>
        {canManage && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-4" aria-hidden="true" />
            Nuevo centro
          </Button>
        )}
      </div>
      <div className="grid gap-3 rounded-[--radius-card] border border-border bg-surface p-4 sm:grid-cols-2">
        <Input
          aria-label="Buscar centros de costo"
          placeholder="Buscar por código o nombre"
          value={filters.search ?? ''}
          onChange={(event) => updateFilters({ search: event.target.value || undefined })}
        />
        <Select
          aria-label="Filtrar centros de costo por estado"
          value={filters.activo === undefined ? '' : String(filters.activo)}
          onChange={(event) =>
            updateFilters({
              activo: event.target.value === '' ? undefined : event.target.value === 'true',
            })
          }
        >
          <option value="">Todos los estados</option>
          <option value="true">Activos</option>
          <option value="false">Inactivos</option>
        </Select>
      </div>
      {isError ? (
        <EmptyState
          icon={AlertTriangle}
          title="No pudimos cargar los centros de costo."
          description="Revisa tu conexión e inténtalo nuevamente."
          action={
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Reintentar
            </Button>
          }
        />
      ) : (
        <CentrosCostoTable
          centros={centros ?? []}
          sedes={sedes ?? []}
          isLoading={isLoading}
          canManage={canManage}
          onDetail={setDetail}
          onEdit={openEdit}
          onToggle={toggle}
          empty={
            hasFilters ? (
              <EmptyState
                title="Sin resultados para estos filtros."
                description="Ajusta la búsqueda o el estado para ver otros centros."
              />
            ) : (
              <EmptyState
                icon={Building2}
                title="Aún no hay centros de costo."
                description="Crea el primero para clasificar operaciones por dimensión operativa."
                action={
                  canManage ? (
                    <Button size="sm" onClick={openCreate}>
                      <Plus className="size-4" aria-hidden="true" />
                      Nuevo centro
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
        title={editing ? 'Editar centro de costo' : 'Nuevo centro de costo'}
        description={
          editing
            ? 'Modifica los campos permitidos por el contrato existente.'
            : 'Registra un centro de costo para tu organización.'
        }
      >
        {mutationError && (
          <Alert variant="destructive" className="mb-4">
            {mutationError.message}
          </Alert>
        )}
        <CentroCostoForm
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
        title="Detalle del centro de costo"
        description="Información disponible en el catálogo de centros de costo."
      >
        {detail && <CentroCostoDetail centro={detail} sedeNombre={sedeNombre} />}
      </SideSheet>
    </div>
  );
}
