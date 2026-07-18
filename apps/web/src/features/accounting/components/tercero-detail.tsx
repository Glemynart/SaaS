import { Badge } from '@/components/ui/badge';
import { terceroNombre, terceroRoles } from '../lib/accounting-formatters';
import type { Tercero } from '../services/accounting-api';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border-soft py-3 last:border-b-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

export function TerceroDetail({
  tercero,
  municipioNombre,
}: {
  tercero: Tercero;
  municipioNombre?: string;
}) {
  const roles = terceroRoles(tercero);
  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-sm text-muted-foreground">
          {tercero.tipoDocumento} {tercero.numeroDocumento}
          {tercero.digitoVerificacion ? `-${tercero.digitoVerificacion}` : ''}
        </p>
        <h3 className="mt-1 text-lg font-semibold text-foreground">{terceroNombre(tercero)}</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant={tercero.activo ? 'success' : 'neutral'}>
            {tercero.activo ? 'Activo' : 'Inactivo'}
          </Badge>
          {roles.map((rol) => (
            <Badge key={rol} variant="neutral">
              {rol}
            </Badge>
          ))}
        </div>
      </div>
      <dl>
        <Row
          label="Tipo de persona"
          value={tercero.tipoPersona === 'NATURAL' ? 'Natural' : 'Jurídica'}
        />
        <Row label="Nombre comercial" value={tercero.nombreComercial || '—'} />
        <Row label="Correo electrónico" value={tercero.email || '—'} />
        <Row label="Teléfono" value={tercero.telefono || '—'} />
        <Row label="Dirección" value={tercero.direccion || '—'} />
        <Row label="Municipio" value={municipioNombre || tercero.municipioId || '—'} />
        <Row
          label="Responsabilidades fiscales"
          value={tercero.responsabilidadesFiscales.join(', ') || '—'}
        />
        <Row label="Régimen simple" value={tercero.regimenSimple ? 'Sí' : 'No'} />
        <Row label="Gran contribuyente" value={tercero.granContribuyente ? 'Sí' : 'No'} />
      </dl>
    </div>
  );
}
