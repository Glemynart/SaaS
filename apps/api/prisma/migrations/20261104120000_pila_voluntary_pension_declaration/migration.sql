CREATE TYPE "PayrollPilaVoluntaryPensionStatus" AS ENUM (
  'UNCONFIRMED',
  'NONE_CONFIRMED',
  'PRESENT'
);

ALTER TABLE "payroll_runs"
  ADD COLUMN "pilaVoluntaryPensionStatus" "PayrollPilaVoluntaryPensionStatus" NOT NULL DEFAULT 'UNCONFIRMED',
  ADD COLUMN "pilaVoluntaryPensionUpdatedAt" TIMESTAMP(3),
  ADD COLUMN "pilaVoluntaryPensionUpdatedById" TEXT;
