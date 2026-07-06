import { formatNombreCompleto } from '@saas/types';
import type { AlertItem } from '@/features/alerts/services/alerts-api';
import type { BillingDashboard } from '@/features/billing/services/billing-api';
import type { LoteEstado, LoteSummary } from '@/features/lotes/services/lotes-api';
import type { PayrollPeriod } from '@/features/payroll/services/payroll-api';
import type { UserRole } from '@/types/auth';

/**
 * Modelo puro de la Bandeja del día (DASHBOARD.md §4). Sin fetch, sin JSX:
 * recibe los datos de las fuentes reales y `hoy`, y devuelve las bandas
 * ordenadas de forma determinista (§4.2). Es el punto de extensión para
 * módulos futuros (§12): un módulo nuevo aporta un builder aquí.
 */

export type BandaId = 'requiere-accion' | 'esta-semana' | 'este-mes' | 'en-curso';

export const BANDA_LABELS: Record<BandaId, string> = {
  'requiere-accion': 'Requiere acción',
  'esta-semana': 'Esta semana',
  'este-mes': 'Este mes',
  'en-curso': 'En curso',
};

const BANDA_ORDER: BandaId[] = ['requiere-accion', 'esta-semana', 'este-mes', 'en-curso'];

export type BandejaTipo = 'contrato' | 'alerta' | 'lote' | 'nomina' | 'factura';

/** Referencia tipada al StatusBadge (DS §7) — el mapeo a color vive allí, no aquí. */
export type BandejaBadge =
  | { domain: 'contrato'; estado: 'VENCIDO' }
  | { domain: 'alertaSeverity'; estado: 'INFO' | 'WARNING' | 'CRITICAL' }
  | { domain: 'lote'; estado: LoteEstado }
  | { domain: 'nominaN2'; estado: 'DRAFT' }
  | { domain: 'factura'; estado: 'BORRADOR' };

export interface BandejaItem {
  id: string;
  tipo: BandejaTipo;
  /** Línea 1 — frase en lenguaje del usuario que nombra la entidad (§4.4). */
  asunto: string;
  badge: BandejaBadge;
  /** Frase temporal explícita — el tiempo nunca viaja solo en color (WCAG 1.4.1). */
  fraseTemporal: string;
  meta?: string;
  /** Destino único de navegación de la fila (DB-D5). */
  href?: string;
  accionLabel?: string;
  /** Nombre accesible completo de la acción primaria (§10). */
  accionNombreAccesible?: string;
  /** Si la fila admite Resolver, el id de la alerta subyacente. */
  alertaResolubleId?: string;
  nombreResoluble?: string;
  // Claves de ordenación (§4.2)
  dueDate: Date | null;
  severityRank: number; // 0 CRITICAL · 1 WARNING · 2 INFO · 3 neutral
  createdAt: Date;
}

export interface Banda {
  id: BandaId;
  label: string;
  items: BandejaItem[];
}

const DAY_MS = 86_400_000;

/** Días de diferencia entre fechas, comparando solo la parte de fecha. */
function diffDias(desde: Date, hasta: Date): number {
  const a = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate());
  const b = new Date(hasta.getFullYear(), hasta.getMonth(), hasta.getDate());
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

function fraseVencimiento(dueDate: Date, hoy: Date): string {
  const dias = diffDias(hoy, dueDate);
  if (dias < -1) return `venció hace ${-dias} días`;
  if (dias === -1) return 'venció ayer';
  if (dias === 0) return 'vence hoy';
  if (dias === 1) return 'vence mañana';
  return `vence en ${dias} días`;
}

export function fraseDesde(fecha: Date, hoy: Date): string {
  const dias = diffDias(fecha, hoy);
  if (dias <= 0) return 'hoy';
  if (dias === 1) return 'desde ayer';
  return `desde hace ${dias} días`;
}

const SEVERITY_RANK: Record<AlertItem['severity'], number> = {
  CRITICAL: 0,
  WARNING: 1,
  INFO: 2,
};

const NEUTRAL_RANK = 3;

function nombreEmpleado(employee: NonNullable<AlertItem['employee']>): string {
  return formatNombreCompleto({
    primerNombre: employee.primerNombre,
    segundoNombre: employee.segundoNombre,
    primerApellido: employee.primerApellido,
    segundoApellido: employee.segundoApellido,
  });
}

const TITULO_SIN_CONTRATO = 'Empleado sin contrato registrado';

