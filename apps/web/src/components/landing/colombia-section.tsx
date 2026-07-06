import { FileCheck2, CalendarDays, ShieldCheck } from 'lucide-react';

const blocks = [
  {
    icon: FileCheck2,
    title: 'Contratos según el Código Sustantivo del Trabajo',
    body: 'Término fijo, término indefinido, prestación de servicios, obra o labor. Sus plantillas funcionan para cualquier modalidad. Cada contrato queda guardado con los datos exactos del momento de firma — porque los empleados cambian de cargo, de salario y de dependencia, y el historial debe reflejar lo que era verdad cuando se firmó.',
  },
  {
    icon: CalendarDays,
    title: 'Diseñado para el ciclo educativo colombiano',
    body: 'Las contrataciones de inicio de año escolar, el segundo semestre, los contratos interadministrativos con municipios, la vinculación de docentes por proyecto. La plataforma fue pensada para ese ritmo específico: volumen alto, tiempo corto, documentación obligatoria.',
  },
  {
    icon: ShieldCheck,
    title: 'Listo cuando lleguen los entes de control',
    body: 'Registro de auditoría de cada acción en la plataforma. Documentos disponibles de manera inmediata. Historial de contratos generados por persona y por lote. Si Contraloría, Procuraduría o la Secretaría de Educación solicita información, usted responde en minutos.',
  },
];

export function ColombiaSection() {
  return (
    <section
      id="colombia"
      className="entry-canvas border-y border-border py-24 sm:py-32"
      aria-labelledby="colombia-heading"
    >
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="max-w-2xl">
          <h2
            id="colombia-heading"
            className="text-3xl font-semibold tracking-[-0.025em] text-foreground sm:text-4xl"
          >
            Construido para Colombia.
          </h2>
          <p className="mt-5 text-pretty text-base leading-7 text-muted-foreground">
            No es la traducción de un software europeo. Fue diseñado para las realidades operativas
            de las organizaciones colombianas que contratan personal a escala, cada año, bajo las
            reglas del mercado laboral local.
          </p>
        </div>

        <div className="mt-16 grid gap-10 md:grid-cols-3 md:gap-0 md:divide-x md:divide-border-soft">
          {blocks.map(({ icon: Icon, title, body }) => (
            <div key={title} className="md:px-8 md:first:pl-0 md:last:pr-0">
              <Icon className="size-5 text-primary/70" aria-hidden="true" />
              <h3 className="mt-4 text-base font-semibold text-foreground">{title}</h3>
              <p className="mt-2.5 text-sm leading-6 text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
