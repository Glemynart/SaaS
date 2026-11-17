import {
  IsInt,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  Matches,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { EmployeeDisbursementMethod } from '@prisma/client';

export enum EmployeeDisbursementSourceType {
  PAYROLL_RUN = 'PAYROLL_RUN',
  LIQUIDATION = 'LIQUIDATION',
}

const POSITIVE_COP_AMOUNT = /^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9._:-]{8,128}$/;

export class CreateEmployeeDisbursementDto {
  @IsEnum(EmployeeDisbursementSourceType)
  sourceType!: EmployeeDisbursementSourceType;

  @IsString()
  @Length(1, 64)
  sourceId!: string;

  @IsString()
  @Matches(POSITIVE_COP_AMOUNT)
  amount!: string;

  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  paidAt!: string;

  @IsEnum(EmployeeDisbursementMethod)
  method!: EmployeeDisbursementMethod;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  reference?: string;

  @IsString()
  @Matches(IDEMPOTENCY_KEY)
  idempotencyKey!: string;
}

export class ReverseEmployeeDisbursementDto {
  @IsString()
  @Matches(POSITIVE_COP_AMOUNT)
  amount!: string;

  @IsString()
  @Length(3, 512)
  reason!: string;

  @IsString()
  @Matches(IDEMPOTENCY_KEY)
  idempotencyKey!: string;
}

export class CancelEmployeeDisbursementDto {
  @IsString()
  @Length(3, 512)
  reason!: string;
}

export class ListEmployeeDisbursementObligationsDto {
  @IsEnum(EmployeeDisbursementSourceType)
  sourceType!: EmployeeDisbursementSourceType;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  page = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  limit = 25;
}

export class ListPendingEmployeeDisbursementsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  page = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  limit = 25;
}
