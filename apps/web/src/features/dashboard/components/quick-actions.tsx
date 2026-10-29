'use client';

import Link from 'next/link';
import { FileText, Layers, Receipt, UserPlus, type LucideIcon } from 'lucide-react';
import type { UserRole } from '@/types/auth';

interface QuickAction {
  label: string;
  href: string;
  icon: LucideIcon;
}

const NUEVO_EMPLEADO: QuickAction = { label: 'Nuevo empleado', href: '/empleados', icon: UserPlus };
const GENERAR_CONTRATO: QuickAction = {
  label: 'Generar contrato',
  href: '/contratos',
  icon: FileText,
};
const NUEVO_LOTE: QuickAction = { label: 'Nuevo lote', href: '/contratos/lotes', icon: Layers };
const NUEVA_FACTURA: QuickAction = {
  label: 'Nueva factura',
  href: '/facturacion/facturas',
  icon: Receipt,
};

/** Consciencia de rol editorial (§5): OPERADOR prioriza captura; ADMIN añade factura. Máximo 4. */
const ACTIONS_BY_ROLE: Record<UserRole, QuickAction[]> = {
  OPERADOR: [NUEVO_EMPLEADO, GENERAR_CONTRATO, NUEVO_LOTE],
  ADMIN: [NUEVO_EMPLEADO, GENERAR_CONTRATO, NUEVO_LOTE, NUEVA_FACTURA],
};

/**
 * Zona de acciones rápidas (DB-D7): secundaria y calmada, al pie. Cada acción
 * navega al punto de creación del módulo; ninguna es la acción primaria de la
 * pantalla (regla del 10 %).
 */
export function QuickActions({ rol }: { rol: UserRole }) {
  const actions = ACTIONS_BY_ROLE[rol];

  return (
    <section aria-labelledby="acciones-rapidas-heading">
      <h2
        id="acciones-rapidas-heading"
        className="text-2xs font-medium uppercase tracking-wider text-muted-foreground"
      >
        Acciones rápidas
      </h2>
      <div className="mt-3 flex flex-col gap-2 md:flex-row md:flex-wrap md:gap-3">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className="inline-flex h-9 items-center gap-2 rounded-(--radius-control) border border-border bg-surface px-3 text-sm text-foreground transition-colors duration-150 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:w-auto"
            >
              <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
              {action.label}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
