import { cloneElement, isValidElement, type ReactNode } from 'react';
import type { FieldError } from 'react-hook-form';
import { Label } from '@/components/ui/label';

export function AuthField({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: FieldError;
  hint?: string;
  children: ReactNode;
}) {
  const describedBy =
    [hint ? `${htmlFor}-hint` : null, error ? `${htmlFor}-error` : null]
      .filter(Boolean)
      .join(' ') || undefined;

  const control =
    isValidElement<Record<string, unknown>>(children) && describedBy
      ? cloneElement(children, {
          'aria-describedby':
            [children.props['aria-describedby'], describedBy].filter(Boolean).join(' ') ||
            undefined,
          'aria-invalid': error ? true : undefined,
        })
      : children;

  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {control}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-sm text-destructive">
          {error.message}
        </p>
      ) : null}
      {hint ? (
        <p id={`${htmlFor}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
