-- Correctivo 6C: un contrato de lote por empleado.
CREATE UNIQUE INDEX "contratos_loteId_empleadoId_key"
  ON "contratos" ("loteId", "empleadoId");
