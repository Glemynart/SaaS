import {
  IsString,
  IsOptional,
  IsEnum,
  IsNotEmpty,
  IsDateString,
} from 'class-validator';

export enum AlertSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
}

export enum AlertStatus {
  OPEN = 'OPEN',
  RESOLVED = 'RESOLVED',
}

export class CreateAlertDto {
  @IsString()
  @IsNotEmpty()
  titulo: string;

  @IsString()
  @IsNotEmpty()
  descripcion: string;

  @IsEnum(AlertSeverity)
  @IsNotEmpty()
  severity: AlertSeverity;

  @IsString()
  @IsOptional()
  employeeId?: string;

  @IsString()
  @IsOptional()
  employeeFileId?: string;

  @IsString()
  @IsOptional()
  expedienteDocId?: string;

  @IsDateString()
  @IsOptional()
  dueDate?: string;
}
