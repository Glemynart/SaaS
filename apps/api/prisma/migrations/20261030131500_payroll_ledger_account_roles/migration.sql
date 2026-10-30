-- Corrige la clasificación contable de los pasivos de nómina y añade cuentas
-- faltantes a los charts globales y de tenants ya provisionados.
--
-- El cambio añade cuentas y mapeos de nómina que faltan, separa pensiones de
-- parafiscales y corrige los nombres predeterminados según el PUC usado por
-- la plantilla. Las personalizaciones de tenant se conservan.
--
-- Reversión: no eliminar cuentas o mapeos después de que existan movimientos.
-- La reversión requiere anular con comprobante cualquier asiento ya contabilizado.

UPDATE "cuentas_contables"
SET "nombre" = 'Aportes ICBF, SENA y cajas por pagar', "updatedAt" = CURRENT_TIMESTAMP
WHERE "codigo" = '237010'
  AND "esCuentaSistema" = TRUE
  AND "nombre" = 'Aportes fondos de pensiones por pagar';

UPDATE "cuentas_contables"
SET "nombre" = 'Aportes a EPS', "updatedAt" = CURRENT_TIMESTAMP
WHERE "codigo" = '510569'
  AND "esCuentaSistema" = TRUE
  AND "nombre" = 'Aportes sociales y parafiscales';

UPDATE "cuentas_contables"
SET "nombre" = 'Cesantías por pagar', "updatedAt" = CURRENT_TIMESTAMP
WHERE "codigo" = '261005'
  AND "esCuentaSistema" = TRUE
  AND "nombre" = 'Provisión prestaciones sociales';

UPDATE "cuenta_sistema_map" mapping
SET "descripcion" = 'Mapeo legado sustituido por roles de gasto por aporte',
    "updatedAt" = CURRENT_TIMESTAMP
FROM "cuentas_contables" account
WHERE mapping."rol" = 'GASTO_APORTES_SOCIALES'
  AND mapping."descripcion" = 'Gasto de aportes sociales y parafiscales'
  AND account."id" = mapping."cuentaId"
  AND account."tenantId" = mapping."tenantId"
  AND account."codigo" = '510569';

UPDATE "cuenta_sistema_map" mapping
SET "descripcion" = 'Mapeo legado sustituido por provisiones laborales por tipo',
    "updatedAt" = CURRENT_TIMESTAMP
FROM "cuentas_contables" account
WHERE mapping."rol" = 'PROVISION_PRESTACIONES'
  AND mapping."descripcion" = 'Provisión de prestaciones sociales'
  AND account."id" = mapping."cuentaId"
  AND account."tenantId" = mapping."tenantId"
  AND account."codigo" = '261005';

-- ARL: 237006 bajo 2370, tanto en la plantilla global como en charts existentes.
INSERT INTO "cuentas_contables" (
  "id", "createdAt", "updatedAt", "tenantId", "codigo", "nombre",
  "claseContable", "naturaleza", "nivel", "cuentaPadreId", "imputable",
  "esCuentaSistema", "requiereTercero", "requiereCentroCosto",
  "requiereBase", "activa"
)
SELECT
  gen_random_uuid()::text, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, parent."tenantId",
  '237006', 'Aportes ARL por pagar', parent."claseContable", parent."naturaleza",
  4, parent."id", TRUE, TRUE, FALSE, FALSE, FALSE, TRUE
FROM "cuentas_contables" parent
WHERE parent."codigo" = '2370'
  AND NOT EXISTS (
    SELECT 1 FROM "cuentas_contables" current
    WHERE current."tenantId" IS NOT DISTINCT FROM parent."tenantId"
      AND current."codigo" = '237006'
  );

-- Pensiones: 238030 bajo el grupo 2380 (Fondos de cesantías y/o pensiones).
INSERT INTO "cuentas_contables" (
  "id", "createdAt", "updatedAt", "tenantId", "codigo", "nombre",
  "claseContable", "naturaleza", "nivel", "cuentaPadreId", "imputable",
  "esCuentaSistema", "requiereTercero", "requiereCentroCosto",
  "requiereBase", "activa"
)
SELECT
  gen_random_uuid()::text, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, parent."tenantId",
  '2380', 'Acreedores varios', parent."claseContable", parent."naturaleza",
  3, parent."id", FALSE, FALSE, FALSE, FALSE, FALSE, TRUE
FROM "cuentas_contables" parent
WHERE parent."codigo" = '23'
  AND NOT EXISTS (
    SELECT 1 FROM "cuentas_contables" current
    WHERE current."tenantId" IS NOT DISTINCT FROM parent."tenantId"
      AND current."codigo" = '2380'
  );

