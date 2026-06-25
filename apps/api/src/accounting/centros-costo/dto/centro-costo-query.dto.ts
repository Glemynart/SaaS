import { IsOptional, IsString, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

const toBool = ({ value }: { value: unknown }) =>
  value === undefined ? undefined : value === 'true' || value === true;

export class CentroCostoQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional() @IsBoolean() @Transform(toBool) activo?: boolean;
  @IsOptional() @IsBoolean() @Transform(toBool) includeDeleted?: boolean;
}
