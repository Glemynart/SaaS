-- ACC-14A — intención tipada y materialización inmutable de PayrollCorrection.
-- Columnas aditivas y nullable: las correcciones históricas siguen siendo
-- consultables, pero no son aptas para ajustes hasta ser materializadas.

ALTER TABLE "payroll_corrections"
    ADD COLUMN "intentVersion" INTEGER,
    ADD COLUMN "intent" JSONB,
    ADD COLUMN "materializationVersion" INTEGER,
    ADD COLUMN "materialization" JSONB,
    ADD COLUMN "materializedAt" TIMESTAMP(3);
