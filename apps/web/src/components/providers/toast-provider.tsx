'use client';

import 'sonner/dist/styles.css';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { Toaster } from 'sonner';

/**
 * Single global toast region (DESIGN-SYSTEM.md §6.5 — contrato de feedback).
 * Mounted once in the app layout. Surface stays flat/neutral (tokens only);
 * the toast type is communicated by icon + text label, never by color alone
 * (§4.1) — success/info/warning/error only tint the icon.
 */
export function ToastProvider() {
  return (
    <Toaster
      position="bottom-right"
      closeButton
      style={{ '--z-index': 'var(--z-overlay)' } as React.CSSProperties}
      icons={{
        success: <CheckCircle2 className="size-4 text-success" aria-hidden="true" />,
        info: <Info className="size-4 text-info" aria-hidden="true" />,
        warning: <AlertTriangle className="size-4 text-warning" aria-hidden="true" />,
        error: <XCircle className="size-4 text-destructive" aria-hidden="true" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            'rounded-[--radius-card] border border-border bg-surface text-foreground shadow-[--shadow-overlay]',
          title: 'text-foreground text-sm font-medium',
          description: 'text-muted-foreground text-sm',
          actionButton: 'bg-primary text-primary-foreground rounded-[--radius-control]',
          cancelButton: 'bg-muted text-muted-foreground rounded-[--radius-control]',
          closeButton: 'border-border bg-surface text-muted-foreground',
        },
      }}
    />
  );
}
