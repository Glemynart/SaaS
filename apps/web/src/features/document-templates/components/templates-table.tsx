import {
  type DocumentTemplate,
  type DocumentTemplateType,
} from '../services/document-templates-api';
import { DOCUMENT_TEMPLATE_TYPE_LABELS } from '../schemas/document-template-schemas';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Pencil, Trash2, Copy, Power, PowerOff } from 'lucide-react';

interface TemplatesTableProps {
  templates: DocumentTemplate[];
  isLoading: boolean;
  onEdit: (template: DocumentTemplate) => void;
  onDelete: (id: string) => void;
  onView: (id: string) => void;
  onDuplicate: (id: string) => void;
  onToggleActive: (id: string) => void;
}

function typeBadgeClass(tipo: DocumentTemplateType): string {
  const map: Record<DocumentTemplateType, string> = {
    CONTRACT: 'bg-blue-50 text-blue-700 border-blue-200',
    CERTIFICATION: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    LETTER: 'bg-violet-50 text-violet-700 border-violet-200',
    MEMO: 'bg-amber-50 text-amber-700 border-amber-200',
  };
  return map[tipo] ?? '';
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function TemplatesTable({
  templates,
  isLoading,
  onEdit,
  onDelete,
  onView,
  onDuplicate,
  onToggleActive,
}: TemplatesTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-[4.5rem] w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="flex h-72 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface/30">
        <FileText className="mb-3 size-8 text-muted-foreground/40" aria-hidden="true" />
        <p className="text-sm font-medium text-muted-foreground">No hay plantillas todavía</p>
        <p className="mt-1 text-xs text-muted-foreground/70">
          Creá tu primera plantilla o usá las plantillas base sugeridas
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white">
      <div className="divide-y divide-border">
        {templates.map((tpl) => (
          <div
            key={tpl.id}
            className={`group flex items-center justify-between px-5 py-4 transition-colors hover:bg-muted/40 ${
              !tpl.activo ? 'opacity-60' : ''
            }`}
          >
            <button type="button" className="flex-1 text-left" onClick={() => onView(tpl.id)}>
              <div className="flex items-start gap-3">
                <div
                  className={`mt-1 flex size-8 shrink-0 items-center justify-center rounded-md border ${
                    tpl.activo ? 'border-border bg-surface' : 'border-border/50 bg-muted/30'
                  } text-muted-foreground`}
                >
                  <FileText className="size-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{tpl.nombre}</p>
                    {!tpl.activo && (
                      <span className="text-[0.65rem] text-muted-foreground/60">Inactiva</span>
                    )}
                  </div>
                  {tpl.descripcion && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {tpl.descripcion}
                    </p>
                  )}
                  <div className="mt-1.5 flex items-center gap-2">
                    <Badge className={typeBadgeClass(tpl.tipo)}>
                      {DOCUMENT_TEMPLATE_TYPE_LABELS[tpl.tipo] ?? tpl.tipo}
                    </Badge>
                    <span className="text-[0.68rem] text-muted-foreground/60">
                      {formatDate(tpl.updatedAt)}
                    </span>
                  </div>
                </div>
              </div>
            </button>

            <div className="ml-4 flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onToggleActive(tpl.id)}
                className="h-8 px-2 text-muted-foreground hover:text-foreground"
                title={tpl.activo ? 'Desactivar' : 'Activar'}
              >
                {tpl.activo ? <PowerOff className="size-3.5" /> : <Power className="size-3.5" />}
                <span className="sr-only">{tpl.activo ? 'Desactivar' : 'Activar'}</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDuplicate(tpl.id)}
                className="h-8 px-2 text-muted-foreground hover:text-foreground"
                title="Duplicar"
              >
                <Copy className="size-3.5" />
                <span className="sr-only">Duplicar</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(tpl)}
                className="h-8 px-2 text-muted-foreground hover:text-foreground"
              >
                <Pencil className="size-3.5" />
                <span className="sr-only">Editar</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (confirm('¿Eliminar esta plantilla?')) {
                    onDelete(tpl.id);
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
