-- N2A.1: Tabla de parámetros legales de nómina colombiana por vigencia
-- Aditiva: no modifica ninguna tabla existente.
-- Reversible: un DROP TABLE parametros_legales_nomina revierte todo.

CREATE TABLE "parametros_legales_nomina" (
  "id"                       TEXT         NOT NULL,
  "createdAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                TIMESTAMP(3) NOT NULL,

  -- Alcance multi-tenant
  "tenantId"                 TEXT,

  -- Vigencia
  "vigenciaDesde"            DATE         NOT NULL,
  "vigenciaHasta"            DATE,
  "anio"                     INTEGER      NOT NULL,

  -- Salarios de referencia (COP)
  "smmlv"                    DECIMAL(14,2) NOT NULL,
  "auxilioTransporte"        DECIMAL(14,2) NOT NULL,
  "uvt"                      DECIMAL(14,2) NOT NULL,

  -- Topes IBC en múltiplos de SMMLV
  "topeIbcMinSmmlv"          INTEGER       NOT NULL DEFAULT 1,
  "topeIbcMaxSmmlv"          INTEGER       NOT NULL DEFAULT 25,
  "umbralAuxilioSmmlv"       DECIMAL(4,2)  NOT NULL DEFAULT 2,
  "umbralExoneracionSmmlv"   INTEGER       NOT NULL DEFAULT 10,

  -- Tarifas empleado (fracción, ej: 0.04)
  "pctSaludEmpleado"         DECIMAL(8,6)  NOT NULL,
  "pctPensionEmpleado"       DECIMAL(8,6)  NOT NULL,

  -- Tarifas empleador (fracción)
  "pctSaludEmpleador"        DECIMAL(8,6)  NOT NULL,
  "pctPensionEmpleador"      DECIMAL(8,6)  NOT NULL,
  "pctCaja"                  DECIMAL(8,6)  NOT NULL,
  "pctIcbf"                  DECIMAL(8,6)  NOT NULL,
  "pctSena"                  DECIMAL(8,6)  NOT NULL,

  -- ARL por clase de riesgo I–V (fracción)
  "arlClaseI"                DECIMAL(8,6)  NOT NULL,
  "arlClaseII"               DECIMAL(8,6)  NOT NULL,
  "arlClaseIII"              DECIMAL(8,6)  NOT NULL,
  "arlClaseIV"               DECIMAL(8,6)  NOT NULL,
  "arlClaseV"                DECIMAL(8,6)  NOT NULL,

  -- FSP: escala progresiva como JSON
  -- Shape: [{ desdeSmmlv: number, hastaSmmlv: number|null, pct: number }]
  "fspTramos"                JSONB         NOT NULL,

  -- Trazabilidad legal
  "fuente"                   TEXT,
  "notas"                    TEXT,

  CONSTRAINT "parametros_legales_nomina_pkey" PRIMARY KEY ("id")
);

-- FK opcional a tenants (overrides por tenant; NULL = global de plataforma)
ALTER TABLE "parametros_legales_nomina"
  ADD CONSTRAINT "parametros_legales_nomina_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Índice compuesto para resolución por fecha + tenant (path crítico del calculator)
CREATE INDEX "parametros_legales_nomina_tenantId_vigenciaDesde_vigenciaHasta_idx"
  ON "parametros_legales_nomina" ("tenantId", "vigenciaDesde", "vigenciaHasta");

-- Índice para filtrado humano / admin
CREATE INDEX "parametros_legales_nomina_tenantId_anio_idx"
  ON "parametros_legales_nomina" ("tenantId", "anio");

-- Unicidad estándar: por tenant + inicio de vigencia (cubre overrides por tenant)
CREATE UNIQUE INDEX "parametros_legales_nomina_tenantId_vigenciaDesde_key"
  ON "parametros_legales_nomina" ("tenantId", "vigenciaDesde");

-- Unicidad parcial para filas globales (tenantId IS NULL).
-- Necesario porque PostgreSQL trata NULLs como distintos en UNIQUE standard,
-- lo que permitiría dos globales con el mismo vigenciaDesde.
-- Prisma no puede expresar este índice en schema.prisma — vive solo aquí.
CREATE UNIQUE INDEX "parametros_legales_nomina_global_vigenciaDesde_key"
  ON "parametros_legales_nomina" ("vigenciaDesde")
  WHERE "tenantId" IS NULL;
