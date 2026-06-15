import type { FieldError } from 'react-hook-form';
import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';

export function AuthField({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: FieldError;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? <p className="text-sm text-destructive">{error.message}</p> : null}
    </div>
  );
}
