'use client';

import { useCallback, useState } from 'react';
import { AlertTriangle, Link2, Plus } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { SideSheet } from '@/components/ui/side-sheet';
import { toast } from '@/components/ui/toast';
import { useContractualProfiles } from '@/features/contractual-profiles/hooks/use-contractual-profiles';
import {
  useCreateDocumentProfileConfiguration,
  useDocumentProfileConfigurations,
  useUpdateDocumentProfileConfiguration,
} from '@/features/document-profile-configurations/hooks/use-document-profile-configurations';
import {
  DocumentProfileConfigurationForm,
  type DocumentProfileConfigurationFormValues,
} from '@/features/document-profile-configurations/components/document-profile-configuration-form';
import { DocumentProfileConfigurationsTable } from '@/features/document-profile-configurations/components/document-profile-configurations-table';
import type { DocumentProfileConfiguration } from '@/features/document-profile-configurations/services/document-profile-configurations-api';
import { useDocumentTemplates } from '@/features/document-templates/hooks/use-document-templates';

export default function DocumentProfileConfigurationsPage() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedConfiguration, setSelectedConfiguration] = useState<
    DocumentProfileConfiguration | undefined
  >();

  const configurationsQuery = useDocumentProfileConfigurations();
  const profilesQuery = useContractualProfiles({ activo: true });
  const templatesQuery = useDocumentTemplates({ page: 1, limit: 100 });
  const createMutation = useCreateDocumentProfileConfiguration();
  const updateMutation = useUpdateDocumentProfileConfiguration();

  const openCreate = useCallback(() => {
    setSelectedConfiguration(undefined);
    setSheetOpen(true);
  }, []);

  const openEdit = useCallback((configuration: DocumentProfileConfiguration) => {
    setSelectedConfiguration(configuration);
    setSheetOpen(true);
  }, []);

  function handleSubmit(values: DocumentProfileConfigurationFormValues) {
    if (selectedConfiguration) {
      updateMutation.mutate(
        {
          id: selectedConfiguration.id,
          data: {
            plantillaId: values.plantillaId,
            vigenteDesde: values.vigenteDesde,
            vigenteHasta: values.vigenteHasta || null,
            activo: values.activo,
          },
        },
        {
          onSuccess: () => {
            setSheetOpen(false);
            toast.success('Configuración documental actualizada.');
          },
          onError: (error) => toast.error(error.message),
        },
      );
      return;
    }

    createMutation.mutate(
      {
        perfilContractualId: values.perfilContractualId,
        tipoDocumental: values.tipoDocumental,
        plantillaId: values.plantillaId,
        vigenteDesde: values.vigenteDesde,
        ...(values.vigenteHasta && { vigenteHasta: values.vigenteHasta }),
        activo: values.activo,
      },
      {
        onSuccess: () => {
          setSheetOpen(false);
          toast.success('Configuración documental creada.');
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  const queryError = configurationsQuery.error ?? profilesQuery.error ?? templatesQuery.error;
  const profiles = profilesQuery.data ?? [];
  const templates = templatesQuery.data?.data ?? [];
  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const isLoading =
    configurationsQuery.isLoading || profilesQuery.isLoading || templatesQuery.isLoading;

  return (
    <PageHeader
      title="Configuración documental"
      description="Define qué plantilla corresponde a cada perfil contractual y tipo documental."
      width="wide"
      actions={
        <Button
          size="sm"
          onClick={openCreate}
          disabled={profiles.length === 0 || templates.length === 0}
        >
          <Plus className="size-4" aria-hidden="true" />
          Nueva configuración
        </Button>
      }
    >
      {queryError ? (
        <EmptyState
          icon={AlertTriangle}
          title="No pudimos cargar la configuración documental."
          description="Revisa tu conexión e inténtalo de nuevo."
          action={
            <Button variant="outline" size="sm" onClick={() => configurationsQuery.refetch()}>
              Reintentar
            </Button>
          }
        />
      ) : (
        <>
          {(profiles.length === 0 || templates.length === 0) && !isLoading && (
            <Alert className="mb-5 flex items-start gap-3">
              <Link2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                Para crear una regla necesitas al menos un perfil contractual activo y una plantilla
                documental.
                {profiles.length === 0 && ' Crea primero un perfil contractual.'}
                {templates.length === 0 && ' Crea primero una plantilla.'}
              </span>
            </Alert>
          )}
          <DocumentProfileConfigurationsTable
            configurations={configurationsQuery.data ?? []}
            isLoading={isLoading}
            onEdit={openEdit}
            empty={
              <EmptyState
                icon={Link2}
                title="Aún no hay reglas documentales."
                description="Asocia un perfil contractual, un tipo documental y una plantilla para habilitar la resolución documental."
                action={
                  <Button
                    size="sm"
                    onClick={openCreate}
                    disabled={profiles.length === 0 || templates.length === 0}
                  >
                    <Plus className="size-4" aria-hidden="true" />
                    Nueva configuración
                  </Button>
                }
              />
            }
          />
        </>
      )}

      <SideSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title={
          selectedConfiguration
            ? 'Editar configuración documental'
            : 'Nueva configuración documental'
        }
        description="La combinación perfil–tipo debe tener una sola regla activa por vigencia."
      >
        <DocumentProfileConfigurationForm
          profiles={profiles}
          templates={templates}
          initialData={selectedConfiguration}
          onSubmit={handleSubmit}
          isLoading={isSubmitting}
        />
      </SideSheet>
    </PageHeader>
  );
}
