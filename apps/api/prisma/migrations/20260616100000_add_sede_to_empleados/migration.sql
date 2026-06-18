-- Phase 5C: Formalize sedeId relation on empleados
-- Column, FK and index already existed in DB from Colombia Expansion drift.
-- Applied via migrate resolve (objects pre-existed; re-running would fail on duplicate).

-- AddColumn
ALTER TABLE "empleados" ADD COLUMN "sedeId" TEXT;

-- AddForeignKey
ALTER TABLE "empleados"
  ADD CONSTRAINT "empleados_sedeId_fkey"
  FOREIGN KEY ("sedeId") REFERENCES "sedes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "empleados_tenantId_sedeId_idx" ON "empleados"("tenantId", "sedeId");
