import type { InputHTMLAttributes } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface AccountingCheckboxFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
}

export function AccountingCheckboxField({
  id,
  label,
  disabled,
  ...props
}: AccountingCheckboxFieldProps) {
  return (
    <div className="flex items-center gap-3">
      <Input
        id={id}
        type="checkbox"
        className="size-4 accent-primary"
        disabled={disabled}
        {...props}
      />
      <Label htmlFor={id} className={disabled ? 'text-muted-foreground' : undefined}>
        {label}
      </Label>
    </div>
  );
}
