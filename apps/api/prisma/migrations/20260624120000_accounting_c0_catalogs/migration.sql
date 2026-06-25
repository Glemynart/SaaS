-- Motor contable ADR-001 · Fase C0 — Catálogos
-- Aditiva: crea 6 tablas y 4 enums nuevos. No modifica ninguna tabla existente.
-- Reversible: DROP de las 6 tablas + 4 tipos revierte todo.
--   cuentas_contables, terceros, periodos_contables, centros_costo,
--   cuenta_sistema_map, tipos_comprobante.
-- Sin comprobantes, sin movimientos, sin saldos, sin lógica contable.

-- CreateEnum
CREATE TYPE "NaturalezaContable" AS ENUM ('DEBITO', 'CREDITO');

-- CreateEnum
CREATE TYPE "ClaseContable" AS ENUM ('ACTIVO', 'PASIVO', 'PATRIMONIO', 'INGRESOS', 'GASTOS', 'COSTOS_VENTAS', 'COSTOS_PRODUCCION', 'CUENTAS_ORDEN_DEUDORAS', 'CUENTAS_ORDEN_ACREEDORAS');

-- CreateEnum
CREATE TYPE "EstadoPeriodo" AS ENUM ('ABIERTO', 'CERRADO');

-- CreateEnum
CREATE TYPE "TipoPersona" AS ENUM ('NATURAL', 'JURIDICA');

-- CreateTable
CREATE TABLE "cuentas_contables" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "tenantId" TEXT,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "claseContable" "ClaseContable" NOT NULL,
    "naturaleza" "NaturalezaContable" NOT NULL,
    "nivel" INTEGER NOT NULL,
    "cuentaPadreId" TEXT,
    "imputable" BOOLEAN NOT NULL DEFAULT false,
    "esCuentaSistema" BOOLEAN NOT NULL DEFAULT false,
    "requiereTercero" BOOLEAN NOT NULL DEFAULT false,
    "requiereCentroCosto" BOOLEAN NOT NULL DEFAULT false,
    "requiereBase" BOOLEAN NOT NULL DEFAULT false,
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "cuentas_contables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "terceros" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "tenantId" TEXT NOT NULL,
    "tipoDocumento" "TipoDocIdentidad" NOT NULL,
    "numeroDocumento" TEXT NOT NULL,
    "digitoVerificacion" TEXT,
    "tipoPersona" "TipoPersona" NOT NULL,
    "razonSocial" TEXT,
    "primerNombre" TEXT,
    "segundoNombre" TEXT,
    "primerApellido" TEXT,
    "segundoApellido" TEXT,
    "nombreComercial" TEXT,
    "esCliente" BOOLEAN NOT NULL DEFAULT false,
    "esProveedor" BOOLEAN NOT NULL DEFAULT false,
    "esEmpleado" BOOLEAN NOT NULL DEFAULT false,
    "esEntidadGubernamental" BOOLEAN NOT NULL DEFAULT false,
    "esBanco" BOOLEAN NOT NULL DEFAULT false,
    "responsabilidadesFiscales" JSONB NOT NULL DEFAULT '[]',
    "regimenSimple" BOOLEAN NOT NULL DEFAULT false,
    "granContribuyente" BOOLEAN NOT NULL DEFAULT false,
    "email" TEXT,
    "telefono" TEXT,
    "direccion" TEXT,
    "municipioId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "terceros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "periodos_contables" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "fechaInicio" DATE NOT NULL,
    "fechaFin" DATE NOT NULL,
    "estado" "EstadoPeriodo" NOT NULL DEFAULT 'ABIERTO',
    "cerradoAt" TIMESTAMP(3),
    "cerradoPorId" TEXT,

    CONSTRAINT "periodos_contables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "centros_costo" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "tenantId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "sedeId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "centros_costo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuenta_sistema_map" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,
    "rol" TEXT NOT NULL,
    "cuentaId" TEXT NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "cuenta_sistema_map_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipos_comprobante" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "prefijo" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tipos_comprobante_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cuentas_contables_tenantId_cuentaPadreId_idx" ON "cuentas_contables"("tenantId", "cuentaPadreId");

-- CreateIndex
CREATE INDEX "cuentas_contables_tenantId_claseContable_idx" ON "cuentas_contables"("tenantId", "claseContable");

