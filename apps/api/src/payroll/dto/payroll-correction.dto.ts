import { IsNotEmpty, IsString } from 'class-validator';

export class CreatePayrollCorrectionDto {
  @IsString()
  @IsNotEmpty()
  descripcion: string;
}
