import { Check, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ComparisonSectionProps {
  onDemoOpen: () => void;
}

const rows = [
  {
    label: 'Contratos masivos',
    excel: 'Manual. Días de trabajo.',
    carpetas: 'No aplica.',
    erp: 'Configuración extensa.',
    platform: 'En minutos. Desde el Excel que ya tiene.',
  },
  {
    label: 'Alertas de vencimiento',
    excel: null,
    carpetas: null,
    erp: 'Parcial.',
    platform: 'Automáticas. 30, 15 y 7 días.',
  },
  {
    label: 'Expediente digital',
    excel: 'Archivos dispersos en Drive.',
    carpetas: 'Carpetas físicas. Se pierden.',
    erp: 'Disponible, pero complejo.',
    platform: 'Centralizado. Disponible en segundos.',
  },
  {
    label: 'Registro de auditoría',
    excel: null,
    carpetas: null,
    erp: 'Parcial.',
    platform: 'Completo. Cada acción registrada.',
  },
  {
    label: 'Tiempo de implementación',
    excel: 'Ya lo tiene, pero el caos también.',
    carpetas: '—',
    erp: 'Entre uno y seis meses.',
    platform: 'El mismo día.',
  },
  {
    label: 'Curva de aprendizaje',
    excel: 'Alta. El caos es de todos.',
    carpetas: 'Alta. Todo es manual.',
    erp: 'Muy alta. Requiere capacitación.',
    platform: 'Baja. Flujos directos sin tecnicismos.',
  },
  {
    label: 'Multiempresa',
    excel: 'Carpetas separadas en Drive.',
    carpetas: 'Armarios separados.',
    erp: 'Disponible, pero costoso.',
    platform: 'Incluido desde el inicio.',
  },
];

export function ComparisonSection({ onDemoOpen }: ComparisonSectionProps) {
  return (
    <section
      id="comparacion"
      className="bg-background py-24 sm:py-32"
      aria-labelledby="comparison-heading"
    >
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="max-w-2xl">
          <h2
            id="comparison-heading"
            className="text-3xl font-semibold tracking-[-0.025em] text-foreground sm:text-4xl"
          >
            ¿Cómo lo hacía antes?
          </h2>
          <p className="mt-5 text-base leading-7 text-muted-foreground">
            Compare el tiempo, el riesgo y el control que tiene hoy frente a lo que puede tener
            desde mañana.
          </p>
        </div>

        <div className="relative mt-16">
          <div
            className="absolute inset-0 translate-x-4 translate-y-4 rounded-(--radius-panel) border border-border-soft bg-[color-mix(in_oklch,var(--surface)_60%,var(--canvas))]"
            aria-hidden="true"
          />
          <div className="landing-comparison-wrap relative bg-surface shadow-(--shadow-inset-hi)">
            <table className="landing-comparison-table" aria-label="Comparación de opciones">
              <thead>
                <tr>
                  <th scope="col" className="w-[16%]">
                    Criterio
                  </th>
                  <th scope="col">Excel + Word</th>
                  <th scope="col">Carpetas físicas</th>
                  <th scope="col">ERP tradicional</th>
                  <th scope="col" className="col-highlight">
                    Dusema Gestión ✓
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.label}>
                    <td className="row-label">{row.label}</td>
                    <td>
                      {row.excel ? (
                        row.excel
                      ) : (
                        <span className="landing-cross-icon" aria-label="No disponible">
                          <Minus className="size-4" />
                        </span>
                      )}
                    </td>
                    <td>
                      {row.carpetas ? (
                        row.carpetas
                      ) : (
                        <span className="landing-cross-icon" aria-label="No disponible">
                          <Minus className="size-4" />
                        </span>
                      )}
                    </td>
                    <td>{row.erp}</td>
                    <td className="col-highlight">
                      <span className="flex items-center gap-2">
                        <span className="landing-check-icon" aria-hidden="true">
                          <Check className="size-3" strokeWidth={2.5} />
                        </span>
                        {row.platform}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="mt-12 text-center text-sm text-muted-foreground">
          No reemplazamos a su software contable ni a su asesor de nómina. Resolvemos lo que ellos
          no resuelven: la gestión documental y contractual del día a día.
        </p>

        <div className="mt-8 flex justify-center">
          <Button size="lg" onClick={onDemoOpen} className="h-11 px-6">
            Solicitar demo gratuita
          </Button>
        </div>
      </div>
    </section>
  );
}
