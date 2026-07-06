import {
  Bell,
  Calculator,
  FileText,
  Files,
  LayoutDashboard,
  MapPin,
  Receipt,
  ScrollText,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { UserRole } from '@/types/auth';

export type NavBadgeSource = 'alerts-open-count';

export interface NavChildItem {
  label: string;
  href: string;
  requiredRole?: UserRole[];
}

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** null = primer bloque sin etiqueta visible (AS-D1). */
  group: string | null;
  children?: NavChildItem[];
  requiredRole?: UserRole[];
  badge?: NavBadgeSource;
}

/**
 * Árbol de navegación v2 (APP-SHELL.md §2.1/§2.5). Datos, no JSX: alimenta
 * sidebar, drawer móvil y breadcrumbs. Un módulo nuevo = una entrada aquí.
 */
export const NAV_TREE: NavItem[] = [
  { label: 'Inicio', href: '/dashboard', icon: LayoutDashboard, group: null },
  { label: 'Alertas', href: '/alertas', icon: Bell, group: null, badge: 'alerts-open-count' },
  { label: 'Empleados', href: '/empleados', icon: Users, group: 'Personal' },
  {
    label: 'Contratos',
    href: '/contratos',
    icon: FileText,
    group: 'Personal',
    children: [{ label: 'Lotes', href: '/contratos/lotes' }],
  },
  { label: 'Plantillas', href: '/documentos/plantillas', icon: ScrollText, group: 'Documentos' },
  { label: 'Generados', href: '/documentos/generados', icon: Files, group: 'Documentos' },
  {
    label: 'Nómina',
    href: '/nomina',
    icon: Calculator,
    group: 'Procesos',
    children: [{ label: 'Períodos', href: '/nomina/periodos' }],
  },
  {
    label: 'Facturación',
    href: '/facturacion',
    icon: Receipt,
    group: 'Procesos',
    children: [
      { label: 'Clientes', href: '/facturacion/clientes' },
      { label: 'Productos', href: '/facturacion/productos' },
      { label: 'Facturas', href: '/facturacion/facturas' },
    ],
  },
  { label: 'Sedes', href: '/sedes', icon: MapPin, group: 'Organización' },
  {
    label: 'Identidad corporativa',
    href: '/configuracion/identidad',
    icon: Settings,
    group: 'Organización',
  },
];

export interface NavGroupEntry {
  group: string | null;
  items: NavItem[];
}

/** Agrupa preservando el orden de declaración (AS-D2). */
export function groupNavItems(items: NavItem[] = NAV_TREE): NavGroupEntry[] {
  const order: (string | null)[] = [];
  const map = new Map<string | null, NavItem[]>();
  for (const item of items) {
    if (!map.has(item.group)) {
      map.set(item.group, []);
      order.push(item.group);
    }
    map.get(item.group)!.push(item);
  }
  return order.map((group) => ({ group, items: map.get(group)! }));
}

export interface FlatNavEntry {
  label: string;
  href: string;
  parent?: FlatNavEntry;
}

/** Aplana el árbol (un solo nivel de hijos, AS-D3) para lookups de breadcrumbs/activo. */
export function flattenNavTree(items: NavItem[] = NAV_TREE): FlatNavEntry[] {
  const flat: FlatNavEntry[] = [];
  for (const item of items) {
    const entry: FlatNavEntry = { label: item.label, href: item.href };
    flat.push(entry);
    for (const child of item.children ?? []) {
      flat.push({ label: child.label, href: child.href, parent: entry });
    }
  }
  return flat;
}

/**
 * Regla única de ítem activo (APP-SHELL.md §4.5): coincide `pathname` exacto
 * o descendiente (`href + '/'`); si varias entradas coinciden, gana la de
 * `href` más específico (más largo).
 */
export function findActiveEntry(
  pathname: string,
  entries: FlatNavEntry[] = flattenNavTree(),
): FlatNavEntry | undefined {
  const matches = entries.filter(
    (entry) => pathname === entry.href || pathname.startsWith(`${entry.href}/`),
  );
  if (matches.length === 0) return undefined;
  return matches.reduce((best, entry) => (entry.href.length > best.href.length ? entry : best));
}

/** Filtro por rol (§8.10) — preparado para VIEWER (H2), inerte mientras ningún ítem declare `requiredRole`. */
export function isNavItemVisible(
  item: { requiredRole?: UserRole[] },
  role: UserRole | undefined,
): boolean {
  if (!item.requiredRole || item.requiredRole.length === 0) return true;
  return !!role && item.requiredRole.includes(role);
}
