const benefits = [
  {
    kicker: 'Tiempo',
    title: 'De una semana\na una tarde.',
    body: 'El proceso de contratación masiva que hoy consume días de trabajo administrativo ocurre en horas. Su equipo puede enfocarse en lo que importa: acompañar a las personas, no perseguir documentos.',
  },
  {
    kicker: 'Riesgo',
    title: 'Cero contratos\nvencidos sin aviso.',
    body: 'Las alertas automáticas eliminan el riesgo de personal operando sin respaldo contractual. Sin multas por incumplimiento. Sin urgencias de última hora. Sin conversaciones incómodas con la Secretaría de Educación.',
  },
  {
    kicker: 'Control',
    title: 'Respuesta inmediata\ncuando la necesita.',
    body: 'Auditoría, visita de control o simple consulta interna: usted tiene la información en segundos. Contratos, documentos, historial de alertas y registro de acciones. Todo en el mismo lugar.',
  },
];

export function BenefitsSection() {
  return (
    <section
      id="beneficios"
      className="bg-background py-24 sm:py-32"
      aria-labelledby="benefits-heading"
    >
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <h2
          id="benefits-heading"
          className="max-w-2xl text-3xl font-semibold tracking-[-0.025em] text-foreground sm:text-4xl"
        >
          Lo que cambia cuando su equipo opera así.
        </h2>

        {/* Tríptico tipográfico, sin cajas */}
        <div className="mt-16 grid gap-12 md:grid-cols-3 md:gap-0 md:divide-x md:divide-border-soft">
          {benefits.map(({ kicker, title, body }) => (
            <div key={kicker} className="md:px-10 md:first:pl-0 md:last:pr-0">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {kicker}
              </p>
              <h3 className="mt-4 whitespace-pre-line text-2xl font-semibold leading-[1.15] tracking-[-0.022em] text-foreground sm:text-3xl">
                {title}
              </h3>
              <p className="mt-5 text-sm leading-6 text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
