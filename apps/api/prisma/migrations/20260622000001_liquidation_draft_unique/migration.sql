-- N2D.6 — Índice único parcial: máximo una liquidación DRAFT por empleado/tenant.
--
-- Cierra el TOCTOU del anti-duplicado de createLiquidacion (findFirst+create).
-- Es un índice PARCIAL (WHERE status = 'DRAFT'): solo las liquidaciones en
-- borrador compiten por unicidad. Los estados terminales (APPROVED, PAID,
-- VOIDED) quedan fuera del índice, de modo que un empleado puede acumular
-- varias liquidaciones históricas pero solo un borrador activo a la vez.
--
-- NOTA Prisma: los índices parciales con cláusula WHERE no son expresables en
-- schema.prisma (limitación conocida). Este índice vive solo en la migración.
-- `prisma migrate deploy` lo aplica sin problema; un futuro `migrate dev` podría
-- reportar drift y requerir re-añadirlo manualmente.

CREATE UNIQUE INDEX "liquidations_tenantId_empleadoId_draft_key"
  ON "liquidations" ("tenantId", "empleadoId")
  WHERE "status" = 'DRAFT';
