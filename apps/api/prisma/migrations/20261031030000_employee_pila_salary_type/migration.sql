CREATE TYPE "TipoSalarioPila" AS ENUM ('X', 'F', 'V');

ALTER TABLE "empleados"
ADD COLUMN "tipoSalarioPila" "TipoSalarioPila";
