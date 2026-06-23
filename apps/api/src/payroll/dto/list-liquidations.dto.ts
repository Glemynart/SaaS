import { IsOptional, IsString, IsNumber, Min, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { LiquidationStatus } from '@prisma/client';

/**
 * Query de listado paginado de liquidaciones (N2D.6).
 * Replica la convención de EmployeeQueryDto: page/limit transformados de string
 * a número, filtros opcionales por estado y empleado.
 */
export class ListLiquidationsDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Transform(({ value }) => parseInt(value as string, 10))
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Transform(({ value }) => parseInt(value as string, 10))
  limit?: number = 10;

  @IsOptional()
  @IsEnum(LiquidationStatus)
  status?: LiquidationStatus;

  @IsOptional()
  @IsString()
  empleadoId?: string;
}
