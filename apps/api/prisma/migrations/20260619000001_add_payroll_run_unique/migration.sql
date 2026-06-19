-- N1A.2: Constraint único en PayrollRun para eliminar condiciones de carrera
-- Garantiza que un empleado tenga como máximo un run por período y tenant.
-- El check previo en generatePayroll permanece como optimización,
-- pero este constraint es la garantía final de integridad a nivel de BD.

ALTER TABLE "payroll_runs"
  ADD CONSTRAINT "payroll_runs_tenantId_payrollPeriodId_employeeId_key"
  UNIQUE ("tenantId", "payrollPeriodId", "employeeId");
