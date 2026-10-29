'use client';

import { useCallback, useState } from 'react';
import { AlertTriangle, Plus, Users } from 'lucide-react';
import { useMe } from '@/features/auth/hooks/use-auth';
import { useMunicipios } from '@/features/sedes/hooks/use-municipios';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { SideSheet } from '@/components/ui/side-sheet';
import { toast } from '@/components/ui/toast';
import {
  useCreateTercero,
  useTerceros,
  useUpdateTercero,
} from '../hooks/use-accounting-configuration';
import type { Tercero, TerceroFilters, TerceroPayload } from '../services/accounting-api';
import type { TerceroFormData } from '../schemas/accounting-configuration-schemas';
import { TerceroDetail } from './tercero-detail';
import { TerceroForm } from './tercero-form';
import { TercerosTable } from './terceros-table';

function terceroPayload(data: TerceroFormData): TerceroPayload {
  return {
    ...data,
    digitoVerificacion: data.digitoVerificacion || undefined,
    razonSocial: data.razonSocial || undefined,
    primerNombre: data.primerNombre || undefined,
    segundoNombre: data.segundoNombre || undefined,
    primerApellido: data.primerApellido || undefined,
    segundoApellido: data.segundoApellido || undefined,
    nombreComercial: data.nombreComercial || undefined,
    email: data.email || undefined,
    telefono: data.telefono || undefined,
    direccion: data.direccion || undefined,
    municipioId: data.municipioId || undefined,
    responsabilidadesFiscales: (data.responsabilidadesFiscales ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  };
}

export function TercerosManagement() {
  const [filters, setFilters] = useState<TerceroFilters>({});
  const [editing, setEditing] = useState<Tercero | undefined>();
  const [detail, setDetail] = useState<Tercero | undefined>();
  const [formOpen, setFormOpen] = useState(false);
  const { data: user } = useMe();
  const { data: municipios } = useMunicipios();
  const canManage = user?.user.rol === 'ADMIN';
  const { data: terceros, isLoading, isError, refetch } = useTerceros(filters);
  const createMutation = useCreateTercero();
  const updateMutation = useUpdateTercero();
  const hasFilters = Boolean(
    filters.search ||
    filters.esCliente !== undefined ||
    filters.esProveedor !== undefined ||
    filters.activo !== undefined,
  );
  const updateFilters = useCallback(
    (next: Partial<TerceroFilters>) => setFilters((current) => ({ ...current, ...next })),
    [],
  );
  const openCreate = () => {
    setEditing(undefined);
    setFormOpen(true);
  };
  const openEdit = (tercero: Tercero) => {
    setEditing(tercero);
    setFormOpen(true);
  };

  const submit = (data: TerceroFormData) => {
    const payload = terceroPayload(data);
    if (editing) {
      const update = { ...payload };
      Reflect.deleteProperty(update, 'tipoDocumento');
      Reflect.deleteProperty(update, 'numeroDocumento');
      updateMutation.mutate(
        { id: editing.id, data: update },
        {
          onSuccess: () => {
            setFormOpen(false);
            toast.success('Tercero actualizado.');
          },
        },
      );
      return;
    }
    createMutation.mutate(payload, {
      onSuccess: () => {
        setFormOpen(false);
        toast.success('Tercero creado.');
      },
    });
  };
  const toggle = (tercero: Tercero) =>
    updateMutation.mutate(
      { id: tercero.id, data: { activo: !tercero.activo } },
      {
        onSuccess: () =>
          toast.success(tercero.activo ? 'Tercero desactivado.' : 'Tercero activado.'),
        onError: (error) => toast.error(error.message),
      },
    );
  const mutationError = (editing ? updateMutation : createMutation).error;
  const municipioNombre = detail?.municipioId
    ? municipios?.find((municipio) => municipio.id === detail.municipioId)?.nombre
    : undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h2 className="text-base font-semibold text-foreground">Terceros contables</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestiona las contrapartes contables de tu organización.
          </p>
        </div>
        {canManage && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-4" aria-hidden="true" />
            Nuevo tercero
          </Button>
        )}
      </div>
      <div className="grid gap-3 rounded-(--radius-card) border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          aria-label="Buscar terceros"
          placeholder="Buscar por nombre o documento"
          value={filters.search ?? ''}
          onChange={(event) => updateFilters({ search: event.target.value || undefined })}
        />
        <Select
          aria-label="Filtrar por cliente"
          value={filters.esCliente === undefined ? '' : String(filters.esCliente)}
          onChange={(event) =>
            updateFilters({
              esCliente: event.target.value === '' ? undefined : event.target.value === 'true',
            })
          }
        >
          <option value="">Todos los terceros</option>
          <option value="true">Clientes</option>
          <option value="false">No clientes</option>
        </Select>
        <Select
          aria-label="Filtrar por proveedor"
          value={filters.esProveedor === undefined ? '' : String(filters.esProveedor)}
          onChange={(event) =>
            updateFilters({
              esProveedor: event.target.value === '' ? undefined : event.target.value === 'true',
            })
          }
        >
          <option value="">Todos los proveedores</option>
          <option value="true">Proveedores</option>
          <option value="false">No proveedores</option>
        </Select>
        <Select
          aria-label="Filtrar por estado"
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
          title="No pudimos cargar los terceros."
          description="Revisa tu conexión e inténtalo nuevamente."
          action={
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Reintentar
            </Button>
          }
        />
      ) : (
        <TercerosTable
          terceros={terceros ?? []}
          isLoading={isLoading}
          canManage={canManage}
          onDetail={setDetail}
          onEdit={openEdit}
          onToggle={toggle}
          empty={
            hasFilters ? (
              <EmptyState
                title="Sin resultados para estos filtros."
                description="Ajusta la búsqueda o los filtros para ver otros terceros."
              />
            ) : (
              <EmptyState
                icon={Users}
                title="Aún no hay terceros registrados."
                description="Crea el primero para usarlo en las operaciones contables."
                action={
                  canManage ? (
                    <Button size="sm" onClick={openCreate}>
                      <Plus className="size-4" aria-hidden="true" />
                      Nuevo tercero
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
        title={editing ? 'Editar tercero' : 'Nuevo tercero'}
        description={
          editing
            ? 'Modifica los campos permitidos por el contrato del tercero.'
            : 'Registra una contraparte contable de tu organización.'
        }
      >
        {mutationError && (
          <Alert variant="destructive" className="mb-4">
            {mutationError.message}
          </Alert>
        )}
        <TerceroForm
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
        title="Detalle del tercero"
        description="Información disponible en el catálogo de terceros."
      >
        {detail && <TerceroDetail tercero={detail} municipioNombre={municipioNombre} />}
      </SideSheet>
    </div>
  );
}
