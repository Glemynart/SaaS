import {
  AlertCircle,
  ArrowRight,
  BellRing,
  Building2,
  FileStack,
  FileText,
  Layers,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HeroSectionProps {
  onDemoOpen: () => void;
}

const capabilities = [
  { icon: FileStack, label: 'Hasta 500 contratos por lote' },
  { icon: BellRing, label: 'Alertas a 30, 15 y 7 días' },
  { icon: Building2, label: 'Multiempresa incluido' },
  { icon: Zap, label: 'Operativo el mismo día' },
];

export function HeroSection({ onDemoOpen }: HeroSectionProps) {
  return (
    <section className="entry-canvas border-b border-border" aria-labelledby="hero-heading">
      <div className="mx-auto max-w-6xl px-5 pb-16 pt-28 sm:px-8 sm:pt-32 lg:pb-24 lg:pt-36">
        <div className="lg:grid lg:grid-cols-12 lg:items-center lg:gap-12">
          {/* Text column */}
          <div className="max-w-2xl lg:col-span-7">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-1.5 shadow-(--shadow-inset-hi)">
              <span className="h-1.5 w-1.5 rounded-full bg-primary/60" aria-hidden="true" />
              <span className="text-xs font-medium text-muted-foreground">
                Para operadores educativos colombianos
              </span>
            </div>

            {/* Headline */}
            <h1
              id="hero-heading"
              className="mt-6 text-balance text-4xl font-semibold leading-[1.12] tracking-[-0.035em] text-foreground sm:text-5xl sm:leading-[1.07] lg:text-6xl lg:leading-[1.03]"
            >
              Gestione su planta de personal, sus contratos y su expediente sin depender del Excel.
            </h1>

            {/* Subheadline */}
            <p className="mt-6 max-w-xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              Centralice la gestión laboral de su organización en una sola plataforma. Genere
              contratos masivos en minutos, mantenga el expediente digital de cada persona y reciba
              alertas antes de que venzan los contratos.
            </p>

            {/* CTAs */}
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Button size="lg" onClick={onDemoOpen} className="h-11 px-6 text-sm font-semibold">
                Solicitar demo gratuita
              </Button>
              <a
                href="#como-funciona"
                className="inline-flex h-11 items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Ver cómo funciona
                <ArrowRight className="size-4" aria-hidden="true" />
              </a>
            </div>

            {/* Trust signal */}
            <p className="mt-5 text-xs text-muted-foreground">
              Sin tarjeta de crédito · Sin contrato de implementación · Sin instalación
            </p>
          </div>

          {/* Visual column — captura de la Bandeja del día */}
          <div className="mt-16 lg:col-span-5 lg:mt-0" aria-hidden="true">
            <div className="relative mx-auto max-w-md lg:max-w-none">
              {/* Profundidad de folios */}
              <div className="absolute inset-0 translate-x-5 translate-y-5 rounded-(--radius-panel) border border-border-soft bg-[color-mix(in_oklch,var(--surface)_48%,var(--canvas))]" />
              <div className="absolute inset-0 translate-x-2.5 translate-y-2.5 rounded-(--radius-panel) border border-border-soft bg-[color-mix(in_oklch,var(--surface)_72%,var(--canvas))]" />

              <div className="product-frame relative">
                {/* Encabezado de página del producto */}
                <div className="border-b border-border-soft px-4 py-3.5">
                  <p className="text-sm font-semibold tracking-[-0.018em] text-foreground">
                    Inicio
                  </p>
                  <p className="mt-0.5 text-2xs text-muted-foreground">
                    Hola, Laura. Tienes 4 asuntos por atender hoy.
                  </p>
                </div>

                {/* Banda: requiere acción */}
                <p className="px-4 pb-1 pt-3 text-2xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  Requiere acción · 2
                </p>
                <BandejaMockRow
                  icon={FileText}
                  asunto="El contrato de María Pérez venció"
                  chip={{ tone: 'danger', label: 'Vencido' }}
                  meta="hace 2 días · María Pérez"
                  accion="Ver empleado"
                />
                <BandejaMockRow
                  icon={AlertCircle}
                  asunto="Faltan documentos en el expediente de Juan Gómez"
                  chip={{ tone: 'danger', label: 'Crítica' }}
                  meta="desde ayer · Juan Gómez"
                  accion="Resolver"
                />

                {/* Banda: esta semana */}
                <p className="px-4 pb-1 pt-3 text-2xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  Esta semana · 2
                </p>
                <BandejaMockRow
                  icon={FileText}
                  asunto="El contrato de Ana Martínez vence pronto"
                  chip={{ tone: 'warning', label: 'Atención' }}
                  meta="vence en 5 días"
                  accion="Ver empleado"
                />
                <BandejaMockRow
                  icon={Layers}
                  asunto="El lote «Contratos enero» está en proceso"
                  chip={{ tone: 'info', label: 'En proceso' }}
                  meta="128 de 200 generados"
                  accion="Ver lote"
                  last
                />
              </div>
            </div>
          </div>
        </div>

        {/* Capacidades de la plataforma (integradas al hero) */}
        <ul
          className="mt-16 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-border-soft pt-6 lg:mt-20"
          aria-label="Capacidades de la plataforma"
          role="list"
        >
          {capabilities.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="flex items-center gap-2 text-2xs font-medium uppercase tracking-[0.08em] text-muted-foreground"
            >
              <Icon className="size-3.5 flex-shrink-0 text-primary/70" aria-hidden="true" />
              {label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* Fila calcada de la anatomía real de BandejaRow (features/dashboard). Decorativa. */
function BandejaMockRow({
  icon: Icon,
  asunto,
  chip,
  meta,
  accion,
  last,
}: {
  icon: typeof FileText;
  asunto: string;
  chip: { tone: 'danger' | 'warning' | 'info'; label: string };
  meta: string;
  accion: string;
  last?: boolean;
}) {
  const chipClass =
    chip.tone === 'danger'
      ? 'border-destructive/25 bg-destructive/8 text-destructive'
      : chip.tone === 'warning'
        ? 'border-warning/25 bg-warning/8 text-warning'
        : 'border-info/25 bg-info/8 text-info';

  return (
    <div
      className={`flex items-center gap-3 border-t border-border-soft px-4 py-3 ${last ? 'pb-4' : ''}`}
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-(--radius-control) border border-border bg-surface">
        <Icon className="size-4 text-muted-foreground" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{asunto}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs text-muted-foreground">
          <span
            className={`inline-flex items-center rounded-full border px-2 py-px font-medium ${chipClass}`}
          >
            {chip.label}
          </span>
          <span>{meta}</span>
        </p>
      </div>
      <span className="hidden h-8 shrink-0 items-center rounded-md border border-border bg-surface px-3 text-xs font-medium text-foreground sm:inline-flex">
        {accion}
      </span>
    </div>
  );
}
