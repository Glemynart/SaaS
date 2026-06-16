-- CreateEnum
CREATE TYPE "EmployeeFileCategory" AS ENUM ('CONTRACT', 'CERTIFICATION', 'MEMO', 'LETTER', 'OTHER');

-- CreateTable
CREATE TABLE "employee_files" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "generatedDocumentId" TEXT,
    "nombre" TEXT NOT NULL,
    "categoria" "EmployeeFileCategory" NOT NULL,
    "archivoUrl" TEXT NOT NULL,
    "mimeType" TEXT,
    "tamanoBytes" INTEGER,
    "observaciones" TEXT,

    CONSTRAINT "employee_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employee_files_tenantId_idx" ON "employee_files"("tenantId");

-- CreateIndex
CREATE INDEX "employee_files_tenantId_employeeId_idx" ON "employee_files"("tenantId", "employeeId");

-- CreateIndex
CREATE INDEX "employee_files_tenantId_categoria_idx" ON "employee_files"("tenantId", "categoria");

-- CreateIndex
CREATE INDEX "employee_files_tenantId_createdAt_idx" ON "employee_files"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "employee_files" ADD CONSTRAINT "employee_files_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_files" ADD CONSTRAINT "employee_files_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "empleados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_files" ADD CONSTRAINT "employee_files_generatedDocumentId_fkey" FOREIGN KEY ("generatedDocumentId") REFERENCES "generated_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
