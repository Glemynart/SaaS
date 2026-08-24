'use client';

import * as React from 'react';
import { Loader2, X } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { useBodyScrollLock } from '@/hooks/use-body-scroll-lock';
import { useFocusTrap } from '@/hooks/use-focus-trap';

interface ConfirmDialogBaseProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Consequence in one sentence (DS §6.5). */
  description: string;
  /** The real verb, e.g. "Desactivar empleado" — never "Aceptar"/"OK"/"Sí". */
  confirmLabel: string;
  cancelLabel?: string;
  confirmVariant?: ButtonProps['variant'];
  onConfirm: () => void | Promise<void>;
}

type ConfirmDialogProps =
  | ({ level: 1 } & ConfirmDialogBaseProps)
  | ({ level: 2; correction: string } & ConfirmDialogBaseProps);

/**
 * ConfirmDialog — the two-level confirmation contract (DESIGN-SYSTEM.md §6.5),
 * replacing `window.confirm` (TR-04). Nivel 1: destructivo recuperable, Esc y
 * backdrop cierran. Nivel 2: irreversible de dominio, explica el efecto y la
 * vía de corrección, sin Esc/backdrop — exige una acción explícita.
 */
export function ConfirmDialog(props: ConfirmDialogProps) {
  const {
    open,
    onOpenChange,
    title,
    description,
    confirmLabel,
    cancelLabel = 'Cancelar',
    confirmVariant = 'destructive',
    onConfirm,
    level,
  } = props;
  const correction = level === 2 ? props.correction : undefined;

  const [isPending, setIsPending] = React.useState(false);
  const titleId = React.useId();
  const descriptionId = React.useId();

  const containerRef = useFocusTrap(open);
  useBodyScrollLock(open);

  const dismissible = level === 1 && !isPending;

  React.useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && dismissible) {
        onOpenChange(false);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, dismissible, onOpenChange]);

  if (!open) return null;

  async function handleConfirm() {
    setIsPending(true);
    try {
      await onConfirm();
    } finally {
      setIsPending(false);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-(--z-overlay) bg-(--overlay) transition-opacity"
        onClick={() => dismissible && onOpenChange(false)}
        aria-hidden="true"
      />
      <div
        className="fixed inset-0 z-(--z-overlay) flex items-center justify-center p-4"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <div
          ref={containerRef}
          className="w-full max-w-sm rounded-(--radius-card) border border-border bg-surface p-5 shadow-(--shadow-overlay)"
        >
          <div className="flex items-start justify-between gap-3">
            <h2 id={titleId} className="text-sm font-semibold text-foreground">
              {title}
            </h2>
            {level === 1 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 shrink-0 rounded-full p-0"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                <X className="size-4" aria-hidden="true" />
                <span className="sr-only">Cancelar</span>
              </Button>
            )}
          </div>

          <p id={descriptionId} className="mt-2 text-sm text-muted-foreground">
            {description}
          </p>

          {level === 2 && correction && (
            <p className="mt-2 text-sm text-muted-foreground">{correction}</p>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              {cancelLabel}
            </Button>
            <Button variant={confirmVariant} size="sm" onClick={handleConfirm} disabled={isPending}>
              {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
