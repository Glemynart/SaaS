import { Check, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RoadmapSectionProps {
  onDemoOpen: () => void;
}

const done = [
  'Gestión de empleados',
  'Importación masiva desde Excel',
  'Plantillas documentales personalizadas',
  'Contratos individuales',
  'Contratos masivos por lotes',
  'Expediente digital por persona',
  'Alertas automáticas de vencimiento',
  'Multiempresa',
  'Registro de auditoría',
];

const wip = [
  {
    title: 'Facturación Electrónica DIAN',
    desc: 'Emisión de facturas electrónicas válidas ante la DIAN directamente desde la plataforma. Sin cambiar su software contable.',
  },
  {
    title: 'Nómina Electrónica',
    desc: 'Liquidación y transmisión de nómina electrónica según el Decreto 1601 de 2020.',
  },
  {
    title: 'Automatización de cumplimiento laboral',
    desc: 'Alertas de obligaciones patronales, periodos de prueba, vencimientos de aportes y obligaciones ante el SENA y el ICBF.',
  },
];

export function RoadmapSection({ onDemoOpen }: RoadmapSectionProps) {
  return (
    <section
      id="roadmap"
      className="bg-background py-24 sm:py-32"
      aria-labelledby="roadmap-heading"
    >
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="max-w-2xl">
          <h2
            id="roadmap-heading"
            className="text-3xl font-semibold tracking-[-0.025em] text-foreground sm:text-4xl"
          >
            Lo que viene.
          </h2>
          <p className="mt-5 text-base leading-7 text-muted-foreground">
            La plataforma crece según las necesidades reales de nuestros clientes. Así está nuestra
            hoja de ruta hoy.
          </p>
        </div>

        {/* Un solo folio dividido en dos páginas */}
        <div className="relative mt-16">
          <div
            className="absolute inset-0 translate-x-4 translate-y-4 rounded-(--radius-panel) border border-border-soft bg-[color-mix(in_oklch,var(--surface)_60%,var(--canvas))]"
            aria-hidden="true"
          />
          <div className="product-frame relative grid md:grid-cols-2 md:divide-x md:divide-border-soft">
            <div className="p-7 sm:p-8">
              <h3 className="text-sm font-semibold text-foreground">Disponible hoy</h3>
              <ul className="mt-5 space-y-3" role="list">
                {done.map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <div className="landing-roadmap-dot done" aria-label="Disponible">
                      <Check className="size-3" strokeWidth={2.5} />
                    </div>
                    <span className="text-sm text-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-t border-border-soft p-7 sm:p-8 md:border-t-0">
              <h3 className="text-sm font-semibold text-foreground">En desarrollo</h3>
              <ul className="mt-5 space-y-5" role="list">
                {wip.map((item) => (
                  <li key={item.title} className="flex items-start gap-3">
                    <div className="landing-roadmap-dot wip" aria-label="En desarrollo">
                      <Circle className="size-2.5" strokeWidth={3} />
                    </div>
                    <div>
                      <span className="block text-sm font-medium text-foreground">
                        {item.title}
                      </span>
                      <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                        {item.desc}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-12 flex justify-center">
          <Button size="lg" onClick={onDemoOpen} className="h-11 px-6">
            Solicitar demo gratuita
          </Button>
        </div>
      </div>
    </section>
  );
}
