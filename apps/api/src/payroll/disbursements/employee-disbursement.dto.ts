import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
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
