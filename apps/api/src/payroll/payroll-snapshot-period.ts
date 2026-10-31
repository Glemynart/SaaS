export type PayrollPeriodSnapshotInput = {
  payrollPeriodId: string;
  nombre: string;
  fechaInicio: string | null;
  fechaFin: string | null;
  fechaPrevistaPagoPila: Date | null;
  status: string;
};

export function buildPayrollPeriodSnapshot(input: PayrollPeriodSnapshotInput) {
  return {
    payrollPeriodId: input.payrollPeriodId,
    nombre: input.nombre,
    fechaInicio: input.fechaInicio,
    fechaFin: input.fechaFin,
    fechaPrevistaPagoPila: input.fechaPrevistaPagoPila?.toISOString() ?? null,
    status: input.status,
  };
}
