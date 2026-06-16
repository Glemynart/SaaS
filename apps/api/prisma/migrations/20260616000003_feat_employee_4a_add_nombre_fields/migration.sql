-- FASE 4A: Agregar campos de nombre desagregado al modelo Empleado
-- Los campos nombre y apellido se mantienen temporalmente (serán eliminados en FASE 4B)
ALTER TABLE "empleados" ADD COLUMN "primerNombre" TEXT;
ALTER TABLE "empleados" ADD COLUMN "segundoNombre" TEXT;
ALTER TABLE "empleados" ADD COLUMN "primerApellido" TEXT;
ALTER TABLE "empleados" ADD COLUMN "segundoApellido" TEXT;
