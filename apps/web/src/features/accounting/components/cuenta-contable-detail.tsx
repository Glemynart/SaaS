import { Badge } from '@/components/ui/badge';
import type { CuentaContable } from '../services/accounting-api';

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border-soft py-3 last:border-b-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

export function CuentaContableDetail({ cuenta }: { cuenta: CuentaContable }) {
  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-sm text-muted-foreground">{cuenta.codigo}</p>
        <h3 className="mt-1 text-lg font-semibold text-foreground">{cuenta.nombre}</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant={cuenta.activa ? 'success' : 'neutral'}>
            {cuenta.activa ? 'Activa' : 'Inactiva'}
          </Badge>
          {cuenta.esCuentaSistema && <Badge variant="neutral">Cuenta de sistema</Badge>}
          {cuenta.imputable && <Badge variant="info">Imputable</Badge>}
        </div>
      </div>
      <dl>
        <Detail label="Clase contable" value={cuenta.claseContable.replaceAll('_', ' ')} />
        <Detail label="Naturaleza" value={cuenta.naturaleza === 'DEBITO' ? 'Débito' : 'Crédito'} />
        <Detail label="Nivel" value={String(cuenta.nivel)} />
        <Detail label="Requiere tercero" value={cuenta.requiereTercero ? 'Sí' : 'No'} />
        <Detail label="Requiere centro de costo" value={cuenta.requiereCentroCosto ? 'Sí' : 'No'} />
        <Detail label="Requiere base gravable" value={cuenta.requiereBase ? 'Sí' : 'No'} />
      </dl>
    </div>
  );
}
