import { BadRequestException } from '@nestjs/common';
import { PayrollCorrectionStatus } from '@prisma/client';

export const VALID_CORRECTION_TRANSITIONS: Record<
  PayrollCorrectionStatus,
  PayrollCorrectionStatus[]
> = {
  BORRADOR: [
    PayrollCorrectionStatus.EN_REVISION,
    PayrollCorrectionStatus.CANCELADA,
  ],
  EN_REVISION: [
    PayrollCorrectionStatus.APROBADA,
    PayrollCorrectionStatus.RECHAZADA,
    PayrollCorrectionStatus.CANCELADA,
  ],
  APROBADA: [],
  RECHAZADA: [],
  CANCELADA: [],
};

export function assertCorrectionTransition(
  current: PayrollCorrectionStatus,
  target: PayrollCorrectionStatus,
): void {
  if (!VALID_CORRECTION_TRANSITIONS[current].includes(target)) {
    throw new BadRequestException(
      `Transición de corrección no permitida: ${current} → ${target}`,
    );
  }
}
