import Link from 'next/link';

const productLinks = [
  { label: 'Gestión de empleados', href: '#funcionalidades' },
  { label: 'Contratos masivos', href: '#contratos-masivos' },
  { label: 'Expediente digital', href: '#expediente' },
  { label: 'Alertas de vencimiento', href: '#alertas' },
  { label: 'Plantillas documentales', href: '#plantillas' },
  { label: 'Multiempresa', href: '#multiempresa' },
];

const companyLinks = [
  { label: 'Quiénes somos', href: '#' },
  { label: 'Contacto', href: 'mailto:hola@laoficinanitida.com' },
];

const legalLinks = [
  { label: 'Política de privacidad', href: '#' },
  { label: 'Términos de servicio', href: '#' },
  { label: 'Tratamiento de datos personales', href: '#' },
];

export function LandingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-foreground text-primary-foreground/50" aria-label="Pie de página">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        {/* Main grid */}
        <div className="grid gap-10 border-b border-primary-foreground/10 py-14 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand column */}
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary-foreground/15 bg-primary-foreground/10 text-sm font-semibold text-primary-foreground"
                aria-hidden="true"
              >
                1
              </div>
              <span className="text-sm font-semibold text-primary-foreground">
                La Oficina Nítida
              </span>
            </div>
            <p className="mt-4 text-sm leading-6">
              Gestión laboral para operadores educativos colombianos.
            </p>
            <p className="mt-4 text-xs">Hecho en Colombia 🇨🇴</p>
          </div>

          {/* Product links */}
          <div>
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-primary-foreground/30">
              Producto
            </h3>
            <ul className="space-y-2.5" role="list">
              {productLinks.map(({ label, href }) => (
                <li key={label}>
                  <a
                    href={href}
                    className="text-sm transition-colors hover:text-primary-foreground/80"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company links */}
          <div>
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-primary-foreground/30">
              Empresa
            </h3>
            <ul className="space-y-2.5" role="list">
              {companyLinks.map(({ label, href }) => (
                <li key={label}>
                  <a
                    href={href}
                    className="text-sm transition-colors hover:text-primary-foreground/80"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal links */}
          <div>
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-primary-foreground/30">
              Legal
            </h3>
            <ul className="space-y-2.5" role="list">
              {legalLinks.map(({ label, href }) => (
                <li key={label}>
                  <a
                    href={href}
                    className="text-sm transition-colors hover:text-primary-foreground/80"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom band */}
        <div className="flex flex-wrap items-center justify-between gap-4 py-6">
          <p className="text-xs">© {year} La Oficina Nítida. Todos los derechos reservados.</p>
          <Link
            href="/login"
            className="text-xs transition-colors hover:text-primary-foreground/80"
          >
            Iniciar sesión →
          </Link>
        </div>
      </div>
    </footer>
  );
}
