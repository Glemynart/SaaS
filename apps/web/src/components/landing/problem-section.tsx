import { TableProperties, Archive, Clock, Link2Off, Search } from 'lucide-react';

const problems = [
  {
    icon: TableProperties,
    title: 'El Excel que nadie domina del todo',
    body: 'Cada inicio de año escolar, su equipo pasa días copiando datos en Word, renombrando archivos, revisando cédulas y mandando PDFs por correo. Siempre hay errores. Siempre hay alguien que faltó.',
  },
  {
    icon: Archive,
    title: 'Las carpetas que nadie encuentra',
    body: 'El expediente de cada persona existe en una carpeta de cartón. Para revisar si un docente entregó el certificado médico o la tarjeta profesional, alguien tiene que buscarlo físicamente. Cuando esa persona se va, la carpeta desaparece.',
  },
  {
    icon: Clock,
    title: 'El contrato que venció sin que nadie lo notara',
    body: 'Su personal lleva tres semanas trabajando con el contrato vencido. Nadie lo vio. Se enteraron cuando la Secretaría de Educación hizo una visita. Lo que siguió: papeleo urgente, noches sin dormir y un riesgo legal que pudo evitarse con una alerta a tiempo.',
  },
  {
    icon: Link2Off,
    title: 'Las herramientas que no se hablan entre sí',
    body: 'Empleados en Excel. Contratos en Google Drive. Alertas en WhatsApp. Documentos en correo electrónico. Ninguna fuente de verdad. Cuando alguien pregunta por el estado de un contrato, nadie tiene la respuesta completa.',
  },
  {
    icon: Search,
    title: 'La auditoría que llegó sin aviso',
    body: 'Contraloría o la Secretaría de Educación pide el contrato de un docente del segundo semestre del año pasado. Tiene dos días. ¿En qué carpeta está? ¿Quién lo firmó? ¿Fue el mismo documento o hubo una adenda? Responder esas preguntas no debería tomar días.',
  },
];

export function ProblemSection() {
  return (
    <section
      id="problema"
      className="bg-background py-24 sm:py-32"
      aria-labelledby="problem-heading"
    >
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="lg:grid lg:grid-cols-12 lg:gap-16">
          {/* Encabezado editorial (izquierda, fijo al hacer scroll) */}
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-28">
              <h2
                id="problem-heading"
                className="text-balance text-3xl font-semibold tracking-[-0.025em] text-foreground sm:text-4xl"
              >
                ¿Le suena familiar?
              </h2>
              <p className="mt-5 text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
                Cada inicio de año escolar, el equipo administrativo de un operador educativo
                enfrenta el mismo ciclo. Cientos de contratos para generar, expedientes que buscar,
                fechas que no hay que olvidar y herramientas que no se hablan entre sí.
              </p>
            </div>
          </div>

          {/* Lista editorial (derecha) */}
          <ul
            className="mt-12 lg:col-span-7 lg:mt-0"
            role="list"
            aria-label="Problemas que resolvemos"
          >
            {problems.map(({ icon: Icon, title, body }) => (
              <li
                key={title}
                className="flex gap-5 border-t border-border-soft py-7 first:border-t-0 first:pt-0 last:pb-0"
              >
                <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-lg border border-border bg-surface shadow-(--shadow-inset-hi)">
                  <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Cierre tipográfico */}
        <p className="mt-20 border-t border-border-soft pt-14 text-center text-2xl font-semibold tracking-[-0.022em] text-foreground sm:text-3xl">
          Existe una forma más limpia de operar.
        </p>
      </div>
    </section>
  );
}
