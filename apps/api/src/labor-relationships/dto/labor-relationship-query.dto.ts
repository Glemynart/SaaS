import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class LaborRelationshipQueryDto {
  @IsUUID()
  @IsOptional()
  empleadoId?: string;

  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  @IsOptional()
  activo?: boolean;
}
