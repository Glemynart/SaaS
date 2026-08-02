import { AlertTriangle, CheckCircle2, Circle, Info, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * StatusBadge — the single mapping from domain status to visual language
 * (DESIGN-SYSTEM.md §7). No other file may map a domain status to a color;
 * new domains extend `STATUS_MAP` here, never a local `className` lookup.
 */

export type StatusSemantic = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const SEMANTIC_ICON: Record<StatusSemantic, typeof Circle> = {
  neutral: Circle,
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
};

interface StatusEntry {
  semantic: StatusSemantic;
  label: string;
}

// Verbatim from DESIGN-SYSTEM.md §7. ADR-002 (payroll) and accounting states
// are reserved for F3/F4 and intentionally omitted until their glossary/surface
// is defined there — adding them now would invent semantics ahead of scope.
const STATUS_MAP = {
  empleado: {
    ACTIVO: { semantic: 'success', label: 'Activo' },
    INACTIVO: { semantic: 'neutral', label: 'Inactivo' },
    SUSPENDIDO: { semantic: 'warning', label: 'Suspendido' },
    RETIRADO: { semantic: 'neutral', label: 'Retirado' },
  },
  // Sede persiste `activo: boolean`; el consumidor lo traduce a esta clave.
  // Misma semántica que Empleado ACTIVO/INACTIVO (§7: vigente / inactivo).
  sede: {
    ACTIVA: { semantic: 'success', label: 'Activa' },
    INACTIVA: { semantic: 'neutral', label: 'Inactiva' },
  },
  // Plantilla persiste `activo: boolean`; el consumidor lo traduce a esta clave.
  plantilla: {
    ACTIVA: { semantic: 'success', label: 'Activa' },
    INACTIVA: { semantic: 'neutral', label: 'Inactiva' },
  },
  // Documento generado: derivado de `pdfUrl` (con/sin PDF renderizado).
  documentoGenerado: {
    PDF_DISPONIBLE: { semantic: 'success', label: 'PDF disponible' },
    SIN_PDF: { semantic: 'neutral', label: 'Sin PDF' },
  },
  contrato: {
    VIGENTE: { semantic: 'success', label: 'Vigente' },
    VENCIDO: { semantic: 'danger', label: 'Vencido' },
    TERMINADO: { semantic: 'neutral', label: 'Terminado' },
    RENOVADO: { semantic: 'info', label: 'Renovado' },
  },
  lote: {
    PENDIENTE: { semantic: 'info', label: 'Pendiente' },
    EN_PROCESO: { semantic: 'info', label: 'En proceso' },
    COMPLETADO: { semantic: 'success', label: 'Completado' },
    COMPLETADO_CON_ERRORES: { semantic: 'warning', label: 'Completado con errores' },
    FALLIDO: { semantic: 'danger', label: 'Fallido' },
  },
  alertaSeverity: {
    INFO: { semantic: 'info', label: 'Informativa' },
    WARNING: { semantic: 'warning', label: 'Atención' },
    CRITICAL: { semantic: 'danger', label: 'Crítica' },
  },
  alertaEstado: {
    OPEN: { semantic: 'warning', label: 'Abierta' },
    RESOLVED: { semantic: 'neutral', label: 'Resuelta' },
  },
  alertGenerationRun: {
    RUNNING: { semantic: 'info', label: 'En curso' },
    SUCCEEDED: { semantic: 'success', label: 'Completada' },
    PARTIAL: { semantic: 'warning', label: 'Parcial' },
    FAILED: { semantic: 'danger', label: 'Fallida' },
    SKIPPED: { semantic: 'neutral', label: 'Omitida' },
  },
  alertGenerationTenant: {
    RUNNING: { semantic: 'info', label: 'En curso' },
    SUCCEEDED: { semantic: 'success', label: 'Completada' },
    FAILED: { semantic: 'danger', label: 'Fallida' },
  },
  factura: {
    BORRADOR: { semantic: 'neutral', label: 'Borrador' },
    EMITIDA: { semantic: 'success', label: 'Emitida' },
    ANULADA: { semantic: 'danger', label: 'Anulada' },
  },
  nominaN2: {
    DRAFT: { semantic: 'neutral', label: 'Borrador' },
    BORRADOR: { semantic: 'neutral', label: 'Borrador' },
    CALCULADA: { semantic: 'info', label: 'Calculada' },
    EN_REVISION: { semantic: 'warning', label: 'En revisión' },
    APROBADA: { semantic: 'success', label: 'Aprobada' },
    CLOSED: { semantic: 'neutral', label: 'Cerrado' },
    CERRADA: { semantic: 'neutral', label: 'Cerrada' },
  },
  payrollBlock: {
    ACTIVE: { semantic: 'danger', label: 'Activo' },
    RESOLVED: { semantic: 'success', label: 'Resuelto' },
    EXCLUDED: { semantic: 'neutral', label: 'Excluido' },
  },
} as const satisfies Record<string, Record<string, StatusEntry>>;

type StatusMap = typeof STATUS_MAP;
export type StatusDomain = keyof StatusMap;
export type StatusOf<D extends StatusDomain> = keyof StatusMap[D];

interface StatusBadgeProps<D extends StatusDomain> {
  domain: D;
  estado: StatusOf<D>;
  className?: string;
}

export function StatusBadge<D extends StatusDomain>({
  domain,
  estado,
  className,
}: StatusBadgeProps<D>) {
  const entry = STATUS_MAP[domain][estado] as StatusEntry;
  const Icon = SEMANTIC_ICON[entry.semantic];

  return (
    <Badge variant={entry.semantic} className={cn('gap-1', className)}>
      <Icon className="size-3.5" aria-hidden="true" />
      {entry.label}
    </Badge>
  );
}
