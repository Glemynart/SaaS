import { Plan } from '@prisma/client';

export class PlatformTenantResponseDto {
  id!: string;
  nombre!: string;
  razonSocial!: string;
  nit!: string;
  activo!: boolean;
  plan!: Plan;
  createdAt!: Date;
  updatedAt!: Date;
}
