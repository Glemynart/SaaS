'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, SearchX, Variable } from 'lucide-react';
import { useDocumentTemplate } from '../hooks/use-document-templates';
import {
  DOCUMENT_TEMPLATE_TYPE_LABELS,
  AVAILABLE_VARIABLES,
} from '../schemas/document-template-schemas';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { SafeDocumentHtml } from '@/components/security/safe-document-html';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';

function highlightVariables(html: string): string {
  return html.replace(/\{\{([A-Z_]+)\}\}/g, '<span data-document-variable="true">{{$1}}</span>');
}

function isHtml(str: string): boolean {
  return /<(p|h[1-3]|ul|ol|li|blockquote|hr|br|strong|em|div|table)[\s>]/.test(str);
}

const backLink = (
  <Link
    href="/documentos/plantillas"
    className="mb-6 inline-flex items-center gap-2 rounded-md text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
  >
    <ArrowLeft className="size-4" aria-hidden="true" />
    Volver a plantillas
  </Link>
);

export function TemplateDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: template, isLoading } = useDocumentTemplate(id);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl">
        {backLink}
        <div className="mb-8 space-y-2">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="mt-4 h-[28rem] w-full" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="mx-auto max-w-3xl">
        {backLink}
        <EmptyState
          icon={SearchX}
          title="Plantilla no encontrada."
          description="La plantilla que buscas no existe o no tienes acceso."
          action={
            <Link
              href="/documentos/plantillas"
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
            >
              Volver a plantillas
            </Link>
          }
        />
      </div>
    );
  }

  const html = isHtml(template.contenido);
  const usedVariables = AVAILABLE_VARIABLES.filter((v) =>
    template.contenido.includes(`{{${v.key}}}`),
  );

  return (
    <div className="mx-auto max-w-3xl">
      {backLink}

      <PageHeader
        title={template.nombre}
        description={template.descripcion ?? undefined}
        width="detail"
        className="max-w-none"
        actions={
          <>
            <Badge>{DOCUMENT_TEMPLATE_TYPE_LABELS[template.tipo] ?? template.tipo}</Badge>
            <StatusBadge domain="plantilla" estado={template.activo ? 'ACTIVA' : 'INACTIVA'} />
          </>
        }
      >
        <section className="rounded-[--radius-card] border border-border bg-surface p-5 shadow-[--shadow-card]">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Variable className="size-4 text-muted-foreground" aria-hidden="true" />
            Variables utilizadas en esta plantilla
          </h2>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {usedVariables.map((v) => (
              <span
                key={v.key}
                className="inline-flex items-center rounded-md border border-border bg-canvas px-2 py-0.5 font-mono text-xs text-muted-foreground"
              >
                {`{{${v.key}}}`}
              </span>
            ))}
            {usedVariables.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No se detectaron variables en el contenido.
              </p>
            )}
          </div>
        </section>

        <section className="document-preview mt-4 rounded-[--radius-card] border border-border bg-surface p-8 shadow-[--shadow-card]">
          <h2 className="sr-only">Contenido de la plantilla</h2>
          {html ? (
            <SafeDocumentHtml
              className="text-sm leading-relaxed text-foreground"
              html={highlightVariables(template.contenido)}
            />
          ) : (
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {template.contenido.split(/(\{\{[A-Z_]+\}\})/g).map((part, i) => {
                if (part.match(/^\{\{[A-Z_]+\}\}$/)) {
                  return (
                    <span
                      key={i}
                      className="inline-block rounded bg-muted px-1.5 font-mono text-xs font-medium text-primary"
                    >
                      {part}
                    </span>
                  );
                }
                return <span key={i}>{part}</span>;
              })}
            </div>
          )}
        </section>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Vista previa — las variables se reemplazarán al generar el documento desde un empleado.
        </p>
      </PageHeader>
    </div>
  );
}
