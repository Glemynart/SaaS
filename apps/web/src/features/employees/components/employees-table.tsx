import { type Employee } from '../services/employees-api';
import { formatNombreCompleto } from '@saas/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface EmployeesTableProps {
  employees: Employee[];
  isLoading: boolean;
  onEdit: (employee: Employee) => void;
  onDelete: (id: string) => void;
}

export function EmployeesTable({ employees, isLoading, onEdit, onDelete }: EmployeesTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (employees.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/50">
        <p className="text-sm text-gray-500">No se encontraron empleados.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-gray-100 bg-gray-50/50 text-gray-500">
          <tr>
            <th className="px-6 py-4 font-medium">Empleado</th>
            <th className="px-6 py-4 font-medium">Documento</th>
            <th className="px-6 py-4 font-medium">Cargo</th>
            <th className="px-6 py-4 font-medium">Estado</th>
            <th className="px-6 py-4 text-right font-medium">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {employees.map((emp) => (
            <tr key={emp.id} className="group transition-colors hover:bg-gray-50/50">
              <td className="px-6 py-4">
                <div className="font-medium text-gray-900">{formatNombreCompleto(emp)}</div>
                {emp.email && <div className="text-gray-500">{emp.email}</div>}
              </td>
              <td className="px-6 py-4 text-gray-600">
                {emp.tipoDocumento} {emp.cedula}
              </td>
              <td className="px-6 py-4 text-gray-600">
                {emp.cargo}
                {emp.dependencia && (
                  <span className="block text-xs text-gray-400">{emp.dependencia}</span>
                )}
              </td>
              <td className="px-6 py-4">
                <Badge
                  className={
                    emp.estado === 'ACTIVO' ? 'bg-green-50 text-green-700 border-green-200' : ''
                  }
                >
                  {emp.estado}
                </Badge>
              </td>
              <td className="px-6 py-4 text-right">
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(emp)}
                    className="h-8 px-2 text-gray-500 hover:text-gray-900"
                  >
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm('¿Desactivar este empleado?')) {
                        onDelete(emp.id);
                      }
                    }}
                    className="h-8 px-2 text-red-500 hover:bg-red-50 hover:text-red-600"
                  >
                    Desactivar
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
