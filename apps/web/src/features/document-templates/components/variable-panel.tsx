import { AVAILABLE_VARIABLES } from '../schemas/document-template-schemas';
import { Variable } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VariablePanelProps {
  onInsert: (variableKey: string) => void;
}

export function VariablePanel({ onInsert }: VariablePanelProps) {
  return (
    <div className="rounded-lg border border-border bg-surface/50 p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Variable className="size-3.5" aria-hidden="true" />
        Variables disponibles
      </div>
      <div className="space-y-1.5">
        {AVAILABLE_VARIABLES.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => onInsert(v.key)}
            className={cn(
              'flex w-full items-center justify-between rounded-md border border-border bg-white px-3 py-2',
              'text-left transition-colors hover:border-accent hover:bg-accent/5',
              'focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1',
            )}
          >
            <span className="text-xs font-mono font-medium text-accent">{`{{${v.key}}}`}</span>
            <span className="ml-2 truncate text-[0.68rem] text-muted-foreground">{v.label}</span>
          </button>
        ))}
      </div>
      <p className="mt-3 text-[0.68rem] leading-relaxed text-muted-foreground/70">
        Haz clic en una variable para insertarla en la posición del cursor.
      </p>
    </div>
  );
}
