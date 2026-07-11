import { Badge } from '@/components/ui/badge';
import { StatusBadge, type StatusOf } from '@/components/ui/status-badge';

const EMPLOYEE_ESTADOS = ['ACTIVO', 'INACTIVO', 'SUSPENDIDO', 'RETIRADO'] as const;

function isEmployeeEstado(value: string): value is StatusOf<'empleado'> {
  return (EMPLOYEE_ESTADOS as readonly string[]).includes(value);
}

/**
 * Estado del empleado vía StatusBadge (taxonomía DS §7). El backend tipa
 * `estado` como string: un valor fuera del dominio cae a un Badge neutral
 * con la etiqueta cruda en lugar de romper el render.
 */
export function EmployeeStatusBadge({ estado }: { estado: string }) {
  return isEmployeeEstado(estado) ? (
    <StatusBadge domain="empleado" estado={estado} />
  ) : (
    <Badge>{estado}</Badge>
  );
}
