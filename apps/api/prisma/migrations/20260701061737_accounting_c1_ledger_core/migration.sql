-- Motor contable ADR-001 · Fase C1.1 — Ledger Core
-- Aditiva: crea 1 enum y 3 tablas (comprobantes_contables, movimientos_contables,
-- secuencias_comprobante). No modifica ninguna tabla existente.
-- Reversible: DROP de las 3 tablas + el tipo EstadoComprobante revierte todo.
-- Append-only: los comprobantes/movimientos no se editan ni borran tras
-- CONTABILIZADO (I2); reversaAId y los FK usan NO ACTION para impedir borrados
-- accidentales del encabezado y sus líneas. Solo COP: sin moneda ni tasaCambio.
-- Al final, en bloque separado, se añaden manualmente los objetos que Prisma no
-- expresa: CHECK de origen (I8), CHECK débito/crédito (I4) y los índices únicos
-- PARCIALES de consecutivo (I7) e idempotencia (I8).

-- CreateEnum
CREATE TYPE "EstadoComprobante" AS ENUM ('BORRADOR', 'CONTABILIZADO', 'ANULADO');

-- CreateTable
CREATE TABLE "comprobantes_contables" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tipoComprobanteId" TEXT NOT NULL,
    "periodoId" TEXT NOT NULL,
    "numero" INTEGER,
    "fecha" DATE NOT NULL,
    "concepto" TEXT NOT NULL,
    "estado" "EstadoComprobante" NOT NULL DEFAULT 'BORRADOR',
    "totalDebito" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalCredito" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "origenTipo" TEXT,
    "origenId" TEXT,
    "origenEvento" TEXT,
    "reversaAId" TEXT,
    "usuarioId" TEXT NOT NULL,
    "contabilizadoAt" TIMESTAMP(3),

    CONSTRAINT "comprobantes_contables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_contables" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,
    "comprobanteId" TEXT NOT NULL,
    "linea" INTEGER NOT NULL,
    "cuentaId" TEXT NOT NULL,
    "terceroId" TEXT,
    "centroCostoId" TEXT,
    "debito" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "credito" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "baseGravable" DECIMAL(14,2),
    "descripcion" TEXT,

    CONSTRAINT "movimientos_contables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "secuencias_comprobante" (
    "tenantId" TEXT NOT NULL,
    "tipoComprobanteId" TEXT NOT NULL,
    "ultimoNumero" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "secuencias_comprobante_pkey" PRIMARY KEY ("tenantId","tipoComprobanteId")
);

-- CreateIndex
CREATE UNIQUE INDEX "movimientos_contables_comprobanteId_linea_key" ON "movimientos_contables"("comprobanteId", "linea");

-- AddForeignKey
ALTER TABLE "comprobantes_contables" ADD CONSTRAINT "comprobantes_contables_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comprobantes_contables" ADD CONSTRAINT "comprobantes_contables_tipoComprobanteId_fkey" FOREIGN KEY ("tipoComprobanteId") REFERENCES "tipos_comprobante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comprobantes_contables" ADD CONSTRAINT "comprobantes_contables_periodoId_fkey" FOREIGN KEY ("periodoId") REFERENCES "periodos_contables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comprobantes_contables" ADD CONSTRAINT "comprobantes_contables_reversaAId_fkey" FOREIGN KEY ("reversaAId") REFERENCES "comprobantes_contables"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "movimientos_contables" ADD CONSTRAINT "movimientos_contables_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_contables" ADD CONSTRAINT "movimientos_contables_comprobanteId_fkey" FOREIGN KEY ("comprobanteId") REFERENCES "comprobantes_contables"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "movimientos_contables" ADD CONSTRAINT "movimientos_contables_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "cuentas_contables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_contables" ADD CONSTRAINT "movimientos_contables_terceroId_fkey" FOREIGN KEY ("terceroId") REFERENCES "terceros"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_contables" ADD CONSTRAINT "movimientos_contables_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "centros_costo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "secuencias_comprobante" ADD CONSTRAINT "secuencias_comprobante_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "secuencias_comprobante" ADD CONSTRAINT "secuencias_comprobante_tipoComprobanteId_fkey" FOREIGN KEY ("tipoComprobanteId") REFERENCES "tipos_comprobante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- AJUSTES MANUALES (ADR-001) — Prisma no expresa CHECK ni índices parciales.
-- ============================================================================

-- I8 · Coherencia de la clave de origen: los tres campos son todos NULL
-- (comprobante manual) o todos NOT NULL (posteo automático desde un módulo).
-- Impide estados intermedios que romperían la idempotencia.
ALTER TABLE "comprobantes_contables"
  ADD CONSTRAINT "comprobantes_contables_origen_all_or_none_check"
  CHECK (
    ("origenTipo" IS NULL AND "origenId" IS NULL AND "origenEvento" IS NULL)
    OR
    ("origenTipo" IS NOT NULL AND "origenId" IS NOT NULL AND "origenEvento" IS NOT NULL)
  );

-- I4 · Cada línea es débito o crédito, nunca ambos ni ninguno: montos no
-- negativos y exactamente uno mayor que cero (XOR booleano).
ALTER TABLE "movimientos_contables"
  ADD CONSTRAINT "movimientos_contables_debito_credito_check"
  CHECK (
    "debito" >= 0 AND "credito" >= 0
    AND ("debito" > 0) <> ("credito" > 0)
  );

-- I7 · Consecutivo sin huecos por (tenant, tipo): numero es único cuando está
-- asignado. Parcial WHERE numero IS NOT NULL para que los BORRADOR (numero NULL,
-- aún sin numerar) no compitan por el consecutivo.
CREATE UNIQUE INDEX "comprobantes_contables_tenantId_tipo_numero_key"
  ON "comprobantes_contables" ("tenantId", "tipoComprobanteId", "numero")
  WHERE "numero" IS NOT NULL;

-- I8 · Idempotencia de origen: un evento contable de un documento fuente genera
-- a lo sumo un comprobante. Parcial WHERE origenTipo IS NOT NULL para no
-- restringir los comprobantes manuales (clave de origen toda NULL).
CREATE UNIQUE INDEX "comprobantes_contables_origen_key"
  ON "comprobantes_contables" ("tenantId", "origenTipo", "origenId", "origenEvento")
  WHERE "origenTipo" IS NOT NULL;
