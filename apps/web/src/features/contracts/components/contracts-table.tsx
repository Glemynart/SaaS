import { type Contract } from '../services/contracts-api';
import { formatNombreCompleto } from '@saas/types';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

const TIPO_LABELS: Record<string, string> = {
  TERMINO_FIJO: 'Término Fijo',
  TERMINO_INDEFINIDO: 'Término Indefinido',
  OBRA_LABOR: 'Obra o Labor',
  APRENDIZAJE: 'Aprendizaje',
  PRESTACION_SERVICIOS: 'Prestación Servicios',
};

function estadoBadge(estado: string) {
  const map: Record<string, string> = {
    VIGENTE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    VENCIDO: 'bg-red-50 text-red-700 border-red-200',
    TERMINADO: 'bg-gray-100 text-gray-600 border-gray-200',
    RENOVADO: 'bg-blue-50 text-blue-700 border-blue-200',
  };
  return map[estado] ?? '';
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function cop(n: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(n);
}

export function ContractsTable({
  contracts,
  isLoading,
}: {
  contracts: Contract[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (contracts.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
        No se encontraron contratos.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border bg-surface/50 text-muted-foreground">
          <tr>
            <th className="px-6 py-3 font-medium">Empleado</th>
            <th className="px-6 py-3 font-medium">Tipo</th>
            <th className="px-6 py-3 font-medium">Estado</th>
            <th className="px-6 py-3 font-medium">Cargo</th>
            <th className="px-6 py-3 font-medium">Salario</th>
            <th className="px-6 py-3 font-medium">Inicio</th>
            <th className="px-6 py-3 font-medium">Fin</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {contracts.map((c) => (
            <tr key={c.id} className="hover:bg-muted/40 transition-colors">
              <td className="px-6 py-3">
                <Link
                  href={`/contratos/${c.id}`}
                  className="font-medium text-foreground hover:underline"
                >
                  {formatNombreCompleto(c.empleado)}
                </Link>
                <div className="text-xs text-muted-foreground">{c.empleado.cedula}</div>
                {c.sede && <div className="text-xs text-muted-foreground">{c.sede.nombre}</div>}
              </td>
              <td className="px-6 py-3 text-muted-foreground">{TIPO_LABELS[c.tipo] ?? c.tipo}</td>
              <td className="px-6 py-3">
                <Badge className={estadoBadge(c.estado)}>{c.estado}</Badge>
              </td>
              <td className="px-6 py-3 text-muted-foreground">{c.cargo}</td>
              <td className="px-6 py-3 text-muted-foreground">{cop(c.salario)}</td>
              <td className="px-6 py-3 text-muted-foreground">{formatDate(c.fechaInicio)}</td>
              <td className="px-6 py-3 text-muted-foreground">
                {c.fechaFin ? formatDate(c.fechaFin) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
