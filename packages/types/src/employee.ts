export interface NombreEmpleado {
  primerNombre: string;
  segundoNombre?: string | null;
  primerApellido: string;
  segundoApellido?: string | null;
}

export function formatNombreCompleto(e: NombreEmpleado): string {
  return [e.primerNombre, e.segundoNombre, e.primerApellido, e.segundoApellido]
    .filter((v) => v?.trim())
    .join(' ');
}
