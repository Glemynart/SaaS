import { IsOptional, IsInt, IsEnum, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { EstadoPeriodo } from '@prisma/client';

export class PeriodoContableQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  anio?: number;

  @IsOptional()
  @IsEnum(EstadoPeriodo)
  estado?: EstadoPeriodo;
}
