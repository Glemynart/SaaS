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
      className="bg-background py-20 sm:py-28"
      aria-labelledby="roadmap-heading"
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2
            id="roadmap-heading"
            className="text-3xl font-semibold tracking-[-0.025em] text-foreground sm:text-4xl"
          >
            Lo que viene.
          </h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            La plataforma crece según las necesidades reales de nuestros clientes. Así está nuestra
            hoja de ruta hoy.
          </p>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          {/* Done column */}
          <div
            className="rounded-xl border border-border bg-surface p-6"
            style={{ boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.72)' }}
          >
            <h3 className="mb-5 text-sm font-semibold text-foreground">Disponible hoy</h3>
            <ul className="space-y-3" role="list">
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

          {/* WIP column */}
          <div
            className="rounded-xl border border-border bg-surface p-6"
            style={{ boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.72)' }}
          >
            <h3 className="mb-5 text-sm font-semibold text-foreground">En desarrollo</h3>
            <ul className="space-y-5" role="list">
              {wip.map((item) => (
                <li key={item.title} className="flex items-start gap-3">
                  <div className="landing-roadmap-dot wip mt-0.5" aria-label="En desarrollo">
                    <Circle className="size-2.5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.title}</p>
                    <p className="mt-1 text-sm leading-5 text-muted-foreground">{item.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 rounded-xl border border-border bg-canvas px-6 py-5 text-center">
          <p className="text-sm leading-6 text-muted-foreground">
            Los clientes que entran hoy participan en la definición de qué construimos primero. Y
            son los primeros en acceder a cada módulo nuevo.
          </p>
          <Button className="mt-4" onClick={onDemoOpen}>
            Quiero ser cliente desde el inicio →
          </Button>
        </div>
      </div>
    </section>
  );
}
