'use client';

import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Clock3,
  FileArchive,
  FileText,
  Receipt,
  ShieldCheck,
  UserRound,
  Users,
} from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useMe } from '@/features/auth/hooks/use-auth';

const pendingModules = [
  {
    label: 'Empleados',
    description: 'Base para altas, búsqueda e importación masiva.',
    icon: Users,
  },
  {
    label: 'Contratos',
    description: 'Plantillas, generacion individual y lotes.',
    icon: FileText,
  },
  {
    label: 'Expediente Digital',
    description: 'Documentos organizados por empleado y categoria.',
    icon: FileArchive,
  },
  {
    label: 'Alertas',
    description: 'Vencimientos con anticipacion operativa.',
    icon: Clock3,
  },
  {
    label: 'Facturación',
    description: 'Clientes, productos y documentos electrónicos.',
    icon: Receipt,
  },
];

export function DashboardHome() {
  const me = useMe();
  const user = me.data?.user;

  if (me.isLoading) {
    return <DashboardSkeleton />;
  }

  if (me.isError) {
    return (
      <Alert variant="destructive" className="max-w-2xl">
        No se pudo validar la sesion. Cierra sesion e intenta ingresar nuevamente.
      </Alert>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="dashboard-hero">
        <div className="space-y-4">
          <Badge className="w-fit">
            <ShieldCheck className="mr-1 size-3" aria-hidden="true" />
            Sesión autenticada
          </Badge>
          <div className="space-y-2">
            <h1 className="max-w-3xl text-[2rem] font-semibold leading-tight tracking-[-0.035em] text-foreground text-balance sm:text-[2.45rem]">
              Hola, {user?.nombre ?? 'equipo'}.
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground text-pretty">
              Tu espacio de trabajo esta listo. Este primer panel confirma identidad, empresa activa
              y rol antes de habilitar los modulos operativos.
            </p>
          </div>
        </div>

        <div className="session-plate">
          <p className="text-xs font-medium text-muted-foreground">Estado de sesion</p>
          <div className="mt-3 flex items-center gap-2">
            <span className="size-2 rounded-full bg-success" />
            <p className="text-sm font-medium text-foreground">Activa y renovable</p>
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            El access token se renueva desde una cookie HTTP-only cuando expira.
          </p>
          <div className="mt-4 grid gap-2">
            <div className="session-line">
              <span>Empresa</span>
              <strong>aislada</strong>
            </div>
            <div className="session-line">
              <span>Acceso</span>
              <strong>vigente</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-[1.15fr_1.15fr_0.7fr]">
        <InfoPanel
          icon={UserRound}
          label="Usuario"
          value={`${user?.nombre ?? ''} ${user?.apellido ?? ''}`.trim() || user?.email || '-'}
          detail={user?.email ?? 'Correo confirmado'}
        />
        <InfoPanel
          icon={Building2}
          label="Empresa"
          value={user?.tenantNombre ?? user?.tenantId ?? '-'}
          detail="Tenant activo"
        />
        <InfoPanel
          icon={ShieldCheck}
          label="Rol"
          value={user?.rol ?? '-'}
          detail="Permisos vigentes"
        />
      </section>

      <section className="module-board">
        <div className="module-board-header">
          <div>
            <h2 className="text-base font-semibold text-foreground">Módulos preparados</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Aun no se implementan funciones de negocio; quedan visibles como mapa de crecimiento.
            </p>
          </div>
          <Badge>Próximas fases</Badge>
        </div>

        <div className="module-list">
          {pendingModules.map((module, index) => {
            const Icon = module.icon;

            return (
              <div className="module-row" key={module.label}>
                <div className="flex min-w-0 items-center gap-3">
                  <div className="module-row-index" aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </div>
                  <div className="grid size-9 shrink-0 place-items-center rounded-md border border-border bg-background">
                    <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{module.label}</p>
                    <p className="truncate text-xs text-muted-foreground">{module.description}</p>
                  </div>
                </div>
                <Badge>Pendiente</Badge>
              </div>
            );
          })}
        </div>
      </section>

      <Alert>
        <div className="flex items-start gap-2">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>
            El tenant actual proviene del JWT emitido por el backend. La interfaz no solicita ni
            envia tenantId manipulable para operaciones privadas.
          </span>
        </div>
      </Alert>
    </div>
  );
}

function InfoPanel({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof UserRound;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="info-panel">
      <div className="flex items-center justify-between gap-3">
        <div className="grid size-8 place-items-center rounded-md border border-border bg-background">
          <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
        </div>
        <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-lg font-semibold tracking-[-0.018em] text-foreground">
        {value}
      </p>
      <p className="mt-1 truncate text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Skeleton className="h-52 w-full" />
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
      <Skeleton className="h-72 w-full" />
    </div>
  );
}
