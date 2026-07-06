import * as React from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type FieldControlProps = {
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean | 'true' | 'false';
};

interface FormFieldProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  /** Control único (Input, Select, etc.) — se le inyectan id/aria-describedby/aria-invalid. */
  children: React.ReactElement<FieldControlProps>;
}

/**
 * FormField — label+control+error+ayuda (DESIGN-SYSTEM.md §6.6). El control
 * hijo recibe id/aria-describedby/aria-invalid por composición (cloneElement),
 * nunca por convención manual del consumidor.
 */
export function FormField({ label, error, hint, required, className, children }: FormFieldProps) {
  const generatedId = React.useId();
  const errorId = React.useId();
  const hintId = React.useId();

  const controlId = children.props.id ?? generatedId;
  const describedBy =
    [error && errorId, hint && !error && hintId].filter(Boolean).join(' ') || undefined;

  const control = React.cloneElement(children, {
    id: controlId,
    'aria-describedby': describedBy,
    'aria-invalid': error ? true : undefined,
  });

  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={controlId}>
        {label}
        {required && (
          <span className="text-destructive" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </Label>
      {control}
      {hint && !error && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
