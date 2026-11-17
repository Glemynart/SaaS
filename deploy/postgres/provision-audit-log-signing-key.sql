\set ON_ERROR_STOP on

-- Provision one key row for a newly migrated database. Run as a database
-- administrator after exporting AUDIT_LOG_SIGNING_KEY and key ID. The key is
-- read from the psql process environment and is never selected to output.
\getenv signing_key AUDIT_LOG_SIGNING_KEY
\getenv signing_key_id AUDIT_LOG_SIGNING_KEY_ID

\if :{?signing_key}
\else
\echo 'AUDIT_LOG_SIGNING_KEY is required'
\quit 1
\endif

\if :{?signing_key_id}
\else
\set signing_key_id v1
\endif

SELECT :'signing_key_id' ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$' AS key_id_valid
\gset

\if :key_id_valid
\else
\echo 'AUDIT_LOG_SIGNING_KEY_ID must use 1-64 safe ASCII characters'
\quit 1
\endif

SELECT
  pg_catalog.octet_length(pg_catalog.decode(:'signing_key', 'base64')) >= 32
  AND pg_catalog.encode(
    pg_catalog.decode(:'signing_key', 'base64'), 'base64'
  ) = :'signing_key' AS key_input_valid
\gset

\if :key_input_valid
\else
\echo 'AUDIT_LOG_SIGNING_KEY must be canonical Base64 encoding at least 32 bytes'
\quit 1
\endif

BEGIN;
SET ROLE saas_audit_log_function_owner;
INSERT INTO audit_private.audit_log_signing_keys (key_id, key_material)
VALUES (
  :'signing_key_id',
  pg_catalog.decode(:'signing_key', 'base64')
)
ON CONFLICT (key_id) DO NOTHING;

SELECT key_material = pg_catalog.decode(:'signing_key', 'base64') AS key_matches
FROM audit_private.audit_log_signing_keys
WHERE key_id = :'signing_key_id'
\gset

RESET ROLE;
COMMIT;

\if :key_matches
\else
\echo 'The configured key ID already belongs to a different signing key; use a new key ID for rotation'
\quit 1
\endif

\echo 'AuditLog signing key provisioned; key material was not printed.'
