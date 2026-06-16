import { FileStack, BellRing, Building2, Zap } from 'lucide-react';

const stats = [
  {
    icon: FileStack,
    label: 'Hasta 500 contratos por lote',
  },
  {
    icon: BellRing,
    label: 'Alertas a 30, 15 y 7 días',
  },
  {
    icon: Building2,
    label: 'Multiempresa incluido',
  },
  {
    icon: Zap,
    label: 'Operativo el mismo día',
  },
];

export function SocialProofBar() {
  return (
    <div className="border-y border-border bg-canvas" aria-label="Capacidades de la plataforma">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <ul
          className="flex flex-wrap items-center justify-center divide-y divide-border sm:divide-y-0 sm:divide-x sm:divide-border"
          role="list"
        >
          {stats.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="flex w-full items-center gap-2.5 px-6 py-4 text-sm font-medium text-muted-foreground sm:w-auto sm:py-5"
            >
              <Icon className="size-4 flex-shrink-0 text-primary/60" aria-hidden="true" />
              {label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
