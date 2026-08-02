'use client';

import { use, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download, FileText } from 'lucide-react';
import {
  useContract,
  useGenerateContractDocument,
  useUpdateContractStatus,
} from '@/features/contracts/hooks/use-contracts';
import { generatedDocumentsApi } from '@/features/generated-documents/services/generated-documents-api';
import { formatNombreCompleto } from '@saas/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { toast } from '@/components/ui/toast';
import { getUserFacingError } from '@/lib/error-message';
import { useDocumentTemplates } from '@/features/document-templates/hooks/use-document-templates';

const TIPO_LABELS: Record<string, string> = {
  TERMINO_FIJO: 'Término Fijo',
  TERMINO_INDEFINIDO: 'Término Indefinido',
  OBRA_LABOR: 'Obra o Labor',
  APRENDIZAJE: 'Aprendizaje',
  PRESTACION_SERVICIOS: 'Prestación Servicios',
};

const VALID_TRANSITIONS: Record<string, { label: string; estado: string }[]> = {
  VIGENTE: [
    { label: 'Vencido', estado: 'VENCIDO' },
    { label: 'Terminado', estado: 'TERMINADO' },
    { label: 'Renovado', estado: 'RENOVADO' },
  ],
  VENCIDO: [{ label: 'Renovado', estado: 'RENOVADO' }],
};

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
function cop(n: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(n);
}

export default function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: contract, isLoading } = useContract(id);
  const statusMutation = useUpdateContractStatus();
  const generateDocumentMutation = useGenerateContractDocument();
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const { data: templateData, isLoading: templatesLoading } = useDocumentTemplates({
    page: 1,
    limit: 100,
    tipo: 'CONTRACT',
  });
  const activeContractTemplates = useMemo(
    () => templateData?.data.filter((template) => template.activo) ?? [],
    [templateData?.data],
  );

  useEffect(() => {
    if (!activeContractTemplates.some((template) => template.id === selectedTemplateId)) {
      setSelectedTemplateId(activeContractTemplates[0]?.id ?? '');
    }
  }, [activeContractTemplates, selectedTemplateId]);

  const handleStatus = useCallback(
    (estado: string) => {
      if (confirm(`¿Cambiar estado a ${estado}?`)) {
        statusMutation.mutate({ id, estado });
      }
    },
    [id, statusMutation],
  );

  const handleGenerateDocument = useCallback(() => {
    generateDocumentMutation.mutate(
      { id, templateId: selectedTemplateId || undefined },
      {
        onSuccess: () => toast.success('Documento contractual publicado en el expediente.'),
        onError: (error) =>
          toast.error(
            getUserFacingError(
              error,
              'No se pudo generar el documento contractual. Inténtalo de nuevo.',
            ),
          ),
      },
    );
  }, [generateDocumentMutation, id, selectedTemplateId]);

  if (isLoading)
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  if (!contract)
    return <div className="py-10 text-center text-muted-foreground">Contrato no encontrado.</div>;

  const transitions = VALID_TRANSITIONS[contract.estado] ?? [];
  const documentNeedsPublication =
    !contract.generatedDocument?.pdfUrl || !contract.generatedDocument.expedienteDocId;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/contratos"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <FileText className="size-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Contrato</h1>
          <StatusBadge
            domain="contrato"
            estado={contract.estado as 'VIGENTE' | 'VENCIDO' | 'TERMINADO' | 'RENOVADO'}
          />
        </div>
        {transitions.length > 0 && (
          <div className="flex gap-1">
            {transitions.map((t) => (
              <Button
                key={t.estado}
                variant="outline"
                size="sm"
                onClick={() => handleStatus(t.estado)}
                disabled={statusMutation.isPending}
              >
                {t.label}
              </Button>
            ))}
          </div>
        )}
        {contract.estado === 'VIGENTE' && documentNeedsPublication && (
          <>
            {activeContractTemplates.length > 1 && (
              <select
                aria-label="Plantilla de contrato"
                value={selectedTemplateId}
                onChange={(event) => setSelectedTemplateId(event.target.value)}
                disabled={templatesLoading || generateDocumentMutation.isPending}
                className="h-9 rounded-md border border-border bg-surface px-2 text-xs text-foreground"
              >
                {activeContractTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.nombre}
                  </option>
                ))}
              </select>
            )}
            <Button
              size="sm"
              onClick={handleGenerateDocument}
              disabled={templatesLoading || generateDocumentMutation.isPending}
            >
              <FileText className="size-4" aria-hidden="true" />
              {generateDocumentMutation.isPending
                ? 'Generando...'
                : contract.generatedDocument
                  ? 'Reintentar documento'
                  : 'Generar documento'}
            </Button>
          </>
        )}
      </div>

      <div className="mb-6 rounded-lg border border-border bg-surface/50 p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <span className="text-xs text-muted-foreground">Empleado</span>
            <p className="text-sm font-medium">{formatNombreCompleto(contract.empleado)}</p>
            <p className="text-xs text-muted-foreground">
              {contract.empleado.tipoDocumento ?? ''} {contract.empleado.cedula}
            </p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Sede</span>
            <p className="text-sm">{contract.sede?.nombre ?? '—'}</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted-foreground">Tipo</dt>
            <dd className="font-medium">{TIPO_LABELS[contract.tipo] ?? contract.tipo}</dd>
            <dt className="text-muted-foreground">Cargo</dt>
            <dd className="font-medium">{contract.cargo}</dd>
            <dt className="text-muted-foreground">Salario</dt>
            <dd className="font-medium">{cop(contract.salario)}</dd>
            <dt className="text-muted-foreground">Inicio</dt>
            <dd>{formatDate(contract.fechaInicio)}</dd>
            <dt className="text-muted-foreground">Fin</dt>
            <dd>{contract.fechaFin ? formatDate(contract.fechaFin) : 'Indefinido'}</dd>
          </div>
          <div className="space-y-3">
            <div>
              <span className="text-xs text-muted-foreground">Plantilla</span>
              <p className="text-sm">{contract.plantilla?.nombre ?? '—'}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Lote</span>
              <p className="text-sm">{contract.lote ? `${contract.lote.estado}` : 'Individual'}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Creado</span>
              <p className="text-sm">{formatDate(contract.createdAt)}</p>
            </div>
            {contract.generatedDocument && (
              <div>
                <span className="text-xs text-muted-foreground">Documento contractual</span>
                <p className="truncate text-sm">{contract.generatedDocument.nombre}</p>
                <div className="mt-1 flex gap-2">
                  {contract.generatedDocument.pdfUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        window.open(
                          generatedDocumentsApi.getPdfUrl(contract.generatedDocument!.id),
                          '_blank',
                        )
                      }
                    >
                      <Download className="size-3.5" aria-hidden="true" />
                      PDF
                    </Button>
                  )}
                  {contract.generatedDocument.expedienteDocId && (
                    <Link
                      href={`/empleados/${contract.empleado.id}/expediente`}
                      className="inline-flex h-8 items-center px-2 text-sm text-muted-foreground hover:text-foreground"
                    >
                      Ver en expediente
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
