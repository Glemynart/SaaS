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
    <section id="como-funciona" className="bg-canvas py-20 sm:py-28" aria-labelledby="how-heading">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2
            id="how-heading"
            className="text-3xl font-semibold tracking-[-0.025em] text-foreground sm:text-4xl"
          >
            Cómo funciona
          </h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            Tres pasos. Sin consultoría de implementación. Sin capacitación de días.
          </p>
        </div>

        <ol
          className="mt-14 grid gap-8 sm:grid-cols-3"
          role="list"
          aria-label="Pasos de implementación"
        >
          {steps.map((step, index) => (
            <li key={step.number} className="relative flex flex-col">
              {/* Connector line (desktop only) */}
              {index < steps.length - 1 && (
                <div
                  className="absolute left-[calc(2.25rem/2)] top-[1.125rem] hidden h-px w-[calc(100%+2rem)] bg-border sm:block"
                  style={{ left: 'calc(1.125rem + 1px)', width: 'calc(100% - 1.125rem + 2rem)' }}
                  aria-hidden="true"
                />
              )}

              <div className="flex flex-col gap-4">
                <div className="relative z-10 w-fit">
                  <div className="landing-step-number" aria-hidden="true">
                    {step.number}
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-semibold text-foreground">{step.title}</h3>
                  <p className="mt-2.5 text-sm leading-6 text-muted-foreground">{step.body}</p>
                  <div className="mt-4 inline-flex items-center rounded-full border border-border bg-surface px-3 py-1">
                    <span className="text-xs font-medium text-muted-foreground">{step.time}</span>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-14 flex justify-center">
          <Button size="lg" onClick={onDemoOpen} className="h-11 px-6">
            Solicitar demo gratuita
          </Button>
        </div>
      </div>
    </section>
  );
}