INSERT INTO "cuentas_contables" (
  "id", "createdAt", "updatedAt", "tenantId", "codigo", "nombre",
  "claseContable", "naturaleza", "nivel", "cuentaPadreId", "imputable",
  "esCuentaSistema", "requiereTercero", "requiereCentroCosto",
  "requiereBase", "activa"
)
SELECT
  gen_random_uuid()::text, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, parent."tenantId",
  '238030', 'Fondos de cesantías y/o pensiones por pagar', parent."claseContable",
  parent."naturaleza", 4, parent."id", TRUE, TRUE, FALSE, FALSE, FALSE, TRUE
FROM "cuentas_contables" parent
WHERE parent."codigo" = '2380'
  AND NOT EXISTS (
    SELECT 1 FROM "cuentas_contables" current
    WHERE current."tenantId" IS NOT DISTINCT FROM parent."tenantId"
      AND current."codigo" = '238030'
  );

-- Cuentas de provisiones laborales por pagar faltantes.
INSERT INTO "cuentas_contables" (
  "id", "createdAt", "updatedAt", "tenantId", "codigo", "nombre",
  "claseContable", "naturaleza", "nivel", "cuentaPadreId", "imputable",
  "esCuentaSistema", "requiereTercero", "requiereCentroCosto",
  "requiereBase", "activa"
)
SELECT
  gen_random_uuid()::text, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, parent."tenantId",
  added."codigo", added."nombre", parent."claseContable", parent."naturaleza",
  added."nivel", parent."id", TRUE, TRUE, FALSE, FALSE, FALSE, TRUE
FROM (VALUES
  ('261010', 'Intereses sobre cesantías por pagar', '2610', 4),
  ('261015', 'Vacaciones por pagar', '2610', 4),
  ('261020', 'Prima de servicios por pagar', '2610', 4)
) AS added("codigo", "nombre", "parentCodigo", "nivel")
JOIN "cuentas_contables" parent ON parent."codigo" = added."parentCodigo"
WHERE parent."deletedAt" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "cuentas_contables" current
    WHERE current."tenantId" IS NOT DISTINCT FROM parent."tenantId"
      AND current."codigo" = added."codigo"
  );

-- Cuentas de gasto para aportes patronales y provisiones. Los códigos siguen
-- la plantilla del PUC: salud, pensión, ARL, caja, ICBF, SENA y cada provisión.
INSERT INTO "cuentas_contables" (
  "id", "createdAt", "updatedAt", "tenantId", "codigo", "nombre",
  "claseContable", "naturaleza", "nivel", "cuentaPadreId", "imputable",
  "esCuentaSistema", "requiereTercero", "requiereCentroCosto",
  "requiereBase", "activa"
)
SELECT
  gen_random_uuid()::text, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, parent."tenantId",
  added."codigo", added."nombre", parent."claseContable", parent."naturaleza",
  added."nivel", parent."id", TRUE, TRUE, FALSE, FALSE, FALSE, TRUE
FROM (VALUES
  ('510530', 'Cesantías', '5105', 4),
  ('510533', 'Intereses sobre cesantías', '5105', 4),
  ('510536', 'Prima de servicios', '5105', 4),
  ('510539', 'Vacaciones', '5105', 4),
  ('510568', 'Aportes a administradoras de riesgos laborales ARL', '5105', 4),
  ('510570', 'Aportes a fondos de pensiones y/o cesantías', '5105', 4),
  ('510572', 'Aportes a cajas de compensación familiar', '5105', 4),
  ('510575', 'Aportes al ICBF', '5105', 4),
  ('510578', 'Aportes al SENA', '5105', 4)
) AS added("codigo", "nombre", "parentCodigo", "nivel")
JOIN "cuentas_contables" parent ON parent."codigo" = added."parentCodigo"
WHERE parent."deletedAt" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "cuentas_contables" current
    WHERE current."tenantId" IS NOT DISTINCT FROM parent."tenantId"
      AND current."codigo" = added."codigo"
  );

-- Mueve solo la asignación por defecto de pensiones; no toca mapas personalizados.
UPDATE "cuenta_sistema_map" mapping
SET "cuentaId" = replacement."id",
    "descripcion" = 'Aportes fondos de pensiones por pagar',
    "updatedAt" = CURRENT_TIMESTAMP
