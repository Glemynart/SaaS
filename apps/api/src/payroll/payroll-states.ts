/**
 * Máquina de estados del ProcesoNómina (ADR-002 §6), alcance P1/U1: hasta
 * APROBADA. CAUSADA (P2) y PAGADA (P3) se añadirán aquí de forma aditiva
 * cuando esas fases lleguen — sin renombrar los estados ya definidos.
 *
 * DRAFT/CLOSED son legado (ver schema.prisma): el backfill de U1 vació por
 * completo esos valores de la tabla; ningún código nuevo los produce ni los
 * transiciona. Se listan con destino vacío únicamente porque `Record` exige
 * exhaustividad sobre el enum completo.
 *
 * CERRADA no aparece como destino de ninguna transición aquí: en U1/P1 es
 * exclusivamente el resultado del backfill legado (CLOSED → CERRADA). La
 * ruta funcional PAGADA → CERRADA la añadirá P3.
 *
 * El alias legado `closePeriod` (CALCULADA → APROBADA directo) NO se valida
 * contra este mapa a propósito: es un atajo temporal fuera del flujo
 * oficial, con su propia guarda en payroll.service.ts.
 */
import { BadRequestException } from '@nestjs/common';
import { PayrollPeriodStatus } from '@prisma/client';

export const VALID_TRANSITIONS: Record<
  PayrollPeriodStatus,
  PayrollPeriodStatus[]
> = {
  DRAFT: [],
  CLOSED: [],
  BORRADOR: [PayrollPeriodStatus.CALCULADA],
  CALCULADA: [PayrollPeriodStatus.EN_REVISION, PayrollPeriodStatus.BORRADOR],
  EN_REVISION: [PayrollPeriodStatus.APROBADA, PayrollPeriodStatus.CALCULADA],
  APROBADA: [],
  CERRADA: [],
};

export function assertTransition(
  current: PayrollPeriodStatus,
  target: PayrollPeriodStatus,
): void {
  if (!VALID_TRANSITIONS[current].includes(target)) {
    throw new BadRequestException(
      `Transición de estado no permitida: ${current} → ${target}`,
    );
  }
}
