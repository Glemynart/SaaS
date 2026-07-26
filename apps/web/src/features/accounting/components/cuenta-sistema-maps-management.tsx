'use client';

import { useState } from 'react';
import { AlertTriangle, GitBranch, Plus } from 'lucide-react';
import { useMe } from '@/features/auth/hooks/use-auth';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { SideSheet } from '@/components/ui/side-sheet';
import { toast } from '@/components/ui/toast';
import {
  useCreateCuentaSistemaMap,
  useCuentaSistemaMaps,
  useCuentasContables,
  useUpdateCuentaSistemaMap,
} from '../hooks/use-accounting-configuration';
import type { CuentaSistemaMap } from '../services/accounting-api';
import type { CuentaSistemaMapFormData } from '../schemas/accounting-configuration-schemas';
import { CuentaSistemaMapForm } from './cuenta-sistema-map-form';
import { CuentaSistemaMapsTable } from './cuenta-sistema-maps-table';

export function CuentaSistemaMapsManagement() {
  const [editing, setEditing] = useState<CuentaSistemaMap | undefined>();
  const [formOpen, setFormOpen] = useState(false);
  const { data: user } = useMe();
  const canManage = user?.user.rol === 'ADMIN';
  const { data: maps, isLoading, isError, refetch } = useCuentaSistemaMaps();
  const { data: cuentas, isLoading: isLoadingCuentas } = useCuentasContables({ imputable: true });
  const createMutation = useCreateCuentaSistemaMap();
  const updateMutation = useUpdateCuentaSistemaMap();
  const openCreate = () => {
    setEditing(undefined);
    setFormOpen(true);
  };
  const openEdit = (map: CuentaSistemaMap) => {
    setEditing(map);
    setFormOpen(true);
  };

  const submit = (data: CuentaSistemaMapFormData) => {
    if (editing) {
      updateMutation.mutate(
        {
          id: editing.id,
          data: {
            cuentaId: data.cuentaId,
            descripcion: data.descripcion || undefined,
            activo: data.activo,
          },
        },
        {
          onSuccess: () => {
            setFormOpen(false);
            toast.success('Mapeo actualizado.');
          },
        },
      );
      return;
    }
    createMutation.mutate(
      { ...data, descripcion: data.descripcion || undefined },
      {
        onSuccess: () => {
          setFormOpen(false);
          toast.success('Mapeo creado.');
        },
      },
    );
  };
  const mutationError = (editing ? updateMutation : createMutation).error;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h2 className="text-base font-semibold text-foreground">Mapeos de cuentas del sistema</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Relaciona cada evento del sistema con su cuenta contable.
          </p>
        </div>
        {canManage && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-4" aria-hidden="true" />
            Nuevo mapeo
          </Button>
        )}
      </div>
      {isError ? (
        <EmptyState
          icon={AlertTriangle}
          title="No pudimos cargar los mapeos."
          description="Revisa tu conexión e inténtalo nuevamente."
          action={
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Reintentar
            </Button>
          }
        />
      ) : (
        <CuentaSistemaMapsTable
          maps={maps ?? []}
          cuentas={cuentas ?? []}
          isLoading={isLoading || isLoadingCuentas}
          canManage={canManage}
          onEdit={openEdit}
          empty={
            <EmptyState
              icon={GitBranch}
              title="Aún no hay mapeos configurados."
              description="Crea un mapeo para asociar un evento del sistema a una cuenta imputable."
              action={
                canManage ? (
                  <Button size="sm" onClick={openCreate}>
                    <Plus className="size-4" aria-hidden="true" />
                    Nuevo mapeo
                  </Button>
                ) : undefined
              }
            />
          }
        />
      )}
      <SideSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editing ? 'Editar mapeo' : 'Nuevo mapeo'}
        description={
          editing
            ? 'Actualiza la cuenta o el estado del mapeo existente.'
            : 'Asocia un evento del sistema con una cuenta imputable.'
        }
      >
        {mutationError && (
          <Alert variant="destructive" className="mb-4">
            {mutationError.message}
          </Alert>
        )}
        <CuentaSistemaMapForm
          initialData={editing}
          cuentas={cuentas ?? []}
          onSubmit={submit}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      </SideSheet>
    </div>
  );
}
