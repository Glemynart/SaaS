-- N2D.5.1 — Migración del enum LiquidationStatus al dominio definitivo.
-- N2D.2 (20260621000002) creó el enum como ('DRAFT', 'FINALIZED', 'VOIDED').
-- La auditoría de dominio de N2D.5 fijó el ciclo de vida real:
--   DRAFT → APPROVED → PAID  (camino feliz)
--   DRAFT/APPROVED → VOIDED  (anulación sin pago, terminal)
--
-- Transformación NO destructiva (preserva filas existentes):
--   1. FINALIZED se renombra a APPROVED (misma semántica: aprobada y congelada).
--   2. Se añade PAID antes de VOIDED para que el orden del enum en PostgreSQL
--      coincida con el declarado en schema.prisma (DRAFT, APPROVED, PAID, VOIDED)
--      y Prisma no detecte drift.
--   3. DRAFT y VOIDED se mantienen intactos (VOIDED ya existía desde N2D.2).
--
-- Compatibilidad PostgreSQL:
--   - RENAME VALUE es transaccional y seguro en toda versión.
--   - ADD VALUE requiere PostgreSQL 12+ para ejecutarse dentro de la
--     transacción que Prisma envuelve. El valor nuevo (PAID) NO se usa en
--     DDL/DML dentro de esta migración, por lo que la restricción de
--     "no usar el valor en la misma transacción" no aplica.
--   - Un valor de enum no puede eliminarse: 'FINALIZED' desaparece vía rename,
--     no vía DROP. No queda residual.

-- AlterEnum
ALTER TYPE "LiquidationStatus" RENAME VALUE 'FINALIZED' TO 'APPROVED';

-- AlterEnum
ALTER TYPE "LiquidationStatus" ADD VALUE 'PAID' BEFORE 'VOIDED';
