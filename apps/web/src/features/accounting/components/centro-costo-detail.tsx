import { Badge } from '@/components/ui/badge';
import type { CentroCosto } from '../services/accounting-api';

export function CentroCostoDetail({
  centro,
  sedeNombre,
}: {
  centro: CentroCosto;
  sedeNombre?: string;
}) {
  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-sm text-muted-foreground">{centro.codigo}</p>
        <h3 className="mt-1 text-lg font-semibold text-foreground">{centro.nombre}</h3>
        <Badge className="mt-3" variant={centro.activo ? 'success' : 'neutral'}>
          {centro.activo ? 'Activo' : 'Inactivo'}
        </Badge>
      </div>
      <dl>
        <div className="flex items-start justify-between gap-4 border-b border-border-soft py-3">
          <dt className="text-sm text-muted-foreground">Sede</dt>
          <dd className="text-right text-sm font-medium text-foreground">
            {sedeNombre || centro.sedeId || '—'}
          </dd>
        </div>
      </dl>
    </div>
  );
}
