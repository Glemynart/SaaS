import { ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HeroSectionProps {
  onDemoOpen: () => void;
}

const contractRows = [
  { name: 'María González', role: 'Docente de primaria', done: true },
  { name: 'Juan Carlos Pérez', role: 'Instructor técnico', done: true },
  { name: 'Ana Sofía Martínez', role: 'Docente secundaria', done: true },
  { name: 'Carlos Andrés López', role: 'Coordinador académico', done: true },
];

export function HeroSection({ onDemoOpen }: HeroSectionProps) {
  return (
    <section className="landing-hero" aria-labelledby="hero-heading">
      <div className="mx-auto max-w-7xl px-5 pb-20 pt-32 sm:px-8 sm:pt-36 lg:grid lg:grid-cols-2 lg:items-center lg:gap-16 lg:pb-28 lg:pt-40">
        {/* Text column */}
        <div className="max-w-2xl">
          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary-foreground/20 bg-primary-foreground/10 px-3.5 py-1.5">
            <span
              className="h-1.5 w-1.5 rounded-full bg-primary-foreground/60"
              aria-hidden="true"
            />
            <span className="text-xs font-medium text-primary-foreground/80">
              Para operadores educativos colombianos
            </span>
          </div>

          {/* Headline */}
          <h1
            id="hero-heading"
            className="text-balance text-4xl font-semibold leading-[1.06] tracking-[-0.03em] text-primary-foreground sm:text-5xl"
          >
            Gestione su planta de personal, sus contratos y su expediente sin depender del Excel.
          </h1>

          {/* Subheadline */}
          <p className="mt-5 max-w-xl text-pretty text-base leading-7 text-primary-foreground/65 sm:text-lg sm:leading-8">
            Centralice la gestión laboral de su organización en una sola plataforma. Genere
            contratos masivos en minutos, mantenga el expediente digital de cada persona y reciba
            alertas antes de que venzan los contratos.
          </p>

          {/* CTAs */}
          <div className="mt-8 flex flex-wrap items-center gap-3 sm:gap-4">
            <Button
              size="lg"
              onClick={onDemoOpen}
              className="bg-primary-foreground text-primary hover:bg-primary-foreground/92 active:scale-[0.98] h-11 px-6 text-sm font-semibold ring-1 ring-primary-foreground/20"
            >
              Solicitar demo gratuita
            </Button>
            <a
              href="#como-funciona"
              className="inline-flex h-11 items-center gap-1.5 text-sm font-medium text-primary-foreground/70 transition-colors hover:text-primary-foreground"
            >
              Ver cómo funciona
              <ArrowRight className="size-4" aria-hidden="true" />
            </a>
          </div>

          {/* Trust signal */}
          <p className="mt-5 text-xs text-primary-foreground/40">
            Sin tarjeta de crédito · Sin contrato de implementación · Sin instalación
          </p>
        </div>

        {/* Visual column — contract batch mockup */}
        <div className="mt-14 lg:mt-0" aria-hidden="true">
          <div className="landing-contract-card mx-auto max-w-md p-1">
            {/* Window chrome */}
            <div className="flex items-center gap-1.5 border-b border-primary-foreground/10 px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-primary-foreground/20" />
              <span className="h-2.5 w-2.5 rounded-full bg-primary-foreground/15" />
              <span className="h-2.5 w-2.5 rounded-full bg-primary-foreground/10" />
              <span className="ml-3 text-xs font-medium text-primary-foreground/40">
                Contratos masivos · Lote Enero 2026
              </span>
            </div>

            {/* Progress bar */}
            <div className="px-4 pt-4 pb-2">
              <div className="flex items-center justify-between text-xs text-primary-foreground/50 mb-1.5">
                <span>Generando contratos…</span>
                <span className="font-medium text-primary-foreground/70">200 / 200</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-primary-foreground/10">
                <div
                  className="h-full rounded-full bg-primary-foreground/50"
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            {/* Contract list */}
            <div className="pb-2">
              {contractRows.map((row) => (
                <div key={row.name} className="landing-contract-row">
                  <div className="landing-contract-check" aria-hidden="true">
                    <Check className="size-3" strokeWidth={2.5} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-primary-foreground/80">
                      {row.name}
                    </span>
                    <span className="block truncate text-xs text-primary-foreground/40">
                      {row.role}
                    </span>
                  </div>
                  <span className="text-xs text-primary-foreground/35">PDF listo</span>
                </div>
              ))}
              <div className="landing-contract-row text-primary-foreground/35">
                <div className="w-5" />
                <span>— 196 contratos más —</span>
              </div>
            </div>

            {/* Footer action */}
            <div className="border-t border-primary-foreground/10 px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="landing-contract-check" aria-hidden="true">
                    <Check className="size-3" strokeWidth={2.5} />
                  </div>
                  <span className="text-xs font-medium text-primary-foreground/70">
                    200 contratos listos · ZIP disponible
                  </span>
                </div>
                <div className="flex h-7 items-center rounded-md bg-primary-foreground/10 px-3 text-xs font-medium text-primary-foreground/70">
                  Descargar ZIP
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom fade */}
      <div
        className="pointer-events-none absolute bottom-0 inset-x-0 h-24"
        style={{
          background:
            'linear-gradient(to bottom, transparent, color-mix(in oklch, var(--background) 100%, transparent))',
        }}
        aria-hidden="true"
      />
    </section>
  );
}
