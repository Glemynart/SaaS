ALTER TABLE "payroll_snapshots"
ADD COLUMN "pilaPayloadVersion" INTEGER,
ADD COLUMN "pilaPayload" JSONB;

ALTER TABLE "payroll_runs"
ADD COLUMN "pilaSource" JSONB;
