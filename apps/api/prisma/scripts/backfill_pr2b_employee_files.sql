-- =============================================================================
-- PR2B: Backfill EmployeeFile -> ExpedienteDoc
-- =============================================================================
-- Source:  employee_files
-- Target:  expediente_docs
--
-- Idempotency marker: subidoPorNombre = '[migracion legado]'
-- Safe to re-run: WHERE NOT EXISTS guard prevents duplicate inserts.
-- Rollback:  DELETE FROM expediente_docs WHERE subidoPorNombre = '[migracion legado]';
-- =============================================================================

BEGIN;

-- ------------------------------------------------------------
-- STEP 0: Pre-check snapshot (informational, no writes)
-- ------------------------------------------------------------
\echo '--- STEP 0: Pre-check snapshot ---'

SELECT
  'employee_files'       AS tabla,
  COUNT(*)               AS total
FROM employee_files
UNION ALL
SELECT
  'expediente_docs',
  COUNT(*)
FROM expediente_docs;

-- ------------------------------------------------------------
-- STEP 1: Insert with idempotency guard
-- ------------------------------------------------------------
\echo '--- STEP 1: Insert backfill rows ---'

INSERT INTO expediente_docs (
  id,
  "createdAt",
  "updatedAt",
  "tenantId",
  "empleadoId",
  "contratoId",
  "generatedDocumentId",
  categoria,
  nombre,
  descripcion,
  version,
  "fechaDocumento",
  "fechaVencimiento",
  "requiereRenovacion",
  "storageKey",
  "mimeType",
  "tamanoBytes",
  "subidoPorId",
  "subidoPorNombre"
)
SELECT
  -- New UUID for each destination row
  gen_random_uuid(),

  -- Preserve original creation timestamp
  ef."createdAt",
  ef."createdAt"                                             AS "updatedAt",

  ef."tenantId",
  ef."employeeId"                                            AS "empleadoId",

  -- No contract link derivable from employee_files
  NULL::TEXT                                                 AS "contratoId",

  ef."generatedDocumentId",

  -- Category mapping (cast to text first for safe string comparison against enum)
  CASE ef.categoria::text
    WHEN 'CONTRACT'      THEN 'CONTRATO'::"ExpedienteCategoria"
    WHEN 'CERTIFICATION' THEN 'CERTIFICADO'::"ExpedienteCategoria"
    WHEN 'MEMO'          THEN 'OTRO'::"ExpedienteCategoria"
    WHEN 'LETTER'        THEN 'OTRO'::"ExpedienteCategoria"
    ELSE                      'OTRO'::"ExpedienteCategoria"
  END                                                        AS categoria,

  ef.nombre,
  ef.observaciones                                           AS descripcion,

  -- First (and only) version for all legacy records
  1                                                          AS version,

  -- Use createdAt as proxy for fechaDocumento (best available signal)
  ef."createdAt"                                             AS "fechaDocumento",

  -- No expiry date derivable from source
  NULL::TIMESTAMP WITHOUT TIME ZONE                         AS "fechaVencimiento",

  -- Per spec: false for all backfilled records
  FALSE                                                      AS "requiereRenovacion",

  -- storageKey derivation from archivoUrl
  CASE
    WHEN ef."archivoUrl" LIKE 'https://%' OR ef."archivoUrl" LIKE 'http://%'
      THEN regexp_replace(ef."archivoUrl", '^https?://[^/]+/', '')
    WHEN ef."archivoUrl" LIKE '/%'
      THEN substring(ef."archivoUrl" FROM 2)
    ELSE
      'legado/' || ef."tenantId" || '/' || ef."employeeId" || '/' || ef.id || '.bin'
  END                                                        AS "storageKey",

  -- mimeType: fallback only if NULL (this record has application/pdf)
  COALESCE(ef."mimeType", 'application/octet-stream')       AS "mimeType",

  -- tamanoBytes: fallback 0 for NULL (signals unknown legacy size)
  COALESCE(ef."tamanoBytes", 0)                              AS "tamanoBytes",

  -- No user attribution available for legacy records
  NULL::TEXT                                                 AS "subidoPorId",

  -- Migration tombstone: enables idempotency and rollback
  '[migracion legado]'                                       AS "subidoPorNombre"

FROM employee_files ef

-- Idempotency guard: skip rows already migrated
WHERE NOT EXISTS (
  SELECT 1
  FROM expediente_docs ed
  WHERE ed."tenantId"        = ef."tenantId"
    AND ed."empleadoId"      = ef."employeeId"
    AND ed.nombre            = ef.nombre
    AND ed."createdAt"       = ef."createdAt"
    AND ed."subidoPorNombre" = '[migracion legado]'
);

-- ------------------------------------------------------------
-- STEP 2: Post-insert validation
-- ------------------------------------------------------------
\echo '--- STEP 2: Row parity check ---'

SELECT
  'employee_files (source)'          AS tabla,
  COUNT(*)                           AS filas
FROM employee_files
UNION ALL
SELECT
  'expediente_docs migrados',
  COUNT(*)
FROM expediente_docs
WHERE "subidoPorNombre" = '[migracion legado]';

\echo '--- STEP 2b: Parity by tenant (difference must be 0) ---'

SELECT
  ef."tenantId",
  COUNT(DISTINCT ef.id)              AS en_fuente,
  COUNT(DISTINCT ed.id)              AS en_destino,
  COUNT(DISTINCT ef.id)
    - COUNT(DISTINCT ed.id)          AS diferencia
FROM employee_files ef
LEFT JOIN expediente_docs ed
  ON  ed."empleadoId"      = ef."employeeId"
  AND ed."tenantId"        = ef."tenantId"
  AND ed.nombre            = ef.nombre
  AND ed."createdAt"       = ef."createdAt"
  AND ed."subidoPorNombre" = '[migracion legado]'
GROUP BY ef."tenantId";

\echo '--- STEP 2c: Referential integrity check ---'

SELECT COUNT(*) AS fk_empleado_roto
FROM expediente_docs ed
WHERE ed."subidoPorNombre" = '[migracion legado]'
  AND NOT EXISTS (
    SELECT 1 FROM empleados e WHERE e.id = ed."empleadoId"
  );

SELECT COUNT(*) AS fk_generatedDoc_roto
FROM expediente_docs ed
WHERE ed."subidoPorNombre" = '[migracion legado]'
  AND ed."generatedDocumentId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM generated_documents gd WHERE gd.id = ed."generatedDocumentId"
  );

\echo '--- STEP 2d: Full detail of migrated rows ---'

SELECT
  ed.id,
  ed."tenantId",
  ed."empleadoId",
  ed."generatedDocumentId",
  ed.categoria,
  ed.nombre,
  ed.version,
  ed."storageKey",
  ed."mimeType",
  ed."tamanoBytes",
  ed."fechaDocumento",
  ed."fechaVencimiento",
  ed."requiereRenovacion",
  ed."subidoPorNombre",
  ed."createdAt"
FROM expediente_docs ed
WHERE ed."subidoPorNombre" = '[migracion legado]'
ORDER BY ed."createdAt";

COMMIT;

\echo '=== PR2B backfill complete ==='