export function buildAlertItems(alerts: AlertItem[], hoy: Date): BandejaItem[] {
  return alerts
    .filter((alert) => alert.status === 'OPEN')
    .map((alert): BandejaItem => {
      const dueDate = alert.dueDate ? new Date(alert.dueDate) : null;
      const createdAt = new Date(alert.createdAt);
      const nombre = alert.employee ? nombreEmpleado(alert.employee) : null;
      const vencido = dueDate !== null && diffDias(hoy, dueDate) < 0;

      // Contrato por vencer / vencido: dueDate real de contrato (§4.1).
      if (dueDate && nombre) {
        return {
          id: `alerta-${alert.id}`,
          tipo: 'contrato',
          asunto: vencido
            ? `El contrato de ${nombre} está vencido`
            : `El contrato de ${nombre} vence pronto`,
          badge: vencido
            ? { domain: 'contrato', estado: 'VENCIDO' }
            : { domain: 'alertaSeverity', estado: alert.severity },
          fraseTemporal: fraseVencimiento(dueDate, hoy),
          meta: nombre,
          href: alert.employeeId ? `/empleados/${alert.employeeId}` : undefined,
          accionLabel: 'Ver empleado',
          accionNombreAccesible: `Ver empleado ${nombre}`,
          alertaResolubleId: alert.id,
          nombreResoluble: `Resolver alerta del contrato de ${nombre}`,
          dueDate,
          severityRank: SEVERITY_RANK[alert.severity],
          createdAt,
        };
      }

      // Alerta de empleado sin contrato (la generación actual de "docs faltantes").
      if (nombre) {
        return {
          id: `alerta-${alert.id}`,
          tipo: 'alerta',
          asunto:
            alert.titulo === TITULO_SIN_CONTRATO
              ? `${nombre} no tiene un contrato activo registrado`
              : alert.titulo,
          badge: { domain: 'alertaSeverity', estado: alert.severity },
          fraseTemporal: fraseDesde(createdAt, hoy),
          meta: nombre,
          href: alert.employeeId ? `/empleados/${alert.employeeId}` : undefined,
          accionLabel: 'Ver empleado',
          accionNombreAccesible: `Ver empleado ${nombre}`,
          alertaResolubleId: alert.id,
          nombreResoluble: `Resolver alerta de ${nombre}`,
          dueDate,
          severityRank: SEVERITY_RANK[alert.severity],
          createdAt,
        };
      }

      // Alerta genérica sin empleado asociado.
      return {
        id: `alerta-${alert.id}`,
        tipo: 'alerta',
        asunto: alert.titulo,
        badge: { domain: 'alertaSeverity', estado: alert.severity },
        fraseTemporal: fraseDesde(createdAt, hoy),
        alertaResolubleId: alert.id,
        nombreResoluble: `Resolver alerta ${alert.titulo}`,
        dueDate,
        severityRank: SEVERITY_RANK[alert.severity],
        createdAt,
      };
    });
}

const LOTE_ESTADOS_BANDEJA: LoteEstado[] = ['EN_PROCESO', 'COMPLETADO_CON_ERRORES', 'FALLIDO'];

export function buildLoteItems(lotes: LoteSummary[], hoy: Date): BandejaItem[] {
  return lotes
    .filter((lote) => LOTE_ESTADOS_BANDEJA.includes(lote.estado))
    .map((lote): BandejaItem => {
      const createdAt = new Date(lote.createdAt);
      const asunto =
        lote.estado === 'FALLIDO'
          ? `El lote «${lote.nombreLote}» falló`
          : lote.estado === 'COMPLETADO_CON_ERRORES'
            ? `El lote «${lote.nombreLote}» terminó con ${lote.fallidos} ${lote.fallidos === 1 ? 'error' : 'errores'}`
            : `El lote «${lote.nombreLote}» está en proceso`;
      const meta =
        lote.estado === 'EN_PROCESO'
          ? `${lote.procesados} de ${lote.total} procesados`
          : `${lote.fallidos} de ${lote.total} con error`;

      return {
        id: `lote-${lote.id}`,
        tipo: 'lote',
        asunto,
        badge: { domain: 'lote', estado: lote.estado },
        fraseTemporal: fraseDesde(new Date(lote.iniciadoAt ?? lote.createdAt), hoy),
        meta,
        href: `/contratos/lotes/${lote.id}`,
        accionLabel: 'Ver lote',
        accionNombreAccesible: `Ver lote ${lote.nombreLote}`,
        dueDate: null,
        severityRank:
          lote.estado === 'FALLIDO' ? 0 : lote.estado === 'COMPLETADO_CON_ERRORES' ? 1 : 2,
        createdAt,
      };
    });
}

