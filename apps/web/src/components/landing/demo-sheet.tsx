'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const demoSchema = z.object({
  nombre: z.string().min(2, 'Ingrese su nombre completo'),
  organizacion: z.string().min(2, 'Ingrese el nombre de su organización'),
  cargo: z.string().min(2, 'Ingrese su cargo'),
  email: z.string().email('Ingrese un correo electrónico válido'),
  telefono: z.string().min(7, 'Ingrese un número de teléfono válido'),
  planta: z.enum(['menos50', '50a100', '100a300', 'mas300'], {
    required_error: 'Seleccione el tamaño de su planta',
  }),
  dolor: z.enum(['contratos', 'expedientes', 'vencimientos', 'otro']).optional(),
});

type DemoFormValues = z.infer<typeof demoSchema>;

const plantaOptions = [
  { value: 'menos50', label: 'Menos de 50 personas' },
  { value: '50a100', label: 'Entre 50 y 100 personas' },
  { value: '100a300', label: 'Entre 100 y 300 personas' },
  { value: 'mas300', label: 'Más de 300 personas' },
] as const;

const dolorOptions = [
  { value: 'contratos', label: 'Generación de contratos' },
  { value: 'expedientes', label: 'Gestión de expedientes' },
  { value: 'vencimientos', label: 'Control de vencimientos' },
  { value: 'otro', label: 'Otro proceso' },
] as const;

interface DemoSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DemoSheet({ open, onOpenChange }: DemoSheetProps) {
  const [submitted, setSubmitted] = React.useState(false);
  const [submittedName, setSubmittedName] = React.useState('');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DemoFormValues>({
    resolver: zodResolver(demoSchema),
  });

  const selectedPlanta = watch('planta');
  const selectedDolor = watch('dolor');

  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  function handleClose() {
    onOpenChange(false);
    setTimeout(() => {
      setSubmitted(false);
      setSubmittedName('');
      reset();
    }, 300);
  }

  async function onSubmit(data: DemoFormValues) {
    await new Promise((r) => setTimeout(r, 800));
    setSubmittedName(data.nombre.split(' ')[0]);
    setSubmitted(true);
  }

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[--z-overlay] bg-[--overlay] backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Solicitar demo gratuita"
        className="fixed inset-y-0 right-0 z-[--z-overlay] flex w-full max-w-lg flex-col border-l border-border bg-surface shadow-[--shadow-overlay]"
      >
        <div className="flex items-start justify-between border-b border-border px-6 py-5">
          <div>
            <p className="text-base font-semibold text-foreground">Solicitar demo gratuita</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Le contactamos en menos de 24 horas hábiles.
            </p>
          </div>
          <button
            onClick={handleClose}
            className="ml-4 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Cerrar"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {submitted ? (
            <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[color-mix(in_oklch,var(--success)_12%,transparent)]">
                <CheckCircle2 className="size-7 text-success" />
              </div>
              <div>
                <p className="text-base font-semibold text-foreground">¡Solicitud recibida!</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {submittedName ? `${submittedName}, nuestro` : 'Nuestro'} equipo revisará su
                  información y se comunicará con usted en menos de 24 horas hábiles para coordinar
                  la demostración.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handleClose} className="mt-2">
                Cerrar
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
              <FormField label="Nombre completo" error={errors.nombre?.message} required>
                <Input
                  {...register('nombre')}
                  placeholder="María González"
                  autoComplete="name"
                  aria-invalid={!!errors.nombre}
                />
              </FormField>

              <FormField
                label="Nombre de la organización"
                error={errors.organizacion?.message}
                required
              >
                <Input
                  {...register('organizacion')}
                  placeholder="Operadora Educativa Los Andes SAS"
                  autoComplete="organization"
                  aria-invalid={!!errors.organizacion}
                />
              </FormField>

              <FormField label="Su cargo" error={errors.cargo?.message} required>
                <Input
                  {...register('cargo')}
                  placeholder="Director Administrativo"
                  autoComplete="organization-title"
                  aria-invalid={!!errors.cargo}
                />
              </FormField>

              <FormField label="Correo electrónico" error={errors.email?.message} required>
                <Input
                  {...register('email')}
                  type="email"
                  placeholder="maria@operadora.com"
                  autoComplete="email"
                  aria-invalid={!!errors.email}
                />
              </FormField>

              <FormField label="Teléfono o celular" error={errors.telefono?.message} required>
                <Input
                  {...register('telefono')}
                  type="tel"
                  placeholder="+57 300 000 0000"
                  autoComplete="tel"
                  aria-invalid={!!errors.telefono}
                />
              </FormField>

              <FormField
                label="¿Cuántas personas tiene en su planta de personal?"
                error={errors.planta?.message}
                required
              >
                <div className="grid grid-cols-2 gap-2" role="group" aria-label="Tamaño de planta">
                  {plantaOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setValue('planta', opt.value, { shouldValidate: true })}
                      className={cn(
                        'rounded-md border px-3 py-2.5 text-left text-sm font-medium transition-[border-color,background-color] duration-150',
                        selectedPlanta === opt.value
                          ? 'border-primary bg-[color-mix(in_oklch,var(--primary)_7%,transparent)] text-foreground'
                          : 'border-border bg-control text-muted-foreground hover:border-input hover:text-foreground',
                      )}
                      aria-pressed={selectedPlanta === opt.value}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </FormField>

              <FormField label="¿Qué proceso le genera más dificultad hoy?" hint="Opcional">
                <div className="grid grid-cols-2 gap-2" role="group" aria-label="Proceso difícil">
                  {dolorOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() =>
                        setValue('dolor', selectedDolor === opt.value ? undefined : opt.value)
                      }
                      className={cn(
                        'rounded-md border px-3 py-2.5 text-left text-sm font-medium transition-[border-color,background-color] duration-150',
                        selectedDolor === opt.value
                          ? 'border-primary bg-[color-mix(in_oklch,var(--primary)_7%,transparent)] text-foreground'
                          : 'border-border bg-control text-muted-foreground hover:border-input hover:text-foreground',
                      )}
                      aria-pressed={selectedDolor === opt.value}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </FormField>

              <div className="pt-2">
                <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                  {isSubmitting ? 'Enviando...' : 'Solicitar mi demo gratuita'}
                </Button>
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  Sin compromiso · Sin tarjeta de crédito · Sin contrato de implementación
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
}

function FormField({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  const id = React.useId();
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
          {required && (
            <span className="ml-1 text-destructive" aria-hidden="true">
              *
            </span>
          )}
        </Label>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<{ id: string }>, { id })
        : children}
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
