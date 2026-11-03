CREATE TYPE "PayrollPilaFspSourceScope" AS ENUM (
  'UNCONFIRMED',
  'SINGLE_SOURCE_CONFIRMED',
  'MULTIPLE_SOURCES'
);

ALTER TABLE "payroll_runs"
  ADD COLUMN "pilaFspSourceScope" "PayrollPilaFspSourceScope" NOT NULL DEFAULT 'UNCONFIRMED',
  ADD COLUMN "pilaFspSourceScopeUpdatedAt" TIMESTAMP(3),
  ADD COLUMN "pilaFspSourceScopeUpdatedById" TEXT;