export function buildNominaItems(periods: PayrollPeriod[], hoy: Date): BandejaItem[] {
  return periods
    .filter((period) => period.status === 'DRAFT')
    .map((period): BandejaItem => {
      const createdAt = new Date(period.createdAt);
      return {
        id: `nomina-${period.id}`,
        tipo: 'nomina',
        asunto: `La nómina «${period.nombre}» sigue en borrador`,
        badge: { domain: 'nominaN2', estado: 'DRAFT' },
        fraseTemporal: fraseDesde(createdAt, hoy),
        href: `/nomina/periodos/${period.id}`,
        accionLabel: 'Ver período',
        accionNombreAccesible: `Ver período de nómina ${period.nombre}`,
        dueDate: null,
        severityRank: NEUTRAL_RANK,
        createdAt,
      };
    });
}

export function buildFacturaItems(dashboard: BillingDashboard, hoy: Date): BandejaItem[] {
  if (dashboard.facturasBorrador <= 0) return [];
  const n = dashboard.facturasBorrador;
  return [
    {
      id: 'facturas-borrador',
      tipo: 'factura',
      asunto: n === 1 ? 'Tienes 1 factura en borrador' : `Tienes ${n} facturas en borrador`,
      badge: { domain: 'factura', estado: 'BORRADOR' },
      fraseTemporal: n === 1 ? 'pendiente de emitir' : 'pendientes de emitir',
      href: '/facturacion/facturas',
      accionLabel: 'Ver facturas',
      accionNombreAccesible: 'Ver facturas en borrador',
      dueDate: null,
      severityRank: NEUTRAL_RANK,
      // Sin fecha propia (agregado): se ancla a hoy para el desempate.
      createdAt: hoy,
    },
  ];
}

/** Banda de un ítem: la primera que cumpla (§4.2). */
export function clasificarBanda(item: BandejaItem, hoy: Date): BandaId {
  const dias = item.dueDate ? diffDias(hoy, item.dueDate) : null;
  const loteConProblemas =
    item.badge.domain === 'lote' &&
    (item.badge.estado === 'FALLIDO' || item.badge.estado === 'COMPLETADO_CON_ERRORES');
  const critico = item.badge.domain === 'alertaSeverity' && item.badge.estado === 'CRITICAL';

  if ((dias !== null && dias < 0) || critico || loteConProblemas) return 'requiere-accion';
  if (
    (dias !== null && dias <= 7) ||
    (item.badge.domain === 'alertaSeverity' && item.badge.estado === 'WARNING' && dias === null)
  ) {
    return 'esta-semana';
  }
  if (dias !== null && dias <= 30) return 'este-mes';
  return 'en-curso';
}

/**
 * Matiz de énfasis por rol (DB-D6): dentro de "En curso", ADMIN ve la nómina
 * por encima de las facturas; OPERADOR a la inversa. Reordenamiento editorial,
 * nunca ocultamiento.
 */
function roleRank(item: BandejaItem, banda: BandaId, rol: UserRole): number {
  if (banda !== 'en-curso') return 0;
  if (item.tipo === 'nomina') return rol === 'ADMIN' ? 0 : 1;
  if (item.tipo === 'factura') return rol === 'ADMIN' ? 1 : 0;
  return 0;
}

/** Orden estable dentro de banda (§4.2): dueDate asc → severidad → rol → createdAt desc. */
function compareItems(a: BandejaItem, b: BandejaItem, banda: BandaId, rol: UserRole): number {
  if (a.dueDate && b.dueDate && a.dueDate.getTime() !== b.dueDate.getTime()) {
    return a.dueDate.getTime() - b.dueDate.getTime();
  }
  if (Boolean(a.dueDate) !== Boolean(b.dueDate)) return a.dueDate ? -1 : 1;
  if (a.severityRank !== b.severityRank) return a.severityRank - b.severityRank;
  const rankA = roleRank(a, banda, rol);
  const rankB = roleRank(b, banda, rol);
  if (rankA !== rankB) return rankA - rankB;
  return b.createdAt.getTime() - a.createdAt.getTime();
}

/** Agrupa y ordena; las bandas vacías no se devuelven (DB-D3). */
export function componerBandeja(items: BandejaItem[], hoy: Date, rol: UserRole): Banda[] {
  const porBanda = new Map<BandaId, BandejaItem[]>();
  for (const item of items) {
    const banda = clasificarBanda(item, hoy);
    const bucket = porBanda.get(banda);
    if (bucket) bucket.push(item);
    else porBanda.set(banda, [item]);
  }

  return BANDA_ORDER.filter((id) => porBanda.has(id)).map((id) => ({
    id,
    label: BANDA_LABELS[id],
    items: porBanda.get(id)!.sort((a, b) => compareItems(a, b, id, rol)),
  }));
}
