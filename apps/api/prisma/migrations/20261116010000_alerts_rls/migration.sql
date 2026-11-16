-- Alerts contain employee/document references and tenant-specific workflow data.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "alerts_new" alert
    LEFT JOIN "empleados" employee
      ON employee."id" = alert."employeeId"
    LEFT JOIN "expediente_docs" document
      ON document."id" = alert."expedienteDocId"
    WHERE (alert."employeeId" IS NOT NULL AND (
        employee."id" IS NULL
        OR employee."tenantId" IS DISTINCT FROM alert."tenantId"
      ))
       OR (alert."expedienteDocId" IS NOT NULL AND (
        document."id" IS NULL
        OR document."tenantId" IS DISTINCT FROM alert."tenantId"
      ))
  ) THEN
    RAISE EXCEPTION
      'Cannot enable alert RLS: existing alert has a missing or cross-tenant relation';
  END IF;
END;
$$;

ALTER TABLE "alerts_new" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "alerts_new" FORCE ROW LEVEL SECURITY;

CREATE POLICY "alerts_new_tenant_select" ON "alerts_new"
  FOR SELECT
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    AND (
      "employeeId" IS NULL
      OR EXISTS (
        SELECT 1
        FROM "empleados" employee
        WHERE employee."id" = "alerts_new"."employeeId"
          AND employee."tenantId" = "alerts_new"."tenantId"
      )
    )
    AND (
      "expedienteDocId" IS NULL
      OR EXISTS (
        SELECT 1
        FROM "expediente_docs" document
        WHERE document."id" = "alerts_new"."expedienteDocId"
          AND document."tenantId" = "alerts_new"."tenantId"
      )
    )
  );

CREATE POLICY "alerts_new_tenant_insert" ON "alerts_new"
  FOR INSERT
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    AND (
      "employeeId" IS NULL
      OR EXISTS (
        SELECT 1
        FROM "empleados" employee
        WHERE employee."id" = "alerts_new"."employeeId"
          AND employee."tenantId" = "alerts_new"."tenantId"
      )
    )
    AND (
      "expedienteDocId" IS NULL
      OR EXISTS (
        SELECT 1
        FROM "expediente_docs" document
        WHERE document."id" = "alerts_new"."expedienteDocId"
          AND document."tenantId" = "alerts_new"."tenantId"
      )
    )
  );

CREATE POLICY "alerts_new_tenant_update" ON "alerts_new"
  FOR UPDATE
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    AND (
      "employeeId" IS NULL
      OR EXISTS (
        SELECT 1
        FROM "empleados" employee
        WHERE employee."id" = "alerts_new"."employeeId"
          AND employee."tenantId" = "alerts_new"."tenantId"
      )
    )
    AND (
      "expedienteDocId" IS NULL
      OR EXISTS (
        SELECT 1
        FROM "expediente_docs" document
        WHERE document."id" = "alerts_new"."expedienteDocId"
          AND document."tenantId" = "alerts_new"."tenantId"
      )
    )
  )
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    AND (
      "employeeId" IS NULL
      OR EXISTS (
        SELECT 1
        FROM "empleados" employee
        WHERE employee."id" = "alerts_new"."employeeId"
          AND employee."tenantId" = "alerts_new"."tenantId"
      )
    )
    AND (
      "expedienteDocId" IS NULL
      OR EXISTS (
        SELECT 1
        FROM "expediente_docs" document
        WHERE document."id" = "alerts_new"."expedienteDocId"
          AND document."tenantId" = "alerts_new"."tenantId"
      )
    )
  );

-- No DELETE policy: alert history is resolved, not physically deleted.
