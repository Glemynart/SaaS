import {
  IsOptional,
  IsString,
  IsNumber,
  IsEnum,
  Min,
  Max,
} from 'class-validator';
import { Transform } from 'class-transformer';

export enum ContratoEstadoFilter {
  VIGENTE = 'VIGENTE',
  VENCIDO = 'VENCIDO',
  TERMINADO = 'TERMINADO',
  RENOVADO = 'RENOVADO',
}

export class ContractQueryDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Transform(({ value }) => parseInt(value as string, 10))
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => parseInt(value as string, 10))
  limit?: number = 10;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsEnum(ContratoEstadoFilter)
  estado?: ContratoEstadoFilter;
}
