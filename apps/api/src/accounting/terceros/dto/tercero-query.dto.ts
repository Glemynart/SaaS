import { IsOptional, IsString, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

const toBool = ({ value }: { value: unknown }) =>
  value === undefined ? undefined : value === 'true' || value === true;

export class TerceroQueryDto {
  @IsOptional()
  @IsString()
  search?: string; // coincide por razonSocial, numeroDocumento o nombres

  @IsOptional() @IsBoolean() @Transform(toBool) esCliente?: boolean;
  @IsOptional() @IsBoolean() @Transform(toBool) esProveedor?: boolean;
  @IsOptional() @IsBoolean() @Transform(toBool) activo?: boolean;
  @IsOptional() @IsBoolean() @Transform(toBool) includeDeleted?: boolean;
}
