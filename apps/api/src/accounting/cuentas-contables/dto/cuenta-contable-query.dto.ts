import { IsOptional, IsString, IsBoolean, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { ClaseContable } from '@prisma/client';

const toBool = ({ value }: { value: unknown }) =>
  value === undefined ? undefined : value === 'true' || value === true;

export class CuentaContableQueryDto {
  @IsOptional()
  @IsString()
  search?: string; // coincide por codigo o nombre

  @IsOptional()
  @IsEnum(ClaseContable)
  claseContable?: ClaseContable;

  @IsOptional()
  @IsBoolean()
  @Transform(toBool)
  imputable?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(toBool)
  activa?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(toBool)
  includeDeleted?: boolean;
}