FROM "cuentas_contables" previous, "cuentas_contables" replacement
WHERE mapping."rol" = 'APORTES_PENSION_POR_PAGAR'
  AND mapping."descripcion" = 'Aportes fondos de pensiones por pagar'
  AND previous."id" = mapping."cuentaId"
  AND previous."tenantId" = mapping."tenantId"
  AND previous."codigo" = '237010'
  AND replacement."tenantId" = mapping."tenantId"
  AND replacement."codigo" = '238030';

-- Crea solo los roles nuevos que no existan; conserva cualquier asignación
-- personalizada que el tenant hubiera configurado previamente.
INSERT INTO "cuenta_sistema_map" (
  "id", "createdAt", "updatedAt", "tenantId", "rol", "cuentaId", "descripcion", "activo"
)
SELECT gen_random_uuid()::text, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
       account."tenantId", requested."rol", account."id", requested."descripcion", TRUE
FROM (VALUES
  ('APORTES_RIESGOS_LABORALES_POR_PAGAR', '237006', 'Aportes ARL por pagar'),
  ('APORTES_PARAFISCALES_POR_PAGAR', '237010', 'Aportes ICBF, SENA y cajas por pagar'),
  ('PROVISION_CESANTIAS_POR_PAGAR', '261005', 'Cesantías por pagar'),
  ('PROVISION_INTERESES_CESANTIAS_POR_PAGAR', '261010', 'Intereses sobre cesantías por pagar'),
  ('PROVISION_VACACIONES_POR_PAGAR', '261015', 'Vacaciones por pagar'),
  ('PROVISION_PRIMA_POR_PAGAR', '261020', 'Prima de servicios por pagar'),
  ('GASTO_APORTES_SALUD', '510569', 'Aportes a EPS'),
  ('GASTO_APORTES_PENSION', '510570', 'Aportes a fondos de pensiones y/o cesantías'),
  ('GASTO_APORTES_RIESGOS_LABORALES', '510568', 'Aportes a administradoras de riesgos laborales ARL'),
  ('GASTO_APORTES_CAJA', '510572', 'Aportes a cajas de compensación familiar'),
  ('GASTO_APORTES_ICBF', '510575', 'Aportes al ICBF'),
  ('GASTO_APORTES_SENA', '510578', 'Aportes al SENA'),
  ('GASTO_PROVISION_CESANTIAS', '510530', 'Gasto de cesantías'),
  ('GASTO_PROVISION_INTERESES_CESANTIAS', '510533', 'Gasto de intereses sobre cesantías'),
  ('GASTO_PROVISION_PRIMA', '510536', 'Gasto de prima de servicios'),
  ('GASTO_PROVISION_VACACIONES', '510539', 'Gasto de vacaciones')
) AS requested("rol", "codigo", "descripcion")
JOIN "cuentas_contables" account
  ON account."codigo" = requested."codigo"
 AND account."tenantId" IS NOT NULL
 AND account."deletedAt" IS NULL
WHERE NOT EXISTS (
  SELECT 1 FROM "cuenta_sistema_map" current
  WHERE current."tenantId" = account."tenantId"
    AND current."rol" = requested."rol"
);

-- El asiento se agrega por período y centro de costo (si existe), sin tercero.
-- Los centros de costo son opcionales en nómina y se conservan cuando vienen.
UPDATE "cuentas_contables" account
SET "requiereTercero" = FALSE, "updatedAt" = CURRENT_TIMESTAMP
FROM "cuenta_sistema_map" mapping
WHERE mapping."tenantId" = account."tenantId"
  AND mapping."cuentaId" = account."id"
  AND mapping."rol" = 'SALARIOS_POR_PAGAR'
  AND account."codigo" = '250505'
  AND account."esCuentaSistema" = TRUE;

UPDATE "cuentas_contables" account
SET "requiereCentroCosto" = FALSE, "updatedAt" = CURRENT_TIMESTAMP
FROM "cuenta_sistema_map" mapping
WHERE mapping."tenantId" = account."tenantId"
  AND mapping."cuentaId" = account."id"
  AND mapping."rol" IN (
    'GASTO_SUELDOS', 'GASTO_APORTES_SOCIALES',
    'GASTO_APORTES_SALUD', 'GASTO_APORTES_PENSION',
    'GASTO_APORTES_RIESGOS_LABORALES', 'GASTO_APORTES_CAJA',
    'GASTO_APORTES_ICBF', 'GASTO_APORTES_SENA',
    'GASTO_PROVISION_CESANTIAS', 'GASTO_PROVISION_INTERESES_CESANTIAS',
    'GASTO_PROVISION_PRIMA', 'GASTO_PROVISION_VACACIONES'
  )
  AND account."esCuentaSistema" = TRUE;
