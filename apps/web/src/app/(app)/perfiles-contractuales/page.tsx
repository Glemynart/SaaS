'use client';

import { useCallback, useState } from 'react';
import { Plus, Tags, AlertTriangle } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { SideSheet } from '@/components/ui/side-sheet';
import { toast } from '@/components/ui/toast';
import {
  ContractualProfileForm,
  type ContractualProfileFormData,
} from '@/features/contractual-profiles/components/contractual-profile-form';
import { ContractualProfilesTable } from '@/features/contractual-profiles/components/contractual-profiles-table';
import {
  useContractualProfiles,
  useCreateContractualProfile,
  useUpdateContractualProfile,
  useUpdateContractualProfileStatus,
} from '@/features/contractual-profiles/hooks/use-contractual-profiles';
import type { ContractualProfile } from '@/features/contractual-profiles/services/contractual-profiles-api';

export default function ContractualProfilesPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<ContractualProfile | undefined>();
  const [pendingStatus, setPendingStatus] = useState<ContractualProfile | null>(null);

  const { data, isLoading, isError, refetch } = useContractualProfiles({
    search: search || undefined,
    activo: status === '' ? undefined : status === 'true',
  });
  const createMutation = useCreateContractualProfile();
  const updateMutation = useUpdateContractualProfile();
  const statusMutation = useUpdateContractualProfileStatus();

  const openCreate = useCallback(() => {
    setSelectedProfile(undefined);
    setSheetOpen(true);
  }, []);

  const openEdit = useCallback((profile: ContractualProfile) => {
    setSelectedProfile(profile);
    setSheetOpen(true);
  }, []);

  function handleSubmit(formData: ContractualProfileFormData) {
    if (selectedProfile) {
      updateMutation.mutate(
        {
          id: selectedProfile.id,
          data: {
            nombre: formData.nombre,
            descripcion: formData.descripcion || undefined,
          },
        },
        {
          onSuccess: () => {
            setSheetOpen(false);
            toast.success('Perfil contractual actualizado.');
          },
          onError: (error) => toast.error(error.message),
        },
      );
      return;
    }

    createMutation.mutate(
      {
        codigo: formData.codigo.trim().toUpperCase(),
        nombre: formData.nombre,
        descripcion: formData.descripcion || undefined,
      },
      {
        onSuccess: () => {
          setSheetOpen(false);
          toast.success('Perfil contractual creado.');
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  function handleToggleStatus(profile: ContractualProfile) {
    if (profile.activo) {
      setPendingStatus(profile);
      return;
    }
    statusMutation.mutate(
      { id: profile.id, activo: true },
      {
        onSuccess: () => toast.success('Perfil contractual activado.'),
        onError: (error) => toast.error(error.message),
      },
    );
  }

  const mutationError = createMutation.error ?? updateMutation.error ?? statusMutation.error;

  return (
    <PageHeader
      title="Perfiles contractuales"
      description="Define las clasificaciones laborales que usarás para vincular a tus empleados."
      width="wide"
      actions={
        <Button size="sm" onClick={openCreate}>
          <Plus className="size-4" aria-hidden="true" />
          Nuevo perfil contractual
        </Button>
      }
    >
      {mutationError && (
        <Alert variant="destructive" className="mb-4">
          {mutationError.message}
        </Alert>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <Input
          aria-label="Buscar perfiles contractuales"
          placeholder="Buscar por código o nombre"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Select
          aria-label="Filtrar perfiles contractuales por estado"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="">Todos los estados</option>
          <option value="true">Activos</option>
          <option value="false">Inactivos</option>
        </Select>
      </div>

      {isError ? (
        <EmptyState
          icon={AlertTriangle}
          title="No pudimos cargar los perfiles contractuales."
          description="Revisa tu conexión e inténtalo de nuevo."
          action={
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Reintentar
            </Button>
          }
        />
      ) : (
        <ContractualProfilesTable
          profiles={data ?? []}
          isLoading={isLoading}
          onEdit={openEdit}
          onToggleStatus={handleToggleStatus}
          empty={
            <EmptyState
              icon={Tags}
              title="Aún no hay perfiles contractuales."
              description="Crea el primer perfil para clasificar los vínculos laborales de tu equipo."
              action={
                <Button size="sm" onClick={openCreate}>
                  <Plus className="size-4" aria-hidden="true" />
                  Nuevo perfil contractual
                </Button>
              }
            />
          }
        />
      )}

      <SideSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title={selectedProfile ? 'Editar perfil contractual' : 'Nuevo perfil contractual'}
        description={
          selectedProfile
            ? 'Actualiza el nombre o la descripción sin cambiar el código histórico.'
            : 'Crea una clasificación laboral para usarla en los vínculos precontractuales.'
        }
      >
        <ContractualProfileForm
          initialData={selectedProfile}
          onSubmit={handleSubmit}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      </SideSheet>

      <ConfirmDialog
        level={1}
        open={pendingStatus !== null}
        onOpenChange={(open) => {
          if (!open) setPendingStatus(null);
        }}
        title="Desactivar perfil contractual"
        description={
          pendingStatus
            ? `${pendingStatus.nombre} dejará de estar disponible para nuevos vínculos laborales. Los vínculos históricos se conservan.`
            : ''
        }
        confirmLabel="Desactivar perfil"
        onConfirm={async () => {
          if (!pendingStatus) return;
          await statusMutation.mutateAsync({ id: pendingStatus.id, activo: false });
          setPendingStatus(null);
          toast.success('Perfil contractual desactivado.');
        }}
      />
    </PageHeader>
  );
}
