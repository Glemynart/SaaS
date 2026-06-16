-- AlterTable: migrate tipoDocumento from plain String to TipoDocIdentidad enum
-- Safe in dev: no production data. Uses DROP+ADD (Prisma default for type changes).
ALTER TABLE "empleados" DROP COLUMN "tipoDocumento",
ADD COLUMN     "tipoDocumento" "TipoDocIdentidad" NOT NULL DEFAULT 'CC';
