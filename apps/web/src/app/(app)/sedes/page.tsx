'use client';

import { useState, useCallback } from 'react';
import { AlertTriangle, Building2, Plus } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { SideSheet } from '@/components/ui/side-sheet';
import { toast } from '@/components/ui/toast';
import { SedesTable } from '@/features/sedes/components/sedes-table';
import { SedesFilters } from '@/features/sedes/components/sedes-filters';
import { SedeForm } from '@/features/sedes/components/sede-form';
import { useSedes, useCreateSede, useUpdateSede } from '@/features/sedes/hooks/use-sedes';
import { type Sede } from '@/features/sedes/services/sedes-api';
import { type SedeFormData } from '@/features/sedes/schemas/sede-schemas';

export default function SedesPage() {
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState('');
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedSede, setSelectedSede] = useState<Sede | undefined>();

  const { data, isLoading, isError, refetch } = useSedes({
    search: search || undefined,
    activo: estado === '' ? undefined : estado === 'true',
  });
  const createMutation = useCreateSede();
  const updateMutation = useUpdateSede();

  const hasFilters = search !== '' || estado !== '';

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
  }, []);

  const handleStatusChange = useCallback((value: string) => {
    setEstado(value);
  }, []);

  const handleOpenCreate = () => {
    setSelectedSede(undefined);
    setIsSheetOpen(true);
  };

  const handleOpenEdit = (sede: Sede) => {
    setSelectedSede(sede);
    setIsSheetOpen(true);
  };

  const handleSubmit = (formData: SedeFormData) => {
    if (selectedSede) {
      updateMutation.mutate(
        { id: selectedSede.id, data: formData },
        {
          onSuccess: () => {
            setIsSheetOpen(false);
            toast.success('Cambios guardados.');
          },
          onError: () => toast.error('No se pudieron guardar los cambios. Inténtalo de nuevo.'),
        },
      );
    } else {
      createMutation.mutate(formData, {
        onSuccess: () => {
          setIsSheetOpen(false);
          toast.success('Sede creada.');
        },
        onError: () => toast.error('No se pudo crear la sede. Inténtalo de nuevo.'),
      });
    }
  };

  return (
    <PageHeader
      title="Sedes"
      description="Gestiona las sedes y centros de trabajo de tu organización."
      width="wide"
      actions={
        <Button size="sm" onClick={handleOpenCreate}>
          <Plus className="size-4" aria-hidden="true" />
          Nueva sede
        </Button>
      }
    >
      <SedesFilters onSearchChange={handleSearchChange} onStatusChange={handleStatusChange} />

      {isError ? (
        <EmptyState
          icon={AlertTriangle}
          title="No pudimos cargar las sedes."
          description="Revisa tu conexión e inténtalo de nuevo."
          action={
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Reintentar
            </Button>
          }
        />
      ) : (
        <SedesTable
          sedes={data ?? []}
          isLoading={isLoading}
          onEdit={handleOpenEdit}
          empty={
            hasFilters ? (
              <EmptyState
                title="Sin resultados para esta búsqueda."
                description="Ajusta la búsqueda o el filtro de estado para ver más sedes."
              />
            ) : (
              <EmptyState
                icon={Building2}
                title="Aún no hay sedes registradas."
                description="Crea la primera sede para organizar a tu equipo por centro de trabajo."
                action={
                  <Button size="sm" onClick={handleOpenCreate}>
                    <Plus className="size-4" aria-hidden="true" />
                    Nueva sede
                  </Button>
                }
              />
            )
          }
        />
      )}

      <SideSheet
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        title={selectedSede ? 'Editar sede' : 'Nueva sede'}
        description={
          selectedSede
            ? 'Modifica los datos de la sede.'
            : 'Ingresa la información para registrar una nueva sede.'
        }
      >
        {(selectedSede ? updateMutation : createMutation).error && (
          <Alert variant="destructive" className="mb-4">
            {(selectedSede ? updateMutation : createMutation).error?.message}
          </Alert>
        )}
        <SedeForm
          initialData={selectedSede}
          onSubmit={handleSubmit}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      </SideSheet>
    </PageHeader>
  );
}
