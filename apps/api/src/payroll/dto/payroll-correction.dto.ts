import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  PayrollCorrectionCalculationInput,
  PayrollCorrectionIntentKind,
} from '../corrections/payroll-correction.types';

export { PayrollCorrectionCalculationInput, PayrollCorrectionIntentKind };

export class PayrollCorrectionIntentDto {
  @IsEnum(PayrollCorrectionIntentKind)
  kind: PayrollCorrectionIntentKind;

  @IsString()
  @IsNotEmpty()
  snapshotId: string;

  @ValidateIf(
    (intent: PayrollCorrectionIntentDto) =>
      intent.kind === PayrollCorrectionIntentKind.SET_CALCULATION_INPUT,
  )
  @IsEnum(PayrollCorrectionCalculationInput)
  input?: PayrollCorrectionCalculationInput;

  @ValidateIf(
    (intent: PayrollCorrectionIntentDto) =>
      intent.kind === PayrollCorrectionIntentKind.SET_CALCULATION_INPUT,
  )
  @IsInt()
  @Min(0)
  targetAmount?: number;

  @ValidateIf(
    (intent: PayrollCorrectionIntentDto) =>
      intent.kind === PayrollCorrectionIntentKind.MOVE_COST_CENTER,
  )
  @IsString()
  @IsNotEmpty()
  targetCostCenterId?: string;
}

export class CreatePayrollCorrectionDto {
  @IsString()
  @IsNotEmpty()
  descripcion: string;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => PayrollCorrectionIntentDto)
  intents: PayrollCorrectionIntentDto[];
}

export class TransitionPayrollCorrectionDto {
  @IsString()
  @IsOptional()
  motivo?: string;
}
