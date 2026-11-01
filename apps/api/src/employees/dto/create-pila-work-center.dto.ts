import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, Length } from 'class-validator';

function trimUppercase({ value }: { value: unknown }) {
  return typeof value === 'string' ? value.trim().toUpperCase() : value;
}

function trimValue({ value }: { value: unknown }) {
  return typeof value === 'string' ? value.trim() : value;
}

export class CreatePilaWorkCenterDto {
  @Transform(trimUppercase)
  @IsString()
  @Length(1, 6)
  arlCodigo: string;

  @Transform(trimUppercase)
  @IsString()
  @Length(1, 40)
  codigoCentro: string;

  @Transform(trimValue)
  @IsString()
  @Length(1, 120)
  nombre: string;

  @IsOptional()
  @IsUUID()
  sedeId?: string | null;
}
