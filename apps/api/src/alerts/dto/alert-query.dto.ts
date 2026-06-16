import { IsOptional, IsNumber, Min, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { AlertSeverity, AlertStatus } from './create-alert.dto';

export class AlertQueryDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Transform(({ value }) => parseInt(value as string, 10))
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Transform(({ value }) => parseInt(value as string, 10))
  limit?: number = 20;

  @IsOptional()
  @IsEnum(AlertStatus)
  status?: AlertStatus;

  @IsOptional()
  @IsEnum(AlertSeverity)
  severity?: AlertSeverity;
}
