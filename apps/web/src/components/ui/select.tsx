import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

/**
 * Select — L1, reemplaza los `<select>` estilados a mano con `focus:ring-accent`
 * (TR-03, CON-03, LOT-02). Nativo a propósito: conserva el teclado nativo del
 * elemento (DESIGN-SYSTEM.md §6.6) en lugar de reconstruir un listbox propio.
 * Contrato de foco idéntico a Input (§4.4).
 */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          'flex h-10 w-full appearance-none rounded-md border border-input bg-control px-3 py-2 pr-9 text-sm text-foreground transition-[border-color,box-shadow] duration-150 ease-out focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
    </div>
  ),
);
Select.displayName = 'Select';
