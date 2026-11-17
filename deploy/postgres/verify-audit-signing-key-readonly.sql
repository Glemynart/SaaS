\set ON_ERROR_STOP on
\getenv expected_key_id EXPECTED_AUDIT_LOG_SIGNING_KEY_ID
\getenv expected_database EXPECTED_AUDIT_DATABASE

\if :{?expected_key_id}
\else
\echo 'Set EXPECTED_AUDIT_LOG_SIGNING_KEY_ID before running this read-only check'
\quit 2
\endif

\if :{?expected_database}
\else
\echo 'Set EXPECTED_AUDIT_DATABASE before running this read-only check'
\quit 2
\endif

BEGIN READ ONLY;

SELECT current_database() = :'expected_database' AS expected_database_matches
\gset

\if :expected_database_matches
\else
\echo 'Connected to an unexpected database; verification aborted'
\quit 3
\endif

SELECT EXISTS (
  SELECT 1
  FROM audit_private.audit_log_signing_keys
  WHERE key_id = :'expected_key_id'
    AND pg_catalog.octet_length(key_material) >= 32
) AS expected_key_is_provisioned
\gset

\if :expected_key_is_provisioned
\else
\echo 'Expected AuditLog key ID is missing or invalid; key material was not read out'
\quit 3
\endif

SELECT key_id,
       pg_catalog.octet_length(key_material) AS key_length_bytes,
       created_at
FROM audit_private.audit_log_signing_keys
WHERE key_id = :'expected_key_id';

ROLLBACK;
