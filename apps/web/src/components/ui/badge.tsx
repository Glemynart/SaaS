import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// Derivation rule (DESIGN-SYSTEM.md §3.2): state surfaces are never solid —
// tint background at /8, tinted border at /25, text at full token opacity.
// `neutral` is the pre-existing look (unchanged) and stays the default so
// every current consumer renders identically without passing a variant.
const badgeVariants = cva(
  'inline-flex h-6 items-center gap-1 rounded-full border px-2.5 text-xs font-medium',
  {
    variants: {
      variant: {
        neutral: 'border-border bg-surface text-muted-foreground',
        info: 'border-info/25 bg-info/8 text-info',
        success: 'border-success/25 bg-success/8 text-success',
        warning: 'border-warning/25 bg-warning/8 text-warning',
        danger: 'border-destructive/25 bg-destructive/8 text-destructive',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => (
    <span className={cn(badgeVariants({ variant, className }))} ref={ref} {...props} />
  ),
);
Badge.displayName = 'Badge';

export { badgeVariants };
