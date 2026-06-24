import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Filtro de estado para el listado de lotes. Espeja el enum LoteEstado de
 * Prisma sin acoplar el DTO al cliente generado.
 */
export enum LoteEstadoFilter {
  PENDIENTE = 'PENDIENTE',
  EN_PROCESO = 'EN_PROCESO',
  COMPLETADO = 'COMPLETADO',
  COMPLETADO_CON_ERRORES = 'COMPLETADO_CON_ERRORES',
  FALLIDO = 'FALLIDO',
}

export class LoteQueryDto {
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
  @IsEnum(LoteEstadoFilter)
  estado?: LoteEstadoFilter;
}
