import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreatePayrollCorrectionDto {
  @IsString()
  @IsNotEmpty()
  descripcion: string;
}

export class TransitionPayrollCorrectionDto {
  @IsString()
  @IsOptional()
  motivo?: string;
}
