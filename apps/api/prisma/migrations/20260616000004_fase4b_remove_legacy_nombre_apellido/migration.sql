-- FASE 4B: Remove legacy nombre/apellido from empleados
-- Backfill already applied; primerNombre and primerApellido are NOT NULL at this point.

-- Step 1: Make primerNombre and primerApellido NOT NULL
ALTER TABLE "empleados" ALTER COLUMN "primerNombre" SET NOT NULL;
ALTER TABLE "empleados" ALTER COLUMN "primerApellido" SET NOT NULL;

-- Step 2: Drop legacy columns
ALTER TABLE "empleados" DROP COLUMN "nombre";
ALTER TABLE "empleados" DROP COLUMN "apellido";
