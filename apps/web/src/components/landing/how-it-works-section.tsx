import { Button } from '@/components/ui/button';

interface HowItWorksSectionProps {
  onDemoOpen: () => void;
}

const steps = [
  {
    number: '01',
    title: 'Configure su organización',
    body: 'Registre su empresa, defina los usuarios del equipo administrativo y cargue sus plantillas de contrato. El proceso toma menos de treinta minutos y no requiere soporte técnico.',
    time: 'Menos de 30 minutos',
  },
  {
    number: '02',
    title: 'Cargue su planta de personal',
    body: 'Importe su archivo Excel actual con los datos de sus empleados. La plataforma los procesa, crea los perfiles y los deja listos para vincularse a contratos, expedientes y alertas.',
    time: 'Menos de 1 hora para cualquier tamaño de planta',
  },
  {
    number: '03',
    title: 'Opere con tranquilidad desde el primer día',
    body: 'Genere contratos individuales o por lotes, suba documentos al expediente de cada persona y active las alertas de vencimiento. A partir de ese momento, la plataforma trabaja con usted.',
    time: 'Operativo el mismo día',
  },
];

export function HowItWorksSection({ onDemoOpen }: HowItWorksSectionProps) {
  return (
    <section
      id="como-funciona"
      className="bg-background py-24 sm:py-32"
      aria-labelledby="how-heading"
    >
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="lg:grid lg:grid-cols-12 lg:gap-16">
          {/* Encabezado editorial */}
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-28">
              <h2
                id="how-heading"
                className="text-3xl font-semibold tracking-[-0.025em] text-foreground sm:text-4xl"
              >
                Cómo funciona
              </h2>
              <p className="mt-5 text-base leading-7 text-muted-foreground">
                Tres pasos. Sin consultoría de implementación. Sin capacitación de días.
              </p>
              <div className="mt-8 hidden lg:block">
                <Button size="lg" onClick={onDemoOpen} className="h-11 px-6">
                  Solicitar demo gratuita
                </Button>
              </div>
            </div>
          </div>

          {/* Secuencia vertical */}
          <ol
            className="mt-12 lg:col-span-7 lg:mt-0"
            role="list"
            aria-label="Pasos de implementación"
          >
            {steps.map((step, index) => (
              <li key={step.number} className="relative flex gap-6 pb-12 last:pb-0">
                {/* Línea conectora vertical */}
                {index < steps.length - 1 && (
                  <div
                    className="absolute bottom-0 left-[1.125rem] top-12 w-px bg-border"
                    aria-hidden="true"
                  />
                )}

                <div className="relative z-10 flex-shrink-0">
                  <div className="landing-step-number" aria-hidden="true">
                    {step.number}
                  </div>
                </div>

                <div className="pt-1.5">
                  <h3 className="text-lg font-semibold tracking-[-0.018em] text-foreground">
                    {step.title}
                  </h3>
                  <p className="mt-2.5 max-w-xl text-sm leading-6 text-muted-foreground">
                    {step.body}
                  </p>
                  <p className="mt-3 text-xs font-medium tabular-nums text-muted-foreground">
                    {step.time}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-14 flex justify-center lg:hidden">
          <Button size="lg" onClick={onDemoOpen} className="h-11 px-6">
            Solicitar demo gratuita
          </Button>
        </div>
      </div>
    </section>
  );
}
