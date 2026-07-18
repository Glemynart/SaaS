import { IsNotEmpty, IsString } from 'class-validator';

export class ReopenPeriodDto {
  @IsString()
  @IsNotEmpty()
  motivo: string;
}
