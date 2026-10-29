-- Enforce one new contract per employee and contract-start year while keeping
-- all historical records. If legacy data already contains several contracts
-- for the same employee/year, one canonical row reserves that year and older
-- duplicates remain with a NULL year rather than being deleted or rewritten.
ALTER TABLE "contratos" ADD COLUMN "anioContrato" INTEGER;

WITH ranked_contracts AS (
  SELECT
    "id",
    EXTRACT(YEAR FROM "fechaInicio")::INTEGER AS contract_year,
    ROW_NUMBER() OVER (
      PARTITION BY "tenantId", "empleadoId", EXTRACT(YEAR FROM "fechaInicio")
      ORDER BY "createdAt" ASC, "id" ASC
    ) AS row_number
  FROM "contratos"
)
UPDATE "contratos" AS contract
SET "anioContrato" = ranked_contracts.contract_year
FROM ranked_contracts
WHERE contract."id" = ranked_contracts."id"
  AND ranked_contracts.row_number = 1;

CREATE UNIQUE INDEX "contratos_tenantId_empleadoId_anioContrato_key"
  ON "contratos"("tenantId", "empleadoId", "anioContrato");
