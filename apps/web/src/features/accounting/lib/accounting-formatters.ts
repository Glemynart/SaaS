import type { Tercero } from '../services/accounting-api';

export function terceroNombre(tercero: Tercero) {
  if (tercero.tipoPersona === 'JURIDICA')
    return tercero.razonSocial || tercero.nombreComercial || 'Sin razón social';
  return [
    tercero.primerNombre,
    tercero.segundoNombre,
    tercero.primerApellido,
    tercero.segundoApellido,
  ]
    .filter(Boolean)
    .join(' ');
}

export function terceroRoles(tercero: Tercero) {
  return [
    tercero.esCliente && 'Cliente',
    tercero.esProveedor && 'Proveedor',
    tercero.esEmpleado && 'Empleado',
    tercero.esEntidadGubernamental && 'Entidad gubernamental',
    tercero.esBanco && 'Banco',
  ].filter(Boolean) as string[];
}
