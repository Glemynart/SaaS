-- Fase 6C.1: metadatos del artefacto documental canónico.
-- Nullable para preservar los documentos existentes y porque la materialización
-- del PDF se implementará en fases posteriores.
ALTER TABLE "generated_documents"
  ADD COLUMN "pdfStorageKey" TEXT,
  ADD COLUMN "pdfSizeBytes" INTEGER;
