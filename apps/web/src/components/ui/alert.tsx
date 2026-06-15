import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Alert({
  children,
  className,
  variant = 'default',
}: {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'destructive' | 'success';
}) {
  return (
    <div
      className={cn(
        'rounded-md border px-3 py-2 text-sm',
        variant === 'default' && 'border-border bg-surface text-muted-foreground',
        variant === 'destructive' && 'border-destructive/25 bg-destructive/8 text-destructive',
        variant === 'success' && 'border-success/25 bg-success/8 text-success',
        className,
      )}
      role={variant === 'destructive' ? 'alert' : 'status'}
    >
      {children}
    </div>
  );
}
