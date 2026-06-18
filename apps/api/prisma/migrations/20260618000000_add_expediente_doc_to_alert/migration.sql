-- PR3 Phase 2: Add expedienteDocId to Alert
-- Additive migration: adds nullable FK from alerts_new to expediente_docs.
-- Preserves employeeFileId (legacy field) unchanged.

-- AlterTable: add nullable column (O(1), no table lock in PostgreSQL)
ALTER TABLE "alerts_new" ADD COLUMN "expedienteDocId" TEXT;

-- AddForeignKey: ON DELETE SET NULL protects alerts if ExpedienteDoc is removed
ALTER TABLE "alerts_new"
  ADD CONSTRAINT "alerts_new_expedienteDocId_fkey"
  FOREIGN KEY ("expedienteDocId")
  REFERENCES "expediente_docs"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex: covers (tenantId, expedienteDocId) dedup and lookup pattern
CREATE INDEX "alerts_new_tenantId_expedienteDocId_idx"
  ON "alerts_new"("tenantId", "expedienteDocId");