-- CreateIndex
CREATE INDEX "cuentas_contables_tenantId_imputable_idx" ON "cuentas_contables"("tenantId", "imputable");

-- CreateIndex
CREATE INDEX "cuentas_contables_tenantId_deletedAt_idx" ON "cuentas_contables"("tenantId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "cuentas_contables_tenantId_codigo_key" ON "cuentas_contables"("tenantId", "codigo");

-- CreateIndex
CREATE INDEX "terceros_tenantId_esCliente_idx" ON "terceros"("tenantId", "esCliente");

-- CreateIndex
CREATE INDEX "terceros_tenantId_esProveedor_idx" ON "terceros"("tenantId", "esProveedor");

-- CreateIndex
CREATE INDEX "terceros_tenantId_razonSocial_idx" ON "terceros"("tenantId", "razonSocial");

-- CreateIndex
CREATE INDEX "terceros_tenantId_deletedAt_idx" ON "terceros"("tenantId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "terceros_tenantId_tipoDocumento_numeroDocumento_key" ON "terceros"("tenantId", "tipoDocumento", "numeroDocumento");

-- CreateIndex
CREATE INDEX "periodos_contables_tenantId_estado_idx" ON "periodos_contables"("tenantId", "estado");

-- CreateIndex
CREATE INDEX "periodos_contables_tenantId_anio_idx" ON "periodos_contables"("tenantId", "anio");

-- CreateIndex
CREATE UNIQUE INDEX "periodos_contables_tenantId_anio_mes_key" ON "periodos_contables"("tenantId", "anio", "mes");

-- CreateIndex
CREATE INDEX "centros_costo_tenantId_activo_idx" ON "centros_costo"("tenantId", "activo");

-- CreateIndex
CREATE INDEX "centros_costo_tenantId_sedeId_idx" ON "centros_costo"("tenantId", "sedeId");

-- CreateIndex
CREATE INDEX "centros_costo_tenantId_deletedAt_idx" ON "centros_costo"("tenantId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "centros_costo_tenantId_codigo_key" ON "centros_costo"("tenantId", "codigo");

-- CreateIndex
CREATE INDEX "cuenta_sistema_map_tenantId_cuentaId_idx" ON "cuenta_sistema_map"("tenantId", "cuentaId");

-- CreateIndex
CREATE UNIQUE INDEX "cuenta_sistema_map_tenantId_rol_key" ON "cuenta_sistema_map"("tenantId", "rol");

-- CreateIndex
CREATE UNIQUE INDEX "tipos_comprobante_codigo_key" ON "tipos_comprobante"("codigo");

-- CreateIndex
CREATE INDEX "tipos_comprobante_activo_idx" ON "tipos_comprobante"("activo");

-- AddForeignKey
ALTER TABLE "cuentas_contables" ADD CONSTRAINT "cuentas_contables_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuentas_contables" ADD CONSTRAINT "cuentas_contables_cuentaPadreId_fkey" FOREIGN KEY ("cuentaPadreId") REFERENCES "cuentas_contables"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "terceros" ADD CONSTRAINT "terceros_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "terceros" ADD CONSTRAINT "terceros_municipioId_fkey" FOREIGN KEY ("municipioId") REFERENCES "municipios_dane"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "periodos_contables" ADD CONSTRAINT "periodos_contables_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "centros_costo" ADD CONSTRAINT "centros_costo_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "centros_costo" ADD CONSTRAINT "centros_costo_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "sedes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuenta_sistema_map" ADD CONSTRAINT "cuenta_sistema_map_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuenta_sistema_map" ADD CONSTRAINT "cuenta_sistema_map_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "cuentas_contables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Unicidad parcial para la plantilla PUC global (tenantId IS NULL).
-- PostgreSQL trata los NULL como distintos en un UNIQUE estándar, por lo que
-- "cuentas_contables_tenantId_codigo_key" NO impide dos cuentas globales con el
-- mismo código. Este índice parcial garantiza un único código por plantilla.
-- Prisma no puede expresarlo en schema.prisma — vive solo en esta migración.
CREATE UNIQUE INDEX "cuentas_contables_global_codigo_key"
  ON "cuentas_contables" ("codigo")
  WHERE "tenantId" IS NULL;
