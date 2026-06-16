'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useDocumentTemplate } from '../hooks/use-document-templates';
import {
  DOCUMENT_TEMPLATE_TYPE_LABELS,
  AVAILABLE_VARIABLES,
} from '../schemas/document-template-schemas';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { DocumentTemplateType } from '../services/document-templates-api';
import { ArrowLeft, FileText, Variable } from 'lucide-react';

function typeBadgeClass(tipo: DocumentTemplateType): string {
  const map: Record<DocumentTemplateType, string> = {
    CONTRACT: 'bg-blue-50 text-blue-700 border-blue-200',
    CERTIFICATION: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    LETTER: 'bg-violet-50 text-violet-700 border-violet-200',
    MEMO: 'bg-amber-50 text-amber-700 border-amber-200',
  };
  return map[tipo] ?? '';
}

function highlightVariables(html: string): string {
  return html.replace(
    /\{\{([A-Z_]+)\}\}/g,
    '<span style="display:inline-block;border-radius:4px;background:var(--color-muted);padding:0 5px;font-family:monospace;font-size:0.75rem;font-weight:500;color:var(--color-primary)">{{$1}}</span>',
  );
}

function isHtml(str: string): boolean {
  return /<(p|h[1-3]|ul|ol|li|blockquote|hr|br|strong|em|div|table)[\s>]/.test(str);
}

export function TemplateDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: template, isLoading } = useDocumentTemplate(id);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-[32rem] w-full rounded-xl" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-muted-foreground">Plantilla no encontrada.</p>
        <Link
          href="/documentos/plantillas"
          className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-border bg-surface px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          Volver a plantillas
        </Link>
      </div>
    );
  }

  const html = isHtml(template.contenido);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/documentos/plantillas"
          className="inline-flex h-8 w-8 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          <span className="sr-only">Volver</span>
        </Link>
        <FileText className="size-5 text-muted-foreground" aria-hidden="true" />
        <h1 className="text-lg font-semibold tracking-[-0.018em] text-foreground">
          {template.nombre}
        </h1>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Badge className={typeBadgeClass(template.tipo)}>
          {DOCUMENT_TEMPLATE_TYPE_LABELS[template.tipo] ?? template.tipo}
        </Badge>
        {template.descripcion && (
          <p className="text-sm text-muted-foreground">{template.descripcion}</p>
        )}
        <span className="text-xs text-muted-foreground/60">
          {template.activo ? 'Activa' : 'Inactiva'}
        </span>
      </div>

      <div className="mb-6 rounded-lg border border-border bg-surface/50 p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Variable className="size-3.5" aria-hidden="true" />
          Variables utilizadas en esta plantilla
        </div>
        <div className="flex flex-wrap gap-1.5">
          {AVAILABLE_VARIABLES.filter((v) => template.contenido.includes(`{{${v.key}}}`)).map(
            (v) => (
              <span
                key={v.key}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-white px-2 py-0.5 font-mono text-[0.68rem] text-muted-foreground"
              >
                {`{{${v.key}}}`}
              </span>
            ),
          )}
          {AVAILABLE_VARIABLES.filter((v) => template.contenido.includes(`{{${v.key}}}`)).length ===
            0 && (
            <span className="text-xs text-muted-foreground/50">
              No se detectaron variables en el contenido.
            </span>
          )}
        </div>
      </div>

      <div className="document-preview rounded-xl border border-border bg-white p-8 shadow-sm">
        {html ? (
          <div
            className="text-sm leading-relaxed text-foreground"
            dangerouslySetInnerHTML={{ __html: highlightVariables(template.contenido) }}
          />
        ) : (
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {template.contenido.split(/(\{\{[A-Z_]+\}\})/g).map((part, i) => {
              if (part.match(/^\{\{[A-Z_]+\}\}$/)) {
                return (
                  <span
                    key={i}
                    className="inline-block rounded bg-accent/10 px-1.5 font-mono text-xs font-medium text-accent"
                  >
                    {part}
                  </span>
                );
              }
              return <span key={i}>{part}</span>;
            })}
          </div>
        )}
      </div>

      <div className="mt-4 text-center text-xs text-muted-foreground/60">
        Vista previa — Las variables se reemplazarán al generar el documento desde un empleado.
      </div>
    </div>
  );
}
