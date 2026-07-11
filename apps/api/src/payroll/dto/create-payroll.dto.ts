import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsDateString,
  IsNumber,
} from 'class-validator';

/** Espejo del enum Prisma PayrollPeriodStatus (ver schema.prisma para la máquina de estados P1/U1). */
export enum PayrollPeriodStatus {
  // Legado — sin uso en código nuevo desde P1/U1.
  DRAFT = 'DRAFT',
  CLOSED = 'CLOSED',
  // Máquina de estados del ProcesoNómina (ADR-002 §6).
  BORRADOR = 'BORRADOR',
  CALCULADA = 'CALCULADA',
  EN_REVISION = 'EN_REVISION',
  APROBADA = 'APROBADA',
  CERRADA = 'CERRADA',
}

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
