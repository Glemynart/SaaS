import { Check, FileStack, Bell, FolderOpen, Users, Building2, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FeaturesSectionProps {
  onDemoOpen: () => void;
}

const features = [
  {
    id: 'contratos-masivos',
    icon: FileStack,
    badge: 'Diferenciador principal',
    title: 'Doscientos contratos en minutos. No en días.',
    subtitle:
      'Suba su plantilla de contrato una vez. Cargue el archivo Excel con su planta de personal. La plataforma genera todos los contratos automáticamente y los empaca para descargar.',
    bullets: [
      'Plantillas DOCX con variables dinámicas: nombre, cédula, cargo, salario, fecha, municipio y más',
      'Carga masiva desde Excel — el mismo archivo que ya tiene',
      'Generación simultánea de todos los contratos del lote',
      'Descarga individual por persona o en ZIP completo',
      'Historial de contratos generados por empleado y por lote',
      'Los datos quedan guardados tal como estaban al momento de la firma',
    ],
    microcopy: 'El proceso que antes tomaba una semana ocurre en una tarde.',
    visual: <ContractBatchVisual />,
  },
  {
    id: 'alertas',
    icon: Bell,
    badge: null,
    title: 'Ningún contrato vence sin que usted lo sepa.',
    subtitle:
      'La plataforma revisa automáticamente las fechas de vencimiento y le avisa con tiempo suficiente para actuar. Sin calendarios paralelos. Sin recordatorios en WhatsApp.',
    bullets: [
      'Alertas automáticas a 30, 15 y 7 días antes del vencimiento',
      'Panel consolidado de contratos próximos a vencer',
      'Alertas individuales y por grupos de personal',
      'Historial de alertas enviadas por contrato',
      'Vista completa del estado contractual de toda la planta',
    ],
    microcopy: 'Un contrato vencido puede costar más que un año de suscripción.',
    visual: <AlertsVisual />,
  },
  {
    id: 'expediente',
    icon: FolderOpen,
    badge: null,
    title: 'El expediente de cada persona, organizado y disponible en segundos.',
    subtitle:
      'Fin a las carpetas físicas y los archivos dispersos. Todos los documentos de su planta de personal clasificados, con historial y disponibles desde cualquier computador.',
    bullets: [
      'Carga de documentos por categoría: contratos, certificaciones, títulos, documentos de identidad, soportes médicos y más',
      'Acceso rápido desde el perfil de cada persona',
      'Historial de documentos con fecha de carga',
      'Descarga individual de cualquier documento',
      'Disponible para el equipo administrativo con los permisos correspondientes',
    ],
    microcopy: 'Cuando llegue una visita de auditoría, usted entrega en diez segundos.',
    visual: <ExpedienteVisual />,
  },
  {
    id: 'empleados',
    icon: Users,
    badge: null,
    title: 'Su planta de personal, siempre al día.',
    subtitle:
      'Un perfil completo por persona. Búsqueda instantánea. Importación desde el Excel que ya tiene. Sin digitación innecesaria.',
    bullets: [
      'Registro completo de información personal y laboral',
      'Importación masiva desde Excel en minutos',
      'Búsqueda por nombre, cédula, cargo, estado o contrato',
      'Filtros por área, municipio, tipo de contrato o estado',
      'Estados activo e inactivo con historial',
      'Vinculación directa con contratos, expediente y alertas',
    ],
    microcopy: 'El mismo Excel que usa hoy se convierte en su base de datos laboral.',
    visual: <EmployeesVisual />,
  },
  {
    id: 'multiempresa',
    icon: Building2,
    badge: null,
    title: 'Varias organizaciones, un solo lugar de trabajo.',
    subtitle:
      'Si administra contratos con varios municipios, opera bajo diferentes razones sociales o gestiona más de una entidad, cada organización funciona de manera completamente independiente.',
    bullets: [
      'Aislamiento total de información entre organizaciones',
      'Cambio de contexto entre empresas desde el mismo inicio de sesión',
      'Logo y nombre propios por organización',
      'Registro de auditoría independiente por cada empresa',
      'Usuarios con acceso diferenciado por organización',
    ],
    microcopy:
      'Diseñado para uniones temporales, consorcios y operadores con múltiples contratos municipales.',
    visual: <MultiempresaVisual />,
  },
  {
    id: 'plantillas',
    icon: Layers,
    badge: null,
    title: 'Sus propias plantillas. Sus propias cláusulas. Su propio formato.',
    subtitle:
      'No le imponemos un modelo de contrato. Usted sube sus plantillas y la plataforma hace el resto: reemplaza las variables, genera los documentos y los guarda en el historial.',
    bullets: [
      'Carga de plantillas en formato DOCX',
      'Variables dinámicas configurables según sus necesidades',
      'Compatibles con contratos de término fijo, indefinido, prestación de servicios y obra o labor',
      'Vista previa antes de generar',
      'Varias plantillas activas al mismo tiempo',
    ],
    microcopy: 'Sus contratos, automatizados. Sin cambiar una coma de sus cláusulas.',
    visual: <PlantillasVisual />,
  },
];

export function FeaturesSection({ onDemoOpen }: FeaturesSectionProps) {
  return (
    <section
      id="funcionalidades"
      className="border-y border-border bg-canvas py-24 sm:py-32"
      aria-labelledby="features-heading"
    >
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="max-w-2xl">
          <h2
            id="features-heading"
            className="text-balance text-3xl font-semibold tracking-[-0.025em] text-foreground sm:text-4xl"
          >
            Todo lo que su organización necesita para gestionar su personal, en un solo lugar.
          </h2>
          <p className="mt-5 text-base leading-7 text-muted-foreground">
            Disponible hoy. Sin lista de espera.
          </p>
        </div>

        <div className="mt-16 space-y-28">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            const isEven = index % 2 === 1;
            return (
              <article
                key={feature.id}
                id={feature.id}
                className={`grid items-center gap-12 lg:grid-cols-2 lg:gap-16 ${isEven ? 'lg:[direction:rtl]' : ''}`}
                aria-labelledby={`feature-${feature.id}-heading`}
              >
                {/* Text */}
                <div className={isEven ? 'lg:[direction:ltr]' : ''}>
                  <div className="mb-5 flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-lg border border-border bg-surface shadow-(--shadow-inset-hi)">
                      <Icon className="size-5 text-primary/70" aria-hidden="true" />
                    </div>
                    {feature.badge && (
                      <span className="inline-flex h-6 items-center rounded-full border border-primary/25 bg-primary/8 px-2.5 text-xs font-medium text-primary">
                        {feature.badge}
                      </span>
                    )}
                  </div>
                  <h3
                    id={`feature-${feature.id}-heading`}
                    className="text-balance text-2xl font-semibold tracking-[-0.022em] text-foreground sm:text-3xl"
                  >
                    {feature.title}
                  </h3>
                  <p className="mt-4 text-base leading-7 text-muted-foreground">
                    {feature.subtitle}
                  </p>
                  <ul className="mt-6 space-y-2.5" role="list">
                    {feature.bullets.map((bullet) => (
                      <li
                        key={bullet}
                        className="flex items-start gap-2.5 text-sm leading-6 text-muted-foreground"
                      >
                        <Check
                          className="mt-0.5 size-4 flex-shrink-0 text-primary/60"
                          aria-hidden="true"
                        />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-6 text-sm font-medium text-foreground">{feature.microcopy}</p>
                </div>

                {/* Visual */}
                <div className={isEven ? 'lg:[direction:ltr]' : ''}>{feature.visual}</div>
              </article>
            );
          })}
        </div>

        <div className="mt-24 flex flex-wrap items-center justify-center gap-4">
          <Button size="lg" onClick={onDemoOpen} className="h-11 px-6">
            Solicitar demo gratuita
          </Button>
          <a
            href="#como-funciona"
            className="inline-flex h-11 items-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Ver cómo funciona →
          </a>
        </div>
      </div>
    </section>
  );
}

/* ── Ventanas de producto (decorativas, lenguaje visual del Dashboard) ── */

function ProductWindow({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative" aria-hidden="true">
      <div className="absolute inset-0 translate-x-4 translate-y-4 rounded-(--radius-panel) border border-border-soft bg-[color-mix(in_oklch,var(--surface)_60%,var(--canvas))]" />
      <div className="product-frame relative">
        <div className="flex items-center justify-between border-b border-border-soft px-4 py-3">
          <span className="text-xs font-semibold text-foreground">{title}</span>
          {meta ? <span className="text-2xs text-muted-foreground">{meta}</span> : null}
        </div>
        {children}
      </div>
    </div>
  );
}

function WindowRow({ children, last }: { children: React.ReactNode; last?: boolean }) {
  return (
    <div
      className={`flex items-center gap-3 border-t border-border-soft px-4 py-2.5 first:border-t-0 ${last ? 'pb-3.5' : ''}`}
    >
      {children}
    </div>
  );
}

function StateChip({
  tone,
  label,
}: {
  tone: 'success' | 'warning' | 'danger' | 'info';
  label: string;
}) {
  const toneClass =
    tone === 'success'
      ? 'border-success/25 bg-success/8 text-success'
      : tone === 'warning'
        ? 'border-warning/25 bg-warning/8 text-warning'
        : tone === 'danger'
          ? 'border-destructive/25 bg-destructive/8 text-destructive'
          : 'border-info/25 bg-info/8 text-info';
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-px text-2xs font-medium ${toneClass}`}
    >
      {label}
    </span>
  );
}

function ContractBatchVisual() {
  const names = [
    { n: 'María González', r: 'Docente primaria' },
    { n: 'Juan C. Pérez', r: 'Instructor técnico' },
    { n: 'Ana Martínez', r: 'Docente secundaria' },
    { n: 'Carlos López', r: 'Coordinador' },
    { n: 'Sandra Ruiz', r: 'Docente primaria' },
  ];
  return (
    <ProductWindow title="Lote Enero 2026" meta="200 contratos · ZIP listo">
      {names.map((p) => (
        <WindowRow key={p.n}>
          <div className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-foreground">{p.n}</span>
            <span className="block truncate text-2xs text-muted-foreground">{p.r}</span>
          </div>
          <StateChip tone="success" label="PDF listo" />
        </WindowRow>
      ))}
      <WindowRow last>
        <span className="text-2xs text-muted-foreground">— 195 contratos más —</span>
      </WindowRow>
    </ProductWindow>
  );
}

function AlertsVisual() {
  const alerts = [
    { name: 'Pedro Jiménez', days: 5, tone: 'danger' as const },
    { name: 'Luz Marina Díaz', days: 12, tone: 'warning' as const },
    { name: 'Roberto Castro', days: 18, tone: 'warning' as const },
    { name: 'Olga Suárez', days: 26, tone: 'info' as const },
  ];
  return (
    <ProductWindow title="Contratos próximos a vencer">
      {alerts.map((a, i) => (
        <WindowRow key={a.name} last={i === alerts.length - 1}>
          <span className="min-w-0 flex-1 truncate text-sm text-foreground">{a.name}</span>
          <StateChip tone={a.tone} label={`${a.days} días`} />
        </WindowRow>
      ))}
    </ProductWindow>
  );
}

function ExpedienteVisual() {
  const docs = [
    { name: 'Cédula de ciudadanía', date: '15/01/2026' },
    { name: 'Tarjeta profesional', date: '15/01/2026' },
    { name: 'Certificado médico', date: '14/01/2026' },
    { name: 'Contrato Enero 2026', date: '16/01/2026' },
    { name: 'Acta de posesión', date: '16/01/2026' },
  ];
  return (
    <ProductWindow title="María González — Expediente">
      {docs.map((d, i) => (
        <WindowRow key={d.name} last={i === docs.length - 1}>
          <span className="min-w-0 flex-1 truncate text-sm text-foreground">{d.name}</span>
          <span className="text-2xs tabular-nums text-muted-foreground">{d.date}</span>
        </WindowRow>
      ))}
    </ProductWindow>
  );
}

function EmployeesVisual() {
  const employees = [
    { name: 'María González', cargo: 'Docente', estado: 'Activa' },
    { name: 'Juan Pérez', cargo: 'Instructor', estado: 'Activo' },
    { name: 'Ana Martínez', cargo: 'Docente', estado: 'Activa' },
    { name: 'Carlos López', cargo: 'Coordinador', estado: 'Activo' },
    { name: 'Sandra Ruiz', cargo: 'Docente', estado: 'Activa' },
  ];
  return (
    <ProductWindow title="Planta de personal" meta="47 empleados">
      {employees.map((e, i) => (
        <WindowRow key={e.name} last={i === employees.length - 1}>
          <div className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-foreground">{e.name}</span>
            <span className="block text-2xs text-muted-foreground">{e.cargo}</span>
          </div>
          <StateChip tone="success" label={e.estado} />
        </WindowRow>
      ))}
    </ProductWindow>
  );
}

function MultiempresaVisual() {
  const orgs = [
    { name: 'Operadora Los Andes SAS', nit: '901.234.567-8', active: true },
    { name: 'Fundación Educativa Norte', nit: '800.112.233-4', active: false },
    { name: 'Consorcio Educativo Sur', nit: '700.998.877-2', active: false },
  ];
  return (
    <ProductWindow title="Organizaciones activas">
      {orgs.map((o, i) => (
        <WindowRow key={o.name} last={i === orgs.length - 1}>
          <div className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-foreground">{o.name}</span>
            <span className="block font-mono text-2xs text-muted-foreground">{o.nit}</span>
          </div>
          {o.active && <StateChip tone="info" label="Activa" />}
        </WindowRow>
      ))}
    </ProductWindow>
  );
}

function PlantillasVisual() {
  const templates = [
    { name: 'Contrato término fijo docente', variables: 8 },
    { name: 'Prestación de servicios', variables: 6 },
    { name: 'Contrato obra o labor', variables: 7 },
    { name: 'Contrato indefinido admin.', variables: 9 },
  ];
  return (
    <ProductWindow title="Plantillas configuradas">
      {templates.map((t, i) => (
        <WindowRow key={t.name} last={i === templates.length - 1}>
          <span className="min-w-0 flex-1 truncate text-sm text-foreground">{t.name}</span>
          <span className="text-2xs tabular-nums text-muted-foreground">
            {t.variables} variables
          </span>
        </WindowRow>
      ))}
    </ProductWindow>
  );
}
