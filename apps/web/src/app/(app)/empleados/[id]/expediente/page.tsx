'use client';

import { use, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Download,
  FolderOpen,
  History as HistoryIcon,
  Loader2,
  RefreshCw,
  SearchX,
  Upload,
} from 'lucide-react';
import { useEmployee } from '@/features/employees/hooks/use-employees';
import {
  useExpedienteDocs,
  useExpedienteDocHistory,
  useUploadExpedienteDoc,
} from '@/features/expediente-docs/hooks/use-expediente-docs';
import {
  expedienteDocsApi,
  type ExpedienteDoc,
} from '@/features/expediente-docs/services/expediente-docs-api';
import { generatedDocumentsApi } from '@/features/generated-documents/services/generated-documents-api';
import { formatNombreCompleto } from '@saas/types';
import { DOCUMENT_TEMPLATE_TYPE_LABELS } from '@/features/document-templates/schemas/document-template-schemas';
import { ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { SideSheet } from '@/components/ui/side-sheet';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

const CATEGORY_LABELS: Record<string, string> = {
  CONTRATO: 'Contrato',
  CERTIFICADO: 'Certificación',
  AFILIACION: 'Afiliación',
  DOCUMENTO_PERSONAL: 'Documento personal',
  PREAVISO: 'Preaviso',
  TERMINACION: 'Terminación',
  OTRO: 'Otro',
};

const UPLOAD_CATEGORIES = [
  'CONTRATO',
  'AFILIACION',
  'CERTIFICADO',
  'DOCUMENTO_PERSONAL',
  'PREAVISO',
  'TERMINACION',
  'OTRO',
] as const;

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatSize(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StatTile({
  label,
  value,
  size = 'lg',
}: {
  label: string;
  value: string | number;
  /** 'sm' para valores largos (fechas) que no caben en cifra grande. */
  size?: 'lg' | 'sm';
}) {
  return (
    <div className="rounded-(--radius-card) border border-border bg-surface p-4 shadow-(--shadow-card)">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className={cn(
          'font-semibold text-foreground',
          size === 'lg' ? 'mt-1 text-2xl' : 'mt-2.5 text-sm',
        )}
      >
        {value}
      </p>
    </div>
  );
}

export default function ExpedientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: employee, isLoading: empLoading } = useEmployee(id);
  const { data: docsData, isLoading: docsLoading } = useExpedienteDocs(id);
  const uploadMutation = useUploadExpedienteDoc();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCategory, setUploadCategory] = useState<(typeof UPLOAD_CATEGORIES)[number]>('OTRO');
  const [uploadFamiliaId, setUploadFamiliaId] = useState<string | null>(null);
  const [historyDoc, setHistoryDoc] = useState<ExpedienteDoc | null>(null);
  const { data: historyData, isLoading: historyLoading } = useExpedienteDocHistory(
    historyDoc?.id ?? '',
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isLoading = empLoading || docsLoading;
  const docs = docsData?.docs ?? [];
  const stats = docsData?.stats;

  const resetUpload = () => {
    setUploadFile(null);
    setUploadCategory('OTRO');
    setUploadFamiliaId(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openUpload = (
    familiaId: string | null = null,
    categoria: (typeof UPLOAD_CATEGORIES)[number] = 'OTRO',
  ) => {
    resetUpload();
    setUploadFamiliaId(familiaId);
    setUploadCategory(categoria);
    setUploadOpen(true);
  };

  const handleUpload = () => {
    if (!uploadFile) return;
    uploadMutation.mutate(
      {
        employeeId: id,
        file: uploadFile,
        categoria: uploadCategory,
        familiaId: uploadFamiliaId,
      },
      {
        onSuccess: () => {
          toast.success('Documento subido al expediente.');
          setUploadOpen(false);
          resetUpload();
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  const backLink = (
    <Link
      href={`/empleados/${id}`}
      className="mb-6 inline-flex items-center gap-2 rounded-md text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      Volver al empleado
    </Link>
  );

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl">
        {backLink}
        <div className="mb-8 space-y-2">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="mb-6 grid gap-4 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="mx-auto max-w-4xl">
        <Link
          href="/empleados"
          className="mb-6 inline-flex items-center gap-2 rounded-md text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Volver a empleados
        </Link>
        <EmptyState
          icon={SearchX}
          title="Empleado no encontrado."
          description="El empleado que buscas no existe o no tienes acceso."
          action={
            <Link
              href="/empleados"
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
            >
              Volver a empleados
            </Link>
          }
        />
      </div>
    );
  }

  const columns: DataTableColumn<ExpedienteDoc>[] = [
    {
      key: 'documento',
      header: 'Documento',
      render: (doc) => (
        <div className="min-w-0">
          <p className="font-medium text-foreground">{doc.nombre}</p>
          {doc.generatedDocument && (
            <p className="truncate text-xs text-muted-foreground">
              {DOCUMENT_TEMPLATE_TYPE_LABELS[doc.generatedDocument.tipo] ??
                doc.generatedDocument.tipo}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'categoria',
      header: 'Categoría',
      render: (doc) => <Badge>{CATEGORY_LABELS[doc.categoria] ?? doc.categoria}</Badge>,
    },
    {
      key: 'tamano',
      header: 'Tamaño',
      render: (doc) => <span className="text-muted-foreground">{formatSize(doc.tamanoBytes)}</span>,
    },
    {
      key: 'version',
      header: 'Versión',
      render: (doc) => <Badge variant={doc.vigente ? 'success' : 'neutral'}>v{doc.version}</Badge>,
    },
    {
      key: 'agregado',
      header: 'Agregado',
      render: (doc) => <span className="text-muted-foreground">{formatDate(doc.createdAt)}</span>,
    },
    {
      key: 'acciones',
      header: 'Acciones',
      headerClassName: 'text-right',
      cellClassName: 'text-right',
      render: (doc) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-muted-foreground hover:text-foreground"
            onClick={() => setHistoryDoc(doc)}
          >
            <HistoryIcon className="size-3.5" aria-hidden="true" />
            <span className="sr-only">Ver historial de {doc.nombre}</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-muted-foreground hover:text-foreground"
            onClick={() =>
              window.open(
                doc.generatedDocumentId
                  ? generatedDocumentsApi.getPdfUrl(doc.generatedDocumentId)
                  : expedienteDocsApi.getDownloadUrl(doc.id),
                '_blank',
              )
            }
          >
            <Download className="size-3.5" aria-hidden="true" />
            <span className="sr-only">Descargar {doc.nombre}</span>
          </Button>
          {!doc.generatedDocumentId && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-muted-foreground hover:text-foreground"
              onClick={() =>
                openUpload(doc.familiaId, doc.categoria as (typeof UPLOAD_CATEGORIES)[number])
              }
            >
              <RefreshCw className="size-3.5" aria-hidden="true" />
              <span className="sr-only">Crear nueva versiÃ³n de {doc.nombre}</span>
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      {backLink}

      <PageHeader
        title="Expediente digital"
        description={formatNombreCompleto(employee)}
        width="standard"
        className="max-w-none"
        actions={
          <Button size="sm" onClick={() => openUpload()}>
            <Upload className="size-4" aria-hidden="true" />
            Subir documento
          </Button>
        }
      >
        {stats && (
          <div className="mb-6 grid gap-4 sm:grid-cols-4">
            <StatTile label="Documentos" value={stats.total} />
            <StatTile label="Contratos" value={stats.byCategory.CONTRATO ?? 0} />
            <StatTile label="Certificaciones" value={stats.byCategory.CERTIFICADO ?? 0} />
            <StatTile
              label="Último"
              size="sm"
              value={stats.ultimoDocumento ? formatDate(stats.ultimoDocumento) : '—'}
            />
          </div>
        )}

        <DataTable
          columns={columns}
          data={docs}
          rowKey={(doc) => doc.id}
          empty={
            <EmptyState
              icon={FolderOpen}
              title="Expediente vacío."
              description="Genera documentos desde la ficha del empleado; se agregarán automáticamente al expediente."
            />
          }
        />
      </PageHeader>

      <SideSheet
        open={uploadOpen}
        onOpenChange={(open) => {
          setUploadOpen(open);
          if (!open && !uploadMutation.isPending) resetUpload();
        }}
        title={uploadFamiliaId ? 'Crear nueva versiÃ³n' : 'Subir documento'}
        description={
          uploadFamiliaId
            ? 'La nueva revisiÃ³n conservarÃ¡ la familia documental actual.'
            : 'Agrega un PDF o una imagen al expediente del empleado.'
        }
      >
        <div className="flex h-full flex-col">
          <div className="flex-1 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="expediente-file">Archivo</Label>
              <Input
                ref={fileInputRef}
                id="expediente-file"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">PDF, JPG, PNG o WebP. Máximo 5 MB.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expediente-category">Categoría</Label>
              <Select
                id="expediente-category"
                value={uploadCategory}
                onChange={(event) =>
                  setUploadCategory(event.target.value as (typeof UPLOAD_CATEGORIES)[number])
                }
                disabled={!!uploadFamiliaId}
              >
                {UPLOAD_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {CATEGORY_LABELS[category] ?? category}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3 border-t border-border pt-4">
            <Button
              variant="outline"
              onClick={() => setUploadOpen(false)}
              disabled={uploadMutation.isPending}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!uploadFile || uploadMutation.isPending}
              className="flex-1"
            >
              {uploadMutation.isPending && (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              )}
              {uploadFamiliaId ? 'Crear versiÃ³n' : 'Subir documento'}
            </Button>
          </div>
        </div>
      </SideSheet>

      <SideSheet
        open={historyDoc !== null}
        onOpenChange={(open) => {
          if (!open) setHistoryDoc(null);
        }}
        title="Historial documental"
        description={historyData?.family.nombre ?? historyDoc?.nombre}
      >
        {historyLoading && (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        )}
        {!historyLoading && historyData && (
          <div className="space-y-3">
            {historyData.revisions.map((revision) => (
              <div
                key={revision.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border p-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant={revision.vigente ? 'success' : 'neutral'}>
                      v{revision.version}
                    </Badge>
                    {revision.vigente && (
                      <span className="text-xs text-muted-foreground">Vigente</span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-sm font-medium text-foreground">
                    {revision.nombre}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDate(revision.createdAt)}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  onClick={() =>
                    window.open(
                      revision.generatedDocumentId
                        ? generatedDocumentsApi.getPdfUrl(revision.generatedDocumentId)
                        : expedienteDocsApi.getDownloadUrl(revision.id),
                      '_blank',
                    )
                  }
                >
                  <Download className="size-3.5" aria-hidden="true" />
                  Descargar
                </Button>
              </div>
            ))}
          </div>
        )}
      </SideSheet>
    </div>
  );
}
