import { type Sede } from '../services/sedes-api';
import { useUpdateSede } from '../hooks/use-sedes';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface SedesTableProps {
  sedes: Sede[];
  isLoading: boolean;
  onEdit: (sede: Sede) => void;
}

export function SedesTable({ sedes, isLoading, onEdit }: SedesTableProps) {
  const updateMutation = useUpdateSede();

  const handleToggle = (sede: Sede) => {
    if (sede.activo) {
      if (confirm('¿Desactivar esta sede?')) {
        updateMutation.mutate({ id: sede.id, data: { activo: false } });
      }
    } else {
      updateMutation.mutate({ id: sede.id, data: { activo: true } });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (sedes.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/50">
        <p className="text-sm text-gray-500">No se encontraron sedes.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-gray-100 bg-gray-50/50 text-gray-500">
          <tr>
            <th className="px-6 py-4 font-medium">Nombre</th>
            <th className="px-6 py-4 font-medium">Municipio</th>
            <th className="px-6 py-4 font-medium">Dirección</th>
            <th className="px-6 py-4 font-medium">Estado</th>
            <th className="px-6 py-4 text-right font-medium">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {sedes.map((sede) => (
            <tr key={sede.id} className="group transition-colors hover:bg-gray-50/50">
              <td className="px-6 py-4">
                <div className="font-medium text-gray-900">{sede.nombre}</div>
              </td>
              <td className="px-6 py-4 text-gray-600">
                {sede.municipio ? (
                  <>
                    {sede.municipio.nombre}
                    <span className="block text-xs text-gray-400">
                      {sede.municipio.departamento}
                    </span>
                  </>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>
              <td className="px-6 py-4 text-gray-600">
                {sede.direccion || <span className="text-gray-400">—</span>}
              </td>
              <td className="px-6 py-4">
                <Badge className={sede.activo ? 'border-green-200 bg-green-50 text-green-700' : ''}>
                  {sede.activo ? 'Activa' : 'Inactiva'}
                </Badge>
              </td>
              <td className="px-6 py-4 text-right">
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(sede)}
                    className="h-8 px-2 text-gray-500 hover:text-gray-900"
                  >
                    Editar
                  </Button>
                  {sede.activo ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={updateMutation.isPending}
                      onClick={() => handleToggle(sede)}
                      className="h-8 px-2 text-red-500 hover:bg-red-50 hover:text-red-600"
                    >
                      Desactivar
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={updateMutation.isPending}
                      onClick={() => handleToggle(sede)}
                      className="h-8 px-2 text-green-600 hover:bg-green-50 hover:text-green-700"
                    >
                      Activar
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
