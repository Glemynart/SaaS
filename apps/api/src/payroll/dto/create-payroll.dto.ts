import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsDateString,
  IsNumber,
  Matches,
  IsInt,
  Min,
  Max,
  IsBoolean,
  MaxLength,
} from 'class-validator';
import {
  PayrollPeriodStatus,
  PayrollPilaFspSourceScope,
  PayrollPilaVoluntaryPensionStatus,
  PilaEventCode,
  PilaVacLrSubtype,
} from '@prisma/client';

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

  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsOptional()
  fechaPrevistaPagoPila?: string | null;
}

export class UpdatePayrollPilaPaymentDateDto {
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsOptional()
  fechaPrevistaPagoPila: string | null;
}

export class UpdatePayrollPilaFspSourceScopeDto {
  @IsEnum(PayrollPilaFspSourceScope)
  sourceScope: PayrollPilaFspSourceScope;
}

export class UpdatePayrollPilaVoluntaryPensionStatusDto {
  @IsEnum(PayrollPilaVoluntaryPensionStatus)
  status: PayrollPilaVoluntaryPensionStatus;
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

export class CreatePayrollPilaEventDto {
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @IsEnum(PilaEventCode)
  codigo: PilaEventCode;

  @IsOptional()
  @IsEnum(PilaVacLrSubtype)
  subtipo?: PilaVacLrSubtype;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fechaInicio: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fechaFin?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  dias?: number;

  @IsOptional()
  @IsString()
  @Matches(/^(?=.*[1-9])(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/)
  ultimoIbcReportado?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  periodoIbcReportado?: string;

  @IsOptional()
  @IsString()
  @Matches(/\S/)
  @MaxLength(80)
  operadorFuenteIbc?: string;

  @IsOptional()
  @IsString()
  @Matches(/\S/)
  @MaxLength(160)
  referenciaFuenteIbc?: string;

  @IsOptional()
  @IsBoolean()
  confirmoFuenteIbc?: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^(?=.*[1-9])(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/)
  remuneracionVacacionesReportada?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  periodoPagoVacaciones?: string;

  @IsOptional()
  @IsString()
  @Matches(/\S/)
  @MaxLength(160)
  referenciaFuenteRemuneracion?: string;

  @IsOptional()
  @IsBoolean()
  confirmoFuenteRemuneracion?: boolean;
}
