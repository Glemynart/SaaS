import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsDateString,
  IsNumber,
} from 'class-validator';

export enum PayrollPeriodStatus {
  DRAFT = 'DRAFT',
  CLOSED = 'CLOSED',
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
