-- PR6B: Drop EmployeeFile permanently
-- All data migrated to ExpedienteDoc in PR5. Zero rows remain in employee_files.
-- alerts_new.employeeFileId has 0 non-null values confirmed before this migration.

-- Step 1: Drop FK from alerts_new to employee_files
ALTER TABLE "alerts_new" DROP CONSTRAINT IF EXISTS "alerts_new_employeeFileId_fkey";

-- Step 2: Drop the employeeFileId column from alerts_new
ALTER TABLE "alerts_new" DROP COLUMN IF EXISTS "employeeFileId";

-- Step 3: Drop indexes on employee_files
DROP INDEX IF EXISTS "employee_files_tenantId_idx";
DROP INDEX IF EXISTS "employee_files_tenantId_employeeId_idx";
DROP INDEX IF EXISTS "employee_files_tenantId_categoria_idx";
DROP INDEX IF EXISTS "employee_files_tenantId_createdAt_idx";

-- Step 4: Drop FKs on employee_files
ALTER TABLE "employee_files" DROP CONSTRAINT IF EXISTS "employee_files_tenantId_fkey";
ALTER TABLE "employee_files" DROP CONSTRAINT IF EXISTS "employee_files_employeeId_fkey";
ALTER TABLE "employee_files" DROP CONSTRAINT IF EXISTS "employee_files_generatedDocumentId_fkey";

-- Step 5: Drop table
DROP TABLE IF EXISTS "employee_files";

-- Step 6: Drop enum
DROP TYPE IF EXISTS "EmployeeFileCategory";
