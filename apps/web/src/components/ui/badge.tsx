import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center rounded-full border border-border bg-surface px-2.5 text-xs font-medium text-muted-foreground',
        className,
      )}
    >
      {children}
    </span>
  );
}
