import { BadRequestException } from '@nestjs/common';

export interface ContractPlanSedeSnapshot {
  id: string;
  nombre: string;
}

export interface ContractPlanEmployeeSnapshot {
  id: string;
  primerNombre: string;
  segundoNombre: string | null;
  primerApellido: string;
  segundoApellido: string | null;
  tipoDocumento: string;
  cedula: string;
  cargo: string;
  salario: string;
  tipoContrato: string;
  fechaIngreso: string;
  sedeId: string | null;
  sede: ContractPlanSedeSnapshot | null;
}

export interface ContractPlanContractSnapshot {
  cargo: string;
  salario: string;
  tipo: string;
  fechaInicio: string;
  fechaFin: string | null;
  sedeId: string | null;
  sede: ContractPlanSedeSnapshot | null;
}

export interface ContractPlanSnapshot {
  empleado: ContractPlanEmployeeSnapshot;
  contrato: ContractPlanContractSnapshot;
}

export function parseContractPlanSnapshot(
  empleadoSnapshot: unknown,
  contratoSnapshot: unknown,
): ContractPlanSnapshot {
  const employee = asRecord(empleadoSnapshot);
  const contract = asRecord(contratoSnapshot);

  const parsed = {
    empleado: employee ? parseEmployeeSnapshot(employee) : null,
    contrato: contract ? parseContractSnapshot(contract) : null,
  };

  if (!parsed.empleado || !parsed.contrato) {
    throw new BadRequestException(
      'El plan de generación no contiene snapshots laborales completos.',
    );
  }

  return parsed as ContractPlanSnapshot;
}

function parseEmployeeSnapshot(
  value: Record<string, unknown>,
): ContractPlanEmployeeSnapshot | null {
  const segundoNombre = nullableString(value.segundoNombre);
  const segundoApellido = nullableString(value.segundoApellido);
  const sedeId = nullableString(value.sedeId);
  const sede = parseSedeSnapshot(value.sede);

  if (
    !isString(value.id) ||
    !isString(value.primerNombre) ||
    (value.segundoNombre !== null && segundoNombre === null) ||
    !isString(value.primerApellido) ||
    (value.segundoApellido !== null && segundoApellido === null) ||
    !isString(value.tipoDocumento) ||
    !isString(value.cedula) ||
    !isString(value.cargo) ||
    !isString(value.salario) ||
    !isString(value.tipoContrato) ||
    !isString(value.fechaIngreso) ||
    (value.sedeId !== null && sedeId === null) ||
    (value.sede !== null && sede === null)
  ) {
    return null;
  }

  return {
    id: value.id,
    primerNombre: value.primerNombre,
    segundoNombre,
    primerApellido: value.primerApellido,
    segundoApellido,
    tipoDocumento: value.tipoDocumento,
    cedula: value.cedula,
    cargo: value.cargo,
    salario: value.salario,
    tipoContrato: value.tipoContrato,
    fechaIngreso: value.fechaIngreso,
    sedeId,
    sede,
  };
}

function parseContractSnapshot(
  value: Record<string, unknown>,
): ContractPlanContractSnapshot | null {
  const fechaFin = nullableString(value.fechaFin);
  const sedeId = nullableString(value.sedeId);
  const sede = parseSedeSnapshot(value.sede);

  if (
    !isString(value.cargo) ||
    !isString(value.salario) ||
    !isString(value.tipo) ||
    !isString(value.fechaInicio) ||
    (value.fechaFin !== null && fechaFin === null) ||
    (value.sedeId !== null && sedeId === null) ||
    (value.sede !== null && sede === null)
  ) {
    return null;
  }

  return {
    cargo: value.cargo,
    salario: value.salario,
    tipo: value.tipo,
    fechaInicio: value.fechaInicio,
    fechaFin,
    sedeId,
    sede,
  };
}

function parseSedeSnapshot(value: unknown): ContractPlanSedeSnapshot | null {
  if (value === null) return null;
  const sede = asRecord(value);
  if (!sede || !isString(sede.id) || !isString(sede.nombre)) return null;
  return { id: sede.id, nombre: sede.nombre };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function nullableString(value: unknown): string | null {
  return value === null ? null : isString(value) ? value : null;
}
