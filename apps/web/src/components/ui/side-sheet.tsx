'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBodyScrollLock } from '@/hooks/use-body-scroll-lock';
import { useFocusTrap } from '@/hooks/use-focus-trap';

interface SideSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function SideSheet({ open, onOpenChange, title, description, children }: SideSheetProps) {
  const titleId = React.useId();
  const descriptionId = React.useId();

  const containerRef = useFocusTrap(open);
  useBodyScrollLock(open);

  React.useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onOpenChange(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-(--z-overlay) flex items-center justify-center p-4 sm:p-6">
        <div
          className="absolute inset-0 bg-(--overlay) backdrop-blur-sm transition-opacity"
          onClick={() => onOpenChange(false)}
          aria-hidden="true"
        />
        {/* Panel */}
        <div
          ref={containerRef}
          className="relative z-10 flex h-[calc(100dvh-2rem)] max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-(--radius-panel) border border-border bg-surface p-6 shadow-(--shadow-overlay) transition-transform sm:h-[calc(100dvh-3rem)] sm:max-h-[calc(100dvh-3rem)]"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descriptionId : undefined}
        >
          <div className="flex h-full flex-col">
            <div className="flex items-start justify-between pb-4">
              <div>
                <h2 id={titleId} className="text-lg font-semibold text-foreground">
                  {title}
                </h2>
                {description && (
                  <p id={descriptionId} className="text-sm text-muted-foreground">
                    {description}
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 rounded-full p-0"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Cerrar</span>
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto pr-2">{children}</div>
          </div>
        </div>
      </div>
    </>
  );
}
