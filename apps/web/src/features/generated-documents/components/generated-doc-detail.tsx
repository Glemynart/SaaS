'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useGeneratedDocument, useGeneratePdf } from '../hooks/use-generated-documents';
import { generatedDocumentsApi } from '../services/generated-documents-api';
import { DOCUMENT_TEMPLATE_TYPE_LABELS } from '@/features/document-templates/schemas/document-template-schemas';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, FileText, FileDown, Loader2, Printer } from 'lucide-react';
import { formatNombreCompleto } from '@saas/types';

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function GeneratedDocDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: doc, isLoading } = useGeneratedDocument(id);
  const generatePdfMutation = useGeneratePdf();

  const handleGeneratePdf = useCallback(() => {
    generatePdfMutation.mutate(id);
  }, [id, generatePdfMutation]);

  const handleDownloadPdf = useCallback(() => {
    window.open(generatedDocumentsApi.getPdfUrl(id), '_blank');
  }, [id]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-[32rem] w-full rounded-xl" />
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-sm text-muted-foreground">Documento no encontrado.</p>
        <Link
          href="/documentos/generados"
          className="mt-4 inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-border bg-surface px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          Volver a documentos generados
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/documentos/generados"
            className="inline-flex h-8 w-8 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            <span className="sr-only">Volver</span>
          </Link>
          <FileText className="size-5 text-muted-foreground" aria-hidden="true" />
          <h1 className="text-lg font-semibold tracking-[-0.018em] text-foreground">
            {doc.nombre}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {doc.pdfUrl ? (
            <Button size="sm" className="gap-1.5" onClick={handleDownloadPdf}>
              <FileDown className="size-4" />
              Descargar PDF
            </Button>
          ) : (
            <Button
              size="sm"
              className="gap-1.5"
              onClick={handleGeneratePdf}
              disabled={generatePdfMutation.isPending}
            >
              {generatePdfMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Printer className="size-4" />
              )}
              Generar PDF
            </Button>
          )}
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Badge>{DOCUMENT_TEMPLATE_TYPE_LABELS[doc.tipo] ?? doc.tipo}</Badge>
        <span className="text-sm text-muted-foreground">
          Generado el {formatDate(doc.createdAt)}
        </span>
        {doc.pdfUrl && (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[0.68rem] font-medium text-green-700">
            <FileDown className="size-3" />
            PDF disponible
          </span>
        )}
      </div>

      <div className="mb-6 rounded-lg border border-border bg-surface/50 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <span className="text-[0.68rem] font-medium uppercase tracking-wider text-muted-foreground">
              Empleado
            </span>
            <p className="mt-0.5 text-sm text-foreground">{formatNombreCompleto(doc.employee)}</p>
            <p className="text-xs text-muted-foreground">
              {doc.employee.tipoDocumento} {doc.employee.cedula} — {doc.employee.cargo}
              {doc.employee.sedeRef?.nombre && ` — ${doc.employee.sedeRef.nombre}`}
            </p>
          </div>
          <div>
            <span className="text-[0.68rem] font-medium uppercase tracking-wider text-muted-foreground">
              Plantilla utilizada
            </span>
            <p className="mt-0.5 text-sm text-foreground">{doc.template.nombre}</p>
            <p className="text-xs text-muted-foreground">
              {DOCUMENT_TEMPLATE_TYPE_LABELS[doc.template.tipo] ?? doc.template.tipo}
            </p>
          </div>
        </div>
      </div>

      <div className="document-preview rounded-xl border border-border bg-white p-8 shadow-sm">
        {/<\/?[a-z][\s\S]*>/i.test(doc.contenidoFinal) ? (
          <div
            className="text-sm leading-relaxed text-foreground"
            dangerouslySetInnerHTML={{ __html: doc.contenidoFinal }}
          />
        ) : (
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {doc.contenidoFinal}
          </div>
        )}
      </div>

      <div className="mt-4 text-center text-xs text-muted-foreground/60">
        Este documento es un snapshot del momento de su generación. Los datos del empleado pueden
        haber cambiado.
      </div>
    </div>
  );
}
