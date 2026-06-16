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
      className="landing-dark py-20 sm:py-28"
      aria-labelledby="benefits-heading"
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2
            id="benefits-heading"
            className="text-3xl font-semibold tracking-[-0.025em] text-white sm:text-4xl"
          >
            Lo que cambia cuando su equipo opera así.
          </h2>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-3">
          {benefits.map(({ kicker, title, body }) => (
            <div
              key={kicker}
              className="rounded-xl p-6"
              style={{
                border: '1px solid color-mix(in oklch, white 12%, transparent)',
                background: 'color-mix(in oklch, white 4%, transparent)',
              }}
            >
              <span className="text-xs font-semibold uppercase tracking-widest text-white/35">
                {kicker}
              </span>
              <h3 className="mt-3 whitespace-pre-line text-2xl font-semibold leading-[1.15] tracking-[-0.022em] text-white">
                {title}
              </h3>
              <p className="mt-4 text-sm leading-6 text-white/55">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
