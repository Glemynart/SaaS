import { Button } from '@/components/ui/button';

interface FinalCtaSectionProps {
  onDemoOpen: () => void;
}

export function FinalCtaSection({ onDemoOpen }: FinalCtaSectionProps) {
  return (
    <section id="demo" className="landing-hero py-20 sm:py-28" aria-labelledby="cta-heading">
      <div className="mx-auto max-w-3xl px-5 text-center sm:px-8">
        <h2
          id="cta-heading"
          className="text-balance text-3xl font-semibold tracking-[-0.025em] text-white sm:text-4xl lg:text-5xl"
        >
          ¿Listo para eliminar el caos operativo de su organización?
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-white/65 sm:text-lg">
          No es una migración de sistemas. No es un proyecto de seis meses. Es una demo de treinta
          minutos donde le mostramos exactamente cómo funcionaría la plataforma para su operación
          específica.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Button
            size="lg"
            onClick={onDemoOpen}
            className="h-11 bg-white px-6 text-primary hover:bg-white/92 shadow-[0_0_0_1px_rgba(255,255,255,0.18),0_4px_16px_rgba(0,0,0,0.18)] font-semibold"
          >
            Solicitar demo gratuita
          </Button>
          <a
            href="mailto:hola@laoficinanitida.com"
            className="inline-flex h-11 items-center rounded-md px-4 text-sm font-medium text-white/70 hover:text-white transition-colors"
          >
            Hablar con el equipo
          </a>
        </div>

        <p className="mt-5 text-xs text-white/35">
          Sin compromiso · Sin tarjeta de crédito · Sin contrato de implementación
        </p>
      </div>
    </section>
  );
}
