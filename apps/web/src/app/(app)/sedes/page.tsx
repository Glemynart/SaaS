'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SideSheet } from '@/components/ui/side-sheet';
import { SedesTable } from '@/features/sedes/components/sedes-table';
import { SedeForm } from '@/features/sedes/components/sede-form';
import { useSedes, useCreateSede, useUpdateSede } from '@/features/sedes/hooks/use-sedes';
import { type Sede } from '@/features/sedes/services/sedes-api';
import { type SedeFormData } from '@/features/sedes/schemas/sede-schemas';

export default function SedesPage() {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedSede, setSelectedSede] = useState<Sede | undefined>();

  const { data, isLoading, isError } = useSedes({});
  const createMutation = useCreateSede();
  const updateMutation = useUpdateSede();

  const activeMutation = selectedSede ? updateMutation : createMutation;

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
        { onSuccess: () => setIsSheetOpen(false) },
      );
    } else {
      createMutation.mutate(formData, {
        onSuccess: () => setIsSheetOpen(false),
      });
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Sedes</h1>
          <p className="text-sm text-gray-500">
            Gestiona las sedes y centros de trabajo de tu organización.
          </p>
        </div>
        <Button onClick={handleOpenCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Nueva Sede
        </Button>
      </div>

      <div className="flex-1">
        {isError ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-red-200 bg-red-50/50">
            <p className="text-sm text-red-600">
              No se pudieron cargar las sedes. Intenta nuevamente.
            </p>
          </div>
        ) : (
          <SedesTable sedes={data ?? []} isLoading={isLoading} onEdit={handleOpenEdit} />
        )}
      </div>

      <SideSheet
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        title={selectedSede ? 'Editar Sede' : 'Nueva Sede'}
        description={
          selectedSede
            ? 'Modifica los datos de la sede.'
            : 'Ingresa la información para registrar una nueva sede.'
        }
      >
        {activeMutation.error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {activeMutation.error.message}
          </div>
        )}
        <SedeForm
          initialData={selectedSede}
          onSubmit={handleSubmit}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      </SideSheet>
    </div>
  );
}
