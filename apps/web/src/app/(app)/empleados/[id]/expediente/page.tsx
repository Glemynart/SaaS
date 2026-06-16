'use client';

import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft, FileText, FolderOpen, Trash2, Download, File } from 'lucide-react';
import { useEmployee } from '@/features/employees/hooks/use-employees';
import {
  useEmployeeFiles,
  useDeleteEmployeeFile,
} from '@/features/employee-files/hooks/use-employee-files';
import { generatedDocumentsApi } from '@/features/generated-documents/services/generated-documents-api';
import { formatNombreCompleto } from '@saas/types';
import { DOCUMENT_TEMPLATE_TYPE_LABELS } from '@/features/document-templates/schemas/document-template-schemas';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

const CATEGORY_LABELS: Record<string, string> = {
  CONTRACT: 'Contrato',
  CERTIFICATION: 'Certificación',
  MEMO: 'Memorando',
  LETTER: 'Carta',
  OTHER: 'Otro',
};

function categoryBadge(cat: string) {
  const map: Record<string, string> = {
    CONTRACT: 'bg-blue-50 text-blue-700 border-blue-200',
    CERTIFICATION: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    LETTER: 'bg-violet-50 text-violet-700 border-violet-200',
    MEMO: 'bg-amber-50 text-amber-700 border-amber-200',
    OTHER: 'bg-gray-50 text-gray-600 border-gray-200',
  };
  return map[cat] ?? map.OTHER;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatSize(bytes: number | null): string {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ExpedientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: employee, isLoading: empLoading } = useEmployee(id);
  const { data: filesData, isLoading: filesLoading } = useEmployeeFiles(id);
  const deleteMutation = useDeleteEmployeeFile();

  const isLoading = empLoading || filesLoading;
  const files = filesData?.files ?? [];
  const stats = filesData?.stats;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="py-10 text-center">
        <p className="text-muted-foreground">Empleado no encontrado.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`/empleados/${id}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            <span className="sr-only">Volver</span>
          </Link>
          <FileText className="size-5 text-muted-foreground" />
          <div>
            <h1 className="text-lg font-semibold tracking-[-0.018em] text-foreground">
              Expediente digital
            </h1>
            <p className="text-sm text-muted-foreground">{formatNombreCompleto(employee)}</p>
          </div>
        </div>
      </div>

      {stats && (
        <div className="mb-6 grid gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
            <p className="text-[0.68rem] font-medium uppercase tracking-wider text-muted-foreground">
              Documentos
            </p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{stats.total}</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
            <p className="text-[0.68rem] font-medium uppercase tracking-wider text-muted-foreground">
              Contratos
            </p>
            <p className="mt-1 text-2xl font-semibold text-blue-600">
              {stats.byCategory.CONTRACT ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
            <p className="text-[0.68rem] font-medium uppercase tracking-wider text-muted-foreground">
              Certificaciones
            </p>
            <p className="mt-1 text-2xl font-semibold text-emerald-600">
              {stats.byCategory.CERTIFICATION ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
            <p className="text-[0.68rem] font-medium uppercase tracking-wider text-muted-foreground">
              Último
            </p>
            <p className="mt-1 text-xs font-medium text-foreground">
              {stats.ultimoDocumento ? formatDate(stats.ultimoDocumento) : 'N/A'}
            </p>
          </div>
        </div>
      )}

      {files.length === 0 ? (
        <div className="flex h-72 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface/30">
          <FolderOpen className="mb-3 size-8 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">Expediente vacío</p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Generá documentos desde la ficha del empleado. Se agregarán automáticamente al
            expediente.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-white">
          <div className="divide-y divide-border">
            {files.map((file) => (
              <div
                key={file.id}
                className="group flex items-center justify-between px-5 py-3.5 transition-colors hover:bg-muted/40"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-muted-foreground">
                    <File className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{file.nombre}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <Badge className={categoryBadge(file.categoria)}>
                        {CATEGORY_LABELS[file.categoria] ?? file.categoria}
                      </Badge>
                      {file.generatedDocument && (
                        <span className="text-[0.65rem] text-muted-foreground/60">
                          {DOCUMENT_TEMPLATE_TYPE_LABELS[file.generatedDocument.tipo] ??
                            file.generatedDocument.tipo}
                        </span>
                      )}
                      <span className="text-[0.68rem] text-muted-foreground/60">
                        {formatSize(file.tamanoBytes)}
                      </span>
                      <span className="text-[0.68rem] text-muted-foreground/60">
                        {formatDate(file.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="ml-4 flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  {file.generatedDocumentId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-muted-foreground hover:text-foreground"
                      onClick={() =>
                        window.open(
                          generatedDocumentsApi.getPdfUrl(file.generatedDocumentId!),
                          '_blank',
                        )
                      }
                    >
                      <Download className="size-3.5" />
                      <span className="sr-only">Descargar</span>
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      if (confirm('¿Quitar este documento del expediente?')) {
                        deleteMutation.mutate(file.id);
                      }
                    }}
                  >
                    <Trash2 className="size-3.5" />
                    <span className="sr-only">Eliminar</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
