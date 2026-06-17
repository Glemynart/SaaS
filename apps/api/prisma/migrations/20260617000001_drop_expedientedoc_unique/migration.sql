-- PR1: ExpedienteDoc schema reconciliation
-- Drop @@unique([empleadoId, categoria, version]) to allow multiple documents
-- per employee per category (e.g. multiple CONTRATOs for same employee).
-- This constraint was created manually alongside the colombia_expansion_fase1
-- SQL but is incompatible with the approved consolidation architecture.
DROP INDEX IF EXISTS "expediente_docs_empleadoId_categoria_version_key";
