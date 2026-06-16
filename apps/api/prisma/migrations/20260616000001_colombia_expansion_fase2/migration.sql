-- AlterTable
ALTER TABLE "empleados" ADD COLUMN     "fechaRetiro" TIMESTAMP(3),
ADD COLUMN     "jornadaLaboral" "JornadaLaboral",
ADD COLUMN     "motivoRetiro" "MotivoRetiro",
ADD COLUMN     "municipioExpedicionDocId" TEXT,
ADD COLUMN     "salarioIntegral" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "empleados" ADD CONSTRAINT "empleados_municipioExpedicionDocId_fkey" FOREIGN KEY ("municipioExpedicionDocId") REFERENCES "municipios_dane"("id") ON DELETE SET NULL ON UPDATE CASCADE;
