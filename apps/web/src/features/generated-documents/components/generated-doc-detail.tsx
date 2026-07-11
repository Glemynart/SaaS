'use client';

import { useCallback, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, FileDown, Loader2, Printer, SearchX } from 'lucide-react';
import { useGeneratedDocument, useGeneratePdf } from '../hooks/use-generated-documents';
import { generatedDocumentsApi } from '../services/generated-documents-api';
import { DOCUMENT_TEMPLATE_TYPE_LABELS } from '@/features/document-templates/schemas/document-template-schemas';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { toast } from '@/components/ui/toast';
import { formatNombreCompleto } from '@saas/types';
import { cn } from '@/lib/utils';

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const backLink = (
  <Link
    href="/documentos/generados"
    className="mb-6 inline-flex items-center gap-2 rounded-md text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
  >
    <ArrowLeft className="size-4" aria-hidden="true" />
    Volver a documentos generados
  </Link>
);

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[--radius-card] border border-border bg-surface p-5 shadow-[--shadow-card]">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

export function GeneratedDocDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: doc, isLoading } = useGeneratedDocument(id);
  const generatePdfMutation = useGeneratePdf();

  const handleGeneratePdf = useCallback(() => {
    generatePdfMutation.mutate(id, {
      onSuccess: () => toast.success('PDF generado.'),
      onError: () => toast.error('No se pudo generar el PDF. Inténtalo de nuevo.'),
    });
  }, [id, generatePdfMutation]);

  const handleDownloadPdf = useCallback(() => {
    window.open(generatedDocumentsApi.getPdfUrl(id), '_blank');
  }, [id]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl">
        {backLink}
        <div className="mb-8 space-y-2">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-28 w-full" />
        <Skeleton className="mt-4 h-[28rem] w-full" />
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="mx-auto max-w-3xl">
        {backLink}
        <EmptyState
          icon={SearchX}
          title="Documento no encontrado."
          description="El documento que buscas no existe o no tienes acceso."
          action={
            <Link
              href="/documentos/generados"
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
            >
              Volver a documentos generados
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      {backLink}

      <PageHeader
        title={doc.nombre}
        description={`Generado el ${formatDate(doc.createdAt)}`}
        width="detail"
        className="max-w-none"
        actions={
          <>
            <StatusBadge
              domain="documentoGenerado"
              estado={doc.pdfUrl ? 'PDF_DISPONIBLE' : 'SIN_PDF'}
            />
            {doc.pdfUrl ? (
              <Button size="sm" onClick={handleDownloadPdf}>
                <FileDown className="size-4" aria-hidden="true" />
                Descargar PDF
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleGeneratePdf}
                disabled={generatePdfMutation.isPending}
              >
                {generatePdfMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Printer className="size-4" aria-hidden="true" />
                )}
                Generar PDF
              </Button>
            )}
          </>
        }
      >
        <SectionCard title="Origen del documento">
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Empleado
              </h3>
              <p className="mt-1 text-sm font-medium text-foreground">
                {formatNombreCompleto(doc.employee)}
              </p>
              <p className="text-xs text-muted-foreground">
                {doc.employee.tipoDocumento} {doc.employee.cedula} — {doc.employee.cargo}
                {doc.employee.sedeRef?.nombre && ` — ${doc.employee.sedeRef.nombre}`}
              </p>
            </div>
            <div>
              <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Plantilla utilizada
              </h3>
              <p className="mt-1 text-sm font-medium text-foreground">{doc.template.nombre}</p>
              <Badge className="mt-1">
                {DOCUMENT_TEMPLATE_TYPE_LABELS[doc.template.tipo] ?? doc.template.tipo}
              </Badge>
            </div>
          </div>
        </SectionCard>

        <section className="document-preview mt-4 rounded-[--radius-card] border border-border bg-surface p-8 shadow-[--shadow-card]">
          <h2 className="sr-only">Contenido del documento</h2>
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
        </section>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Este documento es una copia fiel del momento de su generación. Los datos del empleado
          pueden haber cambiado.
        </p>
      </PageHeader>
    </div>
  );
}
