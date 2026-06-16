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
      className="bg-canvas py-20 sm:py-28"
      aria-labelledby="features-heading"
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2
            id="features-heading"
            className="text-3xl font-semibold tracking-[-0.025em] text-foreground sm:text-4xl"
          >
            Todo lo que su organización necesita para gestionar su personal, en un solo lugar.
          </h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            Disponible hoy. Sin lista de espera.
          </p>
        </div>

        <div className="mt-16 space-y-24">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            const isEven = index % 2 === 1;
            return (
              <article
                key={feature.id}
                id={feature.id}
                className={`grid items-center gap-12 lg:grid-cols-2 ${isEven ? 'lg:[direction:rtl]' : ''}`}
                aria-labelledby={`feature-${feature.id}-heading`}
              >
                {/* Text */}
                <div className={isEven ? 'lg:[direction:ltr]' : ''}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface">
                      <Icon className="size-5 text-primary/70" aria-hidden="true" />
                    </div>
                    {feature.badge && (
                      <span className="inline-flex h-6 items-center rounded-full border border-primary/25 bg-[color-mix(in_oklch,var(--primary)_8%,transparent)] px-2.5 text-xs font-medium text-primary">
                        {feature.badge}
                      </span>
                    )}
                  </div>
                  <h3
                    id={`feature-${feature.id}-heading`}
                    className="text-2xl font-semibold tracking-[-0.022em] text-foreground sm:text-3xl"
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
                        className="flex items-start gap-2.5 text-sm text-muted-foreground"
                      >
                        <Check
                          className="mt-0.5 size-4 flex-shrink-0 text-primary/60"
                          aria-hidden="true"
                        />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-5 text-sm font-medium text-foreground">{feature.microcopy}</p>
                </div>

                {/* Visual */}
                <div className={isEven ? 'lg:[direction:ltr]' : ''}>{feature.visual}</div>
              </article>
            );
          })}
        </div>

        <div className="mt-20 flex flex-wrap items-center justify-center gap-4">
          <Button size="lg" onClick={onDemoOpen} className="h-11 px-6">
            Solicitar demo gratuita
          </Button>
          <a
            href="#como-funciona"
            className="inline-flex h-11 items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Ver cómo funciona →
          </a>
        </div>
      </div>
    </section>
  );
}

/* ── Feature visual mockups ─────────────────────────── */

function ContractBatchVisual() {
  const names = [
    { n: 'María González', r: 'Docente primaria' },
    { n: 'Juan C. Pérez', r: 'Instructor técnico' },
    { n: 'Ana Martínez', r: 'Docente secundaria' },
    { n: 'Carlos López', r: 'Coordinador' },
    { n: 'Sandra Ruiz', r: 'Docente primaria' },
  ];
  return (
    <div className="landing-feature-visual" aria-hidden="true">
      <div className="border-b border-border px-4 py-3 flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground">Lote Enero 2026</span>
        <span className="text-xs text-muted-foreground">200 contratos · ZIP listo</span>
      </div>
      {names.map((p) => (
        <div key={p.n} className="landing-feature-row">
          <div className="landing-feature-dot active" />
          <div className="flex-1 min-w-0">
            <span className="block text-sm font-medium text-foreground truncate">{p.n}</span>
            <span className="block text-xs text-muted-foreground truncate">{p.r}</span>
          </div>
          <span className="text-xs text-success font-medium">PDF listo</span>
        </div>
      ))}
      <div className="landing-feature-row text-xs text-muted-foreground">
        <div className="landing-feature-dot" />
        <span>— 195 contratos más —</span>
      </div>
    </div>
  );
}

function AlertsVisual() {
  const alerts = [
    { name: 'Pedro Jiménez', days: 5, color: 'text-destructive' },
    { name: 'Luz Marina Díaz', days: 12, color: 'text-destructive/70' },
    { name: 'Roberto Castro', days: 18, color: 'text-muted-foreground' },
    { name: 'Olga Suárez', days: 26, color: 'text-muted-foreground' },
  ];
  return (
    <div className="landing-feature-visual" aria-hidden="true">
      <div className="border-b border-border px-4 py-3">
        <span className="text-xs font-semibold text-foreground">Contratos próximos a vencer</span>
      </div>
      {alerts.map((a) => (
        <div key={a.name} className="landing-feature-row">
          <div className={`landing-feature-dot ${a.days <= 14 ? 'active' : ''}`} />
          <span className="flex-1 min-w-0 text-sm text-foreground truncate">{a.name}</span>
          <span className={`text-xs font-semibold tabular-nums ${a.color}`}>{a.days} días</span>
        </div>
      ))}
    </div>
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
    <div className="landing-feature-visual" aria-hidden="true">
      <div className="border-b border-border px-4 py-3">
        <span className="text-xs font-semibold text-foreground">María González — Expediente</span>
      </div>
      {docs.map((d) => (
        <div key={d.name} className="landing-feature-row">
          <div className="landing-feature-dot active" />
          <span className="flex-1 min-w-0 text-sm text-foreground truncate">{d.name}</span>
          <span className="text-xs text-muted-foreground tabular-nums">{d.date}</span>
        </div>
      ))}
    </div>
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
    <div className="landing-feature-visual" aria-hidden="true">
      <div className="border-b border-border px-4 py-3 flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground">Planta de personal</span>
        <span className="text-xs text-muted-foreground">47 empleados</span>
      </div>
      {employees.map((e) => (
        <div key={e.name} className="landing-feature-row">
          <div className="landing-feature-dot active" />
          <div className="flex-1 min-w-0">
            <span className="block text-sm font-medium text-foreground truncate">{e.name}</span>
            <span className="block text-xs text-muted-foreground">{e.cargo}</span>
          </div>
          <span className="text-xs font-medium text-success">{e.estado}</span>
        </div>
      ))}
    </div>
  );
}

function MultiempresaVisual() {
  const orgs = [
    { name: 'Operadora Los Andes SAS', nit: '901.234.567-8', active: true },
    { name: 'Fundación Educativa Norte', nit: '800.112.233-4', active: false },
    { name: 'Consorcio Educativo Sur', nit: '700.998.877-2', active: false },
  ];
  return (
    <div className="landing-feature-visual" aria-hidden="true">
      <div className="border-b border-border px-4 py-3">
        <span className="text-xs font-semibold text-foreground">Organizaciones activas</span>
      </div>
      {orgs.map((o) => (
        <div key={o.name} className="landing-feature-row">
          <div className={`landing-feature-dot ${o.active ? 'active' : ''}`} />
          <div className="flex-1 min-w-0">
            <span className="block text-sm font-medium text-foreground truncate">{o.name}</span>
            <span className="block text-xs text-muted-foreground font-mono">{o.nit}</span>
          </div>
          {o.active && <span className="text-xs font-medium text-primary">Activa</span>}
        </div>
      ))}
    </div>
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
    <div className="landing-feature-visual" aria-hidden="true">
      <div className="border-b border-border px-4 py-3">
        <span className="text-xs font-semibold text-foreground">Plantillas configuradas</span>
      </div>
      {templates.map((t) => (
        <div key={t.name} className="landing-feature-row">
          <div className="landing-feature-dot active" />
          <span className="flex-1 min-w-0 text-sm text-foreground truncate">{t.name}</span>
          <span className="text-xs text-muted-foreground">{t.variables} variables</span>
        </div>
      ))}
    </div>
  );
}
