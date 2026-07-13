import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsDateString,
  IsNumber,
} from 'class-validator';
import { PayrollPeriodStatus } from '@prisma/client';

/**
 * Re-exportado desde @prisma/client: fuente única de verdad. No duplicar
 * la máquina de estados aquí (ver schema.prisma, enum PayrollPeriodStatus,
 * para la definición y ADR-002 §6 para la semántica de P1/U1).
 */
export { PayrollPeriodStatus };

export class CreatePayrollPeriodDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsDateString()
  @IsNotEmpty()
  fechaInicio: string;

  @IsDateString()
  @IsNotEmpty()
  fechaFin: string;
}

/** Body opcional de POST payroll/periods/:id/rechazar (ADR-002 §6). */
export class RejectPayrollPeriodDto {
  @IsString()
  @IsOptional()
  motivo?: string;
}

/** Body opcional de PATCH payroll/blocks/:blockId/exclude. */
export class ExcludePayrollBlockDto {
  @IsString()
  @IsOptional()
  motivo?: string;
}

export enum PayrollNoveltyType {
  VACATION = 'VACATION',
  SICKNESS = 'SICKNESS',
  LICENSE = 'LICENSE',
  OVERTIME = 'OVERTIME',
  BONUS = 'BONUS',
  OTHER = 'OTHER',
}

export class CreatePayrollNoveltyDto {
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @IsString()
  @IsNotEmpty()
  payrollPeriodId: string;

  @IsEnum(PayrollNoveltyType)
  @IsNotEmpty()
  tipo: PayrollNoveltyType;

  @IsString()
  @IsOptional()
  descripcion?: string;

  @IsDateString()
  @IsNotEmpty()
  fecha: string;

  @IsNumber()
  @IsOptional()
  valor?: number;
}
