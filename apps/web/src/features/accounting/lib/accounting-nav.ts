import {
  BarChart3,
  Building2,
  CalendarDays,
  FileText,
  GitBranch,
  LayoutDashboard,
  type LucideIcon,
  ScrollText,
  Users,
} from 'lucide-react';

export type AccountingSectionId =
  | 'dashboard'
  | 'plan-cuentas'
  | 'mapeos'
  | 'terceros'
  | 'centros-costo'
  | 'periodos'
  | 'comprobantes'
  | 'reportes';

export interface AccountingSection {
  id: AccountingSectionId;
  label: string;
  href: string;
  description: string;
  icon: LucideIcon;
}

export const ACCOUNTING_SECTIONS: AccountingSection[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    href: '/contabilidad',
    description: 'Entrada operativa del módulo contable.',
    icon: LayoutDashboard,
  },
  {
    id: 'plan-cuentas',
    label: 'Plan de cuentas',
    href: '/contabilidad/plan-cuentas',
    description: 'Catálogo PUC del tenant y estado operativo de las cuentas.',
    icon: ScrollText,
  },
  {
    id: 'mapeos',
    label: 'Mapeos',
    href: '/contabilidad/mapeos',
    description: 'Relación entre roles contables del sistema y cuentas configuradas.',
    icon: GitBranch,
  },
  {
    id: 'terceros',
    label: 'Terceros',
    href: '/contabilidad/terceros',
    description: 'Contrapartes contables canónicas de la organización.',
    icon: Users,
  },
  {
    id: 'centros-costo',
    label: 'Centros de costo',
    href: '/contabilidad/centros-costo',
    description: 'Dimensión operativa para clasificar movimientos contables.',
    icon: Building2,
  },
  {
    id: 'periodos',
    label: 'Períodos',
    href: '/contabilidad/periodos',
    description: 'Calendario contable, validación y cierre de períodos.',
    icon: CalendarDays,
  },
  {
    id: 'comprobantes',
    label: 'Comprobantes',
    href: '/contabilidad/comprobantes',
    description: 'Consulta de comprobantes contabilizados y registro manual.',
    icon: FileText,
  },
  {
    id: 'reportes',
    label: 'Reportes',
    href: '/contabilidad/reportes',
    description: 'Libros y estados financieros derivados del Ledger.',
    icon: BarChart3,
  },
];

export function getAccountingSection(id: AccountingSectionId) {
  return ACCOUNTING_SECTIONS.find((section) => section.id === id);
}
