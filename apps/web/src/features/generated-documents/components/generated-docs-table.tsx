import { type GeneratedDocument } from '../services/generated-documents-api';
import { formatNombreCompleto } from '@saas/types';
import { DOCUMENT_TEMPLATE_TYPE_LABELS } from '@/features/document-templates/schemas/document-template-schemas';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Trash2, Eye } from 'lucide-react';

interface GeneratedDocsTableProps {
  documents: GeneratedDocument[];
  isLoading: boolean;
  onView: (id: string) => void;
  onDelete: (id: string) => void;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function GeneratedDocsTable({
  documents,
  isLoading,
  onView,
  onDelete,
}: GeneratedDocsTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-[5rem] w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="flex h-72 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface/30">
        <FileText className="mb-3 size-8 text-muted-foreground/40" aria-hidden="true" />
        <p className="text-sm font-medium text-muted-foreground">No hay documentos generados</p>
        <p className="mt-1 text-xs text-muted-foreground/70">
          Generá documentos desde la ficha de un empleado
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white">
      <div className="divide-y divide-border">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="group flex items-center justify-between px-5 py-3.5 transition-colors hover:bg-muted/40"
          >
            <button type="button" className="flex-1 text-left" onClick={() => onView(doc.id)}>
              <div className="flex items-start gap-3">
                <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-muted-foreground">
                  <FileText className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{doc.nombre}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatNombreCompleto(doc.employee)} — {doc.employee.cargo}
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <Badge>{DOCUMENT_TEMPLATE_TYPE_LABELS[doc.tipo] ?? doc.tipo}</Badge>
                    <span className="text-[0.68rem] text-muted-foreground/60">
                      {formatDate(doc.createdAt)}
                    </span>
                  </div>
                </div>
              </div>
            </button>

            <div className="ml-4 flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onView(doc.id)}
                className="h-8 px-2 text-muted-foreground hover:text-foreground"
              >
                <Eye className="size-3.5" />
                <span className="sr-only">Ver</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (confirm('¿Eliminar este documento generado?')) {
                    onDelete(doc.id);
                  }
                }}
                className="h-8 px-2 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
                <span className="sr-only">Eliminar</span>
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
